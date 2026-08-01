import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/PasswordInput";
import { clearInstall } from "@/lib/install";
import { useProjectStore } from "@/store/project-store";
import { useSession } from "@/store/session-store";

export const RESET_PASSWORD = "resetpassword";

/**
 * Shared "Reset setup" confirmation. Removes every local account on this
 * computer and returns to first-time setup. Backup files are untouched.
 */
export function ResetSetupDialog({
  open, onOpenChange, onDone,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onDone: () => void;
}) {
  const [pw, setPw] = useState("");

  function submit() {
    if (pw !== RESET_PASSWORD) { toast.error("Wrong reset password"); return; }
    if (!window.confirm("Reset the entire setup? All local accounts on this computer will be removed. Your backup files are not deleted.")) return;
    clearInstall();
    useProjectStore.getState().close();
    useSession.getState().clear();
    setPw("");
    onOpenChange(false);
    toast.success("Setup reset");
    onDone();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) setPw(""); onOpenChange(o); }}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Reset setup</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <p className="text-sm text-muted-foreground">
            Enter the reset password to remove all local accounts on this computer and return to
            first-time setup.
          </p>
          <form onSubmit={(e) => { e.preventDefault(); submit(); }}>
            <PasswordInput autoFocus value={pw} onChange={(e) => setPw(e.target.value)} />
          </form>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="destructive" onClick={submit} disabled={!pw}>Reset setup</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
