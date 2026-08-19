import { Keyboard } from "lucide-react";
import { useProjectStore } from "@/store/project-store";
import { Switch } from "@/components/ui/switch";

export function KeyboardSettingsPanel() {
  const data = useProjectStore((s) => s.data);
  const mutate = useProjectStore((s) => s.mutate);
  if (!data) return null;
  const enabled = (data.settings as any).keyboardNavigationEnabled !== false;
  return (
    <section className="surface-card mt-4 p-6">
      <div className="flex items-start gap-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><Keyboard className="h-4 w-4" /></div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <div><h2 className="text-sm font-semibold">Keyboard navigation</h2><p className="text-[11px] text-muted-foreground">Mouse-free Key Tips for the whole pharmacy.</p></div>
            <Switch checked={enabled} onCheckedChange={(v) => mutate((d) => { (d.settings as any).keyboardNavigationEnabled = v; })} aria-label="Enable keyboard navigation" />
          </div>
          <div className="mt-3 grid gap-1 text-[11px] text-muted-foreground">
            <p><kbd className="rounded bg-muted px-1 font-mono">Alt</kbd> — show sidebar Key Tips</p>
            <p><kbd className="rounded bg-muted px-1 font-mono">1–9, 0, A–Z</kbd> — choose a visible Key Tip</p>
            <p><kbd className="rounded bg-muted px-1 font-mono">Tab / Shift+Tab</kbd> — forward / backward through controls</p>
            <p><kbd className="rounded bg-muted px-1 font-mono">Enter / Space</kbd> — activate focused control · <kbd className="rounded bg-muted px-1 font-mono">Esc</kbd> — close Key Tips</p>
          </div>
        </div>
      </div>
    </section>
  );
}
