import { createFileRoute } from "@tanstack/react-router";
import { ShoppingCart } from "lucide-react";
import { ModulePlaceholder } from "@/components/ModulePlaceholder";

export const Route = createFileRoute("/app/sales")({
  component: () => (
    <ModulePlaceholder
      title="Sales (POS)"
      description="Modern point-of-sale with barcode scanning and split payments."
      icon={<ShoppingCart className="h-5 w-5" />}
      features={[
        "Barcode scanner-ready quick add",
        "Live cart with discount and tax",
        "Cash, card, online, and mixed payments",
        "Automatic stock deduction on completion",
        "Print / re-print / return receipts",
      ]}
    />
  ),
});
