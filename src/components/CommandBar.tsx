import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Search, Command, ArrowRight } from "lucide-react";
import { useProjectStore } from "@/store/project-store";
import { useSession } from "@/store/session-store";
import { visibleNavItems } from "@/lib/nav";
import { QUICK_ACTIONS, runQuickAction, effectiveActionHotkey } from "@/lib/quick-actions";

export function CommandBar() {
  const navigate = useNavigate();
  const data = useProjectStore((s) => s.data);
  const user = useSession((s) => s.user);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const commands = useMemo(() => {
    const tabs = visibleNavItems(data?.settings, user).map((item) => ({
      id: `nav:${item.to}`,
      label: item.label,
      description: `Go to ${item.label}`,
      shortcut: data?.settings.tabHotkeys?.[item.to] || "",
      run: () => navigate({ to: item.to }),
    }));
    const actions = QUICK_ACTIONS.filter((a) => a.id !== "quick-add-medicine").map((a) => ({
      id: `action:${a.id}`,
      label: a.label,
      description: `Execute ${a.label}`,
      shortcut: effectiveActionHotkey(a.id, data?.settings.actionHotkeys),
      run: () => runQuickAction(a.id, navigate),
    }));
    return [...tabs, ...actions];
  }, [data?.settings, user, navigate]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands.slice(0, 12);
    return commands.filter((c) => `${c.label} ${c.description} ${c.shortcut}`.toLowerCase().includes(q)).slice(0, 12);
  }, [commands, query]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey || e.key.toLowerCase() !== "k") return;
      e.preventDefault();
      e.stopPropagation();
      setOpen(true);
      setQuery("");
      requestAnimationFrame(() => inputRef.current?.focus());
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const execute = (command: (typeof commands)[number]) => {
    setOpen(false);
    setQuery("");
    command.run();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black/30 p-4 pt-[12vh]" onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
      <div className="mx-auto w-full max-w-2xl overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-2xl" role="dialog" aria-modal="true" aria-label="Command bar">
        <div className="flex items-center gap-2 border-b px-4">
          <Search className="h-5 w-5 shrink-0 text-muted-foreground" />
          <input ref={inputRef} autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search, navigate, or run an action…" className="h-14 min-w-0 flex-1 bg-transparent text-base outline-none" aria-label="Command search" />
          <kbd className="rounded border bg-muted px-2 py-1 text-xs text-muted-foreground">Esc</kbd>
        </div>
        <div className="max-h-[55vh] overflow-y-auto p-2" role="listbox">
          {results.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">No matching command.</div>
          ) : results.map((command, index) => (
            <button key={command.id} type="button" onClick={() => execute(command)} className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left hover:bg-accent focus:bg-accent focus:outline-none" autoFocus={index === 0 && query.length > 0}>
              <Command className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1"><span className="block font-medium">{command.label}</span><span className="block text-xs text-muted-foreground">{command.description}</span></span>
              {command.shortcut && <kbd className="rounded border bg-muted px-2 py-1 text-xs text-muted-foreground">{command.shortcut}</kbd>}
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </button>
          ))}
        </div>
        <div className="flex items-center gap-4 border-t px-4 py-2 text-xs text-muted-foreground"><span><kbd className="rounded border px-1">Ctrl</kbd> + <kbd className="rounded border px-1">K</kbd> Open</span><span>Type to search</span><span>Enter to run</span></div>
      </div>
    </div>
  );
}
