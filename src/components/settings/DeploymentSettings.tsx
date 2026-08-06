import { useState } from "react";
import { toast } from "sonner";
import { Monitor, Network, Server, Wifi, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { readInstall, updateInstall, type DeployMode } from "@/lib/install";
import { pingServer, DEFAULT_SERVER_PORT, SERVER_UNREACHABLE } from "@/lib/server-api";
import { useProjectStore } from "@/store/project-store";
import { useSession } from "@/store/session-store";

const LABELS: Record<DeployMode, string> = {
  single: "Single computer",
  server: "Multi computer — Server",
  client: "Multi computer — Client",
};

/**
 * Convert this computer between single-computer and multi-computer (server or
 * client) operation after first launch. Single → Server keeps the existing
 * local data as the starting database; switching to Client abandons it.
 */
export function DeploymentSettings() {
  const rec = readInstall();
  const mode: DeployMode = rec?.deployMode ?? "single";
  const settings = useProjectStore((s) => s.data!.settings);
  const mutate = useProjectStore((s) => s.mutate);

  const [host, setHost] = useState(rec?.serverHost ?? "");
  const [busy, setBusy] = useState(false);
  const [confirmClient, setConfirmClient] = useState(false);

  function switchTo(next: DeployMode) {
    updateInstall({ deployMode: next, serverPort: rec?.serverPort ?? DEFAULT_SERVER_PORT });
    toast.success(`Switched to ${LABELS[next]}`);
  }

  async function becomeClient() {
    if (!host.trim()) { toast.error("Enter the server's IP address"); return; }
    setBusy(true);
    try {
      await pingServer(host.trim());
    } catch (e: any) {
      toast.error(e?.message ?? SERVER_UNREACHABLE);
      setBusy(false);
      return;
    }
    setBusy(false);
    updateInstall({
      deployMode: "client",
      serverHost: host.trim(),
      serverPort: DEFAULT_SERVER_PORT,
      users: [],
    });
    useProjectStore.getState().close();
    useSession.getState().clear();
    toast.success("This computer is now a Client. Sign in with a server account.");
    window.location.hash = "#/";
    window.location.reload();
  }

  return (
    <section className="surface-card mt-4 p-6">
      <div className="mb-1 flex items-center gap-2">
        <Network className="h-4 w-4 text-primary" />
        <h2 className="font-display text-base font-semibold">Computer mode</h2>
      </div>
      <p className="mb-4 text-xs text-muted-foreground">
        Currently: <span className="font-medium text-foreground">{LABELS[mode]}</span>
      </p>

      <div className="grid gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3">
          <div className="flex items-start gap-2">
            <Monitor className="mt-0.5 h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">Single computer</p>
              <p className="text-xs text-muted-foreground">
                Local accounts only, no networking. Exactly how the app worked before.
              </p>
            </div>
          </div>
          <Button size="sm" variant="outline" disabled={mode === "single"} onClick={() => switchTo("single")}>
            {mode === "single" ? "Active" : "Use single computer"}
          </Button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3">
          <div className="flex items-start gap-2">
            <Server className="mt-0.5 h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">Multi computer — Server</p>
              <p className="text-xs text-muted-foreground">
                This computer keeps the real database and serves other computers on the network.
                Existing local data is kept as the starting database.
              </p>
            </div>
          </div>
          <Button size="sm" variant="outline" disabled={mode === "server"} onClick={() => switchTo("server")}>
            {mode === "server" ? "Active" : "Become server"}
          </Button>
        </div>

        <div className="rounded-md border p-3">
          <div className="flex items-start gap-2">
            <Wifi className="mt-0.5 h-4 w-4 text-muted-foreground" />
            <div className="flex-1">
              <p className="text-sm font-medium">Multi computer — Client</p>
              <p className="text-xs text-muted-foreground">
                Uses another computer's database. This computer's local data stops being used.
              </p>
              <div className="mt-3 flex flex-wrap items-end gap-2">
                <div>
                  <Label className="mb-1 block text-xs text-muted-foreground">Server IP address</Label>
                  <Input
                    className="h-9 w-56" value={host}
                    onChange={(e) => setHost(e.target.value)}
                  />
                </div>
                <Button
                  size="sm" variant="outline" disabled={busy}
                  onClick={() => setConfirmClient(true)}
                >
                  {mode === "client" ? "Update server IP" : "Become client"}
                </Button>
              </div>
            </div>
          </div>
        </div>

        {mode !== "single" && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3">
            <div className="flex items-start gap-2">
              <ShieldAlert className="mt-0.5 h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Restrict each account to one active login at a time</p>
                <p className="text-xs text-muted-foreground">
                  Off: the same account can be signed in on several computers. On: a second sign-in
                  is blocked until the first computer signs out. Signing out never affects other computers.
                </p>
              </div>
            </div>
            <Switch
              checked={settings.singleSessionOnly === true}
              onCheckedChange={(v) => mutate((d) => { d.settings.singleSessionOnly = v; })}
            />
          </div>
        )}
      </div>

      <AlertDialog open={confirmClient} onOpenChange={setConfirmClient}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Switch this computer to Client mode?</AlertDialogTitle>
            <AlertDialogDescription>
              This computer's local data will no longer be the source of truth and won't be used
              going forward — everything will come from the server at {host || "the given IP"}.
              Local accounts on this computer will be removed; you'll sign in with a server account.
              Make a backup first if you need this data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setConfirmClient(false); void becomeClient(); }}>
              Yes, use the server's data
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
