export const COLLECTION_RUNTIME_SCHEMA = 'wand.collection.runtime@1';
export const COLLECTION_RECORD_SCHEMA = 'wand.collection.records@1';
export const COLLECTION_RUNTIME_PATH = 'ddv/collection/v1.25';

const LOCALE_INDEX = Object.freeze({ en:0, fr:1, it:2, de:3, 'es-ES':4, ja:5, 'zh-CN':6, 'pt-BR':7 });

function cleanOfficialLabel(value) {
  return String(value ?? '')
    .replace(/<\/?nobr>/gi, '')
    .replace(/[\u200B\u200C\u200D\uFEFF]/g, '')
    .trim();
}

function assertArrayIndex(list, index, name) {
  if (!Number.isInteger(index) || index < 0 || index >= list.length) throw new TypeError(`Invalid Collection ${name} index: ${String(index)}`);
  return list[index];
}

export function validateCollectionRuntimeIndex(index) {
  if (!index || typeof index !== 'object') throw new TypeError('Collection runtime index must be an object.');
  if (index.s !== COLLECTION_RUNTIME_SCHEMA) throw new TypeError(`Unsupported Collection runtime schema: ${String(index.s ?? 'missing')}`);
  if (index?.t?.platform !== 'Nintendo Switch' || index?.t?.gameVersion !== '1.25.0' || index?.t?.buildID !== '52BD625D9B4E0053') {
    throw new TypeError('Collection runtime target does not match the supported v1.25.0 Switch build.');
  }
  if (!Array.isArray(index.l) || index.l.length !== 8) throw new TypeError('Collection runtime must contain all eight launch locales.');
  if (!Array.isArray(index.f) || !Array.isArray(index.c) || !Array.isArray(index.m) || !Array.isArray(index.w) || !Array.isArray(index.u) || !Array.isArray(index.e)) throw new TypeError('Collection runtime dictionaries are incomplete.');
  if (!Array.isArray(index.wl) || index.wl.length !== index.w.length || !index.wl.every((labels) => Array.isArray(labels) && labels.length === 8)) throw new TypeError('Collection world labels are incomplete.');
  if (!Array.isArray(index.ul) || index.ul.length !== index.u.length || !index.ul.every((labels) => Array.isArray(labels) && labels.length === 8)) throw new TypeError('Collection universe labels are incomplete.');
  if (!Array.isArray(index.shards) || !index.shards.length) throw new TypeError('Collection runtime shard manifest is missing.');
  const expected = Number(index.n);
  const count = index.shards.reduce((sum, shard) => sum + Number(shard?.count ?? 0), 0);
  if (!Number.isInteger(expected) || expected <= 0 || count !== expected) throw new TypeError(`Collection runtime denominator mismatch: expected ${expected}, shards describe ${count}.`);
  let offset = 0;
  for (const shard of index.shards) {
    if (Number(shard.offset) !== offset) throw new TypeError(`Collection runtime shard offset mismatch at ${String(shard.file)}.`);
    if (!/^records-\d{2}\.json$/.test(String(shard.file ?? ''))) throw new TypeError('Collection runtime shard filename is invalid.');
    if (!/^[a-f0-9]{64}$/.test(String(shard.sha256 ?? ''))) throw new TypeError(`Collection runtime shard hash is invalid for ${String(shard.file)}.`);
    offset += Number(shard.count);
  }
  return index;
}


export function collectionFacetLabel(index, kind, value, locale = 'en') {
  const localeIndex = LOCALE_INDEX[locale] ?? 0;
  const values = kind === 'world' ? index.w : kind === 'universe' ? index.u : null;
  const labels = kind === 'world' ? index.wl : kind === 'universe' ? index.ul : null;
  if (!values || !labels) throw new TypeError(`Unsupported Collection facet kind: ${String(kind)}`);
  const valueIndex = values.indexOf(value);
  if (valueIndex < 0) return '';
  const row = labels[valueIndex];
  return cleanOfficialLabel(row?.[localeIndex]) || cleanOfficialLabel(row?.[0]) || '';
}

