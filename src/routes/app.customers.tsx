import { createFileRoute } from "@tanstack/react-router";
import { Users } from "lucide-react";
import { ModulePlaceholder } from "@/components/ModulePlaceholder";

export const Route = createFileRoute("/app/customers")({
  component: () => (
    <ModulePlaceholder
      title="Customers"
      description="Loyalty-aware customer directory."
      icon={<Users className="h-5 w-5" />}
      features={[
        "Contact card with balance and points",
        "Purchase history timeline",
        "Loyalty points accrual & redemption",
        "Fast search and filters",
      ]}
    />
  ),
});
