import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { BellRing, FileText, Plus, Printer, Trash2, Pencil, ShoppingCart, AlertTriangle, CalendarClock, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PermissionGate } from "@/components/PermissionGate";
import { useProjectStore } from "@/store/project-store";
import { useSession } from "@/store/session-store";
import { useCartStore } from "@/store/cart-store";
import { readInstall } from "@/lib/install";
import { uid, money, useCurrencySymbol } from "@/lib/format";
import { addRepeat, advancePrescriptionVisit, isPrescriptionDue, isPrescriptionDueSoon, isPrescriptionVisible, todayDate, type Prescription, type PrescriptionLine, type PrescriptionRepeatUnit, type PrescriptionVisibility } from "@/lib/prescriptions";
import { canAddPrescription, canDeletePrescription, canEditPrescription, canLoadPrescription, canPrintPrescription } from "@/lib/granular-permissions";

export const Route = createFileRoute("/app/prescriptions")({
  component: () => <PermissionGate perm="prescriptions"><PrescriptionsPage /></PermissionGate>,
});

function escapeHtml(v: string) { return String(v).replace(/[&<>\"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[c]!)); }

async function printPrescription(p: Prescription, data: any) {
  const rows = p.items.map((x) => {
    const m = data.medicines.find((medicine: any) => medicine.id === x.medicineId);
    return `<tr><td>${escapeHtml(m?.name ?? "—")}</td><td>${x.quantity}</td><td>${escapeHtml(x.dosage ?? "")}</td><td>${escapeHtml(x.frequency ?? "")}</td><td>${escapeHtml(x.duration ?? "")}</td><td>${escapeHtml(x.instructions ?? "")}</td></tr>`;
  }).join("");
  const html = `<!doctype html><html><head><title>Prescription - ${escapeHtml(p.patientName)}</title><style>body{font-family:Arial;padding:28px}h1{font-size:22px}table{width:100%;border-collapse:collapse;margin-top:20px}th,td{border:1px solid #ccc;padding:8px;text-align:left}.muted{color:#666}</style></head><body><h1>${escapeHtml(data.settings.pharmacyName || data.meta.name)}</h1><p><b>Patient:</b> ${escapeHtml(p.patientName)}${p.patientPhone ? `<br><b>Phone:</b> ${escapeHtml(p.patientPhone)}` : ""}${p.doctorName ? `<br><b>Doctor:</b> ${escapeHtml(p.doctorName)}` : ""}${p.diagnosis ? `<br><b>Diagnosis:</b> ${escapeHtml(p.diagnosis)}` : ""}<br><b>Prescription date:</b> ${escapeHtml(p.date.slice(0,10))}${p.nextVisitDate ? `<br><b>Next visit:</b> ${escapeHtml(p.nextVisitDate)}` : ""}</p><table><thead><tr><th>Medicine</th><th>Qty</th><th>Dosage</th><th>Frequency</th><th>Duration</th><th>Instructions</th></tr></thead><tbody>${rows}</tbody></table>${p.notes ? `<p><b>Notes:</b> ${escapeHtml(p.notes)}</p>` : ""}<p class="muted">Printed from HPMS</p></body></html>`;
  const api = (typeof window !== "undefined" ? (window as any).medicore?.print?.html : null);
  if (api) {
    const result = await api(html);
    if (!result?.ok) toast.error(result?.error || "Could not print the prescription.");
    return;
  }
  const w = window.open("", "_blank", "width=900,height=700");
  if (!w) return toast.error("Popup blocked. Allow popups to print the prescription.");
  w.document.write(`${html}<script>window.onload=()=>window.print();</script>`);
  w.document.close();
}

const emptyForm = { patientName: "", patientPhone: "", doctorName: "", diagnosis: "", notes: "", medicineId: "", quantity: 1, dosage: "", frequency: "", duration: "", instructions: "", nextVisitDate: "", repeatEvery: 1, repeatUnit: "month" as PrescriptionRepeatUnit, notifyBeforeDays: 1, visibility: "all" as PrescriptionVisibility, allowedUserIds: [] as string[] };

function PrescriptionsPage() {
  const data = useProjectStore((s) => s.data!);
  const mutate = useProjectStore((s) => s.mutate);
  const user = useSession((s) => s.user);
  const cart = useCartStore((s) => s.cart);
  const setCart = useCartStore((s) => s.setCart);
  const sym = useCurrencySymbol();
  const users = readInstall()?.users ?? [];
  const prescriptions = (data.settings.prescriptions ?? []).filter((p) => isPrescriptionVisible(p, user));
  const dueSoon = prescriptions.filter((p) => isPrescriptionDueSoon(p)).sort((a,b) => (a.nextVisitDate ?? "").localeCompare(b.nextVisitDate ?? ""));
  const canAdd = canAddPrescription(user);
  const canEdit = canEditPrescription(user);
  const canDelete = canDeletePrescription(user);
  const canPrint = canPrintPrescription(user);
  const canLoad = canLoadPrescription(user);
  const [form, setForm] = useState(emptyForm);
  const [items, setItems] = useState<PrescriptionLine[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [medicineSearch, setMedicineSearch] = useState("");
  const [selectedDetail, setSelectedDetail] = useState<Prescription | null>(null);

  const filtered = useMemo(() => { const q = medicineSearch.trim().toLowerCase(); return data.medicines.filter((m) => !q || `${m.name} ${m.genericName ?? ""} ${m.company ?? ""}`.toLowerCase().includes(q)).slice(0, 50); }, [data.medicines, medicineSearch]);
  const visibleList = useMemo(() => { const q = search.trim().toLowerCase(); return prescriptions.filter((p) => !q || `${p.patientName} ${p.patientPhone ?? ""} ${p.doctorName ?? ""} ${p.diagnosis ?? ""}`.toLowerCase().includes(q)).sort((a,b) => Number(isPrescriptionDueSoon(b)) - Number(isPrescriptionDueSoon(a)) || (b.date.localeCompare(a.date))); }, [prescriptions, search]);

  function setField<K extends keyof typeof form>(key: K, value: (typeof form)[K]) { setForm((f) => ({ ...f, [key]: value })); }
  function resetForm() { setForm(emptyForm); setItems([]); setEditingId(null); setMedicineSearch(""); }
  function addLine() {
    if (!form.medicineId) return toast.error("Select a medicine");
    const cleanQty = Math.max(1, Math.floor(Number(form.quantity) || 1));
    setItems((x) => [...x, { medicineId: form.medicineId, quantity: cleanQty, dosage: form.dosage.trim() || undefined, frequency: form.frequency.trim() || undefined, duration: form.duration.trim() || undefined, instructions: form.instructions.trim() || undefined }]);
    setField("medicineId", ""); setField("quantity", 1); setField("dosage", ""); setField("frequency", ""); setField("duration", ""); setField("instructions", ""); setMedicineSearch("");
  }
  function startEdit(p: Prescription) {
    if (!canEdit) return toast.error("You do not have permission to edit prescriptions");
    setEditingId(p.id); setForm({ patientName: p.patientName, patientPhone: p.patientPhone ?? "", doctorName: p.doctorName ?? "", diagnosis: p.diagnosis ?? "", notes: p.notes ?? "", medicineId: "", quantity: 1, dosage: "", frequency: "", duration: "", instructions: "", nextVisitDate: p.nextVisitDate ?? "", repeatEvery: p.repeatEvery ?? 1, repeatUnit: p.repeatUnit ?? "month", notifyBeforeDays: p.notifyBeforeDays ?? 1, visibility: p.visibility, allowedUserIds: p.allowedUserIds ?? [] });
    setItems(p.items); window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function savePrescription() {
    if (editingId ? !canEdit : !canAdd) return toast.error("You do not have permission for this action");
    if (!form.patientName.trim()) return toast.error("Enter the patient name");
    if (!items.length) return toast.error("Add at least one medicine");
    if (form.visibility === "selected" && form.allowedUserIds.length === 0) return toast.error("Select at least one user");
    const p: Prescription = { id: editingId ?? uid("rx_"), date: editingId ? (data.settings.prescriptions ?? []).find((x) => x.id === editingId)?.date ?? new Date().toISOString() : new Date().toISOString(), patientName: form.patientName.trim(), patientPhone: form.patientPhone.trim() || undefined, doctorName: form.doctorName.trim() || undefined, diagnosis: form.diagnosis.trim() || undefined, notes: form.notes.trim() || undefined, items, createdBy: editingId ? (data.settings.prescriptions ?? []).find((x) => x.id === editingId)?.createdBy : user?.username, visibility: form.visibility, allowedUserIds: form.visibility === "selected" ? form.allowedUserIds : undefined, nextVisitDate: form.nextVisitDate || undefined, repeatEvery: form.nextVisitDate ? Math.max(1, Math.floor(Number(form.repeatEvery) || 1)) : undefined, repeatUnit: form.nextVisitDate ? form.repeatUnit : undefined, notifyBeforeDays: form.nextVisitDate ? Math.max(0, Math.floor(Number(form.notifyBeforeDays) || 0)) : undefined };
    mutate((d) => { const list = d.settings.prescriptions ?? []; d.settings.prescriptions = editingId ? list.map((x) => x.id === editingId ? p : x) : [...list, p]; });
    toast.success(editingId ? "Prescription updated" : "Prescription saved"); resetForm();
  }
  function removePrescription(id: string) { if (!canDelete) return toast.error("You do not have permission to delete prescriptions"); if (!window.confirm("Delete this prescription?")) return; mutate((d) => { d.settings.prescriptions = (d.settings.prescriptions ?? []).filter((p) => p.id !== id); }); toast.success("Prescription deleted"); }
  function loadToCart(p: Prescription, advance = true) {
    if (!canLoad) return toast.error("You do not have permission to load prescriptions into Sales");
    setCart((current) => { const next = [...current]; for (const line of p.items) { const med = data.medicines.find((m) => m.id === line.medicineId); if (!med) continue; const i = next.findIndex((x) => x.medicineId === line.medicineId); if (i >= 0) next[i] = { ...next[i], quantity: next[i].quantity + Math.max(1, line.quantity) }; else next.push({ medicineId: med.id, quantity: Math.max(1, line.quantity), salePrice: med.salePrice, discountPercent: 0, name: med.name, forced: false, forcedSale: false }); } return next; });
    if (advance && p.nextVisitDate) mutate((d) => { const target = (d.settings.prescriptions ?? []).find((x) => x.id === p.id); if (!target) return; target.nextVisitDate = advancePrescriptionVisit(target); });
    toast.success(`${p.patientName}'s prescription loaded to Sales (${p.items.length} medicine${p.items.length === 1 ? "" : "s"})`);
  }

  return <div className="mx-auto max-w-7xl p-6 md:p-8">
    <header className="mb-6 flex flex-wrap items-center gap-3"><div className="grid h-11 w-11 place-items-center rounded-xl bg-primary text-primary-foreground"><FileText className="h-5 w-5" /></div><div><p className="text-xs uppercase tracking-widest text-muted-foreground">Clinical workflow</p><h1 className="font-display text-3xl font-bold">Prescriptions</h1><p className="text-sm text-muted-foreground">Create prescriptions, track follow-up dates, check stock and load them directly into Sales.</p></div>{dueSoon.length > 0 && <div className="ml-auto flex items-center gap-2 rounded-full border border-warning/40 bg-warning/10 px-3 py-2 text-sm"><BellRing className="h-4 w-4 text-warning" /><b>{dueSoon.length}</b> follow-up{dueSoon.length === 1 ? "" : "s"} soon</div>}</header>
    {dueSoon.length > 0 && <section className="mb-5 rounded-xl border border-warning/40 bg-warning/5 p-4"><div className="mb-3 flex items-center gap-2"><CalendarClock className="h-4 w-4 text-warning" /><h2 className="font-semibold">Upcoming / due patients</h2></div><div className="grid gap-2 md:grid-cols-2">{dueSoon.slice(0, 8).map((p) => <button key={p.id} className="flex items-center justify-between rounded-lg border bg-background p-3 text-left hover:bg-muted" onClick={() => setSelectedDetail(p)}><span><b>{p.patientName}</b><span className="ml-2 text-xs text-muted-foreground">{p.nextVisitDate}</span></span><BellRing className="h-4 w-4 text-warning" /></button>)}</div></section>}
    <div className="grid gap-5 lg:grid-cols-[1.15fr_.85fr]">
      <section className="surface-card p-5"><div className="flex items-center justify-between"><div><h2 className="font-display font-semibold">{editingId ? "Edit prescription" : "New prescription"}</h2><p className="text-xs text-muted-foreground">Patient, doctor, diagnosis, medicines and follow-up schedule.</p></div>{editingId && <Button size="sm" variant="ghost" onClick={resetForm}>Cancel edit</Button>}</div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2"><Field label="Patient name"><Input value={form.patientName} onChange={(e) => setField("patientName", e.target.value)} /></Field><Field label="Phone number"><Input value={form.patientPhone} onChange={(e) => setField("patientPhone", e.target.value)} /></Field><Field label="Doctor"><Input value={form.doctorName} onChange={(e) => setField("doctorName", e.target.value)} /></Field><Field label="Diagnosis"><Input value={form.diagnosis} onChange={(e) => setField("diagnosis", e.target.value)} /></Field></div>
        <div className="mt-5 rounded-lg border p-4"><h3 className="font-medium">Medicines</h3><div className="mt-3 grid gap-3 sm:grid-cols-[1fr_100px]"><div><Input placeholder="Search medicine by name, generic or company" value={medicineSearch} onChange={(e) => setMedicineSearch(e.target.value)} />{medicineSearch.trim() && <div className="mt-1 max-h-44 overflow-auto rounded-md border bg-popover">{filtered.map((m) => <button type="button" key={m.id} onClick={() => { setField("medicineId", m.id); setMedicineSearch(m.name); }} className="flex w-full items-center justify-between border-b px-3 py-2 text-left text-sm last:border-0 hover:bg-muted"><span>{m.name}</span><span className="text-xs text-muted-foreground">Stock {m.stockQuantity} · {money(m.salePrice, sym)}</span></button>)}</div>}</div><Input type="number" min={1} placeholder="Qty" value={form.quantity} onChange={(e) => setField("quantity", Math.max(1, Number(e.target.value) || 1))} /></div><div className="mt-3 grid gap-3 sm:grid-cols-2"><Input placeholder="Dosage e.g. 1 tablet" value={form.dosage} onChange={(e) => setField("dosage", e.target.value)} /><Input placeholder="Frequency e.g. twice daily" value={form.frequency} onChange={(e) => setField("frequency", e.target.value)} /><Input placeholder="Duration e.g. 5 days" value={form.duration} onChange={(e) => setField("duration", e.target.value)} /><Input placeholder="Instructions" value={form.instructions} onChange={(e) => setField("instructions", e.target.value)} /></div><Button className="mt-3" variant="outline" onClick={addLine}><Plus className="mr-2 h-4 w-4" />Add medicine</Button>{items.length > 0 && <div className="mt-4 space-y-2">{items.map((x, i) => { const m = data.medicines.find((med) => med.id === x.medicineId); return <div key={`${x.medicineId}-${i}`} className="flex items-center justify-between gap-3 rounded border p-2 text-sm"><div><b>{m?.name ?? "Missing medicine"}</b><span className={`ml-2 text-xs ${m && m.stockQuantity < x.quantity ? "text-destructive" : "text-muted-foreground"}`}>Qty {x.quantity} · Stock {m?.stockQuantity ?? 0} · {money(m?.salePrice ?? 0, sym)}</span><div className="text-xs text-muted-foreground">{[x.dosage, x.frequency, x.duration, x.instructions].filter(Boolean).join(" · ")}</div></div><Button size="icon" variant="ghost" onClick={() => setItems((v) => v.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button></div>; })}</div>}</div>
        <div className="mt-5 rounded-lg border p-4"><div className="flex items-center gap-2"><CalendarClock className="h-4 w-4 text-primary" /><h3 className="font-medium">Next visit & reminder</h3></div><div className="mt-3 grid gap-3 sm:grid-cols-2"><Field label="Next visit date"><Input type="date" value={form.nextVisitDate} onChange={(e) => setField("nextVisitDate", e.target.value)} /></Field><Field label="Notify before (days)"><Input type="number" min={0} value={form.notifyBeforeDays} disabled={!form.nextVisitDate} onChange={(e) => setField("notifyBeforeDays", Math.max(0, Number(e.target.value) || 0))} /></Field></div>{form.nextVisitDate && <div className="mt-3 grid gap-3 sm:grid-cols-[100px_1fr]"><Input type="number" min={1} value={form.repeatEvery} onChange={(e) => setField("repeatEvery", Math.max(1, Number(e.target.value) || 1))} /><Select value={form.repeatUnit} onValueChange={(v) => setField("repeatUnit", v as PrescriptionRepeatUnit)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="day">day(s)</SelectItem><SelectItem value="week">week(s)</SelectItem><SelectItem value="month">month(s)</SelectItem><SelectItem value="year">year(s)</SelectItem></SelectContent></Select></div>}{form.nextVisitDate && <p className="mt-2 text-xs text-muted-foreground">After the visit is loaded into Sales, the next visit is advanced by the selected interval.</p>}</div>
        <div className="mt-5 rounded-lg border p-4"><h3 className="font-medium">Who can see this prescription?</h3><div className="mt-3 flex flex-wrap gap-3"><label className="flex items-center gap-2 text-sm"><input type="radio" name="rx-visibility" checked={form.visibility === "admin"} onChange={() => setField("visibility", "admin")} /> Admin only</label><label className="flex items-center gap-2 text-sm"><input type="radio" name="rx-visibility" checked={form.visibility === "all"} onChange={() => setField("visibility", "all")} /> All users with prescription access</label><label className="flex items-center gap-2 text-sm"><input type="radio" name="rx-visibility" checked={form.visibility === "selected"} onChange={() => setField("visibility", "selected")} /> Selected users</label></div>{form.visibility === "selected" && <div className="mt-3 grid gap-2 sm:grid-cols-2">{users.filter((u) => u.role !== "admin").map((u) => <label key={u.id} className="flex items-center gap-2 rounded border p-2 text-sm"><Checkbox checked={form.allowedUserIds.includes(u.id)} onCheckedChange={(v) => setField("allowedUserIds", v === true ? [...form.allowedUserIds, u.id] : form.allowedUserIds.filter((id) => id !== u.id))} />{u.username}</label>)}{users.filter((u) => u.role !== "admin").length === 0 && <p className="text-xs text-muted-foreground">No non-admin users are available.</p>}</div>}</div>
        <Field label="Notes" className="mt-5"><Textarea value={form.notes} onChange={(e) => setField("notes", e.target.value)} /></Field><Button className="mt-4" onClick={savePrescription} disabled={editingId ? !canEdit : !canAdd}>{editingId ? "Save changes" : "Save prescription"}</Button>
      </section>
      <section className="surface-card p-5"><div className="flex items-center gap-2"><Search className="h-4 w-4 text-primary" /><h2 className="font-display font-semibold">Prescription records</h2></div><Input className="mt-4" placeholder="Search patient, phone, doctor or diagnosis" value={search} onChange={(e) => setSearch(e.target.value)} /><div className="mt-4 space-y-3">{visibleList.length === 0 ? <p className="text-sm text-muted-foreground">No prescriptions match your search.</p> : visibleList.map((p) => <div key={p.id} className={`rounded-lg border p-3 ${isPrescriptionDueSoon(p) ? "border-warning/50 bg-warning/5" : ""}`}><div className="flex items-start justify-between gap-2"><button className="text-left" onClick={() => setSelectedDetail(p)}><b>{p.patientName}</b><p className="text-xs text-muted-foreground">{p.patientPhone ?? "No phone"}{p.doctorName ? ` · Dr. ${p.doctorName}` : ""}</p>{p.nextVisitDate && <p className={`mt-1 text-xs ${isPrescriptionDue(p) ? "font-semibold text-destructive" : isPrescriptionDueSoon(p) ? "font-semibold text-warning" : "text-muted-foreground"}`}>{isPrescriptionDue(p) ? "Due now" : "Next visit"}: {p.nextVisitDate}</p>}</button><div className="flex gap-1">{isPrescriptionDueSoon(p) && <BellRing className="mt-1 h-4 w-4 text-warning" />}{canPrint && <Button size="icon" variant="ghost" title="Print" onClick={() => void printPrescription(p, data)}><Printer className="h-4 w-4" /></Button>}{canLoad && <Button size="icon" variant="ghost" title="Load to Sales" onClick={() => loadToCart(p)}><ShoppingCart className="h-4 w-4" /></Button>}{canEdit && <Button size="icon" variant="ghost" title="Edit" onClick={() => startEdit(p)}><Pencil className="h-4 w-4" /></Button>}{canDelete && <Button size="icon" variant="ghost" title="Delete" onClick={() => removePrescription(p.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}</div></div><p className="mt-2 text-xs text-muted-foreground">{p.items.length} medicine(s) · {p.visibility === "admin" ? "Admin only" : p.visibility === "selected" ? "Selected users" : "All permitted users"}</p></div>)}</div></section>
    </div>
    {selectedDetail && <PrescriptionDetailDialog prescription={selectedDetail} data={data} canLoad={canLoad} onLoad={() => { loadToCart(selectedDetail); setSelectedDetail(null); }} onClose={() => setSelectedDetail(null)} />}
  </div>;
}

function PrescriptionDetailDialog({ prescription: p, data, canLoad, onLoad, onClose }: { prescription: Prescription; data: any; canLoad: boolean; onLoad: () => void; onClose: () => void }) {
  const sym = data.settings.currencySymbol || "$";
  return <Dialog open onOpenChange={(o) => !o && onClose()}><DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto"><DialogHeader><DialogTitle className="flex items-center gap-2">{p.patientName}{isPrescriptionDueSoon(p) && <BellRing className="h-4 w-4 text-warning" />}</DialogTitle></DialogHeader><div className="grid gap-4"><div className="grid gap-2 rounded-lg border p-3 text-sm sm:grid-cols-2"><div><b>Phone:</b> {p.patientPhone ?? "—"}</div><div><b>Doctor:</b> {p.doctorName ?? "—"}</div><div><b>Diagnosis:</b> {p.diagnosis ?? "—"}</div><div><b>Next visit:</b> {p.nextVisitDate ?? "Not scheduled"}</div></div><div className="rounded-lg border"><div className="border-b px-3 py-2 font-medium">Medicines, current stock and price</div>{p.items.map((x) => { const m = data.medicines.find((med: any) => med.id === x.medicineId); const low = !m || m.stockQuantity < x.quantity; return <div key={x.medicineId} className="flex items-center justify-between gap-3 border-b p-3 last:border-0"><div><b>{m?.name ?? "Missing medicine"}</b><p className="text-xs text-muted-foreground">Qty {x.quantity}{x.dosage ? ` · ${x.dosage}` : ""}{x.frequency ? ` · ${x.frequency}` : ""}{x.duration ? ` · ${x.duration}` : ""}</p></div><div className="text-right text-sm"><div>{money(m?.salePrice ?? 0, sym)}</div><div className={low ? "font-semibold text-destructive" : "text-muted-foreground"}>{!m ? "Medicine missing" : m.stockQuantity === 0 ? "OUT OF STOCK" : `Stock ${m.stockQuantity}`}</div></div></div>; })}</div>{p.notes && <div className="rounded-lg border p-3 text-sm"><b>Notes</b><p className="mt-1 text-muted-foreground">{p.notes}</p></div>}</div><DialogFooter>{canLoad && <Button onClick={onLoad}><ShoppingCart className="mr-2 h-4 w-4" />Add to cart</Button>}<Button variant="ghost" onClick={onClose}>Close</Button></DialogFooter></DialogContent></Dialog>;
}
function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) { return <div className={className}><Label className="mb-1.5 block text-xs font-medium text-muted-foreground">{label}</Label>{children}</div>; }
