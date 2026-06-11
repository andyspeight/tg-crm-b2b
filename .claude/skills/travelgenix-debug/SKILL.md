---
name: travelgenix-debug
description: Mandatory QA and debugging protocol for every Travelgenix bug, error, broken feature or regression. Use IMMEDIATELY when Andy reports any problem with code, widgets, deployments, integrations, Airtable, Luna Chat, Luna Marketing, Luna Brain, Luna Trends, Tool Hub, Vercel, Duda, Resend, Brevo, Ably, Cloudflare, or any API. Triggers on any signal of trouble — "it's broken", "not working", "throws an error", "doesn't load", "console error", "500", "404", "CORS", "blank page", "stuck", "won't save", "won't send", "deployment failed", "I'm getting", "why is it", "regression", "used to work", "still broken", "fix this", "debug this", "what's wrong with" — or any error message pasted in. Counters Claude's documented failure mode of guessing a cause, patching, then patch-on-patching when the first fix fails. Forces diagnosis before action, evidence before hypothesis, and a hard stop after 2 failed fixes. Do not skip. Do not start writing code until the diagnostic gates have been passed.
---

# Travelgenix Debugging Protocol

> The single source of truth for how Claude debugs anything for Andy. This skill exists because of a real, repeated failure pattern: Claude latches onto the first plausible cause, ships a patch, the patch doesn't work, Claude patches the patch, and three hours later the problem is further from solved than when it started. Andy has to say STOP or start a new chat. That stops today.

---

## The First Rule

**Diagnosis before action. Evidence before hypothesis. Stop before drift.**

If you find yourself writing a code edit before you can answer "what specifically is broken, where, and how do I know" — stop. You are about to repeat the failure pattern.

---

## The Three Gates

Every debugging session passes through three gates in this order. Do not skip gates. Do not run them in parallel. Do not collapse them into one step because the bug "looks obvious".

1. **Gate 1 — Understand the problem** (no code yet)
2. **Gate 2 — Locate and verify the cause** (still no code yet)
3. **Gate 3 — Fix, deploy, verify** (now you may write code)

You may only pass through Gate 2 once you can state the cause with evidence. You may only pass through Gate 3 once you can predict what will happen when the fix is applied.

---

## Gate 1 — Understand the problem

Before touching anything, write a structured summary back to Andy that demonstrates you actually understand the problem. This is not throat-clearing — it's the moment that catches misunderstandings before they cost an hour.

Produce these answers, in this order:

### 1.1 Restate the symptom

In one sentence, what is the observable failure? Not the suspected cause — the symptom. Examples:

