import { useEffect } from "react";

/** Makes external WhatsApp links reliable in the Electron renderer as well as the browser. */
export function ExternalLinkFixes() {
  useEffect(() => {
    const original = window.open.bind(window);
    const patched = ((url?: string | URL, target?: string, features?: string) => {
      const value = String(url ?? "");
      if (/https?:\/\/(?:web\.)?whatsapp\.com|https?:\/\/wa\.me/i.test(value)) {
        const a = document.createElement("a");
        a.href = value;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        a.style.display = "none";
        document.body.appendChild(a);
        a.click();
        a.remove();
        return null;
      }
      return original(url, target, features);
    }) as typeof window.open;
    window.open = patched;
    return () => { window.open = original; };
  }, []);
  return null;
}
