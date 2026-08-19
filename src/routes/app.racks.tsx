import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { MapPin, Plus, Pencil, Trash2, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useProjectStore } from "@/store/project-store";
import { PermissionGate } from "@/components/PermissionGate";
import { uid } from "@/lib/format";
import type { Rack } from "@/domain/schema";

export const Route = createFileRoute("/app/racks")({ component: () => <PermissionGate perm="racks"><RacksPage /></PermissionGate> });
const emptyRack = (): Rack => ({ id: "", name: "", description: "", active: true, createdAt: new Date().toISOString() });
function RacksPage(){
  const data=useProjectStore(s=>s.data)!; const mutate=useProjectStore(s=>s.mutate); const racks=data.settings.racks ?? [];
  const [editing,setEditing]=useState<Rack|null>(null); const [q,setQ]=useState("");
  const meds=data.medicines;
  const rows=useMemo(()=>racks.filter(r=>r.name.toLowerCase().includes(q.trim().toLowerCase())),[racks,q]);
  function save(r:Rack){ const name=r.name.trim(); if(!name){toast.error("Rack name is required");return;} const dup=racks.find(x=>x.id!==r.id&&x.name.trim().toLowerCase()===name.toLowerCase()); if(dup){toast.error("A rack with this name already exists");return;} mutate(d=>{d.settings.racks=[...(d.settings.racks??[]),{...r,id:r.id||uid("rack_"),name}].filter((x,i,a)=>a.findIndex(y=>y.id===x.id)===i);}); setEditing(null); toast.success("Rack saved"); }
  function remove(id:string){const r=racks.find(x=>x.id===id); if(!r)return; if(meds.some(m=>(m.rackNumber??"").trim()===r.name.trim())){toast.error("This rack is assigned to medicines. Move those medicines first.");return;} if(!confirm(`Delete rack \"${r.name}\"?`))return; mutate(d=>{d.settings.racks=(d.settings.racks??[]).filter(x=>x.id!==id);});}
  return <div className="mx-auto max-w-6xl p-6 md:p-8"><header className="mb-5 flex items-center gap-3"><div className="grid h-11 w-11 place-items-center rounded-xl bg-primary text-primary-foreground"><MapPin className="h-5 w-5"/></div><div><h1 className="font-display text-2xl font-bold">Racks</h1><p className="text-sm text-muted-foreground">Define the physical rack names used by your pharmacy.</p></div><div className="ml-auto flex gap-2"><div className="relative"><Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"/><Input className="h-9 pl-8" placeholder="Search racks…" value={q} onChange={e=>setQ(e.target.value)}/></div><Button onClick={()=>setEditing(emptyRack())}><Plus className="mr-1.5 h-4 w-4"/>Add rack</Button></div></header><div className="surface-card overflow-hidden"><div className="divide-y">{rows.map(r=><div key={r.id} className="flex items-center gap-3 p-4"><MapPin className="h-4 w-4 text-primary"/><div className="min-w-0 flex-1"><p className="font-medium">{r.name}</p><p className="text-xs text-muted-foreground">{r.description||"No description"} · {meds.filter(m=>(m.rackNumber??"").trim()===r.name.trim()).length} medicines</p></div><span className="text-xs text-muted-foreground">{r.active?"Active":"Inactive"}</span><Button size="sm" variant="ghost" onClick={()=>setEditing(r)}><Pencil className="h-4 w-4"/></Button><Button size="sm" variant="ghost" onClick={()=>remove(r.id)}><Trash2 className="h-4 w-4 text-destructive"/></Button></div>)}{rows.length===0&&<div className="p-10 text-center text-sm text-muted-foreground">No racks yet. Add the rack names used in your pharmacy.</div>}</div></div><Dialog open={!!editing} onOpenChange={o=>!o&&setEditing(null)}><DialogContent><DialogHeader><DialogTitle>{editing?.id?"Edit rack":"Add rack"}</DialogTitle></DialogHeader>{editing&&<div className="space-y-4"><div><Label>Rack name</Label><Input autoFocus placeholder="Enter your pharmacy's rack name" value={editing.name} onChange={e=>setEditing({...editing,name:e.target.value})}/><p className="mt-1 text-xs text-muted-foreground">There are no preset rack names. Use whatever numbering/labeling your pharmacy uses.</p></div><div><Label>Description (optional)</Label><Input value={editing.description??""} onChange={e=>setEditing({...editing,description:e.target.value})}/></div></div>}<DialogFooter><Button variant="outline" onClick={()=>setEditing(null)}>Cancel</Button><Button onClick={()=>editing&&save(editing)}>Save rack</Button></DialogFooter></DialogContent></Dialog></div>
}
