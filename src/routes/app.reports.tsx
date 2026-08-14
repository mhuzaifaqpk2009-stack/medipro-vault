import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { BarChart3, Download, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useProjectStore } from "@/store/project-store";
import { money, useCurrencySymbol } from "@/lib/format";
import { PermissionGate } from "@/components/PermissionGate";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SalesReport, buildSalesReport } from "@/components/reports/SalesReport";
import { StaffSalesReport } from "@/components/reports/StaffSalesReport";
import { currentUser } from "@/store/session-store";
import { canExportReports, canPrintReports } from "@/lib/granular-permissions";

export const Route = createFileRoute("/app/reports")({ component: () => <PermissionGate perm="reports"><ReportsPage /></PermissionGate> });

function ReportsPage() {
  const data = useProjectStore((s) => s.data!);
  const sym = useCurrencySymbol();
  const user = currentUser();
  const canExport = canExportReports(user);
  const canPrint = canPrintReports(user);
  const stats = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10), monthPrefix = today.slice(0, 7);
    let todaySales = 0, monthSales = 0, allSales = 0;
    for (const s of data.sales) {
      if (s.status === "cancelled") continue;
      const total = s.items.reduce((sum, it) => sum + it.salePrice * it.quantity * (1 - it.discountPercent / 100), 0);
      allSales += total;
      const dstr = s.date.slice(0, 10);
      if (dstr === today) todaySales += total;
      if (dstr.startsWith(monthPrefix)) monthSales += total;
    }
    const report = buildSalesReport(data);
    const profitRows = report.years;
    const allProfit = profitRows.reduce((sum, y) => sum + y.profit, 0);
    const profitKnown = profitRows.every((y) => y.profitKnown);
    return { todaySales, monthSales, allSales, profit: allProfit, profitKnown };
  }, [data]);

  function exportCSV(rows: any[], headers: string[], filename: string) {
    const escape = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const body = rows.map((r) => headers.map((h) => escape(r[h])).join(",")).join("\n");
    const blob = new Blob([headers.join(",") + "\n" + body], { type: "text/csv" });
    const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
  }

  return <div className="mx-auto max-w-6xl p-6 md:p-8">
    <header className="mb-5 flex items-center gap-3"><div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-primary to-primary-glow text-primary-foreground shadow-soft"><BarChart3 className="h-5 w-5" /></div><div><h1 className="font-display text-2xl font-bold">Reports</h1><p className="text-sm text-muted-foreground">Sales, profit, inventory exports and force-sale activity</p></div>{canPrint && <Button className="ml-auto" variant="outline" onClick={() => window.print()}><FileText className="mr-1.5 h-4 w-4" />Print</Button>}</header>
    <Tabs defaultValue="overview"><TabsList className="mb-4"><TabsTrigger value="overview">Overview</TabsTrigger><TabsTrigger value="sales">Sales</TabsTrigger><TabsTrigger value="staff">Staff Sales</TabsTrigger></TabsList>
      <TabsContent value="sales"><SalesReport /></TabsContent><TabsContent value="staff"><StaffSalesReport /></TabsContent>
      <TabsContent value="overview"><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5"><Card k="Today's sales" v={money(stats.todaySales, sym)} /><Card k="Monthly sales" v={money(stats.monthSales, sym)} /><Card k="Total sales" v={money(stats.allSales, sym)} /><Card k="Estimated profit" v={stats.profitKnown ? money(stats.profit, sym) : "—"} /><Card k="Profit status" v={stats.profitKnown ? "Historical cost available" : "Some historical cost unavailable"} /></div>
        {canExport && <div className="mt-6 grid gap-3 sm:grid-cols-3"><Button variant="outline" onClick={() => exportCSV(data.medicines.map((m) => ({ Name: m.name, Batch: m.batchNumber, Stock: m.stockQuantity, Sale: m.salePrice, Expiry: m.expiryDate })), ["Name", "Batch", "Stock", "Sale", "Expiry"], "medicines.csv")}><Download className="mr-1.5 h-4 w-4" />Medicines CSV</Button><Button variant="outline" onClick={() => exportCSV(data.sales.map((s) => ({ Invoice: s.invoiceNumber, Date: s.date.slice(0, 10), Items: s.items.length, Total: s.items.reduce((x, i) => x + i.salePrice * i.quantity * (1 - i.discountPercent / 100), 0).toFixed(2), ForceSale: s.items.some((i) => i.forcedSale) ? "YES" : "NO" })), ["Invoice", "Date", "Items", "Total", "ForceSale"], "sales.csv")}><Download className="mr-1.5 h-4 w-4" />Sales CSV</Button><Button variant="outline" onClick={() => exportCSV(data.customers.map((c) => ({ Name: c.name, Phone: c.phone, Points: c.loyaltyPoints, Balance: c.balance })), ["Name", "Phone", "Points", "Balance"], "customers.csv")}><Download className="mr-1.5 h-4 w-4" />Customers CSV</Button></div>}
      </TabsContent>
    </Tabs></div>;
}
function Card({ k, v }: { k: string; v: string }) { return <div className="surface-card p-4"><p className="text-xs text-muted-foreground">{k}</p><p className="mt-2 font-display text-2xl font-bold tabular-nums">{v}</p></div>; }
