import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search, UserRound, Phone, CalendarDays, ShoppingBag, FileText, Wallet } from "lucide-react";
import { PermissionGate } from "@/components/PermissionGate";
import { Input } from "@/components/ui/input";
import { useProjectStore } from "@/store/project-store";
import { money, useCurrencySymbol } from "@/lib/format";
import { patientMedicineHistory, patientPrescriptions, patientSales, patientSpent } from "@/lib/patient-history";

export const Route = createFileRoute("/app/patients")({ component: () => <PermissionGate perm="customers"><PatientsPage /></PermissionGate> });

function PatientsPage() {
  const data = useProjectStore((s) => s.data!);
  const sym = useCurrencySymbol();
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(data.customers[0]?.id ?? null);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return data.customers.filter((c) => !q || `${c.name} ${c.phone ?? ""} ${c.email ?? ""}`.toLowerCase().includes(q));
  }, [data.customers, query]);
  const selected = data.customers.find((c) => c.id === selectedId) ?? filtered[0];
  const sales = selected ? patientSales(data, selected.id) : [];
  const prescriptions = selected ? patientPrescriptions(data, selected) : [];
  const medicineHistory = selected ? patientMedicineHistory(data, selected.id) : [];
  const spent = selected ? patientSpent(data, selected.id) : 0;

  return <div className="mx-auto max-w-7xl p-6 md:p-8">
    <header className="mb-6 flex items-center gap-3"><div className="grid h-11 w-11 place-items-center rounded-xl bg-primary text-primary-foreground"><UserRound className="h-5 w-5" /></div><div><h1 className="font-display text-3xl font-bold">Patients & History</h1><p className="text-sm text-muted-foreground">See a patient's purchases, prescriptions, medicines and outstanding balance in one place.</p></div></header>
    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
      <section className="surface-card overflow-hidden"><div className="border-b p-4"><div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"/><Input className="pl-9" placeholder="Search patient or phone..." value={query} onChange={(e) => setQuery(e.target.value)} /></div></div><div className="max-h-[650px] overflow-y-auto p-2">{filtered.map((c) => <button key={c.id} onClick={() => setSelectedId(c.id)} className={`w-full rounded-lg p-3 text-left transition ${selected?.id === c.id ? "bg-primary/10" : "hover:bg-muted"}`}><div className="font-medium">{c.name}</div><div className="text-xs text-muted-foreground">{c.phone || "No phone"}</div><div className="mt-1 text-xs">Balance: <span className={c.balance > 0 ? "text-destructive" : "text-muted-foreground"}>{money(c.balance, sym)}</span></div></button>)}{filtered.length === 0 && <div className="p-8 text-center text-sm text-muted-foreground">No patients found.</div>}</div></section>
      {selected ? <main className="space-y-6">
        <section className="surface-card p-5"><div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="text-2xl font-bold">{selected.name}</h2><div className="mt-2 flex flex-wrap gap-4 text-sm text-muted-foreground">{selected.phone && <span className="inline-flex items-center gap-1"><Phone className="h-4 w-4"/>{selected.phone}</span>}{selected.email && <span>{selected.email}</span>}</div></div><div className="rounded-xl bg-muted p-3 text-right"><div className="text-xs text-muted-foreground">Outstanding balance</div><div className="text-xl font-bold">{money(selected.balance, sym)}</div></div></div></section>
        <section className="grid gap-4 sm:grid-cols-4"><Stat icon={<ShoppingBag/>} label="Purchases" value={String(sales.length)} /><Stat icon={<Wallet/>} label="Lifetime spent" value={money(spent, sym)} /><Stat icon={<FileText/>} label="Prescriptions" value={String(prescriptions.length)} /><Stat icon={<CalendarDays/>} label="Last visit" value={sales[0]?.date.slice(0,10) || "—"} /></section>
        <section className="grid gap-6 xl:grid-cols-2">
          <div className="surface-card overflow-hidden"><div className="border-b p-4"><h3 className="font-semibold">Purchase history</h3></div>{sales.length ? <div className="divide-y">{sales.slice(0,20).map((s) => <div key={s.id} className="flex items-center justify-between p-4"><div><div className="font-medium">{s.invoiceNumber}</div><div className="text-xs text-muted-foreground">{s.date.slice(0,16).replace("T", " ")} · {s.items.length} item{s.items.length === 1 ? "" : "s"}</div></div><div className="font-medium">{money(s.items.reduce((sum, i) => sum + i.salePrice * i.quantity * (1 - i.discountPercent / 100), 0), sym)}</div></div>)}</div> : <Empty text="No sales history for this patient."/>}</div>
          <div className="surface-card overflow-hidden"><div className="border-b p-4"><h3 className="font-semibold">Prescription history</h3></div>{prescriptions.length ? <div className="divide-y">{prescriptions.slice(0,20).map((p) => <div key={p.id} className="p-4"><div className="flex justify-between gap-3"><div className="font-medium">{p.date.slice(0,10)}</div>{p.nextVisitDate && <span className="text-xs text-muted-foreground">Next: {p.nextVisitDate}</span>}</div><div className="mt-1 text-sm">{p.items.map((i) => data.medicines.find((m) => m.id === i.medicineId)?.name ?? "Unknown medicine").join(", ")}</div>{p.doctorName && <div className="mt-1 text-xs text-muted-foreground">Doctor: {p.doctorName}</div>}</div>)}</div> : <Empty text="No prescription history found."/>}</div>
        </section>
        <section className="surface-card overflow-hidden"><div className="border-b p-4"><h3 className="font-semibold">Medicines purchased most often</h3></div>{medicineHistory.length ? <div className="grid gap-2 p-4 sm:grid-cols-2">{medicineHistory.slice(0,12).map((x) => <div key={x.medicineId} className="flex items-center justify-between rounded-lg bg-muted/50 p-3"><span>{x.medicine?.name}</span><span className="text-sm font-medium">{x.quantity} units</span></div>)}</div> : <Empty text="No medicine purchase history yet."/>}</section>
      </main> : <div className="surface-card grid min-h-[400px] place-items-center text-muted-foreground">Select a patient to view history.</div>}
    </div>
  </div>;
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) { return <div className="surface-card p-4"><div className="mb-2 flex items-center gap-2 text-muted-foreground">{icon}<span className="text-xs">{label}</span></div><div className="text-xl font-bold">{value}</div></div>; }
function Empty({ text }: { text: string }) { return <div className="p-8 text-center text-sm text-muted-foreground">{text}</div>; }
