// 04 QR-W independent changed-only QA for 08 WEB PR717 / COL-UX-29.
// Source-only synthetic local Catalog; never asserts Native personal ownership.
import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {STAGE1_COLLECTION_ORDER,STAGE1_COLLECTION_WRITER_ENABLED,STAGE1_COLLECTION_PERSONAL_PROGRESS_ENABLED,stage1CollectionCopy} from '../src/lib/collection/stage1-root.mjs';

const SOURCE='4286ce02a14ce11035fd75cf77839deee8be3497';
const PARENT='073c6a6c08d8b2cd1aeb8332c29c49cbab24477c';
const pinned=new Map([
 ['.github/workflows/web-stage1-collection-ux.yml','7ed51d6623d81f777cdfdc765efec55d944bb280'],
 ['scripts/web-stage1-collection-chrome.mjs','2957746c91dc6ab3f8dcd89532d2c99fe629263f'],
 ['src/routes/collection/+page.svelte','d9e9ae2e98975da1231d69481d7d776d1216cf9e'],
 ['tests/web-stage1-collection-root.test.mjs','317d33e91e6a57ce875cb86f84e1e9523347aa9a']
]);
const QA=[
 '.github/workflows/04qr-w-pr717-collection-independent.yml',
 'scripts/04qr-w-pr717-collection-chrome.mjs',
 'tests/04qr-w-pr717-collection-independent.test.mjs'
].sort();
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
const changes=(a,b)=>git('diff','--name-only',a,b).split('\n').filter(Boolean).sort();
const page=readFileSync(new URL('../src/routes/collection/+page.svelte',import.meta.url),'utf8');
const selectBody=page.slice(page.indexOf('function selectInfo(id:number,event:MouseEvent)'),page.indexOf('async function closeInfo()',page.indexOf('function selectInfo')));
const closeBody=page.slice(page.indexOf('async function closeInfo():Promise<void>'),page.indexOf('const inertProgress=',page.indexOf('async function closeInfo()')));

test('Q717-01 fixed Source exact four immutable blobs; three QA-only adds, no feature Source change',()=>{
 assert.equal(git('rev-parse',SOURCE),SOURCE);
 assert.equal(git('merge-base',PARENT,SOURCE),PARENT);
 assert.deepEqual(changes(PARENT,SOURCE),[...pinned.keys()].sort());
 for(const [path,sha] of pinned){
  assert.equal(git('rev-parse',SOURCE+':'+path),sha,path);
  assert.equal(git('hash-object',path),sha,path);
 }
 assert.deepEqual(changes(SOURCE,'HEAD'),QA);
});

test('Q717-02 Info origin binds exact current DOM ItemID and current filtered source membership',()=>{
 assert.match(page,/type InfoReturn = \{ trigger: HTMLElement; itemId: number; context: string; x: number; y: number \}/);
 assert.match(page,/JSON\.stringify\(\[query,category,selectedWorlds,selectedUniverses,pageLimit\]\)/);
 assert.match(selectBody,/event\.currentTarget/);
 assert.match(selectBody,/trigger instanceof HTMLElement/);
 assert.match(selectBody,/trigger\.dataset\.stage1ItemId!==String\(id\)/);
 assert.match(selectBody,/!scoped\.some\(\(item:any\)=>item\.itemId===id\)/);
 assert.match(selectBody,/infoReturn=\{trigger,itemId:id,context:infoContext\(\),x:window\.scrollX,y:window\.scrollY\}/);
 assert.equal((page.match(/data-stage1-item-id=\{item\.itemId\}/g)||[]).length,2);
});

test('Q717-03 async closing cannot restore stale source, replaced selection, mutated DOM, wrong facet or page context',()=>{
 const a=closeBody;
 for(const exp of [
  /const origin=infoReturn;/, /const selected=infoId;/,
  /infoId=null;/, /infoReturn=null;/, /await tick\(\);/,
  /selected!==origin\.itemId/,/infoId!==null\|\|infoReturn!==null/,
  /origin\.context!==infoContext\(\)/,
  /!origin\.trigger\.isConnected/,
  /origin\.trigger\.dataset\.stage1ItemId!==String\(origin\.itemId\)/,
  /!scoped\.some\(\(item:any\)=>item\.itemId===origin\.itemId\)/
 ])assert.match(a,exp);
 assert.ok(a.indexOf('await tick()')<a.indexOf('origin.context!==infoContext()'));
 assert.ok(a.indexOf('if(!origin')<a.indexOf('origin.trigger.focus'));
 assert.match(a,/origin\.trigger\.focus\(\{preventScroll:true\}\)/);
 assert.match(a,/window\.scrollTo\(origin\.x,origin\.y\)/);
 assert.match(page,/data-stage1-info-close on:click=\{closeInfo\}/);
});

test('Q717-04 query/facet/category transitions revoke Info Return without fake progress or Writer',()=>{
 for(const x of [
  "function chooseCategory(id:string):void{",
  "function backToCategories():void{",
  "function toggleFacet(which:'world'|'universe',id:string):void{",
  "function clearFilters():void{"
 ]){
  const begin=page.indexOf(x), end=page.indexOf('}',begin);
  assert.ok(begin>0);
  assert.match(page.slice(begin,end+1),/infoId=null/);
  assert.match(page.slice(begin,end+1),/infoReturn=null/);
 }
 assert.match(page,/on:input=\{\(\)=>\{infoId=null;infoReturn=null;pageLimit=72;\}\}/);
 assert.equal(STAGE1_COLLECTION_ORDER.length,29);
 assert.equal(STAGE1_COLLECTION_WRITER_ENABLED,false);
 assert.equal(STAGE1_COLLECTION_PERSONAL_PROGRESS_ENABLED,false);
 assert.match(page,/data-personal-progress="unknown" data-writer="off" data-media-rights="unverified"/);
 assert.doesNotMatch(page,/saveEditedCopy|uploadPersonalSave|createPublicWork|sendProviderMedia/);
 assert.match(page,/detailNavigationAvailable = import\.meta\.env\.DEV \|\| PUBLIC_DETAIL_ACCEPTED/);
});

test('Q717-05 locale and responsive keyboard are preserved; no new data authority claim',()=>{
 const locales=['en','fr','it','de','es-ES','ja','zh-CN','pt-BR'];
 for(const l of locales){
  const copy=stage1CollectionCopy(l);
  for(const field of ['close','back','unknown','categories'])assert.ok(copy[field].trim().length>0,l+':'+field);
 }
 assert.match(page,/@media\(max-width:540px\)/);
 assert.match(page,/@media\(max-width:360px\)/);
 assert.match(page,/button:focus-visible,a:focus-visible,input:focus-visible/);
 assert.match(page,/on:click=\{\(event\)=>selectInfo\(item\.itemId,event\)\}/);
});