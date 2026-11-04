/**
 * 01E CORE / W-NATIVE-005 — schema626 W1 Saved Clock SOURCE witness only.
 *
 * NOT an authenticated SaveSession, Native scheduler or edit capability. The
 * caller's SourceSHA/Revision are display hints, never Core-owned identity.
 * Preserve all original timestamp lexemes, including intentional year 2126.
 */
export const W1_SAVED_CLOCK_SOURCE_CONTRACT = 'wand.01e.w1-saved-clock-source-readonly@1';
export const W1_SAVED_CLOCK_BUILD = Object.freeze({
  platform:'Nintendo Switch',gameVersion:'1.25.3',
  bid:'9A239D3DB569756D',schema:626
});
export const W1_SAVED_CLOCK_IDENTITY = Object.freeze({
  mapKey:'155',eventId:2010000021,oneof:'ItemSpawning',
  nextPointer:'/World/RecurringEvents/155/ItemSpawning/NextOccurrence'
});
const freeze = Object.freeze;
const rec = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const sha = value => typeof value === 'string' && /^[a-f0-9]{64}$/i.test(value);
const fail = reason => freeze({
  contract:W1_SAVED_CLOCK_SOURCE_CONTRACT,
  status:'SOURCE_CLOCK_REFERENCE_REJECTED',reason,
  savedClockFieldsObserved:false,
  sourceIdentityAuthenticated:false,coreRevisionCasVerified:false,
  nativeClockActualizeVerified:false,nativeExecuteAcceptedVerified:false,
  nativeLastToNextVerified:false,nativeColdLoadVerified:false,
  nativeV3Accepted:false,productWriterAuthorized:false,
  productEditedCopyAuthorized:false,originalOverwriteAuthorized:false,
  automatic2126RepairAuthorized:false
});

// A valid calendar lexeme is not proof of game Clock/Now or Next reschedule.
// Accept fractions from original JSON without rounding or UTC re-encoding.
const strictUtc = value => {
  if(typeof value !== 'string')return false;
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?Z$/.exec(value);
  if(!m)return false;
  const [year,month,day,hour,minute,second]=m.slice(1,7).map(Number);
  if(year<1 || month<1 || month>12 || hour>23 || minute>59 || second>59)return false;
  const leap=year%4===0 && (year%100!==0 || year%400===0);
  const days=[31,leap?29:28,31,30,31,30,31,31,30,31,30,31];
  return day>=1 && day<=days[month-1];
};

/**
 * Caller must supply already decoded (locally kept) JSON plus matching
 * *external* platform/version/BID/schema hints. No hash authentication,
 * native execution or durable edits occur here.
 */
export function inspectW1SavedClockSource(profile, context) {
  if(!rec(profile)||!rec(profile.GameInfo)||!rec(profile.World)||!rec(context))
    return fail('SOURCE_PROFILE_OR_CONTEXT_MISSING');
  if(profile.GameInfo.Version!==626 || Object.entries(W1_SAVED_CLOCK_BUILD)
    .some(([key,value])=>context[key]!==value))
    return fail('EXACT_EXTERNAL_BUILD_AND_SCHEMA_REQUIRED');
  if(!sha(context.sourceSha256) || typeof context.sourceRevision!=='string' ||
     !context.sourceRevision)return fail('UNTRUSTED_SOURCE_HINTS_REQUIRED');
  const events=profile.World.RecurringEvents;
  if(!rec(events) || !Object.hasOwn(events,W1_SAVED_CLOCK_IDENTITY.mapKey))
    return fail('SAVED_EVENT_MAP_KEY_MISSING');
  const container=events[W1_SAVED_CLOCK_IDENTITY.mapKey];
  if(!rec(container))return fail('SAVED_EVENT_CONTAINER_INVALID');
  // Native oneof identity must be unique across *all* serialized keys.
  // An alternate variant without NextOccurrence is still ambiguous; do not
  // inherit the looser read-only UI projection's Next-bearing filter.
  const variants=Object.entries(container);
  if(variants.length!==1 || variants[0][0]!==W1_SAVED_CLOCK_IDENTITY.oneof ||
     !rec(variants[0][1]) || !Object.hasOwn(variants[0][1],'NextOccurrence'))
    return fail('SAVED_EVENT_ONEOF_AMBIGUOUS_OR_UNSUPPORTED');
  const event=variants[0][1];
  if(event.RecurringEventItemID!==W1_SAVED_CLOCK_IDENTITY.eventId)
    return fail('SAVED_EVENT_ID_MISMATCH');
  if(!Object.hasOwn(event,'NextOccurrence') || !Object.hasOwn(event,'LastOccurrence') ||
     !Object.hasOwn(event,'EndDate') || !strictUtc(event.NextOccurrence) ||
     !strictUtc(event.LastOccurrence) ||
     !(event.EndDate===null || strictUtc(event.EndDate)))
    return fail('SAVED_CLOCK_FIELDS_MISSING_OR_INVALID');
  return freeze({
    contract:W1_SAVED_CLOCK_SOURCE_CONTRACT,
    status:'SAVED_W1_CLOCK_SOURCE_FIELDS_ONLY',
    mapKey:W1_SAVED_CLOCK_IDENTITY.mapKey,
    eventId:W1_SAVED_CLOCK_IDENTITY.eventId,
    oneof:W1_SAVED_CLOCK_IDENTITY.oneof,
    nextPointer:W1_SAVED_CLOCK_IDENTITY.nextPointer,
    // Exact original JSON strings; do not normalize, reschedule or repair.
    rawNextUtc:event.NextOccurrence,rawLastUtc:event.LastOccurrence,
    rawEndDateUtc:event.EndDate,rawEndDateIsNull:event.EndDate===null,
    savedClockFieldsObserved:true,
    sourceIdentityAuthenticated:false,coreRevisionCasVerified:false,
    temporalOrderVerifiedByNative:false,nativeClockActualizeVerified:false,
    nativeExecuteAcceptedVerified:false,nativeLastToNextVerified:false,
    nativeColdLoadVerified:false,nativeV3Accepted:false,
    productWriterAuthorized:false,productEditedCopyAuthorized:false,
    originalOverwriteAuthorized:false,automatic2126RepairAuthorized:false
  });
}
