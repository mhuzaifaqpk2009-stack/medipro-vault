import { useNavigate } from "@tanstack/react-router";
import { Save, Home, Sun, Moon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { DirtyBadge } from "@/components/DirtyBadge";
import { useProjectStore } from "@/store/project-store";
import { confirmUnsaved } from "@/hooks/use-unsaved-guard";
import { useSession } from "@/store/session-store";

export function AppTopbar() {
  const navigate = useNavigate();
  const data = useProjectStore((s) => s.data);
  const dirty = useProjectStore((s) => s.dirty);
  const save = useProjectStore((s) => s.save);
  const user = useSession((s) => s.user);
  const isAdmin = user?.role === "admin";
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"));
  }, []);

  // Ctrl+S — saves into internal application storage (no file dialog).
  useEffect(() => {
    const onKey = async (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      if (e.key.toLowerCase() !== "s") return;
      e.preventDefault();
      const ok = await save();
      if (ok) toast.success("Saved");
      else toast.error("Save failed");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [save]);

  // Non-admin users: silent auto-save on every change (debounced).
  const timerRef = useRef<number | null>(null);
  useEffect(() => {
    if (isAdmin) return;
    if (!dirty) return;
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      void useProjectStore.getState().save();
    }, 800);
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [dirty, isAdmin]);

  async function goHome() {
    const choice = await confirmUnsaved();
    if (choice === "cancel") return;
    useSession.getState().clear();
    navigate({ to: "/" });
  }

  function toggleTheme() {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("medicore.theme", next ? "dark" : "light");
  }

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/85 px-3 backdrop-blur">
      <SidebarTrigger />
      <Separator orientation="vertical" className="mx-1 h-6" />
      <div className="flex min-w-0 items-center gap-2">
        <img src="./logo.png" alt="" className="h-6 w-6 object-contain" />
        <span className="truncate font-display text-sm font-semibold">
          {data?.meta.name ?? "Huzaifa Software"}
        </span>
        <DirtyBadge />
      </div>

      <div className="ml-auto flex items-center gap-1">
        <Button variant="ghost" size="icon" onClick={toggleTheme} title="Toggle theme">
          {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>

        {isAdmin && (
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                const ok = await save();
                if (ok) toast.success("Saved");
              }}
              title="Save (Ctrl+S)"
            >
              <Save className="mr-1.5 h-4 w-4" /> Save
            </Button>
            <Separator orientation="vertical" className="mx-1 h-6" />
          </>
        )}
        <Button variant="outline" size="sm" onClick={goHome}>
          <Home className="mr-1.5 h-4 w-4" /> Sign out
        </Button>
      </div>
    </header>
  );
}
