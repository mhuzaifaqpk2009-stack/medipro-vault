import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Lock, Sparkles } from "lucide-react";
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
import { Switch } from "@/components/ui/switch";
import { createEmptyProject } from "@/domain/schema";
import { encodeProject } from "@/lib/project-codec";
import { pickSaveFile, writeToHandle } from "@/lib/project-io";
import { useProjectStore } from "@/store/project-store";

export function CreateProjectDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [name, setName] = useState("");
  const [usePassword, setUsePassword] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  function reset() {
    setName("");
    setUsePassword(false);
    setPassword("");
    setConfirm("");
    setBusy(false);
  }

  async function onCreate() {
    if (!name.trim()) {
      toast.error("Enter a project name");
      return;
    }
    if (usePassword) {
      if (password.length < 4) {
        toast.error("Password must be at least 4 characters");
        return;
      }
      if (password !== confirm) {
        toast.error("Passwords do not match");
        return;
      }
    }
    setBusy(true);
    try {
      const handle = await pickSaveFile(name.trim());
      if (!handle) {
        // User cancelled Save As — do NOT create the project.
        setBusy(false);
        return;
      }
      const project = createEmptyProject(name.trim(), usePassword);
      const bytes = await encodeProject(
        project as unknown as Record<string, unknown>,
        usePassword ? password : undefined,
      );
      await writeToHandle(handle, bytes);
      useProjectStore.getState().load(project, handle, usePassword ? password : undefined);
      toast.success(`Created “${project.meta.name}”`);
      reset();
      onOpenChange(false);
      navigate({ to: "/app" });
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message ?? "Failed to create project");
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!busy) {
          onOpenChange(v);
          if (!v) reset();
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display">
            <Sparkles className="h-5 w-5 text-primary" />
            New pharmacy project
          </DialogTitle>
          <DialogDescription>
            Each project is a single portable file. You'll be asked where to save it.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="p-name">Project name</Label>
            <Input
              id="p-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Downtown Pharmacy"
              autoFocus
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border bg-muted/30 p-3">
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Password protect</p>
                <p className="text-xs text-muted-foreground">
                  Encrypts the file with AES-256.
                </p>
              </div>
            </div>
            <Switch checked={usePassword} onCheckedChange={setUsePassword} />
          </div>

          {usePassword && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="pw">Password</Label>
                <Input
                  id="pw"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pw2">Confirm</Label>
                <Input
                  id="pw2"
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                />
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={onCreate} disabled={busy}>
            {busy ? "Creating…" : "Choose location & create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
