import { createFileRoute } from "@tanstack/react-router";
import { Keyboard } from "lucide-react";
import { useProjectStore } from "@/store/project-store";
import { useSession } from "@/store/session-store";
import { visibleNavItems } from "@/lib/nav";
import { QUICK_ACTIONS, PANEL_ONLY_ACTIONS, effectiveActionHotkey } from "@/lib/quick-actions";
import { effectiveHotkey } from "./app";

export const Route = createFileRoute("/app/shortcuts")({ component: ShortcutsPage });

/** Global shortcuts that aren't stored in settings — documented here so
 * this page stays a complete reference even for the fixed ones. */
const BUILT_IN = [
  { combo: "/", label: "Focus this page's search box" },
  { combo: "Ctrl+/", label: "Focus the top search bar" },
  { combo: "Ctrl+P", label: "Print (checks a printer is available first)" },
  { combo: "Ctrl+Shift+P", label: "Print As (choose printer / save as PDF)" },
  { combo: "F5", label: "Save a backup now" },
  { combo: "Ctrl+Tab", label: "Next tab" },
  { combo: "Ctrl+Shift+Tab", label: "Previous tab" },
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
          <p className="text-sm text-muted-foreground">Read-only reference — ask an admin to change any of these.</p>
        </div>
      </header>

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
            <Row key={b.combo} label={b.label} combo={b.combo} />
          ))}
        </div>
      </section>
    </div>
  );
}
