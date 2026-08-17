import { useEffect, useRef } from "react";

/**
 * USB barcode/QR scanners work as "keyboard wedge" devices — they type the
 * scanned code as fast keystrokes, then send Enter. This hook listens for
 * that pattern anywhere on the page (regardless of what's currently
 * focused) and distinguishes it from normal human typing purely by speed:
 * real typing has noticeable gaps between keys; a scanner's characters
 * arrive only a few milliseconds apart.
 *
 * If focus already happens to be on a text input when a scan comes in
 * (e.g. the barcode field itself), the browser still types the characters
 * into it as normal — this hook additionally fires its callback with the
 * same value, which callers can treat as idempotent (setting a field to
 * the value it already has, or looking up a medicine that's already
 * about to be found by the input's own Enter handler).
 */
export function useBarcodeScanner(onScan: (code: string) => void, enabled = true) {
  const bufferRef = useRef("");
  const lastKeyTimeRef = useRef(0);
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  useEffect(() => {
    if (!enabled) return;

    const MAX_GAP_MS = 60; // real typing is almost always slower than this between keys
    const MIN_CODE_LENGTH = 3;

    function handleKeyDown(e: KeyboardEvent) {
      const now = Date.now();
      const gap = now - lastKeyTimeRef.current;
      lastKeyTimeRef.current = now;

      if (e.key === "Enter") {
        const code = bufferRef.current;
        bufferRef.current = "";
        if (code.length >= MIN_CODE_LENGTH) {
          onScanRef.current(code);
        }
        return;
      }

      // A single printable character (scanners send one keydown per character).
      if (e.key.length !== 1) return;

      if (gap > MAX_GAP_MS) {
        // Too slow to be a scan continuing — start a fresh buffer.
        bufferRef.current = e.key;
      } else {
        bufferRef.current += e.key;
      }
    }

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [enabled]);
}
