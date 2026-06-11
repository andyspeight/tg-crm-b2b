---
name: project-handover
description: Mandatory state-handover protocol for every multi-session Travelgenix project. Use IMMEDIATELY at TWO moments — first message of any chat that mentions or implies an existing project (fetch state from Airtable before responding), and last messages of any chat that worked on a project (write state back before the chat ends). Triggers on resume signals — "let's continue", "where were we", "back on", "more work on", "next session", or any first-message mention of a known project like "map widget", "inspirator", "email composer", "luna chat", "luna work", "top 10", "luna brain". Also triggers on session-end signals — "good for tonight", "pick this up tomorrow", "that's enough today", "stopping here", "back tomorrow", "wrap up", "save progress", "before I go", "log this", "update the project". Counters Claude's documented failure mode of losing context between chats and re-litigating decisions Andy already made. Do not skip. Do not assume memory has the state. Always fetch and always update.
---

# Project Handover Protocol

> The single source of truth for how Claude carries state across multiple chats on the same project. Without it, every new chat is a cold start — Andy re-explains, decisions get re-litigated, and progress drifts sideways. This skill closes that gap. The state lives in the Projects Airtable table. Claude reads it at the start of every project session and writes it back at the end.

---

## The Base

- **Base**: Travelgenix Projects
- **Base ID**: `appj9tksreHOwkhYg`
- **Table**: Projects
- **Table ID**: `tblpyhPNhiQg3XkkT`
- **Direct URL**: https://airtable.com/appj9tksreHOwkhYg/tblpyhPNhiQg3XkkT

---

## The Field Map

Use field IDs, never field names. Names can be renamed; IDs are stable.

| Field | Field ID | Type | Purpose |
|---|---|---|---|
| Project Name | `fldUh78OKovaKWDwD` | singleLineText (primary) | Short canonical name |
| Status | `fldRaDYQiG7PsOuAB` | singleSelect | Active / Paused / Blocked / Done / Archived |
| Type | `fldRq5Kb2aQIxWj0c` | singleSelect | Widget / Luna feature / Skill / Infra / Content / Other |
| Current Focus | `fldftgAqLY3PQ5dvO` | multilineText | One-sentence: what we're doing right now |
| Next Steps | `fldQQ7ypRCAU1f6Xc` | multilineText | The very next action when we resume |
| Last Session Summary | `fldfaAHrO0ImzsZnn` | multilineText | What changed in the most recent session |
| Decisions Locked | `fldctkmvEBIOEMHGG` | multilineText | Append-only log with dates — the bit that stops re-litigating |
| Open Questions | `fldZVdEX6YYXVamh9` | multilineText | Things waiting on Andy to decide |
| Blockers | `fld8pOsSOXGALfUiX` | multilineText | External dependencies |
| Files Touched | `fldiUW0Zczitsby3o` | multilineText | Repo + path list |
| Repo | `fldx7mAle9EL0sEa8` | url | Main repo or live URL |
| Related Skills | `fldVgLA4Dxzd4eZks` | multilineText | Comma list of skills to consult |
| Started | `fldQjEjlRpBeWy2lb` | dateTime | First session date |
| Last Updated | `fldwjVK7VAT4hmVxI` | lastModifiedTime | Auto-updated on any field change |
| Session Count | `fldNSvN2hbpnl5gkS` | number | Bump by 1 on each end-of-session handover |

**Status options**: `Active`, `Paused`, `Blocked`, `Done`, `Archived`
**Type options**: `Widget`, `Luna feature`, `Skill`, `Infra`, `Content`, `Other`

For new options, pass `typecast: true` on the create/update call and Airtable will accept the new option.

---

## The Two Triggers

### Trigger 1 — RESUME (start of chat)

When Andy's first message in a chat mentions or implies an existing project, fetch the project row BEFORE responding.

**Recognising the trigger.** The signal is one of:

