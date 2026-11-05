import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {REVIEWED_EN_PAGES} from './fixtures/guide-systems-reviewed-en.js';
import {
  V17_SCHEMA,V17_LOCALES,V17_LOCALE_TO_UI,V17_KNOWN_SHA256,
  toPrivateV17ReviewerModel
} from './fixtures/guide-systems-v17-private-consumer.mjs';
import {validateSystemsPublicManifest} from '../src/lib/guide/systems-public.js';

const hash=s=>createHash('sha256').update(s).digest('hex');
const archiveMap={'EN':'en-US','FR':'fr','IT':'it','DE':'de','ES-ES':'es','JA':'ja','ZH-CN':'zh-CN','PT-BR':'pt-BR'};
const target={platform:'Nintendo Switch',gameVersion:'1.25.0',buildID:'52BD625D9B4E0053',schema:624};
const fixture=()=>{
  const consumer360=[],editorial315=[],perArticleRightsAndVersion45=[],humanReviewQueue315=[];
  const nativeArchivesByLocale8=Object.fromEntries(Object.values(archiveMap).map(locale=>[locale,{archiveSHA256:hash('TEST_ZIP_'+locale)}]));
  const corrections=[];
  for(const p of REVIEWED_EN_PAGES){
    perArticleRightsAndVersion45.push({articleId:p.id,sourceRightsSignoff:'NOT_SIGNED',publicEligible:false,switch1250CurrentRuntimeRecheck:false,switch1253:'NOT_REVIEWED',steam:'NOT_REVIEWED'});
    for(const locale of V17_LOCALES){
      const en=locale==='EN',body='SYNTHETIC_REVIEWER_PROSE_'+p.id+'_'+locale;
      const bodyHash=en?p.sourceHash:hash(body);
      consumer360.push({articleId:p.id,locale,previewTitle:en?p.titleEN:locale+' synthetic editorial '+p.id,
        previewBodySHA256:bodyHash,previewRevision:'TEST_SYNTHETIC_AI_DRAFT',
        AIInternalEditorial:!en,ENSourceReviewed:en,nativeGameProof:false,
        nativeZipToTargetBuild:en?'UNVERIFIED':'CONFIRMED_SWITCH_V125_VERSION_TREE',
        humanGameUIQA:false,rightsSigned:false,publicEligible:false,routeOverride:false});
      if(!en){
        editorial315.push({articleId:p.id,locale,categoryId:p.categoryId,groupId:p.groupId,
          englishSourceVersion:'Nintendo Switch v1.25.0',englishSourceBID:target.buildID,englishSourceSchema:target.schema,
          englishGuidanceSHA256:p.sourceHash,editorialTitle:locale+' synthetic editorial '+p.id,
          editorialGuidanceText:body,editorialTextSHA256:bodyHash,
          humanQASignedOff:false,rightsReleaseSignedOff:false,publishedEligible:false,
          gameArchiveZipToExactBuildBinding:'UNVERIFIED'});
        humanReviewQueue315.push({articleId:p.id,locale,sourceEN_SHA256:p.sourceHash,previewBodySHA256:bodyHash,
          missingIndependentHumanSignoff:true,publicEligible:false,rightsApproved:false});
      }
    }
  }
  for(let i=0;i<11;i++){
    const e=editorial315[i],name='Synthetic term '+i;
    corrections.push({articleId:e.articleId,locale:e.locale,matchAgainstV16Proposed:true,
      exactZipSHA256:nativeArchivesByLocale8[archiveMap[e.locale]].archiveSHA256,
      scope:'UI_TERM_ONLY_NOT_MECHANIC_PROOF',evidenceGrade:'CONFIRMED_RAW_SWITCH_V125_LOCALIZATION_STRING',
      actualSwitchV125Value:name});
    consumer360.find(c=>c.articleId===e.articleId&&c.locale===e.locale).nativeGameProof=true;
  }
  return {schema:V17_SCHEMA,target,publicGate:{eligiblePages:0,rightsSignoff:0,humanUIQACompleted:0,R17_GDE_SYS:'BLOCKED'},
    consumer360,editorial315,perArticleRightsAndVersion45,humanReviewQueue315,
    verifiedV16NativeCorrections11:corrections,nativeArchivesByLocale8};
};
function clone(value){return structuredClone(value)}
function reject(modify,error){const x=fixture();modify(x);assert.throws(()=>toPrivateV17ReviewerModel(x),new RegExp('V17_PRIVATE_REJECT:'+error));}

