import { useEffect, useMemo, useState } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useProjectStore } from "@/store/project-store";
import { useSession } from "@/store/session-store";
import { visibleNavItems } from "@/lib/nav";

type Mode = "sidebar" | "page" | null;
type Target = { el: HTMLElement; key: string; label: string; rect: DOMRect };
const KEY_POOL = ["1","2","3","4","5","6","7","8","9","0",..."ABCDEFGHIJKLMNOPQRSTUVWXYZ"];

function isVisible(el: HTMLElement) {
  if (el.closest('[aria-hidden="true"]')) return false;
  if ((el as HTMLButtonElement).disabled) return false;
  const style = window.getComputedStyle(el);
  if (style.display === "none" || style.visibility === "hidden") return false;
  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function labelFor(el: HTMLElement) {
  return el.getAttribute("aria-label") || el.getAttribute("title") || el.textContent?.trim().replace(/\s+/g, " ").slice(0, 60) || "Control";
}

function sidebarTargets(): Target[] {
  const selector = [
    'aside a[href^="/app/"]',
    '[data-sidebar="sidebar"] a[href^="/app/"]',
    '[data-sidebar="sidebar"] [data-sidebar="menu-button"]',
    '[data-sidebar="sidebar"] [data-sidebar="menu-item"] > a[href^="/app/"]',
  ].join(",");
  const seen = new Set<HTMLElement>();
  const links = Array.from(document.querySelectorAll<HTMLElement>(selector)).filter((el) => {
    if (seen.has(el)) return false;
    seen.add(el);
    return isVisible(el) && !!(el.getAttribute("href")?.startsWith("/app/") || el.closest('a[href^="/app/"]'));
  });
  return links.map((el, i) => ({ el, key: KEY_POOL[i] ?? "", label: labelFor(el), rect: el.getBoundingClientRect() })).filter((x) => x.key);
}

function pageTargets(): Target[] {
  const selector = [
    'button:not([data-keyboard-ignore])',
    'a[href]:not([data-keyboard-ignore])',
    'input:not([type="hidden"]):not([data-keyboard-ignore])',
    'textarea:not([data-keyboard-ignore])',
    'select:not([data-keyboard-ignore])',
    '[role="button"]:not([data-keyboard-ignore])',
    '[role="tab"]:not([data-keyboard-ignore])',
    '[role="checkbox"]:not([data-keyboard-ignore])',
    '[role="radio"]:not([data-keyboard-ignore])',
    '[role="combobox"]:not([data-keyboard-ignore])',
  ].join(",");
  const els = Array.from(document.querySelectorAll<HTMLElement>(selector)).filter((el) => isVisible(el) && !el.closest("aside") && !el.closest('[data-sidebar="sidebar"]'));
  return els.map((el, i) => ({ el, key: KEY_POOL[i] ?? "", label: labelFor(el), rect: el.getBoundingClientRect() })).filter((x) => x.key);
}

function activate(target: Target) {
  const el = target.el;
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement || el.getAttribute("role") === "combobox") {
    el.focus();
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) el.select();
    return;
  }
  el.focus();
  el.click();
}

export function KeyboardNavigator() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: s => s.location.pathname });
  const data = useProjectStore(s => s.data);
  const user = useSession(s => s.user);
  const enabled = (data?.settings as any)?.keyboardNavigationEnabled !== false;
  const tabs = useMemo(() => visibleNavItems(data?.settings, user), [data?.settings, user]);
  const [mode, setMode] = useState<Mode>(null);
  const [targets, setTargets] = useState<Target[]>([]);

  useEffect(() => {
    if (!enabled) return;
    const refresh = () => {
      if (mode === "sidebar") setTargets(sidebarTargets());
      if (mode === "page") setTargets(pageTargets());
    };
    refresh();
    window.addEventListener("resize", refresh);
    window.addEventListener("scroll", refresh, true);
    return () => { window.removeEventListener("resize", refresh); window.removeEventListener("scroll", refresh, true); };
  }, [enabled, mode, pathname]);

  useEffect(() => {
    if (!enabled) return;
    const openSidebar = () => {
      setMode("sidebar");
      window.setTimeout(() => setTargets(sidebarTargets()), 30);
    };
    const onKey = (e: KeyboardEvent) => {
      const source = (e.target as HTMLElement | null);
      const typing = source?.tagName === "INPUT" || source?.tagName === "TEXTAREA" || source?.isContentEditable;
      if (e.key === "Escape" && mode) {
        e.preventDefault(); e.stopPropagation(); setMode(null); setTargets([]); return;
      }
      if (e.key === "Alt" && !e.ctrlKey && !e.metaKey && !e.shiftKey && !typing) {
        e.preventDefault(); e.stopPropagation(); if (mode) { setMode(null); setTargets([]); } else openSidebar(); return;
      }
      if (!mode) return;
      if (e.key === "Tab" && !e.ctrlKey && !e.metaKey) { setMode(null); setTargets([]); return; }
      const key = e.key.length === 1 ? e.key.toUpperCase() : e.key;
      const target = targets.find(t => t.key === key);
      if (!target) return;
      e.preventDefault(); e.stopPropagation();
      if (mode === "sidebar") {
        const href = target.el.getAttribute("href") || target.el.closest("a[href]")?.getAttribute("href");
        const item = tabs.find(t => t.to === href);
        if (item) {
          navigate({ to: item.to });
          window.dispatchEvent(new CustomEvent("medicore:nav-flash", { detail: item.to }));
          window.setTimeout(() => { setMode("page"); setTargets(pageTargets()); }, 180);
        } else activate(target);
        return;
      }
      activate(target);
      window.setTimeout(() => setTargets(pageTargets()), 80);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [enabled, mode, targets, tabs, navigate]);

  if (!enabled || !mode) return null;
  return <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-[9998]">
    {targets.map(target => <span key={`${target.key}-${target.el.dataset.keyboardId ?? target.label}-${Math.round(target.rect.left)}-${Math.round(target.rect.top)}`} className="fixed min-w-5 rounded border border-primary bg-primary px-1.5 py-0.5 text-center font-mono text-[11px] font-bold leading-4 text-primary-foreground shadow-md" style={{ left: Math.max(2, target.rect.left), top: Math.max(2, target.rect.top) }}>{target.key}</span>)}
  </div>;
}
