/** Independent 04 QR-W P0: PR535 1-file CI-policy gate.
 * No Source mutation; verify event-based path isolation + unchanged strict negative gate.
 * Parent accepted Collection 29x8 actual Chromium QA527 is REUSED, not repeated.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';

const MAIN='87f656833491b87712eee031f51ca135bda26b30';
const SOURCE='649cbee63e59404d2829cacee3b3c6dfce04c98a';
const WF='.github/workflows/web-stage1-collection-ux.yml';
const QA=[
 '.github/workflows/04qr-w-pr535-collection-ci-scope-independent.yml',
 'tests/04qr-w-pr535-collection-ci-scope-independent.test.mjs'
];
const ALLOW=[
 WF,
 'scripts/web-stage1-collection-chrome.mjs',
 'src/lib/collection/stage1-root.mjs',
 'src/routes/collection/+page.svelte',
 'tests/product-surface-routes.test.mjs',
 'tests/web-stage1-collection-root.test.mjs'
].sort();
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
const before=git('show',MAIN+':'+WF);
const fixed=git('show',SOURCE+':'+WF);
function pathsOf(yaml){
 const block=yaml.match(/^  pull_request:\n(    paths:\n(?:      - '[^']+'\n)+)/m)?.[1];
 if(!block)return [];
 return [...block.matchAll(/^      - '([^']+)'$/gm)].map(m=>m[1]).sort();
}
function shouldTrigger(paths,changed){return changed.some(p=>paths.includes(p));}
function acceptScopedChangedPaths(changed){
 if(changed.some(f=>!ALLOW.includes(f)))return false;
 return changed.length===6 || (changed.length===1 && changed[0]===WF);
}
test('frozen main87→PR535 exactly ONE modified workflow; QA branch has EXACT two QA-only paths',()=>{
 assert.equal(git('merge-base',MAIN,SOURCE),MAIN);
 assert.equal(git('diff','--name-only',MAIN,SOURCE),WF);
 assert.deepEqual(git('diff','--name-only',SOURCE,'HEAD').split('\n').sort(),QA);
 assert.equal(git('rev-parse',SOURCE+':'+WF),'feab528376083ba009f452af825c641a9f89aa00');
 assert.equal(git('rev-parse',MAIN+':'+WF),'83a7e5496e86715c03244ef28563fc79d81a632c');
 // Strictly the event trigger and COUNT exception may change, not the Chromium source/test/workflow body or permission model.
 for(const file of ALLOW.filter(p=>p!==WF))
  assert.equal(git('rev-parse',SOURCE+':'+file),git('rev-parse',MAIN+':'+file),'untouched Collection source '+file);
});
test('PR trigger includes only six Collection-specific files: real unrelated Stage1 PR changes excluded',()=>{
 const actual=pathsOf(fixed);
 assert.deepEqual(actual,ALLOW);
 assert.deepEqual(pathsOf(before),[],'pre-repair workflow had global broad PR trigger');
 for(const [name,changes] of Object.entries({
  gallery:['src/routes/gallery/+page.svelte','src/lib/community/gallery-stage1-root.mjs'],
  dreamsnaps:['src/routes/dreamsnaps/+page.svelte','src/lib/community/dreamsnaps-stage1-root.mjs'],
  guide:['src/routes/guide/+page.svelte','src/lib/guide/copy.js'],
  presets:['src/routes/presets/+page.svelte','src/lib/presets/stage1-root.mjs'],
  help:['src/routes/help/+page.svelte'],
  native626:['src/lib/wep/world-save-source.ts','tests/wep-schema626-area-record-unknown.test.mjs'],
  otherQA:['tests/04qr-w-pr537-help-3plus1-visual-independent.test.mjs','.github/workflows/04qr-w-pr537-help-3plus1-visual-independent.yml'],
  currentQA:QA
 })){
  assert.equal(shouldTrigger(actual,changes),false,name+' must NOT run Collection CI from pull_request');
 }
 assert.equal(shouldTrigger(actual,[WF]),true,'policy-only PR535 triggers');
 for(const file of ALLOW)assert.equal(shouldTrigger(actual,[file]),true,'Collection contract change still triggers '+file);
 assert.match(fixed,/^  push:\n    branches:\n      - 'web\/stage1-collection-root-\*'/m,'original owner push retained');
});
test('special one-file allowance ONLY policy fix, not any single source or mixed unsafe/partial diff',()=>{
 assert.equal(acceptScopedChangedPaths([WF]),true,'policy-only 1 path allowed');
 assert.equal(acceptScopedChangedPaths(ALLOW),true,'original all six source paths accepted');
 for(const file of ALLOW.filter(p=>p!==WF))
  assert.equal(acceptScopedChangedPaths([file]),false,'one source path must not silently bypass original six-path gate');
 assert.equal(acceptScopedChangedPaths(['src/routes/gallery/+page.svelte']),false);
 assert.equal(acceptScopedChangedPaths([WF,'src/routes/collection/+page.svelte']),false,'COUNT=2 must fail');
 assert.equal(acceptScopedChangedPaths([WF,'supabase/migrations/public_enable.sql']),false,'malicious one-plus-other');
 assert.equal(acceptScopedChangedPaths([...ALLOW.slice(0,5),'src/lib/community/auth-config.ts']),false,'six including unrelated must fail');
 assert.match(fixed,/if test "\$COUNT" -eq 1 && grep -qxF "\.github\/workflows\/web-stage1-collection-ux\.yml"/);
 assert.match(fixed,/test "\$COUNT" -eq 6/);
 assert.match(fixed,/OUTSIDE_STAGE1_SCOPE/);
 assert.match(fixed,/git diff --exit-code "\$BASE" HEAD -- src\/lib\/ddv\/ src\/lib\/community\//);
});
test('least privilege workflow event and existing READONLY 29 card/Chromium tests preserved',()=>{
 assert.match(fixed,/^permissions:\n  contents: read/m);
 assert.doesNotMatch(fixed,/pull_request_target|workflow_run:|workflow_dispatch:|write-all|contents: write|issues: write/);
 for(const s of [
  'Canonical 29 category and fail-closed scoped source negative tests',
  'All Node regressions and Svelte compiled static Pages',
  'No unapproved entity page prerender or Save writer',
  'Actual Chrome 8 languages, 29-category UX, keyboard, 320 and 200 percent'
 ])assert.ok(fixed.includes(s),s);
 assert.match(fixed,/chrome:\n    needs: source/);
 // No pipeline workaround may mark an unrelated 404 as accepted or enable Writer.
 assert.doesNotMatch(fixed,/continue-on-error: true|echo.*CI_PASS_FORCED|WEB_STAGE1_WRITER_ON|PRODUCT_OPERATION_ENABLED=true/);
});
