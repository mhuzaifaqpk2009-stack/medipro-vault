import { createFileRoute } from "@tanstack/react-router";
import { Tags } from "lucide-react";
import { ModulePlaceholder } from "@/components/ModulePlaceholder";

export const Route = createFileRoute("/app/categories")({
  component: () => (
    <ModulePlaceholder
      title="Categories"
      description="Organise medicines into therapeutic categories."
      icon={<Tags className="h-5 w-5" />}
      features={[
        "Create, rename, and delete categories",
        "Merge with reassignment",
        "Filter medicines by category",
      ]}
    />
  ),
});
