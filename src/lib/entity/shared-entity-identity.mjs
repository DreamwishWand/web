// 06 PRODUCT / Shared Wand Database identity contract — source-only and fail closed.
// This module validates typed refs and proven source relations. It does NOT grant
// public publishing, signed access, real Save ownership, SEO HTTP status or a Writer.
export const SHARED_ENTITY_IDENTITY_CONTRACT = 'wand.shared-entity.identity@1';
export const ENTITY_KINDS = Object.freeze(['ITEM', 'QUEST', 'CREATOR', 'WORK', 'PRESET']);
export const NATIVE_ENTITY_KINDS = Object.freeze(['ITEM', 'QUEST']);
export const ENTITY_RELATIONS = Object.freeze([
  'SAME_PUBLIC_ENTITY', 'SPECIALIZATION', 'RELATED_DISTINCT_ENTITY',
  'OWNERSHIP_CANONICAL', 'CARRIER_OR_WRAPPER', 'RUNTIME_INSTANCE'
]);
export const ENTITY_LOCALES = Object.freeze([
  'en', 'fr', 'it', 'de', 'es-ES', 'ja', 'zh-CN', 'pt-BR'
]);
const numeric = value =>
  typeof value === 'string' && /^[1-9][0-9]{0,15}$/.test(value) &&
  Number.isSafeInteger(Number(value));
const opaque = value =>
  typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(value);
const isNative = kind => NATIVE_ENTITY_KINDS.includes(kind);
const error = message => { throw new TypeError('SHARED_ENTITY_' + message); };

export function makeEntityRef(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input) ||
      !ENTITY_KINDS.includes(input.kind)) error('KIND_INVALID');
  const {kind} = input;
  const primaryId = String(input.primaryId ?? '');
  if (!(isNative(kind) ? numeric(primaryId) : opaque(primaryId)))
    error('PRIMARY_ID_INVALID');
  const secondaryId = input.secondaryId == null ? null : String(input.secondaryId);
  if (secondaryId !== null && (!isNative(kind) || !numeric(secondaryId)))
    error('SECONDARY_ID_INVALID');
  return Object.freeze({kind, primaryId, secondaryId});
}

export function entityRefKey(ref) {
  const value = makeEntityRef(ref);
  // Encoded tuple, not a delimiter-concatenated native ID. Distinguishes kinds.
  return JSON.stringify([value.kind, value.primaryId, value.secondaryId]);
}

export function makeSourceScope(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) error('SCOPE_MISSING');
  const {platform, fullVersion, bid, schema} = raw;
  if (typeof platform !== 'string' || platform.length < 2 || platform.length > 80 ||
      typeof fullVersion !== 'string' || fullVersion.length < 1 || fullVersion.length > 96 ||
      typeof bid !== 'string' || bid.length < 1 || bid.length > 96 ||
      !Number.isSafeInteger(schema) || schema < 0)
    error('SCOPE_INVALID');
  // Switch Build ID must not be guessed from a schema or coerced between platforms.
  if (platform === 'Nintendo Switch' && !/^[A-Fa-f0-9]{16}$/.test(bid))
    error('SWITCH_BID_INVALID');
  const dlc = raw.dlc == null ? [] : raw.dlc;
  if (!Array.isArray(dlc) || dlc.some(x=>typeof x !== 'string' || !/^[A-Za-z0-9_.-]{1,96}$/.test(x)))
    error('SCOPE_DLC_INVALID');
  return Object.freeze({
    platform, fullVersion, bid:bid.toUpperCase(), schema,
    dlc:Object.freeze([...new Set(dlc)].sort())
  });
}
export const sourceScopeKey = scope => {
  const s = makeSourceScope(scope);
  return JSON.stringify([s.platform, s.fullVersion, s.bid, s.schema, s.dlc]);
};
export const sameSourceScope = (a,b) =>
  sourceScopeKey(a) === sourceScopeKey(b);

function relationProvesChild(child, relations) {
  if (child.secondaryId === null) return true;
  return Array.isArray(relations) && relations.some(r => {
    if (r?.type !== 'SPECIALIZATION' || r.evidence !== 'CONFIRMED' ||
        typeof r.sourceRef !== 'string' || !r.sourceRef.trim()) return false;
    try {
      const parent = makeEntityRef(r.source);
      const target = makeEntityRef(r.target);
      return parent.kind === child.kind && target.kind === child.kind &&
        parent.primaryId === child.primaryId && parent.secondaryId === null &&
        entityRefKey(target) === entityRefKey(child);
    } catch { return false; }
  });
}

