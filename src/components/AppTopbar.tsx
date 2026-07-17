import { useNavigate } from "@tanstack/react-router";
import { Save, FolderOpen, Home, Sun, Moon, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { DirtyBadge } from "@/components/DirtyBadge";
import { useProjectStore } from "@/store/project-store";
import { confirmUnsaved } from "@/hooks/use-unsaved-guard";

export function AppTopbar() {
  const navigate = useNavigate();
  const data = useProjectStore((s) => s.data);
  const save = useProjectStore((s) => s.save);
  const saveAs = useProjectStore((s) => s.saveAs);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"));
  }, []);

  useEffect(() => {
    const onKey = async (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      if (e.key.toLowerCase() === "s") {
        e.preventDefault();
        const ok = e.shiftKey ? await saveAs() : await save();
        if (ok) toast.success("Saved");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [save, saveAs]);

  async function goHome() {
    const choice = await confirmUnsaved();
    if (choice === "cancel") return;
    useProjectStore.getState().close();
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
        <span className="truncate font-display text-sm font-semibold">
          {data?.meta.name ?? "MediCore"}
        </span>
        <DirtyBadge />
      </div>

      <div className="ml-auto flex items-center gap-1">
        <div className="relative hidden md:block">
          <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            placeholder="Search everything…  (Ctrl+F)"
            className="h-9 w-72 rounded-md border bg-muted/40 pl-8 pr-3 text-sm outline-none transition-colors focus:border-ring focus:bg-background"
          />
        </div>

        <Button variant="ghost" size="icon" onClick={toggleTheme} title="Toggle theme">
          {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={async () => {
            const ok = await save();
            if (ok) toast.success("Saved");
          }}
          title="Save (Ctrl+S)"
        >
          <Save className="mr-1.5 h-4 w-4" />
          Save
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={async () => {
            const ok = await saveAs();
            if (ok) toast.success("Saved");
          }}
          title="Save As (Ctrl+Shift+S)"
        >
          <FolderOpen className="mr-1.5 h-4 w-4" />
          Save As
        </Button>
        <Separator orientation="vertical" className="mx-1 h-6" />
        <Button variant="outline" size="sm" onClick={goHome}>
          <Home className="mr-1.5 h-4 w-4" />
          Projects
        </Button>
      </div>
    </header>
  );
}
