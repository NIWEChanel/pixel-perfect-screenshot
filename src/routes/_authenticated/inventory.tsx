import { createFileRoute } from "@tanstack/react-router";
import { InventoryView } from "@/components/InventoryView";

export const Route = createFileRoute("/_authenticated/inventory")({
  head: () => ({ meta: [{ title: "Inventory — K POINT BAR" }] }),
  component: () => <InventoryView />,
});
