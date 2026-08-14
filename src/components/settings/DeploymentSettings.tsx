import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Monitor, Network, Server, Wifi, ShieldAlert, Cable, Search, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { readInstall, updateInstall, type DeployMode } from "@/lib/install";
import { discoverLanServers, type DiscoveredServer } from "@/lib/server-bridge";
import { pingServer, DEFAULT_SERVER_PORT, SERVER_UNREACHABLE } from "@/lib/server-api";
import { useProjectStore } from "@/store/project-store";
import { useSession } from "@/store/session-store";

const LABELS: Record<DeployMode, string> = {
  single: "Single computer",
  server: "Multi computer — Server",
  client: "Multi computer — Client",
};

type ConnectionMethod = "ip" | "lan";

export function DeploymentSettings() {
  const rec = readInstall();
  const mode: DeployMode = rec?.deployMode ?? "single";
  const settings = useProjectStore((s) => s.data!.settings);
  const mutate = useProjectStore((s) => s.mutate);

  const [host, setHost] = useState(rec?.serverHost ?? "");
  const [busy, setBusy] = useState(false);
  const [confirmClient, setConfirmClient] = useState(false);
  const [connectionMethod, setConnectionMethod] = useState<ConnectionMethod>(rec?.serverHost ? "ip" : "lan");
  const [servers, setServers] = useState<DiscoveredServer[]>([]);
  const [discovering, setDiscovering] = useState(false);

  useEffect(() => {
    if (mode === "client" && connectionMethod === "lan") void discover();
    // Discovery is only a convenience for Client mode; the existing IP path is untouched.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  async function discover() {
    setDiscovering(true);
    const found = await discoverLanServers(2500);
    setServers(found);
    setDiscovering(false);
    if (!found.length) toast.error("No HPMS Server found on the local network. Check the Ethernet cable or Wi-Fi connection and make sure the Server is running.");
    else if (found.length === 1) {
      setHost(found[0].host);
      toast.success(`Found ${found[0].pharmacyName}`);
    }
  }

  function switchTo(next: DeployMode) {
    updateInstall({ deployMode: next, serverPort: rec?.serverPort ?? DEFAULT_SERVER_PORT });
    toast.success(`Switched to ${LABELS[next]}`);
  }

  async function becomeClient() {
    const target = host.trim();
    if (!target) {
      if (connectionMethod === "lan") toast.error("Find the HPMS Server first");
      else toast.error("Enter the server's IP address");
      return;
    }
    setBusy(true);
    try {
      await pingServer(target, DEFAULT_SERVER_PORT);
    } catch (e: any) {
      toast.error(e?.message ?? SERVER_UNREACHABLE);
      setBusy(false);
      return;
    }
    setBusy(false);
    updateInstall({
      deployMode: "client",
      serverHost: target,
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
              <p className="text-xs text-muted-foreground">Local accounts only, no networking. Exactly how the app worked before.</p>
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
              <p className="text-xs text-muted-foreground">This computer keeps the real database and serves other computers on the local network.</p>
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
              <p className="text-xs text-muted-foreground">Connect to another computer's database. Choose IP address or automatic local-network discovery.</p>

              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" variant={connectionMethod === "ip" ? "default" : "outline"} onClick={() => setConnectionMethod("ip")}>
                  Enter IP address
                </Button>
                <Button size="sm" variant={connectionMethod === "lan" ? "default" : "outline"} onClick={() => { setConnectionMethod("lan"); void discover(); }}>
                  <Cable className="mr-1.5 h-4 w-4" />
                  Cable / Auto Discover
                </Button>
              </div>

              {connectionMethod === "ip" ? (
                <div className="mt-3 flex flex-wrap items-end gap-2">
                  <div>
                    <Label className="mb-1 block text-xs text-muted-foreground">Server IP address</Label>
                    <Input className="h-9 w-56" value={host} onChange={(e) => setHost(e.target.value)} placeholder="192.168.0.104" />
                  </div>
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => setConfirmClient(true)}>
                    {mode === "client" ? "Update server IP" : "Become client"}
                  </Button>
                </div>
              ) : (
                <div className="mt-3 rounded-md border bg-muted/20 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-sm">
                      <Search className="h-4 w-4 text-muted-foreground" />
                      {discovering ? "Searching local Ethernet / Wi-Fi network..." : "HPMS Server discovery"}
                    </div>
                    <Button size="sm" variant="outline" disabled={discovering} onClick={() => void discover()}>
                      {discovering ? "Searching..." : "Search again"}
                    </Button>
                  </div>
                  {servers.length > 0 && (
                    <div className="mt-2 grid gap-2">
                      {servers.map((server) => {
                        const selected = host === server.host;
                        return (
                          <button key={`${server.host}:${server.port}`} type="button" onClick={() => setHost(server.host)} className={`flex items-center justify-between rounded-md border p-2 text-left transition ${selected ? "border-primary bg-primary/5" : "hover:bg-muted"}`}>
                            <span>
                              <span className="block text-sm font-medium">{server.pharmacyName}</span>
                              <span className="block text-xs text-muted-foreground">{server.connection} · {server.host}:{server.port}</span>
                            </span>
                            {selected && <CheckCircle2 className="h-4 w-4 text-primary" />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {host && (
                    <div className="mt-3 flex items-center justify-between gap-2">
                      <span className="text-xs text-muted-foreground">Selected server: {host}</span>
                      <Button size="sm" disabled={busy} onClick={() => setConfirmClient(true)}>
                        {mode === "client" ? "Connect to selected server" : "Become client"}
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {mode !== "single" && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3">
            <div className="flex items-start gap-2">
              <ShieldAlert className="mt-0.5 h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Restrict each account to one active login at a time</p>
                <p className="text-xs text-muted-foreground">Off: the same account can be signed in on several computers. On: a second sign-in is blocked until the first computer signs out.</p>
              </div>
            </div>
            <Switch checked={settings.singleSessionOnly === true} onCheckedChange={(v) => mutate((d) => { d.settings.singleSessionOnly = v; })} />
          </div>
        )}
      </div>

      <AlertDialog open={confirmClient} onOpenChange={setConfirmClient}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Switch this computer to Client mode?</AlertDialogTitle>
            <AlertDialogDescription>
              This computer's local data will no longer be the source of truth and won't be used going forward — everything will come from the selected server. Local accounts on this computer will be removed; you'll sign in with a server account. Make a backup first if you need this data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setConfirmClient(false); void becomeClient(); }}>Yes, use the server's data</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
