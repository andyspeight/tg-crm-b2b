import "server-only";

/**
 * The sequence engine. Enrols contacts and, on each tick (Vercel cron or a manual
 * run), sends any due step one-by-one through the connected Gmail account. Before
 * every step after the first it checks the Gmail thread for a reply and auto-stops
 * the enrollment if the contact has written back.
 *
 * Sending model: Gmail only, 1:1, sequential. No bulk provider. Opted-out contacts
 * are never enrolled and are stopped if they opt out mid-sequence.
 */

import {
  advanceNurtureDeal,
  createActivity,
  createEnrollmentRecord,
  getContact,
  noteLeadNextStep,
  findDripSequenceForTemplate,
  getEmailSignature,
  getEmailTemplate,
  getSequence,
  hasLiveEnrollment,
  listDueEnrollments,
  listSequences,
  setTrackingMessageId,
  updateEnrollment,
  ValidationError,
} from "@/lib/crm/data";
import type { Sequence, SequenceEnrollment } from "@/lib/crm/types";
import { getAccessToken, getConnection } from "@/lib/google/oauth";
import { getMessageMeta, sendGmailRich, threadHasReplyFrom } from "@/lib/google/gmail";
import { applyEmailTracking } from "@/lib/email/tracking";
import { appendSignatureHtml } from "@/lib/email/signature";
import { fillMergeTags, firstNameOf } from "@/lib/email/merge";

const DAY_MS = 24 * 60 * 60 * 1000;
// Keep a single tick within the serverless time budget; the rest wait for the next.
const MAX_PER_RUN = 25;

function addDays(fromIso: string, days: number): string {
  return new Date(new Date(fromIso).getTime() + days * DAY_MS).toISOString();
}

/** "Re: x" without stacking prefixes. */
function replySubject(base: string): string {
  const clean = base.replace(/^(re:\s*)+/i, "").trim();
  return `Re: ${clean}`;
}

// --- enrolment --------------------------------------------------------------

export async function enrollContact(
  sequenceId: string,
  contactId: string,
): Promise<SequenceEnrollment> {
  const [sequence, contact] = await Promise.all([getSequence(sequenceId), getContact(contactId)]);
  if (sequence.status !== "Active") {
    throw new ValidationError("Activate the sequence before enrolling contacts.");
  }
  if (sequence.steps.length === 0) {
    throw new ValidationError("This sequence has no steps yet.");
  }
  if (!contact.email) {
    throw new ValidationError("That contact has no email address.");
  }
  if (contact.marketingOptIn === "Opted Out") {
    throw new ValidationError(`${firstNameOf(contact.name)} is opted out — they can't be enrolled.`);
  }
  if (await hasLiveEnrollment(sequenceId, contactId)) {
    throw new ValidationError("That contact is already in this sequence.");
  }

  const now = new Date().toISOString();
  const firstDelay = sequence.steps[0]?.delayDays ?? 0;
  const nextSendAt = firstDelay > 0 ? addDays(now, firstDelay) : now;
  const enrollment = await createEnrollmentRecord({
    sequenceId,
    contactId,
    status: "Active",
    stepIndex: 0,
    nextSendAt,
    companyId: contact.companyId,
    enrolledAt: now,
    lastError: "",
    label: `${contact.name || "Contact"} → ${sequence.name}`,
  });

  // Leave a mark on the timeline straight away — the first email (and its own
  // activity) only lands when the drip cron next sends, which may be days off.
  await createActivity({
    type: "Campaign",
    source: "Manual",
    summary: `Added to sequence "${sequence.name}"`,
    rawContent:
      firstDelay > 0
        ? `First email scheduled for ${nextSendAt.slice(0, 10)}.`
        : `First email sends on the next sequence run.`,
    date: now,
    companyId: contact.companyId,
    contactId,
  }).catch((e) => console.error("[sequence-engine] enrol activity log failed:", e));

  // Show the drip on their pipeline card immediately (before the first send).
  await noteLeadNextStep({
    name: contact.name || "",
    companyId: contact.companyId,
    nextStep:
      firstDelay > 0
        ? `In sequence "${sequence.name}" — email 1 of ${sequence.steps.length} on ${nextSendAt.slice(0, 10)}`
        : `In sequence "${sequence.name}" — email 1 of ${sequence.steps.length} imminent`,
  }).catch((e) => console.error("[sequence-engine] note next step failed:", e));

  return enrollment;
}

/**
 * Start a drip right after the composer has sent the intro itself.
 *
 * The intro (a sequence's step 1) has already gone out from the composer, so we
 * must NOT re-send it. Instead we create the enrollment already advanced to step 2,
 * carrying the just-sent message's thread id, subject and RFC822 Message-ID so the
 * follow-ups reply straight onto that conversation. Returns quietly (started:false)
 * when there's no matching active drip, the drip has no follow-ups, the contact is
 * opted out, or they're already enrolled — the send itself is never affected.
 */