// A registry is an ephemeral typed lookup over already-authorized source records.
// Public flags MUST originate from the backend/curated source owner, never UI input.
// No record body, private title, media key or personal overlay is exposed.
export function createSharedEntityRegistry(records) {
  if (!Array.isArray(records)) error('REGISTRY_INVALID');
  const byScopedKey = new Map();
  const aliases = new Map();
  const seenElsewhere = new Set();
  const token = (ref,scope) => entityRefKey(ref) + '@' +
    (scope === null ? 'WAND' : sourceScopeKey(scope));
  const push = (map,key,value) => {
    const list = map.get(key) ?? [];
    list.push(value); map.set(key,list);
  };

  for (const record of records) {
    if (!record || typeof record !== 'object' || Array.isArray(record))
      error('REGISTRY_RECORD_INVALID');
    const ref = makeEntityRef(record.ref);
    // Only native definition entities require game-specific source identity.
    const scope = record.sourceScope == null
      ? (isNative(ref.kind) ? error('NATIVE_SOURCE_REQUIRED') : null)
      : makeSourceScope(record.sourceScope);
    if (!relationProvesChild(ref,record.relations))
      continue; // No fabricated composite /P/S, even when a matching number exists.
    const publicEligible = record.visibility === 'PUBLIC' && record.publicEligible === true;
    const entry = Object.freeze({
      ref, scope, publicEligible,
      indexable:publicEligible && record.indexable === true
    });
    const key = token(ref,scope);
    push(byScopedKey,key,entry);
    seenElsewhere.add(entityRefKey(ref));
    if (!Array.isArray(record.aliases)) continue;
    for (const a of record.aliases) {
      if (a?.type !== 'SAME_PUBLIC_ENTITY' || a.evidence !== 'CONFIRMED' ||
          typeof a.sourceRef !== 'string' || !a.sourceRef.trim()) continue;
      try {
        const alias = makeEntityRef(a.ref);
        if (alias.kind !== ref.kind || entityRefKey(alias) === entityRefKey(ref))
          continue;
        push(aliases,token(alias,scope),entry);
        seenElsewhere.add(entityRefKey(alias));
      } catch { /* unverified or malformed aliases never enter the registry */ }
    }
  }

  function resolve(rawRef, requestedScope, {publicOnly=true}={}) {
    let ref, scope;
    try {
      ref = makeEntityRef(rawRef);
      scope = requestedScope == null
        ? (isNative(ref.kind) ? error('NATIVE_SOURCE_REQUIRED') : null)
        : makeSourceScope(requestedScope);
    } catch { return Object.freeze({status:'INVALID',ref:null}); }
    const key = token(ref,scope);
    const direct = byScopedKey.get(key) ?? [];
    const indirect = aliases.get(key) ?? [];
    const matches = [...direct,...indirect];
    if (matches.length === 0) {
      const status = !publicOnly && seenElsewhere.has(entityRefKey(ref))
        ? 'VERSION_MISMATCH' : 'NOT_FOUND';
      return Object.freeze({status,ref:null});
    }
    // An alias cannot override a concrete canonical entity, nor another alias.
    if (matches.length !== 1) return Object.freeze({status:'AMBIGUOUS',ref:null});
    const match = matches[0];
    if (!match.publicEligible) return Object.freeze({
      status:publicOnly?'NOT_FOUND':'PRIVATE',ref:null
    });
    return Object.freeze({
      status:'FOUND',ref:match.ref,
      alias:direct.length === 0,
      indexable:match.indexable
    });
  }

  // Numeric URL /P or /P/S has NO kind namespace; collisions fail closed.
  function resolveNative(rawPrimary,rawSecondary,scope) {
    const candidates=[];
    for (const kind of NATIVE_ENTITY_KINDS) {
      const result=resolve({kind,primaryId:rawPrimary,secondaryId:rawSecondary},scope);
      if (result.status === 'AMBIGUOUS') return Object.freeze({status:'AMBIGUOUS',ref:null});
      if (result.status === 'FOUND') candidates.push(result);
    }
    return candidates.length === 1 ? candidates[0] :
      Object.freeze({status:candidates.length?'AMBIGUOUS':'NOT_FOUND',ref:null});
  }
  return Object.freeze({resolve,resolveNative});
}

// This constructs only a *candidate* locale URL, never an HTTP 200/301/SEO grant.
// Community UUID routes must be resolved by their existing Community authority.
export function nativeEntityPath(rawRef,locale,{base='',slug=null}={}) {
  let ref;
  try { ref=makeEntityRef(rawRef); } catch { return null; }
  if (!isNative(ref.kind) || !ENTITY_LOCALES.includes(locale) ||
      typeof base !== 'string' || !/^\/?(?:[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*)?$/.test(base) ||
      (slug !== null && (typeof slug !== 'string' ||
        !/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(slug)))) return null;
  const prefix = base ? '/' + base.replace(/^\/+|\/+$/g,'') : '';
  return prefix + '/' + locale + '/' + ref.primaryId +
    (ref.secondaryId === null ? '' : '/' + ref.secondaryId) +
    (slug === null ? '' : '/' + slug) + '/';
}

// Labels must carry verified source provenance. Fallback is never relabeled
// as official localization or as a reviewed translation.
export function resolveVerifiedLabel(labels,locale) {
  if (!ENTITY_LOCALES.includes(locale) || !labels || typeof labels !== 'object')
    return Object.freeze({status:'UNAVAILABLE',value:null,sourceLocale:null,fallback:false});
  const good = code => labels[code]?.verified === true &&
    typeof labels[code]?.value === 'string' && labels[code].value.trim();
  if (good(locale)) return Object.freeze({
    status:'FOUND',value:labels[locale].value.trim(),sourceLocale:locale,fallback:false
  });
  if (good('en')) return Object.freeze({
    status:'FALLBACK',value:labels.en.value.trim(),sourceLocale:'en',fallback:true
  });
  return Object.freeze({status:'UNAVAILABLE',value:null,sourceLocale:null,fallback:false});
}
