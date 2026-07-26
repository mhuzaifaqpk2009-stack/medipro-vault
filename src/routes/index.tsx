import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  FolderOpen, Plus, Lock, Stethoscope, LogIn, Sparkles, User as UserIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { pickOpenFile, pickSaveFile, writeToHandle } from "@/lib/project-io";
import { decodeProject, encodeProject, WrongPasswordError } from "@/lib/project-codec";
import { openProjectFromBytes, useProjectStore } from "@/store/project-store";
import {
  readInstall, writeInstall, updateInstall,
  createUser, findUserByLogin,
} from "@/lib/install";
import { useSession } from "@/store/session-store";
import { createEmptyProject, type ProjectData } from "@/domain/schema";
import { upsertRecent } from "@/lib/recents";
import { askPassword } from "@/components/PasswordPromptDialog";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MediCore — Sign in" },
      { name: "description", content: "Pharmacy Management System." },
    ],
  }),
  component: LandingPage,
});

type Screen = "setup" | "login" | "not-found";

function LandingPage() {
  const navigate = useNavigate();
  const setUser = useSession((s) => s.setUser);
  const [screen, setScreen] = useState<Screen>(() =>
    readInstall() ? "login" : "setup",
  );

  // Setup form
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [username, setUsername] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [loginUser, setLoginUser] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const install = useMemo(() => readInstall(), [screen]);
  const inElectron = typeof window !== "undefined" && !!(window as any).medicore;

  async function doSetup() {
    setError(null);
    if (!name.trim()) return setError("Pharmacy name is required");
    if (!address.trim()) return setError("Address is required");
    if (!username.trim()) return setError("Admin username is required");
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

      const admin = await createUser({ username: username.trim(), password: pw, role: "admin" });
      writeInstall({
        setupDone: true,
        pharmacyName: name.trim(),
        address: address.trim(),
        users: [admin],
        filePassword: pw,
        lastFsPath: handle.fsPath,
        lastPath: handle.path,
      });
      useProjectStore.getState().load(project, handle, pw);
      setUser(admin);
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
      const u = await findUserByLogin(loginUser, pw);
      if (!u) { setError("Wrong username or password"); setBusy(false); return; }

      const filePw = rec.filePassword ?? (u.role === "admin" ? pw : "");
      if (!filePw && u.role !== "admin") {
        setError("File password not set — an admin must sign in first.");
        setBusy(false);
        return;
      }

      if (inElectron && rec.lastFsPath) {
        const res = await tryLoad(rec.lastFsPath, filePw);
        if (res === "missing" || res === "wrong") {
          setUser(u); // still authenticate the user
          setScreen("not-found");
          setBusy(false);
          return;
        }
        // Persist the file password if admin logged in and it wasn't stored yet.
        if (u.role === "admin" && !rec.filePassword) updateInstall({ filePassword: pw });
        setUser(u);
        toast.success(`Welcome, ${u.username}`);
        navigate({ to: "/app" });
        return;
      }

      setUser(u);
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
      const rec = readInstall();
      const pwToUse = rec?.filePassword ?? pw;
      try {
        const data = await openProjectFromBytes(picked.bytes, picked.handle, pwToUse);
        if (picked.handle.fsPath) updateInstall({ lastFsPath: picked.handle.fsPath, lastPath: picked.handle.path });
        upsertRecent({
          name: data.meta.name, path: picked.handle.path,
          fsPath: picked.handle.fsPath, encrypted: true,
        });
        toast.success(`Loaded ${data.meta.name}`);
        navigate({ to: "/app" });
      } catch (e) {
        if (e instanceof WrongPasswordError) {
          const askPw = (await askPassword("Enter password", "This file is encrypted. Enter its password to load.")) || "";
          if (!askPw) return;
          try {
            const data = await openProjectFromBytes(picked.bytes, picked.handle, askPw);
            if (picked.handle.fsPath) updateInstall({ lastFsPath: picked.handle.fsPath, lastPath: picked.handle.path });
            toast.success(`Loaded ${data.meta.name}`);
            navigate({ to: "/app" });
          } catch {
            try {
              await decodeProject(picked.bytes);
              await openProjectFromBytes(picked.bytes, picked.handle);
              toast.success("Loaded");
              navigate({ to: "/app" });
            } catch {
              toast.error("Wrong password for this file");
            }
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
    const rec = readInstall();
    if (!rec) { setScreen("setup"); return; }
    try {
      const handle = await pickSaveFile(rec.pharmacyName);
      if (!handle) return;
      const filePw = rec.filePassword ?? pw;
      const project = createEmptyProject(rec.pharmacyName, true);
      project.settings.pharmacyName = rec.pharmacyName;
      project.settings.address = rec.address;
      const bytes = await encodeProject(project as unknown as Record<string, unknown>, filePw);
      await writeToHandle(handle, bytes);
      updateInstall({ lastFsPath: handle.fsPath, lastPath: handle.path, filePassword: filePw });
      useProjectStore.getState().load(project, handle, filePw);
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
            <p className="text-sm text-muted-foreground">Pharmacy Management System</p>
          </div>
        </motion.header>

        {screen === "setup" && (
          <section key="setup" className="surface-card p-8">
            <div className="mb-6 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <h2 className="font-display text-xl font-semibold">First-time setup</h2>
            </div>
            <p className="mb-6 text-sm text-muted-foreground">
              Create the admin account. You can add more users (with limited permissions) later from Settings.
            </p>
            <div className="grid gap-4">
              <Field label="Pharmacy name">
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Jalal & Brothers Pharmacy" />
              </Field>
              <Field label="Address / Location">
                <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Gill Road, Gujranwala" />
              </Field>
              <Field label="Admin username">
                <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="admin" />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Admin password">
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
              <span className="font-medium text-foreground">{install.pharmacyName}</span> — sign in to continue.
            </p>
            <form
              onSubmit={(e) => { e.preventDefault(); void doLogin(); }}
              className="grid gap-4"
            >
              <Field label="Username">
                <div className="relative">
                  <UserIcon className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="pl-8"
                    value={loginUser} autoFocus
                    onChange={(e) => setLoginUser(e.target.value)}
                    placeholder="admin"
                  />
                </div>
              </Field>
              <Field label="Password">
                <Input
                  type="password" value={pw}
                  onChange={(e) => setPw(e.target.value)}
                  placeholder="••••••••"
                />
              </Field>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button size="lg" type="submit" disabled={busy || !pw || !loginUser}>
                <LogIn className="mr-2 h-4 w-4" /> {busy ? "Signing in…" : "Sign in"}
              </Button>
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
