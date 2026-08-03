/**
 * "Quick actions" — global commands that open a creation panel on a page,
 * usable from a keyboard shortcut or a pinned button.
 */
import { useEffect } from "react";

export type QuickActionId =
  | "new-medicine"
  | "new-purchase"
  | "new-customer"
  | "new-supplier";

export const QUICK_ACTIONS: {
  id: QuickActionId;
  label: string;
  to: string;
  hotkey: string;
}[] = [
  { id: "new-medicine", label: "New medicine", to: "/app/medicines", hotkey: "Ctrl+M" },
  { id: "new-purchase", label: "New purchase", to: "/app/purchases", hotkey: "Ctrl+Shift+P" },
  { id: "new-customer", label: "New customer", to: "/app/customers", hotkey: "Ctrl+Shift+C" },
  { id: "new-supplier", label: "New supplier", to: "/app/suppliers", hotkey: "Ctrl+Shift+U" },
];

const EVENT = "medicore:quick-action";

export function effectiveActionHotkey(id: QuickActionId, custom?: Record<string, string>) {
  return custom?.[id] || QUICK_ACTIONS.find((a) => a.id === id)?.hotkey || "";
}

/** Fire the action (the page listening for it opens its dialog). */
export function fireQuickAction(id: QuickActionId) {
  window.dispatchEvent(new CustomEvent(EVENT, { detail: id }));
}

/** Navigate to the owning page first, then fire once it has mounted. */
export function runQuickAction(id: QuickActionId, navigate: (o: { to: string }) => void) {
  const action = QUICK_ACTIONS.find((a) => a.id === id);
  if (!action) return;
  navigate({ to: action.to });
  window.setTimeout(() => fireQuickAction(id), 120);
}

/** Page-side listener. */
export function useQuickAction(id: QuickActionId, handler: () => void) {
  useEffect(() => {
    const onEvent = (e: Event) => {
      if ((e as CustomEvent).detail === id) handler();
    };
    window.addEventListener(EVENT, onEvent);
    return () => window.removeEventListener(EVENT, onEvent);
  });
}
