import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Settings as SettingsIcon, Save, Plus, Trash2, Pencil,
  Users as UsersIcon, ShieldCheck, AlertTriangle, RotateCcw,
  HardDriveDownload, HardDriveUpload, FolderOpen, Keyboard,
} from "lucide-react";
import { useProjectStore } from "@/store/project-store";
import { useSession } from "@/store/session-store";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { AdminGate } from "@/components/PermissionGate";
import { TABS, effectiveHotkey } from "@/routes/app";
import { comboFromEvent } from "@/lib/hotkeys";
import { pickBackupFolder, writeBackup, readBackupFile } from "@/lib/local-store";
import { restoreFromBytes } from "@/store/project-store";
import { decodeProject, WrongPasswordError } from "@/lib/project-codec";
import { askPassword } from "@/components/PasswordPromptDialog";
import {
  readInstall, createUser, upsertUser, removeUser, hashPassword,
  clearInstall,
} from "@/lib/install";
import {
  defaultPermissions,
  type StoredUser, type UserPermissions,
} from "@/lib/users";

export const Route = createFileRoute("/app/settings")({
  component: () => <AdminGate><SettingsPage /></AdminGate>,
});

const PERM_LABELS: { key: keyof UserPermissions; label: string }[] = [
  { key: "sales", label: "Access Sales (POS) panel" },
  { key: "bills", label: "Access Bills panel" },
  { key: "medicines", label: "Access Medicines page" },
  { key: "inventory", label: "Access Inventory page" },
  { key: "purchases", label: "Access Purchases page" },
  { key: "reports", label: "Access Reports page" },
  { key: "suppliers", label: "Access Suppliers page" },
  { key: "customers", label: "Access Customers page" },
  { key: "categories", label: "Access Categories page" },
  { key: "applyDiscount", label: "Apply discount at checkout" },
  { key: "changeTax", label: "Change tax at checkout" },
  { key: "forceSale", label: "Force-sell out-of-stock items" },
];

