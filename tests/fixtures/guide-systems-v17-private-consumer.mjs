// NON-PUBLIC V17 reviewer contract. This module MUST stay under tests/ and MUST
// NEVER be imported by src/, static/, or shipping build. No approval authority.
import { createHash } from 'node:crypto';
import { REVIEWED_EN_PAGES } from './guide-systems-reviewed-en.js';

export const V17_SCHEMA='ddv.guide-systems-native-locdb-provenance-promotion@17';
export const V17_KNOWN_SHA256='64a6aea830f8d3e371bcb23cc122e5bf2b45d70384f7e6d869d4e7682df39f9b';
export const V17_PRIVATE_CONSUMER='ddv.guide.v17-private-reviewer@1';
export const V17_TARGET={platform:'Nintendo Switch',gameVersion:'1.25.0',buildID:'52BD625D9B4E0053',schema:624};
export const V17_LOCALES=Object.freeze(['EN','FR','IT','DE','ES-ES','JA','ZH-CN','PT-BR']);
export const V17_LOCALE_TO_UI=Object.freeze({'EN':'en','FR':'fr','IT':'it','DE':'de','ES-ES':'es-ES','JA':'ja','ZH-CN':'zh-CN','PT-BR':'pt-BR'});
export const V17_LOCALE_TO_ZIP=Object.freeze({'EN':'en-US','FR':'fr','IT':'it','DE':'de','ES-ES':'es','JA':'ja','ZH-CN':'zh-CN','PT-BR':'pt-BR'});
const english=new Map(REVIEWED_EN_PAGES.map(a=>[a.id,a]));
const isObj=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const hex=v=>typeof v==='string'&&/^[0-9a-f]{64}$/.test(v);
const requireCondition=(ok,reason)=>{if(!ok)throw new TypeError('V17_PRIVATE_REJECT:'+reason);};
const joinKey=(id,locale)=>id+'\u0000'+locale;
export function toPrivateV17ReviewerModel(corpus){
  requireCondition(isObj(corpus)&&corpus.schema===V17_SCHEMA,'SCHEMA_UNSUPPORTED');
  requireCondition(isObj(corpus.target)&&Object.entries(V17_TARGET).every(([k,v])=>corpus.target[k]===v),'TARGET_UNVERIFIED');
  for(const name of ['consumer360','editorial315','perArticleRightsAndVersion45','humanReviewQueue315','verifiedV16NativeCorrections11'])
    requireCondition(Array.isArray(corpus[name]),'MISSING_'+name);
  requireCondition(corpus.consumer360.length===360&&corpus.editorial315.length===315&&corpus.perArticleRightsAndVersion45.length===45
    &&corpus.humanReviewQueue315.length===315&&corpus.verifiedV16NativeCorrections11.length===11,'COUNT_MISMATCH');
  requireCondition(isObj(corpus.publicGate)&&corpus.publicGate.eligiblePages===0&&corpus.publicGate.rightsSignoff===0
    &&corpus.publicGate.humanUIQACompleted===0&&corpus.publicGate.R17_GDE_SYS==='BLOCKED','PUBLIC_GATE_NOT_HOLD');
  const byConsumer=new Map(),byEditorial=new Map(),byRights=new Map(),byHuman=new Map();
  for(const record of corpus.consumer360){
    requireCondition(isObj(record)&&english.has(record.articleId)&&V17_LOCALES.includes(record.locale),'CONSUMER_ID_LOCALE');
    requireCondition(typeof record.previewTitle==='string'&&record.previewTitle.trim()&&hex(record.previewBodySHA256),'CONSUMER_CONTENT_IDENTITY');
    const k=joinKey(record.articleId,record.locale);
    requireCondition(!byConsumer.has(k),'DUPLICATE_CONSUMER');
    requireCondition(record.humanGameUIQA===false&&record.rightsSigned===false&&record.publicEligible===false,'UNAUTHORIZED_CONSUMER_PROMOTION');
    byConsumer.set(k,record);
  }
  requireCondition(english.size===45,'REVIEWED_EN_DENOMINATOR');
  for(const article of english.values()){
    const locales=V17_LOCALES.map(locale=>byConsumer.get(joinKey(article.id,locale)));
    requireCondition(locales.every(Boolean),'LOCALE_COVERAGE');
    requireCondition(locales[0].ENSourceReviewed===true&&locales[0].previewBodySHA256===article.sourceHash,'EN_SOURCE_HASH');
    requireCondition(locales.slice(1).every(x=>x.AIInternalEditorial===true&&x.ENSourceReviewed===false),'AI_DRAFT_MISLABELED');
  }
  for(const record of corpus.editorial315){
    requireCondition(isObj(record)&&english.has(record.articleId)&&V17_LOCALES.includes(record.locale)&&record.locale!=='EN','EDITORIAL_ID_LOCALE');
    const k=joinKey(record.articleId,record.locale),reference=english.get(record.articleId),consumer=byConsumer.get(k);
    requireCondition(!byEditorial.has(k),'DUPLICATE_EDITORIAL');
    requireCondition(record.categoryId===reference.categoryId&&record.groupId===reference.groupId,'TAXONOMY_CONFLICT');
    requireCondition(record.englishSourceBID===V17_TARGET.buildID&&record.englishSourceSchema===V17_TARGET.schema
      &&record.englishGuidanceSHA256===reference.sourceHash,'EDITORIAL_EN_SOURCE_MISMATCH');
    requireCondition(typeof record.editorialTitle==='string'&&record.editorialTitle===consumer.previewTitle,'EDITED_TITLE_MISMATCH');
    requireCondition(typeof record.editorialGuidanceText==='string'&&hex(record.editorialTextSHA256)
      &&createHash('sha256').update(record.editorialGuidanceText,'utf8').digest('hex')===record.editorialTextSHA256
      &&consumer.previewBodySHA256===record.editorialTextSHA256,'EDITORIAL_BODY_HASH_MISMATCH');
    requireCondition(record.humanQASignedOff===false&&record.rightsReleaseSignedOff===false&&record.publishedEligible===false,'UNAUTHORIZED_EDITORIAL_PROMOTION');
    byEditorial.set(k,record);
  }
  for(const row of corpus.perArticleRightsAndVersion45){
    requireCondition(isObj(row)&&english.has(row.articleId)&&!byRights.has(row.articleId),'RIGHTS_RECORD');
    requireCondition(row.sourceRightsSignoff==='NOT_SIGNED'&&row.publicEligible===false
      &&row.switch1250CurrentRuntimeRecheck===false&&row.switch1253==='NOT_REVIEWED'&&row.steam==='NOT_REVIEWED','RIGHTS_VERSION_HOLD');
    byRights.set(row.articleId,row);
  }
  for(const row of corpus.humanReviewQueue315){
    const k=joinKey(row.articleId,row.locale);
    requireCondition(byEditorial.has(k)&&!byHuman.has(k),'HUMAN_QA_RECORD');
    requireCondition(row.sourceEN_SHA256===english.get(row.articleId).sourceHash
      &&row.previewBodySHA256===byConsumer.get(k).previewBodySHA256
      &&row.missingIndependentHumanSignoff===true&&row.publicEligible===false&&row.rightsApproved===false,'HUMAN_QA_HOLD');
    byHuman.set(k,row);
  }
  const nativeAliases=[];
  requireCondition(isObj(corpus.nativeArchivesByLocale8),'NATIVE_ARCHIVE_MISSING');
  for(const correction of corpus.verifiedV16NativeCorrections11){
    const locale=V17_LOCALE_TO_ZIP[correction.locale],entry=byEditorial.get(joinKey(correction.articleId,correction.locale));
    requireCondition(locale&&entry&&correction.matchAgainstV16Proposed===true,'NATIVE_CORRECTION_MISMATCH');
    requireCondition(isObj(corpus.nativeArchivesByLocale8[locale])
      &&corpus.nativeArchivesByLocale8[locale].archiveSHA256===correction.exactZipSHA256,'NATIVE_ARCHIVE_HASH_MISMATCH');
    requireCondition(correction.scope==='UI_TERM_ONLY_NOT_MECHANIC_PROOF'
      &&correction.evidenceGrade==='CONFIRMED_RAW_SWITCH_V125_LOCALIZATION_STRING','NATIVE_PROOF_SCOPE');
    requireCondition(typeof correction.actualSwitchV125Value==='string'&&correction.actualSwitchV125Value.trim(),'NATIVE_VALUE_MISSING');
    nativeAliases.push(Object.freeze({articleId:correction.articleId,locale:V17_LOCALE_TO_UI[correction.locale],
      candidateTerm:correction.actualSwitchV125Value,scope:'UI_TERM_ONLY',publicEligible:false}));
  }
  // Never return the original manuscript, article bodies or provenance hashes.
  // Reviewer metadata cannot be turned into a production article. Not even EN.
  return Object.freeze({
    schema:V17_PRIVATE_CONSUMER,sourceSchema:V17_SCHEMA,sourceTarget:Object.freeze({...V17_TARGET}),
    publicationStatus:'PUBLIC_HOLD',canPublish:false,allEightLocalesApproved:0,articleCount:english.size,
    consumerLocaleRecords:byConsumer.size,AIEditorialDrafts:byEditorial.size,
    humanQAPending:byHuman.size,rightsSignoffPending:byRights.size,
    nativeAliases:Object.freeze(nativeAliases),currentVersionAcceptance:'UNVERIFIED',
    requiresStructuredArticleAuthoring:true,
    blockingReasons:Object.freeze(['NO_HUMAN_UI_QA','NO_RIGHTS_SIGNOFF','NO_VERSION_RUNTIME_RECHECK',
      'NO_STRUCTURED_INSTRUCTIONS_CONTRACT','NO_PUBLICATION_AUTHORIZATION'])
  });
}
