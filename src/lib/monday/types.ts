/** Monday.com board shapes. Client- and server-safe (no secrets). */

export interface MondayColumn {
  id: string;
  title: string;
  type: string;
}

export interface MondayBoard {
  id: string;
  name: string;
  itemsCount: number | null;
  columns: MondayColumn[];
}

export interface MondayItem {
  id: string;
  name: string;
  /** Column text values, keyed by lower-cased column title. */
  values: Record<string, string>;
}

// --- read-only board preview (inspection before mapping) --------------------

export interface BoardPreviewCell {
  title: string;
  value: string;
}
export interface BoardPreviewRow {
  id: string;
  name: string;
  cells: BoardPreviewCell[];
}
export interface BoardValueTally {
  value: string;
  count: number;
}
export interface BoardValueBreakdown {
  title: string;
  type: string;
  values: BoardValueTally[];
}
export interface BoardPreview {
  itemCount: number;
  capped: boolean;
  sample: BoardPreviewRow[];
  breakdown: BoardValueBreakdown[];
}