test('V17 private-only adapter maps all 360 locale records without ever exposing article bodies or public approval',()=>{
  const model=toPrivateV17ReviewerModel(fixture());
  assert.equal(model.schema,'ddv.guide.v17-private-reviewer@1');
  assert.equal(model.articleCount,45);
  assert.equal(model.consumerLocaleRecords,360);
  assert.equal(model.AIEditorialDrafts,315);
  assert.equal(model.humanQAPending,315);
  assert.equal(model.rightsSignoffPending,45);
  assert.equal(model.nativeAliases.length,11);
  assert.equal(model.canPublish,false);
  assert.equal(model.requiresStructuredArticleAuthoring,true);
  assert.equal(JSON.stringify(model).includes('SYNTHETIC_REVIEWER_PROSE_'),false);
  assert.equal(JSON.stringify(model).includes(REVIEWED_EN_PAGES[0].sourceHash),false);
  assert.equal(V17_KNOWN_SHA256,'64a6aea830f8d3e371bcb23cc122e5bf2b45d70384f7e6d869d4e7682df39f9b');
  assert.deepEqual(V17_LOCALES.map(x=>V17_LOCALE_TO_UI[x]),['en','fr','it','de','es-ES','ja','zh-CN','pt-BR']);
});
test('Real V17-shaped raw manuscript cannot pass public manifest parser or compiled zero-page allowlist',()=>{
  assert.throws(()=>validateSystemsPublicManifest(fixture()),/Unknown Systems publication schema/);
  const candidate={schema:'ddv.guide.systems-public@1',target:{...target,saveSchema:624},articles:fixture().editorial315};
  assert.throws(()=>validateSystemsPublicManifest(candidate),/Invalid published article envelope/);
});
test('Unreviewed editorial translations and forged rights or QA are blocked',()=>{
  reject(x=>{x.consumer360[0].humanGameUIQA=true;},'UNAUTHORIZED_CONSUMER_PROMOTION');
  reject(x=>{x.consumer360[9].publicEligible=true;},'UNAUTHORIZED_CONSUMER_PROMOTION');
  reject(x=>{x.editorial315[0].rightsReleaseSignedOff=true;},'UNAUTHORIZED_EDITORIAL_PROMOTION');
  reject(x=>{x.perArticleRightsAndVersion45[0].sourceRightsSignoff='APPROVED';},'RIGHTS_VERSION_HOLD');
  reject(x=>{x.publicGate.eligiblePages=1;},'PUBLIC_GATE_NOT_HOLD');
});
test('V17 native term evidence is scoped to UI term, never mechanic or publisher proof',()=>{
  const model=toPrivateV17ReviewerModel(fixture());
  assert(model.nativeAliases.every(a=>a.scope==='UI_TERM_ONLY'&&a.publicEligible===false));
  reject(x=>{x.verifiedV16NativeCorrections11[0].scope='PROVES_GAMEPLAY';},'NATIVE_PROOF_SCOPE');
  reject(x=>{x.verifiedV16NativeCorrections11[0].exactZipSHA256='0'.repeat(64);},'NATIVE_ARCHIVE_HASH_MISMATCH');
});
test('Article ID, category/subgroup, source hash, body SHA and 8-locale coverage are validated',()=>{
  reject(x=>{x.editorial315[0].categoryId='made-up';},'TAXONOMY_CONFLICT');
  reject(x=>{x.editorial315[0].groupId='made-up';},'TAXONOMY_CONFLICT');
  reject(x=>{x.editorial315[0].englishGuidanceSHA256='0'.repeat(64);},'EDITORIAL_EN_SOURCE_MISMATCH');
  reject(x=>{x.editorial315[0].editorialGuidanceText+=' silent edit';},'EDITORIAL_BODY_HASH_MISMATCH');
  reject(x=>{x.consumer360[0].previewBodySHA256='1'.repeat(64);},'EN_SOURCE_HASH');
  reject(x=>{x.consumer360[10].locale='XX';},'CONSUMER_ID_LOCALE');
  reject(x=>{x.target.gameVersion='1.25.3';},'TARGET_UNVERIFIED');
  reject(x=>{x.schema='@18';},'SCHEMA_UNSUPPORTED');
});
test('V17 corpus and adapters cannot enter any browser source/static/public build',()=>{
  const source=readFileSync('src/lib/guide/systems-catalog.js','utf8')+
    readFileSync('src/lib/guide/systems-public.js','utf8');
  assert(!source.includes('native-locdb-provenance-promotion@17'));
  assert(!source.includes('editorialGuidanceText'));
  assert(!source.includes('verifiedV16NativeCorrections11'));
  const published=JSON.parse(readFileSync('static/ddv/guide/v1.25/systems-public.json','utf8'));
  assert.deepEqual(published.articles,[]);
});
