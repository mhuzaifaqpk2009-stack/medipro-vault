import type { ProjectData } from "@/domain/schema";
import { storeSecret } from "@/lib/electron-bridge";
interface Entity<T> { list: () => Promise<T[]>; get: (id: string) => Promise<T | null>; save: (row: T) => Promise<string | null>; remove: (id: string) => Promise<boolean>; }
export interface ElectronDataAPI {
  isAvailable: () => Promise<boolean>; loadProject: () => Promise<ProjectData | null>; saveProject: (data: ProjectData) => Promise<boolean>; clearProject: () => Promise<boolean>;
  getSettings: () => Promise<{ meta: unknown; settings: unknown } | null>; saveSettings: (meta: unknown, settings: unknown) => Promise<boolean>;
  medicines: Entity<ProjectData["medicines"][number]>; sales: Entity<ProjectData["sales"][number]>; purchases: Entity<ProjectData["purchases"][number]>;
  customers: Entity<ProjectData["customers"][number]>; suppliers: Entity<ProjectData["suppliers"][number]>; categories: Entity<ProjectData["categories"][number]>; stockAdjustments: Entity<ProjectData["stockAdjustments"][number]>;
}
export function dataApi(): ElectronDataAPI | null { if (typeof window === "undefined") return null; return ((window as unknown as { electronAPI?: ElectronDataAPI }).electronAPI) ?? null; }
let cached: boolean | null = null;
export async function sqliteReady(): Promise<boolean> { if (cached !== null) return cached; const api = dataApi(); if (!api) return (cached = false); try { cached = await api.isAvailable(); } catch { cached = false; } return cached; }
export async function dbLoadProject(): Promise<ProjectData | null> { if (!(await sqliteReady())) return null; try { return (await dataApi()!.loadProject()) ?? null; } catch (e) { console.error("sqlite load failed", e); return null; } }
export async function dbSaveProject(data: ProjectData): Promise<boolean> {
  if (!(await sqliteReady())) return false;
  try {
    if (data.settings.backupPassword) storeSecret("backupPassword", data.settings.backupPassword);
    const safe = structuredClone(data);
    delete safe.settings.backupPassword;
    return await dataApi()!.saveProject(safe);
  } catch (e) { console.error("sqlite save failed", e); return false; }
}
export async function dbClearProject(): Promise<boolean> { if (!(await sqliteReady())) return false; try { return await dataApi()!.clearProject(); } catch { return false; } }
