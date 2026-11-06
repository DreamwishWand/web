import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {MY_PRESETS_CONTRACT,MY_DOMAINS,MY_WAND_VIEWS,MY_NATIVE_SOURCE_VERIFIED,
 MY_AUTO_CLOUD_ENABLED,myPresetsCopy} from '../src/lib/presets/my-presets-router.mjs';
import {PRESETS_STAGE1_ROOT,PRESETS_STAGE1_IN_GAME} from '../src/lib/presets/stage1-root.mjs';
const route=readFileSync(new URL('../src/routes/presets/+page.svelte',import.meta.url),'utf8');
test('one My entry, three internal domains, Wand default, no root changes',()=>{
 assert.equal(MY_PRESETS_CONTRACT,'wand.my-presets.internal@1');
 assert.deepEqual(PRESETS_STAGE1_ROOT,['wand','touchOfMagic','inGame','my']);
 assert.deepEqual(PRESETS_STAGE1_IN_GAME,['decorations','shop']);
 assert.deepEqual(MY_DOMAINS,['wand','touchOfMagic','inGame']);
 assert.deepEqual(MY_WAND_VIEWS,['created','saved']);
 assert.equal(MY_NATIVE_SOURCE_VERIFIED,false);
 assert.equal(MY_AUTO_CLOUD_ENABLED,false);
 assert.match(route,/data-stage1-presets-four-cards/);
 assert.match(route,/data-my-domains/);
 assert.match(route,/myDomain='wand';myView='created';/);
 assert.doesNotMatch(route,/class="preset-tabs"/);
});
test('My never joins Community SavedItem records or invents Wand/ToM/Native ownership',()=>{
 const handler=route.split("}else if(next==='my'){")[1]?.split('  function chooseMyDomain')[0];
 assert.ok(handler);
 assert.doesNotMatch(handler,/ensureCommunity|refreshLibrary|listLibrary|fetch\(|localStorage/);
 for(const key of ['data-my-community-list="off"','data-my-verified="false"',
  'data-my-tom-verified="false"','data-my-save-verified="false"',
  'data-my-current-save="unknown"','data-my-creator="unverified"',
  'data-personal-owned="unknown"','data-my-import="off"','data-auto-cloud="off"'])
  assert.ok(route.includes(key),key);
 assert.doesNotMatch(route,/data-my-creator="verified"|data-auto-cloud="on"|data-my-native-writer="on"/);
 assert.match(route,/data-native-writer="off" data-provider-gate="off" data-tom-writer="off"/);
});
test('PC local file selection only by user, inspector retained on My domain changes',()=>{
 assert.match(route,/myPcOpened=false/);
 assert.match(route,/function openMyPcLocal\(\):void\{myPcOpened=true/);
 assert.match(route,/on:click=\{openMyPcLocal\}/);
 assert.match(route,/\{#if myPcOpened\}[\s\S]*hidden=\{myDomain!=='inGame'\}/);
 assert.match(route,/data-my-pc-local/);
 assert.match(route,/data-my-native-writer="off"/);
 assert.doesNotMatch(route,/function chooseMyDomain[^}]*myPcOpened=false/);
 assert.doesNotMatch(route,/indexedDB|autoBackup|uploadToCloud|syncOnLoad/);
});
test('eight independent locales, keyboard/zoom styles, Source/Writer fail-closed',()=>{
 for(const l of ['en','fr','it','de','es-ES','ja','zh-CN','pt-BR']){
  const t=myPresetsCopy(l);
  for(const k of ['navigation','wandViews','created','saved','createdUnknown','savedUnknown','wandBoundary',
   'tomUnknown','tomBoundary','currentSave','currentUnknown','pcBackup','pcManual','openPc',
   'creatorPublished','creatorUnknown','inGameBoundary']){
    assert.equal(typeof t[k],'string',l+'/'+k);
    assert.ok(t[k].trim().length>=3,l+'/'+k);
  }
  assert.notEqual(t.created,t.saved);
 }
 assert.match(route,/aria-pressed=\{myDomain===domain\}/);
 assert.match(route,/aria-pressed=\{myView===view\}/);
 assert.match(route,/\.my-domains button:focus-visible/);
 assert.match(route,/@media\(max-width:760px\)/);
 assert.match(route,/surface==='touchOfMagic' \|\| \(surface==='inGame' && inGameChild==='shop'\)/);
});
