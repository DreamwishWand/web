import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {STEAM1253_NATIVE_PINS,STEAM1253_ITEM_IMAGE_VARIANT,
  STEAM1253_REVIEWED_RELEASE} from '../src/lib/item-media/switch1253-public-item-images.mjs';

// Real owner-private Steam626 first1 derivative staged as an inert candidate.
// This test does not grant public publication; 09 INT alone owns signed release.
const itemId='40300045';
const digest='be04cf5698b094a1597bac8ceafa9c43d696c4bf75c8be8db2504ce764b58489';
const path='ddv/item-images/steam-1.25.3-schema626-lossless160-v1/be/'+digest+'.webp';
const uri=new URL('../static/'+path,import.meta.url);
test('first genuine Steam item WebP candidate is byte-for-byte pinned, release remains OFF',()=>{
  const b=readFileSync(uri),p=STEAM1253_NATIVE_PINS[itemId];
  assert.ok(p);
  assert.equal(STEAM1253_ITEM_IMAGE_VARIANT,'steam-1.25.3-schema626-lossless160-v1');
  assert.equal(p.webpSha256,digest);
  assert.equal(p.rgba160Sha256,'e5eda84719c1b4010de8773692042ff7f9af6676f2dfaf34bfc0e694c6766f6c');
  assert.equal(p.width,160);assert.equal(p.height,160);
  assert.equal(p.bytes,15310);assert.equal(b.length,p.bytes);
  assert.equal(p.codec,'WEBP_LOSSLESS_RGBA_EXACT');
  assert.equal(p.visibility,'RELEASED_PLAYER_FACING');
  assert.equal(b.toString('ascii',0,4),'RIFF');
  assert.equal(b.toString('ascii',8,12),'WEBP');
  assert.equal(b.toString('ascii',12,16),'VP8L');
  assert.equal(createHash('sha256').update(b).digest('hex'),digest);
  assert.equal(STEAM1253_REVIEWED_RELEASE.mediaPublic,false);
  assert.deepEqual(Object.keys(STEAM1253_REVIEWED_RELEASE.items),[]);
  assert.equal(existsSync(new URL('../static/ddv/item-images/steam-1.25.3-schema626-lossless160-v1/manifest.json',import.meta.url)),false);
});
