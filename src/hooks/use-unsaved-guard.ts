import { useProjectStore } from "@/store/project-store";
import { toast } from "sonner";
import { bridge, inElectron } from "@/lib/electron-bridge";

export type GuardChoice = "save" | "discard" | "cancel";

/**
 * Reusable Word/Excel-style Save / Don't Save / Cancel prompt.
 * - In Electron: native message box via IPC.
 * - In browser: window.confirm chain.
 * Every close/open/new/exit path funnels through this function.
 */
export async function confirmUnsaved(opts?: {
  message?: string;
  detail?: string;
}): Promise<GuardChoice> {
  const { dirty } = useProjectStore.getState();
  if (!dirty) return "discard";

  let choice: GuardChoice;
  if (inElectron()) {
    choice = await bridge()!.dialog.showUnsavedDialog({
      message: opts?.message ?? "Do you want to save changes to this project?",
      detail: opts?.detail ?? "Your changes will be lost if you don't save them.",
    });
  } else {
    const wantSave = window.confirm(
      "You have unsaved changes.\n\nOK = Save, Cancel = review options",
    );
    if (wantSave) choice = "save";
    else choice = window.confirm("Discard unsaved changes?") ? "discard" : "cancel";
  }

  if (choice === "save") {
    const ok = await useProjectStore.getState().save();
    if (!ok) {
      toast.error("Save cancelled");
      return "cancel";
    }
  }
  return choice;
}
