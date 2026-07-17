import { useProjectStore } from "@/store/project-store";
import { cn } from "@/lib/utils";

export function DirtyBadge({ className }: { className?: string }) {
  const dirty = useProjectStore((s) => s.dirty);
  const saving = useProjectStore((s) => s.isSaving);
  const lastSavedAt = useProjectStore((s) => s.lastSavedAt);

  let label = "Saved";
  let tone = "text-muted-foreground";
  if (saving) {
    label = "Saving…";
    tone = "text-info";
  } else if (dirty) {
    label = "• Unsaved";
    tone = "text-warning";
  } else if (lastSavedAt) {
    label = "Saved";
    tone = "text-success";
  }

  return <span className={cn("text-xs font-medium tabular-nums", tone, className)}>{label}</span>;
}
