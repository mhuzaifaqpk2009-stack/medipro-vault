import { useProjectStore } from "@/store/project-store";
import { toast } from "sonner";

export type GuardChoice = "save" | "discard" | "cancel";

/**
 * A very small Save / Don't Save / Cancel prompt that runs before destructive
 * navigation (close project, open another, create new). Uses window.confirm
 * chains; a fuller Word-like modal replaces this in Phase 3.
 */
export async function confirmUnsaved(): Promise<GuardChoice> {
  const { dirty } = useProjectStore.getState();
  if (!dirty) return "discard";

  const wantSave = window.confirm(
    "You have unsaved changes.\n\nOK to save now, Cancel to review options.",
  );
  if (wantSave) {
    const ok = await useProjectStore.getState().save();
    if (!ok) {
      toast.error("Save cancelled");
      return "cancel";
    }
    return "save";
  }
  const discard = window.confirm("Discard unsaved changes?");
  return discard ? "discard" : "cancel";
}
