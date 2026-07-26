import { useNavigate } from "@tanstack/react-router";
import { Save, FolderOpen, Home, Sun, Moon, Search, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { DirtyBadge } from "@/components/DirtyBadge";
import { useProjectStore } from "@/store/project-store";
import { confirmUnsaved } from "@/hooks/use-unsaved-guard";
import { pickOpenFile } from "@/lib/project-io";
import { openProjectFromBytes } from "@/store/project-store";
import { WrongPasswordError, decodeProject } from "@/lib/project-codec";
import { updateInstall } from "@/lib/install";
import { useSession } from "@/store/session-store";
import { askPassword } from "@/components/PasswordPromptDialog";

export function AppTopbar() {
  const navigate = useNavigate();
  const data = useProjectStore((s) => s.data);
  const dirty = useProjectStore((s) => s.dirty);
  const save = useProjectStore((s) => s.save);
  const saveAs = useProjectStore((s) => s.saveAs);
  const user = useSession((s) => s.user);
  const isAdmin = user?.role === "admin";
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"));
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
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
  }, [save, saveAs, isAdmin]);

  // Non-admin users: silent auto-save every change (debounced).
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
    useProjectStore.getState().close();
    useSession.getState().clear();
    navigate({ to: "/" });
  }

  async function loadData() {
    const choice = await confirmUnsaved();
    if (choice === "cancel") return;
    try {
      const picked = await pickOpenFile();
      if (!picked) return;
      const currentPw = useProjectStore.getState().password;
      try {
        const d = await openProjectFromBytes(picked.bytes, picked.handle, currentPw);
        if (picked.handle.fsPath) updateInstall({ lastFsPath: picked.handle.fsPath, lastPath: picked.handle.path });
        toast.success(`Loaded ${d.meta.name}`);
      } catch (e) {
        if (e instanceof WrongPasswordError) {
          const pw = await askPassword("Enter password", "This file is encrypted. Enter its password to load.");
          if (!pw) return;
          try {
            const d = await openProjectFromBytes(picked.bytes, picked.handle, pw);
            if (picked.handle.fsPath) updateInstall({ lastFsPath: picked.handle.fsPath, lastPath: picked.handle.path });
            toast.success(`Loaded ${d.meta.name}`);
          } catch {
            try {
              await decodeProject(picked.bytes);
              await openProjectFromBytes(picked.bytes, picked.handle);
              toast.success("Loaded");
            } catch {
              toast.error("Wrong password");
            }
          }
        } else {
          toast.error("Could not load file");
        }
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Load failed");
    }
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
        {isAdmin && (
          <div className="relative hidden md:block">
            <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              placeholder="Search everything…"
              className="h-9 w-72 rounded-md border bg-muted/40 pl-8 pr-3 text-sm outline-none transition-colors focus:border-ring focus:bg-background"
            />
          </div>
        )}

        <Button variant="ghost" size="icon" onClick={toggleTheme} title="Toggle theme">
          {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>

        {isAdmin && (
          <>
            <Button variant="ghost" size="sm" onClick={loadData} title="Load Data">
              <Upload className="mr-1.5 h-4 w-4" /> Load Data
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                const ok = await save();
                if (ok) toast.success("Saved");
              }}
              title="Save Data (Ctrl+S)"
            >
              <Save className="mr-1.5 h-4 w-4" /> Save Data
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
              <FolderOpen className="mr-1.5 h-4 w-4" /> Save As
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
