import { createFileRoute, Outlet, redirect, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { toast } from "sonner";
import { runBackupNow } from "@/lib/backup";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { AppTopbar } from "@/components/AppTopbar";
import { PinBar } from "@/components/PinBar";
import { ResizeHandle } from "@/components/ResizeHandle";
import { ItemMenuHost } from "@/lib/pins";
import { useAutoSave } from "@/hooks/use-autosave";
import { useProjectStore } from "@/store/project-store";
import { useSession } from "@/store/session-store";
import { visibleNavItems } from "@/lib/nav";
import {
  comboFromEvent, normaliseCombo, forceCloseOverlays, defaultHotkeyFor,
} from "@/lib/hotkeys";
import {
  QUICK_ACTIONS, effectiveActionHotkey, runQuickAction, type QuickActionId,
} from "@/lib/quick-actions";



/** Resolve the effective combo -> path map for the given tabs. */
export function buildHotkeyMap(
  tabs: { to: string }[],
  custom?: Record<string, string>,
) {
  const map = new Map<string, string>();
  tabs.forEach((t, i) => {
    const combo = custom?.[t.to] || defaultHotkeyFor(i);
    if (!combo) return;
    const key = normaliseCombo(combo);
    if (!map.has(key)) map.set(key, t.to);
  });
  return map;
}

/** Effective (possibly custom) combo label for a tab at a given index. */
export function effectiveHotkey(to: string, index: number, custom?: Record<string, string>) {
  return custom?.[to] || defaultHotkeyFor(index);
}


export const Route = createFileRoute("/app")({
  head: () => ({
    meta: [
      { title: "MediCore Workspace" },
      { name: "robots", content: "noindex" },
    ],
  }),
  beforeLoad: () => {
    if (typeof window !== "undefined") {
      if (!useSession.getState().user) throw redirect({ to: "/" });
      if (!useProjectStore.getState().data) throw redirect({ to: "/" });
    }
  },
  component: AppLayout,
});

function AppLayout() {
  useAutoSave();
  const data = useProjectStore((s) => s.data);
  const user = useSession((s) => s.user);
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const enabled = data?.settings.tabShortcutsEnabled !== false;

  /** Always the sidebar's live visual order — reordering tabs remaps shortcuts. */
  const visibleTabs = useMemo(
    () => visibleNavItems(data?.settings, user),
    [data?.settings, user],
  );



  // combo string (normalised) -> tab path
  const hotkeyMap = useMemo(
    () => buildHotkeyMap(visibleTabs, data?.settings.tabHotkeys),
    [visibleTabs, data?.settings.tabHotkeys],
  );

  // combo string (normalised) -> quick action id (Ctrl+M etc.)
  const actionMap = useMemo(() => {
    const m = new Map<string, QuickActionId>();
    for (const a of QUICK_ACTIONS) {
      const combo = effectiveActionHotkey(a.id, data?.settings.actionHotkeys);
      if (combo) m.set(normaliseCombo(combo), a.id);
    }
    return m;
  }, [data?.settings.actionHotkeys]);

  // Quick actions (new medicine / purchase / customer / supplier) + undo & redo.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const combo = comboFromEvent(e);
      if (!combo) return;
      const key = normaliseCombo(combo);
      const el = document.activeElement as HTMLElement | null;
      const typing = el?.tagName === "INPUT" || el?.tagName === "TEXTAREA" || el?.isContentEditable;

      if (key === "ctrl+z" || key === "ctrl+y" || key === "ctrl+shift+z") {
        if (typing) return;
        e.preventDefault();
        const store = useProjectStore.getState();
        const ok = key === "ctrl+z" ? store.undo() : store.redo();
        if (ok) toast.success(key === "ctrl+z" ? "Undone" : "Redone");
        else toast.message(key === "ctrl+z" ? "Nothing to undo" : "Nothing to redo");
        return;
      }

      const action = actionMap.get(key);
      if (!action) return;
      // Never trigger while a dialog/panel is open.
      if (document.querySelector('[role="dialog"],[role="alertdialog"]')) return;
      e.preventDefault();
      e.stopPropagation();
      forceCloseOverlays();
      runQuickAction(action, navigate);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [actionMap, navigate]);


  useEffect(() => {
    if (!enabled) return;
    const go = (to: string) => {
      forceCloseOverlays();
      navigate({ to });
      window.dispatchEvent(new CustomEvent("medicore:nav-flash", { detail: to }));
    };
    const handler = (e: KeyboardEvent) => {
      // Any open dialog/panel takes precedence — never switch tabs from inside one.
      if (document.querySelector('[role="dialog"],[role="alertdialog"]')) return;
      const el = document.activeElement as HTMLElement | null;
      const typing = el?.tagName === "INPUT" || el?.tagName === "TEXTAREA" || !!el?.isContentEditable;

      // Ctrl+Tab / Ctrl+Shift+Tab — cycle from the currently open tab, wrapping around.
      if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key === "Tab") {
        if (visibleTabs.length === 0) return;
        e.preventDefault();
        e.stopPropagation();
        // Longest matching path wins so "/app" doesn't shadow "/app/sales".
        let currentIdx = -1;
        let bestLen = -1;
        visibleTabs.forEach((t, i) => {
          const hit = t.exact ? pathname === t.to : pathname === t.to || pathname.startsWith(t.to + "/");
          if (hit && t.to.length > bestLen) { bestLen = t.to.length; currentIdx = i; }
        });
        const base = currentIdx < 0 ? 0 : currentIdx;
        const nextIdx = e.shiftKey
          ? (base - 1 + visibleTabs.length) % visibleTabs.length
          : (base + 1) % visibleTabs.length;
        go(visibleTabs[nextIdx].to);
        return;
      }

      const combo = comboFromEvent(e);
      if (!combo) return;
      const to = hotkeyMap.get(normaliseCombo(combo));
      if (!to) return;
      if (typing && !(e.ctrlKey || e.metaKey || e.altKey)) return;
      e.preventDefault();
      e.stopPropagation();
      go(to);
    };
    // Capture phase so open dialogs/inputs cannot swallow the shortcut.
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [enabled, visibleTabs, hotkeyMap, navigate, pathname]);


  // "/" — jump into the current page's search box. Ctrl+/ — top panel search.
  useEffect(() => {
    const onSlash = (e: KeyboardEvent) => {
      if (e.key !== "/" && e.code !== "Slash") return;
      if (e.altKey) return;
      const global = e.ctrlKey || e.metaKey;
      const el = document.activeElement as HTMLElement | null;
      const tag = el?.tagName;
      if (!global && (tag === "INPUT" || tag === "TEXTAREA" || el?.isContentEditable)) return;
      const search = global
        ? document.querySelector<HTMLInputElement>("[data-global-search]")
        : document.querySelector<HTMLInputElement>("[data-search]");
      if (!search) return;
      e.preventDefault();
      search.focus();
      search.select();
    };
    window.addEventListener("keydown", onSlash, true);
    return () => window.removeEventListener("keydown", onSlash, true);
  }, [pathname]);



  // F5 — create/overwrite a backup in the saved folder.
  useEffect(() => {
    const onKey = async (e: KeyboardEvent) => {
      if (e.key !== "F5") return;
      e.preventDefault();
      e.stopPropagation();
      try {
        const written = await runBackupNow();
        if (written) toast.success(`Backup saved: ${written}`);
      } catch (err: any) {
        toast.error(err?.message ?? "Backup failed");
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);

  const mutate = useProjectStore((s) => s.mutate);
  const sidebarWidth = Math.min(420, Math.max(180, data?.settings.sidebarWidth ?? 256));

  if (!data) return null;


  return (
    <SidebarProvider
      style={{ "--sidebar-width": `${sidebarWidth}px` } as React.CSSProperties}
    >
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        <ResizeHandle
          orientation="vertical"
          value={sidebarWidth}
          min={180}
          max={420}
          onChange={(v) => mutate((d) => { d.settings.sidebarWidth = v; })}
          className="hidden md:block"
        />
        <SidebarInset className="flex min-w-0 flex-1 flex-col">
          <AppTopbar />
          <main className="flex-1 overflow-auto">
            <Outlet />
          </main>
          <PinBar />
        </SidebarInset>
      </div>
      <ItemMenuHost />
    </SidebarProvider>
  );
}

