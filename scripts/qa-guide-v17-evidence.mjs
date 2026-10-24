// 04 QR — Guide V17 reviewer-source gate. Optional raw corpus is input only:
// no article body is written to repo/build, no public manifest changes.
// Offline synthetic tests are contract checks, not human UI or rights approval.
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
export const V17_SHA='64a6aea830f8d3e371bcb23cc122e5bf2b45d70384f7e6d869d4e7682df39f9b';
export const REVIEWED_TARGET={platform:'Nintendo Switch',gameVersion:'1.25.0',buildID:'52BD625D9B4E0053',schema:624};
export const V17_LOCALES=['EN','FR','IT','DE','ES-ES','JA','ZH-CN','PT-BR'];
export const V17_REVIEW_HOLD={humanRequired:315,rightsRequired:45,version1253Required:45,steamRequired:45,publicEligible:0};
const sha=v=>createHash('sha256').update(v).digest('hex');
const assert=(ok,reason)=>{if(!ok)throw new Error('GUIDE_V17_'+reason)};
const key=r=>r.articleId+'|'+r.locale;
export function inspectV17(v17){
 const issues=[];
 const check=(predicate,reason)=>{if(!predicate)issues.push(reason)};
 check(v17?.schema==='ddv.guide-systems-native-locdb-provenance-promotion@17','SCHEMA');
 check(V17_LOCALES.length===8 && V17_LOCALES.every(l=>v17?.nativeArchivesByLocale8?.[l==='EN'?'en-US':l==='JA'?'ja':l==='FR'?'fr':l==='IT'?'it':l==='DE'?'de':l==='ES-ES'?'es':l==='ZH-CN'?'zh-CN':'pt-BR']!==undefined),'EIGHT_NATIVE_ARCHIVES');
 check(Object.entries(REVIEWED_TARGET).every(([k,v])=>v17?.target?.[k]===v),'SWITCH1250_TARGET');
 const ed=v17?.editorial315, consumer=v17?.consumer360,queue=v17?.humanReviewQueue315,rights=v17?.perArticleRightsAndVersion45;
 check(Array.isArray(ed)&&ed.length===315,'EDITORIAL_315');
 check(Array.isArray(consumer)&&consumer.length===360,'CONSUMER_360');
 check(Array.isArray(queue)&&queue.length===315,'HUMAN_QUEUE_315');
 check(Array.isArray(rights)&&rights.length===45,'RIGHTS_45');
 if(!Array.isArray(ed)||!Array.isArray(consumer)||!Array.isArray(queue)||!Array.isArray(rights))
   return{contract:'ddv.qr.guide-v17-acceptance@1',kind:'INTERNAL_REVIEW_ONLY',checks:issues,gate:'BLOCKED'};
 const articleIds=[...new Set(rights.map(x=>x.articleId))];
 check(articleIds.length===45,'RIGHTS_DISTINCT_IDS_45');
 for(const [data,name,expected] of [[ed,'ED',315],[consumer,'CON',360],[queue,'QUEUE',315]]){
  check(new Set(data.map(key)).size===expected,name+'_DUPLICATE_KEY');
  check(data.every(x=>articleIds.includes(x.articleId)&&V17_LOCALES.includes(x.locale)),name+'_IDENTITY');
  for(const id of articleIds){
   const locs=data.filter(x=>x.articleId===id).map(x=>x.locale).sort();
   const needed=(name==='CON'?V17_LOCALES:V17_LOCALES.filter(x=>x!=='EN')).slice().sort();
   check(locs.join('|')===needed.join('|'),name+'_LOCALE_MISSING_'+id);
  }
 }
 const rightsIndex=new Map(rights.map(x=>[x.articleId,x]));
 const queueIndex=new Map(queue.map(x=>[key(x),x]));
 for(const x of ed){
  const q=queueIndex.get(key(x));
  check(q?.sourceEN_SHA256===x.englishGuidanceSHA256 && q?.previewBodySHA256===x.editorialTextSHA256,'QUEUE_SOURCE_HASH_'+key(x));
  check(x.humanNativeGameUIQASignedOff===false&&x.humanQASignedOff===false &&
    x.rightsReleaseSignedOff===false&&x.publishedEligible===false,'UNAUTHORIZED_EDIT_'+key(x));
  check(q?.missingIndependentHumanSignoff===true&&q?.publicEligible===false&&
    q?.rightsApproved===false&&q?.localeDisplayAcceptance==='NOT_TESTED','QUEUE_NOT_APPROVED_'+key(x));
  check(x.englishSourceBID===REVIEWED_TARGET.buildID&&x.englishSourceSchema===624,'VERSION_BINDING_'+key(x));
 }
 for(const x of rights){
  check(x.sourceRightsSignoff==='NOT_SIGNED'&&x.publicEligible===false&&
    x.switch1250CurrentRuntimeRecheck===false&&x.switch1253==='NOT_REVIEWED'&&
    x.steam==='NOT_REVIEWED','RIGHTS_VERSION_HOLD_'+x.articleId);
 }
 for(const x of consumer)check(x.publicEligible===false&&x.humanGameUIQA===false&&x.rightsSigned===false,
   'CONSUMER_NOT_APPROVED_'+key(x));
 check(Array.isArray(v17?.verifiedV16NativeCorrections11)&&v17.verifiedV16NativeCorrections11.length===11 &&
   v17.verifiedV16NativeCorrections11.every(x=>x.matchAgainstV16Proposed===true),'NATIVE_TERMINOLOGY_11');
 check(v17?.publicGate?.eligiblePages===0&&v17?.publicGate?.rightsSignoff===0&&
   v17?.publicGate?.humanUIQACompleted===0 &&
   v17?.publicGate?.R17_GDE_SYS==='BLOCKED'&&v17?.publicGate?.R17_SEED_GUIDE==='BLOCKED','PUBLIC_HOLD');
 return{contract:'ddv.qr.guide-v17-acceptance@1',kind:'INTERNAL_REVIEW_ONLY',corpus:{en:articleIds.length,nonEnglish:ed.length,consumer:consumer.length,reviewQueue:queue.length,nativeLocales:8},missing:V17_REVIEW_HOLD,
  checks:issues,gate:'BLOCKED',sourceVerified:issues.length===0};
}
export function inspectRawV17(bytes){
 const actual=sha(bytes);
 assert(actual===V17_SHA,'SOURCE_SHA_MISMATCH');
 const result=inspectV17(JSON.parse(bytes.toString('utf8')));
 assert(result.checks.length===0,'STRUCTURAL_CONTRACT_FAILED_'+result.checks.slice(0,4).join('_'));
 return{...result,sha256:actual};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const [action,file]=process.argv.slice(2);
 if(action!=='--check-v17'||!file)throw new Error('GUIDE_V17_RAW_FILE_ARGUMENT_REQUIRED');
 const result=inspectRawV17(readFileSync(file));
 console.log(JSON.stringify(result)); // Only metadata; NEVER original JSON/article copy.
}
