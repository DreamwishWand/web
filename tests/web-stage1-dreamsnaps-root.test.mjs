import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 DREAMSNAPS_STAGE1_ROOT_CONTRACT,DREAMSNAPS_STAGE1_DESTINATIONS,
 DREAMSNAPS_STAGE1_PUBLIC_PROVIDER_ENABLED,DREAMSNAPS_STAGE1_MEDIA_ACCEPTED,
 DREAMSNAPS_STAGE1_WRITER_ENABLED,dreamsnapsStage1Copy
} from '../src/lib/community/dreamsnaps-stage1-root.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const root=read('src/routes/dreamsnaps/+page.svelte');
const community=read('src/routes/dreamsnaps/community/+page.svelte');

test('owner 1-3-1: Community top, Submit Judge Results mid, My bottom, never Gallery child',()=>{
 assert.equal(DREAMSNAPS_STAGE1_ROOT_CONTRACT,'wand.dreamsnaps.stage1-root@1');
 assert.deepEqual(DREAMSNAPS_STAGE1_DESTINATIONS.map(x=>x.id),['community','submit','judge','results','my']);
 assert.deepEqual(DREAMSNAPS_STAGE1_DESTINATIONS.map(x=>x.layout),['wide','peer','peer','peer','wide']);
 assert.deepEqual(DREAMSNAPS_STAGE1_DESTINATIONS.map(x=>x.href),[
 '/dreamsnaps/community/','/dreamsnaps/submit/','/dreamsnaps/judge/','/dreamsnaps/results/','/dreamsnaps/my/']);
 assert.match(root,/data-stage1-dreamsnaps-root="1-3-1"/);
 assert.match(root,/data-stage1-dreamsnaps-peers/);
 assert.match(root,/class="dreamsnaps-destination wide community"/);
 assert.match(root,/class="dreamsnaps-destination wide personal"/);
 assert.doesNotMatch(root,/gallery\/dreamsnaps|gallery\/publish|DreamsnapsTabs/);
});
test('community newly routed destination is deliberately OFF, non-indexable, no media or service RPC',()=>{
 assert.equal(DREAMSNAPS_STAGE1_PUBLIC_PROVIDER_ENABLED,false);
 assert.equal(DREAMSNAPS_STAGE1_MEDIA_ACCEPTED,false);
 assert.equal(DREAMSNAPS_STAGE1_WRITER_ENABLED,false);
 assert.match(community,/name="robots" content="noindex,nofollow"/);
 assert.match(community,/data-community-dreamsnaps="gated"/);
 assert.match(community,/data-public-provider="off" data-writer="off"/);
 assert.match(community,/data-private-results="off"/);
 for(const source of [root,community]){
  assert.doesNotMatch(source,/<img\b|<video\b|fetch\(|callPublicCommunityRpc|getPublicCommunityMedia|\bmediaUrls\b|uploadAndFinalizeImage|\bclient\.command\(|publishWork\(/i);
 }
});
test('eight locale nav has real locally scoped copy, no extra permanent child or invented public work',()=>{
 const locales=['en','fr','it','de','es-ES','ja','zh-CN','pt-BR'];
 for(const code of locales){
  const copy=dreamsnapsStage1Copy(code);
  for(const k of ['community','submit','judge','results','my','unavailable','allWorks','byChallenge','locked','back']){
   assert.ok(typeof copy[k]==='string'&&copy[k].length>0,code+'/'+k);
  }
 }
 assert.equal(dreamsnapsStage1Copy('en').community,'Community DreamSnaps');
 assert.notEqual(dreamsnapsStage1Copy('ja').community,dreamsnapsStage1Copy('en').community);
 assert.match(community,/DREAMSNAPS_STAGE1_PUBLIC_PROVIDER_ENABLED/);
 assert.match(community,/role="status"/);
 assert.doesNotMatch(community,/No published Works yet|No published Works|0 works/);
});
test('visual 320px, 200% and keyboard affordances retain all five links',()=>{
 assert.match(root,/.dreamsnaps-peer-row\{display:grid;grid-template-columns:repeat\(3/);
 assert.match(root,/@media\(max-width:760px\)/);
 assert.match(root,/@media\(max-width:460px\)/);
 assert.match(root,/.dreamsnaps-destination:focus-visible/);
 assert.match(community,/.back:focus-visible/);
});
