import { useNavigate } from "@tanstack/react-router";
import { Save, Home, Sun, Moon, HardDriveDownload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { DirtyBadge } from "@/components/DirtyBadge";
import { MedicineSearch } from "@/components/MedicineSearch";
import { ResizeHandle } from "@/components/ResizeHandle";
import { pinContext } from "@/lib/pins";
import { runBackupNow } from "@/lib/backup";
import { useProjectStore } from "@/store/project-store";
import { confirmUnsaved } from "@/hooks/use-unsaved-guard";
import { useSession } from "@/store/session-store";
import { NotificationBell } from "@/components/NotificationBell";
export function AppTopbar() {
  const navigate = useNavigate(); const data = useProjectStore((s) => s.data); const dirty = useProjectStore((s) => s.dirty); const save = useProjectStore((s) => s.save); const mutate = useProjectStore((s) => s.mutate); const user = useSession((s) => s.user); const isAdmin = user?.role === "admin"; const [isDark, setIsDark] = useState(false);
  useEffect(() => { setIsDark(document.documentElement.classList.contains("dark")); }, []);
  useEffect(() => { const onKey = async (e: KeyboardEvent) => { if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== "s") return; e.preventDefault(); const ok = await save(); if (ok) toast.success("Saved"); else toast.error("Save failed"); }; window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey); }, [save]);
  const timerRef = useRef<number | null>(null); useEffect(() => { if (isAdmin || !dirty) return; if (timerRef.current) window.clearTimeout(timerRef.current); timerRef.current = window.setTimeout(() => { void useProjectStore.getState().save(); }, 800); return () => { if (timerRef.current) window.clearTimeout(timerRef.current); }; }, [dirty, isAdmin]);
  async function goHome() { const choice = await confirmUnsaved(); if (choice === "cancel") return; useSession.getState().clear(); navigate({ to: "/" }); }
  function toggleTheme() { const next = !isDark; setIsDark(next); document.documentElement.classList.toggle("dark", next); localStorage.setItem("medicore.theme", next ? "dark" : "light"); }
  const height = Math.min(96, Math.max(44, data?.settings.topbarHeight ?? 56));
  return <div className="sticky top-0 z-30"><header className="flex items-center gap-2 border-b bg-background/85 px-3 backdrop-blur" style={{ height }}><SidebarTrigger /><Separator orientation="vertical" className="mx-1 h-6" /><div className="flex min-w-0 items-center gap-2"><img src="./logo.png" alt="" className="h-6 w-6 object-contain" draggable={false} /><span className="truncate font-display text-sm font-semibold">{data?.meta.name ?? "Huzaifa Software"}</span><DirtyBadge /></div><div className="ml-auto flex items-center gap-2"><MedicineSearch />{isAdmin && <NotificationBell />}<Button variant="ghost" size="icon" onClick={toggleTheme} title="Toggle theme">{isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}</Button>{isAdmin && <><Button variant="ghost" size="sm" {...pinContext({ id: "cmd:save", label: "Save", kind: "cmd" })} onClick={async () => { const ok = await save(); if (ok) toast.success("Saved"); }} title="Save (Ctrl+S) · right-click to pin"><Save className="mr-1.5 h-4 w-4" /> Save</Button><Button variant="ghost" size="sm" {...pinContext({ id: "cmd:backup", label: "Backup", kind: "cmd" })} onClick={async () => { try { const written = await runBackupNow(); if (written) toast.success(`Backup saved: ${written}`); } catch (e: any) { toast.error(e?.message ?? "Backup failed"); } }} title="Create backup (F5) · right-click to pin"><HardDriveDownload className="mr-1.5 h-4 w-4" /> Backup</Button><Separator orientation="vertical" className="mx-1 h-6" /></>}<Button variant="outline" size="sm" onClick={goHome}><Home className="mr-1.5 h-4 w-4" /> Sign out</Button></div></header><ResizeHandle orientation="horizontal" value={height} min={44} max={96} onChange={(v) => mutate((d) => { d.settings.topbarHeight = v; })} /></div>;
}