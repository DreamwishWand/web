import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {STEAM1253_NATIVE_PINS,STEAM1253_ITEM_IMAGE_VARIANT,
  STEAM1253_REVIEWED_RELEASE} from '../src/lib/item-media/switch1253-public-item-images.mjs';

// One grouped, genuine Steam1253 follow-up batch. Not a media ON grant.
// The source SHA/decoded RGBA were independently checked from Owner-private
// first3 originals; no original package or other game data is included.
const items=Object.freeze([
  {id:'40006110',sha:'4f1ed414b3f554a69dbc7b4e682507274c58ad327ace7e22808469aa1e56eff4',
   rgba:'306c52a3fd70c5e12f8349bfc68b5140a890859350342c10659e385d08edd870',bytes:28176},
  {id:'40005160',sha:'461f6484256c69e5a528adc3af7054301841fc324c237d8bc0d4534830345bec',
   rgba:'278d57ff8d42b3e64a9f7abe597e6db7d2938c39b19f39d95526834669d46796',bytes:5796}
]);
test('next two real Steam image WebP bytes are SHA-pinned and player-visible',()=>{
  assert.equal(STEAM1253_ITEM_IMAGE_VARIANT,'steam-1.25.3-schema626-lossless160-v1');
  assert.equal(items.length,2);
  const seenIds=new Set(),seenSha=new Set();
  for(const item of items){
    assert.ok(!seenIds.has(item.id));seenIds.add(item.id);
    assert.ok(!seenSha.has(item.sha));seenSha.add(item.sha);
    const pin=STEAM1253_NATIVE_PINS[item.id];
    assert.ok(pin,'only registered Steam625/626 game-visible native item');
    assert.equal(pin.platform,'Steam Windows');assert.equal(pin.schema,626);
    assert.equal(pin.gameVersion,'1.25.3');
    assert.equal(pin.visibility,'RELEASED_PLAYER_FACING');
    assert.equal(pin.codec,'WEBP_LOSSLESS_RGBA_EXACT');
    assert.equal(pin.webpSha256,item.sha);
    assert.equal(pin.rgba160Sha256,item.rgba);
    assert.equal(pin.bytes,item.bytes);
    assert.equal(pin.width,160);assert.equal(pin.height,160);
    const pathname='../static/ddv/item-images/'+STEAM1253_ITEM_IMAGE_VARIANT+
      '/'+item.sha.slice(0,2)+'/'+item.sha+'.webp';
    const b=readFileSync(new URL(pathname,import.meta.url));
    assert.equal(b.length,item.bytes);
    assert.equal(b.toString('ascii',0,4),'RIFF');
    assert.equal(b.toString('ascii',8,12),'WEBP');
    assert.equal(b.toString('ascii',12,16),'VP8L');
    assert.equal(createHash('sha256').update(b).digest('hex'),item.sha);
  }
  assert.equal(STEAM1253_REVIEWED_RELEASE.mediaPublic,false);
  assert.deepEqual(Object.keys(STEAM1253_REVIEWED_RELEASE.items),[]);
  assert.equal(existsSync(new URL('../static/ddv/item-images/'+
    STEAM1253_ITEM_IMAGE_VARIANT+'/manifest.json',import.meta.url)),false);
});
