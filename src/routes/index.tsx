import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  Lock, LogIn, Plus, User as UserIcon, Loader2, Monitor, Network, Server, Wifi,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/PasswordInput";
import { useProjectStore, loadProjectFromInternal } from "@/store/project-store";
import {
  readInstall, writeInstall, createUser, findUserByLogin, updateInstall, type DeployMode,
} from "@/lib/install";
import { hashPassword } from "@/lib/install";
import {
  pingServer, serverLogin, serverPullProject, DEFAULT_SERVER_PORT, SERVER_UNREACHABLE,
} from "@/lib/server-api";
import { useSession } from "@/store/session-store";
import { createEmptyProject } from "@/domain/schema";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Huzaifa Software — Pharmacy Management System" },
      { name: "description", content: "Pharmacy Management System." },
    ],
  }),
  component: LandingPage,
});

type Screen = "boot" | "mode" | "role" | "setup" | "client-setup" | "login";

function LandingPage() {
  const navigate = useNavigate();
  const setUser = useSession((s) => s.setUser);

  const [screen, setScreen] = useState<Screen>("boot");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Chosen during the wizard; "single" is the simple default path. */
  const [mode, setMode] = useState<DeployMode>("single");

  // Setup form (single computer or server)
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [adminUser, setAdminUser] = useState("");
  const [adminPw, setAdminPw] = useState("");
  const [adminPw2, setAdminPw2] = useState("");
  const [resetPw, setResetPw] = useState("");
  const protect = true;

  // Client setup
  const [serverHost, setServerHost] = useState("");
  const [tested, setTested] = useState(false);

  // Login form
  const [loginUser, setLoginUser] = useState("");
  const [loginPw, setLoginPw] = useState("");
  const [pharmacyLabel, setPharmacyLabel] = useState("");
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const rec = readInstall();
      if (!rec) { if (!cancelled) setScreen("mode"); return; }

      if (rec.deployMode === "client") {
        // Clients never create accounts — straight to sign-in against the server.
        setIsClient(true);
        setServerHost(rec.serverHost ?? "");
        setPharmacyLabel(rec.pharmacyName || "");
        if (!cancelled) setScreen("login");
        return;
      }

      if (!rec.users?.length) { if (!cancelled) setScreen("mode"); return; }
      setPharmacyLabel(rec.pharmacyName || "");
      let data = useProjectStore.getState().data;
      if (!data) data = await loadProjectFromInternal();
      if (!data) {
        const fresh = createEmptyProject(rec.pharmacyName || "Pharmacy", !!rec.requireLogin);
        fresh.settings.address = rec.address || "";
        useProjectStore.getState().load(fresh);
        await useProjectStore.getState().save();
      }
      if (cancelled) return;
      const resuming = sessionStorage.getItem("medicore.resume") === "1";
      const cached = useSession.getState().user;
      if (resuming && cached) {
        sessionStorage.removeItem("medicore.resume");
        navigate({ to: "/app" });
        return;
      }
      if (rec.requireLogin === false) {
        const admin = rec.users.find((u) => u.role === "admin") ?? rec.users[0];
        setUser(admin);
        navigate({ to: "/app" });
        return;
      }
      setScreen("login");
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function doSetup() {
    setError(null);
    if (!name.trim()) return setError("Pharmacy name is required");
    if (!adminUser.trim()) return setError("Admin username is required");
    if (adminPw.length < 4) return setError("Password must be at least 4 characters");
    if (adminPw !== adminPw2) return setError("Passwords do not match");
    if (resetPw.length < 4) return setError("Reset Setup password must be at least 4 characters");

    setBusy(true);
    try {
      const project = createEmptyProject(name.trim(), protect);
      project.settings.pharmacyName = name.trim();
      project.settings.address = address.trim();
      useProjectStore.getState().load(project);
      await useProjectStore.getState().save();

      const admin = await createUser({
        username: adminUser.trim(), password: adminPw, role: "admin",
      });
      const reset = await hashPassword(resetPw);
      writeInstall({
        setupDone: true,
        deployMode: mode === "server" ? "server" : "single",
        serverPort: DEFAULT_SERVER_PORT,
        resetSaltHex: reset.saltHex,
        resetHashHex: reset.hashHex,
        pharmacyName: name.trim(),
        address: address.trim(),
        users: [admin],
        requireLogin: protect,
      });
      setUser(admin);
      toast.success("Setup complete");
      navigate({ to: "/app" });
    } catch (e: any) {
      setError(e?.message ?? "Setup failed");
    } finally {
      setBusy(false);
    }
  }

  async function testServer() {
    setError(null);
    if (!serverHost.trim()) return setError("Enter the server's IP address");
    setBusy(true);
    try {
      const res = await pingServer(serverHost.trim());
      setTested(true);
      setPharmacyLabel(res.pharmacyName || "");
      toast.success(`Connected to ${res.pharmacyName || serverHost.trim()}`);
    } catch (e: any) {
      setTested(false);
      setError(e?.message ?? SERVER_UNREACHABLE);
    } finally {
      setBusy(false);
    }
  }

  function finishClientSetup() {
    writeInstall({
      setupDone: true,
      deployMode: "client",
      serverHost: serverHost.trim(),
      serverPort: DEFAULT_SERVER_PORT,
      pharmacyName: pharmacyLabel,
      address: "",
      users: [],
      requireLogin: true,
    });
    setIsClient(true);
    setScreen("login");
  }

  async function doLogin() {
    setError(null);
    setBusy(true);
    try {
      if (isClient) {
        const res = await serverLogin(loginUser.trim(), loginPw);
        const snapshot = await serverPullProject();
        useProjectStore.getState().load(snapshot.data);
        sessionStorage.setItem("medicore.sessionId", res.sessionId);
        setUser(res.user);
        toast.success(`Welcome, ${res.user.username}`);
        navigate({ to: "/app" });
        return;
      }
      const u = await findUserByLogin(loginUser, loginPw);
      if (!u) { setError("Wrong username or password"); return; }
      setUser(u);
      toast.success(`Welcome, ${u.username}`);
      navigate({ to: "/app" });
    } catch (e: any) {
      setError(e?.message ?? "Sign in failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="hero-bg min-h-screen">
      <div className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-8 px-6 py-12">
        <motion.header
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="flex items-center gap-3"
        >
          <div className="grid h-12 w-12 place-items-center overflow-hidden rounded-xl bg-white shadow-elevated">
            <img src="./logo.png" alt="Huzaifa Software" className="h-12 w-12 object-contain" />
          </div>
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight">Huzaifa Software</h1>
            <p className="text-sm text-muted-foreground">Pharmacy Management System</p>
          </div>
        </motion.header>

        {screen === "boot" && (
          <section className="surface-card flex items-center gap-3 p-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading your pharmacy data…
          </section>
        )}

        {screen === "mode" && (
          <section className="surface-card p-8">
            <h2 className="font-display text-xl font-semibold">How will you use this software?</h2>
            <p className="mt-2 mb-6 text-sm text-muted-foreground">
              You can change this later in Settings → Workspace.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <ChoiceCard
                icon={<Monitor className="h-5 w-5 text-primary" />}
                title="Single computer"
                desc="Everything runs on this computer. Multiple local accounts, no networking."
                onClick={() => { setMode("single"); setScreen("setup"); }}
              />
              <ChoiceCard
                icon={<Network className="h-5 w-5 text-primary" />}
                title="Multi computer"
                desc="One computer holds the data; others connect over your local network."
                onClick={() => { setMode("server"); setScreen("role"); }}
              />
            </div>
          </section>
        )}

        {screen === "role" && (
          <section className="surface-card p-8">
            <h2 className="font-display text-xl font-semibold">Is this computer the Server or a Client?</h2>
            <p className="mt-2 mb-6 text-sm text-muted-foreground">
              The Server holds the real database. Clients connect to it and never store their own copy.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <ChoiceCard
                icon={<Server className="h-5 w-5 text-primary" />}
                title="Server"
                desc="Create the admin account and pharmacy details on this computer."
                onClick={() => { setMode("server"); setScreen("setup"); }}
              />
              <ChoiceCard
                icon={<Wifi className="h-5 w-5 text-primary" />}
                title="Client"
                desc="Connect to the server's IP address and sign in with an existing account."
                onClick={() => { setMode("client"); setScreen("client-setup"); }}
              />
            </div>
            <Button variant="ghost" size="sm" className="mt-5" onClick={() => setScreen("mode")}>Back</Button>
          </section>
        )}

        {screen === "client-setup" && (
          <section className="surface-card p-8">
            <div className="mb-6 flex items-center gap-2">
              <Wifi className="h-5 w-5 text-primary" />
              <h2 className="font-display text-xl font-semibold">Connect to the server</h2>
            </div>
            <div className="grid gap-4">
              <Field label="Server IP address (e.g. 192.168.1.20)">
                <Input
                  value={serverHost} autoFocus
                  onChange={(e) => { setServerHost(e.target.value); setTested(false); }}
                />
              </Field>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => void testServer()} disabled={busy}>
                  {busy ? "Testing…" : "Test connection"}
                </Button>
                <Button onClick={finishClientSetup} disabled={!tested}>Continue</Button>
                <Button variant="ghost" onClick={() => setScreen("role")}>Back</Button>
              </div>
            </div>
          </section>
        )}

        {screen === "setup" && (
          <section className="surface-card p-8">
            <div className="mb-6 flex items-center gap-2">
              <Plus className="h-5 w-5 text-primary" />
              <h2 className="font-display text-xl font-semibold">
                First-time setup{mode === "server" ? " — Server" : ""}
              </h2>
            </div>
            <p className="mb-6 text-sm text-muted-foreground">
              Create the admin account for this computer. All data is stored inside the
              application — use Settings → Backup to make a portable copy.
            </p>
            <div className="grid gap-4">
              <Field label="Pharmacy name">
                <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
              </Field>
              <Field label="Address / Location (optional)">
                <Input value={address} onChange={(e) => setAddress(e.target.value)} />
              </Field>
              <Field label="Admin username">
                <Input value={adminUser} onChange={(e) => setAdminUser(e.target.value)} />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Password">
                  <PasswordInput value={adminPw} onChange={(e) => setAdminPw(e.target.value)} />
                </Field>
                <Field label="Confirm password">
                  <PasswordInput value={adminPw2} onChange={(e) => setAdminPw2(e.target.value)} />
                </Field>
              </div>
              <Field label="Reset Setup password (asked before wiping this computer's setup)">
                <PasswordInput value={resetPw} onChange={(e) => setResetPw(e.target.value)} />
              </Field>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <div className="mt-2 flex gap-2">
                <Button size="lg" onClick={doSetup} disabled={busy}>
                  <Plus className="mr-2 h-4 w-4" /> {busy ? "Setting up…" : "Finish setup"}
                </Button>
                <Button size="lg" variant="ghost" onClick={() => setScreen("mode")}>Back</Button>
              </div>
            </div>
          </section>
        )}

        {screen === "login" && (
          <section className="surface-card p-8">
            <div className="mb-6 flex items-center gap-2">
              <Lock className="h-5 w-5 text-primary" />
              <h2 className="font-display text-xl font-semibold">Sign in</h2>
            </div>
            <p className="mb-6 text-sm text-muted-foreground">
              {isClient ? (
                <>Signing in to the server at <span className="font-medium text-foreground">{serverHost}</span>.</>
              ) : pharmacyLabel ? (
                <><span className="font-medium text-foreground">{pharmacyLabel}</span> — enter your account.</>
              ) : (
                "Enter your local account for this computer."
              )}
            </p>
            <form onSubmit={(e) => { e.preventDefault(); void doLogin(); }} className="grid gap-4">
              <Field label="Username">
                <div className="relative">
                  <UserIcon className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="pl-8"
                    value={loginUser} autoFocus
                    onChange={(e) => setLoginUser(e.target.value)}
                  />
                </div>
              </Field>
              <Field label="Password">
                <PasswordInput value={loginPw} onChange={(e) => setLoginPw(e.target.value)} />
              </Field>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button size="lg" type="submit" disabled={busy || !loginPw || !loginUser}>
                <LogIn className="mr-2 h-4 w-4" /> {busy ? "Signing in…" : "Sign in"}
              </Button>
              {isClient && (
                <Button
                  type="button" variant="ghost" size="sm"
                  className="justify-self-start text-muted-foreground"
                  onClick={() => {
                    updateInstall({ serverHost: "" });
                    setTested(false);
                    setScreen("client-setup");
                  }}
                >
                  <Wifi className="mr-2 h-4 w-4" /> Change server IP
                </Button>
              )}
            </form>
          </section>
        )}
      </div>
    </div>
  );
}

function ChoiceCard({ icon, title, desc, onClick }: {
  icon: React.ReactNode; title: string; desc: string; onClick: () => void;
}) {
  return (
    <button
      type="button" onClick={onClick}
      className="rounded-xl border bg-card p-5 text-left transition hover:border-primary hover:shadow-soft"
    >
      <div className="mb-2 flex items-center gap-2">
        {icon}
        <span className="font-display font-semibold">{title}</span>
      </div>
      <p className="text-sm text-muted-foreground">{desc}</p>
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
