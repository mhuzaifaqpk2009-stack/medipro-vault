import { Maximize2, Redo2, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useProjectStore } from "@/store/project-store";
import { toast } from "sonner";

export function WorkspaceTopControls({ fullscreen = false }: { fullscreen?: boolean }) {
  const undo = useProjectStore((s) => s.undo);
  const redo = useProjectStore((s) => s.redo);
  const toggleFullscreen = () => window.dispatchEvent(new CustomEvent("medicore:toggle-fullscreen"));
  const doUndo = () => { if (undo()) toast.success("Undone"); else toast.message("Nothing to undo"); };
  const doRedo = () => { if (redo()) toast.success("Redone"); else toast.message("Nothing to redo"); };
  if (fullscreen) return null;
  return <div className="flex h-full items-center gap-0.5 border-l pl-1" aria-label="Workspace controls">
    <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={doUndo} title="Undo (Ctrl+Z)" aria-label="Undo"><Undo2 className="h-4 w-4" /></Button>
    <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={doRedo} title="Redo (Ctrl+Y)" aria-label="Redo"><Redo2 className="h-4 w-4" /></Button>
    <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={toggleFullscreen} title="Maximize current panel (F2)" aria-label="Maximize current panel"><Maximize2 className="h-4 w-4" /></Button>
  </div>;
}
