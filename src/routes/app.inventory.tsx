import { createFileRoute } from "@tanstack/react-router";
import { Boxes } from "lucide-react";
import { ModulePlaceholder } from "@/components/ModulePlaceholder";

export const Route = createFileRoute("/app/inventory")({
  component: () => (
    <ModulePlaceholder
      title="Inventory"
      description="Live stock health, expiry alerts, and adjustments."
      icon={<Boxes className="h-5 w-5" />}
      features={[
        "Low-stock and out-of-stock views",
        "Near-expiry and expired dashboards",
        "Stock adjustment with reason log",
        "Stock transfer between racks",
      ]}
    />
  ),
});
