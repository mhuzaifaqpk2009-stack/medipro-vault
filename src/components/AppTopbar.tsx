import { useNavigate } from "@tanstack/react-router";
import { Save, Home, Sun, Moon, HardDriveDownload, CircleHelp, Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { DirtyBadge } from "@/components/DirtyBadge";
import { MedicineSearch } from "@/components/MedicineSearch";
import { ResizeHandle } from "@/components/ResizeHandle";
import { pinContext } from "@/lib/pins";
import { runBackupNow } from "@/lib/backup";
import { useProjectStore } from "@/store/project-store";
import { confirmUnsaved } from "@/hooks/use-unsaved-guard";
import { useAdminNotifications } from "@/hooks/use-admin-notifications";
import { useSession } from "@/store/session-store";
import { NotificationBell } from "@/components/NotificationBell";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const HELP_SECTIONS = [
  { title: "Getting Started", items: [
    ["First-time setup", "Create your pharmacy profile and first admin account during the initial setup. Keep your admin credentials secure."],
    ["Single Computer", "Use Single Computer when the pharmacy data is stored and used on one PC. No network connection is required."],
    ["Multi Computer", "Choose Server on the computer that owns the project and Client on computers that connect to that Server."],
    ["Client connection", "Clients can connect by entering the Server IP or by using Cable / Auto Discover when the Server is available on the local network."],
  ]},
  { title: "Medicines", items: [
    ["Add a medicine", "Open Medicines, click Add Medicine, enter the medicine details, stock and pricing, then save."],
    ["Edit or delete a medicine", "Open Medicines, find the item with search, then use its edit or delete action. Your account must have the required permission."],
    ["Search medicines", "Use the Medicines search and choose Name, Generic, or Company to find medicines without loading the whole database into the UI."],
    ["MRP and pricing", "MRP is the maximum retail price. Selling price is the normal checkout price. Checkout price changes are controlled by the permissions and settings."],
  ]},
  { title: "Sales / POS", items: [
    ["Make a sale", "Open Sell, search or scan medicines, choose quantities, review the bill and complete the sale."],
    ["Discount", "Use the discount control when your user account has permission to apply discounts."],
    ["Force Sale", "Force Sale allows an authorized user to complete a sale when available stock is insufficient. It is recorded for audit and admin notification."],
    ["Change item price", "If enabled in Admin Settings and allowed for your user, use the item price control at checkout to change the selling price for that sale."],
  ]},
  { title: "Purchases", items: [
    ["New purchase", "Open Purchases, create a purchase, enter supplier/invoice and item details, then save. If Print on Save is enabled, the purchase prints after saving."],
    ["Find an invoice", "Use the purchase search field to search purchase records by invoice number."],
    ["Print or reprint", "A saved purchase can be printed again from its available print/reprint action."],
  ]},
  { title: "Customers, Suppliers & Categories", items: [
    ["Customers", "Use Customers to add, edit, search and manage customer records when your account has permission."],
    ["Suppliers", "Use Suppliers to add, edit, search and manage supplier records when your account has permission."],
    ["Categories", "Use Categories to organize medicines. Add, edit or delete categories only when your account allows it."],
  ]},
  { title: "Users & Permissions", items: [
    ["Admin", "Admin has access to management and security settings, including user management and project administration."],
    ["Manager", "Manager permissions depend on the configured role and can be customized where supported."],
    ["Seller", "Seller permissions can include medicine access, discounts, Force Sale and checkout price changes depending on settings."],
    ["Custom", "Custom users are configured by panel. Enable a panel first, then choose its permitted actions such as Add, Edit and Delete."],
  ]},
  { title: "Reports & Notifications", items: [
    ["Reports", "Open Reports to review sales, purchases, stock, profit and other available business information."],
    ["Notifications", "Admins can receive important activity notifications such as Force Sale and medicine additions when notifications are enabled."],
  ]},
  { title: "Backup & Security", items: [
    ["Backup", "Admins can use Backup to create a project backup. Keep backups in a secure location and test important backups before relying on them."],
    ["Encryption password", "Project and backup encryption passwords should not be shared. Use the password required by HPMS when encrypting or restoring protected data."],
    ["Multi Computer security", "Clients authenticate with the Server. Discovery only finds the Server; it does not grant access to pharmacy data."],
  ]},
  { title: "Settings & Tips", items: [
    ["Settings", "Use Settings to configure pharmacy behavior, users, notifications, checkout permissions, computer mode and other available options."],
    ["Save status", "The Unsaved/Saved indicator shows whether HPMS has pending project changes. You can also use the Save button or Ctrl+S where available."],
    ["Sign out", "Sign out returns to the login screen without deleting the user account or pharmacy project."],
  ]},
] as const;

export function AppTopbar() {
  const navigate = useNavigate(); const data = useProjectStore((s) => s.data); const dirty = useProjectStore((s) => s.dirty); const save = useProjectStore((s) => s.save); const mutate = useProjectStore((s) => s.mutate); const user = useSession((s) => s.user); const isAdmin = user?.role === "admin"; const [isDark, setIsDark] = useState(false); const [helpOpen, setHelpOpen] = useState(false); const [helpQuery, setHelpQuery] = useState("");
  useAdminNotifications();
  useEffect(() => { setIsDark(document.documentElement.classList.contains("dark")); }, []);
  useEffect(() => { const onKey = async (e: KeyboardEvent) => { if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== "s") return; e.preventDefault(); const ok = await save(); if (ok) toast.success("Saved"); else toast.error("Save failed"); }; window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey); }, [save]);
  const timerRef = useRef<number | null>(null); useEffect(() => { if (isAdmin || !dirty) return; if (timerRef.current) window.clearTimeout(timerRef.current); timerRef.current = window.setTimeout(() => { void useProjectStore.getState().save(); }, 800); return () => { if (timerRef.current) window.clearTimeout(timerRef.current); }; }, [dirty, isAdmin]);
  async function goHome() { const choice = await confirmUnsaved(); if (choice === "cancel") return; useSession.getState().clear(); navigate({ to: "/" }); }
  function toggleTheme() { const next = !isDark; setIsDark(next); document.documentElement.classList.toggle("dark", next); localStorage.setItem("medicore.theme", next ? "dark" : "light"); }
  const height = Math.min(96, Math.max(44, data?.settings.topbarHeight ?? 56));
  const query = helpQuery.trim().toLowerCase();
  const filteredHelp = HELP_SECTIONS.map((section) => ({ ...section, items: section.items.filter(([title, text]) => !query || `${title} ${text}`.toLowerCase().includes(query)) })).filter((section) => section.items.length > 0);
  return <div className="sticky top-0 z-30"><header className="flex items-center gap-2 border-b bg-background/85 px-3 backdrop-blur" style={{ height }}><SidebarTrigger /><Separator orientation="vertical" className="mx-1 h-6" /><div className="flex min-w-0 items-center gap-2"><img src="./logo.png" alt="" className="h-6 w-6 object-contain" draggable={false} /><span className="truncate font-display text-sm font-semibold">{data?.meta.name ?? "Huzaifa Software"}</span><DirtyBadge /></div><div className="ml-auto flex items-center gap-2"><MedicineSearch />{isAdmin && <NotificationBell />}<Button variant="ghost" size="icon" onClick={() => { setHelpQuery(""); setHelpOpen(true); }} title="HPMS Help"><CircleHelp className="h-4 w-4" /></Button><Button variant="ghost" size="icon" onClick={toggleTheme} title="Toggle theme">{isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}</Button>{isAdmin && <><Button variant="ghost" size="sm" {...pinContext({ id: "cmd:save", label: "Save", kind: "cmd" })} onClick={async () => { const ok = await save(); if (ok) toast.success("Saved"); }} title="Save (Ctrl+S) · right-click to pin"><Save className="mr-1.5 h-4 w-4" /> Save</Button><Button variant="ghost" size="sm" {...pinContext({ id: "cmd:backup", label: "Backup", kind: "cmd" })} onClick={async () => { try { const written = await runBackupNow(); if (written) toast.success(`Backup saved: ${written}`); } catch (e: any) { toast.error(e?.message ?? "Backup failed"); } }} title="Create backup (F5) · right-click to pin"><HardDriveDownload className="mr-1.5 h-4 w-4" /> Backup</Button><Separator orientation="vertical" className="mx-1 h-6" /></>}<Button variant="outline" size="sm" onClick={goHome}><Home className="mr-1.5 h-4 w-4" /> Sign out</Button></div></header><ResizeHandle orientation="horizontal" value={height} min={44} max={96} onChange={(v) => mutate((d) => { d.settings.topbarHeight = v; })} />
    <Dialog open={helpOpen} onOpenChange={setHelpOpen}><DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden p-0"><DialogHeader className="border-b px-6 py-5 text-left"><DialogTitle className="flex items-center gap-2"><CircleHelp className="h-5 w-5" /> HPMS Help</DialogTitle><DialogDescription>Learn how to use HPMS features and complete common tasks.</DialogDescription><div className="relative pt-2"><Search className="pointer-events-none absolute left-3 top-[18px] h-4 w-4 text-muted-foreground" /><input value={helpQuery} onChange={(e) => setHelpQuery(e.target.value)} placeholder="Search help..." className="h-10 w-full rounded-md border bg-background pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring" /></div></DialogHeader><div className="max-h-[calc(85vh-170px)] overflow-y-auto px-6 py-5"><div className="space-y-6">{filteredHelp.length ? filteredHelp.map((section) => <section key={section.title}><h3 className="mb-3 text-sm font-semibold">{section.title}</h3><div className="space-y-3">{section.items.map(([title, text]) => <div key={title} className="rounded-lg border p-3"><div className="text-sm font-medium">{title}</div><p className="mt-1 text-sm text-muted-foreground">{text}</p></div>)}</div></section>) : <div className="py-10 text-center text-sm text-muted-foreground">No help topics match “{helpQuery}”.</div>}</div></div></DialogContent></Dialog>
  </div>;
}
