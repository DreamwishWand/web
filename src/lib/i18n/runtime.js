import { catalogs } from './messages/index.js';
import { FALLBACK_LOCALE, SUPPORTED_LOCALES, getLocaleDefinition, normalizeLocale } from './registry.js';

let activeLocale = FALLBACK_LOCALE;
let preferenceAdapter = null;
let missingKeyReporter = null;
const subscribers = new Set();
const diagnostics = [];
export { FALLBACK_LOCALE, SUPPORTED_LOCALES };

export const locale = { subscribe(run) { subscribers.add(run); run(activeLocale); return () => subscribers.delete(run); } };

export function applyDocumentLanguage(documentLike, code) {
  const definition = getLocaleDefinition(code);
  if (!definition || !documentLike?.documentElement) return false;
  documentLike.documentElement.lang = definition.htmlLang;
  documentLike.documentElement.dataset.locale = definition.code;
  return true;
}
function emitDiagnostic(entry) {
  diagnostics.push(entry);
  if (diagnostics.length > 100) diagnostics.shift();
  if (missingKeyReporter) missingKeyReporter(entry);
}
export function getLocaleDiagnostics() { return diagnostics.slice(); }
export function clearLocaleDiagnostics() { diagnostics.length = 0; }
export function setMissingKeyReporter(reporter) { missingKeyReporter = typeof reporter === 'function' ? reporter : null; }
export function configureLocalePreferenceAdapter(adapter) {
  if (adapter !== null && (typeof adapter !== 'object' || typeof adapter.read !== 'function' || typeof adapter.write !== 'function')) throw new TypeError('Locale preference adapter must expose read() and write(locale).');
  preferenceAdapter = adapter;
}
export async function restoreLocalePreference() {
  if (!preferenceAdapter) return activeLocale;
  const candidate = normalizeLocale(await preferenceAdapter.read());
  if (candidate) setLocale(candidate);
  return activeLocale;
}
export function setLocale(next, { persist = false } = {}) {
  const normalized = normalizeLocale(next);
  if (!normalized) throw new RangeError(`Unsupported locale: ${String(next)}`);
  activeLocale = normalized;
  if (typeof document !== 'undefined') applyDocumentLanguage(document, normalized);
  for (const run of subscribers) run(activeLocale);
  if (persist && preferenceAdapter) void preferenceAdapter.write(activeLocale);
  return activeLocale;
}
function interpolate(template, params) {
  return template.replace(/\{([a-zA-Z][a-zA-Z0-9_]*)\}/g, (match, name) => Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : match);
}
export function resolveMessageFromCatalogs(sourceCatalogs, code, key, params = {}, fallbackLocale = FALLBACK_LOCALE) {
  const normalized = normalizeLocale(code) ?? fallbackLocale;
  const localeCatalog = sourceCatalogs[normalized] ?? {};
  const fallbackCatalog = sourceCatalogs[fallbackLocale] ?? {};
  let entry = localeCatalog[key], usedFallback = false;
  if (entry === undefined) { entry = fallbackCatalog[key]; usedFallback = true; }
  if (entry === undefined) return { text: `⟦${key}⟧`, missing: true, usedFallback: true };
  if (entry && typeof entry === 'object') {
    const count = Number(params.count);
    const localeDef = getLocaleDefinition(normalized) ?? getLocaleDefinition(fallbackLocale);
    const category = Number.isFinite(count) ? new Intl.PluralRules(localeDef?.intlLocale ?? fallbackLocale).select(count) : 'other';
    entry = entry[category] ?? entry.other;
  }
  return { text: interpolate(String(entry), params), missing: false, usedFallback };
}
export function t(key, params = {}, code = activeLocale) {
  const result = resolveMessageFromCatalogs(catalogs, code, key, params);
  if (result.missing || result.usedFallback) emitDiagnostic({ type: result.missing ? 'missing-key' : 'fallback-used', locale: normalizeLocale(code) ?? code, key });
  return result.text;
}
export function formatNumber(value, options = {}, code = activeLocale) {
  const definition = getLocaleDefinition(code) ?? getLocaleDefinition(FALLBACK_LOCALE);
  return new Intl.NumberFormat(definition.intlLocale, options).format(value);
}
export function formatDate(value, options = {}, code = activeLocale) {
  const definition = getLocaleDefinition(code) ?? getLocaleDefinition(FALLBACK_LOCALE);
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new RangeError('Invalid date value');
  return new Intl.DateTimeFormat(definition.intlLocale, options).format(date);
}
if (typeof document !== 'undefined') {
  const fromHtml = normalizeLocale(document.documentElement.lang);
  if (fromHtml) activeLocale = fromHtml;
  applyDocumentLanguage(document, activeLocale);
}
