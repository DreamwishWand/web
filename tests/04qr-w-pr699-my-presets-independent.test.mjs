// 04 QR-W independent new-only QA of 08 WEB PR699, Source HEAD 27db610d.
// Source-only synthetic; never proves real Steam/ToM/Creator ownership or Writer.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {MY_PRESETS_CONTRACT, MY_DOMAINS, MY_WAND_VIEWS, MY_NATIVE_SOURCE_VERIFIED, MY_AUTO_CLOUD_ENABLED, myPresetsCopy} from '../src/lib/presets/my-presets-router.mjs';
import {PRESETS_STAGE1_ROOT,PRESETS_STAGE1_IN_GAME} from '../src/lib/presets/stage1-root.mjs';

const SOURCE='27db610db84e817f2d31933a316021a89047ac75';
const ANCESTOR='c7af9c88460cd8445bae1eadf614ce24feed1e11';
const sourceBlobs=new Map([
 ['.github/workflows/web-stage1-presets-ux.yml','c6d0f03c10cd6ec95876a03992ee5b8e3283fd1c'],
 ['scripts/web-my-presets-internal-chrome.mjs','b9a1863f75440916e3790150b232583991c14f5d'],
 ['src/lib/presets/my-presets-router.mjs','48acc09122372fb01b3837d29735fca55dbac89d'],
 ['src/routes/presets/+page.svelte','5eb9f5b971421a1ec99d40aa82c2502957f6c8aa'],
 ['tests/web-my-presets-internal-router.test.mjs','20f6fac6995bc79cf5e615872ad858de57176fbe']
]);
const qaPaths=[
 '.github/workflows/04qr-w-pr699-my-presets-independent.yml',
 'scripts/04qr-w-pr699-my-presets-chrome.mjs',
 'tests/04qr-w-pr699-my-presets-independent.test.mjs'
].sort();
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
const changed=(base,head)=>git('diff','--name-only',base,head).split('\n').filter(Boolean).sort();
const route=readFileSync(new URL('../src/routes/presets/+page.svelte',import.meta.url),'utf8');
const manager=readFileSync(new URL('../src/lib/presets/NativePresetManager.svelte',import.meta.url),'utf8');

test('Q699-01 exact immutable five source Git blobs; exactly independent three QA additions, no game/SQL/Media writes',()=>{
 assert.equal(git('rev-parse',SOURCE),SOURCE);
 assert.equal(git('merge-base',ANCESTOR,SOURCE),ANCESTOR);
 assert.deepEqual(changed(ANCESTOR,SOURCE),[...sourceBlobs.keys()].sort());
 for(const [path,blob] of sourceBlobs){
  assert.equal(git('rev-parse',SOURCE+':'+path),blob,path+' fixed Source blob');
  assert.equal(git('hash-object',path),blob,path+' unmodified in QA');
 }
 assert.deepEqual(changed(SOURCE,'HEAD'),qaPaths,'QA-only new files / no modified source paths');
});

