import { useEffect } from "react";

/**
 * Radix UI (Dialog/AlertDialog/Popover/DropdownMenu/ContextMenu) sets
 * `document.body.style.pointerEvents = "none"` while an overlay is open, to
 * trap focus/clicks inside it, then restores it when the overlay closes.
 * That restore can get skipped — most commonly when one overlay opens
 * another synchronously inside its own close handler (e.g. a Dialog opened
 * from a ContextMenuItem's onSelect, or from a click inside a Popover) — a
 * known Radix interaction issue. When it happens, the stuck style lives on
 * the raw DOM `<body>` element, completely outside React, so it silently
 * blocks every click on every screen (including totally unrelated ones,
 * like the sign-in screen after navigating away) until a full page reload.
 *
 * This is a defense-in-depth safety net: it periodically checks whether
 * body is marked non-interactive while no overlay is actually open/
 * animating, and clears the stuck style if so. The proper per-component
 * fixes (deferring the second dialog's open) reduce how often this should
 * ever fire; this just guarantees it can never lock up the whole app.
 */
export function usePointerEventsWatchdog() {
  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.body.style.pointerEvents !== "none") return;
      const openOverlay = document.querySelector(
        '[data-state="open"][role="dialog"], [data-state="open"][role="alertdialog"], [data-state="open"][role="menu"], [data-state="open"][role="listbox"], [data-radix-popper-content-wrapper]',
      );
      if (!openOverlay) {
        document.body.style.pointerEvents = "";
      }
    }, 300);
    return () => window.clearInterval(id);
  }, []);
}
