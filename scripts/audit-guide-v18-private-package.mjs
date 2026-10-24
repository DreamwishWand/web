// PRIVATE OPERATOR CLI. Never import this CLI or private review source in src/static.
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {
  V18_SOURCE_SHA,V18_RETURN_SHA,validateV18PrivateReviewer
} from '../tests/fixtures/guide-systems-v18-private-review.mjs';
const paths=process.argv.slice(2);
if(paths.length!==2)throw Error('Usage: node scripts/audit-guide-v18-private-package.mjs /private/V18-review.json /private/V18-consumer-return.json');
const read=async(path,expected)=>{
  const data=await readFile(resolve(path));
  if(createHash('sha256').update(data).digest('hex')!==expected)
    throw Error('V18 SHA mismatch: reject unknown source');
  return JSON.parse(data.toString('utf8'));
};
const full=await read(paths[0],V18_SOURCE_SHA),consumer=await read(paths[1],V18_RETURN_SHA);
const a=validateV18PrivateReviewer(full,{full:true}),b=validateV18PrivateReviewer(consumer);
if(a.articleCount!==b.articleCount||a.humanTasks!==b.humanTasks||a.rightsTasks!==b.rightsTasks)
  throw Error('V18 private reviewer / consumer return denominators disagree');
console.log(JSON.stringify({result:'PRIVATE_V18_CONTRACT_PASS',
  reviewerPackageSHA256Verified:true,consumerReturnSHA256Verified:true,
  articleCount:a.articleCount,reviewTasks:a.humanTasks,rightsTasks:a.rightsTasks,
  reviewBatches:a.reviewBatchCount,publicEligible:0,
  publicationAuthorized:false,externalReviewerAccess:'NOT_ATTESTED',
  privacy:'NO_EDITORIAL_TEXT_TITLE_RIGHTS_URL_OR_ID_EMITTED'},null,2));
