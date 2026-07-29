import { useProjectStore } from "@/store/project-store";
import { pickBackupFolder, writeBackup } from "@/lib/local-store";

/**
 * Create a backup of the whole project (medicines, sales, bills, customers,
 * purchases, suppliers, categories, settings — everything in the data file).
 *
 * The chosen folder is remembered in settings; later backups reuse it and
 * overwrite the previous file unless `chooseFolder` is passed.
 */
export async function runBackupNow(opts?: { chooseFolder?: boolean }): Promise<string | null> {
  const store = useProjectStore.getState();
  const data = store.data;
  if (!data) return null;

  let folder = data.settings.autoBackupFolder ?? null;
  if (opts?.chooseFolder || !folder) {
    const picked = await pickBackupFolder();
    if (picked) {
      folder = picked;
      useProjectStore.getState().mutate((d) => {
        d.settings.autoBackupFolder = picked;
      });
    }
  }

  const bytes = await useProjectStore.getState().exportBytes();
  if (!bytes) return null;

  const current = useProjectStore.getState().data!;
  const written = await writeBackup(
    bytes,
    current.settings.pharmacyName || current.meta.name,
    folder,
  );
  if (written) await useProjectStore.getState().save();
  return written;
}
