import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { FileText, Plus, Printer, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PermissionGate } from "@/components/PermissionGate";
import { useProjectStore } from "@/store/project-store";
import { useSession } from "@/store/session-store";
import { uid } from "@/lib/format";

type PrescriptionLine = { medicineId: string; dosage: string; frequency: string; duration: string; instructions: string };
type Prescription = { id: string; date: string; patientName: string; patientPhone?: string; doctorName?: string; diagnosis?: string; notes?: string; items: PrescriptionLine[]; createdBy?: string };
type SettingsWithPrescriptions = { prescriptions?: Prescription[] };

export const Route = createFileRoute("/app/prescriptions")({
  component: () => <PermissionGate perm="sales"><PrescriptionsPage /></PermissionGate>,
});

function printPrescription(p: Prescription, data: any) {
  const rows = p.items.map((x) => {
    const m = data.medicines.find((medicine: any) => medicine.id === x.medicineId);
    return `<tr><td>${escapeHtml(m?.name ?? "—")}</td><td>${escapeHtml(x.dosage)}</td><td>${escapeHtml(x.frequency)}</td><td>${escapeHtml(x.duration)}</td><td>${escapeHtml(x.instructions)}</td></tr>`;
  }).join("");
  const w = window.open("", "_blank", "width=900,height=700");
  if (!w) return toast.error("Popup blocked. Allow popups to print the prescription.");
  w.document.write(`<!doctype html><html><head><title>Prescription</title><style>body{font-family:Arial;padding:28px}h1{font-size:22px}table{width:100%;border-collapse:collapse;margin-top:20px}th,td{border:1px solid #ccc;padding:8px;text-align:left}</style></head><body><h1>${escapeHtml(data.settings.pharmacyName || data.meta.name)}</h1><p><b>Prescription date:</b> ${escapeHtml(p.date.slice(0,10))}<br><b>Patient:</b> ${escapeHtml(p.patientName)}${p.patientPhone ? `<br><b>Phone:</b> ${escapeHtml(p.patientPhone)}` : ""}${p.doctorName ? `<br><b>Doctor:</b> ${escapeHtml(p.doctorName)}` : ""}</p>${p.diagnosis ? `<p><b>Diagnosis:</b> ${escapeHtml(p.diagnosis)}</p>` : ""}<table><thead><tr><th>Medicine</th><th>Dosage</th><th>Frequency</th><th>Duration</th><th>Instructions</th></tr></thead><tbody>${rows}</tbody></table>${p.notes ? `<p><b>Notes:</b> ${escapeHtml(p.notes)}</p>` : ""}<script>window.onload=()=>window.print();</script></body></html>`);
  w.document.close();
}

