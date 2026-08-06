import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/PasswordInput";
import { clearInstall, verifyResetPassword } from "@/lib/install";
import { useProjectStore } from "@/store/project-store";
import { useSession } from "@/store/session-store";

/**
 * "Reset setup" confirmation. The password is the one the admin chose during
 * first-time setup — there is no hardcoded fallback. Reachable only from
 * Settings → Danger zone while signed in as Admin.
 */
export function ResetSetupDialog({
  open, onOpenChange, onDone,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onDone: () => void;
}) {
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    try {
      const ok = await verifyResetPassword(pw);
      if (!ok) { toast.error("Wrong reset password"); return; }
      if (!window.confirm("Reset the entire setup? All local accounts on this computer will be removed. Your backup files are not deleted.")) return;
      clearInstall();
      useProjectStore.getState().close();
      useSession.getState().clear();
      setPw("");
      onOpenChange(false);
      toast.success("Setup reset");
      onDone();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) setPw(""); onOpenChange(o); }}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Reset setup</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <p className="text-sm text-muted-foreground">
            Enter the Reset Setup password you chose during setup. This removes all local
            accounts on this computer and returns to first-time setup.
          </p>
          <form onSubmit={(e) => { e.preventDefault(); void submit(); }}>
            <PasswordInput autoFocus value={pw} onChange={(e) => setPw(e.target.value)} />
          </form>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="destructive" onClick={() => void submit()} disabled={!pw || busy}>
            Reset setup
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
