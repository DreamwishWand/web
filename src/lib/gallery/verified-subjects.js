/**
 * Gallery Verified Subject consumer of 03 COMM public-query v7 / PR #118.
 * The Registry is server-owned by 09 INT. Never seed Subject IDs in the UI.
 * @typedef {'outdoor'|'indoor'|'tom_furniture'|'tom_clothing'} GalleryKind
 * @typedef {'biome'|'floating_island'|'room'|'tom_furniture'|'tom_clothing'} SubjectType
 * @typedef {Object} VerifiedGallerySubject
 * @property {string} subjectId
 * @property {GalleryKind} galleryKind
 * @property {SubjectType} subjectType
 * @property {string} canonicalTargetId
 * @property {number|null} baseItemId
 * @property {string} platform
 * @property {string} gameVersion
 * @property {string} buildId
 * @property {number} profileSchema
 * @property {string} displayIdentity
 * @property {string|null} displayName
 * @property {string} verificationState
 * @property {string} evidenceRef
 */
export const VERIFIED_SUBJECT_RPC='community_list_verified_gallery_subjects_v1';
export const VERIFIED_SUBJECT_CONTRACT='ddv.gallery-verified-subject-public-lookup@1';
export const SUBJECT_TYPES=Object.freeze({
  outdoor:['biome','floating_island'],
  indoor:['room'],
  tom_furniture:['tom_furniture'],
  tom_clothing:['tom_clothing']
});
export const VERIFIED_CONTEXT=Object.freeze({
  platform:'switch',gameVersion:'1.25.0',buildId:'52BD625D9B4E0053',profileSchema:624
});
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const nonempty=x=>typeof x==='string'&&x.trim().length>0;

/** @param {unknown} value @param {GalleryKind} expectedKind */
export function normalizeVerifiedSubject(value,expectedKind){
  if(!value||typeof value!=='object'||Array.isArray(value))return null;
  const s=value;
  if(s.galleryKind!==expectedKind || !SUBJECT_TYPES[expectedKind]?.includes(s.subjectType) ||
    !nonempty(s.subjectId)||!UUID.test(s.subjectId)||!nonempty(s.canonicalTargetId)||
    !nonempty(s.evidenceRef)||typeof s.verificationState!=='string'||
    typeof s.platform!=='string'||typeof s.gameVersion!=='string'||typeof s.buildId!=='string'||
    !Number.isInteger(s.profileSchema)||typeof s.displayIdentity!=='string'||
    (s.displayName!==null&&s.displayName!==undefined&&typeof s.displayName!=='string')||
    !(s.baseItemId===null||Number.isSafeInteger(s.baseItemId)&&s.baseItemId>0))return null;
  // Native save-local Design.Id/GridID or guessed Item ID must not be a subject UUID.
  const baseRequired=expectedKind.startsWith('tom_');
  if(baseRequired!== (s.baseItemId!==null))return null;
  // Verified ToM is a typed Base Item, not Motif or native Design.Id.
  if(baseRequired && s.canonicalTargetId!==String(s.baseItemId))return null;
  // The native Outdoor Biome key must retain both SceneItemID and AreaType.
  // Verification of the exact tuple remains solely the server's responsibility.
  if(s.subjectType==='biome' && !/^\d+:\d+$/.test(s.canonicalTargetId))return null;
  return {
    subjectId:s.subjectId,galleryKind:s.galleryKind,subjectType:s.subjectType,
    canonicalTargetId:s.canonicalTargetId,baseItemId:s.baseItemId,
    platform:s.platform,gameVersion:s.gameVersion,buildId:s.buildId,
    profileSchema:s.profileSchema,displayIdentity:s.displayIdentity,
    displayName:nonempty(s.displayName)?s.displayName:null,
    verificationState:s.verificationState,evidenceRef:s.evidenceRef
  };
}
/** @param {unknown} response @param {GalleryKind} expectedKind */
export function parseVerifiedSubjectLookup(response,expectedKind){
  if(!Object.hasOwn(SUBJECT_TYPES,expectedKind))throw new Error('GALLERY_SUBJECT_KIND_INVALID');
  if(!response||typeof response!=='object'||Array.isArray(response)||
    response.contract!==VERIFIED_SUBJECT_CONTRACT||!Array.isArray(response.subjects)||
    response.catalogStatus!=='partial_verified_only'||typeof response.displayNamesVerified!=='boolean')
    throw new Error('GALLERY_SUBJECT_CATALOG_INVALID');
  // All rows must conform: do not turn a malformed/possibly stale projection into a selectable list.
  const subjects=response.subjects.map(s=>normalizeVerifiedSubject(s,expectedKind));
  if(subjects.some(s=>s===null)||new Set(subjects.map(s=>s.subjectId)).size!==subjects.length)
    throw new Error('GALLERY_SUBJECT_CATALOG_INVALID');
  return subjects;
}
/** @param {VerifiedGallerySubject|null|undefined} subject @param {GalleryKind} kind @param {SubjectType} type */
export function isSelectableSubject(subject,kind,type){
  // A Room locator depends on owner/save HouseItemID + floorIndex + RoomSlot.
  // Global catalog verification alone cannot authorize that per-account binding.
  if(type==='room')return false;
  return !!subject && subject.galleryKind===kind && subject.subjectType===type &&
    subject.verificationState==='verified' &&
    subject.platform===VERIFIED_CONTEXT.platform &&
    subject.gameVersion===VERIFIED_CONTEXT.gameVersion &&
    subject.buildId===VERIFIED_CONTEXT.buildId &&
    subject.profileSchema===VERIFIED_CONTEXT.profileSchema &&
    !!normalizeVerifiedSubject(subject,kind);
}
/** @param {VerifiedGallerySubject} subject */
export function subjectDisplayIdentity(subject){
  return subject.displayName?.trim() || subject.displayIdentity?.trim() || subject.canonicalTargetId;
}
/** Two observations of the same UUID are equivalent only if all binding-critical fields match.
 * Localized names and displayIdentity may legitimately improve without changing provenance.
 * @param {VerifiedGallerySubject} a @param {VerifiedGallerySubject} b */
export function sameVerifiedSubjectAuthority(a,b){
  return !!a&&!!b&&[
    'subjectId','galleryKind','subjectType','canonicalTargetId','baseItemId',
    'platform','gameVersion','buildId','profileSchema','evidenceRef','verificationState'
  ].every(key=>a[key]===b[key]);
}
/** @param {VerifiedGallerySubject[]} subjects @param {string} subjectId @param {GalleryKind} kind @param {SubjectType} type */
export function resolveCurrentSubject(subjects,subjectId,kind,type){
  return subjects.find(s=>s.subjectId===subjectId&&isSelectableSubject(s,kind,type))??null;
}
/** @param {VerifiedGallerySubject[]} subjects @param {SubjectType} type @param {string} query */
export function filterVerifiedSubjects(subjects,type,query=''){
  const q=query.trim().toLocaleLowerCase();
  return subjects.filter(s=>s.subjectType===type&&(!q||
    [s.displayName,s.displayIdentity,s.canonicalTargetId,s.subjectId,String(s.baseItemId??'')]
      .some(part=>String(part??'').toLocaleLowerCase().includes(q))));
}
