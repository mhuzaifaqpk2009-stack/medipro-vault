import React, { useMemo, useState } from "react";
import type { PharmacyRack } from "../domain/racks";

export default function RacksPage() {
  const [racks, setRacks] = useState<PharmacyRack[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const active = useMemo(() => racks.filter(r => r.active), [racks]);

  function addRack() {
    const value = name.trim();
    if (!value) return;
    if (active.some(r => r.name.toLowerCase() === value.toLowerCase())) return;
    setRacks(prev => [...prev, { id: crypto.randomUUID(), name: value, description: description.trim() || undefined, active: true }]);
    setName(""); setDescription("");
  }

  return <div className="space-y-6 p-6">
    <div><h1 className="text-2xl font-semibold">Racks</h1><p className="text-muted-foreground">Manage the physical medicine locations in your pharmacy.</p></div>
    <div className="rounded-lg border p-4 space-y-3">
      <h2 className="font-medium">Add Rack</h2>
      <div className="flex gap-2 flex-wrap">
        <input aria-label="Rack name" className="border rounded px-3 py-2" placeholder="Rack 2AC" value={name} onChange={e => setName(e.target.value)} onKeyDown={e => { if (e.key === "Enter") addRack(); }} />
        <input aria-label="Rack description" className="border rounded px-3 py-2" placeholder="Description (optional)" value={description} onChange={e => setDescription(e.target.value)} />
        <button className="rounded bg-primary px-4 py-2 text-primary-foreground" onClick={addRack}>Add Rack</button>
      </div>
    </div>
    <div className="rounded-lg border">
      <div className="border-b p-4 font-medium">Available Racks ({active.length})</div>
      {active.length === 0 ? <div className="p-6 text-muted-foreground">No racks added yet.</div> : active.map(r => <div key={r.id} className="flex items-center justify-between border-b last:border-0 p-4"><div><div className="font-medium">{r.name}</div>{r.description && <div className="text-sm text-muted-foreground">{r.description}</div>}</div><button className="text-sm underline" onClick={() => setRacks(prev => prev.map(x => x.id === r.id ? { ...x, active: false } : x))}>Deactivate</button></div>)}
    </div>
  </div>;
}
