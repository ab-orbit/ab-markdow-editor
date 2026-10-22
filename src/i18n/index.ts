import { useSyncExternalStore } from 'react';
import en from './en.json';
import de from './de.json';
import fr from './fr.json';

export type Language = 'pt' | 'en' | 'de' | 'fr';
export type LanguagePreference = Language | 'auto';
const storageKey = 'scriba-language';
const supported = new Set(['pt', 'en', 'de', 'fr']);
const catalogs: Record<string, Record<string, string>> = { en, de, fr };
const listeners = new Set<() => void>();
/** Native bridge errors contain filenames; translate their fixed text without altering the filename. */
const nativeErrorTemplates = [
  { pattern: /^Não foi possível integrar estes arquivos: ([\s\S]*?)\. Suas versões foram preservadas\. Continue editando ou exporte uma cópia; a sincronização será tentada novamente\.$/, key: 'Não foi possível integrar estes arquivos: {0}. Suas versões foram preservadas. Continue editando ou exporte uma cópia; a sincronização será tentada novamente.' },
  { pattern: /^Não foi possível autorizar esta pasta\. ([\s\S]*)$/, key: 'Não foi possível autorizar esta pasta. {0}' },
  { pattern: /^O arquivo ([\s\S]*) mudou fora do Scriba\. Recarregue ou salve uma cópia\.$/, key: 'O arquivo {0} mudou fora do Scriba. Recarregue ou salve uma cópia.' },
];
/** Only the primary device language is used; unsupported languages fall back to English. */
export function resolveLanguage(preference: string | null, deviceLanguage = typeof navigator === 'undefined' ? 'en' : navigator.language): Language {
  if (preference && supported.has(preference)) return preference as Language;
  const primary = deviceLanguage.toLowerCase().split(/[-_]/)[0];
  return supported.has(primary) ? primary as Language : 'en';
}
function storedPreference(): LanguagePreference {
  try { const value = localStorage.getItem(storageKey); return value && supported.has(value) ? value as Language : 'auto'; } catch { return 'auto'; }
}
let preference = storedPreference();
export function languagePreference(): LanguagePreference { return preference; }
export function currentLanguage(): Language { return resolveLanguage(preference); }
export function currentLocale(): string { return {pt:'pt-BR',en:'en-US',de:'de-DE',fr:'fr-FR'}[currentLanguage()]; }
export function t(source: string, ...values: unknown[]): string {
  if (!values.length && currentLanguage() !== 'pt' && !catalogs[currentLanguage()]?.[source]) {
    // File-read warnings prefix a stable failure with a user filename; only translate known failures.
    const separator=source.lastIndexOf(': '), suffix=source.slice(separator+2);
    if(separator>=0 && catalogs[currentLanguage()]?.[suffix])return source.slice(0,separator+2)+t(suffix);
    for (const {pattern, key} of nativeErrorTemplates) { const match = source.match(pattern); if (match) return t(key, ...match.slice(1)); }
  }
  const translated = currentLanguage() === 'pt' ? source : catalogs[currentLanguage()]?.[source] || catalogs.en[source] || source;
  return translated.replace(/\{(\d+)\}/g, (match, index) => index in values ? String(values[index]) : match);
}
function updateDocumentLanguage() { if (typeof document !== 'undefined') document.documentElement.lang = currentLocale(); }
export function setLanguage(next: LanguagePreference) {
  preference = next;
  try { if (next === 'auto') localStorage.removeItem(storageKey); else localStorage.setItem(storageKey, next); } catch { /* The active page still supports automatic language when storage is unavailable. */ }
  updateDocumentLanguage(); listeners.forEach(listener => listener());
}
export function useLanguage(): Language { useSyncExternalStore(listener => { listeners.add(listener); return () => { listeners.delete(listener); }; }, () => preference + ':' + currentLanguage()); return currentLanguage(); }
updateDocumentLanguage();
if (typeof window !== 'undefined') window.addEventListener('languagechange', () => { if (languagePreference() === 'auto') { updateDocumentLanguage(); listeners.forEach(listener => listener()); } });
if (typeof window !== 'undefined') window.addEventListener('storage', event => { if (event.key === storageKey) { preference = storedPreference(); updateDocumentLanguage(); listeners.forEach(listener => listener()); } });
