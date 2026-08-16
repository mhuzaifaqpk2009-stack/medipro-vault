import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { BarChart3, Download, FileText, BellRing } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useProjectStore } from "@/store/project-store";
import { money, useCurrencySymbol } from "@/lib/format";
import { PermissionGate } from "@/components/PermissionGate";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SalesReport, buildSalesReport } from "@/components/reports/SalesReport";
import { StaffSalesReport } from "@/components/reports/StaffSalesReport";
import { ReportExplorer, type ReportKind } from "@/components/reports/ReportExplorer";
import { currentUser } from "@/store/session-store";
import { canExportReports, canPrintReports } from "@/lib/granular-permissions";
import { isPrescriptionDue, isPrescriptionDueSoon, isPrescriptionVisible } from "@/lib/prescriptions";

export type ReportSearch = { kind: ReportKind; from: string; to: string; q: string };
const REPORT_KINDS: ReportKind[] = ["all", "sales", "purchases", "profit", "customers", "suppliers", "inventory", "returns", "customer-ledger", "supplier-ledger"];

export const Route = createFileRoute("/app/reports")({
  validateSearch: (search: Record<string, unknown>): ReportSearch => ({
    kind: REPORT_KINDS.includes(search.kind as ReportKind) ? (search.kind as ReportKind) : "all",
    from: typeof search.from === "string" ? search.from : "",
    to: typeof search.to === "string" ? search.to : "",
    q: typeof search.q === "string" ? search.q : "",
  }),
  component: () => <PermissionGate perm="reports"><ReportsPage /></PermissionGate>,
});

