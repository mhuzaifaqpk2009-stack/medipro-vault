/**
 * Global print shortcuts.
 *
 * Ctrl+P       — check that a printer exists first, then print.
 * Ctrl+Shift+P — "Print As": skip the check and go straight to the OS dialog.
 *
 * Pages register the same action their on-screen Print button uses via
 * `usePrintAction`, so the keyboard path and the button path stay identical.
 */
import { useEffect } from "react";

const EVENT = "medicore:print";

export type PrintRequest = { skipCheck: boolean };

export function firePrintAction(req: PrintRequest) {
  window.dispatchEvent(new CustomEvent(EVENT, { detail: req }));
}

/** Register the page's print handler (usually the same fn as the Print button). */
export function usePrintAction(handler: (req: PrintRequest) => void | Promise<void>) {
  useEffect(() => {
    const onEvent = (e: Event) => { void handler((e as CustomEvent).detail as PrintRequest); };
    window.addEventListener(EVENT, onEvent);
    return () => window.removeEventListener(EVENT, onEvent);
  });
}

/**
 * True when at least one printer is installed. Outside Electron we cannot
 * enumerate printers, so we optimistically allow the browser print dialog.
 */
export async function hasPrinter(): Promise<boolean> {
  const api = (typeof window !== "undefined" ? (window as any).medicore : null);
  if (!api?.print?.printers) return true;
  try {
    const res = await api.print.printers();
    return Array.isArray(res?.printers) && res.printers.length > 0;
  } catch {
    return false;
  }
}
