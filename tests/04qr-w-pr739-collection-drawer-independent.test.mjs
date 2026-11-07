// 04 QR-W independent NEW_ONLY QA, 08 WEB PR739 / COL-UX-44.
// This is source-only Collection UI with a synthetic indexed catalog, never Native owned progress/Writer.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {
 STAGE1_COLLECTION_ORDER,STAGE1_COLLECTION_WRITER_ENABLED,
 STAGE1_COLLECTION_PERSONAL_PROGRESS_ENABLED,stage1CollectionCopy,stage1ScopeRecords
} from '../src/lib/collection/stage1-root.mjs';

const BASE='857409292a233b89ce8f3ffa42c604175c7fa748';
const SOURCE='92c449271998828bf3694f27a4aa55bc3056ea47';
const pinned=new Map([
 ['.github/workflows/web-stage1-collection-ux.yml','eed324002f81e04cec515e5c40280617bbe75852'],
 ['scripts/web-stage1-collection-chrome.mjs','cbd0b0d6ae87db4a002cd5a914e6e2ebb72a95bd'],
 ['src/routes/collection/+page.svelte','4065680d3ed49005165b463cad1faa705dd2d1de'],
 ['tests/web-stage1-collection-root.test.mjs','bfffb47569455d2a4cac3aeeee62d10b8a62fa45']
]);
const qa=[
 '.github/workflows/04qr-w-pr739-collection-drawer-independent.yml',
 'scripts/04qr-w-pr739-collection-drawer-chrome.mjs',
 'tests/04qr-w-pr739-collection-drawer-independent.test.mjs'
].sort();
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
const diff=(a,b)=>git('diff','--name-only',a,b).split('\n').filter(Boolean).sort();
const page=readFileSync(new URL('../src/routes/collection/+page.svelte',import.meta.url),'utf8');
const before=git('show',BASE+':src/routes/collection/+page.svelte');

test('Q739-01 exact four Source Git blobs pinned and only three QA additions, no product modifications',()=>{
 assert.equal(git('rev-parse',SOURCE),SOURCE);
 assert.equal(git('merge-base',BASE,SOURCE),BASE);
 assert.deepEqual(diff(BASE,SOURCE),[...pinned.keys()].sort());
 for(const [p,sha] of pinned){
  assert.equal(git('rev-parse',SOURCE+':'+p),sha,'Source Blob '+p);
  assert.equal(git('hash-object',p),sha,'unmodified source '+p);
 }
 assert.equal(git('merge-base',SOURCE,'HEAD'),SOURCE);
 assert.deepEqual(diff(SOURCE,'HEAD'),qa);
});

test('Q739-02 new mobile modality is gated to <=820px; mounted sheet labels and focus lifecycle',()=>{
 assert.match(page,/window\.matchMedia\('\(max-width: 820px\)'\)/);
 for(const exp of [
  /role=\{mobileFilter \? 'dialog' : undefined\}/,
  /aria-modal=\{mobileFilter \? 'true' : undefined\}/,
  /aria-haspopup=\{mobileFilter \? 'dialog' : undefined\}/,
  /aria-label=\{mobileFilter \? ui\.filter : undefined\}/,
  /data-stage1-filter-close/,
  /data-stage1-filter-backdrop/,
  /on:keydown=\{onFilterKeydown\}/,
  /event\.key==='Escape'/,
  /event\.key!=='Tab'/,
  /event\.shiftKey&&document\.activeElement===first/,
  /!event\.shiftKey&&document\.activeElement===last/,
  /await tick\(\)/,
  /filterCloseButton\?\.focus\(\)/,
  /filterToggleButton\?\.focus\(\{preventScroll:true\}\)/
 ])assert.match(page,exp);
 assert.match(page,/@media\(max-width:820px\)/);
 assert.match(page,/overscroll-behavior:contain/);
 assert.match(page,/\.filter-shell\{display:contents\}/);
 assert.match(page,/\.filter-backdrop,\.filter-sheet-heading\{display:none\}/);
 assert.doesNotMatch(before,/data-stage1-filter-close/,'new sheet not preaccepted source');
});

