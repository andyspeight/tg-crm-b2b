/**
 * Airtable schema map for the "TG B2B CRM" base (Luna Desk).
 * Table/base IDs and select-option sets only — nothing secret, so this module is
 * safe to import from client components (the option lists drive form dropdowns).
 * The full ID reference lives in docs/airtable-ids.md.
 */

export const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || "appPivSWEnuM2lAhi";

export const TABLES = {
  companies: "tbluE7SgFqgxZvKTe",
  contacts: "tblJvPZZV1WGDNvct",
  deals: "tbld0Kf0g3LBjIQo3",
  activities: "tblwNh1AS5t92SHo2",
  tasks: "tblUADtWSNYwEoxDo",
  careTouches: "tblZ8hpymrHX08XSZ",
  signals: "tbleJMlld1U0IjMG4",
  campaignEngagement: "tbljhb1tn3302SPgP",
} as const;

// --- Select option sets (must match the Airtable single-select choices exactly) ---
export const COMPANY_TYPES = [
  "Travel Agent",
  "Tour Operator",
  "OTA",
  "Homeworker",
  "Consortium",
  "Niche Specialist",
  "Partner",
  "Other",
] as const;

export const REGIONS = ["UK", "Non-UK"] as const;

export const LIFECYCLE_STAGES = [
  "Prospect",
  "Engaged",
  "Opportunity",
  "Customer",
  "At Risk",
  "Lost / Churned",
] as const;

export const ACCOUNT_HEALTH = ["Green", "Amber", "Red"] as const;

export const CARE_CADENCES = ["Monthly", "Quarterly", "None"] as const;

export const SIZE_BANDS = ["1-10", "11-50", "51-200", "201-500", "501-1000", "1000+"] as const;

// Pipeline stages — LOCKED per brief §4 / §13.
export const DEAL_STAGES = [
  "New Lead",
  "Contacted",
  "Demo Booked",
  "Demo Done",
  "Proposal",
  "Negotiation",
  "Won",
  "Lost",
] as const;

export const DEAL_SOURCES = [
  "Referral",
  "PTS/TNG Partnership",
  "Inbound",
  "Outbound",
  "LinkedIn Import",
  "Event",
  "AI Visibility Tool",
  "Other",
] as const;

export const MARKETING_OPT_IN = ["Opted In", "Opted Out", "Unknown"] as const;

export const ACTIVITY_TYPES = [
  "Note",
  "Email",
  "Call",
  "Meeting",
  "Demo",
  "Care Touch",
  "Campaign",
  "Signal",
] as const;

export const ACTIVITY_SOURCES = [
  "Manual",
  "Gmail",
  "Calendly",
  "Luna Marketing",
  "Signal Monitor",
  "AI",
] as const;

// Activity types that count as a meaningful human touch (drive Last Meaningful Contact).
export const MEANINGFUL_ACTIVITY_TYPES = ["Note", "Email", "Call", "Meeting", "Demo", "Care Touch"] as const;

export const TASK_STATUSES = ["Open", "In Progress", "Done"] as const;
export const TASK_CREATED_BY = ["Manual", "AI-Suggested"] as const;

// --- Field-name maps (Airtable addresses fields by name; names are stable in our schema) ---
export const FIELDS = {
  companies: {
    name: "Name",
    website: "Website",
    type: "Type",
    country: "Country",
    region: "Region",
    linkedin: "LinkedIn URL",
    socials: "Socials",
    lifecycleStage: "Lifecycle Stage",
    planTier: "Plan / Tier",
    mrr: "MRR",
    goLiveDate: "Go-Live Date",
    renewalDate: "Renewal Date",
    accountHealth: "Account Health",
    careCadence: "Care Cadence",
    lastMeaningfulContact: "Last Meaningful Contact",
    productsUsed: "Products Used",
    description: "Company Description",
    sizeBand: "Size Band",
    enrichedAt: "Enriched At",
    enrichmentSource: "Enrichment Source",
    watchlist: "Watchlist",
    aiBrief: "AI Brief",
    nextBestAction: "Next Best Action",
    contacts: "Contacts",
    deals: "Deals",
    activities: "Activities",
    tasks: "Tasks",
  },
  contacts: {
    name: "Name",
    role: "Role",
    email: "Email",
    phone: "Phone",
    linkedin: "LinkedIn URL",
    marketingOptIn: "Marketing Opt-In",
    notes: "Notes",
    headline: "Headline",
    location: "Location",
    enrichedAt: "Enriched At",
    source: "Source",
    company: "Company",
  },
  deals: {
    name: "Deal Name",
    stage: "Stage",
    mrr: "MRR",
    setupFee: "Setup Fee",
    source: "Source",
    expectedCloseDate: "Expected Close Date",
    lostReason: "Lost Reason",
    owner: "Owner",
    nextStep: "Next Step",
    nextStepDate: "Next Step Date",
    company: "Company",
  },
  activities: {
    summary: "Summary",
    type: "Type",
    date: "Date",
    rawContent: "Raw Content",
    source: "Source",
    company: "Company",
    contact: "Contact",
    deal: "Deal",
  },
  tasks: {
    title: "Title",
    dueDate: "Due Date",
    status: "Status",
    owner: "Owner",
    createdBy: "Created By",
    company: "Company",
    deal: "Deal",
  },
} as const;
