import { useEffect } from "react";
import { useProjectStore } from "@/store/project-store";
import { isPersistentHandle } from "@/lib/project-io";

export function useAutoSave() {
  const data = useProjectStore((s) => s.data);
  const handle = useProjectStore((s) => s.handle);
  const dirty = useProjectStore((s) => s.dirty);

  const interval = data?.settings.autoSaveIntervalMinutes ?? 5;
  const enabled = !!data?.settings.autoSaveEnabled && isPersistentHandle(handle);

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