test('Q699-02 My root is one entry, not another global product or four duplicated My entries',()=>{
 assert.equal(MY_PRESETS_CONTRACT,'wand.my-presets.internal@1');
 assert.deepEqual(PRESETS_STAGE1_ROOT,['wand','touchOfMagic','inGame','my']);
 assert.deepEqual(PRESETS_STAGE1_IN_GAME,['decorations','shop']);
 assert.deepEqual(MY_DOMAINS,['wand','touchOfMagic','inGame']);
 assert.deepEqual(MY_WAND_VIEWS,['created','saved']);
 assert.equal(new Set(MY_DOMAINS).size,3);
 assert.match(route,/surface==='my'/);
 assert.match(route,/myDomain='wand';myView='created'/);
 assert.match(route,/\{#each MY_DOMAINS as domain\}/);
 assert.match(route,/data-my-domain=\{domain\}/);
});

test('Q699-03 entering My cannot call generic Community library as authoritative created/saved membership',()=>{
 const start=route.indexOf("async function openSurface(");
 const end=route.indexOf("function chooseMyDomain",start);
 assert.ok(start>=0&&end>start);
 const open=route.slice(start,end);
 const my=open.split("}else if(next==='my'){")[1];
 assert.ok(my&&my.includes("tab='library'"),'My branch identified');
 for(const forbidden of ['ensureCommunity','refreshLibrary','listLibrary','saveDiscoveredWork','inspectLibrary','fetch(','localStorage','sessionStorage']){
  assert.equal(my.includes(forbidden),false,'My branch no '+forbidden);
 }
 assert.match(route,/data-my-community-list="off"/);
 assert.match(route,/data-personal-owned="unknown"/);
 assert.match(route,/data-my-wand-view=\{myView\}/);
 assert.match(route,/myCopy\.createdUnknown:myCopy\.savedUnknown/);
 assert.doesNotMatch(route,/data-my-verified="true"|data-personal-owned="verified"|data-my-community-list="on"/);
});

test('Q699-04 no ToM imported receiver DesignID=>original Creator ownership; CurrentSave/Creator positive denied',()=>{
 for(const marker of ['data-my-tom-verified="false"','data-my-import="off"',
  'data-my-save-verified="false"','data-my-current-save="unknown"',
  'data-my-pc-backup="manual"','data-my-creator="unverified"']){
  assert.ok(route.includes(marker),marker);
 }
 assert.equal(MY_NATIVE_SOURCE_VERIFIED,false);
 assert.equal(MY_AUTO_CLOUD_ENABLED,false);
 for(const forbidden of ['data-my-import="on"','data-my-creator="verified"','data-my-save-verified="true"','data-auto-cloud="on"']){
  assert.equal(route.includes(forbidden),false,forbidden);
 }
 assert.match(route,/data-native-writer="off" data-provider-gate="off" data-tom-writer="off"/);
});

test('Q699-05 PC native reader is only mounted after explicit manual click, domain changes never reset selected local inspector',()=>{
 const button=route.indexOf('data-my-open-pc');
 const conditional=route.indexOf('{#if myPcOpened}');
 const component=route.indexOf('<NativePresetManager />',conditional);
 assert.ok(button>=0&&conditional>button&&component>conditional);
 assert.match(route,/on:click=\{openMyPcLocal\}/);
 assert.match(route,/let myPcOpened=false/);
 assert.match(route,/function openMyPcLocal\(\):void\{myPcOpened=true/);
 const choose=route.slice(route.indexOf('function chooseMyDomain'),route.indexOf('function chooseInGame'));
 assert.doesNotMatch(choose,/myPcOpened\s*=\s*false/);
 assert.match(route,/hidden=\{myDomain!=='inGame'\}/);
 assert.match(route,/data-my-native-writer="off" data-auto-cloud="off"/);
 assert.match(manager,/on:change=\{openSave\}/);
 assert.match(manager,/openNativePresetProfile/);
});

test('Q699-06 all eight localized unknown messages distinguish Created and Saved; no speculative positive',()=>{
 const locales=['en','fr','it','de','es-ES','ja','zh-CN','pt-BR'];
 const keys=['navigation','wandViews','created','saved','createdUnknown','savedUnknown','wandBoundary',
  'tomUnknown','tomBoundary','currentSave','currentUnknown','pcBackup','pcManual','openPc',
  'creatorPublished','creatorUnknown','inGameBoundary'];
 for(const locale of locales){
  const copy=myPresetsCopy(locale);
  assert.equal(new Set(keys.map(k=>copy[k])).size,keys.length,locale+' distinct copy fields');
  for(const key of keys){
   assert.equal(typeof copy[key],'string',locale+'/'+key);
   assert.ok(copy[key].trim().length>2,locale+'/'+key);
  }
  assert.notEqual(copy.createdUnknown,copy.savedUnknown);
  assert.notEqual(copy.currentUnknown,copy.creatorUnknown);
 }
 assert.equal(Object.isFrozen(MY_DOMAINS),true);
 assert.equal(Object.isFrozen(MY_WAND_VIEWS),true);
});

test('Q699-07 keyboard, 320/200 constrained, manual/no auto-provider boundaries source-only',()=>{
 for(const marker of ['aria-pressed={myDomain===domain}','aria-pressed={myView===view}',
    '.my-domains button:focus-visible','.my-views button:focus-visible',
    '@media(max-width:760px)','.my-panel[hidden],section[data-my-pc-local][hidden]']){
  assert.ok(route.includes(marker),marker);
 }
 assert.doesNotMatch(route,/function (openMyPcLocal|chooseMyDomain|chooseMyView)[^{]*\{[^}]*\b(fetch|post|upload|autoBackup|syncToCloud|ensureCommunity)\b/i);
 assert.ok(route.includes('myCopy.pcManual'));
 assert.ok(route.includes('data-my-native-writer="off"'));
});