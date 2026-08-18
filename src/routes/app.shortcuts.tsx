import { createFileRoute } from "@tanstack/react-router";
import { Keyboard } from "lucide-react";
import { useProjectStore } from "@/store/project-store";
import { useSession } from "@/store/session-store";
import { visibleNavItems } from "@/lib/nav";
import { QUICK_ACTIONS, PANEL_ONLY_ACTIONS, effectiveActionHotkey } from "@/lib/quick-actions";
import { effectiveHotkey } from "./app";

export const Route = createFileRoute("/app/shortcuts")({ component: ShortcutsPage });

const BUILT_IN = [
  { combo: "Alt", label: "Show keyboard Key Tips for the sidebar; press a number to open a tab" },
  { combo: "Alt → 1/2/3… or A/B/C…", label: "Choose a sidebar item, then Key Tips appear for page controls" },
  { combo: "1/2/3… or A/B/C…", label: "Activate a visible page control while Key Tips are open" },
  { combo: "Tab / Shift+Tab", label: "Move forward / backward through every keyboard-focusable control" },
  { combo: "Enter / Space", label: "Activate the focused button, link, tab or toggle" },
  { combo: "Esc", label: "Close Key Tips, menus, dialogs and popovers" },
  { combo: "/", label: "Focus this page's search box" },
  { combo: "Ctrl+/", label: "Focus the top search bar" },
  { combo: "Ctrl+P", label: "Print (checks a printer is available first)" },
  { combo: "Ctrl+Shift+P", label: "Print As (choose printer / save as PDF)" },
  { combo: "F5", label: "Save a backup now" },
  { combo: "Ctrl+Esc", label: "Sign out / logout" },
  { combo: "Ctrl+Tab", label: "Next workspace tab" },
  { combo: "Ctrl+Shift+Tab", label: "Previous workspace tab" },
  { combo: "Ctrl+Z", label: "Undo" },
  { combo: "Ctrl+Y", label: "Redo" },
];

function Row({ label, combo }: { label: string; combo: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm">
      <span className="truncate">{label}</span>
      <kbd className="shrink-0 rounded bg-muted px-2 py-0.5 font-mono text-xs">{combo}</kbd>
    </div>
  );
}

function ShortcutsPage() {
  const data = useProjectStore((s) => s.data);
  const user = useSession((s) => s.user);
  const tabs = visibleNavItems(data?.settings, user);
  const actions = QUICK_ACTIONS.filter((a) => !PANEL_ONLY_ACTIONS.includes(a.id) || a.id === "quick-add-medicine");

  return (
    <div className="mx-auto max-w-3xl p-6 md:p-8">
      <header className="mb-6 flex items-center gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-primary to-primary-glow text-primary-foreground shadow-soft">
          <Keyboard className="h-5 w-5" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold">Keyboard shortcuts</h1>
          <p className="text-sm text-muted-foreground">Complete keyboard reference — every normal button, link, input, tab and toggle remains reachable with Tab / Shift+Tab, while Key Tips provide fast mouse-free access.</p>
        </div>
      </header>

      <section className="surface-card mb-4 border-primary/30 bg-primary/5 p-5">
        <h2 className="mb-2 font-display text-base font-semibold">Mouse-free Key Tips</h2>
        <p className="text-sm text-muted-foreground">Press <kbd className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">Alt</kbd> anywhere outside a text field. The sidebar receives numbered/lettered Key Tips. Choose one to open the tab; Key Tips then appear over the page's interactive controls. Press the displayed key to focus or activate that control.</p>
        <p className="mt-2 text-xs text-muted-foreground">Press <kbd className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">Esc</kbd> to close Key Tips. Inside forms, <kbd className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">Tab</kbd> and <kbd className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">Shift+Tab</kbd> provide the normal forward/backward path.</p>
      </section>

      <section className="surface-card mb-4 p-5">
        <h2 className="mb-3 font-display text-sm font-semibold text-muted-foreground">Go to a tab</h2>
        <div className="grid gap-1.5 sm:grid-cols-2">
          {tabs.map((t, i) => (
            <Row key={t.to} label={t.label} combo={effectiveHotkey(t.to, i, data?.settings.tabHotkeys)} />
          ))}
        </div>
      </section>

      <section className="surface-card mb-4 p-5">
        <h2 className="mb-3 font-display text-sm font-semibold text-muted-foreground">Quick actions</h2>
        <div className="grid gap-1.5 sm:grid-cols-2">
          {actions.map((a) => (
            <Row key={a.id} label={a.label} combo={effectiveActionHotkey(a.id, data?.settings.actionHotkeys)} />
          ))}
        </div>
      </section>

      <section className="surface-card p-5">
        <h2 className="mb-3 font-display text-sm font-semibold text-muted-foreground">Built-in</h2>
        <div className="grid gap-1.5 sm:grid-cols-2">
          {BUILT_IN.map((b) => (
            <Row key={`${b.combo}-${b.label}`} label={b.label} combo={b.combo} />
          ))}
        </div>
      </section>
    </div>
  );
}
