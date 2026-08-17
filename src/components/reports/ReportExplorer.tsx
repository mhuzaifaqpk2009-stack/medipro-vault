import { useMemo, useState } from "react";
import { Download, Filter, Printer, Search, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useProjectStore } from "@/store/project-store";
import { dateKeyLocal, money, useCurrencySymbol } from "@/lib/format";
import { printHtml } from "@/lib/receipt";
import { saleProfit as saleProfitOf, saleTotal as saleTotalOf } from "@/lib/sale-math";
import type { ProjectData } from "@/domain/schema";
import { financeSummary } from "@/lib/finance-engine";

export type ReportKind = "all" | "sales" | "purchases" | "profit" | "customers" | "suppliers" | "inventory" | "returns" | "customer-ledger" | "supplier-ledger" | "expenses" | "p&l";

type ReportRow = {
  id: string;
  date: string;
  type: ReportKind;
  reference: string;
  party: string;
  details: string;
  amount: number;
  profit: number | null;
  status: string;
};

const KIND_LABELS: Record<ReportKind, string> = {
  all: "All activity",
  sales: "Sales",
  purchases: "Purchases",
  profit: "Profit",
  customers: "Customers",
  suppliers: "Suppliers",
  inventory: "Inventory / stock",
  returns: "Returns",
  "customer-ledger": "Customer ledger",
  "supplier-ledger": "Supplier ledger",
  expenses: "Expenses",
  "p&l": "Profit & Loss",
};