export async function startDripAfterSend(opts: {
  templateId: string;
  contactId: string;
  companyId?: string;
  accessToken: string;
  sentMessageId: string;
  threadId: string;
  filledSubject: string;
}): Promise<{ started: boolean; sequenceName?: string }> {
  const sequence = await findDripSequenceForTemplate(opts.templateId);
  if (!sequence || sequence.steps.length < 2) return { started: false };

  const contact = await getContact(opts.contactId).catch(() => null);
  if (!contact || !contact.email) return { started: false };
  if (contact.marketingOptIn === "Opted Out") return { started: false };
  if (await hasLiveEnrollment(sequence.id, opts.contactId)) return { started: false };

  // Capture the intro's Message-ID so step 2 threads as a proper reply.
  let lastMessageId = "";
  try {
    const meta = await getMessageMeta(opts.accessToken, opts.sentMessageId);
    lastMessageId = meta.messageIdHeader || "";
  } catch {
    /* threading degrades gracefully without it */
  }

  const now = new Date().toISOString();
  await createEnrollmentRecord({
    sequenceId: sequence.id,
    contactId: opts.contactId,
    companyId: opts.companyId ?? contact.companyId,
    status: "Active",
    stepIndex: 1, // intro already sent by the composer — resume at the first follow-up
    nextSendAt: addDays(now, sequence.steps[1]?.delayDays ?? 0),
    threadId: opts.threadId,
    threadSubject: opts.filledSubject,
    lastMessageId,
    enrolledAt: now,
    lastError: "",
    label: `${contact.name || "Contact"} → ${sequence.name}`,
  });

  await createActivity({
    type: "Campaign",
    source: "Manual",
    summary: `Enrolled in drip "${sequence.name}"`,
    rawContent: "Follow-ups will send on the thread from the intro just sent.",
    date: now,
    companyId: opts.companyId ?? contact.companyId,
    contactId: opts.contactId,
  }).catch((e) => console.error("[sequence-engine] drip enrol activity log failed:", e));

  await noteLeadNextStep({
    name: contact.name || "",
    companyId: opts.companyId ?? contact.companyId,
    nextStep: `In drip "${sequence.name}" — intro sent, follow-ups scheduled`,
  }).catch((e) => console.error("[sequence-engine] note next step failed:", e));

  return { started: true, sequenceName: sequence.name };
}

// --- the tick ---------------------------------------------------------------

export interface TickSummary {
  ran: boolean;
  reason?: string;
  due: number;
  processed: number;
  sent: number;
  replied: number;
  completed: number;
  stopped: number;
  failed: number;
  held: number;
}

type Sender = { accessToken: string; email: string; name?: string };

export async function runDueSequences(): Promise<TickSummary> {
  const summary: TickSummary = {
    ran: false,
    due: 0,
    processed: 0,
    sent: 0,
    replied: 0,
    completed: 0,
    stopped: 0,
    failed: 0,
    held: 0,
  };

  let sender: Sender;
  try {
    sender = await getAccessToken();
  } catch {
    return { ...summary, reason: "Gmail isn't connected." };
  }
  const conn = await getConnection();
  const canRead = conn?.canRead ?? false;

  const [sequences, due] = await Promise.all([listSequences(), listDueEnrollments(new Date().toISOString())]);
  const seqById = new Map(sequences.map((s) => [s.id, s]));
  summary.ran = true;
  summary.due = due.length;

  for (const enrollment of due.slice(0, MAX_PER_RUN)) {
    summary.processed += 1;
    try {
      const outcome = await processEnrollment(enrollment, sender, canRead, seqById);
      summary[outcome] += 1;
    } catch (e) {
      // Transient failure — keep it Active and retry on the next tick in ~1h.
      summary.failed += 1;
      await updateEnrollment(enrollment.id, {
        nextSendAt: addDays(new Date().toISOString(), 0.05),
        lastError: e instanceof Error ? e.message : "Unknown send error",
      }).catch(() => {});
    }
  }
  return summary;
}

type Outcome = "sent" | "replied" | "completed" | "stopped" | "failed" | "held";

