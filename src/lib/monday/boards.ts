import "server-only";
import { mondayQuery } from "./client";
import type { MondayBoard, MondayColumn, MondayItem } from "./types";

type RawBoard = {
  id: string;
  name: string | null;
  items_count: number | null;
  columns: { id: string; title: string; type: string }[] | null;
};

/** List the account's boards with their columns, so a board + columns can be mapped. */
export async function listBoards(): Promise<MondayBoard[]> {
  const data = await mondayQuery<{ boards: RawBoard[] | null }>(`
    query {
      boards (limit: 200, state: active) {
        id
        name
        items_count
        columns { id title type }
      }
    }
  `);

  return (data.boards ?? [])
    .filter((b) => b?.id && !/^Subitems of /i.test(b.name ?? ""))
    .map((b) => ({
      id: String(b.id),
      name: b.name?.trim() || "(untitled board)",
      itemsCount: typeof b.items_count === "number" ? b.items_count : null,
      columns: (b.columns ?? []).map((c) => ({ id: c.id, title: c.title, type: c.type })),
    }));
}

type RawItem = {
  id: string;
  name: string;
  column_values: { id: string; text: string | null; value: string | null }[];
};
const ITEM_QUERY_FIELDS = "items { id name column_values { id text value } }";

/** Pull a URL out of a Monday link/url column's JSON value when its text is blank. */
function parseLinkValue(raw: string | null): string {
  if (!raw) return "";
  try {
    const o = JSON.parse(raw);
    if (typeof o?.url === "string" && o.url) return o.url;
    if (o?.url && typeof o.url.url === "string") return o.url.url;
  } catch {
    /* not JSON */
  }
  return "";
}

/**
 * Read a board's items (with their column text values) via cursor pagination.
 * Capped at `max` to bound time and API cost on very large boards.
 */
export async function getBoardItems(
  boardId: string,
  max = 1500,
): Promise<{ columns: MondayColumn[]; items: MondayItem[]; capped: boolean }> {
  const first = await mondayQuery<{
    boards: { columns: MondayColumn[] | null; items_page: { cursor: string | null; items: RawItem[] } }[] | null;
  }>(
    `query ($ids:[ID!], $limit:Int!) {
       boards(ids:$ids) {
         columns { id title type }
         items_page(limit:$limit) { cursor ${ITEM_QUERY_FIELDS} }
       }
     }`,
    { ids: [boardId], limit: 100 },
  );

  const board = first.boards?.[0];
  if (!board) return { columns: [], items: [], capped: false };

  const columns = (board.columns ?? []).map((c) => ({ id: c.id, title: c.title, type: c.type }));
  const titleById: Record<string, string> = {};
  const typeById: Record<string, string> = {};
  for (const c of columns) {
    titleById[c.id] = (c.title ?? "").toLowerCase().trim();
    typeById[c.id] = c.type;
  }

  const items: MondayItem[] = [];
  const push = (raws: RawItem[]) => {
    for (const it of raws) {
      const values: Record<string, string> = {};
      for (const cv of it.column_values ?? []) {
        let v = cv.text && cv.text.trim() ? cv.text.trim() : "";
        if (!v) {
          const t = typeById[cv.id];
          if (t === "link" || t === "url") v = parseLinkValue(cv.value);
        }
        if (v) values[titleById[cv.id] || cv.id] = v;
      }
      items.push({ id: it.id, name: it.name, values });
    }
  };

  push(board.items_page.items ?? []);
  let cursor = board.items_page.cursor;
  let capped = false;
  while (cursor) {
    if (items.length >= max) {
      capped = true;
      break;
    }
    const next = await mondayQuery<{ next_items_page: { cursor: string | null; items: RawItem[] } }>(
      `query ($cursor:String!, $limit:Int!) { next_items_page(limit:$limit, cursor:$cursor) { cursor ${ITEM_QUERY_FIELDS} } }`,
      { cursor, limit: 100 },
    );
    push(next.next_items_page.items ?? []);
    cursor = next.next_items_page.cursor;
  }

  return { columns, items, capped };
}
