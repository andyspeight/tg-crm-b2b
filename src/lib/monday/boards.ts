import "server-only";
import { mondayQuery } from "./client";
import type { MondayBoard } from "./types";

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
