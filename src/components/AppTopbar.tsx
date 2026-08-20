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
import { useExpiryAlerts } from "@/hooks/use-expiry-alerts";
import { WorkspaceTopControls } from "@/components/WorkspaceTopControls";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const HELP_SECTIONS = [
  { title: "What's New", items: [
    ["v1.0.2 — Workspace controls", "Undo and Redo are now fixed directly in the top bar beside the workspace search. Maximize is also a top-bar control and F2 toggles the current panel into a distraction-free workspace."],
    ["v1.0.2 — Excel-style keyboard navigation", "Press Alt to reveal numbered KeyTips on the sidebar. Press the number to open a section, then use the next set of KeyTips to activate controls, tabs and actions without a mouse. Escape closes KeyTips."],
    ["v1.0.2 — Workflow intelligence", "Workflow Engine now persists progress, records history, supports custom workflows and can surface the next useful pharmacy action."],
    ["v1.0.2 — Pharmacy operations", "Purchases are organized into Simple Purchase and Purchase Cycle, while Inventory is separated into Overview, Reorder, Expiry & Batches, Dead Stock and Reconciliation."],
    ["v1.0.2 — Smart alerts", "Expiry, low-stock, supplier payable, message, workflow and operational notifications are now part of the expanded notification system."],
  ]},
  { title: "Getting started", items: [
    ["First-time setup", "Create the pharmacy profile and first admin account. Keep the admin password safe because it controls users, data and security settings."],
    ["Dashboard", "The dashboard shows live KPIs, low stock and expiry counts, most-sold medicines and the Sales / Profit / Purchase trend chart."],
    ["Save status", "The Saved / Unsaved indicator shows pending project changes. Admins can use Save or Ctrl+S. Non-admin accounts can auto-save permitted changes."],
    ["Single Computer", "Use Single Computer when one Windows PC owns and uses the pharmacy data. No LAN connection is required."],
    ["Multi Computer", "Use Server on the computer that owns the project and Client on other computers. Clients discover the Server on the local network and authenticate before accessing data."],
  ]},
  { title: "Medicines & inventory", items: [
    ["Add medicine", "Open Medicines → Add Medicine and enter name, generic, company, category, barcode, batch, pricing, stock, expiry and supplier information."],
    ["Barcode scanning", "A USB barcode scanner normally behaves like a keyboard. Scan a medicine barcode in Sell or the supported barcode field to find the matching medicine quickly."],
    ["Search", "Medicine search can use Name, Generic or Company. Use the barcode when you need an exact product match."],
    ["Stock and low-stock", "Minimum stock controls the low-stock warning. Stock changes from purchases, sales, returns and stock adjustments are reflected in the dashboard and reports."],
    ["Expiry and batches", "Batch and expiry information helps identify medicines that are close to expiry or already expired. Operations also supports batch / FEFO workflows where enabled."],
    ["Inventory report", "Reports → All reports → Inventory / stock can be filtered by year, date, search text and status, with pagination for large histories."],
  ]},
  { title: "Sales / POS", items: [
    ["Make a sale", "Open Sell, scan or search medicines, set quantities, review discounts/tax/payments and complete the bill. Completed sales become part of the permanent sales history."],
    ["Walk-in or customer sale", "A sale can be linked to a customer or left as Walk-in customer. Customer-linked sales make customer history and reporting more useful."],
    ["Discounts", "Discount access is permission-controlled. User-specific maximum discounts can be configured under Settings → Users."],
    ["Force Sale", "Force Sale allows an authorized user to sell when available stock is insufficient. The event is recorded and can generate an admin notification."],
    ["Checkout price change", "If enabled, an authorized user can change the selling price for the current sale. The change is tracked separately from the medicine's normal price."],
    ["Returns", "Sale returns are recorded against the original sale where supported. Returns appear in the unified report explorer so historical activity can be found by date or reference."],
  ]},
  { title: "Purchases & suppliers", items: [
    ["New purchase", "Open Purchases, choose the supplier, enter invoice information and add medicines with quantities, purchase prices, batches and expiry dates."],
    ["Purchase history", "Purchases are never limited to the latest month. Reports → All reports → Purchases lets you search old invoices by year, date, supplier, status or free text."],
    ["Supplier reports", "Use the Supplier filter to see purchases and supplier-related activity for one supplier. Supplier ledger entries can also be reported by date."],
    ["Purchase returns", "Purchase returns are kept separately and can be found under Reports → Returns or by searching the purchase reference."],
  ]},
  { title: "Customers & ledgers", items: [
    ["Customer records", "Customers stores contact details, balance, loyalty points and optional special discount information."],
    ["Customer sales history", "Reports → Sales can be filtered by customer / party and date range to find exactly when a customer purchased something."],
    ["Customer ledger", "Reports → Customer ledger shows dated sale, payment, return and adjustment entries recorded for customers."],
    ["Supplier ledger", "Reports → Supplier ledger shows dated purchase, payment, return and adjustment entries for suppliers."],
  ]},
  { title: "Prescriptions", items: [
    ["Create a prescription", "Enter patient, phone, doctor, diagnosis and medicines with quantity, dosage, frequency, duration and instructions."],
    ["Follow-up schedule", "Set a next visit date, repeat interval and notification lead time. Due today / due soon notifications are generated when enabled."],
    ["Prescription privacy", "Prescriptions can be Admin only, visible to all permitted users, or restricted to selected users. Admin retains access."],
    ["Load to sale", "Authorized users can load a prescription into Sell. The scheduled visit can advance according to its repeat settings."],
    ["Stock readiness", "Prescription views flag medicines that are missing or below the required quantity."],
  ]},
  { title: "Reports — finding old data", items: [
    ["Report Explorer", "Reports opens on All reports. This is the main historical search screen and works across the complete project history rather than only the current month or year."],
    ["Report types", "Choose All activity, Sales, Purchases, Profit, Customers, Suppliers, Inventory / stock, Returns, Customer ledger or Supplier ledger."],
    ["Exact dates", "Use From and To for a precise day or date range. A one-day range is ideal when investigating a particular day's sales or purchases."],
    ["Year filter", "The Year selector is built from the years present in the data, so older years remain available even when the project contains many years of history."],
    ["Search", "Free-text search matches invoice/reference, customer, supplier, medicine names, notes/details, status and date."],
    ["Party and status", "Use Party to isolate one customer or supplier. Status narrows results such as completed, cancelled, returned, low stock and ledger entry types."],
    ["Trend chart shortcut", "Click any bar or point on the dashboard trend. Sales opens that period's Sales report, Purchases opens Purchases, and Profit opens Profit for the same period."],
    ["Large histories", "Results are paginated at 50 records per page. Use filters before browsing to keep a multi-year pharmacy history fast and easy to navigate."],
    ["Export / print", "Export CSV for Excel or further analysis. Print creates a clean report table for filing or sharing."],
  ]},
  { title: "Notifications", items: [
    ["Notification settings", "Settings → Notifications contains the full event catalog plus quick controls for common alerts such as medicine add/delete, force sale and large sale."],
    ["Search notification events", "Use the notification search field to quickly find a specific event instead of scrolling through the full catalog."],
    ["Notification permissions", "A user needs notification access to see the notification bell. Individual event preferences determine which events are generated."],
    ["Prescription alerts", "Due today, due soon, visit loaded and prescription stock alerts can be enabled in the Notifications tab."],
  ]},
  { title: "Settings", items: [
    ["Users", "Create users, change passwords, select role templates and configure panel/action permissions. Admins have full access."],
    ["Pharmacy & billing", "Configure pharmacy identity, currency, tax, discount limits, checkout price changes and printed bill text."],
    ["Workspace", "Configure medicine search defaults, pinned panel visibility, calculator and auto-save settings."],
    ["Computer mode", "Server / Client / Single Computer deployment is configured here. Notification controls are now kept in the Notifications tab."],
    ["Backup & data", "Create backups, change backup location, restore data and optionally password-protect backup files."],
    ["Shortcuts", "Configure navigation shortcuts and quick-action shortcuts. Use the reset button on a shortcut to return that item to its default."],
    ["Danger zone", "Invoice counter reset keeps bills. Clearing bill history permanently removes sales and invoices, so always make a backup first."],
  ]},
  { title: "Backup & security", items: [
    ["Manual backup", "Use Backup in the top bar or Settings → Backup & data. Keep important backups on a separate drive or secure location."],
    ["Auto backup", "Enable Auto backup, choose a folder and set the interval. The application can reuse the selected folder for later backups."],
    ["Password-protected backups", "When enabled, the backup file is protected by the configured backup password. Keep that password separate from the backup file."],
    ["Multi-computer security", "LAN discovery only locates the Server. Access still requires an authenticated session and the server only accepts private-network clients."],
    ["Before resetting", "Back up the project before resetting setup or clearing history. These actions can affect access or permanently remove data."],
  ]},
  { title: "Keyboard & workflow tips", items: [
    ["Alt KeyTips", "Press Alt once to show numbered KeyTips on the sidebar. Press a number to open that section; the next KeyTips expose the current panel's controls. Press Escape to close KeyTips."],
    ["F2", "Maximize the current panel. F2 again returns to the normal workspace."],
    ["Ctrl+Z / Ctrl+Y", "Undo and Redo pharmacy project changes. The same actions are available as buttons in the top bar."],
    ["Ctrl+S", "Save the current project when you have permission to save."],
    ["Ctrl+Esc", "Sign out of the current session."],
    ["F5", "Create a backup using the configured backup location."],
    ["Quick actions", "Configured quick-action shortcuts can open common create panels without leaving the current workflow."],
    ["Pinned actions", "Right-click supported actions and counters to pin them to the bottom panel for faster access."],
  ]},
  { title: "Troubleshooting", items: [
    ["Unsaved changes", "If the Saved badge does not appear, use Save. Admin changes are intentionally not silently discarded."],
    ["Client cannot connect", "Confirm both PCs are on the same private LAN, the Server is running, Windows Firewall permits the application, and the Server is in Server mode."],
    ["Old report not found", "Open Reports → All reports, choose the correct report type, select the Year or From/To range, then search the invoice, medicine, customer or supplier name."],
    ["Backup restore", "Restoring replaces current project data. Make a fresh backup first if the current data is important."],
    ["Printer issue", "Check the selected Windows printer and permissions. Printer failures can also appear in the notification center when that event is enabled."],
  ]},
] as const;

