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
  TASK_STATUSES,
  TASK_CREATED_BY,
  TOUCH_TYPES,
  CARE_STATUSES,
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
  phone?: string;
  linkedin?: string;
  marketingOptIn?: MarketingOptIn;
  notes?: string;
  headline?: string;
  location?: string;
  enrichedAt?: string;
  source?: string;
  companyId?: string;
  /** Resolved from the linked company where available (convenience for list views). */
  companyName?: string;
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

export type CompanyInput = Partial<
  Omit<Company, "id" | "contactIds" | "dealIds" | "activityIds" | "taskIds" | "createdTime">
>;
export type ContactInput = Partial<Omit<Contact, "id" | "companyName" | "createdTime">>;
export type DealInput = Partial<Omit<Deal, "id" | "companyName" | "createdTime">>;
export type ActivityInput = Partial<Omit<Activity, "id" | "createdTime">>;
export type TaskInput = Partial<Omit<Task, "id" | "companyName" | "createdTime">>;
