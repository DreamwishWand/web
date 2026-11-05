import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

// 05 QR-C independently verifies only NEW main-d8 Home applicability.
// Previous exact 01E Source runtime hostile-Proxy/valid-JSON synthetic tests
// in QA #572 and Guide-main structural proof QA #579 are REUSED, NOT rerun.
// No genuine P1G bytes, Native semantics, Writer, product Flag, or Cloud use.
const MAIN_PREVIOUS='058ac652b06fdc62ff85559186375c5b7a1e62a4';
const MAIN_CURRENT='d8e67925c2417d3fc3505611ac22919bdf354e75';
const SOURCE_PREVIOUS='e4b9661c454715876219ce613d84a3f79cecc090';
const SOURCE_CURRENT='2b5820844c8efcb286a7ba925baacd92098d00f5';
const CORE='src/lib/ddv/timing/w1-scene-area-reference-readonly.mjs';
const CORE_TEST='tests/01e-w1-scene-area-reference-readonly.test.mjs';
const home=[
  '.github/workflows/web-stage1-home-copy-locale.yml',
  'scripts/web-stage1-home-copy-locale-chrome.mjs',
  'src/lib/product-home/copy.js',
  'src/routes/+page.svelte',
  'tests/web-stage1-home-canonical-copy-locale.test.mjs'
].sort();
const qa=[
  '.github/workflows/qa-05qr-c-pr568-2b-main-d8-home.yml',
  'tests/qa-05qr-c-pr568-main-d8-home-applicability.test.mjs'
].sort();
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
const files=(a,b)=>git('diff','--name-only',a,b).split('\n').filter(Boolean).sort();
const blob=(rev,path)=>git('rev-parse',`${rev}:${path}`);

test('current 01E Source is based on protected main d8 and accepted Source e4b',()=>{
  assert.equal(git('merge-base',MAIN_CURRENT,SOURCE_CURRENT),MAIN_CURRENT);
  assert.equal(git('merge-base',SOURCE_PREVIOUS,SOURCE_CURRENT),SOURCE_PREVIOUS);
  assert.equal(git('merge-base',MAIN_PREVIOUS,MAIN_CURRENT),MAIN_PREVIOUS);
  assert.equal(git('merge-base',SOURCE_CURRENT,'HEAD'),SOURCE_CURRENT);
});

test('only the 5 Home paths enter both main and 01E composition, never Core or SaveSession',()=>{
  assert.deepEqual(files(MAIN_PREVIOUS,MAIN_CURRENT),home);
  assert.deepEqual(files(SOURCE_PREVIOUS,SOURCE_CURRENT),home);
  assert.deepEqual(files(MAIN_CURRENT,SOURCE_CURRENT),[CORE,CORE_TEST].sort());
});

test('01E helper and test stay byte-exact across accepted Head and new main composition',()=>{
  const accepted={ 
    [CORE]:'433d743a9e9ac577ffbbb9a933c9c9e0e5c4e8ff',
    [CORE_TEST]:'b3542754737d5103cacc86ad9deb1d5f07bc6e3b'
  };
  for (const [name,sha] of Object.entries(accepted)) {
    assert.equal(blob(SOURCE_CURRENT,name),sha,name);
    assert.equal(blob(SOURCE_PREVIOUS,name),sha,name);
  }
  const core=readFileSync(CORE,'utf8');
  assert.match(core,/export function inspectW1SceneAreaReferences\(/);
  assert.match(core,/wand\.01e\.w1-scene-area-reference@1/);
  assert.match(core,/productWriterAuthorized:\s*false/);
  assert.match(core,/productEditedCopyAuthorized:\s*false/);
  assert.match(core,/originalOverwriteAuthorized:\s*false/);
  assert.doesNotMatch(core,/^\s*import\s/m);
});

test('Home new bytes equal protected main and neither import Core inspector nor expose Writer dependency',()=>{
  for (const path of home) assert.equal(blob(SOURCE_CURRENT,path),blob(MAIN_CURRENT,path),path);
  const route=readFileSync('src/routes/+page.svelte','utf8');
  const copy=readFileSync('src/lib/product-home/copy.js','utf8');
  const chrome=readFileSync('scripts/web-stage1-home-copy-locale-chrome.mjs','utf8');
  const aggregated=[route,copy,chrome].join('\n');
  assert.doesNotMatch(aggregated,/\b(?:from\s*['"][^'"]*(?:w1-scene-area-reference-readonly|ddv\/timing)|import\s*\(['"][^'"]*ddv\/timing)/);
  assert.doesNotMatch(aggregated,/\b(?:execSync|spawnSync)\s*\(/);
  assert.match(route,/homeCopy/);
  assert.match(copy,/homeCopy/);
});

test('QA branch changes only its own independent 2 files; Source, Home and Guide unchanged',()=>{
  assert.deepEqual(files(SOURCE_CURRENT,'HEAD'),qa);
  for(const path of [CORE,CORE_TEST,...home]){
    assert.equal(blob('HEAD',path),blob(SOURCE_CURRENT,path),path);
  }
  assert.equal(blob('HEAD','src/lib/guide/systems-primary-mechanic-bridge.mjs'),
    blob(MAIN_CURRENT,'src/lib/guide/systems-primary-mechanic-bridge.mjs'));
});
