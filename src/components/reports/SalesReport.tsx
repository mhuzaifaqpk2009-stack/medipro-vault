import { useMemo, useState } from "react";
import { Printer, CalendarDays, TrendingUp, Users2, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useProjectStore } from "@/store/project-store";
import { money, useCurrencySymbol } from "@/lib/format";
import { printHtml } from "@/lib/receipt";
import type { ProjectData, Sale } from "@/domain/schema";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export interface DayRow { date: string; day: number; sale: number; profit: number; profitKnown: boolean }
export interface MonthGroup { key: string; year: number; month: number; label: string; days: DayRow[]; sale: number; profit: number; profitKnown: boolean }

type HistoricalCost = { date: string; price: number; purchaseId: string };
function buildCostHistory(data: ProjectData) {
  const map = new Map<string, HistoricalCost[]>();
  for (const p of data.purchases) for (const item of p.items) {
    const price = Number(item.purchasePrice);
    if (!item.medicineId || !Number.isFinite(price)) continue;
    const list = map.get(item.medicineId) ?? [];
    list.push({ date: p.purchaseDate || "", price, purchaseId: p.id });
    map.set(item.medicineId, list);
  }
  for (const list of map.values()) list.sort((a, b) => b.date.localeCompare(a.date) || b.purchaseId.localeCompare(a.purchaseId));
  return map;
}

function historicalCostAtSale(s: Sale, medicineId: string, explicit: unknown, history: Map<string, HistoricalCost[]>) {
  const direct = Number(explicit);
  if (Number.isFinite(direct)) return direct;
  const candidate = history.get(medicineId)?.find((x) => !x.date || x.date <= s.date);
  return candidate?.price ?? null;
}

function saleTotals(s: Sale, history: Map<string, HistoricalCost[]>) {
  const gross = s.items.reduce((sum, it) => sum + it.salePrice * it.quantity * (1 - it.discountPercent / 100), 0);
  const withTax = gross + gross * ((s.taxPercent || 0) / 100);
  const net = Math.max(0, withTax - withTax * ((s.discount || 0) / 100));
  let cogs = 0;
  let profitKnown = true;
  for (const it of s.items) {
    const cost = historicalCostAtSale(s, it.medicineId, it.costPriceAtSale, history);
    if (cost == null) { profitKnown = false; continue; }
    cogs += cost * it.quantity;
  }
  return { net, profit: net - cogs, profitKnown };
}

