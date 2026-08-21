export type OfflineLanguageStatus = 'builtin' | 'downloadable' | 'downloaded';

export type OfflineLanguage = {
  code: string;
  name: string;
  nativeName: string;
  status: OfflineLanguageStatus;
  dictionaryUrl?: string;
};

/**
 * Offline-first language catalog. Built-in dictionaries are bundled with the
 * application; downloadable dictionaries are cached locally after installation.
 */
export const OFFLINE_LANGUAGES: OfflineLanguage[] = [
  { code: 'en', name: 'English', nativeName: 'English', status: 'builtin' },
  { code: 'ur', name: 'Urdu', nativeName: 'اردو', status: 'builtin' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', status: 'builtin' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', status: 'builtin' },
  { code: 'es', name: 'Spanish', nativeName: 'Español', status: 'downloadable' },
  { code: 'fr', name: 'French', nativeName: 'Français', status: 'downloadable' },
  { code: 'de', name: 'German', nativeName: 'Deutsch', status: 'downloadable' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português', status: 'downloadable' },
  { code: 'it', name: 'Italian', nativeName: 'Italiano', status: 'downloadable' },
  { code: 'tr', name: 'Turkish', nativeName: 'Türkçe', status: 'downloadable' },
  { code: 'ru', name: 'Russian', nativeName: 'Русский', status: 'downloadable' },
  { code: 'uk', name: 'Ukrainian', nativeName: 'Українська', status: 'downloadable' },
  { code: 'bn', name: 'Bengali', nativeName: 'বাংলা', status: 'downloadable' },
  { code: 'pa', name: 'Punjabi', nativeName: 'ਪੰਜਾਬੀ', status: 'downloadable' },
  { code: 'fa', name: 'Persian', nativeName: 'فارسی', status: 'downloadable' },
  { code: 'ps', name: 'Pashto', nativeName: 'پښتو', status: 'downloadable' },
  { code: 'id', name: 'Indonesian', nativeName: 'Bahasa Indonesia', status: 'downloadable' },
  { code: 'ms', name: 'Malay', nativeName: 'Bahasa Melayu', status: 'downloadable' },
  { code: 'zh', name: 'Chinese', nativeName: '中文', status: 'downloadable' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語', status: 'downloadable' },
  { code: 'ko', name: 'Korean', nativeName: '한국어', status: 'downloadable' },
  { code: 'vi', name: 'Vietnamese', nativeName: 'Tiếng Việt', status: 'downloadable' },
  { code: 'th', name: 'Thai', nativeName: 'ไทย', status: 'downloadable' },
];

const STORAGE_KEY = 'medipro.offline-language-dictionaries.v1';

type DictionaryMap = Record<string, Record<string, string>>;

function readCache(): DictionaryMap {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') as DictionaryMap;
  } catch {
    return {};
  }
}

export function isLanguageDownloaded(code: string): boolean {
  return !!readCache()[code];
}

export function getCachedDictionary(code: string): Record<string, string> | null {
  return readCache()[code] || null;
}

/** Cache a complete dictionary locally. The caller supplies the dictionary
 * downloaded from the application's language package endpoint. */
export function cacheLanguageDictionary(code: string, dictionary: Record<string, string>): void {
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
  return language.status === 'downloadable' && isLanguageDownloaded(language.code)
    ? 'downloaded'
    : language.status;
}

/**
 * Downloads a dictionary package and caches it locally. The endpoint is kept
 * configurable so the app can ship a local package server/CDN without tying
 * the UI to a translation provider.
 */
export async function downloadLanguageDictionary(
  language: OfflineLanguage,
  endpointBase = '/languages'
): Promise<void> {
  if (language.status === 'builtin') return;
  const response = await fetch(language.dictionaryUrl || `${endpointBase}/${language.code}.json`);
  if (!response.ok) throw new Error(`Unable to download ${language.name} dictionary (${response.status})`);
  const dictionary = await response.json() as Record<string, string>;
  if (!dictionary || typeof dictionary !== 'object' || Array.isArray(dictionary)) {
    throw new Error(`Invalid ${language.name} dictionary package`);
  }
  cacheLanguageDictionary(language.code, dictionary);
}