test('Q739-03 cleanup on Escape/backdrop/click/breakpoint/unmount and visible zoom cap',()=>{
 for(const exp of [
  /previousBodyOverflow=document\.body\.style\.overflow/,
  /document\.body\.style\.overflow='hidden'/,
  /document\.body\.style\.overflow=previousBodyOverflow/,
  /if\(!filterOpen\)return;/,
  /const onMediaChange=\(event:MediaQueryListEvent\)=>/,
  /if\(!mobileFilter\)unlockFilterScroll\(\)/,
  /else if\(!wasMobile\)/,
  /media\.removeEventListener\('change',onMediaChange\)/,
  /unlockFilterScroll\(\);\s*\n\s*\};/,
  /on:resize=\{\(\)=>\{if\(filterOpen&&mobileFilter\)updateSheetMaxHeight\(\);\}\}/,
  /Math\.floor\(window\.innerHeight\*0\.85\/rootZoom\)/,
  /style:max-height=\{mobileFilter \? sheetMaxHeight : undefined\}/,
  /on:click=\{closeFilters\}/
 ])assert.match(page,exp);
});

test('Q739-04 actual facet OR within group AND across group, search and clear remain source-defined',()=>{
 const rows=[
  {itemId:1,family:'Furniture',worlds:['Valley'],universes:['Disney'],label:'A',searchText:'a',stateClass:'TRACKED'},
  {itemId:2,family:'Furniture',worlds:['Isle'],universes:['Disney'],label:'B',searchText:'b',stateClass:'TRACKED'},
  {itemId:3,family:'Furniture',worlds:['Valley'],universes:['Mickey'],label:'C',searchText:'c',stateClass:'TRACKED'},
  {itemId:4,family:'Fish',worlds:['Isle'],universes:['Mickey'],label:'D',searchText:'d',stateClass:'TRACKED'}
 ];
 assert.deepEqual(stage1ScopeRecords(rows,{worlds:['Valley','Isle'],universes:['Disney']}).map(x=>x.itemId),[1,2]);
 assert.deepEqual(stage1ScopeRecords(rows,{worlds:['Valley'],universes:['Mickey']}).map(x=>x.itemId),[3]);
 assert.deepEqual(stage1ScopeRecords(rows,{category:'Furniture',query:'b'}).map(x=>x.itemId),[2]);
 assert.match(page,/selectedWorlds=selectedWorlds\.includes\(id\)\?selectedWorlds\.filter/);
 assert.match(page,/selectedUniverses=selectedUniverses\.includes\(id\)\?selectedUniverses\.filter/);
 assert.match(page,/function clearFilters\(\):void\{selectedWorlds=\[\];selectedUniverses=\[\]/);
 assert.match(page,/aria-pressed=\{selectedWorlds\.includes\(id\)\}/);
 assert.match(page,/aria-pressed=\{selectedUniverses\.includes\(id\)\}/);
 assert.match(page,/data-stage1-search/);
 assert.match(page,/\.active-filters/);
});

test('Q739-05 eight locales and no invented personal ownership/Native or public Writer',()=>{
 assert.equal(STAGE1_COLLECTION_ORDER.length,29);
 assert.equal(STAGE1_COLLECTION_WRITER_ENABLED,false);
 assert.equal(STAGE1_COLLECTION_PERSONAL_PROGRESS_ENABLED,false);
 for(const lang of ['en','fr','it','de','es-ES','ja','zh-CN','pt-BR']){
  const copy=stage1CollectionCopy(lang);
  for(const k of ['filter','close','world','universe','owned','missing','clear'])assert.ok(copy[k]?.trim().length>0,lang+':'+k);
 }
 assert.match(page,/data-personal-progress="unknown" data-writer="off" data-media-rights="unverified"/);
 assert.match(page,/disabled title=\{ui\.unknown\}/);
 for(const forbidden of [/saveEditedCopy/,/createPublicWork/,/uploadPersonalSave/,/fetch\([^)]*POST/])assert.doesNotMatch(page,forbidden);
});