export function buildSalesReport(data: ProjectData) {
  const history = buildCostHistory(data);
  const byDay = new Map<string, DayRow>();
  for (const s of data.sales) {
    if (s.status === "cancelled") continue;
    const key = s.date.slice(0, 10);
    const { net, profit, profitKnown } = saleTotals(s, history);
    const row = byDay.get(key) ?? { date: key, day: Number(key.slice(8, 10)), sale: 0, profit: 0, profitKnown: true };
    row.sale += net;
    row.profit += profit;
    row.profitKnown = row.profitKnown && profitKnown;
    byDay.set(key, row);
  }

  const months = new Map<string, MonthGroup>();
  for (const row of [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date))) {
    const mKey = row.date.slice(0, 7);
    const year = Number(mKey.slice(0, 4));
    const month = Number(mKey.slice(5, 7)) - 1;
    const g = months.get(mKey) ?? { key: mKey, year, month, label: `${MONTHS[month]} ${year}`, days: [], sale: 0, profit: 0, profitKnown: true };
    g.days.push(row);
    g.sale += row.sale;
    g.profit += row.profit;
    g.profitKnown = g.profitKnown && row.profitKnown;
    months.set(mKey, g);
  }

  const monthList = [...months.values()].sort((a, b) => b.key.localeCompare(a.key));
  const years = new Map<number, { year: number; sale: number; profit: number; profitKnown: boolean; months: MonthGroup[] }>();
  for (const g of monthList) {
    const y = years.get(g.year) ?? { year: g.year, sale: 0, profit: 0, profitKnown: true, months: [] };
    y.sale += g.sale;
    y.profit += g.profit;
    y.profitKnown = y.profitKnown && g.profitKnown;
    y.months.push(g);
    years.set(g.year, y);
  }
  const yearList = [...years.values()].sort((a, b) => b.year - a.year);

  const visits = new Map<string, number>();
  const spend = new Map<string, number>();
  for (const s of data.sales) {
    if (!s.customerId) continue;
    visits.set(s.customerId, (visits.get(s.customerId) ?? 0) + 1);
    spend.set(s.customerId, (spend.get(s.customerId) ?? 0) + saleTotals(s, history).net);
  }
  let topCustomer: { name: string; visits: number; spend: number } | null = null;
  for (const [id, n] of visits) {
    const c = data.customers.find((x) => x.id === id);
    if (!c) continue;
    if (!topCustomer || n > topCustomer.visits) topCustomer = { name: c.name, visits: n, spend: spend.get(id) ?? 0 };
  }

  const suppliers = data.suppliers.map((sup) => {
    const purchases = data.purchases.filter((p) => p.supplierId === sup.id);
    const amount = purchases.reduce((sum, p) => sum + p.items.reduce((x, it) => x + it.purchasePrice * it.quantity, 0), 0);
    const last = purchases.map((p) => p.purchaseDate).sort().slice(-1)[0];
    return { id: sup.id, name: sup.name, orders: purchases.length, amount, last: last ? last.slice(0, 10) : "—", balance: sup.balance ?? 0 };
  }).sort((a, b) => b.amount - a.amount);

  return { months: monthList, years: yearList, totalCustomers: data.customers.length, topCustomer, suppliers };
}

type PrintKind = "daily" | "monthly" | "yearly" | "profit";

