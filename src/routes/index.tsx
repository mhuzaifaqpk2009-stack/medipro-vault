import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  FolderOpen, Plus, Lock, Stethoscope, ShieldCheck, Zap, LogIn, Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { pickOpenFile, pickSaveFile, writeToHandle } from "@/lib/project-io";
import { decodeProject, encodeProject, WrongPasswordError } from "@/lib/project-codec";
import { openProjectFromBytes, useProjectStore } from "@/store/project-store";
import {
  readInstall, writeInstall, updateInstall, hashPassword, verifyPassword, clearInstall,
} from "@/lib/install";
import { createEmptyProject, type ProjectData } from "@/domain/schema";
import { upsertRecent } from "@/lib/recents";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MediCore — Sign in" },
      { name: "description", content: "Local pharmacy management, fully offline." },
    ],
  }),
  component: LandingPage,
});

type Screen = "setup" | "login" | "not-found";

function LandingPage() {
  const navigate = useNavigate();
  const [screen, setScreen] = useState<Screen>(() =>
    readInstall() ? "login" : "setup",
  );

  // Setup form
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const install = useMemo(() => readInstall(), [screen]);
  const inElectron = typeof window !== "undefined" && !!(window as any).medicore;

  async function doSetup() {
    setError(null);
    if (!name.trim()) return setError("Pharmacy name is required");
    if (!address.trim()) return setError("Address is required");
    if (pw.length < 4) return setError("Password must be at least 4 characters");
    if (pw !== pw2) return setError("Passwords do not match");
    setBusy(true);
    try {
      const handle = await pickSaveFile(name.trim());
      if (!handle) { setBusy(false); return; }
      const project = createEmptyProject(name.trim(), true);
      project.settings.pharmacyName = name.trim();
      project.settings.address = address.trim();
      const bytes = await encodeProject(project as unknown as Record<string, unknown>, pw);
      await writeToHandle(handle, bytes);

      const { saltHex, hashHex } = await hashPassword(pw);
      writeInstall({
        setupDone: true,
        pharmacyName: name.trim(),
        address: address.trim(),
        saltHex, hashHex,
        lastFsPath: handle.fsPath,
        lastPath: handle.path,
      });
      useProjectStore.getState().load(project, handle, pw);
      upsertRecent({
        name: project.meta.name, path: handle.path,
        fsPath: handle.fsPath, encrypted: true,
      });
      toast.success("Pharmacy created");
      navigate({ to: "/app" });
    } catch (e: any) {
      setError(e?.message ?? "Setup failed");
    } finally {
      setBusy(false);
    }
  }

  async function tryLoad(fsPath: string, password: string): Promise<ProjectData | "missing" | "wrong"> {
    try {
      const bytes: Uint8Array = await (window as any).medicore.project.readFile(fsPath);
      try {
        const data = await openProjectFromBytes(
          bytes,
          { kind: "electron", name: fsPath.split(/[\\/]/).pop() || fsPath, path: fsPath, fsPath },
          password,
        );
        return data;
      } catch (e) {
        if (e instanceof WrongPasswordError) return "wrong";
        return "missing";
      }
    } catch {
      return "missing";
    }
  }

  async function doLogin() {
    setError(null);
    const rec = readInstall();
    if (!rec) { setScreen("setup"); return; }
    setBusy(true);
    try {
      const ok = await verifyPassword(pw, rec.saltHex, rec.hashHex);
      if (!ok) { setError("Wrong password"); setBusy(false); return; }

      // Try to auto-load the last data file (Electron only).
      if (inElectron && rec.lastFsPath) {
        const res = await tryLoad(rec.lastFsPath, pw);
        if (res === "missing") {
          setScreen("not-found");
          setBusy(false);
          return;
        }
        if (res === "wrong") {
          // Password was changed for the file; user must Load Data manually.
          setScreen("not-found");
          setBusy(false);
          return;
        }
        toast.success(`Welcome back, ${rec.pharmacyName}`);
        navigate({ to: "/app" });
        return;
      }

      // Browser fallback: cannot auto-load, always ask to pick.
      setScreen("not-found");
    } finally {
      setBusy(false);
    }
  }

  async function loadFromDisk() {
    setError(null);
    try {
      const picked = await pickOpenFile();
      if (!picked) return;
      try {
        const data = await openProjectFromBytes(picked.bytes, picked.handle, pw);
        if (picked.handle.fsPath) updateInstall({ lastFsPath: picked.handle.fsPath, lastPath: picked.handle.path });
        upsertRecent({
          name: data.meta.name, path: picked.handle.path,
          fsPath: picked.handle.fsPath, encrypted: true,
        });
        toast.success(`Loaded ${data.meta.name}`);
        navigate({ to: "/app" });
      } catch (e) {
        if (e instanceof WrongPasswordError) {
          // Try without password (unencrypted file)
          try {
            const { payload } = await decodeProject(picked.bytes);
            await openProjectFromBytes(picked.bytes, picked.handle);
            const data = payload as unknown as ProjectData;
            if (picked.handle.fsPath) updateInstall({ lastFsPath: picked.handle.fsPath, lastPath: picked.handle.path });
            toast.success(`Loaded ${data.meta.name}`);
            navigate({ to: "/app" });
          } catch {
            toast.error("Wrong password for this file");
          }
        } else {
          toast.error("Could not load file");
        }
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Load failed");
    }
  }

  async function makeNewFromNotFound() {
    // Rebuild a fresh project with existing install credentials.
    const rec = readInstall();
    if (!rec) { setScreen("setup"); return; }
    try {
      const handle = await pickSaveFile(rec.pharmacyName);
      if (!handle) return;
      const project = createEmptyProject(rec.pharmacyName, true);
      project.settings.pharmacyName = rec.pharmacyName;
      project.settings.address = rec.address;
      const bytes = await encodeProject(project as unknown as Record<string, unknown>, pw);
      await writeToHandle(handle, bytes);
      updateInstall({ lastFsPath: handle.fsPath, lastPath: handle.path });
      useProjectStore.getState().load(project, handle, pw);
      upsertRecent({
        name: project.meta.name, path: handle.path,
        fsPath: handle.fsPath, encrypted: true,
      });
      toast.success("Created new pharmacy data");
      navigate({ to: "/app" });
    } catch (e: any) {
      toast.error(e?.message ?? "Could not create");
    }
  }

  return (
    <div className="hero-bg min-h-screen">
      <div className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center gap-8 px-6 py-12">
        <motion.header
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="flex items-center gap-3"
        >
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-primary text-primary-foreground shadow-elevated">
            <Stethoscope className="h-6 w-6" />
          </div>
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight">MediCore</h1>
            <p className="text-sm text-muted-foreground">Offline pharmacy management</p>
          </div>
        </motion.header>

        {screen === "setup" && (
          <section className="surface-card p-8">
            <div className="mb-6 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <h2 className="font-display text-xl font-semibold">First-time setup</h2>
            </div>
            <p className="mb-6 text-sm text-muted-foreground">
              Enter your pharmacy details. You'll then choose where to save the encrypted data file.
            </p>
            <div className="grid gap-4">
              <Field label="Pharmacy name">
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Jalal & Brothers Pharmacy" />
              </Field>
              <Field label="Address / Location">
                <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Gill Road, Gujranwala" />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Password">
                  <Input type="password" value={pw} onChange={(e) => setPw(e.target.value)} />
                </Field>
                <Field label="Confirm password">
                  <Input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
                </Field>
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button size="lg" onClick={doSetup} disabled={busy} className="mt-2">
                <Plus className="mr-2 h-4 w-4" /> {busy ? "Creating…" : "Create pharmacy"}
              </Button>
            </div>
          </section>
        )}

        {screen === "login" && install && (
          <section className="surface-card p-8">
            <div className="mb-4 flex items-center gap-2">
              <Lock className="h-5 w-5 text-primary" />
              <h2 className="font-display text-xl font-semibold">Welcome back</h2>
            </div>
            <p className="mb-6 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{install.pharmacyName}</span> — enter password to unlock.
            </p>
            <form
              onSubmit={(e) => { e.preventDefault(); void doLogin(); }}
              className="grid gap-4"
            >
              <Field label="Password">
                <Input
                  type="password" value={pw} autoFocus
                  onChange={(e) => setPw(e.target.value)}
                  placeholder="••••••••"
                />
              </Field>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button size="lg" type="submit" disabled={busy || !pw}>
                <LogIn className="mr-2 h-4 w-4" /> {busy ? "Unlocking…" : "Sign in"}
              </Button>
              <button
                type="button"
                onClick={() => {
                  if (window.confirm("Reset the pharmacy setup? You'll need to run first-time setup again. Your data file is not deleted.")) {
                    clearInstall();
                    setScreen("setup");
                    setPw(""); setPw2("");
                  }
                }}
                className="mt-2 text-center text-xs text-muted-foreground hover:text-foreground"
              >
                Reset setup
              </button>
            </form>
          </section>
        )}

        {screen === "not-found" && (
          <section className="surface-card p-8">
            <h2 className="font-display text-xl font-semibold">Data not found</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              We couldn't open the saved data file{install?.lastFsPath ? ` at ${install.lastFsPath}` : ""}. Choose an option below.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button onClick={loadFromDisk}>
                <FolderOpen className="mr-2 h-4 w-4" /> Load Data
              </Button>
              <Button variant="outline" onClick={() => setScreen("login")}>Cancel</Button>
              <Button variant="secondary" onClick={makeNewFromNotFound}>
                <Plus className="mr-2 h-4 w-4" /> Make New
              </Button>
            </div>
          </section>
        )}

        <div className="grid gap-3 sm:grid-cols-3">
          <MiniCard icon={<ShieldCheck className="h-4 w-4" />} title="Offline" body="No cloud. Local only." />
          <MiniCard icon={<Lock className="h-4 w-4" />} title="Encrypted" body="AES-256 protected." />
          <MiniCard icon={<Zap className="h-4 w-4" />} title="Portable" body="Single .medicore file." />
        </div>
      </div>
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

function MiniCard({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="surface-card p-4">
      <div className="mb-1.5 flex items-center gap-2">
        <span className="grid h-6 w-6 place-items-center rounded-md bg-primary/10 text-primary">{icon}</span>
        <p className="text-sm font-semibold">{title}</p>
      </div>
      <p className="text-xs text-muted-foreground">{body}</p>
    </div>
  );
}
