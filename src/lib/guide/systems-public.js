import { CATEGORY_INDEX, PAGE_INDEX, SYSTEM_CATEGORIES, SYSTEMS_SOURCE } from './systems-catalog.js';

export const SYSTEMS_PUBLIC_SCHEMA = 'ddv.guide.systems-public@1';
export const SYSTEMS_PUBLIC_PATH = 'ddv/guide/v1.25/systems-public.json';
export const SYSTEMS_LOCALES = Object.freeze(['en','fr','it','de','es-ES','ja','zh-CN','pt-BR']);
const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const validString = (value, max = 2000) => typeof value === 'string' && value.trim().length > 0 && value.length <= max;
const validTextList = value => Array.isArray(value) && value.length <= 40 && value.every(x => validString(x, 2400));
const unique = arr => new Set(arr).size === arr.length;

export function validateSystemsPublicManifest(payload, approvedPages = PAGE_INDEX) {
  if (!isRecord(payload) || payload.schema !== SYSTEMS_PUBLIC_SCHEMA) throw new TypeError('Unknown Systems publication schema.');
  const target = payload.target;
  if (!isRecord(target) || target.platform !== SYSTEMS_SOURCE.platform || target.gameVersion !== SYSTEMS_SOURCE.gameVersion ||
      target.buildID !== SYSTEMS_SOURCE.buildID || target.saveSchema !== SYSTEMS_SOURCE.schema)
    throw new TypeError('Unsupported Systems platform/version/build/schema.');
  if (!Array.isArray(payload.articles) || payload.articles.length > approvedPages.size) throw new TypeError('Invalid published article envelope.');
  if (!unique(payload.articles.map(x => x?.id))) throw new TypeError('Duplicate published article identity.');
  const articles = payload.articles.map(article => {
    if (!isRecord(article)) throw new TypeError('Malformed published article.');
    const source = approvedPages.get(article.id);
    if (!source || source.approved !== true || source.reviewedEN !== true || source.version !== SYSTEMS_SOURCE.gameVersion || !source.sourceHash || article.sourceEnglishGuidanceSha256 !== source.sourceHash)
      throw new TypeError('Article has no verified reviewed-English source identity.');
    if (article.publicationStatus !== 'PUBLISHED' || article.publicationApproved !== true ||
        article.rightsApproved !== true || article.currentVersionReviewed !== true ||
        article.allEightLocalesReviewed !== true)
      throw new TypeError('Unapproved article supplied to public channel.');
    if (article.categoryId !== source.categoryId || article.groupId !== source.groupId || article.primaryMechanicKey !== source.mechanicKey)
      throw new TypeError('Article moved outside canonical taxonomy.');
    if (!isRecord(article.localized) || Object.keys(article.localized).length !== SYSTEMS_LOCALES.length ||
        !SYSTEMS_LOCALES.every(locale => {
          const entry = article.localized[locale];
          return isRecord(entry) && validString(entry.title,160) && validString(entry.summary,4000) &&
            validTextList(entry.prerequisites) && validTextList(entry.instructions) && validTextList(entry.warnings);
        })) throw new TypeError('All eight independently reviewed locale bodies are required.');
    if (!validString(article.sourceLabel,300) || !validString(article.reviewedAt,50) ||
        !validString(article.confidence,80) || !Array.isArray(article.dlcContext) ||
        article.dlcContext.length > 10 || !article.dlcContext.every(x => validString(x,120)) ||
        !Array.isArray(article.relatedArticleIds) || article.relatedArticleIds.length > 24 ||
        !unique(article.relatedArticleIds) || !article.relatedArticleIds.every(x => typeof x === 'string' && approvedPages.has(x)))
      throw new TypeError('Article provenance/context/relations invalid.');
    // Derived metadata, not the raw authoring object: prevents public UI from accidentally
    // rendering extra unapproved text or arbitrary owner-supplied URLs.
    return Object.freeze({
      id: source.id, priority: source.priority, categoryId: source.categoryId, groupId: source.groupId,
      primaryMechanicKey: source.mechanicKey, sourceHash: source.sourceHash,
      localized: Object.freeze(Object.fromEntries(SYSTEMS_LOCALES.map(locale => [locale, Object.freeze({
        title: article.localized[locale].title.trim(),summary: article.localized[locale].summary.trim(),
        prerequisites: article.localized[locale].prerequisites.slice(),
        instructions: article.localized[locale].instructions.slice(),
        warnings: article.localized[locale].warnings.slice()
      })]))),
      sourceLabel: article.sourceLabel.trim(),reviewedAt:article.reviewedAt.trim(),
      confidence:article.confidence.trim(),dlcContext:article.dlcContext.slice(),
      relatedArticleIds:article.relatedArticleIds.slice()
    });
  });
  return Object.freeze({target:Object.freeze({...target}),articles:Object.freeze(articles)});
}

