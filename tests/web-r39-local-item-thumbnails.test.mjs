import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  R39_MANIFEST_SHA256, R39_VERSION, LOCAL_IMAGE_MAP_SCHEMA, IMAGE_PREFERENCES,
  validateR39Manifest, validateLocalImageMap, validateLocalImagePreferences
} from '../src/lib/ui/local-r39-item-image.mjs';

const shardId = i => i.toString(16).padStart(2,'0');
function syntheticManifest(){
  const total=85464564,per=Math.floor(total/32),remainder=total-per*32;
  const count=Math.floor(12082/32),extra=12082-count*32;
  return {schemaVersion:1,artifact:'DDV_GAME_THUMBNAIL_DERIVATIVE_MANIFEST',
    databaseGeneration:'v3.5',wandGeneration:'R39',platform:'Switch',gameVersion:'1.24.13',
    policy:{identity:'source PNG SHA-256 -> derivative path',format:'WebP'},
    coverage:{uniqueThumbnails:12082,shards:32,totalShardBytes:total},
    shards:Array.from({length:32},(_,i)=>({
      shard:shardId(i),file:`DDV_GAME_THUMBNAILS_WEBP_v1.24.13_shard_${shardId(i)}.zip`,
      sha256:'a'.repeat(64),bytes:per+(i<remainder?1:0),
      uniqueThumbnails:count+(i<extra?1:0)
    }))
  };
}

test('R39 sample manifest structure accepts only pinned source/v1.24.13 32-shard WebP and SHA',()=>{
  const doc=syntheticManifest();
  assert.equal(validateR39Manifest(doc),doc);
  assert.match(R39_MANIFEST_SHA256,/^[a-f0-9]{64}$/);
  assert.equal(R39_VERSION,'1.24.13');
  assert.throws(()=>validateR39Manifest({...doc,gameVersion:'1.25.3'}),/Unsupported/);
  assert.throws(()=>validateR39Manifest({...doc,platform:'Windows'}),/Unsupported/);
  assert.throws(()=>validateR39Manifest({...doc,coverage:{...doc.coverage,uniqueThumbnails:12081}}),/Unsupported/);
  assert.throws(()=>validateR39Manifest({...doc,shards:doc.shards.slice(1)}),/Unsupported/);
  assert.throws(()=>validateR39Manifest({...doc,shards:doc.shards.map((s,i)=>i===1?{...s,shard:'00'}:s)}),/Invalid/);
  assert.throws(()=>validateR39Manifest({...doc,shards:doc.shards.map((s,i)=>i===1?{...s,sha256:'wrong'}:s)}),/Invalid/);
});

test('ItemID to SHA mapping fail closed on wrong schema, version, identity or fabricated string keys',()=>{
  const ok={schema:LOCAL_IMAGE_MAP_SCHEMA,platform:'Switch',gameVersion:'1.24.13',
    manifestSha256:R39_MANIFEST_SHA256,items:{'1243':'b'.repeat(64),'0':'0'.repeat(64)}};
  assert.equal(validateLocalImageMap(ok),ok);
  for(const bad of [
    {...ok,gameVersion:'1.25.3'}, {...ok,platform:'Windows'}, {...ok,manifestSha256:'a'.repeat(64)},
    {...ok,schema:'wand.thumbnail-map-v2'}, {...ok,items:[]}, {...ok,items:{}},
    {...ok,items:{'001243':'b'.repeat(64)}}, {...ok,items:{'abc':'b'.repeat(64)}},
    {...ok,items:{'1243':'B'.repeat(64)}}
  ])assert.throws(()=>validateLocalImageMap(bad),/Unsupported|Invalid|Unverified/);
});

test('Image UI preference controls are validated and do not enable Writer or external gallery art',()=>{
  assert.deepEqual(validateLocalImagePreferences(IMAGE_PREFERENCES),IMAGE_PREFERENCES);
  for(const value of [{fit:'stretch',size:56,density:'compact'},{fit:'cover',size:999,density:'compact'},
    {fit:'cover',size:64,density:'remote'},{fit:'contain',size:0,density:'comfortable'}])
    assert.throws(()=>validateLocalImagePreferences(value),/Invalid/);
});

test('Collection, Explore and shared thumb consume same browser-local asset cache; no public R39 artwork',()=>{
  const paths=['../src/routes/collection/+page.svelte','../src/routes/explore/+page.svelte'];
  const sources=paths.map(p=>readFileSync(new URL(p,import.meta.url),'utf8'));
  const thumb=readFileSync(new URL('../src/lib/ui/LocalItemThumb.svelte',import.meta.url),'utf8');
  const panel=readFileSync(new URL('../src/lib/ui/LocalR39PreviewControls.svelte',import.meta.url),'utf8');
  const cache=readFileSync(new URL('../src/lib/ui/local-r39-item-image.mjs',import.meta.url),'utf8');
  for(const s of sources){
    assert.match(s,/LocalItemThumb/); assert.match(s,/LocalR39PreviewControls/);
    assert.match(s,/itemId=\{item.itemId\}/);
  }
  assert.match(panel,/on:change=\{manifestChanged\}/);
  assert.match(panel,/on:change=\{mappingChanged\}/);
  assert.match(panel,/on:change=\{shardsChanged\}/);
  assert.match(panel,/clearLocalImagePreview/);
  assert.match(thumb,/data-source-version="1.24.13"/);
  assert.match(thumb,/URL.revokeObjectURL/);
  assert.match(cache,/crypto.subtle.digest\('SHA-256'/);
  assert.match(cache,/indexedDB.open/);
  assert.match(cache,/file.arrayBuffer\(\)/);
  assert.match(cache,/Unsafe ZIP path/);
  assert.doesNotMatch(cache,/fetch\(|XMLHttpRequest|navigator.sendBeacon|localStorage/);
  assert.doesNotMatch(panel,/fetch\(|XMLHttpRequest|navigator.sendBeacon/);
  assert.doesNotMatch(sources.join('\n'),/DDV_GAME_THUMBNAILS_WEBP.*\.zip/);
});