export function SalesReport() {
  const data = useProjectStore((s) => s.data!);
  const sym = useCurrencySymbol();
  const report = useMemo(() => buildSalesReport(data), [data]);
  const [printKind, setPrintKind] = useState<PrintKind>("monthly");
  function doPrint() { printHtml(buildReportHtml(report, printKind, sym, data.settings.pharmacyName)); }
  if (report.months.length === 0) return <div className="surface-card p-10 text-center text-sm text-muted-foreground">No sales recorded yet.</div>;
  const profitText = (value: number, known: boolean) => known ? money(value, sym) : "—";

  return <div className="grid gap-4">
    <div className="surface-card flex flex-wrap items-center gap-3 p-4"><Printer className="h-4 w-4 text-primary" /><span className="text-sm font-medium">Print report</span><Select value={printKind} onValueChange={(v) => setPrintKind(v as PrintKind)}><SelectTrigger className="h-9 w-48"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="daily">Daily report</SelectItem><SelectItem value="monthly">Monthly report</SelectItem><SelectItem value="yearly">Yearly report</SelectItem><SelectItem value="profit">Profit-only report</SelectItem></SelectContent></Select><Button size="sm" onClick={doPrint}><Printer className="mr-1.5 h-4 w-4" /> Print</Button></div>
    {report.months.map((m) => <section key={m.key} className="surface-card p-5"><div className="mb-3 flex items-center gap-2"><CalendarDays className="h-4 w-4 text-primary" /><h3 className="font-display text-base font-semibold">{m.label}</h3></div><div className="divide-y rounded-md border">{m.days.map((d) => <div key={d.date} className="flex items-center gap-3 px-3 py-2 text-sm"><span className="w-40 font-medium">{MONTHS[m.month]} {d.day}</span><span className="flex-1 tabular-nums">Sale: {money(d.sale, sym)}</span><span className="tabular-nums text-muted-foreground">Profit: {profitText(d.profit, d.profitKnown)}</span></div>)}</div><div className="mt-3 flex flex-wrap items-center justify-end gap-6 border-t pt-3 text-sm font-semibold"><span className="tabular-nums">Total sale: {money(m.sale, sym)}</span><span className="tabular-nums">Total profit: {profitText(m.profit, m.profitKnown)}</span></div></section>)}
    {report.years.map((y) => <section key={y.year} className="surface-card p-5"><div className="mb-3 flex items-center gap-2"><TrendingUp className="h-4 w-4 text-primary" /><h3 className="font-display text-base font-semibold">{y.year} summary</h3></div><div className="grid gap-3 sm:grid-cols-2"><div className="rounded-md border p-3"><p className="text-xs text-muted-foreground">Total sale ({y.year})</p><p className="mt-1 font-display text-xl font-bold tabular-nums">{money(y.sale, sym)}</p></div><div className="rounded-md border p-3"><p className="text-xs text-muted-foreground">Total profit ({y.year})</p><p className="mt-1 font-display text-xl font-bold tabular-nums">{profitText(y.profit, y.profitKnown)}</p></div></div><div className="mt-3 divide-y rounded-md border">{y.months.map((m) => <div key={m.key} className="flex items-center gap-3 px-3 py-2 text-sm"><span className="w-40 font-medium">{MONTHS[m.month]}</span><span className="flex-1 tabular-nums">Sale: {money(m.sale, sym)}</span><span className="tabular-nums text-muted-foreground">Profit: {profitText(m.profit, m.profitKnown)}</span></div>)}</div></section>)}
    <section className="surface-card p-5"><div className="mb-3 flex items-center gap-2"><Users2 className="h-4 w-4 text-primary" /><h3 className="font-display text-base font-semibold">Customers</h3></div><div className="grid gap-3 sm:grid-cols-2"><div className="rounded-md border p-3"><p className="text-xs text-muted-foreground">Total customers</p><p className="mt-1 font-display text-xl font-bold tabular-nums">{report.totalCustomers}</p></div><div className="rounded-md border p-3"><p className="text-xs text-muted-foreground">Most frequent customer</p><p className="mt-1 font-display text-lg font-bold">{report.topCustomer ? report.topCustomer.name : "—"}</p>{report.topCustomer && <p className="text-xs text-muted-foreground">{report.topCustomer.visits} visits · {money(report.topCustomer.spend, sym)}</p>}</div></div></section>
    <section className="surface-card p-5"><div className="mb-3 flex items-center gap-2"><Truck className="h-4 w-4 text-primary" /><h3 className="font-display text-base font-semibold">Suppliers</h3></div>{report.suppliers.length === 0 ? <p className="text-sm text-muted-foreground">No suppliers added yet.</p> : <div className="overflow-x-auto rounded-md border"><table className="w-full text-sm"><thead className="bg-muted/40 text-xs text-muted-foreground"><tr><th className="p-2 text-left">Supplier</th><th className="p-2 text-right">Orders</th><th className="p-2 text-right">Purchased</th><th className="p-2 text-right">Balance</th><th className="p-2 text-right">Last order</th></tr></thead><tbody>{report.suppliers.map((s) => <tr key={s.id} className="border-t"><td className="p-2">{s.name}</td><td className="p-2 text-right tabular-nums">{s.orders}</td><td className="p-2 text-right tabular-nums">{money(s.amount, sym)}</td><td className="p-2 text-right tabular-nums">{money(s.balance, sym)}</td><td className="p-2 text-right">{s.last}</td></tr>)}</tbody></table></div>}</section>
  </div>;
}

