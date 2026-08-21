import { getLanguage, translateText, APP_LANGUAGES } from "@/lib/language";

const originals = new WeakMap<Text, string>();
const originalAttrs = new WeakMap<Element, Record<string, string>>();
const ATTRS = ["placeholder", "title", "aria-label"] as const;

function applyLanguage() {
  const code = getLanguage();
  const lang = APP_LANGUAGES.find((item) => item.code === code) || APP_LANGUAGES[0];
  document.documentElement.lang = lang.code;
  document.documentElement.dir = lang.dir || "ltr";
  document.documentElement.dataset.languageDir = lang.dir || "ltr";

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  let node: Node | null;
  while ((node = walker.nextNode())) nodes.push(node as Text);

  for (const textNode of nodes) {
    if (!originals.has(textNode)) originals.set(textNode, textNode.nodeValue || "");
    const original = originals.get(textNode) || "";
    if (!original.trim() || original.length > 500) continue;
    textNode.nodeValue = translateText(original, code);
  }

  document.querySelectorAll<HTMLElement>("*").forEach((element) => {
    const saved = originalAttrs.get(element) || {};
    for (const attr of ATTRS) {
      const value = element.getAttribute(attr);
      if (value !== null && saved[attr] === undefined) saved[attr] = value;
      const original = saved[attr];
      if (original !== undefined) element.setAttribute(attr, translateText(original, code));
    }
    if (Object.keys(saved).length) originalAttrs.set(element, saved);
  });
}

export function installExtendedLanguageRuntime() {
  const observer = new MutationObserver(() => {
    if ((window as any).__medicoreExtendedLangBusy) return;
    (window as any).__medicoreExtendedLangBusy = true;
    requestAnimationFrame(() => {
      try { applyLanguage(); } finally { (window as any).__medicoreExtendedLangBusy = false; }
    });
  });
  observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: [...ATTRS] });
  applyLanguage();
  return () => observer.disconnect();
}
