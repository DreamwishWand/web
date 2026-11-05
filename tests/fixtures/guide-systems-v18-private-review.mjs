// Reviewer-only validation. Do not import this or any V18 payload from src/ or static/.
import {createHash} from 'node:crypto';
import {REVIEWED_EN_PAGES} from './guide-systems-reviewed-en.js';
export const V18_REVIEW_SCHEMA='ddv.guide-systems-independent-review-package@18';
export const V18_RETURN_SCHEMA='ddv.guide-systems-consumer-return@18';
export const V18_CONTRACT_SCHEMA='ddv.guide-systems-reviewer-consumer@18';
export const V18_SOURCE_SHA='0722429bcea60964f247a12f4c6c8bacd4cb41d2c33bbd90b35351e6145786cd';
export const V18_RETURN_SHA='290586085eefe03bf3772e21c17b01a6a791976c2fc344128639ffc4f8561cd0';
export const V17_SOURCE_SHA='64a6aea830f8d3e371bcb23cc122e5bf2b45d70384f7e6d869d4e7682df39f9b';
const ids=new Map(REVIEWED_EN_PAGES.map(p=>[p.id,p]));
const locales=new Set(['FR','IT','DE','ES-ES','JA','ZH-CN','PT-BR']);
const record=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const gate=(v,why)=>{if(!v)throw new TypeError('V18_PRIVATE_REJECT:'+why);};
const hash=s=>createHash('sha256').update(s,'utf8').digest('hex');
const key=(id,locale)=>id+'\0'+locale;
export function validateV18PrivateReviewer(payload,{full=false}={}){
  gate(record(payload)&&payload.schema===(full?V18_REVIEW_SCHEMA:V18_RETURN_SCHEMA),'SCHEMA');
  gate(payload.sourceArtifact?.DriveId==='15ZHcCdAPknE17T-Fn5hzamRshr3jWcGu'&&payload.sourceArtifact?.sha256===V17_SOURCE_SHA,'SOURCE_PIN');
  const c=payload.consumerContract;
  gate(c?.schema===V18_CONTRACT_SCHEMA&&c?.consumerUse==='REVIEWER_ONLY_DRAFT'&&
    c?.access==='DO_NOT_PUBLISH_ON_WEB_OR_STATIC_ASSETS'&&c?.v17ImmutableSHA256===V17_SOURCE_SHA,'REVIEWER_ONLY');
  gate(c?.valuesNow?.humanLocaleQA===0&&c?.valuesNow?.rightsApproved===0&&
    c?.valuesNow?.publicEligibleArticles===0&&c?.valuesNow?.R17GDESYS==='BLOCKED'&&
    c?.valuesNow?.R17SEEDGUIDE==='BLOCKED','RELEASE_HOLD');
  gate(c?.localeFallback?.publicArticleUnavailable?.includes('FAIL_CLOSED')&&
    c?.localeFallback?.localeNotHumanApproved?.includes('DO_NOT_AUTOMATICALLY_FALL_BACK'),'LOCALE_GATE');
  gate(c?.writerSafety?.DDV_NATIVE_WRITER==='OFF'&&c?.writerSafety?.PRODUCT_APPLY==='OFF','WRITER_GATE');
  const gates=payload.publicationGate45;
  gate(Array.isArray(gates)&&gates.length===45,'PUBLIC_GATE_COUNT');
  const articleGate=new Map();
  for(const item of gates){
    gate(record(item)&&ids.has(item.articleId)&&!articleGate.has(item.articleId),'PUBLIC_GATE_ID');
    gate(item.publicEligible===false&&item.englishSourceReviewed===true&&
      item.nonENEditorialAvailableCount===7&&item.independentLocaleApprovedCount===0&&
      item.rightsApproval===false&&item.switch1250FullArticleRuntimeAccepted===false&&
      item.switch1253ArticleReviewed===false&&item.steamArticleReviewed===false&&
      item.safety==='PUBLICATION_DENY_DEFAULT','PUBLIC_GATE_NOT_DENIED');
    articleGate.set(item.articleId,item);
  }
  const batches=full?payload.batches:payload.batchReviewPlan;
  gate(Array.isArray(batches)&&batches.length===10,'BATCH_COUNT');
  const batchIds=new Set(),batchedArticles=new Set();
  for(const b of batches){
    gate(typeof b.batchId==='string'&&!batchIds.has(b.batchId)&&Array.isArray(b.articleIds),'BATCH_ID');
    batchIds.add(b.batchId);
    gate(b.articleCount===b.articleIds.length&&b.localeQueueCount===7*b.articleIds.length,'BATCH_DENOMINATOR');
    gate(b.publicationReleasePolicy?.includes('ARTICLE_BY_ARTICLE'),'BATCH_NOT_PUBLICATION');
    for(const id of b.articleIds){
      gate(ids.has(id)&&!batchedArticles.has(id)&&articleGate.get(id)?.batchId===b.batchId,'BATCH_ARTICLE');
      batchedArticles.add(id);
    }
  }
  gate(batchedArticles.size===45,'BATCH_COVERAGE');
  let humanTasks=0,rightsTasks=0;
  if(full){
    gate(payload.status==='REVIEW_PACKAGE_READY_FOR_HUMAN_ASSIGNMENT_NOT_SIGNOFF','REVIEW_STATUS');
    gate(Array.isArray(payload.humanReview315)&&payload.humanReview315.length===315,'HUMAN_COUNT');
    gate(Array.isArray(payload.sourceAudit45)&&payload.sourceAudit45.length===45,'RIGHTS_COUNT');
    gate(payload.counts?.independentHumanQAApproved===0&&payload.counts?.rightsApproved===0&&
      payload.counts?.publicEligible===0,'COUNTS_GATE');
    const humanSet=new Set();
    for(const h of payload.humanReview315){
      const source=ids.get(h.articleId),k=key(h.articleId,h.locale);
      gate(source&&locales.has(h.locale)&&!humanSet.has(k),'HUMAN_ID_OR_LOCALE');
      humanSet.add(k);
      gate(h.sourceEnglishGuidanceSHA256===source.sourceHash&&h.categoryId===source.categoryId&&
        h.sourcePlatform==='Nintendo Switch'&&h.sourceVersion==='1.25.0'&&
        h.sourceBID==='52BD625D9B4E0053'&&h.sourceSchema===624,'HUMAN_SOURCE_VERSION');
      gate(typeof h.editedBody==='string'&&hash(h.editedBody)===h.editedBodySHA256,'HUMAN_BODY_SHA');
      gate(h.reviewerOnly===true&&h.reviewerDecision==='PENDING'&&h.reviewerName===''&&
        h.gameUIValidation==='NOT_PERFORMED'&&h.publicEligible===false,'HUMAN_SIGNOFF');
      humanTasks++;
    }
    const rightsSet=new Set();
    for(const r of payload.sourceAudit45){
      const source=ids.get(r.articleId);
      gate(source&&!rightsSet.has(r.articleId)&&r.sourceEnglishGUIDANCESha256===source.sourceHash&&
        r.categoryId===source.categoryId,'RIGHTS_SOURCE');
      rightsSet.add(r.articleId);
      gate(r.rightsReviewerDecision==='PENDING_HUMAN_LEGAL_OR_EDITORIAL'&&
        r.rightsReviewerIdentity===null&&r.publicationEligible===false&&
        r.switch1253?.status==='NOT_REVIEWED'&&r.steam?.status==='NOT_REVIEWED','RIGHTS_PENDING');
      rightsTasks++;
    }
    gate(humanSet.size===315&&rightsSet.size===45,'REVIEW_COVERAGE');
  } else {
    gate(record(payload.sourceAuditLinks)&&Object.keys(payload.sourceAuditLinks).length===45&&
      [...ids.keys()].every(id=>Object.hasOwn(payload.sourceAuditLinks,id)),'SOURCE_AUDIT_KEYS');
  }
  // Intentionally exclude source hashes, draft titles, body/rights evidence, URLs,
  // and even native term candidates from the result. No public rendering authority.
  return Object.freeze({schema:'ddv.guide.v18-private-check@1',
    articleCount:articleGate.size,reviewBatchCount:batchIds.size,
    humanTasks:full?humanTasks:315,rightsTasks:full?rightsTasks:45,
    reviewerOnly:true,mayPublish:false,approvedPages:0,
    publicFallbackAllowed:false,sourceVersion:'Nintendo Switch 1.25.0',
    publicationState:'HOLD'});
}