- Symptom: "The My Booking widget shows a blank panel after login on mobile Safari."
- Not a symptom: "The auth cookie isn't being read." (That's a guess, not an observation.)

### 1.2 Establish what should happen

In one sentence, what is the expected behaviour? If you can't state the expected behaviour, you don't understand the feature well enough to debug it. Read the relevant skill (tg-widget-suite, luna-email-composer, etc.) before continuing.

### 1.3 Establish what is happening

In one sentence, what is actually happening? Quote any error message verbatim. Note the exact URL, browser, device, user account, time. If Andy hasn't given you these, ASK before guessing.

### 1.4 Establish the blast radius

Is it:
- One user / one record? (data issue likely)
- One browser / one device? (client-side issue likely)
- One environment (staging vs prod)? (config/env-var issue likely)
- Everyone, everywhere? (deployment or shared-state issue likely)

Different blast radii mean different causes. Don't skip this.

### 1.5 Establish the regression boundary

- Did this ever work? When?
- What changed between "working" and "broken"? (last deploy, last edit, new client, new data, new browser version)
- Is the change in your conversation history? Search past chats if needed.

If Andy says "it used to work yesterday" and you deployed something yesterday, that deployment is the prime suspect. Start there, not at first principles.

### 1.6 The Gate 1 checkpoint

Before moving to Gate 2, you must be able to write this single line:

> "**[Component]** is showing **[actual behaviour]** when it should be showing **[expected behaviour]**, affecting **[blast radius]**, starting after **[regression boundary]**."

If you cannot fill in all five blanks with evidence (not guesses), STOP and ask Andy. Do not proceed.

---

## Gate 2 — Locate and verify the cause

You now have a problem statement. You do NOT yet have a cause. This gate is about finding the cause with evidence, not pattern-matching to "the kind of thing that usually breaks here".

### 2.1 List the hypothesis space (minimum 3)

Write down at least three plausible causes. Resist the urge to write one and run. Forcing three keeps you honest. Examples for a "widget won't load":

- H1: JS error before the widget renders (check console)
- H2: API endpoint returning 500/404 (check Network tab)
- H3: CSS hiding the widget (check computed styles)
- H4: Race condition with `tgse.onReady()` (check timing)
- H5: CORS rejecting the request (check response headers)

If only one hypothesis comes to mind, you are pattern-matching. Force yourself to write at least two more.

### 2.2 Rank by probability AND cost

For each hypothesis, score:
- **Probability**: How likely given the symptom + blast radius + regression boundary?
- **Cost to verify**: How long does it take to confirm or rule out?

Investigate cheapest-to-verify high-probability hypotheses first. A 30-second console check beats a 20-minute code audit even if the code audit is slightly more likely.

### 2.3 Verify with evidence — not vibes

For each hypothesis you investigate, you need a piece of evidence to either confirm or rule out. Acceptable evidence:

- A console error message (verbatim, with line number)
- A network request and response (status, body, headers)
- A specific line of code, viewed, that does or doesn't do the thing
- An Airtable record viewed via MCP showing the actual stored value
- A Vercel function log entry
- A reproduction of the bug with a known input

Unacceptable evidence:

- "It probably is X" — that's a hypothesis, not evidence
- "This usually happens when Y" — pattern matching, not evidence
- "I think the issue is Z" — without having looked at Z

### 2.4 If you can't reproduce it, say so

If you can't see the error yourself and Andy hasn't given you a console error, network response, or stack trace, your first action is to ASK FOR ONE. Do not guess from a symptom alone. Examples of what to ask for:

- "Can you open DevTools → Console and paste anything red?"
- "Can you open DevTools → Network, reproduce the bug, and tell me which request goes red or what status it returns?"
- "Can you check Vercel function logs for that endpoint around [time]?"
- "Can you give me the exact URL where this happens?"

Andy is non-technical and works in the browser, not the terminal. Make these asks specific and one at a time. Do not ask him to run curl or hit endpoints with tokens — read or fetch them yourself.

### 2.5 The Gate 2 checkpoint

Before moving to Gate 3, you must be able to write this:

> "The cause is **[specific thing]**, evidenced by **[specific observation]**. I ruled out **[other hypotheses]** because **[specific reason]**."

If you cannot write this with real evidence, STOP. Either gather more evidence or tell Andy "I don't yet have enough evidence to identify the cause — here's what I need to see to narrow it down: [specific list]." This is a feature, not a failure. It's exactly what would have saved 3 hours this morning.

---

## Gate 3 — Fix, deploy, verify

Only now may you write code. Even here, the discipline continues.

### 3.1 State the fix before writing it

In one or two sentences, what change will you make and why will it resolve the cause identified in Gate 2? If you can't articulate this without saying "let's try", you're guessing.

Bad: "Let me try wrapping it in a try/catch and see if that helps."
Good: "I'll add the `credentials: 'include'` flag on the fetch call because the cause is that the auth cookie isn't being sent on cross-origin requests, evidenced by the 401 response with no cookie header."

### 3.2 Predict the success signal

What specifically should happen after the fix that proves it worked? Write this BEFORE deploying. If the fix "works" but the success signal doesn't appear, you haven't actually fixed it — you've moved the symptom.

Examples of success signals:

- "Console error X disappears."
- "API request returns 200 instead of 401."
- "Widget panel renders the booking data on first load."
- "Email arrives in inbox within 30 seconds."

### 3.3 Make the smallest possible change

Resist the urge to "improve a few other things while we're here". One change per fix. If you bundle a fix with a refactor and the deployment fails, you don't know which change caused it. One bug, one fix, one deploy.

### 3.4 Pre-deploy review (mandatory for code changes)

Before pushing to GitHub, walk through:

- Have I read the relevant skill (tg-widget-suite, travelgenix-security, etc.)?
- Have I checked the security rules in travelgenix-security?
- Have I tested the logic in my head against a worked example?
- Have I considered what happens at the edges (empty input, missing record, expired token)?

### 3.5 Deploy and verify

Andy deploys via GitHub web UI to Vercel. After deploy:

1. Wait for the Vercel build to complete.
2. Ask Andy to reproduce the original action.
3. Ask whether the predicted success signal appeared.
4. Ask whether anything ELSE changed (regressions).

Do not declare victory until Andy confirms the success signal. "It should work now" is not a fix. "It works — I can see the booking data" is a fix.

### 3.6 If the fix doesn't work

This is the moment where the historic failure pattern kicks in. **Stop. Do not patch the patch.** Instead:

Go to the Stop Rule below.

---

## The Stop Rule

After **two failed fix attempts on the same bug**, STOP all coding and trigger a reset:

1. Roll back if the patches added new problems.
2. Acknowledge the rabbit hole explicitly to Andy: "We've tried two fixes and neither worked. I'm stopping here before we drift further."
3. Re-run Gate 1 and Gate 2 from scratch. Treat everything you concluded in this session as suspect — the failed fixes are evidence that the diagnosis was wrong, not that the fix needs tweaking.
4. List what evidence would actually resolve the question. If Andy needs to fetch something specific (a log, a network response, a record), ask for it cleanly.
5. If a third attempt also fails, propose starting a new chat with a clean summary of: the symptom, what's been tried, what was ruled out, and what evidence is needed next.

Two strikes is the rule. Not five. Not "let me just try one more thing". Two.

---

## Anti-patterns — recognise and refuse

These are the specific behaviours that cost Andy three hours this morning. If you catch yourself doing any of them, stop mid-sentence and restart from the appropriate gate.

### Anti-pattern 1: Hypothesis laundering

You guess a cause, deploy a fix, it doesn't work, and you now reason as if the previous guess was correct and only needs adjustment. Each subsequent guess is built on a foundation that was never verified. The only escape is to discard the chain and re-enter Gate 2.

### Anti-pattern 2: The shotgun fix

You change five things at once because "one of them ought to fix it". When it works you don't know which one. When it doesn't work you have five new failure surfaces. One change at a time.

### Anti-pattern 3: Confirmation bias

You decide the cause is X, then go looking for evidence of X and ignore signals that point elsewhere. Counter this by deliberately looking for evidence that would RULE OUT your current hypothesis, not confirm it.

### Anti-pattern 4: The plausible explanation trap

"This is probably because of [common cause for this kind of bug]." Common causes are a good starting point for hypotheses but they are not evidence. Treat the plausible explanation as Hypothesis 1, not as the answer.

### Anti-pattern 5: Skipping the console check

If the bug is client-side and you haven't asked Andy to open DevTools and paste the console + network errors, you are debugging blind. This is the cheapest, fastest evidence available. Ask for it first, always.

### Anti-pattern 6: Trusting the user's diagnosis

Andy may say "I think the cache is broken" or "it's a CORS thing". Treat these as hypotheses to verify, not conclusions. He's not the one with the codebase in front of him — you are. Run them through Gate 2 like any other hypothesis.

### Anti-pattern 7: The "let me just" temptation

"Let me just add a console log." "Let me just try wrapping this." "Let me just see what happens if..." These phrases are the signature of guessing. Every "let me just" is a tax on Andy's time. If you're tempted to "just" try something, you're skipping Gate 2.

### Anti-pattern 8: Drifting from symptom

After the first failed fix, the conversation drifts from "the widget doesn't load" to "the auth token format" to "the cookie domain" to "the Vercel headers" — and the original symptom is no longer being checked. Every fix attempt must be verified against the ORIGINAL symptom, not the latest theory.

### Anti-pattern 9: Ignoring the regression boundary

If something worked yesterday and broke today, the cause is almost certainly in what changed in the last 24 hours. Investigating "first principles" of a system that was working until recently is wasted time. Start with the diff.

### Anti-pattern 10: Verbal-only fixes

"Try this." "Add this line." "Change X to Y." Without showing the full context of where the change goes, Andy may apply it in the wrong place. Always show: filename, the surrounding 3–5 lines for context, what changes, what it becomes.

---

## The Diagnostic Toolkit

Use these techniques in Gate 2 to gather evidence. Match the tool to the bug type.

### For "the widget doesn't load / looks broken"

1. Ask Andy for: console output, network tab (which request failed and what status), the exact URL, the browser.
2. View the widget's source file in the tg-widgets repo.
3. Check the API endpoint it calls — fetch it via web_fetch or curl-equivalent.
4. Check for the standard Shadow DOM + container query pattern from tg-widget-suite skill.
5. Check tgse.onReady() pattern is being used (post-auth-migration).

### For "the API returns an error"

1. Get the exact request URL, method, payload, and response status + body from Andy.
2. View the Vercel function source.
3. Check Vercel function logs for the timestamp Andy reports.
4. Verify env vars exist in Vercel (Andy can screenshot the env var names).
5. Check rate-limit state (Upstash Redis) if relevant.
6. Test the function logic against a known-good input in your head.

### For "Airtable isn't behaving"

1. Use the Airtable MCP to fetch the actual record Andy is looking at.
2. Verify field types, field IDs, option IDs against the airtable-operations skill.
3. Check for the common gotchas: typecast missing, singleSelect option not seeded, batch size too large for heavy records.
4. Look at the Airtable formula field if one is involved — formulas fail silently and return empty.

### For "Luna Chat is doing the wrong thing"

1. Get the exact user prompt and Luna's exact response from Andy.
2. View the relevant system prompt section.
3. Check whether stripInternalMarkers fired (any [LANG:] / [BOOKING_LOOKUP:] / [FQ] / [OPT] leaking?).
4. Check the SSE timing logs (ackSent / clientProfileDone / brainSearchDone / destCtxDone / firstToken / streamEnd).
5. Check whether the right system prompt path was taken (search vs chat vs booking lookup).

### For "the email didn't arrive / looks wrong"

1. Check Brevo/Resend logs first — was it sent, did it bounce, did it land in spam?
2. View the rendered HTML — is the colour-aware section using correct hex values?
3. Run through the luna-email-composer pre-flight: section JSON valid, hex validated, no hallucinated facts, brand voice intact.
4. Test the unsubscribe link.

### For "the deploy broke"

1. Check Vercel build logs first — that's the cheapest evidence.
2. Check the last commit diff on GitHub.
3. If the build succeeded but runtime is broken, switch to client-side or API debugging above.

### For "it works locally but not in production" (rare for Andy since he doesn't run locally, but for reference)

1. Env var diff.
2. Build-time vs runtime distinction.
3. Edge function vs Node function differences.

---

## How to Talk to Andy While Debugging

Andy is non-technical, has memory loss, and communicates briefly. Adapt accordingly:

- **State your current gate** at the top of each major message. "Gate 1 — understanding the problem" / "Gate 2 — gathering evidence" / "Gate 3 — applying the fix". This makes the process visible and stops drift.
- **Ask for evidence one item at a time.** Not "can you check the console, the network tab, the Vercel logs, and the Airtable record?" — just the most useful one first.
- **Make asks specific and clickable.** "Open https://[url] in Chrome, press F12, click Console, screenshot anything red" beats "check DevTools".
- **Never ask Andy to run terminal commands.** He doesn't have terminal access. Use the bash_tool, web_fetch, Airtable MCP, and Vercel logs yourself.
- **Restate the symptom often.** After each round of evidence, restate what we're actually trying to fix. Drift is silent unless you name it.
- **Show your reasoning when you commit to a cause.** "I think the cause is X because [evidence]. I'm ruling out Y because [observation]." Andy can then catch wrong reasoning before code is written.
- **Be direct when you don't know.** "I don't have enough evidence yet to identify the cause" is a good message. It is far better than "let me try this".

---

## Worked Example — How a session should look

**Andy:** "The My Booking widget is blank after login. It was fine yesterday."

**Claude:**
> **Gate 1 — Understanding the problem.**
>
> Restating to make sure I've got it:
> - Symptom: My Booking widget renders blank after a user logs in.
> - Expected: After login, the widget should show the user's bookings (Travelify API App 250).
> - Regression: It worked yesterday — so something has changed in the last 24 hours.
>
> Before I form theories, two quick asks:
> 1. Which client site is this on (so I can check the right embed)?
> 2. Can you open DevTools (F12 → Console tab) on that page, reproduce the login, and paste anything that appears in red?
>
> While you grab those, I'll search past chats for what we deployed yesterday.

**Andy:** [pastes console error: `Failed to fetch: 401 unauthorized`]

**Claude:**
> **Gate 2 — Locating the cause.**
>
> Evidence: the widget is calling its bookings endpoint and getting 401. So the widget IS rendering and IS reaching the API — it's the auth that's failing post-login.
>
> Hypothesis space:
> - H1 (high probability, cheap to check): the auth cookie isn't being sent. We added a global fetch interceptor in v1.2 for credentials:include — let me verify it's still in place after yesterday's deploy.
> - H2 (medium): the Travelify token in the encrypted credential store is expired/revoked.
> - H3 (lower): a CORS preflight is stripping the cookie.
>
> Let me check H1 first — viewing the shell source now.

[Claude views the file, finds that yesterday's deploy reverted the interceptor.]

> Cause found: yesterday's deploy reverted the global fetch interceptor that adds `credentials: 'include'`. Evidence: line 47 of shell.js shows the plain fetch wrapper without the credentials line. Ruling out H2 because the 401 comes back before any token check — it's the cookie that's missing. Ruling out H3 because the response includes the standard CORS headers from v1.2.

**Claude:**
> **Gate 3 — Fix.**
>
> Change: restore the credentials:include interceptor at shell.js line 47. Success signal: the bookings endpoint will return 200 with the user's bookings, and the widget will render booking cards.
>
> One change, no other edits bundled in. Showing you the diff now: [diff]
>
> After you deploy, can you log in again and tell me whether the booking cards appear, and whether the console 401 has gone?

---

## When to bypass the gates

There is exactly one bypass: **trivial typo fixes Andy has already identified and pointed you at**. "Change 'Beoost' to 'Boost' on line 12" doesn't need gates. Anything more complex than a single-character typo goes through the full protocol.

If in doubt, run the protocol. The cost of running it on an easy bug is 30 seconds. The cost of skipping it on a hard bug is 3 hours.

---

## Self-check before sending any debugging message

Before sending a message during a debugging session, ask yourself:

1. Which gate am I in?
2. Have I stated that gate to Andy?
3. If I'm writing code, did I pass Gate 2 with real evidence?
4. If I've already had one failed fix, am I treating my last hypothesis as suspect?
5. If I've had two failed fixes, have I stopped and reset?
6. Am I about to use the phrase "let me try" or "let me just"? (If yes — stop.)
7. Have I restated the original symptom in the last few messages, or have I drifted?

If you can't answer 1 and 2, restart your message.

---

## One-line summary to remember

**Diagnose with evidence. Fix with prediction. Stop after two failures. Never patch a patch.**
