# Airtable IDs — TG B2B CRM (Luna Desk)

Canonical record of the Airtable base, table and field IDs created programmatically
in Stage 1. **These IDs are stable across renames** — code addresses tables by ID and
fields by name. Stage 4 (Luna Marketing link) glues against these IDs, so keep this
file current if the schema changes.

- **Base:** `appPivSWEnuM2lAhi` — "TG B2B CRM"
- **Workspace:** `wspDD3VwQcLsv2H33` — "Travelgenix"
- **Related base (Luna Marketing, for Stage 4):** `appSoIlSe0sNaJ4BZ`
- Created: 11 June 2026 · Currency `£` · Dates D/M/YYYY · Times 24h Europe/London

> Field IDs are listed for every column including the auto-generated reverse link
> fields. Linked-record fields are marked `→ <Table>`.

---

## Companies — `tbluE7SgFqgxZvKTe`
Primary field: `Name` (`fldu3bBbfUJaZ7JLy`)

| Field | ID | Type |
|---|---|---|
| Name | `fldu3bBbfUJaZ7JLy` | singleLineText (primary) |
| Website | `fldGfgLes4oAQp3aV` | url |
| Type | `fldTLAVE3mh7cmUax` | singleSelect |
| Country | `fldKWSNIYc6oYd13H` | singleLineText |
| Region | `fldhLhOJRZSheMrtA` | singleSelect (UK / Non-UK) |
| LinkedIn URL | `fldHWcq0llS2olJe3` | url |
| Socials | `fldcJn565kNhDvbfI` | multilineText |
| Lifecycle Stage | `fldrgbiqLTV1tNIzy` | singleSelect |
| Plan / Tier | `fldLUnx1eClpKYkwN` | singleLineText |
| MRR | `fldHCS0LZFMgdyBDo` | currency |
| Go-Live Date | `fldDueUTFg26MzIor` | date |
| Renewal Date | `fldw0uPX5UOypWJNk` | date |
| Account Health | `fldSkJvlB5G71f91L` | singleSelect (Green/Amber/Red) |
| Care Cadence | `fldlJF4tA4soWiqiN` | singleSelect (Monthly/Quarterly/None) |
| Last Meaningful Contact | `fldU1Avzn1C53jsFg` | date (app-maintained from Activities) |
| Products Used | `fldNioUZciSFEArdV` | multilineText |
| Company Description | `fld78nukriSlSJNv3` | multilineText (enrichment) |
| Size Band | `fldmPJ0mDQ3GUemMs` | singleSelect |
| Enriched At | `fldJH3gwcffDHQ3T3` | dateTime |
| Enrichment Source | `fldOqBKEBYrL0Prfd` | singleLineText |
| Watchlist | `fldMGbns6be4x2Fq6` | checkbox |
| AI Brief | `fldfyEkBAnrbMfvAI` | multilineText (app-written) |
| Next Best Action | `fldnRjrsf0snF9QiV` | multilineText (app-written) |
| Contacts | `fldRa8Crh3lVSVFUp` | multipleRecordLinks → Contacts |
| Deals | `fldVHuLnsEa5PAUxQ` | multipleRecordLinks → Deals |
| Activities | `fld74wQaE6ws8eqoN` | multipleRecordLinks → Activities |
| Tasks | `fld0Dd23ib50pNPlb` | multipleRecordLinks → Tasks |
| Care Touches | `fldbuDxwJdwTVoWGU` | multipleRecordLinks → Care Touches |
| Signals | `fldwcrAwbj3hX9Smj` | multipleRecordLinks → Signals |
| Campaign Engagement | `fld1S0cshpqTv6LRh` | multipleRecordLinks → Campaign Engagement |

## Contacts — `tblJvPZZV1WGDNvct`
Primary field: `Name` (`fldssUBnH1SPKbdJB`)

| Field | ID | Type |
|---|---|---|
| Name | `fldssUBnH1SPKbdJB` | singleLineText (primary) |
| Role | `fldKP7sOVsh75DOs0` | singleLineText |
| Email | `fld5NXPxrlpWYrE7f` | email |
| Phone | `fldSLSlmhrc7JtTtq` | phoneNumber |
| LinkedIn URL | `fld7clCmgbTrcRnJX` | url |
| Marketing Opt-In | `fldLOGVYXq7E7FnuK` | singleSelect |
| Notes | `fldq4ckdCg0JrnB1D` | multilineText |
| Headline | `fldNQHic5GVtRPCuU` | singleLineText (enrichment) |
| Location | `fldqW3YZCYC1GlMfz` | singleLineText (enrichment) |
| Enriched At | `fldhM8tBdmDRfkzWi` | dateTime |
| Source | `fldzuMZYuO9aToR8i` | singleLineText |
| Company | `fldU2bSRpTd1mDi1R` | multipleRecordLinks → Companies |
| Activities | `fldiV0txuZ43a0xJr` | multipleRecordLinks → Activities |
| Signals | `fld8tmNWixW2AjLqH` | multipleRecordLinks → Signals |
| Campaign Engagement | `fldT9XBqWiyDEGlHe` | multipleRecordLinks → Campaign Engagement |

## Deals — `tbld0Kf0g3LBjIQo3`
Primary field: `Deal Name` (`fldLcG0r6YpQ2cs5m`)

