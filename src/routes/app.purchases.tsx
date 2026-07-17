import { createFileRoute } from "@tanstack/react-router";
import { Truck } from "lucide-react";
import { ModulePlaceholder } from "@/components/ModulePlaceholder";

export const Route = createFileRoute("/app/purchases")({
  component: () => (
    <ModulePlaceholder
      title="Purchases"
      description="Record supplier invoices and auto-restock inventory."
      icon={<Truck className="h-5 w-5" />}
      features={[
        "Create purchase with line items",
        "Supplier picker, invoice #, and dates",
        "Tax and discount handling",
        "Automatic stock-in on save",
        "Printable purchase invoice",
      ]}
    />
  ),
});
