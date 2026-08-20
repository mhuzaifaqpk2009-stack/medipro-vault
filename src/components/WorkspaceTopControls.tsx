import { Maximize2, Minimize2, Redo2, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useProjectStore } from "@/store/project-store";
import { toast } from "sonner";

export function WorkspaceTopControls({ fullscreen = false }: { fullscreen?: boolean }) {
  const undo = useProjectStore((s) => s.undo);
  const redo = useProjectStore((s) => s.redo);
  const toggleFullscreen = () => window.dispatchEvent(new CustomEvent("medicore:toggle-fullscreen"));
  const doUndo = () => { if (undo()) toast.success("Undone"); else toast.message("Nothing to undo"); };
  const doRedo = () => { if (redo()) toast.success("Redone"); else toast.message("Nothing to redo"); };
  return <div className={fullscreen ? "fixed right-3 top-3 z-[120] flex items-center gap-1 rounded-lg border bg-background/90 p-1 shadow-lg backdrop-blur" : "fixed right-3 top-2 z-[80] flex items-center gap-1 rounded-lg border bg-background/90 p-1 shadow-md backdrop-blur"}>
    <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={doUndo} title="Undo (Ctrl+Z)" aria-label="Undo"><Undo2 className="h-4 w-4" /></Button>
    <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={doRedo} title="Redo (Ctrl+Y)" aria-label="Redo"><Redo2 className="h-4 w-4" /></Button>
    <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={toggleFullscreen} title={fullscreen ? "Return to normal (F2)" : "Maximize tab (F2)"} aria-label={fullscreen ? "Return to normal" : "Maximize tab"}>{fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}</Button>
  </div>;
}
