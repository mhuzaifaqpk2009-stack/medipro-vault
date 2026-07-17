import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Lock } from "lucide-react";

export function PasswordDialog({
  open,
  projectName,
  onCancel,
  onSubmit,
  error,
  busy,
}: {
  open: boolean;
  projectName: string;
  onCancel: () => void;
  onSubmit: (pw: string) => void;
  error?: string;
  busy?: boolean;
}) {
  const [pw, setPw] = useState("");
  useEffect(() => {
    if (open) setPw("");
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onCancel()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display">
            <Lock className="h-4 w-4 text-primary" /> Unlock project
          </DialogTitle>
          <DialogDescription>Enter the password for “{projectName}”.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2 py-2">
          <Label htmlFor="unlock-pw">Password</Label>
          <Input
            id="unlock-pw"
            type="password"
            autoFocus
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && pw) onSubmit(pw);
            }}
          />
          {error && <p className="text-xs font-medium text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button disabled={!pw || busy} onClick={() => onSubmit(pw)}>
            {busy ? "Unlocking…" : "Open"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
