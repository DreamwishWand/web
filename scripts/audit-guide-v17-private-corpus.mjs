// PRIVATE OPERATOR CLI ONLY. Reads a V17 raw corpus supplied at invocation;
// never copies it to src/static or emits bodies, titles, hashes, or UUIDs.
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {
  V17_KNOWN_SHA256, toPrivateV17ReviewerModel
} from '../tests/fixtures/guide-systems-v17-private-consumer.mjs';

const file=process.argv[2];
if(!file)throw new Error('Usage: node scripts/audit-guide-v17-private-corpus.mjs /private/path/V17.json');
const data=await readFile(resolve(file));
const actualHash=createHash('sha256').update(data).digest('hex');
if(actualHash!==V17_KNOWN_SHA256)throw new Error('V17 source digest mismatch; deny preview.');
const corpus=JSON.parse(data.toString('utf8'));
const result=toPrivateV17ReviewerModel(corpus);
const summary={
  result:'PRIVATE_V17_COMPATIBILITY_PASS',sourceDigestMatches:true,
  target:result.sourceTarget,articleCount:result.articleCount,
  localeRows:result.consumerLocaleRecords,editorialDrafts:result.AIEditorialDrafts,
  reviewPending:result.humanQAPending,rightsPending:result.rightsSignoffPending,
  nativeUIAliases:result.nativeAliases.length,
  publicEligible:0,canPublish:result.canPublish,
  structuredPublicDetailReady:false,blockingReasons:result.blockingReasons,
  privacy:'NO_RAW_TITLES_BODIES_SOURCE_HASHES_OR_NATIVE_VALUES_EMITTED'
};
console.log(JSON.stringify(summary,null,2));
