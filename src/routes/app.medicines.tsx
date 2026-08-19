import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Pill, Plus, Search, Pencil, Trash2, AlertTriangle, CalendarX, History, Camera, ScanLine } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useProjectStore } from "@/store/project-store";
import { uid, money, useCurrencySymbol, daysUntil } from "@/lib/format";
import { PermissionGate } from "@/components/PermissionGate";
import { BarcodeScanner } from "@/components/BarcodeScanner";
import { pinContext } from "@/lib/pins";
import { useQuickAction, effectiveActionHotkey } from "@/lib/quick-actions";
import { comboFromEvent, normaliseCombo } from "@/lib/hotkeys";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from "@/components/ui/context-menu";
import type { Medicine } from "@/domain/schema";
import { isMultiMode } from "@/lib/install";
import { isAdmin, currentUser } from "@/store/session-store";
import { logMedicineAudit, getMedicineAuditLog, type AuditEntry } from "@/lib/audit-log";
import { canAddMedicine, canEditMedicine, canDeleteMedicine } from "@/lib/granular-permissions";
import { ArrowUpDown, Pin, PinOff } from "lucide-react";

export const Route = createFileRoute("/app/medicines")({ component: () => <PermissionGate perm="medicines"><MedicinesPage /></PermissionGate> });

const empty = (): Medicine => ({ id: "", name: "", genericName: "", company: "", batchNumber: "", barcode: "", qrCode: "", purchasePrice: 0, salePrice: 0, mrp: 0, stockQuantity: 0, minimumStock: 5, expiryDate: "", rackNumber: "" });
type MedicineSearchBy = "name" | "generic" | "company";
type MedicineTab = "catalog" | "codes";

const normalizeCode = (value?: string) => (value ?? "").trim().toLowerCase();

