import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {SYSTEMS_SOURCE,SYSTEM_CATEGORIES,PAGE_INDEX} from '../src/lib/guide/systems-catalog.js';
import {SYSTEMS_LOCALES,validateSystemsPublicManifest,browsePublishedSystems,publishedSystemById,canonicalSystemHref} from '../src/lib/guide/systems-public.js';
import {REVIEWED_EN_PAGES} from './fixtures/guide-systems-reviewed-en.js';
import {inspectV17,V17_REVIEW_HOLD,V17_SHA} from '../scripts/qa-guide-v17-evidence.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const publicManifest=JSON.parse(read('static/ddv/guide/v1.25/systems-public.json'));
const runtime=JSON.parse(read('static/ddv/guide/v1.25/runtime.json'));
const reviewerProbe=()=>{
 const ids=REVIEWED_EN_PAGES.map(x=>x.id);
 const editorial315=[],humanReviewQueue315=[],consumer360=[],perArticleRightsAndVersion45=[];
 for(const src of REVIEWED_EN_PAGES){
  perArticleRightsAndVersion45.push({articleId:src.id,sourceRightsSignoff:'NOT_SIGNED',
   publicEligible:false,switch1250CurrentRuntimeRecheck:false,switch1253:'NOT_REVIEWED',steam:'NOT_REVIEWED'});
  for(const locale of ['EN','FR','IT','DE','ES-ES','JA','ZH-CN','PT-BR']){
   consumer360.push({articleId:src.id,locale,publicEligible:false,humanGameUIQA:false,rightsSigned:false});
   if(locale==='EN')continue;
   editorial315.push({articleId:src.id,locale,englishGuidanceSHA256:src.sourceHash,editorialTextSHA256:'a'.repeat(64),
    englishSourceBID:'52BD625D9B4E0053',englishSourceSchema:624,humanNativeGameUIQASignedOff:false,
    humanQASignedOff:false,rightsReleaseSignedOff:false,publishedEligible:false});
   humanReviewQueue315.push({articleId:src.id,locale,sourceEN_SHA256:src.sourceHash,
    previewBodySHA256:'a'.repeat(64),missingIndependentHumanSignoff:true,
    publicEligible:false,rightsApproved:false,localeDisplayAcceptance:'NOT_TESTED'});
  }
 }
 return{schema:'ddv.guide-systems-native-locdb-provenance-promotion@17',
   target:{platform:'Nintendo Switch',gameVersion:'1.25.0',buildID:'52BD625D9B4E0053',schema:624},
   nativeArchivesByLocale8:Object.fromEntries(['en-US','fr','it','de','es','ja','zh-CN','pt-BR'].map(x=>[x,{}])),
   editorial315,consumer360,humanReviewQueue315,perArticleRightsAndVersion45,
   verifiedV16NativeCorrections11:Array.from({length:11},()=>({matchAgainstV16Proposed:true})),
   publicGate:{eligiblePages:0,rightsSignoff:0,humanUIQACompleted:0,R17_GDE_SYS:'BLOCKED',R17_SEED_GUIDE:'BLOCKED'}};
};
test('GDE-V17-01 reviewed 45 English and 315 queued drafts are not public articles',()=>{
 assert.equal(REVIEWED_EN_PAGES.length,45);
 assert.equal(SYSTEM_CATEGORIES.length,7);
 assert.equal(SYSTEM_CATEGORIES.reduce((n,x)=>n+x.groups.length,0),21);
 assert.equal(PAGE_INDEX.size,0);
 assert.equal(publicManifest.articles.length,0);
 assert.equal(runtime.records.systems.length,0);
 assert.equal(runtime.records.issues.length,0);
 assert.deepEqual(V17_REVIEW_HOLD,{humanRequired:315,rightsRequired:45,version1253Required:45,steamRequired:45,publicEligible:0});
});
test('GDE-V17-02 8-locale reviewer queue shape is complete but BLOCKED',()=>{
 const sample=inspectV17(reviewerProbe());
 assert.equal(sample.sourceVerified,true,JSON.stringify(sample.checks.slice(0,5)));
 assert.equal(sample.gate,'BLOCKED');
 assert.equal(sample.corpus.en,45);assert.equal(sample.corpus.nonEnglish,315);
 assert.equal(sample.corpus.consumer,360);assert.equal(sample.corpus.reviewQueue,315);
 assert.equal(sample.corpus.nativeLocales,8);
 assert.equal(V17_SHA.length,64);
});
test('GDE-V17-03 content/rights/version corruption fails reviewer gate, never silently allows publish',()=>{
 const sample=reviewerProbe();
 const tamper=[
  v=>v.humanReviewQueue315.pop(),
  v=>v.editorial315[0].humanNativeGameUIQASignedOff=true,
  v=>v.perArticleRightsAndVersion45[0].sourceRightsSignoff='SIGNED',
  v=>v.consumer360[0].publicEligible=true,
  v=>v.target.gameVersion='1.25.3',
  v=>v.nativeArchivesByLocale8={},
  v=>v.editorial315[0].editorialTextSHA256='b'.repeat(64)
 ];
 for(const mutate of tamper){const copy=structuredClone(sample);mutate(copy);
  assert.ok(inspectV17(copy).checks.length>0,mutate.toString());}
});
test('GDE-V17-04 public zero-page manifest fails closed on approved-looking unauthorized content',()=>{
 const article={id:REVIEWED_EN_PAGES[0].id,publicationStatus:'PUBLISHED',publicationApproved:true,
   rightsApproved:true,currentVersionReviewed:true,allEightLocalesReviewed:true};
 assert.throws(()=>validateSystemsPublicManifest({...publicManifest,articles:[article]}));
 for(const lang of SYSTEMS_LOCALES){
  assert.deepEqual(browsePublishedSystems(publicManifest,{locale:lang}),[]);
 }
 assert.deepEqual(browsePublishedSystems(publicManifest,{version:'1.25.3'}),[]);
 assert.equal(publishedSystemById(publicManifest,article.id),null);
 assert.equal(canonicalSystemHref(article.id),null);
});
test('GDE-V17-05 production JS/static assets isolate fixture bodies and reviewer corpus',()=>{
 const shipping=[
  'src/lib/guide/systems-public.js','src/lib/guide/systems-catalog.js',
  'src/routes/guide/systems/+page.svelte','static/ddv/guide/v1.25/systems-public.json',
  'static/ddv/guide/v1.25/runtime.json'
 ].map(read).join('\n');
 assert.doesNotMatch(shipping,/editorial315|humanReviewQueue315|rightsReleaseSignedOff/);
 for(const page of REVIEWED_EN_PAGES){
  assert.ok(!shipping.includes(page.sourceHash),'source hash in shipped asset '+page.id);
 }
 const audit=read('scripts/verify-guide-public-static-build.mjs');
 assert.match(audit,/await scan\(built\)/);
 assert.match(audit,/Unapproved article source hashes/);
});
test('GDE-V17-06 browser selectors, mobile breakpoint and keyboard landmarks present; device review still required',()=>{
 const page=read('src/routes/guide/systems/+page.svelte');
 const flow=read('scripts/guide-systems-browser-acceptance.mjs');
 for(const marker of ['data-systems-state="loading"','data-systems-state="error"','data-systems-state="unknown-version"',
   'data-systems-state="unpublished"','data-systems-state="empty"','data-systems-state="detail"'])
   assert.ok(page.includes(marker),marker);
 for(const marker of ['aria-pressed','aria-current','role="status"','role="alert"',':focus-visible','@media(max-width:410px)'])
   assert.ok(page.includes(marker),marker);
 assert.match(flow,/viewport/);
 assert.match(flow,/noOverflow/);
 assert.match(flow,/synthetic:true/);
});