function SettingsPage() {
  const navigate = useNavigate();
  const data = useProjectStore((s) => s.data)!;
  const mutate = useProjectStore((s) => s.mutate);
  const save = useProjectStore((s) => s.save);
  const s = data.settings;
  const currentUser = useSession((st) => st.user);
  const setSessionUser = useSession((st) => st.setUser);

  const [usersTick, setUsersTick] = useState(0);
  const users = readInstall()?.users ?? [];
  const [editing, setEditing] = useState<StoredUser | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [resetPw, setResetPw] = useState("");
  const [capturing, setCapturing] = useState<string | null>(null);
  const [backupBusy, setBackupBusy] = useState(false);
  const [showReset, setShowReset] = useState(false);

  const set = <K extends keyof typeof s>(key: K, value: (typeof s)[K]) =>
    mutate((d) => { (d.settings as any)[key] = value; });

  // Capture the next key press as the shortcut for the selected tab.
  useEffect(() => {
    if (!capturing) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setCapturing(null); return; }
      const combo = comboFromEvent(e);
      if (!combo) return;
      e.preventDefault();
      e.stopPropagation();
      mutate((d) => {
        d.settings.tabHotkeys = { ...(d.settings.tabHotkeys ?? {}), [capturing]: combo };
      });
      setCapturing(null);
      toast.success(`Shortcut set to ${combo}`);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [capturing, mutate]);

  async function doBackupNow(folderOverride?: string) {
    setBackupBusy(true);
    try {
      const bytes = await useProjectStore.getState().exportBytes();
      if (!bytes) { toast.error("Nothing to back up"); return; }
      let folder = folderOverride ?? s.autoBackupFolder ?? null;
      const picked = folderOverride ? folderOverride : await pickBackupFolder();
      if (picked) folder = picked;
      const written = await writeBackup(bytes, s.pharmacyName || data.meta.name, folder);
      if (!written) return;
      toast.success(`Backup saved: ${written}`);
    } catch (e: any) {
      toast.error(e?.message ?? "Backup failed");
    } finally {
      setBackupBusy(false);
    }
  }

  async function doLoadBackup() {
    if (!window.confirm("Load a backup file? This replaces all current data on this computer.")) return;
    setBackupBusy(true);
    try {
      const bytes = await readBackupFile();
      if (!bytes) return;
      try {
        await restoreFromBytes(bytes);
      } catch (e) {
        if (e instanceof WrongPasswordError) {
          const pw = await askPassword("Enter password", "This backup file is locked. Enter its password.");
          if (!pw) return;
          await restoreFromBytes(bytes, pw);
        } else {
          throw e;
        }
      }
      await decodeProject(bytes).catch(() => null);
      toast.success("Data restored from backup");
    } catch (e: any) {
      toast.error(e?.message ?? "Could not load backup");
    } finally {
      setBackupBusy(false);
    }
  }

  async function chooseAutoBackupFolder() {
    const folder = await pickBackupFolder();
    if (!folder) {
      toast.error("Choosing a folder is only available in the desktop app");
      return;
    }
    set("autoBackupFolder", folder);
    toast.success("Backup location updated");
  }

  async function toggleAutoBackup(v: boolean) {
    if (!v) { set("autoBackupEnabled", false); return; }
    let folder = s.autoBackupFolder;
    if (!folder) {
      const picked = await pickBackupFolder();
      if (!picked) {
        toast.error("Choose a backup folder to enable auto backup");
        return;
      }
      folder = picked;
    }
    mutate((d) => {
      d.settings.autoBackupFolder = folder;
      d.settings.autoBackupEnabled = true;
    });
    toast.success("Auto backup enabled");
  }

  async function doResetSetup() {
    if (resetPw !== "resetpassword") { toast.error("Wrong reset password"); return; }
    if (!window.confirm("Reset the entire pharmacy setup? All local accounts on this computer will be removed. Your data file on disk is not deleted.")) return;
    clearInstall();
    useProjectStore.getState().close();
    useSession.getState().clear();
    setShowReset(false);
    toast.success("Setup reset");
    navigate({ to: "/" });
  }

  function clearBillHistory() {
    if (!window.confirm("Are you sure you want to delete all bill history? This cannot be undone.")) return;
    if (!window.confirm("This will permanently remove ALL sales/invoices. Continue?")) return;
    mutate((d) => { d.sales = []; });
    toast.success("Bill history cleared");
  }

  return (
    <div className="mx-auto max-w-4xl p-6 md:p-10">
      <header className="mb-6 flex items-center gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-primary to-primary-glow text-primary-foreground shadow-soft">
          <SettingsIcon className="h-5 w-5" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Settings</h1>
          <p className="text-sm text-muted-foreground">
            Admin-only. Manage pharmacy details, users, and workspace behaviour.
          </p>
        </div>
        <Button className="ml-auto" onClick={async () => (await save()) && toast.success("Saved")}>
          <Save className="mr-2 h-4 w-4" /> Save now
        </Button>
      </header>

      {/* Users */}
      <section className="surface-card p-6">
        <div className="mb-4 flex items-center gap-2">
          <UsersIcon className="h-4 w-4 text-primary" />
          <h2 className="font-display text-base font-semibold">Users</h2>
          <Button size="sm" className="ml-auto" onClick={() => setShowNew(true)}>
            <Plus className="mr-1.5 h-4 w-4" /> Add user
          </Button>
        </div>
        <p className="mb-4 text-xs text-muted-foreground">
          Each user signs in with their own username & password. Admins have full access;
          other users get only the toggles you set below.
        </p>
        <div className="divide-y rounded-md border">
          {users.map((u) => (
            <div key={u.id} className="flex items-center gap-3 p-3">
              <div className={`grid h-8 w-8 place-items-center rounded-full ${u.role === "admin" ? "bg-primary/15 text-primary" : "bg-muted"}`}>
                {u.role === "admin" ? <ShieldCheck className="h-4 w-4" /> : <UsersIcon className="h-4 w-4" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{u.username}</p>
                <p className="text-xs text-muted-foreground capitalize">{u.role}</p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => setEditing(u)}>
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                size="sm" variant="ghost"
                disabled={u.role === "admin" && users.filter((x) => x.role === "admin").length === 1}
                onClick={() => {
                  if (u.id === currentUser?.id) { toast.error("You cannot remove your own account"); return; }
                  if (!window.confirm(`Remove user "${u.username}"?`)) return;
                  removeUser(u.id);
                  setUsersTick((n) => n + 1);
                  toast.success("User removed");
                }}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
          {users.length === 0 && (
            <div className="p-6 text-center text-sm text-muted-foreground">No users yet.</div>
          )}
        </div>
        <p className="mt-3 text-[11px] text-muted-foreground">Tick users: {usersTick}</p>
      </section>

      {/* Pharmacy details */}
      <section className="surface-card mt-4 p-6">
        <h2 className="font-display text-base font-semibold">Pharmacy details</h2>
        <p className="mb-4 text-xs text-muted-foreground">Appears on receipts and printed invoices.</p>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Pharmacy name"><Input value={s.pharmacyName} onChange={(e) => set("pharmacyName", e.target.value)} /></Field>
          <Field label="Owner name"><Input value={s.ownerName} onChange={(e) => set("ownerName", e.target.value)} /></Field>
          <Field label="Phone"><Input value={s.phone} onChange={(e) => set("phone", e.target.value)} /></Field>
          <Field label="Email"><Input value={s.email} onChange={(e) => set("email", e.target.value)} /></Field>
          <Field label="Address" className="md:col-span-2"><Input value={s.address} onChange={(e) => set("address", e.target.value)} /></Field>
        </div>
      </section>

      <section className="surface-card mt-4 p-6">
        <h2 className="font-display text-base font-semibold">Billing</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <Field label="Tax % (applied automatically to every sale)"><Input type="number" value={s.taxPercent || ""} onChange={(e) => set("taxPercent", Number(e.target.value) || 0)} /></Field>
          <Field label="Currency code"><Input value={s.currency} onChange={(e) => set("currency", e.target.value)} /></Field>
          <Field label="Currency symbol"><Input value={s.currencySymbol} onChange={(e) => set("currencySymbol", e.target.value)} /></Field>
          <Field label="Default max discount % (used when a user has no per-user override; 0 = unlimited)" className="md:col-span-3">
            <Input
              type="number"
              value={s.maxDiscount || ""}
              onChange={(e) => set("maxDiscount", Number(e.target.value) || 0)}
              placeholder="e.g. 50"
            />
          </Field>
        </div>
      </section>

      <section className="surface-card mt-4 p-6">
        <h2 className="font-display text-base font-semibold">Printed bill</h2>
        <p className="mb-4 text-xs text-muted-foreground">
          Header is fixed to "Jalal & Brothers Pharmacy". Address & phone come from Pharmacy details.
        </p>
        <div className="grid gap-4">
          <Field label="Footer line 1 (thank-you message, max ~60 words)">
            <Input value={s.billFooter1} onChange={(e) => set("billFooter1", e.target.value.split(/\s+/).slice(0, 60).join(" "))} placeholder="Thanks for purchasing" />
          </Field>
          <Field label="Footer line 2 (return / exchange policy)">
            <Input value={s.billFooter2} onChange={(e) => set("billFooter2", e.target.value)} />
          </Field>
          <div>
            <Button size="sm" variant="secondary" onClick={async () => (await save()) && toast.success("Settings saved")}>
              <Save className="mr-2 h-4 w-4" /> Save settings
            </Button>
          </div>
        </div>
      </section>

      <section className="surface-card mt-4 p-6">
        <h2 className="font-display text-base font-semibold">Auto save</h2>
        <div className="mt-4 flex flex-wrap items-center gap-6">
          <label className="flex items-center gap-3">
            <Switch checked={s.autoSaveEnabled} onCheckedChange={(v) => set("autoSaveEnabled", v)} />
            <span className="text-sm font-medium">Enable auto save</span>
          </label>
          <div className="flex items-center gap-2">
            <Label className="text-sm">Interval</Label>
            <Select value={String(s.autoSaveIntervalMinutes)} onValueChange={(v) => set("autoSaveIntervalMinutes", Number(v) as typeof s.autoSaveIntervalMinutes)}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>{[1, 2, 5, 10, 15].map((n) => <SelectItem key={n} value={String(n)}>{n} minute{n === 1 ? "" : "s"}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
      </section>

      {/* Backup & data */}
      <section className="surface-card mt-4 p-6">
        <div className="mb-4 flex items-center gap-2">
          <HardDriveDownload className="h-4 w-4 text-primary" />
          <h2 className="font-display text-base font-semibold">Backup & data</h2>
        </div>
        <p className="mb-4 text-xs text-muted-foreground">
          Your data lives inside the application (Ctrl+S saves it). A backup file is portable —
          copy it to another computer and load it there.
        </p>
        <div className="grid gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3">
            <div>
              <p className="text-sm font-medium">Create backup</p>
              <p className="text-xs text-muted-foreground">Choose a folder and save a portable backup file.</p>
            </div>
            <Button size="sm" onClick={doBackupNow} disabled={backupBusy}>
              <HardDriveDownload className="mr-1.5 h-4 w-4" /> Backup now
            </Button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3">
            <div>
              <p className="text-sm font-medium">Load data</p>
              <p className="text-xs text-muted-foreground">Restore everything from a backup file. Replaces current data.</p>
            </div>
            <Button size="sm" variant="outline" onClick={doLoadBackup} disabled={backupBusy}>
              <HardDriveUpload className="mr-1.5 h-4 w-4" /> Load data
            </Button>
          </div>

          <div className="rounded-md border p-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <label className="flex items-center gap-3">
                <Switch checked={!!s.autoBackupEnabled} onCheckedChange={toggleAutoBackup} />
                <span className="text-sm font-medium">Auto backup</span>
              </label>
              <div className="flex items-center gap-2">
                <Label className="text-sm">Every</Label>
                <Select
                  value={String(s.autoBackupIntervalHours ?? 24)}
                  onValueChange={(v) => set("autoBackupIntervalHours", Number(v))}
                >
                  <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[1, 6, 12, 24, 48, 72, 168].map((h) => (
                      <SelectItem key={h} value={String(h)}>
                        {h < 24 ? `${h} hour${h === 1 ? "" : "s"}` : `${h / 24} day${h === 24 ? "" : "s"}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <span className="text-xs text-muted-foreground">
                Folder: {s.autoBackupFolder ? <span className="font-medium text-foreground">{s.autoBackupFolder}</span> : "not set"}
              </span>
              <Button size="sm" variant="outline" onClick={chooseAutoBackupFolder}>
                <FolderOpen className="mr-1.5 h-4 w-4" /> Change location
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Shortcuts */}
      <section className="surface-card mt-4 p-6">
        <div className="mb-4 flex items-center gap-2">
          <Keyboard className="h-4 w-4 text-primary" />
          <h2 className="font-display text-base font-semibold">Keyboard shortcuts</h2>
        </div>
        <label className="flex items-center gap-3">
          <Switch
            checked={s.tabShortcutsEnabled !== false}
            onCheckedChange={(v) => set("tabShortcutsEnabled", v)}
          />
          <span className="text-sm font-medium">Tab shortcuts</span>
        </label>

        <div className="mt-4 grid gap-2 rounded-md border p-3 sm:grid-cols-2">
          {TABS.map((t, i) => {
            const combo = effectiveHotkey(t.to, i, s.tabHotkeys);
            const isCapturing = capturing === t.to;
            return (
              <div key={t.to} className="flex items-center gap-2">
                <span className="flex-1 text-sm">{t.label}</span>
                <Button
                  size="sm"
                  variant={isCapturing ? "default" : "outline"}
                  className="w-40 justify-center font-mono text-xs"
                  onClick={() => setCapturing(isCapturing ? null : t.to)}
                >
                  {isCapturing ? "Press key…" : combo || "Not set"}
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  title="Reset to default"
                  onClick={() => mutate((d) => {
                    const map = { ...(d.settings.tabHotkeys ?? {}) };
                    delete map[t.to];
                    d.settings.tabHotkeys = map;
                  })}
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </Button>
              </div>
            );
          })}
        </div>
      </section>

      {/* Danger zone */}
      <section className="surface-card mt-4 border-destructive/40 p-6">
        <div className="mb-4 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-destructive" />
          <h2 className="font-display text-base font-semibold text-destructive">Danger zone</h2>
        </div>

        <div className="grid gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3">
            <div>
              <p className="text-sm font-medium">Clear all bill history</p>
              <p className="text-xs text-muted-foreground">Permanently deletes every sale/invoice from this project.</p>
            </div>
            <Button variant="destructive" size="sm" onClick={clearBillHistory}>
              <Trash2 className="mr-1.5 h-4 w-4" /> Clear bill history
            </Button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3">
            <div>
              <p className="text-sm font-medium">Reset pharmacy setup</p>
              <p className="text-xs text-muted-foreground">Requires admin password. Returns to first-time setup. Data file on disk is not deleted.</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => { setResetPw(""); setShowReset(true); }}>
              <RotateCcw className="mr-1.5 h-4 w-4" /> Reset setup
            </Button>
          </div>
        </div>
      </section>

      {showNew && (
        <UserDialog
          onClose={() => setShowNew(false)}
          onSaved={() => { setShowNew(false); setUsersTick((n) => n + 1); }}
        />
      )}
      {editing && (
        <UserDialog
          existing={editing}
          onClose={() => setEditing(null)}
          onSaved={(u) => {
            setEditing(null);
            setUsersTick((n) => n + 1);
            if (u && u.id === currentUser?.id) setSessionUser(u);
          }}
        />
      )}

      <Dialog open={showReset} onOpenChange={(o) => !o && setShowReset(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm reset password</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <p className="text-sm text-muted-foreground">
              Enter the reset password to remove all local accounts on this computer and return to
              the welcome screen. The data file on disk is not deleted.
            </p>
            <Input
              type="password"
              autoFocus
              value={resetPw}
              onChange={(e) => setResetPw(e.target.value)}
              placeholder="Reset password"
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowReset(false)}>Cancel</Button>
            <Button variant="destructive" onClick={doResetSetup} disabled={!resetPw}>
              Reset setup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function UserDialog({
  existing, onClose, onSaved,
}: {
  existing?: StoredUser;
  onClose: () => void;
  onSaved: (u?: StoredUser) => void;
}) {
  const [username, setUsername] = useState(existing?.username ?? "");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"admin" | "user">(existing?.role ?? "user");
  const [perms, setPerms] = useState<UserPermissions>(existing?.permissions ?? defaultPermissions("user"));
  const [userMaxDiscount, setUserMaxDiscount] = useState<number>(existing?.maxDiscount ?? 0);

  async function submit() {
    if (!username.trim()) { toast.error("Username required"); return; }
    if (!existing && password.length < 4) { toast.error("Password must be at least 4 characters"); return; }

    if (existing) {
      let saltHex = existing.saltHex, hashHex = existing.hashHex;
      if (password) {
        const h = await hashPassword(password);
        saltHex = h.saltHex; hashHex = h.hashHex;
      }
      const updated: StoredUser = {
        ...existing,
        username: username.trim(),
        role,
        saltHex, hashHex,
        permissions: role === "admin" ? defaultPermissions("admin") : perms,
        maxDiscount: role !== "admin" && perms.applyDiscount ? (userMaxDiscount || 0) : undefined,
      };
      upsertUser(updated);
      toast.success("User updated");
      onSaved(updated);
    } else {
      const u = await createUser({ username, password, role, permissions: role === "admin" ? undefined : perms });
      if (role !== "admin" && perms.applyDiscount && userMaxDiscount > 0) {
        u.maxDiscount = userMaxDiscount;
      }
      upsertUser(u);
      toast.success("User created");
      onSaved(u);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{existing ? "Edit user" : "Add user"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <Field label="Username"><Input value={username} onChange={(e) => setUsername(e.target.value)} /></Field>
          <Field label={existing ? "New password (leave blank to keep current)" : "Password"}>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
          <Field label="Role">
            <Select value={role} onValueChange={(v) => setRole(v as "admin" | "user")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="user">User (limited)</SelectItem>
                <SelectItem value="admin">Admin (full access)</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          {role !== "admin" && (
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">Permissions</p>
              <div className="grid gap-2 rounded-md border p-3">
                {PERM_LABELS.map(({ key, label }) => (
                  <label key={key} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={perms[key]}
                      onCheckedChange={(v) => setPerms((p) => ({ ...p, [key]: v === true }))}
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
              {perms.applyDiscount && (
                <div className="mt-3">
                  <Field label="Max discount % for this user (0 = unlimited)">
                    <Input
                      type="number"
                      value={userMaxDiscount || ""}
                      onChange={(e) => setUserMaxDiscount(Number(e.target.value) || 0)}
                      placeholder="e.g. 20"
                    />
                  </Field>
                </div>
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={submit}>{existing ? "Save changes" : "Create user"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
