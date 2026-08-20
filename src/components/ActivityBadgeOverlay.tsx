import { useEffect } from "react";
import { getRecentEvents, type AuditEntry } from "@/lib/audit-log";
import { useSession } from "@/store/session-store";

const PATH_BY_ENTITY: Record<AuditEntry["entityType"], string> = {
  medicine: "/app/medicines",
  customer: "/app/customers",
  supplier: "/app/suppliers",
  purchase: "/app/purchases",
  sale: "/app/bills",
  category: "/app/categories",
};
const KEY = "medicore.activity-seen";

function readSeen(userId: string): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(`${KEY}:${userId}`) || "{}"); } catch { return {}; }
}
function writeSeen(userId: string, seen: Record<string, string>) { try { localStorage.setItem(`${KEY}:${userId}`, JSON.stringify(seen)); } catch {} }
function countLabel(n: number) { return n > 9 ? "9+" : String(n); }

/** Adds small unread activity counters to sidebar navigation without changing the sidebar layout. */
export function ActivityBadgeOverlay() {
  const user = useSession((s) => s.user);
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const refresh = async () => {
      const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const events = await getRecentEvents(since);
      if (cancelled) return;
      const seen = readSeen(user.id);
      const counts: Record<string, number> = {};
      for (const e of events) {
        if (!e.userId || e.userId === user.id) continue;
        const path = PATH_BY_ENTITY[e.entityType];
        if (!path) continue;
        const seenAt = seen[path] || "";
        if (e.timestamp > seenAt) counts[path] = (counts[path] || 0) + 1;
      }
      const links = Array.from(document.querySelectorAll<HTMLAnchorElement>("a[href^='/app/']"));
      for (const link of links) {
        const path = link.getAttribute("href")?.split("?")[0];
        if (!path || !PATH_BY_ENTITY || !counts[path]) continue;
        let badge = link.querySelector<HTMLElement>("[data-activity-badge]");
        if (!badge) {
          badge = document.createElement("span");
          badge.setAttribute("data-activity-badge", "true");
          badge.className = "ml-auto grid h-4 min-w-4 shrink-0 place-items-center rounded-full bg-destructive px-1 text-[9px] font-semibold text-destructive-foreground";
          link.appendChild(badge);
        }
        badge.textContent = countLabel(counts[path]);
        badge.title = `${counts[path]} new activity${counts[path] === 1 ? "" : "ies"}`;
      }
      for (const link of links) {
        const path = link.getAttribute("href")?.split("?")[0];
        if (!path || !Object.values(PATH_BY_ENTITY).includes(path)) continue;
        link.onclick = () => {
          const next = readSeen(user.id);
          next[path] = new Date().toISOString();
          writeSeen(user.id, next);
          link.querySelector("[data-activity-badge]")?.remove();
        };
      }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 3000);
    const observer = new MutationObserver(() => void refresh());
    observer.observe(document.body, { childList: true, subtree: true });
    return () => { cancelled = true; window.clearInterval(timer); observer.disconnect(); };
  }, [user?.id]);
  return null;
}
