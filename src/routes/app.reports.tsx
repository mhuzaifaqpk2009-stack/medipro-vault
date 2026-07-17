import { createFileRoute } from "@tanstack/react-router";
import { BarChart3 } from "lucide-react";
import { ModulePlaceholder } from "@/components/ModulePlaceholder";

export const Route = createFileRoute("/app/reports")({
  component: () => (
    <ModulePlaceholder
      title="Reports"
      description="Financial and operational reports with PDF & Excel export."
      icon={<BarChart3 className="h-5 w-5" />}
      features={[
        "Daily, weekly, monthly, and yearly sales",
        "Profit, stock, expiry, and purchase reports",
        "Per-supplier and per-customer statements",
        "A4 print preview + PDF / Excel export",
      ]}
    />
  ),
});