export async function loadPublishedSystems(basePath = '', fetchImpl = globalThis.fetch) {
  if (typeof fetchImpl !== 'function') throw new TypeError('Systems public loader requires fetch.');
  const prefix = String(basePath).replace(/\/$/, '');
  const response = await fetchImpl(prefix + '/' + SYSTEMS_PUBLIC_PATH, {cache:'no-store'});
  if (!response.ok) throw new Error('Systems public content could not be loaded (' + response.status + ').');
  return validateSystemsPublicManifest(await response.json());
}

export function systemLabel(entry, locale = 'en') {
  // JA/EN category/group wording is Owner APPROVED. Other UI languages see explicit EN fallback.
  return locale === 'ja' ? entry.ja : entry.en;
}
export function canonicalSystemHref(id, basePath = '', approvedPages = PAGE_INDEX) {
  if (!approvedPages.has(id)) return null;
  return String(basePath).replace(/\/$/, '') + '/guide/systems/?article=' + encodeURIComponent(id);
}
function normalized(value) { return String(value ?? '').normalize('NFKC').toLocaleLowerCase().trim().replace(/\s+/g,' '); }
export function browsePublishedSystems(manifest, {locale='en', query='', categoryId='', groupId='', version='1.25.0'} = {}) {
  if (version !== SYSTEMS_SOURCE.gameVersion) return [];
  const approved = manifest?.articles ?? [];
  const q = normalized(query);
  const seen = new Set();
  return approved.filter(article => {
    if (seen.has(article.id)) return false;
    seen.add(article.id);
    if (categoryId && article.categoryId !== categoryId) return false;
    if (groupId && article.groupId !== groupId) return false;
    const category = CATEGORY_INDEX.get(article.categoryId);
    const group = category?.groups.find(x => x.id === article.groupId);
    const body = article.localized?.[locale] ?? article.localized?.en;
    if (!body) return false;
    if (!q) return true;
    const candidates = [article.id, article.primaryMechanicKey,
      body.title, body.summary, article.localized.en.title,
      article.localized.ja?.title, article.localized.ja?.summary,
      category?.en, category?.ja, group?.en, group?.ja];
    return candidates.some(candidate => normalized(candidate).includes(q));
  });
}
export function publishedSystemById(manifest, id, version='1.25.0', approvedPages = PAGE_INDEX) {
  if (version !== SYSTEMS_SOURCE.gameVersion || !approvedPages.has(id)) return null;
  return manifest?.articles?.find(article => article.id === id) ?? null;
}
export function relatedPublishedSystems(manifest, article) {
  if (!article) return [];
  const active = new Map((manifest?.articles ?? []).map(entry => [entry.id,entry]));
  return article.relatedArticleIds.map(id => active.get(id)).filter(Boolean);
}
export function systemsCategoryCounts(manifest) {
  const published = manifest?.articles ?? [];
  return SYSTEM_CATEGORIES.map(category => ({
    ...category,
    count:published.filter(article => article.categoryId === category.id).length,
    groups:category.groups.map(group => ({...group,count:published.filter(a => a.categoryId === category.id && a.groupId === group.id).length}))
  }));
}