export function AppTopbar() {
  const navigate = useNavigate(); const data = useProjectStore((s) => s.data); const dirty = useProjectStore((s) => s.dirty); const save = useProjectStore((s) => s.save); const mutate = useProjectStore((s) => s.mutate); const user = useSession((s) => s.user); const isAdmin = user?.role === "admin"; const canViewNotifications = isAdmin || user?.permissions.viewNotifications === true; const [isDark, setIsDark] = useState(false); const [helpOpen, setHelpOpen] = useState(false); const [helpQuery, setHelpQuery] = useState("");
  useAdminNotifications();
  useExpiryAlerts();
  useEffect(() => { setIsDark(document.documentElement.classList.contains("dark")); }, []);
  useEffect(() => { const onKey = async (e: KeyboardEvent) => { if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== "s") return; e.preventDefault(); const ok = await save(); if (ok) toast.success("Saved"); else toast.error("Save failed"); }; window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey); }, [save]);
  const timerRef = useRef<number | null>(null); useEffect(() => { if (isAdmin || !dirty) return; if (timerRef.current) window.clearTimeout(timerRef.current); timerRef.current = window.setTimeout(() => { void useProjectStore.getState().save(); }, 800); return () => { if (timerRef.current) window.clearTimeout(timerRef.current); }; }, [dirty, isAdmin]);
  async function goHome() { const choice = await confirmUnsaved(); if (choice === "cancel") return; useSession.getState().clear(); navigate({ to: "/" }); }
  useEffect(() => { const onKey = async (e: KeyboardEvent) => { if (!(e.ctrlKey || e.metaKey) || e.key !== "Escape") return; e.preventDefault(); e.stopPropagation(); await goHome(); }; window.addEventListener("keydown", onKey, true); return () => window.removeEventListener("keydown", onKey, true); });
  function toggleTheme() { const next = !isDark; setIsDark(next); document.documentElement.classList.toggle("dark", next); localStorage.setItem("medicore.theme", next ? "dark" : "light"); }
  const height = Math.min(96, Math.max(44, data?.settings.topbarHeight ?? 56));
  const query = helpQuery.trim().toLowerCase();
  const filteredHelp = HELP_SECTIONS.map((section) => ({ ...section, items: section.items.filter(([title, text]) => !query || `${title} ${text}`.toLowerCase().includes(query)) })).filter((section) => section.items.length > 0);
  return <div className="sticky top-0 z-30"><header className="flex items-center gap-2 border-b bg-background/85 px-3 backdrop-blur" style={{ height }}><SidebarTrigger /><Separator orientation="vertical" className="mx-1 h-6" /><div className="flex min-w-0 items-center gap-2"><img src="./logo.png" alt="" className="h-6 w-6 object-contain" draggable={false} /><span className="truncate font-display text-sm font-semibold">{data?.meta.name ?? "Huzaifa Software"}</span><DirtyBadge /></div><div className="ml-auto flex items-center gap-2"><MedicineSearch /><WorkspaceTopControls />{canViewNotifications && <NotificationBell />}<Button variant="ghost" size="icon" onClick={() => { setHelpQuery(""); setHelpOpen(true); }} title="HPMS Help"><CircleHelp className="h-4 w-4" /></Button><Button variant="ghost" size="icon" onClick={toggleTheme} title="Toggle theme">{isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}</Button>{isAdmin && <><Button variant="ghost" size="sm" {...pinContext({ id: "cmd:save", label: "Save", kind: "cmd" })} onClick={async () => { const ok = await save(); if (ok) toast.success("Saved"); }} title="Save (Ctrl+S) · right-click to pin"><Save className="mr-1.5 h-4 w-4" /> Save</Button><Button variant="ghost" size="sm" {...pinContext({ id: "cmd:backup", label: "Backup", kind: "cmd" })} onClick={async () => { try { const written = await runBackupNow(); if (written) toast.success(`Backup saved: ${written}`); } catch (e: any) { toast.error(e?.message ?? "Backup failed"); } }} title="Create backup (F5) · right-click to pin"><HardDriveDownload className="mr-1.5 h-4 w-4" /> Backup</Button><Separator orientation="vertical" className="mx-1 h-6" /></>}<Button variant="outline" size="sm" onClick={goHome}><Home className="mr-1.5 h-4 w-4" /> Sign out</Button></div></header><ResizeHandle orientation="horizontal" value={height} min={44} max={96} onChange={(v) => mutate((d) => { d.settings.topbarHeight = v; })} />
    <Dialog open={helpOpen} onOpenChange={setHelpOpen}><DialogContent className="max-w-6xl max-h-[92vh] overflow-hidden p-0"><DialogHeader className="border-b px-7 py-6 text-left"><DialogTitle className="flex items-center gap-2 text-xl"><CircleHelp className="h-5 w-5" /> HPMS Help Center</DialogTitle><DialogDescription>Detailed guidance for the pharmacy workflow, reports, settings, backups, permissions and troubleshooting.</DialogDescription><div className="relative pt-3"><Search className="pointer-events-none absolute left-3 top-[22px] h-4 w-4 text-muted-foreground" /><input value={helpQuery} onChange={(e) => setHelpQuery(e.target.value)} placeholder="Search help topics, e.g. old sales, barcode, supplier, backup, force sale…" className="h-11 w-full rounded-md border bg-background pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring" /></div></DialogHeader><div className="max-h-[calc(92vh-190px)] overflow-y-auto px-7 py-6"><div className="grid gap-7 md:grid-cols-2">{filteredHelp.length ? filteredHelp.map((section) => <section key={section.title}><h3 className="mb-3 text-base font-semibold">{section.title}</h3><div className="space-y-3">{section.items.map(([title, text]) => <div key={title} className="rounded-lg border bg-background p-4 shadow-sm"><div className="text-sm font-semibold">{title}</div><p className="mt-1.5 text-sm leading-6 text-muted-foreground">{text}</p></div>)}</div></section>) : <div className="col-span-full py-14 text-center text-sm text-muted-foreground">No help topics match “{helpQuery}”. Try “reports”, “sales”, “backup” or “settings”.</div>}</div></div></DialogContent></Dialog>
  </div>;
}
