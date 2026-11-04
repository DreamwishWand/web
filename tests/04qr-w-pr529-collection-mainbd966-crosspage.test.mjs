/** 04QR-W PR529 new-mainbd966 source-only changed-risk Q/A.
 * Previous PR519 QA527 all29x8 UI accepted; DO NOT rerun unchanged ancestors.
 * Only new concern: latest main WEP626/Worker/Blob cross-page privilege leak.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {
 stage1RootCategories,STAGE1_COLLECTION_PERSONAL_PROGRESS_ENABLED,STAGE1_COLLECTION_WRITER_ENABLED
} from '../src/lib/collection/stage1-root.mjs';
const MAIN='bd966f9e94be48fafce25cfbdc298439ee47aca3';
const SOURCE='ac73ac398c9c8e36b75cf038ed3fb8bf523ac6ae';
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
const original=Object.freeze({
 '.github/workflows/web-stage1-collection-ux.yml':'c9696b9c22fcb9b42f1b5e23c7795cc4027c6705',
 'scripts/web-stage1-collection-chrome.mjs':'5af5e4721b819198bea5f0deb3e4627545f60a17',
 'src/lib/collection/stage1-root.mjs':'df382afcab269cf8b77bf83d859f688e92ef00fe',
 'src/routes/collection/+page.svelte':'413c539a6a06be50acf81d278c7ccd74182983cb',
 'tests/product-surface-routes.test.mjs':'8046286d8ae1a86dba59f2564ea14d8ae40673f9',
 'tests/web-stage1-collection-root.test.mjs':'326a451384cc975bd62135795c58465cdb9c4036'
});
const QA=[
 '.github/workflows/04qr-w-pr529-collection-mainbd966-crosspage.yml',
 'scripts/04qr-w-pr529-collection-mainbd966-crosspage-chromium.mjs',
 'tests/04qr-w-pr529-collection-mainbd966-crosspage.test.mjs'
];
test('MAIN bd966 selected SIX original accepted PR519 source blobs only, QA-only exactly three paths',()=>{
 assert.equal(git('merge-base',MAIN,SOURCE),MAIN);
 assert.deepEqual(git('diff','--name-only',MAIN,SOURCE).split('\n').sort(),Object.keys(original).sort());
 for(const [p,sha] of Object.entries(original))assert.equal(git('rev-parse',SOURCE+':'+p),sha,p+' immutable Source Git blob');
 assert.deepEqual(git('diff','--name-only',SOURCE,'HEAD').split('\n').sort(),QA);
});
test('new main accepted WEP626 and single Session original-backup Bridge are wholly unchanged by Stage1 Source',()=>{
 for(const path of [
  'src/lib/wep/world-save-source.ts',
  'src/lib/ddv/core/save/local-save-session-bridge.mjs',
  'src/lib/ddv/core/save/local-save-session-bridge.d.mts',
  'tests/local-single-save-session-bridge.test.mjs'
 ])assert.equal(git('hash-object',path),git('rev-parse',MAIN+':'+path),path);
 assert.equal(git('hash-object','src/lib/wep/world-save-source.ts'),'9888b91c92953cf0f9fd828d2ba0cb763e35dac5');
});
test('Collection SourceUI cannot silently promote personal 626 ownership after co-resident Save pages',()=>{
 const p=readFileSync('src/routes/collection/+page.svelte','utf8');
 assert.equal(STAGE1_COLLECTION_PERSONAL_PROGRESS_ENABLED,false);
 assert.equal(STAGE1_COLLECTION_WRITER_ENABLED,false);
 assert.match(p,/data-personal-progress="unknown" data-writer="off" data-media-rights="unverified"/);
 assert.match(p,/const inertProgress='— \/ —'/);
 assert.match(p,/disabled title=\{ui\.unknown\}/);
 assert.doesNotMatch(p,/ownedCountFromWorld|loadWorldSave|sourceBID626ToOwned|persistentWriteAuthorized: true|uploadPrivateSave/);
 const syntheticStaticCatalog=stage1RootCategories({f:['Furniture','Fish'],target:{platform:'switch',BID:'52BD625D9B4E0053',schema:624}});
 for(const x of syntheticStaticCatalog){
  assert.equal(x.progress,null);
  assert.equal(x.denominator,null);
  assert.equal(x.percentage,null);
  assert.equal(x.imageRightsAccepted,false);
 }
});
