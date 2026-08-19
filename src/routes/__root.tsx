import type { QueryClient } from "@tanstack/react-query";
import { Outlet, createRootRouteWithContext, useRouter } from "@tanstack/react-router";
import { useEffect } from "react";
import { Toaster, toast } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { usePointerEventsWatchdog } from "@/hooks/use-pointer-events-watchdog";
import { useProjectStore } from "@/store/project-store";

function NotFoundComponent() { return <div className="flex min-h-screen items-center justify-center bg-background px-4"><div className="max-w-md text-center"><h1 className="font-display text-7xl font-bold">404</h1><p className="mt-2 text-sm text-muted-foreground">Page not found.</p></div></div>; }
function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) { const router = useRouter(); return <div className="flex min-h-screen items-center justify-center bg-background px-6"><div className="max-w-md text-center"><h1 className="font-display text-2xl font-semibold">Something went wrong</h1><p className="mt-2 text-sm text-muted-foreground">{error.message}</p><button onClick={() => { router.invalidate(); reset(); }} className="mt-6 inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90">Try again</button></div></div>; }

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({ component: RootComponent, notFoundComponent: NotFoundComponent, errorComponent: ErrorComponent });

function normalizeShortcut(s: string) { return s.toLowerCase().replace(/\s+/g, "").replace(/control/g, "ctrl"); }
function eventShortcut(e: KeyboardEvent) { const parts: string[] = []; if (e.ctrlKey) parts.push("ctrl"); if (e.altKey) parts.push("alt"); if (e.shiftKey) parts.push("shift"); if (e.metaKey) parts.push("meta"); if (!["Control", "Alt", "Shift", "Meta"].includes(e.key)) parts.push(e.key.length === 1 ? e.key : e.key.toLowerCase()); return parts.join("+"); }

function RootComponent() {
  usePointerEventsWatchdog();
  const router = useRouter(); const project = useProjectStore((s) => s.data);
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const shortcut = eventShortcut(e); if (!shortcut || !project?.settings.macros?.length) return;
      const macro = project.settings.macros.find((m) => m.enabled && normalizeShortcut(m.shortcut) === shortcut);
      if (!macro) return;
      e.preventDefault(); e.stopPropagation();
      try {
        const raw = sessionStorage.getItem("medipro:macro"); const active = raw ? JSON.parse(raw) as { id?: string; index?: number } : null;
        const index = active?.id === macro.id ? (active.index ?? -1) + 1 : 0;
        if (index >= macro.steps.length) { sessionStorage.removeItem("medipro:macro"); toast.success(`${macro.name} completed`); return; }
        sessionStorage.setItem("medipro:macro", JSON.stringify({ id: macro.id, index }));
        void router.navigate({ to: macro.steps[index].to });
        toast.success(`${macro.name}: ${macro.steps[index].label}`);
      } catch { sessionStorage.removeItem("medipro:macro"); }
    };
    window.addEventListener("keydown", onKeyDown, true); return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [project, router]);
  return <TooltipProvider delayDuration={300}><Outlet /><Toaster position="bottom-right" richColors closeButton /></TooltipProvider>;
}