function dateKey(value?: string) { return value ? String(value).slice(0, 10) : ""; }
function escapeHtml(value: unknown) { return String(value ?? "").replace(/[&<>\"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[c]!)); }
function purchaseTotal(p: ProjectData["purchases"][number]) {
  return p.items.reduce((sum, item) => sum + Number(item.purchasePrice) * Number(item.quantity), 0);
}
function medicineNames(data: ProjectData, ids: string[]) {
  return ids.map((id) => data.medicines.find((m) => m.id === id)?.name ?? id).join(", ");
}
function endOfMonth(year: number, monthIndex: number) { return new Date(year, monthIndex + 1, 0).toISOString().slice(0, 10); }
function startOfWeek(date: Date) { const d = new Date(date); const day = d.getDay(); d.setDate(d.getDate() - (day === 0 ? 6 : day - 1)); return dateKeyLocal(d); }

function buildRows(data: ProjectData): ReportRow[] {
  const rows: ReportRow[] = [];
  const customers = new Map(data.customers.map((c) => [c.id, c.name]));
  const suppliers = new Map(data.suppliers.map((s) => [s.id, s.name]));

  for (const s of data.sales) {
    const total = saleTotalOf(s);
    rows.push({ id: `sale:${s.id}`, date: dateKey(s.date), type: "sales", reference: s.invoiceNumber, party: s.customerId ? (customers.get(s.customerId) ?? "Unknown customer") : "Walk-in customer", details: `${s.items.length} line${s.items.length === 1 ? "" : "s"} · ${medicineNames(data, s.items.map((x) => x.medicineId))}`, amount: total, profit: s.status === "cancelled" ? null : saleProfitOf(s, data.medicines), status: s.status });
  }
  for (const p of data.purchases) {
    rows.push({ id: `purchase:${p.id}`, date: dateKey(p.purchaseDate), type: "purchases", reference: p.invoiceNumber, party: suppliers.get(p.supplierId) ?? "Unknown supplier", details: `${p.items.length} line${p.items.length === 1 ? "" : "s"} · ${medicineNames(data, p.items.map((x) => x.medicineId))}`, amount: purchaseTotal(p), profit: null, status: "received" });
  }
  for (const r of data.settings.saleReturns ?? []) {
    rows.push({ id: `sale-return:${r.id}`, date: dateKey(r.date), type: "returns", reference: r.saleId, party: r.customerId ? (customers.get(r.customerId) ?? "Unknown customer") : "Walk-in customer", details: `Sale return · ${medicineNames(data, r.items.map((x) => x.medicineId))}`, amount: -r.items.reduce((a, x) => a + x.salePrice * x.quantity, 0), profit: null, status: "sale return" });
  }
  for (const r of data.settings.purchaseReturns ?? []) {
    rows.push({ id: `purchase-return:${r.id}`, date: dateKey(r.date), type: "returns", reference: r.purchaseId, party: r.supplierId ? (suppliers.get(r.supplierId) ?? "Unknown supplier") : "Unknown supplier", details: `Purchase return · ${medicineNames(data, r.items.map((x) => x.medicineId))}`, amount: -r.items.reduce((a, x) => a + x.purchasePrice * x.quantity, 0), profit: null, status: "purchase return" });
  }
  for (const a of data.stockAdjustments) {
    const m = data.medicines.find((x) => x.id === a.medicineId);
    rows.push({ id: `adjustment:${a.id}`, date: dateKey(a.date), type: "inventory", reference: a.id, party: m?.name ?? "Unknown medicine", details: `Stock adjustment · ${a.reason}`, amount: a.delta, profit: null, status: a.delta >= 0 ? "stock in" : "stock out" });
  }
  for (const c of data.customers) {
    rows.push({ id: `customer:${c.id}`, date: "", type: "customers", reference: c.id, party: c.name, details: [c.phone, c.email, c.address].filter(Boolean).join(" · ") || "Customer record", amount: c.balance ?? 0, profit: null, status: "customer" });
  }
  for (const s of data.suppliers) {
    rows.push({ id: `supplier:${s.id}`, date: "", type: "suppliers", reference: s.id, party: s.name, details: [s.company, s.phone, s.email].filter(Boolean).join(" · ") || "Supplier record", amount: s.balance ?? 0, profit: null, status: "supplier" });
  }
  for (const e of data.settings.customerLedger ?? []) {
    rows.push({ id: `customer-ledger:${e.id}`, date: dateKey(e.date), type: "customer-ledger", reference: e.reference ?? e.id, party: customers.get(e.customerId) ?? "Unknown customer", details: e.note || `Customer ${e.type}`, amount: e.amount, profit: null, status: e.type });
  }
  for (const e of data.settings.supplierLedger ?? []) {
    rows.push({ id: `supplier-ledger:${e.id}`, date: dateKey(e.date), type: "supplier-ledger", reference: e.reference ?? e.id, party: suppliers.get(e.supplierId) ?? "Unknown supplier", details: e.note || `Supplier ${e.type}`, amount: e.amount, profit: null, status: e.type });
  }
  for (const e of data.settings.expenses ?? []) { rows.push({ id:`expense:${e.id}`,date:dateKey(e.date),type:"expenses",reference:e.id,party:e.category,details:e.description||`Expense · ${e.paymentMethod}`,amount:e.amount,profit:null,status:"expense"}); }
  for (const m of data.medicines) {
    rows.push({ id: `medicine:${m.id}`, date: dateKey(m.expiryDate), type: "inventory", reference: m.barcode || m.id, party: m.name, details: `${m.genericName || ""}${m.genericName ? " · " : ""}${m.company || ""}${m.company ? " · " : ""}Stock ${m.stockQuantity} · Expiry ${dateKey(m.expiryDate) || "—"}`, amount: m.stockQuantity * Number(m.purchasePrice || 0), profit: null, status: m.stockQuantity <= (m.minimumStock ?? 0) ? "low stock" : "in stock" });
  }
  return rows.sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
}

function presetRange(preset: string) {
  const now = new Date();
  const today = dateKeyLocal(now);
  if (preset === "today") return [today, today] as const;
  if (preset === "yesterday") { const d = new Date(now); d.setDate(d.getDate() - 1); const k = dateKeyLocal(d); return [k, k] as const; }
  if (preset === "week") return [startOfWeek(now), today] as const;
  if (preset === "month") return [dateKeyLocal(new Date(now.getFullYear(), now.getMonth(), 1)), today] as const;
  if (preset === "year") return [new Date(now.getFullYear(), 0, 1).toISOString().slice(0, 10), today] as const;
  if (preset === "last-year") return [`${now.getFullYear() - 1}-01-01`, `${now.getFullYear() - 1}-12-31`] as const;
  return ["", ""] as const;
}


export function ReportExplorer({ initialKind = "all", initialFrom = "", initialTo = "", initialQuery = "" }: { initialKind?: ReportKind; initialFrom?: string; initialTo?: string; initialQuery?: string }) {
  const data = useProjectStore((s) => s.data!);
  const sym = useCurrencySymbol();
  const [kind, setKind] = useState<ReportKind>(initialKind);
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);
  const [query, setQuery] = useState(initialQuery);
  const [year, setYear] = useState("all");
  const [status, setStatus] = useState("all");
  const [party, setParty] = useState("all");
  const [page, setPage] = useState(1);
  const pageSize = 50;

  const rows = useMemo(() => buildRows(data), [data]);
  const years = useMemo(() => {
    const set = new Set<string>();
    for (const row of rows) if (row.date) set.add(row.date.slice(0, 4));
    return [...set].sort((a, b) => Number(b) - Number(a));
  }, [rows]);
  const parties = useMemo(() => {
    const set = new Set<string>();
    for (const row of rows) if ((kind === "sales" || kind === "purchases" || kind === "customer-ledger" || kind === "supplier-ledger" || kind === "returns" || kind === "all") && row.party) set.add(row.party);
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [rows, kind]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = rows.filter((row) => {
      const typeMatch = kind === "all" || row.type === kind || (kind === "profit" && row.type === "sales") || (kind === "p&l" && (row.type === "sales" || row.type === "expenses"));
      if (!typeMatch) return false;
      if (from && row.date && row.date < from) return false;
      if (to && row.date && row.date > to) return false;
      if (from && !row.date && kind !== "customers" && kind !== "suppliers") return false;
      if (year !== "all" && row.date.slice(0, 4) !== year) return false;
      if (status !== "all" && row.status !== status) return false;
      if (party !== "all" && row.party !== party) return false;
      if (q && !`${row.reference} ${row.party} ${row.details} ${row.status} ${row.date}`.toLowerCase().includes(q)) return false;
      return true;
    });
    if (kind === "profit") list = list.filter((row) => row.profit !== null && row.status !== "cancelled");
    return list.sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  }, [rows, kind, from, to, year, status, party, query]);

  const summary = useMemo(() => {
    const amount = filtered.reduce((sum, row) => sum + row.amount, 0);
    const profit = filtered.reduce((sum, row) => sum + (row.profit ?? 0), 0);
    return { count: filtered.length, amount, profit };
  }, [filtered]);

  const statusOptions = useMemo(() => [...new Set(filtered.map((r) => r.status))].sort(), [filtered]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const visible = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
  const pnl=useMemo(()=>financeSummary(data,from||undefined,to||undefined),[data,from,to]);

  function changeKind(v: string) { setKind(v as ReportKind); setParty("all"); setStatus("all"); setPage(1); }
  function applyPreset(v: string) { const [a, b] = presetRange(v); setFrom(a); setTo(b); setPage(1); }
  function clearFilters() { setKind("all"); setFrom(""); setTo(""); setQuery(""); setYear("all"); setStatus("all"); setParty("all"); setPage(1); }
  function exportCSV() {
    const headers = ["Date", "Type", "Reference", "Party", "Details", "Amount", "Profit", "Status"];
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const body = filtered.map((r) => [r.date, KIND_LABELS[r.type], r.reference, r.party, r.details, r.amount.toFixed(2), r.profit == null ? "" : r.profit.toFixed(2), r.status].map(esc).join(",")).join("\n");
    const blob = new Blob([headers.join(",") + "\n" + body], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `pharmacy-report-${kind}-${from || "all"}-${to || "all"}.csv`; a.click(); URL.revokeObjectURL(url);
  }
  function printReport() {
    const title = `${KIND_LABELS[kind]} report`;
    const body = filtered.slice(0, 2000).map((r) => `<tr><td>${escapeHtml(r.date || "—")}</td><td>${escapeHtml(KIND_LABELS[r.type])}</td><td>${escapeHtml(r.reference)}</td><td>${escapeHtml(r.party)}</td><td>${escapeHtml(r.details)}</td><td class="r">${escapeHtml(money(r.amount, sym))}</td><td class="r">${r.profit == null ? "—" : escapeHtml(money(r.profit, sym))}</td></tr>`).join("");
    printHtml(`<!doctype html><html><head><title>${escapeHtml(title)}</title><style>body{font-family:Arial,sans-serif;padding:24px}h1{font-size:20px}p{color:#555}table{width:100%;border-collapse:collapse;font-size:11px}th,td{border:1px solid #ccc;padding:6px;text-align:left}th{background:#f4f4f4}.r{text-align:right}</style></head><body><h1>${escapeHtml(title)}</h1><p>${escapeHtml(`${from || "All dates"} → ${to || "All dates"} · ${filtered.length} records`)}</p><table><thead><tr><th>Date</th><th>Type</th><th>Reference</th><th>Party</th><th>Details</th><th>Amount</th><th>Profit</th></tr></thead><tbody>${body}</tbody></table></body></html>`);
  }

  return <div className="grid gap-4">{kind==="p&l"&&<section className="surface-card p-5"><div className="flex items-center justify-between"><div><h2 className="font-display text-lg font-semibold">Profit & Loss</h2><p className="text-xs text-muted-foreground">Revenue minus COGS and operating expenses for the selected period.</p></div><div className="text-right"><p className="text-xs text-muted-foreground">Net profit</p><p className="text-2xl font-bold">{money(pnl.netProfit,sym)}</p></div></div><div className="mt-4 grid gap-3 sm:grid-cols-5"><Metric label="Revenue" value={money(pnl.revenue,sym)}/><Metric label="COGS" value={money(pnl.cogs,sym)}/><Metric label="Gross profit" value={money(pnl.grossProfit,sym)}/><Metric label="Expenses" value={money(pnl.expenses,sym)}/><Metric label="Returns" value={money(pnl.returns,sym)}/></div></section>}
    <section className="surface-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><div className="flex items-center gap-2"><Filter className="h-4 w-4 text-primary" /><h2 className="font-display text-base font-semibold">Report explorer</h2></div><p className="mt-1 max-w-3xl text-xs text-muted-foreground">Search the complete pharmacy history. Use a year, exact date range, party, status or free-text search to find old records without scrolling through months of data.</p></div>
        <div className="flex gap-2"><Button size="sm" variant="outline" onClick={clearFilters}><RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Reset</Button><Button size="sm" variant="outline" onClick={printReport}><Printer className="mr-1.5 h-3.5 w-3.5" /> Print</Button><Button size="sm" onClick={exportCSV}><Download className="mr-1.5 h-3.5 w-3.5" /> Export CSV</Button></div>
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <Field label="Report type"><Select value={kind} onValueChange={changeKind}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(KIND_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select></Field>
        <Field label="Quick range"><Select value="custom" onValueChange={applyPreset}><SelectTrigger><SelectValue placeholder="Custom range" /></SelectTrigger><SelectContent><SelectItem value="custom">Custom / unchanged</SelectItem><SelectItem value="today">Today</SelectItem><SelectItem value="yesterday">Yesterday</SelectItem><SelectItem value="week">This week</SelectItem><SelectItem value="month">This month</SelectItem><SelectItem value="year">This year</SelectItem><SelectItem value="last-year">Last year</SelectItem></SelectContent></Select></Field>
        <Field label="From"><Input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} /></Field>
        <Field label="To"><Input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} /></Field>
        <Field label="Year"><Select value={year} onValueChange={(v) => { setYear(v); setPage(1); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All years</SelectItem>{years.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent></Select></Field>
        <Field label="Party / customer / supplier"><Select value={party} onValueChange={(v) => { setParty(v); setPage(1); }}><SelectTrigger><SelectValue placeholder="All parties" /></SelectTrigger><SelectContent><SelectItem value="all">All parties</SelectItem>{parties.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent></Select></Field>
        <Field label="Status"><Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All statuses</SelectItem>{statusOptions.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></Field>
        <Field label="Search everything"><div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-9" value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }} placeholder="Invoice, medicine, customer, supplier…" /></div></Field>
      </div>
    </section>

    <div className="grid gap-3 sm:grid-cols-3"><Metric label="Matching records" value={String(summary.count)} /><Metric label={kind === "profit" ? "Profit" : "Total amount"} value={money(kind === "profit" ? summary.profit : summary.amount, sym)} /><Metric label="Profit in results" value={money(summary.profit, sym)} /></div>

    <section className="surface-card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b p-4"><div><h3 className="font-display font-semibold">Results</h3><p className="text-xs text-muted-foreground">{filtered.length === 0 ? "No matching records" : `Showing ${(safePage - 1) * pageSize + 1}–${Math.min(safePage * pageSize, filtered.length)} of ${filtered.length}`}</p></div><p className="text-xs text-muted-foreground">All historical records · 50 per page</p></div>
      <div className="overflow-auto"><table className="w-full min-w-[900px] text-sm"><thead className="bg-muted/40 text-xs text-muted-foreground"><tr><th className="p-3 text-left">Date</th><th className="p-3 text-left">Type</th><th className="p-3 text-left">Reference</th><th className="p-3 text-left">Customer / Supplier</th><th className="p-3 text-left">Details</th><th className="p-3 text-right">Amount</th><th className="p-3 text-right">Profit</th><th className="p-3 text-left">Status</th></tr></thead><tbody>{visible.map((r) => <tr key={r.id} className="border-t align-top hover:bg-muted/20"><td className="p-3 whitespace-nowrap">{r.date || "—"}</td><td className="p-3 whitespace-nowrap">{KIND_LABELS[r.type]}</td><td className="p-3 font-medium">{r.reference}</td><td className="p-3">{r.party}</td><td className="max-w-[420px] p-3 text-muted-foreground">{r.details}</td><td className={`p-3 text-right tabular-nums ${r.amount < 0 ? "text-destructive" : ""}`}>{money(r.amount, sym)}</td><td className="p-3 text-right tabular-nums">{r.profit == null ? "—" : money(r.profit, sym)}</td><td className="p-3 capitalize">{r.status}</td></tr>)}</tbody></table>{visible.length === 0 && <div className="p-12 text-center text-sm text-muted-foreground">No records match the selected filters. Try a wider date range or choose “All activity”.</div>}</div>
      {pageCount > 1 && <div className="flex items-center justify-between border-t p-3"><Button size="sm" variant="outline" disabled={safePage <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Previous</Button><span className="text-xs text-muted-foreground">Page {safePage} of {pageCount}</span><Button size="sm" variant="outline" disabled={safePage >= pageCount} onClick={() => setPage((p) => Math.min(pageCount, p + 1))}>Next</Button></div>}
    </section>
  </div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div><label className="mb-1.5 block text-xs font-medium text-muted-foreground">{label}</label>{children}</div>; }
function Metric({ label, value }: { label: string; value: string }) { return <div className="surface-card p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 font-display text-xl font-bold tabular-nums">{value}</p></div>; }
