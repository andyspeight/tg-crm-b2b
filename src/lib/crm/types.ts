import {
  COMPANY_TYPES,
  REGIONS,
  LIFECYCLE_STAGES,
  ACCOUNT_HEALTH,
  CARE_CADENCES,
  SIZE_BANDS,
  DEAL_SOURCES,
  MARKETING_OPT_IN,
  ACTIVITY_TYPES,
  ACTIVITY_SOURCES,
  ACTIVITY_DIRECTIONS,
  TASK_STATUSES,
  TASK_CREATED_BY,
  TOUCH_TYPES,
  CARE_STATUSES,
  SEQUENCE_STATUSES,
  ENROLLMENT_STATUSES,
  SIGNAL_TYPES,
  SIGNAL_STATUSES,
  TRACKING_KINDS,
} from "./config";

export type CompanyType = (typeof COMPANY_TYPES)[number];
export type Region = (typeof REGIONS)[number];
export type LifecycleStage = (typeof LIFECYCLE_STAGES)[number];
export type AccountHealth = (typeof ACCOUNT_HEALTH)[number];
export type CareCadence = (typeof CARE_CADENCES)[number];
export type SizeBand = (typeof SIZE_BANDS)[number];
// Stages are user-editable, so a deal's stage is just its (current) stage name.
export type DealStage = string;
export type DealSource = (typeof DEAL_SOURCES)[number];

/** How a stage behaves: terminal won/lost, or a live "open" column. */
export type StageKind = "open" | "won" | "lost";

/** A pipeline column (editable). Stored in App Settings; order = array order. */
export interface PipelineStage {
  name: string;
  color: string;
  kind: StageKind;
}
export type MarketingOptIn = (typeof MARKETING_OPT_IN)[number];
export type SupportSentiment = "Improving" | "Stable" | "Declining";

export interface Company {
  id: string;
  name: string;
  website?: string;
  type?: CompanyType;
  country?: string;
  region?: Region;
  linkedin?: string;
  socials?: string;
  lifecycleStage?: LifecycleStage;
  planTier?: string;
  mrr?: number;
  goLiveDate?: string;
  renewalDate?: string;
  accountHealth?: AccountHealth;
  careCadence?: CareCadence;
  lastMeaningfulContact?: string;
  productsUsed?: string;
  description?: string;
  sizeBand?: SizeBand;
  enrichedAt?: string;
  enrichmentSource?: string;
  watchlist?: boolean;
  aiBrief?: string;
  nextBestAction?: string;
  // Support 360 — synced from TG Support Desk, read-only in the CRM.
  supportOpenTickets?: number;
  supportTickets30d?: number;
  supportLastIssue?: string;
  supportLastContact?: string;
  supportSentiment?: SupportSentiment;
  supportUpdated?: string;
  // Onboarding handoff — set when a won deal is handed to tg-onboarding.
  onboardingClientId?: string;
  onboardingStarted?: string;
  // Signal monitoring — when the intel scan last checked this account.
  signalsCheckedAt?: string;
  contactIds: string[];
  dealIds: string[];
  activityIds: string[];
  taskIds: string[];
  createdTime?: string;
}

export interface Contact {
  id: string;
  name: string;
  role?: string;
  email?: string;
  /** Other addresses for the same person, accumulated when duplicates are merged. */
  alternateEmails?: string[];
  phone?: string;
  linkedin?: string;
  marketingOptIn?: MarketingOptIn;
  notes?: string;
  headline?: string;
  location?: string;
  enrichedAt?: string;
  source?: string;
  companyId?: string;
  /** When the Gmail inbox sync last checked this person's correspondence. */
  inboxSyncedAt?: string;
  /** Resolved from the linked company where available (convenience for list views). */
  companyName?: string;
  companyLifecycle?: LifecycleStage;
  createdTime?: string;
}

export interface Deal {
  id: string;
  name: string;
  stage?: DealStage;
  mrr?: number;
  setupFee?: number;
  source?: DealSource;
  expectedCloseDate?: string;
  lostReason?: string;
  owner?: string;
  nextStep?: string;
  nextStepDate?: string;
  companyId?: string;
  companyName?: string;
  createdTime?: string;
}

export type ActivityType = (typeof ACTIVITY_TYPES)[number];
export type ActivitySource = (typeof ACTIVITY_SOURCES)[number];
export type ActivityDirection = (typeof ACTIVITY_DIRECTIONS)[number];
export type TaskStatus = (typeof TASK_STATUSES)[number];
export type TaskCreatedBy = (typeof TASK_CREATED_BY)[number];

export interface Activity {
  id: string;
  summary: string;
  type?: ActivityType;
  date?: string;
  rawContent?: string;
  source?: ActivitySource;
  companyId?: string;
  contactId?: string;
  dealId?: string;
  /** The Gmail message id this came from (synced correspondence / logged send). */
  gmailMessageId?: string;
  /** For emails: received (Inbound) or sent (Outbound). */
  direction?: ActivityDirection;
  createdTime?: string;
}

export interface Task {
  id: string;
  title: string;
  dueDate?: string;
  status?: TaskStatus;
  owner?: string;
  createdBy?: TaskCreatedBy;
  companyId?: string;
  companyName?: string;
  dealId?: string;
  createdTime?: string;
}

