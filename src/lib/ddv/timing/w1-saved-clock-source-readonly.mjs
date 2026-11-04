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

// Never read untrusted fields through property access: own enumerable data
// descriptors are the only source values representable by JSON.parse.
const ownJsonData = (obj,key) => {
  if(!rec(obj))return null;
  const descriptor=Object.getOwnPropertyDescriptor(obj,key);
  return descriptor && descriptor.enumerable &&
    Object.hasOwn(descriptor,'value') ? descriptor : null;
};

/**
 * Caller must supply already decoded (locally kept) JSON plus matching
 * *external* platform/version/BID/schema hints. No hash authentication,
 * native execution or durable edits occur here.
 *
 * Untrusted JS objects may contain inherited fields, accessors, hidden keys
 * and mutable getters. Snapshot only own enumerable *data descriptors* once.
 * This is still SOURCE_ONLY, not an authenticated immutable Rust SaveSession.
 */
export function inspectW1SavedClockSource(profile, context) {
  try {
    const gameInfo=ownJsonData(profile,'GameInfo')?.value;
    const world=ownJsonData(profile,'World')?.value;
    if(!rec(gameInfo)||!rec(world)||!rec(context))
      return fail('SOURCE_PROFILE_OR_CONTEXT_MISSING');
    if(ownJsonData(gameInfo,'Version')?.value!==626 ||
       Object.entries(W1_SAVED_CLOCK_BUILD).some(([key,value])=>
         ownJsonData(context,key)?.value!==value))
      return fail('EXACT_EXTERNAL_BUILD_AND_SCHEMA_REQUIRED');
    const sourceSha256=ownJsonData(context,'sourceSha256')?.value;
    const sourceRevision=ownJsonData(context,'sourceRevision')?.value;
    if(!sha(sourceSha256)||typeof sourceRevision!=='string'||!sourceRevision)
      return fail('UNTRUSTED_SOURCE_HINTS_REQUIRED');

    const events=ownJsonData(world,'RecurringEvents')?.value;
    if(!rec(events)||!ownJsonData(events,W1_SAVED_CLOCK_IDENTITY.mapKey))
      return fail('SAVED_EVENT_MAP_KEY_MISSING');
    const container=ownJsonData(events,W1_SAVED_CLOCK_IDENTITY.mapKey).value;
    if(!rec(container))return fail('SAVED_EVENT_CONTAINER_INVALID');

    // Reflect.ownKeys also sees non-enumerable and Symbol variants; such keys
    // are impossible in a JSON.parse container and may not be silently hidden.
    const variantKeys=Reflect.ownKeys(container);
    if(variantKeys.length!==1||variantKeys[0]!==W1_SAVED_CLOCK_IDENTITY.oneof)
      return fail('SAVED_EVENT_ONEOF_AMBIGUOUS_OR_UNSUPPORTED');
    const variant=ownJsonData(container,W1_SAVED_CLOCK_IDENTITY.oneof);
    if(!variant||!rec(variant.value))
      return fail('SAVED_EVENT_ONEOF_AMBIGUOUS_OR_UNSUPPORTED');
    const event=variant.value;

    // Read each mandatory field exactly ONCE from an own serializable data
    // descriptor. A getter cannot validate one value and publish another.
    const eventId=ownJsonData(event,'RecurringEventItemID');
    const next=ownJsonData(event,'NextOccurrence');
    const last=ownJsonData(event,'LastOccurrence');
    const end=ownJsonData(event,'EndDate');
    if(!eventId||eventId.value!==W1_SAVED_CLOCK_IDENTITY.eventId)
      return fail('SAVED_EVENT_ID_MISMATCH');
    if(!next||!last||!end||!strictUtc(next.value)||!strictUtc(last.value)||
       !(end.value===null||strictUtc(end.value)))
      return fail('SAVED_CLOCK_FIELDS_MISSING_OR_INVALID');

    const rawNextUtc=next.value,rawLastUtc=last.value,rawEndDateUtc=end.value;
    return freeze({
      contract:W1_SAVED_CLOCK_SOURCE_CONTRACT,
      status:'SAVED_W1_CLOCK_SOURCE_FIELDS_ONLY',
      mapKey:W1_SAVED_CLOCK_IDENTITY.mapKey,
      eventId:W1_SAVED_CLOCK_IDENTITY.eventId,
      oneof:W1_SAVED_CLOCK_IDENTITY.oneof,
      nextPointer:W1_SAVED_CLOCK_IDENTITY.nextPointer,
      // Exact validated primitive snapshot; never normalize or auto-repair.
      rawNextUtc,rawLastUtc,rawEndDateUtc,rawEndDateIsNull:rawEndDateUtc===null,
      savedClockFieldsObserved:true,
      sourceIdentityAuthenticated:false,coreRevisionCasVerified:false,
      temporalOrderVerifiedByNative:false,nativeClockActualizeVerified:false,
      nativeExecuteAcceptedVerified:false,nativeLastToNextVerified:false,
      nativeColdLoadVerified:false,nativeV3Accepted:false,
      productWriterAuthorized:false,productEditedCopyAuthorized:false,
      originalOverwriteAuthorized:false,automatic2126RepairAuthorized:false
    });
  } catch {
    // Revoked proxies/hostile descriptor traps are not serialized Save data.
    return fail('SOURCE_OBJECT_DESCRIPTOR_UNSAFE');
  }
}