- **Direct mention**: "let's continue with the map widget", "back on inspirator", "more work on the email composer"
- **Indirect mention**: any first-message reference to a known project name, e.g. "the map", "inspirator", "luna chat performance", "luna work"
- **Explicit resume**: "where were we", "what were we doing yesterday on X", "pick up X from yesterday"
- **Implicit resume from context**: if the morning briefing or another tool surfaces an Active project and Andy then dives in, treat that as a resume

If unsure whether it's a resume or a fresh project, search the Projects table first. A 200ms lookup is far cheaper than a wrong assumption.

**The fetch sequence.**

1. Use `Airtable:search_records` against table `tblpyhPNhiQg3XkkT` with the project name as the query. Use `ALL_SEARCHABLE_FIELDS` so a partial or fuzzy match still works.
2. If multiple results come back, ask Andy which one — never guess.
3. If no result, ask Andy whether this is a new project. If yes, create the record via the NEW PROJECT sequence below.
4. Once you have the record, read EVERY field. Do not skim.

**The acknowledgement.** Before doing any work, write a short, structured restatement back to Andy so he can confirm you've got the right context. Format:

> **Resuming: [Project Name]** (Status, Session #N)
>
> **Current focus.** [Current Focus field, one line]
> **Last session.** [Last Session Summary, condensed to one or two lines]
> **Decisions locked.** [Bullet the most recent 2–3 if there are any]
> **Open questions.** [List them]
> **Next step.** [Next Steps field]
>
> Is this still the state, or has anything moved since the last save?

Andy can then confirm, correct, or override. This single message catches almost all stale-state issues before they cost time.

**What NOT to do on resume.**

- Don't start coding before the acknowledgement.
- Don't ask "where were we?" — you should already know. The point of fetching is that you arrive informed.
- Don't ignore the Decisions Locked field. If Andy made a decision in session 1, it's in there. Honour it.
- Don't re-suggest options that were already ruled out in Decisions Locked.
- Don't say "based on memory" or "according to my notes" — speak as if you simply know. Andy's experience should be of resumed continuity, not a database lookup.

### Trigger 2 — END OF SESSION (update before chat ends)

When Andy signals the session is wrapping, update the project row BEFORE replying.

**Recognising the trigger.**

- **Direct end**: "good for tonight", "let's stop there", "that's enough for today", "wrap up", "back tomorrow"
- **Save signals**: "log this", "save progress", "update the project", "before I go"
- **Implicit end**: a message that closes a topic and doesn't ask for anything next ("ok thanks for that"); if you can't tell whether more work is coming, ASK before updating

**The update sequence.**

1. Identify the project record ID. If you fetched on resume, you already have it. If not, search now.
2. Compose the update fields. The update should be ADDITIVE for Decisions Locked and Files Touched, REPLACEMENT for everything else.
3. Call `Airtable:update_records_for_table` with the record ID and the updated fields. Use `typecast: true`.
4. Bump Session Count by 1.
5. Tell Andy what you updated, in one short line. He shouldn't have to guess.

**What to put in each field at end of session.**

- **Current Focus**: one line, present tense. Where the project IS right now. Example: *"Map widget v0.2: clustering working, mobile interaction model still open."*
- **Next Steps**: the very next action when resuming. Be specific enough that day-3-Claude can start without guessing. Example: *"Decide whether to use Leaflet markercluster or a custom hex-bin approach. Andy to make the call."*
- **Last Session Summary**: 2–4 lines on what happened THIS session. What got built, what got decided, what got tested. Date-stamp it.
- **Decisions Locked**: ONLY if a real decision was made. APPEND, don't replace. Format: `"21 May 2026: Locked on Leaflet (not Mapbox) for licence cost reasons."` Each on its own line. If nothing decided, leave alone.
- **Open Questions**: replace fully. The current list of things waiting on Andy.
- **Blockers**: replace fully. External dependencies. Empty string if none.
- **Files Touched**: APPEND new files. Format: `"luna-marketing/api/email-compose-ai.js (created)"`, `"tg-widgets/src/widgets/map.js (edited line 47)"`. Keep it tight.
- **Status**: update if it changed (e.g. Active → Blocked, Active → Paused).
- **Session Count**: increment by 1.

**The confirmation line.** After updating, tell Andy in one short message:

> Logged. Session #N saved. Next step on resume: [Next Steps field, one line]. Sleep well / catch you tomorrow / etc.

Match Andy's tone. Don't lecture, don't recap everything you wrote — he wrote half of it.

**What NOT to do at end of session.**

- Don't update before Andy has signalled an end. Mid-session updates lose information. Wait.
- Don't overwrite Decisions Locked. Append only.
- Don't write vague notes like "made progress on the widget". That's worthless on resume. Be specific.
- Don't ask Andy what to write. You were in the session — you know what changed. Compose the update, then show him.

---

## New Project Creation

When Andy starts something genuinely new (not a resume), create the row at the START of the session, not the end. This means the first updates land in a real row, not a draft that might get lost.

**The sequence.**

1. Briefly confirm with Andy: *"New project — let me log it. Naming it [proposed name], type [Widget / Luna feature / Skill / Infra / Content / Other]?"*
2. On confirmation, call `Airtable:create_records_for_table` with:
   - **Project Name**: short, distinctive, matchable. *"Map Widget"*, not *"The new map widget for client X"*.
   - **Status**: `Active`
   - **Type**: one of the six options
   - **Started**: today's date in ISO `2026-05-21T00:00:00.000Z` format
   - **Session Count**: `0` (will bump to 1 at first end-of-session)
   - **Current Focus**: one line, present tense
   - **Next Steps**: the immediate next action
   - **Related Skills**: comma list of skills relevant to this project
   - **Repo**: URL if there is one
3. Use `typecast: true` so new option values are auto-added.

Then proceed with the work. End-of-session update will flesh out the row.

---

## How to Detect a Resume vs a Fresh Project

If you're not sure, search. The decision tree:

- **Andy says a name verbatim from the table** → resume
- **Andy says a name that fuzzy-matches** ("map" → Map Widget; "inspirator" → Inspirator) → resume
- **Andy says a name that doesn't match anything** → could be a fresh project OR a project not yet logged. Ask.
- **Andy says "let's continue" with no name** → search for `Status = Active OR Status = Paused`, list the candidates, ask which one
- **Andy says nothing identifying** → not a resume. Proceed normally. Watch for cues later.

**Default to fetching, not guessing.** A fetch is cheap. A wrong guess is a 3-hour day.

---

## Anti-patterns — recognise and refuse

These are the specific failures that cause cross-chat drift. If you catch yourself doing one of them, stop and restart from the right protocol step.

### Anti-pattern 1: Skipping the fetch because memory feels sufficient

Memory captures a recency-biased summary. It does NOT capture the live state of the project row. Even if memory says "Email Composer Session 1 complete" — fetch the row before responding. The row may have moved since memory updated, or memory may have garbled the detail.

### Anti-pattern 2: Asking "where were we?"

If you're triggering this skill, you've already fetched. Asking is the signature of having skipped the fetch. The acknowledgement message is informed; the questioning message is not.

### Anti-pattern 3: Re-litigating a locked decision

If Decisions Locked says "Leaflet, not Mapbox" and you start suggesting Mapbox again, you're ignoring the field that exists specifically to stop this. Read Decisions Locked carefully. Treat anything in it as settled.

### Anti-pattern 4: Updating mid-session

If you update at message 5 of a 50-message session, the update will be wrong by message 50, and you'll have to rewrite it. Wait for the end-of-session signal. ONLY exception: if Andy explicitly says "log that decision now" — then append to Decisions Locked immediately and leave the rest alone.

### Anti-pattern 5: Vague summaries

"Worked on the map widget" is useless on resume. "Built marker clustering with Leaflet markercluster, tested with 500 pins, mobile interaction still pinch-to-zoom only" is useful. Be specific.

### Anti-pattern 6: Letting Decisions Locked drift

Decisions Locked is append-only. Never overwrite. Never rewrite. Never tidy. The audit trail of decisions across sessions is the most valuable thing in the row.

### Anti-pattern 7: Forgetting to bump Session Count

Session Count is the heartbeat of the project. If it doesn't go up, Andy can't tell at a glance which projects are actively progressing. Always increment.

### Anti-pattern 8: Updating without telling Andy

He should know the row was updated. One short line — "Logged. Session #4 saved." — closes the loop. Silent updates feel like Claude is hiding something.

---

## Worked example — what a session looks like end-to-end

### Start of session

**Andy:** "Right, back on the map widget — let's pick up the clustering question."

**Claude:** [silently calls Airtable:search_records on tblpyhPNhiQg3XkkT with query "map widget", reads the row]

> **Resuming: Map Widget** (Active, Session #2)
>
> **Current focus.** Marker clustering decision — Leaflet markercluster vs custom hex-bin.
> **Last session.** Locked Leaflet over Mapbox (licence cost). Built the base map render with OpenStreetMap tiles. 500 test pins rendering, no clustering yet.
> **Decisions locked.** Leaflet not Mapbox (15 May). Container queries inside Shadow DOM (15 May).
> **Open questions.** Mobile interaction model — pinch-to-zoom only or two-finger pan? Clustering threshold pin count?
> **Next step.** Decide clustering approach and prototype the chosen one with the 500-pin test set.
>
> Is this still where we are?

**Andy:** "Yes — let's go with markercluster, simpler."

[Claude works the session, builds clustering, tests it.]

### End of session

**Andy:** "Good for tonight."

**Claude:** [silently calls Airtable:update_records_for_table with the Map Widget record ID, typecast:true]

Update payload (illustrative):
- Current Focus: *"Map widget v0.3: markercluster live with 500-pin test set. Mobile interaction model still open."*
- Next Steps: *"Decide mobile interaction (pinch-to-zoom vs two-finger pan). Prototype both, A/B on iPhone Safari."*
- Last Session Summary: *"21 May 2026: Locked markercluster over custom hex-bin. Built clustering with default radius 80px, tested with 500 pins, performance fine. Mobile not yet tested."*
- Decisions Locked: APPEND `"21 May 2026: Locked Leaflet markercluster over custom hex-bin — simpler, well-maintained library."`
- Files Touched: APPEND `"tg-widgets/src/widgets/map.js (edited — added markercluster init, lines 64–82)"`, `"tg-widgets/src/widgets/map.css (edited — cluster bubble styles)"`
- Session Count: 3

Then:

> Logged. Session #3 saved. Next step on resume: decide mobile interaction model. Catch you tomorrow.

---

## When to bypass

Two bypasses only:

1. **One-shot tasks unrelated to any project**. "Quick — what's the IATA code for Faro?" doesn't need handover protocol. Answer and move on.
2. **Andy explicitly says "no need to log this"**. Honour that. He owns the system.

Everything else passes through the protocol. The cost of running it on a short session is 30 seconds. The cost of skipping it on a meaningful session is repeated cold starts.

---

## Self-check before sending the first or last message of a project session

Before sending the first message in a project session, ask:

1. Did I fetch the project row?
2. Have I read every field, including Decisions Locked?
3. Have I produced the structured acknowledgement?
4. Am I about to suggest something that contradicts Decisions Locked?

Before sending the last message in a project session, ask:

1. Has Andy signalled session end?
2. Have I composed the update payload covering Current Focus, Next Steps, Last Session Summary, Decisions Locked (if any), Files Touched (if any)?
3. Have I bumped Session Count?
4. Have I told Andy in one line what I logged?

If any answer is no, do that first.

---

## One-line summary to remember

**Fetch on resume. Restate before working. Append decisions. Update on end. Bump the count.**
