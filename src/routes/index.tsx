import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Lock, LogIn, Plus, User as UserIcon, Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/PasswordInput";
import { ResetSetupDialog } from "@/components/ResetSetupDialog";
import { useProjectStore, loadProjectFromInternal } from "@/store/project-store";
import { readInstall, writeInstall, createUser, findUserByLogin } from "@/lib/install";
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

type Screen = "boot" | "setup" | "login";

function LandingPage() {
  const navigate = useNavigate();
  const setUser = useSession((s) => s.setUser);

  const [screen, setScreen] = useState<Screen>("boot");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Setup form
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [adminUser, setAdminUser] = useState("");
  const [adminPw, setAdminPw] = useState("");
  const [adminPw2, setAdminPw2] = useState("");
  const protect = true;
  const [showReset, setShowReset] = useState(false);

  // Login form
  const [loginUser, setLoginUser] = useState("");
  const [loginPw, setLoginPw] = useState("");
  const [pharmacyLabel, setPharmacyLabel] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const rec = readInstall();
      if (!rec || !rec.users?.length) {
        if (!cancelled) setScreen("setup");
        return;
      }
      setPharmacyLabel(rec.pharmacyName || "");
      let data = useProjectStore.getState().data;
      if (!data) data = await loadProjectFromInternal();
      if (!data) {
        // Install exists but internal data was wiped — recreate an empty project.
        const fresh = createEmptyProject(rec.pharmacyName || "Pharmacy", !!rec.requireLogin);
        fresh.settings.address = rec.address || "";
        useProjectStore.getState().load(fresh);
        await useProjectStore.getState().save();
      }
      if (cancelled) return;
      // Resume straight into the app after an in-app restore/reload.
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
      writeInstall({
        setupDone: true,
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

  async function doLogin() {
    setError(null);
    setBusy(true);
    try {
      const u = await findUserByLogin(loginUser, loginPw);
      if (!u) { setError("Wrong username or password"); return; }
      setUser(u);
      toast.success(`Welcome, ${u.username}`);
      navigate({ to: "/app" });
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

        {screen === "setup" && (
          <section className="surface-card p-8">
            <div className="mb-6 flex items-center gap-2">
              <Plus className="h-5 w-5 text-primary" />
              <h2 className="font-display text-xl font-semibold">First-time setup</h2>
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
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button size="lg" onClick={doSetup} disabled={busy} className="mt-2">
                <Plus className="mr-2 h-4 w-4" /> {busy ? "Setting up…" : "Finish setup"}
              </Button>
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
              {pharmacyLabel ? (
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
                <PasswordInput
                  value={loginPw}
                  onChange={(e) => setLoginPw(e.target.value)}
                />
              </Field>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button size="lg" type="submit" disabled={busy || !loginPw || !loginUser}>
                <LogIn className="mr-2 h-4 w-4" /> {busy ? "Signing in…" : "Sign in"}
              </Button>
              <Button
                type="button" variant="ghost" size="sm"
                className="justify-self-start text-muted-foreground"
                onClick={() => setShowReset(true)}
              >
                <RotateCcw className="mr-2 h-4 w-4" /> Reset setup
              </Button>
            </form>
          </section>
        )}
      </div>

      <ResetSetupDialog
        open={showReset}
        onOpenChange={setShowReset}
        onDone={() => { setScreen("setup"); setLoginUser(""); setLoginPw(""); }}
      />
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