function ReportsPage() {
  const data = useProjectStore((s) => s.data!);
  const sym = useCurrencySymbol();
  const user = currentUser();
  const canExport = canExportReports(user);
  const canPrint = canPrintReports(user);
  const search = Route.useSearch();
  const stats = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10), monthPrefix = today.slice(0, 7);
    let todaySales = 0, monthSales = 0, allSales = 0, forcedSales = 0, forcedUnits = 0;
    for (const s of data.sales) {
      if (s.status === "cancelled") continue;
      const total = s.items.reduce((sum, it) => sum + it.salePrice * it.quantity * (1 - it.discountPercent / 100), 0);
      allSales += total;
      const dstr = s.date.slice(0, 10);
      if (dstr === today) todaySales += total;
      if (dstr.startsWith(monthPrefix)) monthSales += total;
      for (const it of s.items) if (it.forcedSale) { forcedSales++; forcedUnits += it.quantity; }
    }
    const report = buildSalesReport(data);
    const allProfit = report.years.reduce((sum, y) => sum + y.profit, 0);
    const profitKnown = report.years.every((y) => y.profitKnown);
    return { todaySales, monthSales, allSales, profit: allProfit, profitKnown, forcedSales, forcedUnits };
  }, [data]);
  const prescriptionReport = useMemo(() => {
    const list = (data.settings.prescriptions ?? []).filter((p) => isPrescriptionVisible(p, user));
    const dueToday = list.filter((p) => isPrescriptionDue(p));
    const upcoming = list.filter((p) => isPrescriptionDueSoon(p));
    const outOfStock = list.filter((p) => p.items.some((x) => { const m = data.medicines.find((med) => med.id === x.medicineId); return !m || m.stockQuantity < x.quantity; }));
    return { list, dueToday, upcoming, outOfStock };
  }, [data, user]);

  function exportCSV(rows: any[], headers: string[], filename: string) {
    const escape = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const body = rows.map((r) => headers.map((h) => escape(r[h])).join(",")).join("\n");
    const blob = new Blob([headers.join(",") + "\n" + body], { type: "text/csv" });
    const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
  }

  return <div className="mx-auto max-w-7xl p-6 md:p-8">
    <header className="mb-5 flex items-center gap-3"><div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-primary to-primary-glow text-primary-foreground shadow-soft"><BarChart3 className="h-5 w-5" /></div><div><h1 className="font-display text-2xl font-bold">Reports</h1><p className="text-sm text-muted-foreground">Search the complete pharmacy history by date, year, sale, purchase, customer, supplier and more.</p></div>{canPrint && <Button className="ml-auto" variant="outline" onClick={() => window.print()}><FileText className="mr-1.5 h-4 w-4" />Print</Button>}</header>
    <Tabs defaultValue="explorer"><TabsList className="mb-4 flex flex-wrap"><TabsTrigger value="explorer">All reports</TabsTrigger><TabsTrigger value="overview">Overview</TabsTrigger><TabsTrigger value="sales">Sales detail</TabsTrigger><TabsTrigger value="staff">Staff Sales</TabsTrigger><TabsTrigger value="prescriptions">Prescriptions</TabsTrigger></TabsList>
      <TabsContent value="explorer"><ReportExplorer initialKind={search.kind} initialFrom={search.from} initialTo={search.to} initialQuery={search.q} /></TabsContent>
      <TabsContent value="sales"><SalesReport /></TabsContent><TabsContent value="staff"><StaffSalesReport /></TabsContent>
      <TabsContent value="overview"><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6"><Card k="Today's sales" v={money(stats.todaySales, sym)} /><Card k="Monthly sales" v={money(stats.monthSales, sym)} /><Card k="Total sales" v={money(stats.allSales, sym)} /><Card k="Estimated profit" v={stats.profitKnown ? money(stats.profit, sym) : "—"} /><Card k="Force-sale transactions" v={String(stats.forcedSales)} /><Card k="Force-sold units" v={String(stats.forcedUnits)} /></div>
        {canExport && <div className="mt-6 grid gap-3 sm:grid-cols-3"><Button variant="outline" onClick={() => exportCSV(data.medicines.map((m) => ({ Name: m.name, Batch: m.batchNumber, Stock: m.stockQuantity, Sale: m.salePrice, Expiry: m.expiryDate })), ["Name", "Batch", "Stock", "Sale", "Expiry"], "medicines.csv")}><Download className="mr-1.5 h-4 w-4" />Medicines CSV</Button><Button variant="outline" onClick={() => exportCSV(data.sales.map((s) => ({ Invoice: s.invoiceNumber, Date: s.date.slice(0, 10), Items: s.items.length, Total: s.items.reduce((x, i) => x + i.salePrice * i.quantity * (1 - i.discountPercent / 100), 0).toFixed(2), ForceSale: s.items.some((i) => i.forcedSale) ? "YES" : "NO" })), ["Invoice", "Date", "Items", "Total", "ForceSale"], "sales.csv")}><Download className="mr-1.5 h-4 w-4" />Sales CSV</Button><Button variant="outline" onClick={() => exportCSV(data.customers.map((c) => ({ Name: c.name, Phone: c.phone, Points: c.loyaltyPoints, Balance: c.balance })), ["Name", "Phone", "Points", "Balance"], "customers.csv")}><Download className="mr-1.5 h-4 w-4" />Customers CSV</Button></div>}
      </TabsContent>
      <TabsContent value="prescriptions"><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><Card k="Prescription records" v={String(prescriptionReport.list.length)} /><Card k="Due today" v={String(prescriptionReport.dueToday.length)} /><Card k="Follow-ups soon" v={String(prescriptionReport.upcoming.length)} /><Card k="Stock issues" v={String(prescriptionReport.outOfStock.length)} /></div><div className="mt-5 surface-card overflow-hidden"><div className="flex items-center justify-between border-b p-4"><div><h2 className="font-display font-semibold">Prescription follow-up report</h2><p className="text-xs text-muted-foreground">Only prescriptions visible to your account are included.</p></div>{canExport && <Button size="sm" variant="outline" onClick={() => exportCSV(prescriptionReport.list.map((p) => ({ Patient: p.patientName, Phone: p.patientPhone, Doctor: p.doctorName, Diagnosis: p.diagnosis, NextVisit: p.nextVisitDate, Medicines: p.items.length, StockStatus: prescriptionReport.outOfStock.some((x) => x.id === p.id) ? "OUT / LOW" : "READY" })), ["Patient","Phone","Doctor","Diagnosis","NextVisit","Medicines","StockStatus"], "prescriptions.csv")}><Download className="mr-1.5 h-4 w-4" />Export</Button>}</div><div className="overflow-auto"><table className="w-full text-sm"><thead className="bg-muted/30 text-xs text-muted-foreground"><tr><th className="p-3 text-left">Patient</th><th className="p-3 text-left">Doctor</th><th className="p-3 text-left">Next visit</th><th className="p-3 text-left">Medicines</th><th className="p-3 text-left">Stock</th><th className="p-3 text-left">Status</th></tr></thead><tbody>{prescriptionReport.list.map((p) => { const issue = prescriptionReport.outOfStock.some((x) => x.id === p.id); const due = isPrescriptionDue(p); const soon = isPrescriptionDueSoon(p); return <tr key={p.id} className="border-t"><td className="p-3 font-medium">{p.patientName}</td><td className="p-3">{p.doctorName ?? "—"}</td><td className="p-3">{p.nextVisitDate ?? "—"}</td><td className="p-3">{p.items.length}</td><td className={`p-3 ${issue ? "font-semibold text-destructive" : "text-muted-foreground"}`}>{issue ? "Out / low" : "Ready"}</td><td className="p-3">{due ? <span className="font-semibold text-destructive">Due today</span> : soon ? <span className="flex items-center gap-1 text-warning"><BellRing className="h-3.5 w-3.5" />Soon</span> : <span className="text-muted-foreground">Scheduled</span>}</td></tr>; })}</tbody></table>{prescriptionReport.list.length === 0 && <p className="p-8 text-center text-sm text-muted-foreground">No prescription records yet.</p>}</div></div></TabsContent>
    </Tabs></div>;
}
function Card({ k, v }: { k: string; v: string }) { return <div className="surface-card p-4"><p className="text-xs text-muted-foreground">{k}</p><p className="mt-2 font-display text-2xl font-bold tabular-nums">{v}</p></div>; }