export function decodeCollectionRecord(index, row, locale = 'en') {
  if (!Array.isArray(row) || row.length !== 8) throw new TypeError('Collection runtime record shape is invalid.');
  const [itemId, familyIndex, stateClassIndex, stateSemanticIndex, worldIndices, universeIndices, expansionIndices, labels] = row;
  if (!Number.isInteger(itemId)) throw new TypeError('Collection ItemID must be an integer.');
  if (!Array.isArray(labels) || labels.length !== 8) throw new TypeError(`Collection record ${itemId} is missing launch-locale labels.`);
  const localeIndex = LOCALE_INDEX[locale] ?? 0;
  const cleanedLabels = labels.map(cleanOfficialLabel);
  return {
    itemId,
    family: assertArrayIndex(index.f, familyIndex, 'family'),
    stateClass: assertArrayIndex(index.c, stateClassIndex, 'state class'),
    stateSemantic: assertArrayIndex(index.m, stateSemanticIndex, 'state semantic'),
    worlds: (worldIndices ?? []).map((value) => assertArrayIndex(index.w, value, 'world')),
    universes: (universeIndices ?? []).map((value) => assertArrayIndex(index.u, value, 'universe')),
    expansions: (expansionIndices ?? []).map((value) => assertArrayIndex(index.e, value, 'expansion')),
    label: cleanedLabels[localeIndex] || cleanedLabels[0] || `Item ${itemId}`,
    searchText: cleanedLabels.join(' ').toLocaleLowerCase()
  };
}

export function filterCollectionRecords(records, { query = '', family = '', world = '', universe = '' } = {}) {
  const q = String(query).trim().toLocaleLowerCase();
  return records.filter((record) =>
    (!q || record.searchText.includes(q) || String(record.itemId).includes(q)) &&
    (!family || record.family === family) &&
    (!world || record.worlds.includes(world)) &&
    (!universe || record.universes.includes(universe))
  );
}

async function sha256Hex(bytes) {
  if (!globalThis.crypto?.subtle) throw new Error('SHA-256 verification is unavailable in this browser.');
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, '0')).join('');
}

export async function loadCollectionRuntime(basePath = '', fetchImpl = globalThis.fetch) {
  if (typeof fetchImpl !== 'function') throw new TypeError('Collection runtime requires fetch.');
  const root = `${basePath}/${COLLECTION_RUNTIME_PATH}`.replace(/\/+/g, '/');
  const indexResponse = await fetchImpl(`${root}/index.json`);
  if (!indexResponse.ok) throw new Error(`Collection index request failed (${indexResponse.status}).`);
  const index = validateCollectionRuntimeIndex(await indexResponse.json());

  const rows = [];
  for (const shard of index.shards) {
    const response = await fetchImpl(`${root}/${shard.file}`);
    if (!response.ok) throw new Error(`Collection shard request failed: ${shard.file} (${response.status}).`);
    const bytes = await response.arrayBuffer();
    if (bytes.byteLength !== Number(shard.bytes)) throw new Error(`Collection shard byte length mismatch: ${shard.file}.`);
    const hash = await sha256Hex(bytes);
    if (hash !== shard.sha256) throw new Error(`Collection shard SHA-256 mismatch: ${shard.file}.`);
    const payload = JSON.parse(new TextDecoder().decode(bytes));
    if (payload.s !== COLLECTION_RECORD_SCHEMA || payload.offset !== shard.offset || payload.count !== shard.count || !Array.isArray(payload.r) || payload.r.length !== shard.count) {
      throw new Error(`Collection shard contract mismatch: ${shard.file}.`);
    }
    rows.push(...payload.r);
  }
  if (rows.length !== index.n) throw new Error(`Collection runtime loaded ${rows.length} records; expected ${index.n}.`);
  return { index, rows };
}
