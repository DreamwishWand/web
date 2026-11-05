/** Independent 04 QR-W PR545: MAIN-based Owner-only P1G receipt POLICY delta.
 * Prior same-scope four Source files are re-used from PR494/independent QA501.
 * DO NOT execute the real Owner-P1G runner or inject user-private data in CI.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
const repo=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
const MAIN='87f656833491b87712eee031f51ca135bda26b30';
const SOURCE='26a3506ddb2282040d6c2365418d0ed9f2dd28d6';
const PRIOR='c75bafc20168679c6826a1dfa8967908e7413679';
const wf='.github/workflows/wep-private-626-readonly-browser-20261104.yml';
const runner='scripts/wep-private-626-readonly-browser-receipt-20261104.mjs';
const boundary='scripts/wep-private-626-readonly-boundary-20261104.mjs';
const tests='tests/wep-private-626-readonly-browser-boundary.test.mjs';
const docs='docs/wep/private-626-world-readonly-browser-20261104.md';
const sourceFiles=[wf,docs,runner,boundary,tests].sort();
const qaFiles=['.github/workflows/04qr-w-pr545-626-private-readonly-policy-independent.yml','tests/04qr-w-pr545-626-private-readonly-policy-independent.test.mjs'].sort();
const work=readFileSync(wf,'utf8'),execSource=readFileSync(runner,'utf8');
function changedPaths(p){return [...p.matchAll(/^      - '([^']+)'$/gm)].map(x=>x[1]).sort();}
test('PR545 fixed main87 5 only Source additions + QA 2 only, Owner ancestor four immutable identical blobs',()=>{
 assert.equal(repo('merge-base',MAIN,SOURCE),MAIN);
 assert.deepEqual(repo('diff','--name-only',MAIN,SOURCE).split('\n').sort(),sourceFiles);
 assert.deepEqual(repo('diff','--name-only',SOURCE,'HEAD').split('\n').sort(),qaFiles);
 assert.equal(repo('rev-parse',SOURCE+':'+wf),'9cae3a5413437475183caa193e0cf6d61392f556');
 const identical={
  [docs]:'b0fae8e4200446c13e8ec05d649dd2ad19c21aff',
  [runner]:'9e7c8fa0cfa2c6bab9e1dff7a16d16734d33e262',
  [boundary]:'ad39e8974de1321bd52014646bb514aec921ba7b',
  [tests]:'2b86c367f6fed0e022e058820f09a15397c53799'
 };
 for(const [p,blob] of Object.entries(identical)){
  assert.equal(repo('rev-parse',SOURCE+':'+p),blob,'expected fixed WEP Source '+p);
  assert.equal(repo('rev-parse',PRIOR+':'+p),blob,'previous independent QR501 accepted ancestor, no re-QA '+p);
 }
 assert.equal(repo('rev-parse',PRIOR+':'+wf),'afeb0d1d9e131806540a243320ca96d6a393487a');
 assert.equal(repo('rev-parse',SOURCE+':src/lib/wep/real-save-spatial-read.ts'),
  '48b32c3bd3132c6e48a47d7b8f017a35642d2623');
 assert.equal(repo('rev-parse',SOURCE+':src/lib/wep/world-save-source.ts'),
  repo('rev-parse',MAIN+':src/lib/wep/world-save-source.ts'),'no World source/Writer mutation');
});
test('main-compatible workflow only synthetic + owner-executor syntax, never uses real P1G, no privileged artifact',()=>{
 assert.match(work,/^name: WEP 626 owner-private readonly browser receipt \(synthetic policy only\)$/m);
 assert.match(work,/^  push:\n    branches: \['wep\/private-626-world-readonly-main-policy-20261105'\]/m);
 assert.match(work,/^  pull_request:\n    branches: \['main'\]/m);
 assert.deepEqual(changedPaths(work),[wf,runner,boundary,tests].sort());
 assert.match(work,/^  workflow_dispatch:$/m);
 assert.match(work,/^permissions:\n  contents: read$/m);
 assert.doesNotMatch(work,/pull_request_target|id-token: write|contents: write|secrets\.|actions\/upload-artifact|environment: production|deploy/);
 assert.match(work,/run: node --test tests\/wep-private-626-readonly-browser-boundary.test.mjs/);
 assert.match(work,/run: node --experimental-strip-types --check scripts\/wep-private-626-readonly-browser-receipt-20261104.mjs/);
 assert.doesNotMatch(work,/run:\s*node(?:\s+--experimental-strip-types)?\s+scripts\/wep-private-626-readonly-browser-receipt-20261104.mjs/);
 for(const name of ['WEP_PRIVATE_P1G_PATH','WEP_PRIVATE_LOCAL_ONLY_ACK','WEP_PRIVATE_EXTERNAL_BUILD_CONFIRMED'])
  assert.ok(work.includes('test -z "${'+name+':-}"'),name+' must be absent in CI');
 assert.match(work,/src\/lib\/wep\/real-save-spatial-read.ts/);
 assert.match(work,/48b32c3bd3132c6e48a47d7b8f017a35642d2623/);
});
test('owner-private actual executor separately gated and fail closed, NEVER CLAIMS Native or edited-copy',()=>{
 for(const text of [
  'OWNER DESKTOP ONLY','WEP_PRIVATE_P1G_PATH','WEP_PRIVATE_BUILD_ID','WEP_PRIVATE_EXTERNAL_BUILD_CONFIRMED',
  'WEP_PRIVATE_LOCAL_ONLY_ACK','WEP_PRIVATE_CHROME_BIN',
  'requireOwnerPrivateScope()','ensurePrivateSourceOutsideCheckout(',
  "assert.equal(identity.schema,626", "assert.equal(decoded.inputType,'packaged'",
  "serviceWorkers:'block'",'page.routeWebSocket(', "['GET','HEAD']", "acceptDownloads:false",
  'sourceReferenceIssueCount','evaluate626BrowserCount(', 'originalShaUnchanged',
  "if(sha(await readFile(approvedSourcePath))!==originalSha)",
  "writeFile(name,JSON.stringify(report,null,2)+'\\n',{mode:0o600})"
 ])assert.ok(execSource.includes(text),'owner desktop scope safety '+text);
 for(const phrase of [
  "nativeGeometryVerified:false","persistentWriterAuthorized:false",
  "productApplyAuthorized:false","status:'NOT_RUN'",
  "OWNER_PRIVATE_P1G_IF_EXECUTED_NOT_INDEPENDENT_QA_NOT_NATIVE_V3",
  "PARTIAL_626_REFERENCE_OR_BROWSER_SOURCE_UNRESOLVED",
  "'FAIL_CLOSED'"
 ])assert.ok(execSource.includes(phrase),phrase);
 assert.doesNotMatch(execSource,/uploadPrivateSave\(|writeEditedCopy\(|providerUpload\(|record\s+devicePass/i);
 const manual=readFileSync(docs,'utf8');
 for(const phrase of [
  'NOT_RUN','Owner','9A239D3DB569756D','schema626',
  'outside','No server-side storage','0600'
 ])assert.ok(manual.toLowerCase().includes(phrase.toLowerCase()),'doc explicitly preserves caveat '+phrase);
});
test('the only new Source change is workflow branch trigger/step label, NO weakening original synthetic job',()=>{
 const old=repo('show',PRIOR+':'+wf);
 const renamed=old
  .replace("branches: ['wep/private-626-readonly-browser-receipt-20261104']", "branches: ['wep/private-626-world-readonly-main-policy-20261105']")
  .replace("branches: ['wep/private-genuine-p1g-e2e-harness-source-only-20261104']", "branches: ['main']")
  .replace('Pin accepted parent 624 source + new owner branch','Pin accepted main WEP spatial source and isolated synthetic runner');
 assert.equal(work.trimEnd(),renamed.trimEnd(),'Source WEP new workflow must ONLY update triggers and label, trailing newline not semantic');
 assert.match(execSource,/PRIVATE_BROWSER_WEBSOCKET_GUARD_REQUIRED/);
 assert.match(execSource,/626_WRONG_BID_CLEARS_PRIOR_SOURCE_READ/);
 assert.match(execSource,/626_LOCAL_READONLY_NO_CANVAS_DRAFT_EDIT_EXPORT/);
 assert.match(execSource,/PARTIAL_626_REFERENCE_OR_BROWSER_SOURCE_UNRESOLVED/);
});
