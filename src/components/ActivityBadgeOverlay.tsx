import { useEffect } from "react";
import { getRecentEvents, type AuditEntry } from "@/lib/audit-log";
import { useSession } from "@/store/session-store";

const PATH_BY_ENTITY: Record<AuditEntry["entityType"], string> = { medicine: "/app/medicines", customer: "/app/customers", supplier: "/app/suppliers", purchase: "/app/purchases", sale: "/app/bills", category: "/app/categories" };
const KEY = "medicore.activity-seen";
function readSeen(userId: string): Record<string, string> { try { return JSON.parse(localStorage.getItem(`${KEY}:${userId}`) || "{}"); } catch { return {}; } }
function writeSeen(userId: string, seen: Record<string, string>) { try { localStorage.setItem(`${KEY}:${userId}`, JSON.stringify(seen)); } catch {} }
function countLabel(n: number) { return n > 9 ? "9+" : String(n); }

/** Adds small cross-user unread activity counters to sidebar navigation. */
export function ActivityBadgeOverlay() {
  const user = useSession((s) => s.user);
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const refresh = async () => {
      const events = await getRecentEvents(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());
      if (cancelled) return;
      const seen = readSeen(user.id);
      const counts: Record<string, number> = {};
      for (const e of events) {
        if (!e.userId || e.userId === user.id) continue;
        const path = PATH_BY_ENTITY[e.entityType];
        if (!path || e.timestamp <= (seen[path] || "")) continue;
        counts[path] = (counts[path] || 0) + 1;
      }
      const links = Array.from(document.querySelectorAll<HTMLAnchorElement>("a[href^='/app/']"));
      for (const link of links) {
        const path = link.getAttribute("href")?.split("?")[0];
        if (!path || !Object.values(PATH_BY_ENTITY).includes(path)) continue;
        const old = link.querySelector<HTMLElement>("[data-activity-badge]");
        const count = counts[path] || 0;
        if (!count) { old?.remove(); continue; }
        const badge = old || document.createElement("span");
        if (!old) {
          badge.setAttribute("data-activity-badge", "true");
          badge.className = "ml-auto grid h-4 min-w-4 shrink-0 place-items-center rounded-full bg-destructive px-1 text-[9px] font-semibold text-destructive-foreground";
          link.appendChild(badge);
        }
        const label = countLabel(count);
        if (badge.textContent !== label) badge.textContent = label;
        badge.title = `${count} new activity${count === 1 ? "" : "ies"}`;
      }
    };
    const markSeen = (event: MouseEvent) => {
      const link = (event.target as HTMLElement).closest<HTMLAnchorElement>("a[href^='/app/']");
      if (!link) return;
      const path = link.getAttribute("href")?.split("?")[0];
      if (!path || !Object.values(PATH_BY_ENTITY).includes(path)) return;
      const next = readSeen(user.id); next[path] = new Date().toISOString(); writeSeen(user.id, next);
      link.querySelector("[data-activity-badge]")?.remove();
    };
    document.addEventListener("click", markSeen, true);
    void refresh();
    const timer = window.setInterval(() => void refresh(), 3000);
    return () => { cancelled = true; window.clearInterval(timer); document.removeEventListener("click", markSeen, true); };
  }, [user?.id]);
  return null;
}
