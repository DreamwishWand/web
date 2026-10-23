/**
 * 09 INT — Gallery verified subject source gate.
 * This is an evidence-bound registry ADAPTER, not an alternate Gallery API.
 * Only exact promoted Core/Game DB identities can be enrolled. Zero-valued
 * unknown sources, filename inference, screen text and v1.25.3 crossovers
 * are never upgraded to verified identities.
 */
export const GALLERY_SUBJECT_EVIDENCE_CONTRACT = 'ddv.gallery-verified-subject-provenance@1';
export const GALLERY_SUBJECT_TARGET_V125 = Object.freeze({
  platform:'switch',gameVersion:'1.25.0',
  buildId:'52BD625D9B4E0053',profileSchema:624
});
export const GALLERY_SUBJECT_KINDS = Object.freeze({
  biome:'outdoor',floating_island:'outdoor',room:'indoor',
  tom_furniture:'tom_furniture',tom_clothing:'tom_clothing'
});
export const VERIFIED_CORE_IDENTITIES_V125 = Object.freeze([
  Object.freeze({
    galleryKind:'outdoor',subjectType:'floating_island',
    canonicalTargetId:'1540000147',baseItemId:null,
    semanticIdentityCodec:'ddv.outdoor-location-ref@1',
    evidenceRef:'tests/fixtures/ddv-world/outdoor-location-routing-audit-v125.json#/floatingIslands/0/sceneItemId',
    evidenceSourceSha256:'1cfc40196f7ee36048e1fa98c0835561901c6fed3f19ca8dd6fa36c47740dc10',
    evidenceClass:'CONFIRMED_V125_SEMANTIC_LOCATION_ROUTE_PARITY',
    scope:'Audit floatingIslands[0] exact SceneItemId, not save-local GridID or screenshot label'
  }),
  Object.freeze({
    galleryKind:'outdoor',subjectType:'floating_island',
    canonicalTargetId:'1540000148',baseItemId:null,
    semanticIdentityCodec:'ddv.outdoor-location-ref@1',
    evidenceRef:'tests/fixtures/ddv-world/outdoor-location-routing-audit-v125.json#/floatingIslands/1/sceneItemId',
    evidenceSourceSha256:'1cfc40196f7ee36048e1fa98c0835561901c6fed3f19ca8dd6fa36c47740dc10',
    evidenceClass:'CONFIRMED_V125_SEMANTIC_LOCATION_ROUTE_PARITY',
    scope:'Audit floatingIslands[1] exact SceneItemId, not save-local GridID or screenshot label'
  }),
  Object.freeze({
    galleryKind:'outdoor',subjectType:'floating_island',
    canonicalTargetId:'1540000149',baseItemId:null,
    semanticIdentityCodec:'ddv.outdoor-location-ref@1',
    evidenceRef:'tests/fixtures/ddv-world/outdoor-location-routing-audit-v125.json#/floatingIslands/2/sceneItemId',
    evidenceSourceSha256:'1cfc40196f7ee36048e1fa98c0835561901c6fed3f19ca8dd6fa36c47740dc10',
    evidenceClass:'CONFIRMED_V125_SEMANTIC_LOCATION_ROUTE_PARITY',
    scope:'Audit floatingIslands[2] exact SceneItemId, not save-local GridID or screenshot label'
  }),
  Object.freeze({
    galleryKind:'outdoor',subjectType:'floating_island',
    canonicalTargetId:'1540000150',baseItemId:null,
    semanticIdentityCodec:'ddv.outdoor-location-ref@1',
    evidenceRef:'tests/fixtures/ddv-world/outdoor-location-routing-audit-v125.json#/floatingIslands/3/sceneItemId',
    evidenceSourceSha256:'1cfc40196f7ee36048e1fa98c0835561901c6fed3f19ca8dd6fa36c47740dc10',
    evidenceClass:'CONFIRMED_V125_SEMANTIC_LOCATION_ROUTE_PARITY',
    scope:'Audit floatingIslands[3] exact SceneItemId, not save-local GridID or screenshot label'
  }),
  Object.freeze({
    galleryKind:'outdoor',subjectType:'floating_island',
    canonicalTargetId:'1540000151',baseItemId:null,
    semanticIdentityCodec:'ddv.outdoor-location-ref@1',
    evidenceRef:'tests/fixtures/ddv-world/outdoor-location-routing-audit-v125.json#/floatingIslands/4/sceneItemId',
    evidenceSourceSha256:'1cfc40196f7ee36048e1fa98c0835561901c6fed3f19ca8dd6fa36c47740dc10',
    evidenceClass:'CONFIRMED_V125_SEMANTIC_LOCATION_ROUTE_PARITY',
    scope:'Audit floatingIslands[4] exact SceneItemId, not save-local GridID or screenshot label'
  }),
  Object.freeze({
    galleryKind:'outdoor',subjectType:'floating_island',
    canonicalTargetId:'1540000152',baseItemId:null,
    semanticIdentityCodec:'ddv.outdoor-location-ref@1',
    evidenceRef:'tests/fixtures/ddv-world/outdoor-location-routing-audit-v125.json#/floatingIslands/5/sceneItemId',
    evidenceSourceSha256:'1cfc40196f7ee36048e1fa98c0835561901c6fed3f19ca8dd6fa36c47740dc10',
    evidenceClass:'CONFIRMED_V125_SEMANTIC_LOCATION_ROUTE_PARITY',
    scope:'Audit floatingIslands[5] exact SceneItemId, not save-local GridID or screenshot label'
  }),
  Object.freeze({
    galleryKind:'outdoor',subjectType:'floating_island',
    canonicalTargetId:'1540000153',baseItemId:null,
    semanticIdentityCodec:'ddv.outdoor-location-ref@1',
    evidenceRef:'tests/fixtures/ddv-world/outdoor-location-routing-audit-v125.json#/floatingIslands/6/sceneItemId',
    evidenceSourceSha256:'1cfc40196f7ee36048e1fa98c0835561901c6fed3f19ca8dd6fa36c47740dc10',
    evidenceClass:'CONFIRMED_V125_SEMANTIC_LOCATION_ROUTE_PARITY',
    scope:'Audit floatingIslands[6] exact SceneItemId, not save-local GridID or screenshot label'
  }),
  Object.freeze({
    galleryKind:'outdoor',subjectType:'floating_island',
    canonicalTargetId:'1540000154',baseItemId:null,
    semanticIdentityCodec:'ddv.outdoor-location-ref@1',
    evidenceRef:'tests/fixtures/ddv-world/outdoor-location-routing-audit-v125.json#/floatingIslands/7/sceneItemId',
    evidenceSourceSha256:'1cfc40196f7ee36048e1fa98c0835561901c6fed3f19ca8dd6fa36c47740dc10',
    evidenceClass:'CONFIRMED_V125_SEMANTIC_LOCATION_ROUTE_PARITY',
    scope:'Audit floatingIslands[7] exact SceneItemId, not save-local GridID or screenshot label'
  }),
  Object.freeze({
    galleryKind:'outdoor',subjectType:'floating_island',
    canonicalTargetId:'1540000192',baseItemId:null,
    semanticIdentityCodec:'ddv.outdoor-location-ref@1',
    evidenceRef:'tests/fixtures/ddv-world/outdoor-location-routing-audit-v125.json#/floatingIslands/8/sceneItemId',
    evidenceSourceSha256:'1cfc40196f7ee36048e1fa98c0835561901c6fed3f19ca8dd6fa36c47740dc10',
    evidenceClass:'CONFIRMED_V125_SEMANTIC_LOCATION_ROUTE_PARITY',
    scope:'Audit floatingIslands[8] exact SceneItemId, not save-local GridID or screenshot label'
  }),
  Object.freeze({
    galleryKind:'outdoor',subjectType:'floating_island',
    canonicalTargetId:'1540000193',baseItemId:null,
    semanticIdentityCodec:'ddv.outdoor-location-ref@1',
    evidenceRef:'tests/fixtures/ddv-world/outdoor-location-routing-audit-v125.json#/floatingIslands/9/sceneItemId',
    evidenceSourceSha256:'1cfc40196f7ee36048e1fa98c0835561901c6fed3f19ca8dd6fa36c47740dc10',
    evidenceClass:'CONFIRMED_V125_SEMANTIC_LOCATION_ROUTE_PARITY',
    scope:'Audit floatingIslands[9] exact SceneItemId, not save-local GridID or screenshot label'
  }),
  Object.freeze({
    galleryKind:'outdoor',subjectType:'floating_island',
    canonicalTargetId:'1540000194',baseItemId:null,
    semanticIdentityCodec:'ddv.outdoor-location-ref@1',
    evidenceRef:'tests/fixtures/ddv-world/outdoor-location-routing-audit-v125.json#/floatingIslands/10/sceneItemId',
    evidenceSourceSha256:'1cfc40196f7ee36048e1fa98c0835561901c6fed3f19ca8dd6fa36c47740dc10',
    evidenceClass:'CONFIRMED_V125_SEMANTIC_LOCATION_ROUTE_PARITY',
    scope:'Audit floatingIslands[10] exact SceneItemId, not save-local GridID or screenshot label'
  }),
  Object.freeze({
    galleryKind:'outdoor',subjectType:'floating_island',
    canonicalTargetId:'1540000238',baseItemId:null,
    semanticIdentityCodec:'ddv.outdoor-location-ref@1',
    evidenceRef:'tests/fixtures/ddv-world/outdoor-location-routing-audit-v125.json#/floatingIslands/11/sceneItemId',
    evidenceSourceSha256:'1cfc40196f7ee36048e1fa98c0835561901c6fed3f19ca8dd6fa36c47740dc10',
    evidenceClass:'CONFIRMED_V125_SEMANTIC_LOCATION_ROUTE_PARITY',
    scope:'Audit floatingIslands[11] exact SceneItemId, not save-local GridID or screenshot label'
  }),
  Object.freeze({
    galleryKind:'outdoor',subjectType:'floating_island',
    canonicalTargetId:'1540000246',baseItemId:null,
    semanticIdentityCodec:'ddv.outdoor-location-ref@1',
    evidenceRef:'tests/fixtures/ddv-world/outdoor-location-routing-audit-v125.json#/floatingIslands/12/sceneItemId',
    evidenceSourceSha256:'1cfc40196f7ee36048e1fa98c0835561901c6fed3f19ca8dd6fa36c47740dc10',
    evidenceClass:'CONFIRMED_V125_SEMANTIC_LOCATION_ROUTE_PARITY',
    scope:'Audit floatingIslands[12] exact SceneItemId, not save-local GridID or screenshot label'
  })
]);
function fail(code){return Object.freeze({ok:false,code,verificationState:'pending'});}
function exactIdentity(x,y){
  return x?.galleryKind===y.galleryKind &&
    x?.subjectType===y.subjectType &&
    x?.canonicalTargetId===y.canonicalTargetId &&
    x?.baseItemId===y.baseItemId &&
    x?.evidenceRef===y.evidenceRef &&
    x?.evidenceSourceSha256===y.evidenceSourceSha256;
}
export function validateGallerySubjectForEnrollment(candidate,{approvedIdentityManifest=VERIFIED_CORE_IDENTITIES_V125}={}){
  if(!candidate||typeof candidate!=='object')return fail('GALLERY_SUBJECT_EVIDENCE_MISSING');
  for(const [key,value] of Object.entries(GALLERY_SUBJECT_TARGET_V125)){
    if(candidate[key]!==value)return fail('GALLERY_SUBJECT_VERSION_PLATFORM_UNPROVEN');
  }
  const kind=GALLERY_SUBJECT_KINDS[candidate.subjectType];
  if(!kind||kind!==candidate.galleryKind)return fail('GALLERY_SUBJECT_KIND_MISMATCH');
  if(!candidate.evidenceRef||!candidate.evidenceSourceSha256 ||
      !/^[0-9a-f]{64}$/.test(candidate.evidenceSourceSha256))
    return fail('GALLERY_SUBJECT_EVIDENCE_MISSING');
  if(['tom_furniture','tom_clothing'].includes(candidate.subjectType) &&
      (!Number.isSafeInteger(candidate.baseItemId)||candidate.baseItemId<=0))
    return fail('GALLERY_SUBJECT_BASE_ITEM_UNVERIFIED');
  if(!['tom_furniture','tom_clothing'].includes(candidate.subjectType) &&
      candidate.baseItemId!==null)
    return fail('GALLERY_SUBJECT_BASE_ITEM_MUST_BE_NULL');
  if(!Array.isArray(approvedIdentityManifest) ||
      !approvedIdentityManifest.some(approved=>exactIdentity(candidate,approved)))
    return fail('GALLERY_SUBJECT_NOT_IN_REVIEWED_AUTHORITY');
  return Object.freeze({ok:true,verificationState:'verified',identity:Object.freeze({
    galleryKind:candidate.galleryKind,subjectType:candidate.subjectType,
    canonicalTargetId:candidate.canonicalTargetId,baseItemId:candidate.baseItemId,
    platform:candidate.platform,gameVersion:candidate.gameVersion,
    buildId:candidate.buildId,profileSchema:candidate.profileSchema,
    evidenceRef:candidate.evidenceRef
  })});
}
export function reviewedV125GallerySubjectCandidates(){
  return VERIFIED_CORE_IDENTITIES_V125.map(source=>Object.freeze({...GALLERY_SUBJECT_TARGET_V125,...source}));
}