async function processEnrollment(
  enrollment: SequenceEnrollment,
  sender: Sender,
  canRead: boolean,
  seqById: Map<string, Sequence>,
): Promise<Outcome> {
  const now = new Date().toISOString();
  const sequence = enrollment.sequenceId ? seqById.get(enrollment.sequenceId) : undefined;

  // Sequence gone or paused → hold (paused) or fail (deleted), never send.
  if (!sequence) {
    await updateEnrollment(enrollment.id, { status: "Failed", lastError: "Sequence no longer exists." });
    return "failed";
  }
  if (sequence.status !== "Active") return "held";

  const contact = enrollment.contactId ? await getContact(enrollment.contactId).catch(() => null) : null;
  if (!contact || !contact.email) {
    await updateEnrollment(enrollment.id, { status: "Failed", lastError: "Contact has no email address." });
    return "failed";
  }
  if (contact.marketingOptIn === "Opted Out") {
    await updateEnrollment(enrollment.id, {
      status: "Stopped",
      completedAt: now,
      lastError: "Contact is opted out.",
    });
    return "stopped";
  }

  // Reply check (metadata read scope). A read hiccup must not block sending.
  if (canRead && enrollment.threadId) {
    try {
      if (await threadHasReplyFrom(sender.accessToken, enrollment.threadId, contact.email)) {
        await updateEnrollment(enrollment.id, { status: "Replied", completedAt: now, lastError: "" });
        await createActivity({
          type: "Note",
          source: "Gmail",
          summary: `${contact.name} replied — sequence "${sequence.name}" stopped`,
          date: now,
          companyId: enrollment.companyId,
          contactId: enrollment.contactId,
        }).catch(() => {});
        return "replied";
      }
    } catch {
      /* couldn't read the thread this time; proceed to send */
    }
  }

  const step = sequence.steps[enrollment.stepIndex];
  if (!step) {
    await updateEnrollment(enrollment.id, { status: "Completed", completedAt: now, lastError: "" });
    return "completed";
  }

  const template = await getEmailTemplate(step.templateId).catch(() => null);
  if (!template) {
    await updateEnrollment(enrollment.id, {
      status: "Failed",
      lastError: "A template used by this sequence is missing.",
    });
    return "failed";
  }

  const vars = { firstName: firstNameOf(contact.name), company: contact.companyName };
  const filledSubject = fillMergeTags(template.subject || "", vars).trim() || "(no subject)";
  const filledHtml = fillMergeTags(template.body || "", vars);
  // Append the operator's signature (idempotent) so sequence steps sign off too.
  const signedHtml = appendSignatureHtml(filledHtml, await getEmailSignature().catch(() => ""));

  const isFollowUp = !!enrollment.threadId;
  const subject = isFollowUp ? replySubject(enrollment.threadSubject || filledSubject) : filledSubject;

  // Pixel for open tracking; template attachments go out as tracked links.
  const { html, attachments, trackingIds } = await applyEmailTracking({
    html: signedHtml,
    subject,
    recipient: contact.email,
    companyId: enrollment.companyId,
    contactId: enrollment.contactId,
    templateId: template.id,
  });

  const sent = await sendGmailRich({
    accessToken: sender.accessToken,
    fromEmail: sender.email,
    fromName: sender.name,
    to: contact.email,
    subject,
    html,
    attachments,
    threadId: enrollment.threadId,
    inReplyTo: enrollment.lastMessageId,
    references: enrollment.lastMessageId,
  });

  await setTrackingMessageId(trackingIds, sent.id).catch(() => {});

  // Capture our sent message's RFC822 Message-ID so the next step threads cleanly.
  let messageIdHeader = enrollment.lastMessageId;
  try {
    const meta = await getMessageMeta(sender.accessToken, sent.id);
    if (meta.messageIdHeader) messageIdHeader = meta.messageIdHeader;
  } catch {
    /* threading degrades gracefully without it */
  }

  const nextIndex = enrollment.stepIndex + 1;
  const done = nextIndex >= sequence.steps.length;

  await updateEnrollment(enrollment.id, {
    stepIndex: nextIndex,
    threadId: enrollment.threadId || sent.threadId,
    threadSubject: enrollment.threadSubject || filledSubject,
    lastMessageId: messageIdHeader,
    status: done ? "Completed" : "Active",
    nextSendAt: done ? "" : addDays(now, sequence.steps[nextIndex]?.delayDays ?? 0),
    completedAt: done ? now : "",
    lastError: "",
  });

  await createActivity({
    type: "Email",
    source: "Gmail",
    summary: subject,
    rawContent: html,
    date: now,
    companyId: enrollment.companyId,
    contactId: enrollment.contactId,
    gmailMessageId: sent.id,
    direction: "Outbound",
  }).catch((e) => console.error("[sequence-engine] activity log failed:", e));

  // Move the lead's pipeline card into "Nurturing", showing how far through the
  // drip they are (the step just sent is enrollment.stepIndex, 1-based).
  await advanceNurtureDeal({
    name: contact.name || "",
    companyId: enrollment.companyId,
    emailNumber: enrollment.stepIndex + 1,
    totalEmails: sequence.steps.length,
  }).catch((e) => console.error("[sequence-engine] nurture advance failed:", e));

  return done ? "completed" : "sent";
}