function MedicinesPage() {
  const meds = useProjectStore((s) => s.data!.medicines);
  const sales = useProjectStore((s) => s.data!.sales);
  const mutate = useProjectStore((s) => s.mutate);
  const sym = useCurrencySymbol();
  const [tab, setTab] = useState<MedicineTab>("catalog");
  const [q, setQ] = useState(() => { const seed = typeof window !== "undefined" ? sessionStorage.getItem("medicore.medsearch") : null; if (seed) sessionStorage.removeItem("medicore.medsearch"); return seed ?? ""; });
  const [rackFilter, setRackFilter] = useState<string>("all");
  const allowedRackNames = useProjectStore.getState().data?.settings.racks?.map(r=>r.name).filter(n=>currentUser()?.allowedRackNames?.includes(n)) ?? [];
  const [searchBy, setSearchBy] = useState<MedicineSearchBy>(() => { const saved = useProjectStore.getState().data?.settings.defaultSearchBy; return saved === "generic" || saved === "company" ? saved : "name"; });
  const [editing, setEditing] = useState<Medicine | null>(null);
  const [formKey, setFormKey] = useState(0);
  const [dupe, setDupe] = useState<{ m: Medicine; existingId: string; keepOpen: boolean } | null>(null);
  const [historyFor, setHistoryFor] = useState<Medicine | null>(null);
  const [codeQuery, setCodeQuery] = useState("");
  const [codeScannerOpen, setCodeScannerOpen] = useState(false);
  const [codeResult, setCodeResult] = useState<Medicine | null | undefined>(undefined);
  const user = currentUser();
  const canSeeHistory = isMultiMode() && isAdmin();
  const canAdd = canAddMedicine(user);
  const canEdit = canEditMedicine(user);
  const canDelete = canDeleteMedicine(user);
  const canPin = canEdit;
  const openNew = useCallback((prefill?: { barcode?: string; qrCode?: string }) => { if (!canAdd) return; setFormKey((k) => k + 1); setEditing({ ...empty(), ...prefill }); }, [canAdd]);
  useQuickAction("new-medicine", () => openNew());

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    const base = currentUser()?.role === "admin" || !currentUser()?.permissions.racks ? meds : meds.filter(m => !!m.rackNumber && allowedRackNames.includes(m.rackNumber));
    if (!s) return rackFilter === "all" ? base : base.filter(m => (m.rackNumber ?? "") === rackFilter);
    const field = (m: Medicine) => searchBy === "generic" ? m.genericName : searchBy === "company" ? m.company : m.name;
    return base.filter((m) => (field(m) ?? "").toLowerCase().includes(s) && (rackFilter === "all" || (m.rackNumber ?? "") === rackFilter));
  }, [meds, q, searchBy]);

  type SortBy = "name" | "expiry" | "lowStock" | "topSelling";
  const [sortBy, setSortBy] = useState<SortBy>("name");
  const qtySoldMap = useMemo(() => { const map = new Map<string, number>(); for (const s of sales) { if (s.status === "cancelled") continue; for (const it of s.items) map.set(it.medicineId, (map.get(it.medicineId) ?? 0) + it.quantity); } return map; }, [sales]);
  const sorted = useMemo(() => { const arr = [...filtered]; const cmp: Record<SortBy, (a: Medicine, b: Medicine) => number> = { name: (a,b)=>a.name.localeCompare(b.name), expiry:(a,b)=>(a.expiryDate||"9999-99-99").localeCompare(b.expiryDate||"9999-99-99"), lowStock:(a,b)=>(a.stockQuantity-(a.minimumStock??0))-(b.stockQuantity-(b.minimumStock??0)), topSelling:(a,b)=>(qtySoldMap.get(b.id)??0)-(qtySoldMap.get(a.id)??0) }; arr.sort(cmp[sortBy]); const first=arr.filter((m)=>m.pinOrder==="first"), last=arr.filter((m)=>m.pinOrder==="last"), rest=arr.filter((m)=>m.pinOrder!=="first"&&m.pinOrder!=="last"); return [...first,...rest,...last]; }, [filtered, sortBy, qtySoldMap]);

  const PAGE_SIZE = 100;
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  useEffect(() => { setPage(1); }, [q, sortBy, searchBy]);
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [totalPages, page]);
  const pageStart = (page - 1) * PAGE_SIZE;
  const pageItems = useMemo(() => sorted.slice(pageStart, pageStart + PAGE_SIZE), [sorted, pageStart]);

  const exactCodeMatch = useMemo(() => {
    const code = normalizeCode(codeQuery);
    if (!code) return undefined;
    return meds.find((m) => normalizeCode(m.barcode) === code || normalizeCode(m.qrCode) === code);
  }, [meds, codeQuery]);

  useEffect(() => { if (!codeQuery.trim()) setCodeResult(undefined); else setCodeResult(exactCodeMatch ?? null); }, [codeQuery, exactCodeMatch]);

  const handleCodeScan = useCallback(({ value }: { value: string; format?: string }) => {
    setCodeScannerOpen(false);
    setCodeQuery(value);
  }, []);

  function setPin(id: string, pin: "first" | "last" | undefined) { mutate((d) => { const i=d.medicines.findIndex((x)=>x.id===id); if(i>=0)d.medicines[i]={...d.medicines[i],pinOrder:pin}; }); }
  function commit(m: Medicine, keepOpen: boolean, overrideId?: string) {
    const targetId=m.id||overrideId, isEdit=!!targetId, finalId=targetId||uid("med_");
    mutate((d)=>{ if(targetId){const i=d.medicines.findIndex((x)=>x.id===targetId); if(i>=0)d.medicines[i]={...m,id:targetId};} else d.medicines.push({...m,id:finalId}); });
    toast.success(overrideId?"Existing medicine updated":"Medicine saved"); const u=currentUser(); void logMedicineAudit({entityId:finalId,action:isEdit?"edit":"add",username:u?.username,userId:u?.id,medicineName:m.name,quantity:m.stockQuantity,price:m.salePrice}); if(keepOpen){setFormKey((k)=>k+1);setEditing(empty());} else setEditing(null);
  }
  function save(m: Medicine, keepOpen=false) {
    if(!m.name.trim()){toast.error("Name is required");return;}
    const code = normalizeCode(m.barcode), qr = normalizeCode(m.qrCode);
    const existingCode = meds.find((x) => x.id !== m.id && ((code && normalizeCode(x.barcode) === code) || (qr && normalizeCode(x.qrCode) === qr)));
    if(existingCode){toast.error(`This ${code && normalizeCode(existingCode.barcode) === code ? "barcode" : "QR code"} is already assigned to ${existingCode.name}`);return;}
    if(!m.id){const key=m.name.trim().toLowerCase();const existing=meds.find((x)=>x.name.trim().toLowerCase()===key);if(existing){setDupe({m,existingId:existing.id,keepOpen});return;}}
    commit(m,keepOpen);
  }
  function remove(id:string){if(!canDelete)return;if(!confirm("Delete this medicine?"))return;const m=meds.find((x)=>x.id===id);mutate((d)=>{d.medicines=d.medicines.filter((m)=>m.id!==id);});const u=currentUser();void logMedicineAudit({entityId:id,action:"delete",username:u?.username,userId:u?.id,medicineName:m?.name,quantity:m?.stockQuantity,price:m?.salePrice});toast.success("Deleted");}

  return <div className="mx-auto max-w-7xl p-6 md:p-8">
    <header className="mb-5 flex items-center gap-3"><div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-primary to-primary-glow text-primary-foreground shadow-soft"><Pill className="h-5 w-5" /></div><div><h1 className="font-display text-2xl font-bold tracking-tight">Medicines</h1><p className="text-sm text-muted-foreground">{meds.length} SKU{meds.length===1?"":"s"} in catalog</p></div>
      <div className="ml-auto flex items-center gap-2">
        <div className="flex rounded-lg border bg-muted/30 p-0.5"><Button size="sm" variant={tab==="catalog"?"secondary":"ghost"} onClick={()=>setTab("catalog")}>Catalog</Button><Button size="sm" variant={tab==="codes"?"secondary":"ghost"} onClick={()=>setTab("codes")}><ScanLine className="mr-1.5 h-3.5 w-3.5" />Barcode / QR</Button></div>
        {tab==="catalog" && <><div className="flex items-center gap-1.5"><Select value={searchBy} onValueChange={(v)=>setSearchBy(v as MedicineSearchBy)}><SelectTrigger className="h-9 w-[104px] shrink-0 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="name">Name</SelectItem><SelectItem value="generic">Generic</SelectItem><SelectItem value="company">Company</SelectItem></SelectContent></Select><Select value={rackFilter} onValueChange={setRackFilter}><SelectTrigger className="h-9 w-36"><SelectValue placeholder="All racks" /></SelectTrigger><SelectContent><SelectItem value="all">All racks</SelectItem>{(useProjectStore.getState().data?.settings.racks ?? []).filter(r=>r.active).map(r=><SelectItem key={r.id} value={r.name}>{r.name}</SelectItem>)}</SelectContent></Select><div className="relative"><Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input data-search placeholder={searchBy==="name"?"Search medicine name…":searchBy==="generic"?"Search generic name…":"Search company name…"} autoFocus value={q} onChange={(e)=>setQ(e.target.value)} className="h-9 w-56 pl-8" /></div></div><Select value={sortBy} onValueChange={(v)=>setSortBy(v as SortBy)}><SelectTrigger className="h-9 w-40"><ArrowUpDown className="mr-1.5 h-3.5 w-3.5 text-muted-foreground" /><SelectValue /></SelectTrigger><SelectContent><SelectItem value="name">Name</SelectItem><SelectItem value="expiry">Expiry date</SelectItem><SelectItem value="lowStock">Low stock</SelectItem><SelectItem value="topSelling">Top selling</SelectItem></SelectContent></Select></>}
        {canAdd && <Button {...pinContext({id:"action:new-medicine",label:"New medicine",kind:"action",to:"/app/medicines"})} onClick={()=>openNew()}><Plus className="mr-1.5 h-4 w-4" />Add medicine</Button>}
      </div>
    </header>

    {tab === "codes" ? <BarcodeSearchPanel query={codeQuery} setQuery={setCodeQuery} result={codeResult} onScan={()=>setCodeScannerOpen(true)} onAdd={(value)=>openNew(value.format==="qr_code"?{qrCode:value.code}:{barcode:value.code})} canAdd={canAdd} /> : <>
      <div className="surface-card overflow-hidden"><Table><TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Batch</TableHead><TableHead>Barcode</TableHead><TableHead>QR</TableHead><TableHead className="text-right">Stock</TableHead><TableHead className="text-right">Sale</TableHead><TableHead>Expiry</TableHead><TableHead className="w-24"></TableHead></TableRow></TableHeader><TableBody>{sorted.length===0&&<TableRow><TableCell colSpan={8} className="py-14 text-center text-sm text-muted-foreground">No medicines. Add your first SKU.</TableCell></TableRow>}{pageItems.map((m)=><MedicineRow key={m.id} m={m} sym={sym} canSeeHistory={canSeeHistory} canEdit={canEdit} canDelete={canDelete} canPin={canPin} onEdit={()=>{if(!canEdit)return;setFormKey((k)=>k+1);setEditing(m);}} onDelete={()=>remove(m.id)} onHistory={()=>setHistoryFor(m)} onPin={(pin)=>setPin(m.id,pin)} />)}</TableBody></Table></div>
      {sorted.length>PAGE_SIZE&&<div className="mt-3 flex items-center justify-between text-sm text-muted-foreground"><span>Showing {pageStart+1}–{Math.min(pageStart+PAGE_SIZE,sorted.length)} of {sorted.length}</span><div className="flex items-center gap-2"><Button size="sm" variant="outline" disabled={page<=1} onClick={()=>setPage((p)=>Math.max(1,p-1))}>Previous</Button><span className="tabular-nums">Page {page} of {totalPages}</span><Button size="sm" variant="outline" disabled={page>=totalPages} onClick={()=>setPage((p)=>Math.min(totalPages,p+1))}>Next</Button></div></div>}
    </>}

    <MedicineHistoryDialog medicine={historyFor} onClose={()=>setHistoryFor(null)} /><MedicineEditor key={formKey} value={editing} onCancel={()=>setEditing(null)} onSave={save} />
    <BarcodeScanner open={codeScannerOpen} onClose={()=>setCodeScannerOpen(false)} onDetected={handleCodeScan} title="Scan medicine barcode or QR code" />
    <AlertDialog open={!!dupe} onOpenChange={(o)=>!o&&setDupe(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Medicine already exists</AlertDialogTitle><AlertDialogDescription>A medicine named "{dupe?.m.name}" already exists. Override the existing one, or cancel?</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={()=>{if(dupe)commit(dupe.m,dupe.keepOpen,dupe.existingId);setDupe(null);}}>Override</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </div>;
}

function BarcodeSearchPanel({query,setQuery,result,onScan,onAdd,canAdd}:{query:string;setQuery:(v:string)=>void;result:Medicine|null|undefined;onScan:()=>void;onAdd:(value:{code:string;format?:string})=>void;canAdd:boolean}){
  return <div className="surface-card p-5"><div className="mb-4 flex items-center gap-2"><ScanLine className="h-5 w-5 text-primary" /><div><h2 className="font-display text-lg font-semibold">Barcode / QR search</h2><p className="text-sm text-muted-foreground">Type a code manually or scan it. Barcode and QR codes use the same search.</p></div></div><div className="flex gap-2"><div className="relative flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input autoFocus value={query} onChange={(e)=>setQuery(e.target.value)} onKeyDown={(e)=>{if(e.key==="Enter")e.preventDefault();}} placeholder="Enter barcode or QR code…" className="h-11 pl-9" /></div><Button variant="outline" className="h-11" onClick={onScan}><Camera className="mr-2 h-4 w-4" />Scan</Button></div>{query.trim() && result ? <div className="mt-5 rounded-xl border bg-muted/20 p-4"><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Match found</p><div className="mt-1 flex items-center justify-between gap-4"><div><p className="font-display text-lg font-semibold">{result.name}</p><p className="text-sm text-muted-foreground">Barcode: {result.barcode || "—"} · QR: {result.qrCode || "—"}</p></div><span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">Matched medicine</span></div></div> : query.trim() ? <div className="mt-5 rounded-xl border border-dashed p-5"><p className="font-medium">No match found</p><p className="mt-1 text-sm text-muted-foreground">No medicine is assigned to <span className="font-mono">{query.trim()}</span>.</p>{canAdd && <Button className="mt-3" onClick={()=>onAdd({code:query.trim()})}><Plus className="mr-2 h-4 w-4" />Add new medicine with this code</Button>}</div> : <div className="mt-5 rounded-lg bg-muted/30 p-4 text-sm text-muted-foreground">Use a USB/Bluetooth scanner while this field is focused, or use the camera Scan button.</div>}</div>;
}

function MedicineEditor({value,onCancel,onSave}:{value:Medicine|null;onCancel:()=>void;onSave:(m:Medicine,keepOpen?:boolean)=>void}){
  const categories=useProjectStore((s)=>s.data!.categories); const actionHotkeys=useProjectStore((s)=>s.data!.settings.actionHotkeys); const [m,setM]=useState<Medicine|null>(value); const cur=m??value??empty(); const quickCombo=effectiveActionHotkey("quick-add-medicine",actionHotkeys); const [scannerOpen,setScannerOpen]=useState(false); const [scanTarget,setScanTarget]=useState<"barcode"|"qr">("barcode");
  useEffect(()=>{if(!value||value.id)return;const onKey=(e:KeyboardEvent)=>{const combo=comboFromEvent(e);if(!combo||!quickCombo)return;if(normaliseCombo(combo)!==normaliseCombo(quickCombo))return;e.preventDefault();e.stopPropagation();onSave(m??value,true);};window.addEventListener("keydown",onKey,true);return()=>window.removeEventListener("keydown",onKey,true);},[value,m,quickCombo,onSave]);
  useEffect(()=>{if(!value||value.id)return;setScanTarget("barcode");setScannerOpen(true);},[value]);
  const handleScan=useCallback(({value,format}:{value:string;format?:string})=>{setScannerOpen(false);setM({...cur,...(format==="qr_code"||scanTarget==="qr"?{qrCode:value}:{barcode:value})});},[cur,scanTarget]);
  if(!value)return null; const upd=(k:keyof Medicine,v:any)=>setM({...cur,[k]:v});
  return <Dialog open onOpenChange={(o)=>!o&&onCancel()}><DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto"><DialogHeader><DialogTitle>{value.id?"Edit medicine":"New medicine"}</DialogTitle></DialogHeader><div className="grid gap-3 sm:grid-cols-2"><F label="Name *"><Input value={cur.name} onChange={(e)=>upd("name",e.target.value)} placeholder="Medicine name" autoFocus /></F><F label="Generic name"><Input value={cur.genericName??""} onChange={(e)=>upd("genericName",e.target.value)} placeholder="Generic name" /></F><F label="Company"><Input value={cur.company??""} onChange={(e)=>upd("company",e.target.value)} placeholder="Manufacturer / company" /></F><F label="Category (optional)"><Select value={cur.categoryId||"none"} onValueChange={(v)=>upd("categoryId",v==="none"?"":v)}><SelectTrigger><SelectValue placeholder="Uncategorised" /></SelectTrigger><SelectContent><SelectItem value="none">Uncategorised</SelectItem>{categories.map((c)=><SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select></F>
    <F label="Barcode"><div className="flex gap-1.5"><Input value={cur.barcode??""} onChange={(e)=>upd("barcode",e.target.value)} placeholder="Type or scan barcode" /><Button type="button" size="icon" variant="outline" title="Scan barcode" onClick={()=>{setScanTarget("barcode");setScannerOpen(true);}}><Camera className="h-4 w-4" /></Button></div></F>
    <F label="QR code"><div className="flex gap-1.5"><Input value={cur.qrCode??""} onChange={(e)=>upd("qrCode",e.target.value)} placeholder="Type or scan QR code" /><Button type="button" size="icon" variant="outline" title="Scan QR code" onClick={()=>{setScanTarget("qr");setScannerOpen(true);}}><Camera className="h-4 w-4" /></Button></div></F>
    <F label="Batch #"><Input value={cur.batchNumber??""} onChange={(e)=>upd("batchNumber",e.target.value)} placeholder="Batch number" /></F><F label="Rack"><Input value={cur.rackNumber??""} onChange={(e)=>upd("rackNumber",e.target.value)} placeholder="Rack / shelf" /></F><F label="Purchase price"><Input type="number" value={cur.purchasePrice||""} onChange={(e)=>upd("purchasePrice",+e.target.value||0)} placeholder="0.00" /></F><F label="Sale price"><Input type="number" value={cur.salePrice||""} onChange={(e)=>upd("salePrice",+e.target.value||0)} placeholder="0.00" /></F><F label="MRP"><Input type="number" value={cur.mrp||""} onChange={(e)=>upd("mrp",+e.target.value||0)} placeholder="0.00" /></F><F label="Stock"><Input type="number" value={cur.stockQuantity||""} onChange={(e)=>upd("stockQuantity",+e.target.value||0)} placeholder="0" /></F><F label="Minimum stock"><Input type="number" value={cur.minimumStock||""} onChange={(e)=>upd("minimumStock",+e.target.value||0)} placeholder="5" /></F><F label="Expiry (YYYY-MM-DD)"><Input type="date" value={cur.expiryDate??""} onChange={(e)=>upd("expiryDate",e.target.value)} /></F></div><DialogFooter><Button variant="ghost" onClick={onCancel}>Cancel</Button>{!value.id&&<Button variant="secondary" onClick={()=>onSave(cur,true)}>Quick Add{quickCombo?` (${quickCombo})`:""}</Button>}<Button onClick={()=>onSave(cur)}>Save</Button></DialogFooter><BarcodeScanner open={scannerOpen} onClose={()=>setScannerOpen(false)} onDetected={handleScan} title={scanTarget==="qr"?"Scan QR code":"Scan barcode"} /></DialogContent></Dialog>;
}
function F({label,children}:{label:string;children:React.ReactNode}){return <div><Label className="mb-1 block text-xs font-medium text-muted-foreground">{label}</Label>{children}</div>}
function MedicineRow({m,sym,canSeeHistory,canEdit,canDelete,canPin,onEdit,onDelete,onHistory,onPin}:{m:Medicine;sym:string;canSeeHistory:boolean;canEdit:boolean;canDelete:boolean;canPin:boolean;onEdit:()=>void;onDelete:()=>void;onHistory:()=>void;onPin:(pin:"first"|"last"|undefined)=>void}){
  const low=m.stockQuantity<=(m.minimumStock??0),d=daysUntil(m.expiryDate),expired=d!==null&&d<0,near=d!==null&&d>=0&&d<=30;
  const row=<TableRow><TableCell><div className="flex items-center gap-1.5 font-medium">{m.pinOrder&&<Pin className="h-3 w-3 shrink-0 text-primary" />}{m.name}</div><div className="text-xs text-muted-foreground">{m.genericName||m.company||"—"}</div></TableCell><TableCell className="font-mono text-xs">{m.batchNumber||"—"}</TableCell><TableCell className="font-mono text-xs">{m.barcode||"—"}</TableCell><TableCell className="font-mono text-xs">{m.qrCode||"—"}</TableCell><TableCell className="text-right tabular-nums"><span className={low?"font-semibold text-warning":""}>{m.stockQuantity}</span>{low&&<AlertTriangle className="ml-1 inline h-3 w-3 text-warning" />}</TableCell><TableCell className="text-right tabular-nums">{money(m.salePrice,sym)}</TableCell><TableCell className="text-xs">{m.expiryDate?<span className={expired?"text-destructive font-medium":near?"text-warning":""}>{m.expiryDate}{expired&&<> · <CalendarX className="inline h-3 w-3" /></>}</span>:"—"}</TableCell><TableCell className="text-right">{canEdit&&<Button size="icon" variant="ghost" onClick={onEdit}><Pencil className="h-4 w-4" /></Button>}{canDelete&&<Button size="icon" variant="ghost" onClick={onDelete}><Trash2 className="h-4 w-4 text-destructive" /></Button>}</TableCell></TableRow>;
  if(!canSeeHistory&&!canPin)return row;
  return <ContextMenu><ContextMenuTrigger asChild>{row}</ContextMenuTrigger><ContextMenuContent>{canSeeHistory&&<ContextMenuItem onSelect={()=>setTimeout(onHistory,0)}><History className="mr-2 h-4 w-4" /> Report</ContextMenuItem>}{canPin&&<><ContextMenuItem onSelect={()=>onPin("first")}><Pin className="mr-2 h-4 w-4" /> Make first</ContextMenuItem><ContextMenuItem onSelect={()=>onPin("last")}><Pin className="mr-2 h-4 w-4 rotate-180" /> Make last</ContextMenuItem>{m.pinOrder&&<ContextMenuItem onSelect={()=>onPin(undefined)}><PinOff className="mr-2 h-4 w-4" /> Clear pin</ContextMenuItem>}</>}</ContextMenuContent></ContextMenu>;
}
function MedicineHistoryDialog({medicine,onClose}:{medicine:Medicine|null;onClose:()=>void}){const [entries,setEntries]=useState<AuditEntry[]>([]);const [loading,setLoading]=useState(false);const sym=useCurrencySymbol();useEffect(()=>{if(!medicine)return;let cancelled=false;setLoading(true);getMedicineAuditLog(medicine.id).then((rows)=>{if(!cancelled)setEntries(rows);}).finally(()=>{if(!cancelled)setLoading(false);});return()=>{cancelled=true;};},[medicine]);return <Dialog open={!!medicine} onOpenChange={(o)=>!o&&onClose()}><DialogContent className="max-w-lg max-h-[75vh] overflow-y-auto"><DialogHeader><DialogTitle>{medicine?.name} — history</DialogTitle></DialogHeader>{loading?<p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>:entries.length===0?<p className="py-8 text-center text-sm text-muted-foreground">No recorded history for this medicine yet.</p>:<ul className="divide-y">{entries.map((e)=><li key={e.id} className="py-2.5 text-sm"><span className="font-medium">{e.action==="add"?"Added":"Edited"} by {e.username||"Unknown"}</span><span className="text-muted-foreground"> on {new Date(e.timestamp).toLocaleString()}</span>{" — "}{e.quantity??0} stock at {money(e.price??0,sym)}</li>)}</ul>}</DialogContent></Dialog>;}
