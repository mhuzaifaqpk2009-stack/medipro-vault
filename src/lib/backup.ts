import { useProjectStore } from "@/store/project-store";
import { pickBackupFolder, writeBackup } from "@/lib/local-store";
import { readSecret, storeSecret } from "@/lib/electron-bridge";

export async function runBackupNow(opts?: { chooseFolder?: boolean }): Promise<string | null> {
  const store = useProjectStore.getState();
  const data = store.data;
  if (!data) return null;
  let folder = data.settings.autoBackupFolder ?? null;
  if (opts?.chooseFolder || !folder) {
    const picked = await pickBackupFolder();
    if (picked) {
      folder = picked;
      useProjectStore.getState().mutate((d) => { d.settings.autoBackupFolder = picked; });
    }
  }
  let pw: string | null = null;
  if (data.settings.backupPasswordEnabled) {
    pw = readSecret("backupPassword");
    // Compatibility for the current session: if the password is still in
    // memory because the user just entered it, immediately migrate it to the
    // OS-backed secret store and use that value for this backup.
    if (!pw && data.settings.backupPassword) {
      storeSecret("backupPassword", data.settings.backupPassword);
      pw = data.settings.backupPassword;
    }
  }
  const bytes = await useProjectStore.getState().exportBytes(pw || undefined);
  if (!bytes) return null;
  const current = useProjectStore.getState().data!;
  const written = await writeBackup(bytes, current.settings.pharmacyName || current.meta.name, folder);
  if (written) await useProjectStore.getState().save();
  return written;
}
