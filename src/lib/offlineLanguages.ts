export type OfflineLanguageStatus = "builtin" | "downloadable" | "downloaded";

export type OfflineLanguage = {
  code: string;
  name: string;
  nativeName: string;
  status: OfflineLanguageStatus;
  dictionaryUrl?: string;
};

/** Only languages with complete bundled UI support are offered. */
export const OFFLINE_LANGUAGES: OfflineLanguage[] = [
  { code: "en", name: "English", nativeName: "English", status: "builtin" },
  { code: "ur", name: "Urdu", nativeName: "اردو", status: "builtin" },
  { code: "hi", name: "Hindi", nativeName: "हिन्दी", status: "builtin" },
  { code: "bn", name: "Bengali", nativeName: "বাংলা", status: "builtin" },
];

const STORAGE_KEY = "medipro.offline-language-dictionaries.v1";
type DictionaryMap = Record<string, Record<string, string>>;

function readCache(): DictionaryMap {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") as DictionaryMap; } catch { return {}; }
}

export function isLanguageDownloaded(code: string): boolean { return !!readCache()[code]; }
export function getCachedDictionary(code: string): Record<string, string> | null { return readCache()[code] || null; }

export function cacheLanguageDictionary(code: string, dictionary: Record<string, string>): void {
  if (!OFFLINE_LANGUAGES.some((language) => language.code === code)) return;
  const cache = readCache();
  cache[code] = dictionary;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
}

export function removeCachedLanguage(code: string): void {
  const cache = readCache();
  delete cache[code];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
}

export function languageStatus(language: OfflineLanguage): OfflineLanguageStatus {
  return language.status === "downloadable" && isLanguageDownloaded(language.code) ? "downloaded" : language.status;
}

export async function downloadLanguageDictionary(language: OfflineLanguage, endpointBase = "/languages"): Promise<void> {
  if (language.status === "builtin") return;
  const response = await fetch(language.dictionaryUrl || `${endpointBase}/${language.code}.json`);
  if (!response.ok) throw new Error(`Unable to download ${language.name} dictionary (${response.status})`);
  const dictionary = await response.json() as Record<string, string>;
  if (!dictionary || typeof dictionary !== "object" || Array.isArray(dictionary)) throw new Error(`Invalid ${language.name} dictionary package`);
  cacheLanguageDictionary(language.code, dictionary);
}
