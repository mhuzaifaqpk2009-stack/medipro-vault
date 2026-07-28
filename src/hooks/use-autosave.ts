import { useEffect } from "react";
import { useProjectStore } from "@/store/project-store";
import { runAutoBackupIfDue } from "@/lib/auto-backup";

export function useAutoSave() {
  const data = useProjectStore((s) => s.data);
  const dirty = useProjectStore((s) => s.dirty);

  const interval = data?.settings.autoSaveIntervalMinutes ?? 5;
  const enabled = !!data?.settings.autoSaveEnabled;

  useEffect(() => {
    if (!enabled) return;
    const ms = interval * 60_000;
    const id = window.setInterval(() => {
      if (useProjectStore.getState().dirty) {
        void useProjectStore.getState().save();
      }
    }, ms);
    return () => window.clearInterval(id);
  }, [enabled, interval]);

  // Periodic auto-backup check (every 5 minutes; the helper decides if due).
  useEffect(() => {
    void runAutoBackupIfDue();
    const id = window.setInterval(() => void runAutoBackupIfDue(), 5 * 60_000);
    return () => window.clearInterval(id);
  }, []);

  // Warn before unloading a dirty project.
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);
}
