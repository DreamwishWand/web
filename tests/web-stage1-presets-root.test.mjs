import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PRESETS_STAGE1_ROOT_CONTRACT,PRESETS_STAGE1_ROOT,PRESETS_STAGE1_IN_GAME,
 PRESETS_STAGE1_NATIVE_WRITER_ENABLED,PRESETS_STAGE1_SHOP_PROVIDER_ENABLED,
 PRESETS_STAGE1_TOM_WRITER_ENABLED,presetsStage1Copy} from '../src/lib/presets/stage1-root.mjs';
const source=readFileSync(new URL('../src/routes/presets/+page.svelte',import.meta.url),'utf8');

test('owner exact Stage1 four card root and In-Game two-card second landing',()=>{
 assert.equal(PRESETS_STAGE1_ROOT_CONTRACT,'wand.presets.stage1-root@1');
 assert.deepEqual(PRESETS_STAGE1_ROOT,['wand','touchOfMagic','inGame','my']);
 assert.deepEqual(PRESETS_STAGE1_IN_GAME,['decorations','shop']);
 assert.match(source,/data-stage1-presets-four-cards/);
 assert.match(source,/data-preset-child=\{id\}/);
 assert.match(source,/data-stage1-presets-ingame/);
 assert.match(source,/data-preset-ingame-child=\{id\}/);
 assert.match(source,/surface==='root'/);
 assert.match(source,/surface==='inGame' && !inGameChild/);
 assert.doesNotMatch(source,/class="preset-tabs"/);
});
test('root does not auto-connect, query or invoke an unauthorized Native Writer; old consumers remain unchanged',()=>{
 assert.equal(PRESETS_STAGE1_NATIVE_WRITER_ENABLED,false);
 assert.equal(PRESETS_STAGE1_TOM_WRITER_ENABLED,false);
 assert.equal(PRESETS_STAGE1_SHOP_PROVIDER_ENABLED,false);
 assert.match(source,/data-native-writer="off" data-provider-gate="off" data-tom-writer="off"/);
 assert.doesNotMatch(source,/onMount\(/);
 assert.match(source,/async function ensureCommunity\(\)/);
 assert.match(source,/if\(bridge\)return/);
 assert.match(source,/if\(next==='wand'\)/);
 assert.match(source,/else if\(next==='my'\)/);
 assert.match(source,/NativePresetManager/);
 assert.match(source,/buildPublishEnvelope/);
 assert.match(source,/validatePublishablePreset/);
 assert.match(source,/preflightScene/);
 assert.match(source,/createPresetCommunityBridge/);
 assert.match(source,/on:click=\{backToRoot\}/);
 assert.match(source,/data-preset-unavailable/);
});
test('all eight language labels supported and gated special branches have no fabricated Shop/ToM positive',()=>{
 for(const lang of ['en','fr','it','de','es-ES','ja','zh-CN','pt-BR']){
  const c=presetsStage1Copy(lang);
  for(const key of ['wand','tom','inGame','my','decorations','shop','back','unavailable'])
   assert.ok(typeof c[key]==='string'&&c[key].trim(),lang+':'+key);
 }
 assert.notEqual(presetsStage1Copy('ja').wand,presetsStage1Copy('en').wand);
 assert.match(source,/surface==='touchOfMagic' \|\| \(surface==='inGame' && inGameChild==='shop'\)/);
 assert.doesNotMatch(source,/getShopInventory|publishTouchOfMagic|nativeShopWriter|enablePremiumEntitlement/i);
});
test('four-card root 320,200 keyboard style and child boundaries',()=>{
 assert.match(source,/.preset-stage1-root-grid\{display:grid;grid-template-columns:repeat\(4/);
 assert.match(source,/.preset-ingame-grid\{display:grid;grid-template-columns:repeat\(2/);
 assert.match(source,/@media\(max-width:530px\)/);
 assert.match(source,/.preset-root-card:focus-visible/);
});
