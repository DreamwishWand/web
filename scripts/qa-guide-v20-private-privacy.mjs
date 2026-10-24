// 04 QR: private V20 reviewer corpus consistency. CLI input is local private Drive
// material, NEVER a public runtime asset, CI Secret or uploaded browser fixture.
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
const EXPECTED={
  privateSchema:'ddv.guide-systems-p0-collection-inventory-source-evidence@20',
  publicSchema:'ddv.guide-systems-p0-c01-publicsafe-return@20',
  locales:['DE','ES-ES','FR','IT','JA','PT-BR','ZH-CN']
};
function requireGate(ok,code){if(!ok)throw Error('GUIDE_V20_'+code);}
const key=x=>x.articleId+'|'+x.locale;
export function verifyV20Privacy(privateReview,publicSafe){
 requireGate(privateReview?.schema===EXPECTED.privateSchema,'PRIVATE_SCHEMA');
 requireGate(publicSafe?.schema===EXPECTED.publicSchema,'PUBLICSAFE_SCHEMA');
 requireGate(privateReview.status==='REVIEW_ONLY_DO_NOT_PUBLISH','PRIVATE_MUST_NOT_PUBLISH');
 requireGate(publicSafe.status==='PUBLICATION_BLOCKED','PUBLIC_MUST_NOT_PUBLISH');
 const a=privateReview.audit4,b=publicSafe.sourceProofsByArticle,rows=privateReview.reviewerOnly28;
 requireGate(Array.isArray(a)&&a.length===4&&Array.isArray(b)&&b.length===4,'FOUR_ARTICLES');
 requireGate(Array.isArray(rows)&&rows.length===28,'TWENTY_EIGHT_REVIEW_TASKS');
 const articleIds=a.map(x=>x.articleId);
 requireGate(new Set(articleIds).size===4,'DUPLICATE_ARTICLE');
 requireGate(new Set(rows.map(key)).size===28,'DUPLICATE_LOCALE');
 requireGate(rows.every(x=>articleIds.includes(x.articleId)&&EXPECTED.locales.includes(x.locale)),'REVIEWER_KEY_SCOPE');
 for(const id of articleIds){
  const locales=rows.filter(x=>x.articleId===id).map(x=>x.locale).sort();
  requireGate(JSON.stringify(locales)===JSON.stringify(EXPECTED.locales),'LOCALE_DISTRIBUTION');
 }
 for(const x of rows){
  const article=a.find(r=>r.articleId===x.articleId);
  requireGate(x.sourceEnglishGuidanceSHA256===article.sourceEnglishSHA256,'REVIEW_SOURCE_SHA_JOIN');
  requireGate(x.sourcePlatform==='Nintendo Switch'&&x.sourceVersion==='1.25.0'&&
    x.sourceBID==='52BD625D9B4E0053'&&x.sourceSchema===624,'SOURCE_VERSION_SCOPE');
  requireGate(x.publicEligible===false,'REVIEWER_CANNOT_PUBLISH');
 }
 requireGate(JSON.stringify(a)===JSON.stringify(b),'PUBLICSAFE_METADATA_DRIFT');
 const allowed={P0C01Articles:4,localeHumanReviewTasks:28,sourceProofOccurrences:12,
   uniqueVerifiedSourceDocs:6,humanQAApproved:0,rightsApproved:0,
   switch1253Approved:0,steamApproved:0,publicEligible:0};
 for(const [k,v] of Object.entries(allowed)){
  requireGate(privateReview.counts?.[k]===v&&publicSafe.counts?.[k]===v,'COUNT_'+k);
 }
 for(const x of a)requireGate(x.publicEligible===false&&x.humanNativeUIQASignedOff===false&&
  x.switch1253ArticleApproved===false&&x.steamArticleApproved===false&&
  x.rightsReviewerDecision==='PENDING_HUMAN_LEGAL_OR_EDITORIAL','RIGHTS_OR_HUMAN_SIGNOFF');
 requireGate(publicSafe.reviewerOnlyTextIncluded===false&&publicSafe.noPublicDraftPayload===true,
   'REVIEWER_TEXT_FLAG');
 // Structural recursive prohibition: absence of sensitive fields, not just
 // top-level omission. Publicsafe return is metadata-only, NOT a publishable manifest.
 const forbidden=new Set(['reviewerOnly28','editedBody','editorialTitle','sourceEnglishFiveSections']);
 function scan(v){
  if(v&&typeof v==='object'){
   if(Array.isArray(v))for(const item of v)scan(item);
   else for(const [k,item] of Object.entries(v)){requireGate(!forbidden.has(k),'RAW_REVIEWER_TEXT_LEAK');scan(item);}
  }
 }
 scan(publicSafe);
 return {contract:'ddv.qr.guide-v20-private-release-gate@1',
  articles:4,privateReviewerTasks:28,uniqueSourceDocs:6,sourceProofOccurrences:12,
  approvedHuman:0,approvedRights:0,publicEligible:0,gate:'BLOCKED',
  publicSafeMetadataOnly:true,privateBodiesUsedForPublication:false};
}
export function inspectRawV20(privateBytes,publicBytes){
 const parsed=verifyV20Privacy(JSON.parse(privateBytes),JSON.parse(publicBytes));
 const hash=b=>createHash('sha256').update(b).digest('hex');
 return {...parsed,privateSourceSha256:hash(privateBytes),publicSafeSha256:hash(publicBytes)};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const [mode,privatePath,publicPath]=process.argv.slice(2);
 if(mode!=='--check-private-and-publicsafe'||!privatePath||!publicPath)throw Error('V20_TWO_PRIVATE_FILE_ARGS_REQUIRED');
 console.log(JSON.stringify(inspectRawV20(readFileSync(privatePath),readFileSync(publicPath))));
}
