import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {sceneRevisionCopy,SCENE_REVISION_COPY_LOCALES} from '../src/lib/wep/scene-revision-copy.js';
import {createPresetCommunityBridge} from '../src/lib/wep/preset-community-bridge.ts';

test('Signed Owner bridge preflight calls only the Source124 read command, rejects unknown session/request',async()=>{
 const calls=[];
 const dto={schemaVersion:1,registryVersion:'gallery-scene-scoped@r15'};
 const community={
   session:{userId:'99999999-9999-4999-8999-999999999999'},
   async command(name,payload){calls.push({name,payload});return {ok:true,data:dto}},
   async preset(){throw new Error('WRITER_OR_PRESET_NOT_ALLOWED')},
   async query(){throw new Error('WRITER_OR_QUERY_NOT_ALLOWED')},
   async searchPublicWorks(){return []}
 };
 const bridge=createPresetCommunityBridge({community,hooks:{
   buildPublishEnvelope:()=>({}),validatePublishablePreset:()=>({}),
   preflightScene:()=>({})
 }});
 const valid='11111111-1111-4111-8111-111111111111';
 const rev='55555555-5555-4555-8555-555555555555';
 assert.equal(bridge.getAuthenticatedSubjectId(),community.session.userId);
 assert.equal(await bridge.inspectGalleryGraphPreflight(valid,[rev]),dto);
 assert.deepEqual(calls,[{name:'preflightGalleryGraph',payload:{workId:valid,presetRevisionIds:[rev]}}]);
 await assert.rejects(bridge.inspectGalleryGraphPreflight(valid,[]),/WEP_R15_PREFLIGHT_REQUEST_INVALID/);
 await assert.rejects(bridge.inspectGalleryGraphPreflight(valid,[rev,rev]),/WEP_R15_PREFLIGHT_REQUEST_INVALID/);
 assert.equal(calls.length,1);
 community.session={userId:valid};
 assert.equal(bridge.getAuthenticatedSubjectId(),valid);
 community.session=null;
 assert.equal(bridge.getAuthenticatedSubjectId(),null);
});
test('R15 UI stays owner-only, clears graph on actor bridge/session change, drops stale async response',()=>{
 const text=readFileSync(new URL('../src/lib/wep/SceneRevisionReadOnlyPanel.svelte',import.meta.url),'utf8');
 assert.match(text,/data-wep-r15-inspect/);
 assert.match(text,/data-wep-r15-owner-graph/);
 assert.match(text,/graphSessionEpoch/);
 assert.match(text,/window\.setInterval\(checkActor, 750\)/);
 assert.match(text,/ownerSessionSubject/);
 assert.match(text,/now !== ownerSessionSubject/);
 assert.match(text,/window\.clearInterval\(timer\)/);
 assert.match(text,/getAuthenticatedSubjectId/);
 assert.match(text,/actorBridge\?\.getAuthenticatedSubjectId\?\.\(\) !== actorSubject/);
 assert.match(text,/bridge !== ownerBridge/);
 assert.match(text,/if \(!connected\)/);
 assert.match(text,/graph = null/);
 assert.match(text,/parseR15ServerGalleryGraph/);
 assert.match(text,/inspectGalleryGraphPreflight/);
 assert.doesNotMatch(text,/on:click=\{.*(?:publishGallery|saveRevision|productApply)/);
 assert.doesNotMatch(text,/graph\.observedAccountId|graph\.observedAuthSubject|graph\.expectedGraph[^S]/);
});
test('8 locales, 320px and keyboard synthetic web acceptance preserve disabled writers',()=>{
 assert.deepEqual([...SCENE_REVISION_COPY_LOCALES].sort(),
  ['en','ja','de','fr','it','es-ES','pt-BR','zh-CN'].sort());
 for(const locale of SCENE_REVISION_COPY_LOCALES){
  const c=sceneRevisionCopy(locale);
  for(const key of ['r15Inspect','r15Loading','r15Title','r15Registry','r15Sha',
      'r15Historical','r15Media','r15Covers','r15ScopeWarning','saveBlocked']){
   assert.equal(typeof c[key],'string',locale+':'+key);
   assert.ok(c[key].length>=2,locale+':'+key);
  }
 }
 const browser=readFileSync(new URL('../scripts/wep-scene-revision-readonly-browser.mjs',import.meta.url),'utf8');
 assert.match(browser,/setViewportSize\(\{width:320/);
 assert.match(browser,/keyboard.press\('Enter'\)/);
 assert.match(browser,/data-wep-scene-save-disabled/);
});
