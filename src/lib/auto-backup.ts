import { useProjectStore } from "@/store/project-store";
import { writeBackup } from "@/lib/local-store";

/** Runs a portable backup when auto-backup is on, configured, and due. */
export async function runAutoBackupIfDue(): Promise<boolean> {
  const store = useProjectStore.getState();
  const data = store.data;
  if (!data) return false;
  const s = data.settings;
  if (!s.autoBackupEnabled || !s.autoBackupFolder) return false;

  const hours = Math.max(1, s.autoBackupIntervalHours ?? 24);
  const last = s.lastAutoBackupAt ?? 0;
  if (Date.now() - last < hours * 3_600_000) return false;

  const bytes = await store.exportBytes();
  if (!bytes) return false;
  try {
    await writeBackup(bytes, s.pharmacyName || data.meta.name, s.autoBackupFolder);
    useProjectStore.getState().mutate((d) => {
      d.settings.lastAutoBackupAt = Date.now();
    });
    await useProjectStore.getState().save();
    return true;
  } catch (e) {
    console.error("auto backup failed", e);
    return false;
  }
}