export type TouchType = (typeof TOUCH_TYPES)[number];
export type CareStatus = (typeof CARE_STATUSES)[number];

export interface CareTouch {
  id: string;
  name: string;
  touchType?: TouchType;
  dueDate?: string;
  status?: CareStatus;
  outcomeNotes?: string;
  companyId?: string;
  createdTime?: string;
}
export type CareTouchInput = Partial<Omit<CareTouch, "id" | "createdTime">>;

// --- Email templates --------------------------------------------------------

export interface EmailAttachment {
  id?: string;
  url?: string;
  filename: string;
  size?: number;
  type?: string;
}

export interface EmailTemplate {
  id: string;
  name: string;
  subject?: string;
  body?: string;
  description?: string;
  attachments: EmailAttachment[];
  createdTime?: string;
}
// Attachments are managed via their own upload endpoint, not the record patch.
export type EmailTemplateInput = Partial<
  Omit<EmailTemplate, "id" | "createdTime" | "attachments">
>;

// --- Email sequences (Phase 3) ----------------------------------------------

export type SequenceStatus = (typeof SEQUENCE_STATUSES)[number];
export type EnrollmentStatus = (typeof ENROLLMENT_STATUSES)[number];

/** One step: which template to send, and how long to wait after the previous step. */
export interface SequenceStep {
  templateId: string;
  delayDays: number;
}

export interface Sequence {
  id: string;
  name: string;
  description?: string;
  status: SequenceStatus;
  steps: SequenceStep[];
  createdTime?: string;
}
export type SequenceInput = Partial<Omit<Sequence, "id" | "createdTime">>;

export interface SequenceEnrollment {
  id: string;
  sequenceId?: string;
  sequenceName?: string;
  contactId?: string;
  contactName?: string;
  contactEmail?: string;
  status: EnrollmentStatus;
  stepIndex: number;
  nextSendAt?: string;
  threadId?: string;
  threadSubject?: string;
  lastMessageId?: string;
  companyId?: string;
  lastError?: string;
  enrolledAt?: string;
  completedAt?: string;
  createdTime?: string;
}
export type EnrollmentInput = Partial<
  Omit<SequenceEnrollment, "id" | "sequenceName" | "contactName" | "contactEmail" | "createdTime">
>;

// --- Signals (intel monitoring) ---------------------------------------------

export type SignalType = (typeof SIGNAL_TYPES)[number];
export type SignalStatus = (typeof SIGNAL_STATUSES)[number];

export interface Signal {
  id: string;
  headline: string;
  type?: SignalType;
  url?: string;
  dateFound?: string;
  relevanceScore?: number;
  status: SignalStatus;
  companyId?: string;
  companyName?: string;
  contactId?: string;
  createdTime?: string;
}
export type SignalInput = Partial<Omit<Signal, "id" | "companyName" | "createdTime">>;

// --- Email open/download tracking -------------------------------------------

export type TrackingKind = (typeof TRACKING_KINDS)[number];

export interface EmailTracking {
  id: string;
  token: string;
  kind: TrackingKind;
  subject?: string;
  filename?: string;
  templateId?: string;
  attachIndex?: number;
  recipient?: string;
  opens: number;
  firstOpened?: string;
  lastOpened?: string;
  sentAt?: string;
  userAgent?: string;
  companyId?: string;
  contactId?: string;
  /** The Gmail message id of the send this row belongs to (joins to the timeline email). */
  gmailMessageId?: string;
  /** Hosted ad-hoc attachment URL (current signed URL from Airtable), if any. */
  fileUrl?: string;
  /** Resolved from the linked contact where available (convenience for feeds). */
  contactName?: string;
  companyName?: string;
  createdTime?: string;
}
export type EmailTrackingInput = Partial<
  Omit<EmailTracking, "id" | "fileUrl" | "contactName" | "companyName" | "createdTime">
>;

/** Progress of the Gmail inbox sync across the contact base. */
export interface InboxSyncStatus {
  /** Contacts that have an email address (the universe to sync). */
  contactsTotal: number;
  /** Of those, how many have been checked at least once. */
  contactsSynced: number;
  /** Contacts with an email that haven't been checked yet. */
  contactsRemaining: number;
  /** When the sync last checked anyone (most recent Inbox Synced stamp). */
  lastSyncedAt?: string;
  /** How far back each run looks, in days (INBOX_SYNC_WINDOW_DAYS). */
  windowDays: number;
  /** Email activities on file across the base. */
  emailsLogged: number;
  /** Date of the oldest email on file (how far back correspondence reaches). */
  oldestEmail?: string;
}

/** Aggregated open/download status for one sent email (keyed by Gmail message id). */
export interface EmailOpenStatus {
  opened: boolean;
  opens: number;
  downloaded: boolean;
  downloads: number;
  lastOpenedAt?: string;
}

export type CompanyInput = Partial<
  Omit<Company, "id" | "contactIds" | "dealIds" | "activityIds" | "taskIds" | "createdTime">
>;
export type ContactInput = Partial<Omit<Contact, "id" | "companyName" | "companyLifecycle" | "createdTime">>;
export type DealInput = Partial<Omit<Deal, "id" | "companyName" | "createdTime">>;
export type ActivityInput = Partial<Omit<Activity, "id" | "createdTime">>;
export type TaskInput = Partial<Omit<Task, "id" | "companyName" | "createdTime">>;