| Field | ID | Type |
|---|---|---|
| Deal Name | `fldLcG0r6YpQ2cs5m` | singleLineText (primary) |
| Stage | `fld9hIBfoZ1lwbx4x` | singleSelect (8 stages, locked) |
| MRR | `fldqq2Mu4LJIBVfc4` | currency |
| Setup Fee | `fldXlHCgtDqPCbWMl` | currency |
| Source | `fldIPIYa2cezy03vm` | singleSelect |
| Expected Close Date | `fld7Myr93sz3pr5WN` | date |
| Lost Reason | `fld6n7KCHF1YI7Fqj` | multilineText |
| Owner | `fldvlrwpLf5wshYWc` | singleLineText |
| Next Step | `flde4EcfU7KqDjOgl` | singleLineText |
| Next Step Date | `fld2fduh8kuHK1jm6` | date |
| Company | `fldMQcELPxjbU0FxT` | multipleRecordLinks → Companies |
| Activities | `fldU6p6k0AjcYjgjU` | multipleRecordLinks → Activities |
| Tasks | `fldMrQSq4p8OVgktv` | multipleRecordLinks → Tasks |

## Activities — `tblwNh1AS5t92SHo2`
Primary field: `Summary` (`fldHHiug4jKfwQCCb`)

| Field | ID | Type |
|---|---|---|
| Summary | `fldHHiug4jKfwQCCb` | singleLineText (primary) |
| Type | `fldZYK9OylHPKD3bq` | singleSelect |
| Date | `fld4VOQkQCtLUKgxy` | dateTime |
| Raw Content | `fldRNLlvX31wv1ms8` | multilineText |
| Source | `flddl96NpGTk2KoG2` | singleSelect |
| Contact | `fldvcVHAEbYs6spaZ` | multipleRecordLinks → Contacts |
| Deal | `fld0NZ30VfVhDdGBT` | multipleRecordLinks → Deals |
| Company | `flddJpye2M7wmiiIw` | multipleRecordLinks → Companies |

## Tasks — `tblUADtWSNYwEoxDo`
Primary field: `Title` (`fldoNYQroGJsScjiI`)

| Field | ID | Type |
|---|---|---|
| Title | `fldoNYQroGJsScjiI` | singleLineText (primary) |
| Due Date | `fldxOGtuGCa1eWzWW` | date |
| Status | `fldzJ0JFEQ1d7Sj3h` | singleSelect |
| Owner | `fldrqdFazvVNpTki5` | singleLineText |
| Created By | `fldxN6a8AOj5xxTd7` | singleSelect (Manual/AI-Suggested) |
| Company | `fldKUUGRYc1QtVsus` | multipleRecordLinks → Companies |
| Deal | `fldFFsSkrgxErK4iv` | multipleRecordLinks → Deals |

## Care Touches — `tblZ8hpymrHX08XSZ`
Primary field: `Name` (`fldVhVxFxDbyKidxh`)

| Field | ID | Type |
|---|---|---|
| Name | `fldVhVxFxDbyKidxh` | singleLineText (primary) |
| Touch Type | `fldFFlCla2RhzGlif` | singleSelect |
| Due Date | `fldNiGs19K9J8cHYt` | date |
| Status | `fldOh3wtGPuF1vDSf` | singleSelect (Scheduled/Completed/Skipped) |
| Outcome Notes | `fldhEEY9Hc1LU5F67` | multilineText |
| Company | `fldnAMfuZSAaS7qE0` | multipleRecordLinks → Companies |

## Signals — `tbleJMlld1U0IjMG4`
Primary field: `Headline` (`flde2BvE9MFE8StAU`)

| Field | ID | Type |
|---|---|---|
| Headline | `flde2BvE9MFE8StAU` | singleLineText (primary) |
| Signal Type | `fldwJcGmqI2ylmrq2` | singleSelect |
| URL | `fld1qWexF71pWS2dy` | url |
| Date Found | `fldmXeYXV6P0qllMO` | dateTime |
| Relevance Score | `fldLSn2KsEubOsxLl` | number |
| Status | `fld6fOTHtQpbqYXdr` | singleSelect (New/Seen/Actioned/Dismissed) |
| Company | `fldMsiqei9z7JEvbJ` | multipleRecordLinks → Companies |
| Contact | `fldickMbXySVCffLQ` | multipleRecordLinks → Contacts |

## Campaign Engagement — `tbljhb1tn3302SPgP`
Primary field: `Name` (`fldrhrluyvsVjejen`)

| Field | ID | Type |
|---|---|---|
| Name | `fldrhrluyvsVjejen` | singleLineText (primary) |
| Campaign | `fldeogFoXCAj64SZI` | singleLineText |
| Sent | `fldbJsjLsgLdOliai` | checkbox |
| Opened | `fldRvIUrpotRdwYNA` | checkbox |
| Clicked | `fldmCJg4VqRWUBvMI` | checkbox |
| Date | `fldWwfMWtfZEbEKYX` | date |
| Contact | `fldFuL5AhKRhzzC06` | multipleRecordLinks → Contacts |
| Company | `fld4oARpxWapRlbfk` | multipleRecordLinks → Companies |
