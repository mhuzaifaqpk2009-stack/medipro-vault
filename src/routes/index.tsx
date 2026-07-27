import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  FolderOpen, Plus, Lock, LogIn, Sparkles, User as UserIcon, ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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
import type { ProjectFileHandle } from "@/lib/project-io";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Huzaifa Software — Pharmacy Management System" },
      { name: "description", content: "Pharmacy Management System." },
    ],
  }),
  component: LandingPage,
});

type Screen = "home" | "new" | "login" | "create-account";

function LandingPage() {
  const navigate = useNavigate();
  const setUser = useSession((s) => s.setUser);

  const [screen, setScreen] = useState<Screen>("home");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // "New data" form
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [locked, setLocked] = useState(true);
  const [filePw, setFilePw] = useState("");
  const [filePw2, setFilePw2] = useState("");
  const [adminUser, setAdminUser] = useState("");
  const [adminPw, setAdminPw] = useState("");
  const [adminPw2, setAdminPw2] = useState("");

  // Login form
  const [loginUser, setLoginUser] = useState("");
  const [loginPw, setLoginPw] = useState("");

  // "Create account after loading" form (when a file was loaded but no local accounts exist)
  const [newAdminUser, setNewAdminUser] = useState("");
  const [newAdminPw, setNewAdminPw] = useState("");
  const [newAdminPw2, setNewAdminPw2] = useState("");

  const install = useMemo(() => readInstall(), [screen, busy]);
  const hasAccounts = !!install?.users?.length;

  function resetForms() {
    setError(null);
    setName(""); setAddress("");
    setLocked(true); setFilePw(""); setFilePw2("");
    setAdminUser(""); setAdminPw(""); setAdminPw2("");
    setLoginUser(""); setLoginPw("");
    setNewAdminUser(""); setNewAdminPw(""); setNewAdminPw2("");
  }

  function goHome() { resetForms(); setScreen("home"); }

  async function doCreateNew() {
    setError(null);
    if (!name.trim()) return setError("Pharmacy name is required");
    if (!address.trim()) return setError("Address is required");
    if (locked) {
      if (filePw.length < 4) return setError("File password must be at least 4 characters");
      if (filePw !== filePw2) return setError("File passwords do not match");
    }
    if (!hasAccounts) {
      if (!adminUser.trim()) return setError("Admin username is required");
      if (adminPw.length < 4) return setError("Admin password must be at least 4 characters");
      if (adminPw !== adminPw2) return setError("Admin passwords do not match");
    }

    setBusy(true);
    try {
      const handle = await pickSaveFile(name.trim());
      if (!handle) { setBusy(false); return; }

      const project = createEmptyProject(name.trim(), locked);
      project.settings.pharmacyName = name.trim();
      project.settings.address = address.trim();

      const pwForFile = locked ? filePw : undefined;
      const bytes = await encodeProject(
        project as unknown as Record<string, unknown>,
        pwForFile,
      );
      await writeToHandle(handle, bytes);

      // Local accounts (per machine) — never inside the data file.
      let userToSignIn = install?.users?.find((u) => u.role === "admin") ?? null;
      if (!hasAccounts) {
        const admin = await createUser({
          username: adminUser.trim(), password: adminPw, role: "admin",
        });
        writeInstall({
          setupDone: true,
          pharmacyName: name.trim(),
          address: address.trim(),
          users: [admin],
          filePassword: pwForFile,
          lastFsPath: handle.fsPath,
          lastPath: handle.path,
        });
        userToSignIn = admin;
      } else {
        updateInstall({
          pharmacyName: name.trim(),
          address: address.trim(),
          filePassword: pwForFile,
          lastFsPath: handle.fsPath,
          lastPath: handle.path,
        });
      }

      useProjectStore.getState().load(project, handle, pwForFile);
      if (userToSignIn) setUser(userToSignIn);
      upsertRecent({
        name: project.meta.name, path: handle.path,
        fsPath: handle.fsPath, encrypted: locked,
      });
      toast.success("Pharmacy data created");

      if (userToSignIn) {
        navigate({ to: "/app" });
      } else {
        // Accounts exist but not signed in — go to login.
        setScreen("login");
      }
    } catch (e: any) {
      setError(e?.message ?? "Could not create pharmacy data");
    } finally {
      setBusy(false);
    }
  }

  async function decodeWithPasswordPrompt(bytes: Uint8Array, handle: ProjectFileHandle): Promise<ProjectData | null> {
    // Try no-password first.
    try {
      return await openProjectFromBytes(bytes, handle);
    } catch (e) {
      if (!(e instanceof WrongPasswordError)) {
        // Not encrypted / other error
        try { await decodeProject(bytes); } catch { throw e; }
      }
    }
    // Encrypted: try stored file password first (if any).
    const rec = readInstall();
    if (rec?.filePassword) {
      try { return await openProjectFromBytes(bytes, handle, rec.filePassword); }
      catch { /* fall through to prompt */ }
    }
    // Prompt user.
    for (let i = 0; i < 3; i++) {
      const pw = await askPassword("Enter password", "This data file is locked. Enter its password to load.");
      if (!pw) return null;
      try {
        const data = await openProjectFromBytes(bytes, handle, pw);
        updateInstall({ filePassword: pw });
        return data;
      } catch {
        toast.error("Wrong password");
      }
    }
    return null;
  }

  async function doLoadData() {
    setError(null);
    setBusy(true);
    try {
      const picked = await pickOpenFile();
      if (!picked) { setBusy(false); return; }
      const data = await decodeWithPasswordPrompt(picked.bytes, picked.handle);
      if (!data) { setBusy(false); return; }
      if (picked.handle.fsPath) {
        updateInstall({
          lastFsPath: picked.handle.fsPath,
          lastPath: picked.handle.path,
        });
      }
      upsertRecent({
        name: data.meta.name, path: picked.handle.path,
        fsPath: picked.handle.fsPath, encrypted: true,
      });
      toast.success(`Loaded ${data.meta.name}`);

      const rec = readInstall();
      if (rec?.users?.length) {
        // Existing local accounts: require sign in before entering /app.
        setScreen("login");
      } else {
        // No accounts on this machine — bootstrap an admin here.
        // Seed an install record with pharmacy meta.
        writeInstall({
          setupDone: true,
          pharmacyName: data.settings.pharmacyName || data.meta.name,
          address: data.settings.address || "",
          users: [],
          lastFsPath: picked.handle.fsPath,
          lastPath: picked.handle.path,
        });
        setScreen("create-account");
      }
    } catch (e: any) {
      setError(e?.message ?? "Load failed");
      toast.error(e?.message ?? "Load failed");
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

      // If a project is already loaded (just loaded), go straight in.
      if (useProjectStore.getState().data) {
        toast.success(`Welcome, ${u.username}`);
        navigate({ to: "/app" });
        return;
      }
      toast.success(`Welcome, ${u.username}`);
      navigate({ to: "/app" });
    } finally {
      setBusy(false);
    }
  }

  async function doCreateAccountAfterLoad() {
    setError(null);
    if (!newAdminUser.trim()) return setError("Username is required");
    if (newAdminPw.length < 4) return setError("Password must be at least 4 characters");
    if (newAdminPw !== newAdminPw2) return setError("Passwords do not match");
    setBusy(true);
    try {
      const admin = await createUser({
        username: newAdminUser.trim(), password: newAdminPw, role: "admin",
      });
      const rec = readInstall();
      writeInstall({
        setupDone: true,
        pharmacyName: rec?.pharmacyName || "",
        address: rec?.address || "",
        users: [admin],
        filePassword: useProjectStore.getState().password,
        lastFsPath: rec?.lastFsPath,
        lastPath: rec?.lastPath,
      });
      setUser(admin);
      toast.success(`Welcome, ${admin.username}`);
      navigate({ to: "/app" });
    } catch (e: any) {
      setError(e?.message ?? "Could not create account");
    } finally {
      setBusy(false);
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
          <div className="grid h-12 w-12 place-items-center overflow-hidden rounded-xl bg-white shadow-elevated">
            <img src="./logo.png" alt="Huzaifa Software" className="h-12 w-12 object-contain" />
          </div>
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight">Huzaifa Software</h1>
            <p className="text-sm text-muted-foreground">Pharmacy Management System</p>
          </div>
        </motion.header>

        {screen === "home" && (
          <section className="surface-card p-8">
            <div className="mb-6 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <h2 className="font-display text-xl font-semibold">Welcome</h2>
            </div>
            <p className="mb-6 text-sm text-muted-foreground">
              Load an existing pharmacy data file, or create a fresh one. All medicines, sales,
              bills and settings are stored in the data file — take it to any computer.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Button size="lg" onClick={doLoadData} disabled={busy}>
                <FolderOpen className="mr-2 h-4 w-4" /> Load Data
              </Button>
              <Button size="lg" variant="secondary" onClick={() => { resetForms(); setScreen("new"); }} disabled={busy}>
                <Plus className="mr-2 h-4 w-4" /> Make New Data
              </Button>
            </div>
            {hasAccounts && (
              <div className="mt-6 border-t pt-4">
                <p className="mb-3 text-xs text-muted-foreground">
                  This computer already has a saved account.
                </p>
                <Button variant="outline" onClick={() => { resetForms(); setScreen("login"); }}>
                  <LogIn className="mr-2 h-4 w-4" /> Account exists — sign in
                </Button>
              </div>
            )}
            {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
          </section>
        )}

        {screen === "new" && (
          <section className="surface-card p-8">
            <BackHeader onBack={goHome} title="Make new pharmacy data" icon={<Plus className="h-5 w-5 text-primary" />} />
            <div className="grid gap-4">
              <Field label="Pharmacy name">
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Jalal & Brothers Pharmacy" />
              </Field>
              <Field label="Address / Location">
                <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Gill Road, Gujranwala" />
              </Field>

              <label className="flex items-center gap-2 rounded-md border p-3 text-sm">
                <Checkbox checked={locked} onCheckedChange={(v) => setLocked(!!v)} />
                <span className="font-medium">Lock this data file with a password</span>
                <span className="text-xs text-muted-foreground">(recommended)</span>
              </label>

              {locked && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="File password">
                    <Input type="password" value={filePw} onChange={(e) => setFilePw(e.target.value)} />
                  </Field>
                  <Field label="Confirm file password">
                    <Input type="password" value={filePw2} onChange={(e) => setFilePw2(e.target.value)} />
                  </Field>
                </div>
              )}

              {!hasAccounts && (
                <>
                  <div className="mt-2 rounded-md bg-muted/40 p-3 text-xs text-muted-foreground">
                    Create the admin account for <strong>this computer</strong>. Accounts are stored locally
                    on this machine only — they are never saved inside the data file.
                  </div>
                  <Field label="Admin username">
                    <Input value={adminUser} onChange={(e) => setAdminUser(e.target.value)} placeholder="admin" />
                  </Field>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Admin password">
                      <Input type="password" value={adminPw} onChange={(e) => setAdminPw(e.target.value)} />
                    </Field>
                    <Field label="Confirm admin password">
                      <Input type="password" value={adminPw2} onChange={(e) => setAdminPw2(e.target.value)} />
                    </Field>
                  </div>
                </>
              )}

              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button size="lg" onClick={doCreateNew} disabled={busy} className="mt-2">
                <Plus className="mr-2 h-4 w-4" /> {busy ? "Creating…" : "Create pharmacy data"}
              </Button>
            </div>
          </section>
        )}

        {screen === "login" && (
          <section className="surface-card p-8">
            <BackHeader onBack={goHome} title="Sign in" icon={<Lock className="h-5 w-5 text-primary" />} />
            <p className="mb-6 text-sm text-muted-foreground">
              {install?.pharmacyName ? (
                <><span className="font-medium text-foreground">{install.pharmacyName}</span> — enter your account.</>
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
                    placeholder="admin"
                  />
                </div>
              </Field>
              <Field label="Password">
                <Input
                  type="password" value={loginPw}
                  onChange={(e) => setLoginPw(e.target.value)}
                  placeholder="••••••••"
                />
              </Field>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button size="lg" type="submit" disabled={busy || !loginPw || !loginUser}>
                <LogIn className="mr-2 h-4 w-4" /> {busy ? "Signing in…" : "Sign in"}
              </Button>
            </form>
          </section>
        )}

        {screen === "create-account" && (
          <section className="surface-card p-8">
            <BackHeader onBack={goHome} title="Create local account" icon={<UserIcon className="h-5 w-5 text-primary" />} />
            <p className="mb-6 text-sm text-muted-foreground">
              This computer has no account yet. Create an admin account to manage the loaded data.
              Accounts live on this computer only — the data file is portable.
            </p>
            <div className="grid gap-4">
              <Field label="Admin username">
                <Input value={newAdminUser} onChange={(e) => setNewAdminUser(e.target.value)} placeholder="admin" autoFocus />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Admin password">
                  <Input type="password" value={newAdminPw} onChange={(e) => setNewAdminPw(e.target.value)} />
                </Field>
                <Field label="Confirm password">
                  <Input type="password" value={newAdminPw2} onChange={(e) => setNewAdminPw2(e.target.value)} />
                </Field>
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button size="lg" onClick={doCreateAccountAfterLoad} disabled={busy}>
                <Plus className="mr-2 h-4 w-4" /> {busy ? "Creating…" : "Create account & continue"}
              </Button>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function BackHeader({ onBack, title, icon }: { onBack: () => void; title: string; icon: React.ReactNode }) {
  return (
    <div className="mb-6 flex items-center gap-2">
      <Button variant="ghost" size="icon" onClick={onBack} className="-ml-2">
        <ArrowLeft className="h-4 w-4" />
      </Button>
      {icon}
      <h2 className="font-display text-xl font-semibold">{title}</h2>
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
