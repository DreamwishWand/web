// Independent 04 QR-W / PR567 CI-only changed risk. Reuse PR562/QA565 106->21 Source PASS.
import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
const MAIN='14f85625c06f277f580581f73897748367bcfe7a';
const SOURCE='5339e43b755d44fde938602c9a91574d3b245e44';
const ORIGINAL='ca1e09ccd803bcddc56310f23027cfff0b675c57';
const OLD_BASE='bd2edd00d029f866986aff96435615218398f991';
const workflow='.github/workflows/web-guide-systems-primary-bridge.yml';
const srcFiles=[workflow,'src/lib/guide/systems-primary-mechanic-bridge.mjs','tests/web-guide-systems-primary-mechanic-bridge.test.mjs'].sort();
const qaFiles=['.github/workflows/04qr-w-pr567-guide-ci-base-independent.yml','tests/04qr-w-pr567-guide-ci-base-independent.test.mjs'].sort();
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
const current=readFileSync(workflow,'utf8').trim();
const old=git('show',ORIGINAL+':'+workflow);
const frozenInterpolated='$'+"{{ github.event.pull_request.base.sha || '"+MAIN+"' }}";
const exactReplacement='BASE="'+frozenInterpolated+'"';
const oldBaseLine='BASE='+OLD_BASE;

test('fixed current-main source has exactly accepted three paths; two immutable data and Owner-test blobs remain unchanged',()=>{
 assert.equal(git('merge-base',MAIN,SOURCE),MAIN);
 assert.deepEqual(git('diff','--name-only',MAIN,SOURCE).split('\n').sort(),srcFiles);
 assert.deepEqual(git('diff','--name-only',SOURCE,'HEAD').split('\n').sort(),qaFiles);
 const data='src/lib/guide/systems-primary-mechanic-bridge.mjs';
 const testPath='tests/web-guide-systems-primary-mechanic-bridge.test.mjs';
 assert.equal(git('rev-parse',SOURCE+':'+data),'59fe25e9746bf4dd1a5a19d690f6512aa49c8dfc');
 assert.equal(git('rev-parse',SOURCE+':'+testPath),'f335d4af944b6844759607568b4748c9de755e70');
 assert.equal(git('rev-parse',SOURCE+':'+workflow),'d31f03a98c977bec50799aef6849bae1a856276d');
 assert.equal(git('rev-parse',ORIGINAL+':'+workflow),'e836c7351e9aafb7bf98df1e33d3138b62192f9a');
});

test('only one trusted PR base-line changed; owner 106-key source and Rights/Writer gates identical',()=>{
 assert.ok(current.includes(exactReplacement),'trusted pull_request.base.sha must be selected');
 assert.equal(current.split(exactReplacement).length,2,'exactly one new base selection');
 assert.equal(old.split(oldBaseLine).length,2,'original base was exactly one line');
 assert.equal(current.replace(exactReplacement,oldBaseLine),old,'the ENTIRE 58-line workflow except base one-line must be byte-equivalent');
 assert.doesNotMatch(current,/pull_request\.head\.sha\s*\|\|\s*['"]?[0-9a-f]{40}/);
 assert.match(current,/test "\$\(git merge-base "\$BASE" HEAD\)" = "\$BASE"/);
 assert.match(current,/test "\$\(wc -l <\/tmp\/web-systems-canonical-bridge\)" -eq 3/);
 assert.match(current,/contents: read/);
 assert.doesNotMatch(current,/secrets\.|continue-on-error|deploy-pages|workflow_dispatch|permissions:\s*write-all/);
});

test('event-path filtering and exact strict3 scope denies sibling Presets, Gallery, Rights, Native and QA-only changes',()=>{
 const y=current;
 for(const path of srcFiles)assert.ok(y.includes("'"+path+"'"),path);
 for(const path of ['src/routes/','src/lib/guide/runtime.js','src/lib/guide/copy.js','src/lib/community/','src/lib/ddv/','src/lib/wep/','src/lib/ui/','supabase/','static/','.github/workflows/pages.yml'])
  assert.ok(y.includes(path),'protected-path source deny '+path);
 // Deterministic independent model of the owner shell exact3 allowlist. Not a replacement for Actions.
 const accepted=new Set(srcFiles);
 const admit=paths=>paths.length===3&&new Set(paths).size===3&&paths.every(p=>accepted.has(p));
 assert.equal(admit(srcFiles),true);
 for(const paths of [
  [],[...srcFiles, 'src/routes/guide/systems/+page.svelte'],
  [...srcFiles,'src/lib/community/unsafe.js'],
  [...srcFiles,'src/lib/wep/NativeWriter.ts'],
  [...srcFiles,'supabase/migrations/public.sql'],
  [...srcFiles,'static/ddv/guide/article.json'],
  [...srcFiles,'src/lib/presets/stage1-root.mjs'],
  [...srcFiles,'tests/04qr-w-pr565-guide-bridge-independent.test.mjs'],
  ['src/lib/guide/systems-primary-mechanic-bridge.mjs',workflow],
  [srcFiles[0],srcFiles[0],srcFiles[2]]
 ])assert.equal(admit(paths),false,'deny '+JSON.stringify(paths));
});

test('PR-sha vs fallback gate source is explicit; old source identity and current 0/45 publication remain authoritative',()=>{
 assert.ok(frozenInterpolated.includes('github.event.pull_request.base.sha'));
 assert.ok(frozenInterpolated.includes(MAIN));
 assert.ok(!frozenInterpolated.includes(OLD_BASE),'old parent must not be fallback');
 const s=readFileSync('src/lib/guide/systems-primary-mechanic-bridge.mjs','utf8');
 assert.match(s,/ddv\.guide\.systems-public@1 manifest \(0\/45 approved\)/);
 assert.match(s,/NEVER Native Save ObjectIDs/);
 assert.doesNotMatch(s,/export const (?:SYSTEM_CATEGORIES|APPROVED_SYSTEM_PAGES)/);
 const q=readFileSync('.github/workflows/04qr-w-pr567-guide-ci-base-independent.yml','utf8');
 assert.match(q,/ref: \$\{\{ github\.event\.pull_request\.head\.sha \}\}/);
 assert.doesNotMatch(q,/secrets\.|workflow_dispatch|deploy-pages|write-all/);
});
