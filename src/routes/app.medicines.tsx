import { createFileRoute } from "@tanstack/react-router";
import { Pill } from "lucide-react";
import { ModulePlaceholder } from "@/components/ModulePlaceholder";

export const Route = createFileRoute("/app/medicines")({
  component: () => (
    <ModulePlaceholder
      title="Medicines"
      description="Manage every SKU, batch, expiry, and rack location."
      icon={<Pill className="h-5 w-5" />}
      features={[
        "Full medicine catalog with batches, barcodes, and rack numbers",
        "Search, sort, and multi-field filters",
        "Bulk import / export (CSV & Excel)",
        "Low-stock and expiry badges",
        "Printable medicine list",
      ]}
    />
  ),
});
