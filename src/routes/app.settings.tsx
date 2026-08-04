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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { QUICK_ACTIONS, effectiveActionHotkey } from "@/lib/quick-actions";
import { AdminGate } from "@/components/PermissionGate";

import { PasswordInput } from "@/components/PasswordInput";
import { ResetSetupDialog } from "@/components/ResetSetupDialog";
import { effectiveHotkey } from "@/routes/app";
import { visibleNavItems } from "@/lib/nav";

import { comboFromEvent } from "@/lib/hotkeys";
import { pickBackupFolder, readBackupFile } from "@/lib/local-store";
import { runBackupNow } from "@/lib/backup";
import { restoreFromBytes } from "@/store/project-store";
import { WrongPasswordError } from "@/lib/project-codec";
import { askPassword } from "@/components/PasswordPromptDialog";
import {
  readInstall, createUser, upsertUser, removeUser, hashPassword,
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
  { key: "forceSale", label: "Force-sell out-of-stock items" },
  { key: "pinPanel", label: "Use the bottom pinned panel" },

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
  
  const [capturing, setCapturing] = useState<string | null>(null);
  const [capturingAction, setCapturingAction] = useState<string | null>(null);

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

  // Same, for quick-action shortcuts (new medicine / purchase / customer / supplier).
  useEffect(() => {
    if (!capturingAction) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setCapturingAction(null); return; }
      const combo = comboFromEvent(e);
      if (!combo) return;
      e.preventDefault();
      e.stopPropagation();
      mutate((d) => {
        d.settings.actionHotkeys = { ...(d.settings.actionHotkeys ?? {}), [capturingAction]: combo };
      });
      setCapturingAction(null);
      toast.success(`Shortcut set to ${combo}`);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [capturingAction, mutate]);


  async function doBackupNow(chooseFolder = false) {
    setBackupBusy(true);
    try {
      const written = await runBackupNow({ chooseFolder });
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
      toast.success("Data restored from backup");
      // Reload so every page/panel re-reads the restored data from scratch.
      sessionStorage.setItem("medicore.resume", "1");
      setTimeout(() => window.location.reload(), 400);
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

      <Tabs defaultValue="users">
        <TabsList className="mb-4 flex flex-wrap">
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="general">Pharmacy & billing</TabsTrigger>
          <TabsTrigger value="workspace">Workspace</TabsTrigger>
          <TabsTrigger value="data">Backup & data</TabsTrigger>
          <TabsTrigger value="shortcuts">Shortcuts</TabsTrigger>
          <TabsTrigger value="danger">Danger zone</TabsTrigger>
        </TabsList>
        <TabsContent value="users">
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

        </TabsContent>
        <TabsContent value="general">
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
            />
          </Field>
        </div>
      </section>

      <section className="surface-card mt-4 p-6">
        <h2 className="font-display text-base font-semibold">Printed bill</h2>
        <div className="mt-4 grid gap-4">
          <Field label="Footer line 1 (thank-you message, max ~60 words)">
            <Input value={s.billFooter1} onChange={(e) => set("billFooter1", e.target.value.split(/\s+/).slice(0, 60).join(" "))} />
          </Field>
          <Field label="Footer line 2 (return / exchange policy)">
            <Input value={s.billFooter2} onChange={(e) => set("billFooter2", e.target.value)} />
          </Field>
        </div>
      </section>

        </TabsContent>
        <TabsContent value="workspace">
      <section className="surface-card mt-4 p-6">
        <h2 className="font-display text-base font-semibold">Pinned bottom panel</h2>
        <div className="mt-4 flex flex-wrap items-center gap-6">
          <label className="flex items-center gap-3">
            <Switch
              checked={!s.pinPanelHidden}
              onCheckedChange={(v) => set("pinPanelHidden", !v)}
            />
            <span className="text-sm font-medium">Show pinned panel</span>
          </label>
          <Button
            size="sm"
            variant="outline"
            onClick={() => { mutate((d) => { d.settings.pinnedItems = []; }); toast.success("Pins cleared"); }}
          >
            <Trash2 className="mr-1.5 h-4 w-4" /> Clear pins ({(s.pinnedItems ?? []).length})
          </Button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Right-click any sidebar tab, dashboard counter or quick action and choose “Pin” to keep it in the bottom panel.
        </p>
      </section>

      <section className="surface-card mt-4 p-6">
        <h2 className="font-display text-base font-semibold">Calculator</h2>
        <label className="mt-4 flex items-center gap-3">
          <Switch
            checked={s.calculatorEnabled !== false}
            onCheckedChange={(v) => set("calculatorEnabled", v)}
          />
          <span className="text-sm font-medium">Show the calculator tab in the sidebar</span>
        </label>
        <p className="mt-2 text-xs text-muted-foreground">
          Its keyboard shortcut can be changed under Shortcuts.
        </p>
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

        </TabsContent>
        <TabsContent value="data">
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
              <p className="text-sm font-medium">Create backup (F5)</p>
              <p className="text-xs text-muted-foreground">
                {s.autoBackupFolder
                  ? `Saves to ${s.autoBackupFolder} and overwrites the previous backup.`
                  : "Choose a folder once — later backups reuse it automatically."}
              </p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => void doBackupNow(false)} disabled={backupBusy}>
                <HardDriveDownload className="mr-1.5 h-4 w-4" /> Backup now
              </Button>
              <Button size="sm" variant="outline" onClick={() => void doBackupNow(true)} disabled={backupBusy}>
                <FolderOpen className="mr-1.5 h-4 w-4" /> Change location
              </Button>
            </div>
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

          <div className="rounded-md border p-3">
            <label className="flex items-center gap-3">
              <Switch
                checked={!!s.backupPasswordEnabled}
                onCheckedChange={(v) => set("backupPasswordEnabled", v)}
              />
              <span className="text-sm font-medium">Password protect backup files</span>
            </label>
            <p className="mt-2 text-xs text-muted-foreground">
              Backups are encrypted with this password. Loading such a backup — on this or any other
              computer — asks for it first.
            </p>
            {s.backupPasswordEnabled && (
              <div className="mt-3 max-w-sm">
                <Field label="Backup password">
                  <PasswordInput
                    value={s.backupPassword ?? ""}
                    onChange={(e) => set("backupPassword", e.target.value)}
                  />
                </Field>
              </div>
            )}
          </div>
        </div>
      </section>

        </TabsContent>
        <TabsContent value="shortcuts">
      <section className="surface-card mt-4 p-6">
        <div className="mb-4 flex items-center gap-2">
          <Keyboard className="h-4 w-4 text-primary" />
          <h2 className="font-display text-base font-semibold">Keyboard shortcuts</h2>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-3">
            <Switch
              checked={s.tabShortcutsEnabled !== false}
              onCheckedChange={(v) => set("tabShortcutsEnabled", v)}
            />
            <span className="text-sm font-medium">Tab shortcuts</span>
          </label>
          <Button
            size="sm" variant="outline" className="ml-auto"
            onClick={() => {
              mutate((d) => { d.settings.tabHotkeys = {}; });
              toast.success("Shortcuts restored to defaults");
            }}
          >
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Set defaults
          </Button>
        </div>

        <div className="mt-4 grid gap-2 rounded-md border p-3 sm:grid-cols-2">
          {visibleNavItems(s, currentUser).map((t, i) => {
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

          <section className="surface-card mt-4 p-6">
            <h2 className="font-display text-base font-semibold">Quick action shortcuts</h2>
            <p className="mb-3 text-sm text-muted-foreground">Open a create panel from anywhere.</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {QUICK_ACTIONS.map((a) => (
                <div key={a.id} className="flex items-center justify-between rounded-md border px-3 py-2">
                  <span className="text-sm">{a.label}</span>
                  <Button
                    size="sm"
                    variant={capturingAction === a.id ? "default" : "outline"}
                    className="font-mono text-xs"
                    onClick={() => setCapturingAction(a.id)}
                  >
                    {capturingAction === a.id ? "Press keys…" : effectiveActionHotkey(a.id, s.actionHotkeys)}
                  </Button>
                </div>
              ))}
            </div>
          </section>
        </TabsContent>
        <TabsContent value="danger">
          <section className="surface-card mt-4 p-6">
            <h2 className="font-display text-base font-semibold">Invoice counter</h2>
            <p className="mb-3 text-sm text-muted-foreground">
              Next invoice #: <span className="font-mono">{s.invoiceCounter ?? 1000}</span> — resetting keeps all bills.
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                if (!window.confirm("Reset the invoice counter back to 1000? Bills are kept.")) return;
                mutate((d) => { d.settings.invoiceCounter = 1000; });
                toast.success("Invoice counter reset to 1000");
              }}
            >
              Reset invoice counter
            </Button>
          </section>
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
            <Button variant="outline" size="sm" onClick={() => setShowReset(true)}>
              <RotateCcw className="mr-1.5 h-4 w-4" /> Reset setup
            </Button>
          </div>
        </div>
      </section>
        </TabsContent>
      </Tabs>

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

      <ResetSetupDialog
        open={showReset}
        onOpenChange={setShowReset}
        onDone={() => navigate({ to: "/" })}
      />
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
            <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} />
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
