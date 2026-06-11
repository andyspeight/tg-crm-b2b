import { listCareBoard } from "@/lib/crm/data";
import { CareBoardView } from "@/components/care-board-view";

export const dynamic = "force-dynamic";

export default async function CarePage() {
  return <CareBoardView initial={await listCareBoard()} />;
}
