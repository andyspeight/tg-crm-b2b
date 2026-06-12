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
