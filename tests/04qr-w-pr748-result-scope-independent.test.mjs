// 04 QR-W / W-WEB-COL-SCOPE-102 / COL-UX-42 independent fixed-head QA.
// Synthetic local Collection only: not genuine P1G, Owned, Native editing, Provider or publication.
import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {STAGE1_COLLECTION_ORDER,STAGE1_COLLECTION_PERSONAL_PROGRESS_ENABLED,STAGE1_COLLECTION_WRITER_ENABLED,stage1ScopeRecords} from '../src/lib/collection/stage1-root.mjs';

const SOURCE='2e3c8652aafe042704ca771e54218255fa2b1836';
const BASE='01f45bd20ab98da2b6dc7c807738c20592621f47';
const sourceBlobs=new Map([
 ['.github/workflows/web-stage1-collection-ux.yml','70d5620f805b1ff4f2266122ad42a40de3422c1f'],
 ['scripts/web-stage1-collection-chrome.mjs','970b959536b0c3fe6eec3a6187acb159c04167e3'],
 ['src/routes/collection/+page.svelte','c51ad760d6b5086378ee7d164f720e6735a13149'],
 ['tests/web-stage1-collection-root.test.mjs','0c9bb016704a0b9c6019a3b6cc6c4cc51c266e70']
]);
const qa=[
 '.github/workflows/04qr-w-pr748-result-scope-independent.yml',
 'scripts/04qr-w-pr748-result-scope-chrome.mjs',
 'tests/04qr-w-pr748-result-scope-independent.test.mjs'
].sort();
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
const diff=(a,b)=>git('diff','--name-only',a,b).split('\n').filter(Boolean).sort();
const source=readFileSync('src/routes/collection/+page.svelte','utf8');
const before=git('show',BASE+':src/routes/collection/+page.svelte');

test('QR748-01 exact original four Source blobs, one main-based commit and QA-only diff',()=>{
 assert.equal(git('rev-parse',SOURCE),SOURCE);
 assert.equal(git('merge-base',BASE,SOURCE),BASE);
 assert.equal(git('rev-list','--count',BASE+'..'+SOURCE),'1');
 assert.deepEqual(diff(BASE,SOURCE),[...sourceBlobs.keys()].sort());
 for(const [path,sha] of sourceBlobs){
  assert.equal(git('rev-parse',SOURCE+':'+path),sha,path);
  assert.equal(git('hash-object',path),sha,'unchanged Source '+path);
 }
 assert.equal(git('merge-base',SOURCE,'HEAD'),SOURCE);
 assert.deepEqual(diff(SOURCE,'HEAD'),qa);
});

test('QR748-02 Svelte post-render generation and disconnected root deny stale async viewport resets',()=>{
 for(const re of [
  /bind:this=\{collectionRoot\} data-stage1-collection-root/,
  /let scopeScrollPending = false/,
  /let scopeScrollGeneration = 0/,
  /async function resetResultScroll\(\):Promise<void>\{/,
  /const generation=\+\+scopeScrollGeneration;\s*await tick\(\)/,
  /generation!==scopeScrollGeneration\|\|!collectionRoot\?\.isConnected/,
  /if\(mobileFilter&&filterOpen\)\{scopeScrollPending=true;return;\}/,
  /scopeScrollPending=false/,
  /const target=Math\.max\(0,window\.scrollY\+collectionRoot\.getBoundingClientRect\(\)\.top\)/,
  /window\.scrollTo\(\{left:window\.scrollX,top:target,behavior:'instant'\}\)/
 ])assert.match(source,re);
 assert.doesNotMatch(before,/scopeScrollGeneration|resetResultScroll/);
 assert.doesNotMatch(source,/window\.scrollTo\(window\.scrollX,\s*target\)/,'global html smooth scrolling must not delay scoped reset');
});

test('QR748-03 all six changed-result paths invoke reset but changing filter while sheet open defers until close/breakpoint',()=>{
 for(const re of [
  /function chooseCategory\(id:string\):void\{[\s\S]*?pageLimit=72;\s*void resetResultScroll\(\)/,
  /function backToCategories\(\):void\{[\s\S]*?pageLimit=72;\s*void resetResultScroll\(\)/,
  /function toggleFacet\(which:'world'\|'universe',id:string\):void\{[\s\S]*?pageLimit=72; infoId=null; infoReturn=null;\s*void resetResultScroll\(\)/,
  /function clearFilters\(\):void\{\s*if\(!selectedWorlds\.length&&!selectedUniverses\.length\)return;[\s\S]*?void resetResultScroll\(\)/,
  /on:input=\{\(\)=>\{infoId=null;infoReturn=null;pageLimit=72;void resetResultScroll\(\);\}\}/,
  /unlockFilterScroll\(\);\s*await tick\(\);\s*if\(scopeScrollPending\)await resetResultScroll\(\)/,
  /if\(!mobileFilter\)\{\s*unlockFilterScroll\(\);\s*if\(scopeScrollPending\)void resetResultScroll\(\)/,
 ])assert.match(source,re);
 assert.match(source,/if\(!filterOpen\)filterToggleButton\?\.focus\(\{preventScroll:true\}\)/);
 assert.match(source,/document\.body\.style\.overflow='hidden'/);
 assert.match(source,/event\.key==='Escape'/);
});

test('QR748-04 previous PR739 click-time return remains independent; no invented user progress or permissions',()=>{
 assert.match(source,/window\.scrollTo\(\{left:origin\.x,top:origin\.y,behavior:'instant'\}\)/);
 assert.match(source,/origin\.context!==infoContext\(\)/);
 assert.match(source,/!origin\.trigger\.isConnected/);
 assert.match(source,/role=\{mobileFilter \? 'dialog' : undefined\}/);
 assert.match(source,/aria-modal=\{mobileFilter \? 'true' : undefined\}/);
 assert.match(source,/data-personal-progress="unknown" data-writer="off" data-media-rights="unverified"/);
 assert.equal(STAGE1_COLLECTION_ORDER.length,29);
 assert.equal(STAGE1_COLLECTION_PERSONAL_PROGRESS_ENABLED,false);
 assert.equal(STAGE1_COLLECTION_WRITER_ENABLED,false);
 assert.doesNotMatch(source,/saveEditedCopy|createPublicWork|setDreamsnapOfficialResultPublication|localStorage\.setItem/);
 assert.deepEqual(diff(BASE,SOURCE).filter(p=>p.startsWith('src/lib/')||p.startsWith('static/')||p.startsWith('supabase/')),[]);
});

test('QR748-05 facet OR within World/Universe, cross-group AND preserved on synthetic public catalog',()=>{
 const rows=[
  {itemId:1,family:'Furniture',worlds:['Valley'],universes:['Disney'],label:'A',searchText:'a'},
  {itemId:2,family:'Furniture',worlds:['Isle'],universes:['Disney'],label:'B',searchText:'b'},
  {itemId:3,family:'Furniture',worlds:['Isle'],universes:['Mickey'],label:'C',searchText:'c'},
  {itemId:4,family:'Fish',worlds:['Valley'],universes:['Mickey'],label:'D',searchText:'d'}
 ];
 assert.deepEqual(stage1ScopeRecords(rows,{worlds:['Valley','Isle'],universes:['Disney']}).map(x=>x.itemId),[1,2]);
 assert.deepEqual(stage1ScopeRecords(rows,{worlds:['Isle'],universes:['Mickey']}).map(x=>x.itemId),[3]);
 assert.deepEqual(stage1ScopeRecords(rows,{category:'Furniture',query:'b'}).map(x=>x.itemId),[2]);
});