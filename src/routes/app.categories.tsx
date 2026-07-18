import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Tags, Plus, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useProjectStore } from "@/store/project-store";
import { uid } from "@/lib/format";

export const Route = createFileRoute("/app/categories")({ component: CategoriesPage });

function CategoriesPage() {
  const list = useProjectStore((s) => s.data!.categories);
  const mutate = useProjectStore((s) => s.mutate);
  const [name, setName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  function add() {
    if (!name.trim()) return;
    mutate((d) => { d.categories.push({ id: uid("cat_"), name: name.trim() }); });
    setName(""); toast.success("Added");
  }
  function del(id: string) {
    if (!confirm("Delete category?")) return;
    mutate((d) => { d.categories = d.categories.filter((c) => c.id !== id); });
  }
  function saveRename() {
    if (!editingId || !editingName.trim()) return;
    mutate((d) => { const c = d.categories.find((x) => x.id === editingId); if (c) c.name = editingName.trim(); });
    setEditingId(null); setEditingName("");
  }

  return (
    <div className="mx-auto max-w-3xl p-6 md:p-8">
      <header className="mb-5 flex items-center gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-primary to-primary-glow text-primary-foreground shadow-soft"><Tags className="h-5 w-5" /></div>
        <div><h1 className="font-display text-2xl font-bold">Categories</h1><p className="text-sm text-muted-foreground">{list.length} categor{list.length === 1 ? "y" : "ies"}</p></div>
      </header>

      <div className="surface-card p-4">
        <div className="mb-4 flex gap-2">
          <Input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} placeholder="New category name…" />
          <Button onClick={add}><Plus className="mr-1 h-4 w-4" />Add</Button>
        </div>
        {list.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">No categories yet.</p>
        ) : (
          <ul className="divide-y">
            {list.map((c) => (
              <li key={c.id} className="flex items-center gap-2 py-2">
                {editingId === c.id ? (
                  <>
                    <Input value={editingName} onChange={(e) => setEditingName(e.target.value)} className="h-8" autoFocus />
                    <Button size="sm" onClick={saveRename}>Save</Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>Cancel</Button>
                  </>
                ) : (
                  <>
                    <span className="flex-1">{c.name}</span>
                    <Button size="icon" variant="ghost" onClick={() => { setEditingId(c.id); setEditingName(c.name); }}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => del(c.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
