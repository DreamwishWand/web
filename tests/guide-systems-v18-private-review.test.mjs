import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {REVIEWED_EN_PAGES} from './fixtures/guide-systems-reviewed-en.js';
import {V18_REVIEW_SCHEMA,V18_RETURN_SCHEMA,V18_CONTRACT_SCHEMA,
  validateV18PrivateReviewer} from './fixtures/guide-systems-v18-private-review.mjs';
import {validateSystemsPublicManifest} from '../src/lib/guide/systems-public.js';

const locales=['FR','IT','DE','ES-ES','JA','ZH-CN','PT-BR'];
const sha=text=>createHash('sha256').update(text).digest('hex');
const synthetic=(full=false)=>{
  const articleIds=REVIEWED_EN_PAGES.map(x=>x.id);
  const batches=Array.from({length:10},(_,i)=>{
    const slice=articleIds.slice(i*5,Math.min((i+1)*5,45));
    return {batchId:'TEST-'+i,articleCount:slice.length,localeQueueCount:slice.length*7,articleIds:slice,
      publicationReleasePolicy:'ARTICLE_BY_ARTICLE_AFTER_ALL_REQUIRED_GATES; BATCH_MEMBERSHIP_NOT_PUBLISH'};
  });
  const articleBatch=new Map(batches.flatMap(b=>b.articleIds.map(id=>[id,b.batchId])));
  const base={
    schema:full?V18_REVIEW_SCHEMA:V18_RETURN_SCHEMA,
    sourceArtifact:{version:'V17',DriveId:'15ZHcCdAPknE17T-Fn5hzamRshr3jWcGu',
      sha256:'64a6aea830f8d3e371bcb23cc122e5bf2b45d70384f7e6d869d4e7682df39f9b'},
    consumerContract:{schema:V18_CONTRACT_SCHEMA,consumerUse:'REVIEWER_ONLY_DRAFT',
      access:'DO_NOT_PUBLISH_ON_WEB_OR_STATIC_ASSETS',
      v17ImmutableSHA256:'64a6aea830f8d3e371bcb23cc122e5bf2b45d70384f7e6d869d4e7682df39f9b',
      valuesNow:{humanLocaleQA:0,rightsApproved:0,publicEligibleArticles:0,R17GDESYS:'BLOCKED',R17SEEDGUIDE:'BLOCKED'},
      localeFallback:{publicArticleUnavailable:'FAIL_CLOSED_NOT_FOUND',
        localeNotHumanApproved:'DO_NOT_AUTOMATICALLY_FALL_BACK_TO_UNAPPROVED_EN'},
      writerSafety:{DDV_NATIVE_WRITER:'OFF',PRODUCT_APPLY:'OFF'}},
    publicationGate45:REVIEWED_EN_PAGES.map(p=>({articleId:p.id,batchId:articleBatch.get(p.id),
      publicEligible:false,englishSourceReviewed:true,nonENEditorialAvailableCount:7,
      independentLocaleApprovedCount:0,rightsApproval:false,switch1250FullArticleRuntimeAccepted:false,
      switch1253ArticleReviewed:false,steamArticleReviewed:false,safety:'PUBLICATION_DENY_DEFAULT'}))
  };
  if(!full)return {...base,batchReviewPlan:batches,
    sourceAuditLinks:Object.fromEntries(articleIds.map(id=>[id,[]]))};
  const humanReview315=REVIEWED_EN_PAGES.flatMap(p=>locales.map(locale=>{
    const editedBody='SYNTHETIC V18 OWNER-ONLY EDITORIAL BODY '+p.id+' '+locale;
    return {articleId:p.id,locale,batchId:articleBatch.get(p.id),categoryId:p.categoryId,
      sourcePlatform:'Nintendo Switch',sourceVersion:'1.25.0',sourceBID:'52BD625D9B4E0053',
      sourceSchema:624,sourceEnglishGuidanceSHA256:p.sourceHash,
      editedBody,editedBodySHA256:sha(editedBody),reviewerOnly:true,reviewerDecision:'PENDING',
      reviewerName:'',gameUIValidation:'NOT_PERFORMED',publicEligible:false};
  }));
  const sourceAudit45=REVIEWED_EN_PAGES.map(p=>({articleId:p.id,categoryId:p.categoryId,
    sourceEnglishGUIDANCESha256:p.sourceHash,rightsReviewerDecision:'PENDING_HUMAN_LEGAL_OR_EDITORIAL',
    rightsReviewerIdentity:null,publicationEligible:false,
    switch1253:{status:'NOT_REVIEWED'},steam:{status:'NOT_REVIEWED'}}));
  return {...base,status:'REVIEW_PACKAGE_READY_FOR_HUMAN_ASSIGNMENT_NOT_SIGNOFF',
    batches,humanReview315,sourceAudit45,counts:{independentHumanQAApproved:0,rightsApproved:0,publicEligible:0}};
};
const wrong=(full,mutate,pattern)=>{
  const data=synthetic(full);mutate(data);
  assert.throws(()=>validateV18PrivateReviewer(data,{full}),new RegExp('V18_PRIVATE_REJECT:'+pattern));
};
test('V18 consumer RETURN is reviewer-only; all 45 individual article gates hold, no batch publishes',()=>{
 const actual=validateV18PrivateReviewer(synthetic());
 assert.deepEqual({articleCount:actual.articleCount,reviewBatchCount:actual.reviewBatchCount,
   humanTasks:actual.humanTasks,rightsTasks:actual.rightsTasks,mayPublish:actual.mayPublish},
   {articleCount:45,reviewBatchCount:10,humanTasks:315,rightsTasks:45,mayPublish:false});
 assert.equal(actual.approvedPages,0);assert.equal(actual.publicFallbackAllowed,false);
});
test('V18 full private REVIEW source is independently joined and never emits raw text or hashes',()=>{
 const result=validateV18PrivateReviewer(synthetic(true),{full:true});
 assert.equal(result.humanTasks,315);assert.equal(result.rightsTasks,45);
 assert(!JSON.stringify(result).includes('SYNTHETIC V18 OWNER-ONLY EDITORIAL BODY'));
 assert(!JSON.stringify(result).includes(REVIEWED_EN_PAGES[0].sourceHash));
});
test('V18 forged publication, Human QA, Rights or per-version approval fails closed',()=>{
 wrong(false,d=>{d.publicationGate45[0].publicEligible=true},'PUBLIC_GATE_NOT_DENIED');
 wrong(false,d=>{d.publicationGate45[0].rightsApproval=true},'PUBLIC_GATE_NOT_DENIED');
 wrong(false,d=>{d.consumerContract.valuesNow.publicEligibleArticles=1},'RELEASE_HOLD');
 wrong(false,d=>{d.consumerContract.access='PUBLIC'},'REVIEWER_ONLY');
 wrong(true,d=>{d.humanReview315[0].reviewerDecision='APPROVED'},'HUMAN_SIGNOFF');
 wrong(true,d=>{d.sourceAudit45[0].rightsReviewerIdentity='synthetic'},'RIGHTS_PENDING');
 wrong(true,d=>{d.sourceAudit45[0].switch1253.status='APPROVED'},'RIGHTS_PENDING');
});
test('V18 mismatched reviewer body SHA, unknown locale, duplicate source IDs and batch drift fail closed',()=>{
 wrong(true,d=>{d.humanReview315[0].editedBody+=' tampered'},'HUMAN_BODY_SHA');
 wrong(true,d=>{d.humanReview315[0].locale='xx'},'HUMAN_ID_OR_LOCALE');
 wrong(true,d=>{d.humanReview315[0].sourceEnglishGuidanceSHA256='0'.repeat(64)},'HUMAN_SOURCE_VERSION');
 wrong(false,d=>{d.publicationGate45[1].articleId=d.publicationGate45[0].articleId},'PUBLIC_GATE_ID');
 wrong(false,d=>{d.batchReviewPlan[0].localeQueueCount=0},'BATCH_DENOMINATOR');
 wrong(false,d=>{d.sourceArtifact.sha256='0'.repeat(64)},'SOURCE_PIN');
});
test('V18 raw reviewer package cannot become public Guide and shipping manifest remains zero',()=>{
 assert.throws(()=>validateSystemsPublicManifest(synthetic()),/Unknown Systems publication schema/);
 assert.throws(()=>validateSystemsPublicManifest(synthetic(true)),/Unknown Systems publication schema/);
 const manifest=JSON.parse(readFileSync('static/ddv/guide/v1.25/systems-public.json','utf8'));
 assert.deepEqual(manifest.articles,[]);
 const modules=readFileSync('src/lib/guide/systems-catalog.js','utf8')+
   readFileSync('src/lib/guide/systems-public.js','utf8');
 assert(!modules.includes(V18_REVIEW_SCHEMA));assert(!modules.includes('sourceEnglishFiveSections'));
});