function escapeHtml(v: string) { return String(v).replace(/[&<>\"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]!)); }

function PrescriptionsPage() {
  const data = useProjectStore((s) => s.data!);
  const mutate = useProjectStore((s) => s.mutate);
  const user = useSession((s) => s.user);
  const settings = data.settings as typeof data.settings & SettingsWithPrescriptions;
  const prescriptions = settings.prescriptions ?? [];
  const [patientName, setPatientName] = useState("");
  const [patientPhone, setPatientPhone] = useState("");
  const [doctorName, setDoctorName] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [notes, setNotes] = useState("");
  const [medicineId, setMedicineId] = useState(data.medicines[0]?.id ?? "");
  const [dosage, setDosage] = useState("");
  const [frequency, setFrequency] = useState("");
  const [duration, setDuration] = useState("");
  const [instructions, setInstructions] = useState("");
  const [items, setItems] = useState<PrescriptionLine[]>([]);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => { const q = search.trim().toLowerCase(); return data.medicines.filter((m) => !q || m.name.toLowerCase().includes(q) || (m.genericName ?? "").toLowerCase().includes(q) || (m.company ?? "").toLowerCase().includes(q)).slice(0, 50); }, [data.medicines, search]);

  function addLine() {
    if (!medicineId) return toast.error("Select a medicine");
    if (!dosage && !frequency && !duration && !instructions) return toast.error("Enter prescription instructions");
    setItems((x) => [...x, { medicineId, dosage, frequency, duration, instructions }]);
    setDosage(""); setFrequency(""); setDuration(""); setInstructions("");
  }

  function savePrescription() {
    if (!patientName.trim()) return toast.error("Enter the patient name");
    if (!items.length) return toast.error("Add at least one medicine");
    const p: Prescription = { id: uid("rx_"), date: new Date().toISOString(), patientName: patientName.trim(), patientPhone: patientPhone.trim() || undefined, doctorName: doctorName.trim() || undefined, diagnosis: diagnosis.trim() || undefined, notes: notes.trim() || undefined, items, createdBy: user?.username };
    mutate((d) => { const s = d.settings as typeof d.settings & SettingsWithPrescriptions; s.prescriptions = [...(s.prescriptions ?? []), p]; });
    toast.success("Prescription saved");
    setPatientName(""); setPatientPhone(""); setDoctorName(""); setDiagnosis(""); setNotes(""); setItems([]);
  }

  function removePrescription(id: string) { mutate((d) => { const s = d.settings as typeof d.settings & SettingsWithPrescriptions; s.prescriptions = (s.prescriptions ?? []).filter((p) => p.id !== id); }); }

  return <div className="mx-auto max-w-7xl p-6 md:p-8">
    <header className="mb-6 flex items-center gap-3"><div className="grid h-11 w-11 place-items-center rounded-xl bg-primary text-primary-foreground"><FileText className="h-5 w-5" /></div><div><p className="text-xs uppercase tracking-widest text-muted-foreground">Clinical workflow</p><h1 className="font-display text-3xl font-bold">Prescriptions</h1><p className="text-sm text-muted-foreground">Create, save and print prescription records without changing the sales workflow.</p></div></header>
    <div className="grid gap-5 lg:grid-cols-[1.15fr_.85fr]">
      <section className="surface-card p-5"><h2 className="font-display font-semibold">New prescription</h2><div className="mt-4 grid gap-3 sm:grid-cols-2"><div><Label>Patient name</Label><Input value={patientName} onChange={(e) => setPatientName(e.target.value)} /></div><div><Label>Patient phone</Label><Input value={patientPhone} onChange={(e) => setPatientPhone(e.target.value)} /></div><div><Label>Doctor</Label><Input value={doctorName} onChange={(e) => setDoctorName(e.target.value)} /></div><div><Label>Diagnosis</Label><Input value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} /></div></div>
      <div className="mt-5 rounded-lg border p-4"><h3 className="font-medium">Medicines</h3><Input className="mt-3" placeholder="Search medicine by name, generic or company" value={search} onChange={(e) => setSearch(e.target.value)} /><div className="mt-3"><Select value={medicineId} onValueChange={setMedicineId}><SelectTrigger><SelectValue placeholder="Select medicine" /></SelectTrigger><SelectContent>{filtered.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}{m.genericName ? ` · ${m.genericName}` : ""}</SelectItem>)}</SelectContent></Select></div><div className="mt-3 grid gap-3 sm:grid-cols-2"><Input placeholder="Dosage e.g. 1 tablet" value={dosage} onChange={(e) => setDosage(e.target.value)} /><Input placeholder="Frequency e.g. twice daily" value={frequency} onChange={(e) => setFrequency(e.target.value)} /><Input placeholder="Duration e.g. 5 days" value={duration} onChange={(e) => setDuration(e.target.value)} /><Input placeholder="Instructions" value={instructions} onChange={(e) => setInstructions(e.target.value)} /></div><Button className="mt-3" variant="outline" onClick={addLine}><Plus className="mr-2 h-4 w-4" />Add medicine</Button>{items.length > 0 && <div className="mt-4 space-y-2">{items.map((x, i) => <div key={`${x.medicineId}-${i}`} className="flex items-center justify-between rounded border p-2 text-sm"><div><b>{data.medicines.find((m) => m.id === x.medicineId)?.name}</b><div className="text-xs text-muted-foreground">{[x.dosage, x.frequency, x.duration, x.instructions].filter(Boolean).join(" · ")}</div></div><Button size="icon" variant="ghost" onClick={() => setItems((v) => v.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button></div>)}</div>}</div>
      <Label className="mt-4">Notes</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} /><Button className="mt-4" onClick={savePrescription}>Save prescription</Button></section>
      <section className="surface-card p-5"><h2 className="font-display font-semibold">Saved prescriptions</h2><div className="mt-4 space-y-3">{prescriptions.length === 0 ? <p className="text-sm text-muted-foreground">No prescriptions saved yet.</p> : prescriptions.slice().reverse().map((p) => <div key={p.id} className="rounded-lg border p-3"><div className="flex items-start justify-between gap-2"><div><b>{p.patientName}</b><p className="text-xs text-muted-foreground">{p.date.slice(0,10)}{p.doctorName ? ` · Dr. ${p.doctorName}` : ""}</p></div><div className="flex gap-1"><Button size="icon" variant="ghost" onClick={() => printPrescription(p, data)} title="Print"><Printer className="h-4 w-4" /></Button><Button size="icon" variant="ghost" onClick={() => removePrescription(p.id)} title="Delete"><Trash2 className="h-4 w-4" /></Button></div></div><p className="mt-2 text-xs text-muted-foreground">{p.items.length} medicine(s){p.diagnosis ? ` · ${p.diagnosis}` : ""}</p></div>)}</div></section>
    </div>
  </div>;
}
