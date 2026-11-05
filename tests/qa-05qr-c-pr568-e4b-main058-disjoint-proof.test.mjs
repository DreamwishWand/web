import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';

// 05 QR-C independent new-only *composition applicability proof*, not
// a duplicate runtime test of the already accepted Source QA PR572 six cases.
// All code/fixtures are public synthetic Source; no private P1G or Writer.
const MAIN_OLD='14f85625c06f277f580581f73897748367bcfe7a';
const MAIN_NEW='058ac652b06fdc62ff85559186375c5b7a1e62a4';
const SOURCE_ACCEPTED='48378f9bc3e8c5f6e17009a2db9bb1eeb11cfe76';
const SOURCE_NEW='e4b9661c454715876219ce613d84a3f79cecc090';
const CORE='src/lib/ddv/timing/w1-scene-area-reference-readonly.mjs';
const TEST='tests/01e-w1-scene-area-reference-readonly.test.mjs';
const GUIDE=[
  '.github/workflows/web-guide-systems-primary-bridge.yml',
  'src/lib/guide/systems-primary-mechanic-bridge.mjs',
  'tests/web-guide-systems-primary-mechanic-bridge.test.mjs'
].sort();
const QA=[
  '.github/workflows/qa-05qr-c-pr568-e4b-main058-disjoint.yml',
  'tests/qa-05qr-c-pr568-e4b-main058-disjoint-proof.test.mjs'
].sort();
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
const files=(base,head)=>git('diff','--name-only',base,head).split('\n').filter(Boolean).sort();
const blob=(rev,path)=>git('rev-parse',`${rev}:${path}`);
const ownerNoPrivilege=/productWriterAuthorized:\s*false/;

test('new source HEAD is genuinely descended from the new main and frozen accepted old source',()=>{
  assert.equal(git('merge-base',MAIN_NEW,SOURCE_NEW),MAIN_NEW);
  assert.equal(git('merge-base',SOURCE_ACCEPTED,SOURCE_NEW),SOURCE_ACCEPTED);
  assert.equal(git('merge-base',MAIN_OLD,MAIN_NEW),MAIN_OLD);
  assert.equal(git('merge-base',SOURCE_NEW,'HEAD'),SOURCE_NEW);
});

test('latest-main to current source changes exactly the two accepted 01E source paths',()=>{
  assert.deepEqual(files(MAIN_NEW,SOURCE_NEW),[CORE,TEST].sort());
  assert.equal(git('rev-list','--count',`${MAIN_NEW}..${SOURCE_NEW}`),'2');
});

test('previous accepted composition to new composition changes only the three disjoint Guide files',()=>{
  assert.deepEqual(files(SOURCE_ACCEPTED,SOURCE_NEW),GUIDE);
  assert.deepEqual(files(MAIN_OLD,MAIN_NEW),GUIDE);
});

test('two 01E source blobs remain identical to accepted QA572-fixed source, not just similar text',()=>{
  assert.equal(blob(SOURCE_NEW,CORE),'433d743a9e9ac577ffbbb9a933c9c9e0e5c4e8ff');
  assert.equal(blob(SOURCE_NEW,TEST),'b3542754737d5103cacc86ad9deb1d5f07bc6e3b');
  assert.equal(blob(SOURCE_NEW,CORE),blob(SOURCE_ACCEPTED,CORE));
  assert.equal(blob(SOURCE_NEW,TEST),blob(SOURCE_ACCEPTED,TEST));
  const core=readFileSync(CORE,'utf8');
  assert.match(core,/wand\.01e\.w1-scene-area-reference@1/);
  assert.match(core,/export function inspectW1SceneAreaReferences\(/);
  assert.match(core,ownerNoPrivilege);
  assert.doesNotMatch(core,/^\s*import\s/m,'core inspector is standalone and cannot inherit Guide bridge module');
});

test('all three Guide introduced blobs are byte-identical to latest main and have no 01E import dependency',()=>{
  for(const path of GUIDE)assert.equal(blob(SOURCE_NEW,path),blob(MAIN_NEW,path),path);
  const bridge=readFileSync('src/lib/guide/systems-primary-mechanic-bridge.mjs','utf8');
  assert.doesNotMatch(bridge,/^\s*import\s/m);
  assert.doesNotMatch(bridge,/\bimport\s*\(/);
  assert.doesNotMatch(bridge,/\brequire\s*\(/);
  assert.match(bridge,/wand\.guide\.systems\.primary-keys@2026-10-24/);
  assert.match(bridge,/NEVER Native Save ObjectIDs/);
});

test('QA branch changes only its two own files and never modifies Source/Guide/Writer trees',()=>{
  assert.deepEqual(files(SOURCE_NEW,'HEAD'),QA);
  assert.equal(blob('HEAD',CORE),blob(SOURCE_NEW,CORE));
  assert.equal(blob('HEAD',TEST),blob(SOURCE_NEW,TEST));
  assert.equal(blob('HEAD','src/lib/guide/systems-primary-mechanic-bridge.mjs'),blob(MAIN_NEW,'src/lib/guide/systems-primary-mechanic-bridge.mjs'));
});
