import { createFileRoute } from "@tanstack/react-router";
import { InventoryView } from "@/components/InventoryView";

export const Route = createFileRoute("/_authenticated/drinks")({
  head: () => ({ meta: [{ title: "Drinks — K POINT BAR" }] }),
  component: () => <InventoryView category="drinks" />,
});
