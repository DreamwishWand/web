import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyV20Privacy,inspectRawV20} from '../scripts/qa-guide-v20-private-privacy.mjs';
function fixture(){
 const ids=['COLLECTION_DISCOVERY','INVENTORY_BACKPACK','STORAGE_CHESTS','SCROOGE_STORE_CATALOG'];
 const audit4=ids.map((id,i)=>({
  articleId:id,sourceEnglishSHA256:String(i).repeat(64),
  rightsReviewerDecision:'PENDING_HUMAN_LEGAL_OR_EDITORIAL',
  humanNativeUIQASignedOff:false,switch1253ArticleApproved:false,steamArticleApproved:false,publicEligible:false
 }));
 const locales=['DE','ES-ES','FR','IT','JA','PT-BR','ZH-CN'];
 const reviewerOnly28=audit4.flatMap(a=>locales.map(locale=>({
  articleId:a.articleId,locale,sourceEnglishGuidanceSHA256:a.sourceEnglishSHA256,
  sourcePlatform:'Nintendo Switch',sourceVersion:'1.25.0',sourceBID:'52BD625D9B4E0053',
  sourceSchema:624,publicEligible:false,editedBody:'PRIVATE MOCK ONLY'
 })));
 const counts={P0C01Articles:4,localeHumanReviewTasks:28,sourceProofOccurrences:12,
 uniqueVerifiedSourceDocs:6,humanQAApproved:0,rightsApproved:0,
 switch1253Approved:0,steamApproved:0,publicEligible:0};
 return [
  {schema:'ddv.guide-systems-p0-collection-inventory-source-evidence@20',
   status:'REVIEW_ONLY_DO_NOT_PUBLISH',audit4,reviewerOnly28,counts},
  {schema:'ddv.guide-systems-p0-c01-publicsafe-return@20',
   status:'PUBLICATION_BLOCKED',sourceProofsByArticle:structuredClone(audit4),
   counts:structuredClone(counts),reviewerOnlyTextIncluded:false,noPublicDraftPayload:true}
 ];
}
test('GDE-V20-01: private 4×7 source-referenced Collection review rows stay BLOCKED',()=>{
 const [p,s]=fixture();const x=verifyV20Privacy(p,s);
 assert.equal(x.gate,'BLOCKED'); assert.equal(x.privateReviewerTasks,28);
 assert.equal(x.publicEligible,0);assert.equal(x.privateBodiesUsedForPublication,false);
});
test('GDE-V20-02: corrupted join, locale, source version, or pending approval fails closed',()=>{
 const fns=[
  ([p])=>{p.reviewerOnly28[0].locale='EN'},
  ([p])=>{p.reviewerOnly28[0].sourceEnglishGuidanceSHA256='x'},
  ([p])=>{p.reviewerOnly28[0].sourceVersion='1.25.3'},
  ([p])=>{p.reviewerOnly28[0].sourceSchema=626},
  ([p])=>{p.reviewerOnly28.pop()},
  ([p])=>{p.audit4[0].humanNativeUIQASignedOff=true},
  ([p])=>{p.audit4[0].rightsReviewerDecision='APPROVED'},
  ([p])=>{p.counts.publicEligible=1},
  ([p,s])=>{s.sourceProofsByArticle[0].articleId='FORGED'},
  ([p,s])=>{s.reviewerOnlyTextIncluded=true},
  ([p,s])=>{s.publicEligibleArticleCount=1;s.counts.publicEligible=1}
 ];
 for(const change of fns){const pair=fixture();change(pair);
 assert.throws(()=>verifyV20Privacy(...pair),/GUIDE_V20_/);}
});
test('GDE-V20-03: recursively forbid V20 reviewer text inside even nested publicsafe metadata',()=>{
 for(const patch of [s=>{s.reviewerOnly28=['private']},s=>{s.extras={nested:[{editedBody:'private'}]}},
   s=>{s.sourceProofsByArticle[0].sourceEnglishFiveSections=['private']} ]){
  const [p,s]=fixture();patch(s);
  assert.throws(()=>verifyV20Privacy(p,s),/GUIDE_V20_/);
 }
});
test('GDE-V20-04: offline bytes hash proves input identity without printing private review draft body',()=>{
 const [p,s]=fixture(),pa=JSON.stringify(p),sa=JSON.stringify(s);
 const proof=inspectRawV20(Buffer.from(pa),Buffer.from(sa));
 assert.match(proof.privateSourceSha256,/^[a-f0-9]{64}$/);
 assert.match(proof.publicSafeSha256,/^[a-f0-9]{64}$/);
 assert.ok(!JSON.stringify(proof).includes('PRIVATE MOCK'));
 assert.equal(proof.gate,'BLOCKED');
});
