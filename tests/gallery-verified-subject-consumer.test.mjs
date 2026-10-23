import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  VERIFIED_SUBJECT_RPC, VERIFIED_SUBJECT_CONTRACT, VERIFIED_CONTEXT, SUBJECT_TYPES,
  parseVerifiedSubjectLookup, isSelectableSubject, resolveCurrentSubject,
  filterVerifiedSubjects, subjectDisplayIdentity
} from '../src/lib/gallery/verified-subjects.js';
const id='11111111-1111-4111-8111-111111111111';
const island=Object.freeze({
  subjectId:id,galleryKind:'outdoor',subjectType:'floating_island',
  canonicalTargetId:'1540000000',baseItemId:null,
  platform:'switch',gameVersion:'1.25.0',buildId:'52BD625D9B4E0053',profileSchema:624,
  displayIdentity:'SceneItemId 1540000000',displayName:null,verificationState:'verified',
  evidenceRef:'fixture-only:source'
});
const envelope=subjects=>({contract:VERIFIED_SUBJECT_CONTRACT,subjects,catalogStatus:'partial_verified_only',displayNamesVerified:false});
const selected=()=>parseVerifiedSubjectLookup(envelope([island]),'outdoor')[0];
test('public lookup keeps actual Edge RPC and verified server identity, no invented display name',()=>{
  assert.equal(VERIFIED_SUBJECT_RPC,'community_list_verified_gallery_subjects_v1');
  assert.deepEqual(VERIFIED_CONTEXT,{platform:'switch',gameVersion:'1.25.0',buildId:'52BD625D9B4E0053',profileSchema:624});
  assert.equal(selected().subjectId,id);
  assert.equal(subjectDisplayIdentity(selected()),'SceneItemId 1540000000');
  assert.equal(subjectDisplayIdentity({...selected(),displayName:'Official name'}),'Official name');
  assert.equal(isSelectableSubject(selected(),'outdoor','floating_island'),true);
  assert.equal(isSelectableSubject(selected(),'outdoor','biome'),false);
});
test('zero subjects is a valid authoritative empty category, never an invented entry',()=>{
  for(const kind of ['outdoor','indoor','tom_furniture','tom_clothing'])
    assert.deepEqual(parseVerifiedSubjectLookup(envelope([]),kind),[]);
  assert.deepEqual(SUBJECT_TYPES.indoor,['room']);
  assert.deepEqual(SUBJECT_TYPES.tom_clothing,['tom_clothing']);
});
test('wrong platform, build, schema, verification and wrong kind cannot be selected',()=>{
  for(const changes of [
    {platform:'steam'},{buildId:'unknown'},{gameVersion:'1.25.3'},
    {profileSchema:626},{verificationState:'unverified'}
  ])assert.equal(isSelectableSubject({...selected(),...changes},'outdoor','floating_island'),false);
  assert.throws(()=>parseVerifiedSubjectLookup(envelope([{...island,galleryKind:'tom_furniture'}]),'outdoor'),/CATALOG_INVALID/);
  assert.throws(()=>parseVerifiedSubjectLookup(envelope([{...island,subjectType:'room'}]),'outdoor'),/CATALOG_INVALID/);
});
test('wrong ToM Base Item and native nonportable identity rejected',()=>{
  const tom={...island,galleryKind:'tom_furniture',subjectType:'tom_furniture',baseItemId:41000001};
  assert.equal(parseVerifiedSubjectLookup(envelope([tom]),'tom_furniture').length,1);
  assert.throws(()=>parseVerifiedSubjectLookup(envelope([{...tom,baseItemId:null}]),'tom_furniture'),/CATALOG_INVALID/);
  assert.throws(()=>parseVerifiedSubjectLookup(envelope([{...tom,subjectId:'nativeDesign-1'}]),'tom_furniture'),/CATALOG_INVALID/);
  assert.throws(()=>parseVerifiedSubjectLookup(envelope([{...island,baseItemId:100}]),'outdoor'),/CATALOG_INVALID/);
});
test('malformed payloads, duplicates, missing evidence, unknown version fail closed',()=>{
  for(const response of [null,{},[],{...envelope([]),contract:'unknown'},envelope([{...island,evidenceRef:''}]),envelope([island,island])])
    assert.throws(()=>parseVerifiedSubjectLookup(response,'outdoor'),/CATALOG_INVALID/);
});
test('stale selection is revoked when registry or selected type changes',()=>{
  const old=selected();
  assert.equal(resolveCurrentSubject([old],old.subjectId,'outdoor','floating_island')?.subjectId,id);
  assert.equal(resolveCurrentSubject([],old.subjectId,'outdoor','floating_island'),null);
  assert.equal(resolveCurrentSubject([old],old.subjectId,'outdoor','biome'),null);
  assert.equal(resolveCurrentSubject([{...old,buildId:'obsolete'}],old.subjectId,'outdoor','floating_island'),null);
});
test('local search does not mutate canonical identity; unsupported records remain unselectable',()=>{
  const arr=[selected(),{...selected(),subjectId:'22222222-2222-4222-8222-222222222222',buildId:'wrong'}];
  assert.equal(filterVerifiedSubjects(arr,'floating_island','SceneItemId').length,2);
  assert.equal(filterVerifiedSubjects(arr,'floating_island','154000').length,2);
  assert.equal(filterVerifiedSubjects(arr,'biome','').length,0);
  assert.equal(arr.filter(s=>isSelectableSubject(s,'outdoor','floating_island')).length,1);
});
test('Svelte picker uses public-query only and fail-closed actions remain',()=>{
  const picker=readFileSync(new URL('../src/lib/gallery/VerifiedSubjectPicker.svelte',import.meta.url),'utf8');
  const composer=readFileSync(new URL('../src/routes/gallery/publish/+page.svelte',import.meta.url),'utf8');
  const management=readFileSync(new URL('../src/routes/gallery/my/+page.svelte',import.meta.url),'utf8');
  assert.match(picker,/callPublicCommunityRpc/);
  assert.match(picker,/p_gallery_kind:requestedKind,p_limit:100/);
  assert.match(picker,/resolveCurrentSubject/);
  assert.doesNotMatch(picker,/\/rest\/v1\/rpc|\.from\(['"]gallery_verified_subjects/);
  assert.match(composer,/VerifiedSubjectPicker/);
  assert.match(composer,/firstStageValid = subjectCatalogReady && isSelectableSubject/);
  assert.doesNotMatch(composer,/inputmode="numeric"|bind:value=\{targetName\}/);
  assert.doesNotMatch(composer,/uploadAndFinalizeImage|command\(['"]publishGalleryPhoto/);
  assert.match(composer,/disabled aria-disabled="true"/);
  for(const action of ['publishUpdate','unpublish','deleteWork'])assert.match(management,new RegExp('disabled>\\{t\\(\\'galleryv1\\.'+action));
});
