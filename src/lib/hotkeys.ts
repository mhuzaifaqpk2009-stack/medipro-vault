/**
 * Tab hotkey model: a human-readable combo string such as "Ctrl+1",
 * "Ctrl+Shift+M" or "F4". Defaults are assigned per tab in sidebar order.
 */

export const DEFAULT_HOTKEY_POOL = [
  "Ctrl+1", "Ctrl+2", "Ctrl+3", "Ctrl+4", "Ctrl+5",
  "Ctrl+6", "Ctrl+7", "Ctrl+8", "Ctrl+9", "Ctrl+0",
  "Ctrl+Shift+1", "Ctrl+Shift+2", "Ctrl+Shift+3",
];

export function defaultHotkeyFor(index: number): string {
  return DEFAULT_HOTKEY_POOL[index] ?? "";
}

/** Normalised combo string for a keyboard event, or null if it is only a modifier. */
export function comboFromEvent(e: KeyboardEvent): string | null {
  const key = e.key;
  if (["Control", "Shift", "Alt", "Meta"].includes(key)) return null;
  const parts: string[] = [];
  if (e.ctrlKey || e.metaKey) parts.push("Ctrl");
  if (e.altKey) parts.push("Alt");
  if (e.shiftKey) parts.push("Shift");
  let k = key;
  if (k === " ") k = "Space";
  else if (k.length === 1) k = k.toUpperCase();
  parts.push(k);
  return parts.join("+");
}

export function normaliseCombo(c: string): string {
  return c.trim().toLowerCase().replace(/\s+/g, "");
}

/**
 * Force any open overlay (dialog, popover, command palette, dropdown) to close
 * before navigating, then drop focus from the active input.
 */
export function forceCloseOverlays() {
  const el = document.activeElement as HTMLElement | null;
  if (el && typeof el.blur === "function") el.blur();
  for (const target of [document, window] as unknown as EventTarget[]) {
    target.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", code: "Escape", bubbles: true, cancelable: true }),
    );
  }
  // Radix locks scroll while a modal is open; clear leftovers defensively.
  requestAnimationFrame(() => {
    document.body.style.removeProperty("pointer-events");
  });
}
