import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';

const producer = readFileSync(fileURLToPath(new URL('../scripts/01d-r39-lossless-webp160.py',import.meta.url)),'utf8');
const consumer = readFileSync(fileURLToPath(new URL('../src/lib/item-media/public-item-images.mjs',import.meta.url)),'utf8');
const digest=x=>createHash('sha256').update(x).digest('hex');
const assetPath=(sourcePngBytes,encodedBytes)=>{
  const source=digest(sourcePngBytes);
  const encoded=digest(encodedBytes);
  const shard=(Number.parseInt(source.slice(0,2),16)>>3).toString(16).padStart(2,'0');
  return `ddv/item-images/webp-lossless-160-v1/v1.24.13/${shard}/${source}-${encoded}.webp`;
};

test('01D dual-hash path contract pins actual WebP digest, not only PNG origin SHA',()=>{
  assert.match(producer,/encoded_sha\s*=\s*sha\(encoded\)/);
  assert.match(producer,/source_sha \+ "-" \+ encoded_sha \+ "\.webp"/);
  assert.match(producer,/"losslessWebpSha256":encoded_sha/);
  assert.match(producer,/consumerPathAbi":"sourcePngSha256-encodedWebpSha256\.webp"/);
  assert.match(producer,/rgbaPixelExact":True/);
  assert.match(producer,/deployAllowed":False/);
});

test('01D generated derivative URI exactly follows 08WEB same SHA/shard/variant ABI',()=>{
  assert.match(consumer,/ITEM_IMAGE_VARIANT\s*=\s*'webp-lossless-160-v1'/);
  assert.match(consumer,/\$\{sha\}-\$\{item\.webpSha256\}\.webp/);
  assert.match(consumer,/webpSha256:entry\.webpSha256/);
  const source=Buffer.from('genuine source png fixture bytes (synthetic)');
  const first=assetPath(source,Buffer.from('synthetic-encoded-a'));
  const second=assetPath(source,Buffer.from('synthetic-encoded-b'));
  assert.notEqual(first,second,'same original re-encoding MUST yield a distinct immutable URI');
  assert.match(first,/\/v1\.24\.13\/[0-9a-f]{2}\/[0-9a-f]{64}-[0-9a-f]{64}\.webp$/);
  assert.equal(first.split('/').slice(0,-1).join('/'),second.split('/').slice(0,-1).join('/'));
  assert.equal(first.split('/').at(-1).split('-')[0],second.split('/').at(-1).split('-')[0]);
});

test('01D preserves original manifest and source-only release denial; does not emit deploy marker',()=>{
  assert.match(producer,/MANIFEST_SHA\s*=\s*"f0ea2248bc7a91d9a8afb655bf142150798aa96fbde1fd91ae028927b4ef3aba"/);
  assert.match(producer,/lossless=True, method=4, exact=True/);
  assert.match(producer,/require_complete/);
  assert.match(producer,/HOLD_NOT_DEPLOY/);
  assert.match(producer,/target1250VerifiedRows":0/);
  assert.match(producer,/target1253VerifiedRows":0/);
  assert.doesNotMatch(producer,/VERSION_VERIFIED.*True/);
});

test('01D Python source still parses without depending on native artwork',t=>{
  const py=spawnSync('python3',['-c',
    'import ast,sys;ast.parse(open(sys.argv[1],encoding="utf8").read())',
    fileURLToPath(new URL('../scripts/01d-r39-lossless-webp160.py',import.meta.url))],{encoding:'utf8'});
  if(py.error?.code==='ENOENT'){t.skip('python3 unavailable; original image processing NOT_RUN');return;}
  assert.equal(py.status,0,py.stderr);
});
