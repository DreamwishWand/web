export const GUIDE_RUNTIME_SCHEMA = 'wand.guide.runtime@1';
export const GUIDE_RUNTIME_PATH = 'ddv/guide/v1.25/runtime.json';

const LOCALE_INDEX = Object.freeze({ en:0, fr:1, it:2, de:3, 'es-ES':4, ja:5, 'zh-CN':6, 'pt-BR':7 });
const PUBLIC_LOCALE = Object.freeze({ en:'EN', fr:'FR', it:'IT', de:'DE', 'es-ES':'ES-ES', ja:'JA', 'zh-CN':'ZH-CN', 'pt-BR':'PT-BR' });

export function cleanGuideText(value) {
  return String(value ?? '')
    .replace(/<nbsp>/gi, ' ')
    .replace(/<\/?nobr>/gi, '')
    .replace(/[\u200B\u200C\u200D\uFEFF]/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .trim();
}

export function validateGuideRuntime(runtime) {
  if (!runtime || typeof runtime !== 'object') throw new TypeError('Guide runtime must be an object.');
  if (runtime.schema !== GUIDE_RUNTIME_SCHEMA) throw new TypeError(`Unsupported Guide runtime schema: ${String(runtime.schema ?? 'missing')}`);
  if (runtime?.target?.platform !== 'Nintendo Switch' || runtime?.target?.gameVersion !== '1.25.0' || runtime?.target?.buildID !== '52BD625D9B4E0053') {
    throw new TypeError('Guide runtime target does not match the supported v1.25.0 Switch build.');
  }
  if (!Array.isArray(runtime.locales) || runtime.locales.length !== 8) throw new TypeError('Guide runtime must contain all eight launch locales.');
  const required = ['quests','starPaths','events','systems','issues'];
  for (const key of required) if (!Array.isArray(runtime?.records?.[key])) throw new TypeError(`Guide runtime is missing ${key} records.`);
  return runtime;
}

function localizedArrayValue(values, locale, fallback = '') {
  const index = LOCALE_INDEX[locale] ?? 0;
  if (!Array.isArray(values)) return cleanGuideText(fallback);
  return cleanGuideText(values[index]) || cleanGuideText(values[0]) || cleanGuideText(fallback);
}

export function guideQuestView(record, locale = 'en') {
  return {
    key:String(record.id),
    title:localizedArrayValue(record.titles, locale, `Quest ${record.id}`),
    status:cleanGuideText(record.status),
    category:cleanGuideText(record.category),
    steps:Number(record.steps ?? 0),
    subSteps:Number(record.subSteps ?? 0),
    objectives:Number(record.objectives ?? 0),
    guidanceStatus:cleanGuideText(record.guidance),
    localeFallback:false,
    raw:record
  };
}

export function guideEventView(record, locale = 'en') {
  const index = LOCALE_INDEX[locale] ?? 0;
  const reviewed = Boolean(record.all8Reviewed) || index === 0;
  const localized = Array.isArray(record.localized) ? record.localized : [];
  const selected = reviewed ? (localized[index] ?? localized[0] ?? {}) : (localized[0] ?? {});
  return {
    key:cleanGuideText(record.name),
    title:cleanGuideText(selected.title || record.name),
    guidance:cleanGuideText(selected.guidance),
    accessibility:cleanGuideText(record.accessibility),
    all8Reviewed:Boolean(record.all8Reviewed),
    localeFallback:!reviewed,
    occurrences:Array.isArray(record.occurrences) ? record.occurrences : [],
    historicalGap:record.historicalGap ?? null,
    raw:record
  };
}

export function guideSystemView(record, locale = 'en') {
  const localeCode = PUBLIC_LOCALE[locale] ?? 'EN';
  const reviewedLocales = Array.isArray(record.reviewedLocales) ? record.reviewedLocales : [];
  const reviewed = reviewedLocales.includes(localeCode);
  return {
    key:cleanGuideText(record.id),
    title:cleanGuideText(record.title),
    priority:cleanGuideText(record.priority),
    summary:cleanGuideText(record.summary),
    availability:cleanGuideText(record.availability),
    actions:(record.actions ?? []).map(cleanGuideText).filter(Boolean),
    mechanics:(record.mechanics ?? []).map(cleanGuideText).filter(Boolean),
    warnings:(record.warnings ?? []).map(cleanGuideText).filter(Boolean),
    related:Array.isArray(record.related) ? record.related : [],
    localeFallback:!reviewed,
    raw:record
  };
}

export function guideStarPathView(record, locale = 'en') {
  return {
    key:cleanGuideText(record.id),
    title:cleanGuideText(record.title),
    status:cleanGuideText(record.status),
    kind:cleanGuideText(record.kind),
    expiresAt:record?.expiresAt?.Date ?? null,
    evidenceStatus:cleanGuideText(record.evidenceStatus),
    localizationStatus:cleanGuideText(record.localizationStatus),
    duties:Array.isArray(record.duties) ? record.duties : [],
    routineDuties:Array.isArray(record.routineDuties) ? record.routineDuties : [],
    localeFallback:locale !== 'en',
    raw:record
  };
}

export function guideIssueView(record, locale = 'en') {
  return {
    key:cleanGuideText(record.key),
    title:cleanGuideText(record.title),
    section:cleanGuideText(record.section),
    confidence:cleanGuideText(record.confidence),
    localeFallback:locale !== 'en',
    raw:record
  };
}

export function guideSearchText(view) {
  return [view.title, view.status, view.category, view.accessibility, view.priority, view.section, view.confidence, view.summary]
    .filter(Boolean).join(' ').toLocaleLowerCase();
}

export function filterGuideViews(views, query = '') {
  const q=String(query).trim().toLocaleLowerCase();
  if (!q) return views;
  return views.filter((view) => guideSearchText(view).includes(q) || String(view.key).toLocaleLowerCase().includes(q));
}

export async function loadGuideRuntime(basePath = '', fetchImpl = globalThis.fetch) {
  if (typeof fetchImpl !== 'function') throw new TypeError('Guide runtime requires fetch.');
  const path=`${basePath}/${GUIDE_RUNTIME_PATH}`.replace(/\/+/g,'/');
  const response=await fetchImpl(path);
  if (!response.ok) throw new Error(`Guide runtime request failed (${response.status}).`);
  return validateGuideRuntime(await response.json());
}
