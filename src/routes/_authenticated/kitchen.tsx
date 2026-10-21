import { createFileRoute } from "@tanstack/react-router";
import { InventoryView } from "@/components/InventoryView";

export const Route = createFileRoute("/_authenticated/kitchen")({
  head: () => ({ meta: [{ title: "Kitchen — K POINT BAR" }] }),
  component: () => <InventoryView category="kitchen" />,
});