function esc(v: unknown) { return String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!)); }
function buildReportHtml(report: ReturnType<typeof buildSalesReport>, kind: PrintKind, sym: string, pharmacyName: string) {
  const m = (n: number) => `${sym}${n.toFixed(2)}`;
  const profit = (n: number, known: boolean) => known ? m(n) : "—";
  const title = { daily: "Daily Sales Report", monthly: "Monthly Sales Report", yearly: "Yearly Sales Report", profit: "Profit Report" }[kind];
  let body = "";
  if (kind === "daily") {
    for (const g of report.months) {
      body += `<h2>${esc(g.label)}</h2><table><thead><tr><th>Date</th><th>Sale</th><th>Profit</th></tr></thead><tbody>`;
      for (const d of g.days) body += `<tr><td>${esc(d.date)}</td><td class="r">${m(d.sale)}</td><td class="r">${profit(d.profit, d.profitKnown)}</td></tr>`;
      body += `</tbody><tfoot><tr><td>Total</td><td class="r">${m(g.sale)}</td><td class="r">${profit(g.profit, g.profitKnown)}</td></tr></tfoot></table>`;
    }
  } else if (kind === "monthly") {
    body += `<table><thead><tr><th>Month</th><th>Sale</th><th>Profit</th></tr></thead><tbody>`;
    for (const g of report.months) body += `<tr><td>${esc(g.label)}</td><td class="r">${m(g.sale)}</td><td class="r">${profit(g.profit, g.profitKnown)}</td></tr>`;
    body += `</tbody></table>`;
  } else if (kind === "yearly") {
    for (const y of report.years) {
      body += `<h2>${y.year}</h2><table><thead><tr><th>Month</th><th>Sale</th><th>Profit</th></tr></thead><tbody>`;
      for (const g of y.months) body += `<tr><td>${esc(g.label)}</td><td class="r">${m(g.sale)}</td><td class="r">${profit(g.profit, g.profitKnown)}</td></tr>`;
      body += `</tbody><tfoot><tr><td>Year total</td><td class="r">${m(y.sale)}</td><td class="r">${profit(y.profit, y.profitKnown)}</td></tr></tfoot></table>`;
    }
  } else {
    body += `<table><thead><tr><th>Period</th><th>Profit</th></tr></thead><tbody>`;
    for (const g of report.months) body += `<tr><td>${esc(g.label)}</td><td class="r">${profit(g.profit, g.profitKnown)}</td></tr>`;
    for (const y of report.years) body += `<tr class="tot"><td>${y.year} total</td><td class="r">${profit(y.profit, y.profitKnown)}</td></tr>`;
    body += `</tbody></table>`;
  }
  if (kind !== "profit") {
    body += `<h2>Customers</h2><p>Total customers: <strong>${report.totalCustomers}</strong></p>`;
    if (report.topCustomer) body += `<p>Most frequent: <strong>${esc(report.topCustomer.name)}</strong> (${report.topCustomer.visits} visits, ${m(report.topCustomer.spend)})</p>`;
    if (report.suppliers.length) {
      body += `<h2>Suppliers</h2><table><thead><tr><th>Supplier</th><th>Orders</th><th>Purchased</th><th>Last order</th></tr></thead><tbody>`;
      for (const s of report.suppliers) body += `<tr><td>${esc(s.name)}</td><td class="r">${s.orders}</td><td class="r">${m(s.amount)}</td><td class="r">${esc(s.last)}</td></tr>`;
      body += `</tbody></table>`;
    }
  }
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>body { font-family: Arial, Helvetica, sans-serif; padding: 24px; color: #111; } h1 { font-size: 20px; margin: 0 0 2px; } .sub { color: #555; font-size: 12px; margin-bottom: 16px; } h2 { font-size: 14px; margin: 18px 0 6px; } table { width: 100%; border-collapse: collapse; font-size: 12px; } th, td { border: 1px solid #ccc; padding: 5px 7px; text-align: left; } th { background: #f1f5f5; } .r { text-align: right; } tfoot td, tr.tot td { font-weight: bold; background: #f8fafa; } p { font-size: 12px; }</style></head><body><h1>${esc(pharmacyName || "Pharmacy")}</h1><div class="sub">${esc(title)} — generated ${new Date().toLocaleString()}</div>${body}</body></html>`;
}
