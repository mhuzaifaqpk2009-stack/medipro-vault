import { useProjectStore } from "@/store/project-store";

export function useCurrencySymbol() {
  return useProjectStore((s) => s.data?.settings.currencySymbol ?? "$");
}
export function money(n: number, sym = "$") {
  const v = Number.isFinite(n) ? n : 0;
  return `${sym}${v.toFixed(2)}`;
}
export function uid(prefix = "") {
  return prefix + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}
export function daysUntil(iso?: string): number | null {
  if (!iso) return null;
  const d = new Date(iso).getTime();
  if (Number.isNaN(d)) return null;
  return Math.ceil((d - Date.now()) / 86400_000);
}
