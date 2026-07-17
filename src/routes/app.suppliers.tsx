import { createFileRoute } from "@tanstack/react-router";
import { Building2 } from "lucide-react";
import { ModulePlaceholder } from "@/components/ModulePlaceholder";

export const Route = createFileRoute("/app/suppliers")({
  component: () => (
    <ModulePlaceholder
      title="Suppliers"
      description="Vendor directory with balances and purchase history."
      icon={<Building2 className="h-5 w-5" />}
      features={[
        "Supplier profile: contact, company, address",
        "Running balance and payments",
        "Full purchase history per supplier",
        "Quick filters and search",
      ]}
    />
  ),
});
