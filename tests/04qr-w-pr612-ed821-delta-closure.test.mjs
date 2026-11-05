// Independent 04 QR-W differential QA ONLY for 07 DBK PR612 corrected Source HEAD.
// Synthetic identifiers/digests only. No copyrighted art, private Save or CDN.
import assert from 'node:assert/strict';
import test from 'node:test';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {planGameImageTakedown,preflightGameImageOperatorReceipt} from '../ops/ddv-item-image-operator-gate.mjs';
const git=(...xs)=>execFileSync('git',xs,{encoding:'utf8'}).trim();
const MAIN='6428d080786bf3b2035be86b945b1460dbf1452a';
const OLD='84972812d025f486f813ae289aeb0af8cd24458f';
const FIX='ed821f9fa1300d57f02f5f9956e857df1202deba';
const owner=[
 'docs/rights/ddv-item-image-release-operator-20261105.md',
 'ops/ddv-item-image-operator-gate.mjs',
 'ops/ddv-item-image-operator-readiness-template.json',
 'tests/ddv-item-image-operator-gate.test.mjs'
].sort();
const changed=[
 'ops/ddv-item-image-operator-gate.mjs',
 'tests/ddv-item-image-operator-gate.test.mjs'
].sort();
const qa=[
 '.github/workflows/04qr-w-pr612-ed821-delta-closure.yml',
 'tests/04qr-w-pr612-ed821-delta-closure.test.mjs'
].sort();
test('exact corrected Source4 and only Source2 delta; QA-only two paths, no media/flags',()=>{
 assert.equal(git('merge-base',MAIN,OLD),MAIN);
 assert.equal(git('merge-base',OLD,FIX),OLD);
 assert.equal(git('merge-base',FIX,'HEAD'),FIX);
 assert.deepEqual(git('diff','--name-only',MAIN,FIX).split('\n').sort(),owner);
 assert.deepEqual(git('diff','--name-only',OLD,FIX).split('\n').sort(),changed);
 assert.deepEqual(git('diff','--name-only',FIX,'HEAD').split('\n').sort(),qa);
 for(const [path,sha] of Object.entries({
  'ops/ddv-item-image-operator-gate.mjs':'16f48dd5bb9c9a17a86bc9cd7f915961eb5aecb7',
  'tests/ddv-item-image-operator-gate.test.mjs':'0e124ea9b55f7fec4e2f2bf5d4b251c1279eefc2',
  'ops/ddv-item-image-operator-readiness-template.json':'d9e0020017b4c979fc41c4578f9504fd0d0f7121'
 }))assert.equal(git('rev-parse',FIX+':'+path),sha,path);
 console.log('QR612_FIX_ED821_EXACT_SOURCE2_QA2_PINNED_PASS');
});
const H=x=>x.repeat(64);
const mk=(itemId,png,webp)=>({itemId:String(itemId),sourcePngSha256:H(png),webpSha256:H(webp)});
const A=mk(40000041,'a','b'),B=mk(40000042,'a','c'),C=mk(40000043,'d','c'),D=mk(40000044,'d','e'),U=mk(40000045,'f','1');
const expectedIDs=[A.itemId,B.itemId,C.itemId,D.itemId],expectedHash=['a','b','c','d','e'].map(H);
test('old RED: transitive PNG->WebP->PNG closure with permutations, all selectors, isolate unrelated U',()=>{
 for(const rows of [[A,B,C,D,U],[U,D,C,B,A],[C,U,A,D,B],[D,A,B,U,C]]){
  for(const sel of [{kind:'ITEM_ID',value:A.itemId},{kind:'SOURCE_SHA256',value:H('a')},{kind:'WEBP_SHA256',value:H('c')}]){
   const result=planGameImageTakedown(rows,sel);
   assert.equal(result.resolvable,true,JSON.stringify(result));
   assert.deepEqual(result.itemIds,expectedIDs);
   assert.deepEqual(result.hashes,expectedHash);
   assert.ok(result.actionsRequired.includes('INVALIDATE_CDN_AND_OLD_URLS'));
  }
 }
 console.log('QR612_FIX_TRANSITIVE_ALIAS_COMPONENT_PERMUTATION_PASS');
});
test('old RED: damaged linked WebP row must fail closed with NO partial output',()=>{
 const invalid={...B,webpSha256:'CORRUPTED'};
 const invalidId={...B,itemId:null};
 const invalidSha={...B,sourcePngSha256:'CORRUPTED'};
 const duplicated={...A,webpSha256:null};
 for(const [rows,selector] of [
  [[A,invalid],{kind:'ITEM_ID',value:A.itemId}],
  [[invalid,A],{kind:'ITEM_ID',value:A.itemId}],
  [[A,invalidId],{kind:'SOURCE_SHA256',value:H('a')}],
  [[A,duplicated],{kind:'ITEM_ID',value:A.itemId}],
  [[A,C,invalid],{kind:'WEBP_SHA256',value:H('b')}],
  [[B,invalidSha],{kind:'WEBP_SHA256',value:H('c')}]
 ]){
  const x=planGameImageTakedown(rows,selector);
  assert.equal(x.resolvable,false,JSON.stringify(x));
  assert.deepEqual(x.itemIds,[]);
  assert.deepEqual(x.hashes,[]);
 }
 console.log('QR612_FIX_DAMAGED_LINKED_DERIVATIVE_NO_PARTIAL_PASS');
});
test('unchanged operator template remains OFF; no legal or operational readiness inferred',()=>{
 const tmpl=JSON.parse(readFileSync(new URL('../ops/ddv-item-image-operator-readiness-template.json',import.meta.url),'utf8'));
 assert.equal(tmpl.publicationState,'OFF');
 assert.equal(tmpl.copyrightLicenceStatus,'UNKNOWN');
 assert.equal(tmpl.rightsContact,null);
 assert.equal(preflightGameImageOperatorReceipt(tmpl).readyForOperatorReview,false);
 const independent=planGameImageTakedown([A,U],{kind:'ITEM_ID',value:A.itemId});
 assert.equal(independent.resolvable,true);
 assert.deepEqual(independent.itemIds,[A.itemId]);
 assert.deepEqual(independent.hashes,[H('a'),H('b')]);
 console.log('QR612_OPERATOR_UNREVIEWED_OFF_AND_UNRELATED_ITEM_INTACT_PASS');
});
