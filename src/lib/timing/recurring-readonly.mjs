// Timekeeper → Wand, schema626 READ-ONLY event inspection. No Save mutation/command/export.
// Source: Timekeeper PR56 HEAD 96425000ab0dc1d1d7dcbb68a27b2da0a23c3f15.
// The event registry is static knowledge, not a native game write authorization.
export const WAND_TIMING_READONLY_CONTRACT = 'wand.timing.recurring-readonly@1';
export const WAND_TIMING_REGISTRY_PATH = '/ddv/timing/v1.25.3/recurring-events.json';
export const WAND_TIMING_SWITCH_BID = '9A239D3DB569756D';
const SOURCE_SHA='028a206635d37bffd7f3a8ff820958bdaa201887bacf35e10faa8328d20022ea';
const validId = v => Number.isSafeInteger(v) && v > 0;
const record = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const clean = v => typeof v === 'string'
  ? v.replace(/<[^>]*>/g, '').replace(/[\u200B-\u200D\u2060\u202A-\u202E\u2066-\u2069]/g,'').replace(/\s+/g,' ').trim().slice(0,180) : '';
const validMapKey = k => /^(0|[1-9]\d*)$/.test(k) && Number.isSafeInteger(Number(k));

export function validateTimekeeperRegistry(registry) {
  const source = registry?.source;
  if (registry?.schema !== 'wand.timing.recurring-registry@1' ||
      source?.version !== '1.25.3' || source?.buildId !== WAND_TIMING_SWITCH_BID ||
      source?.schema !== 626 || source?.writerAuthorization !== false ||
      source?.rawEventSHA256 !== SOURCE_SHA || !Array.isArray(registry?.events) ||
      registry.events.length !== 508) throw Error('WAND_TIMING_REGISTRY_SOURCE_MISMATCH');
  const byId = new Map();
  let links = 0, multi = 0;
  const itemIds = new Set();
  for (const e of registry.events) {
    if (!validId(e?.id) || byId.has(e.id) || typeof e.name !== 'string' ||
        !Array.isArray(e.items) || !['W1','W2','HOLD','REPAIR_ONLY'].includes(e.eventPolicy))
      throw Error('WAND_TIMING_REGISTRY_ROW_INVALID');
    byId.set(e.id,e);
    links += e.items.length;
    if (e.items.length > 1) multi++;
    for (const item of e.items) {
      if (!validId(item?.id)) throw Error('WAND_TIMING_REGISTRY_ITEM_ID_INVALID');
      itemIds.add(item.id);
    }
  }
  if (links !== 489 || itemIds.size !== 244 || multi !== 41)
    throw Error('WAND_TIMING_REGISTRY_COVERAGE_MISMATCH');
  return byId;
}

/** Reject unsupported source; project only rows with a NextOccurrence field.
 * A saved map key is NOT an EventID. No Core trust, mutation or Writer rights.
 */
export function projectRecurringEventsReadonly(profile, registry) {
  const byId = validateTimekeeperRegistry(registry);
  if (!record(profile) || profile.GameInfo?.Version !== 626 ||
      !record(profile.World) || !record(profile.World.RecurringEvents))
    throw Error('WAND_TIMING_SCHEMA626_MAP_REQUIRED');
  const saved = profile.World.RecurringEvents;
  const entries = Object.entries(saved);
  if (entries.length > 20000) throw Error('WAND_TIMING_MAP_TOO_LARGE');
  const rows = [];
  let unsupported = 0;
  for (const [key,container] of entries) {
    if (!validMapKey(key) || !record(container)) {
      unsupported++;
      continue;
    }
    const variants = Object.entries(container).filter(([,value]) =>
      record(value) && Object.prototype.hasOwnProperty.call(value,'NextOccurrence'));
    if (variants.length === 0) {unsupported++;continue;}
    for (const [oneof,value] of variants) {
      const eventId = value.RecurringEventItemID;
      const known = validId(eventId) ? byId.get(eventId) : null;
      const items = (known?.items ?? []).map((item,index) => Object.freeze({
        linkIndex:index, itemId:item.id, en:clean(item.en), ja:clean(item.ja)
      }));
      rows.push(Object.freeze({
        mapKey:key, savedIndex:Number(key), eventId:validId(eventId)?eventId:null,
        oneof, name:clean(known?.name) || ('Unknown event ' + key),
        group:clean(known?.group), subgroup:clean(known?.subgroup),
        policy:known?.eventPolicy ?? 'HOLD',
        nextOccurrence:typeof value.NextOccurrence==='string'?value.NextOccurrence:null,
        lastOccurrence:typeof value.LastOccurrence==='string'?value.LastOccurrence:null,
        endDate:typeof value.EndDate==='string'?value.EndDate:null,
        ambiguous:variants.length!==1,
        registryKnown:Boolean(known),
        items:Object.freeze(items),
        sourcePointer:'/World/RecurringEvents/'+key+'/'+oneof+'/NextOccurrence',
        editable:false
      }));
    }
  }
  rows.sort((a,b)=>a.savedIndex-b.savedIndex||a.oneof.localeCompare(b.oneof));
  return Object.freeze({contract:WAND_TIMING_READONLY_CONTRACT,
    sourceSchema:626,registryCount:byId.size,savedContainerCount:entries.length,
    unsupportedContainerCount:unsupported,
    rows:Object.freeze(rows),writerAuthorized:false,encodeCopyAuthorized:false});
}

export function filterRecurringEventsReadonly(rows, query='') {
  const q=String(query).trim().toLocaleLowerCase();
  if(!q)return rows;
  return rows.filter(row=>[
    row.mapKey,row.eventId,row.oneof,row.name,row.group,row.subgroup,
    row.nextOccurrence,row.lastOccurrence,
    ...row.items.flatMap(item=>[item.itemId,item.en,item.ja])
  ].some(v=>String(v??'').toLocaleLowerCase().includes(q)));
}
