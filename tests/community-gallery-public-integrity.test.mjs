import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';

const code=fs.readFileSync(new URL('../supabase/functions/community-public-media/index.ts',import.meta.url),'utf8');

test('public Gallery binary cannot stream an equal-size different-content object',()=>{
  const exactBytes=Buffer.from('original Gallery image payload');
  const replacedBytes=Buffer.from('replaced Gallery image payload');
  assert.equal(exactBytes.byteLength,replacedBytes.byteLength);
  const expected=createHash('sha256').update(exactBytes).digest('hex');
  const actual=createHash('sha256').update(replacedBytes).digest('hex');
  assert.notEqual(actual,expected);

  assert.match(code,/const expectedSha256=String\(gallery\.checksumSha256\?\?'\'\)\.toLowerCase\(\)/);
  assert.match(code,/\^\[0-9a-f\]\{64\}\$/);
  assert.match(code,/new Uint8Array\(await crypto\.subtle\.digest\('SHA-256',verifiedBytes\)\)/);
  assert.match(code,/if \(actualSha256!==expectedSha256\)/);
  assert.match(code,/GALLERY_MEDIA_STORAGE_CHECKSUM_MISMATCH/);
  const download=code.indexOf('.download(String(gallery.storageKey))');
  const checksum=code.indexOf('actualSha256!==expectedSha256');
  const stream=code.indexOf('return new Response(verifiedBytes,');
  assert.ok(download>=0 && checksum>download && stream>checksum);
  assert.ok(code.indexOf('new Response(blob.stream()')===-1);
});

test('public checksum guard is restricted to Gallery Edge proxy and leaves DreamSnaps signer intact',()=>{
  const branch=code.indexOf('if (gallery.galleryManaged === true)');
  const checksum=code.indexOf('expectedSha256');
  const fallback=code.indexOf(".createSignedUrl(String(media.storageKey),300)");
  assert.ok(branch>=0 && checksum>branch && fallback>checksum);
  assert.match(code,/Number\(gallery\.byteSize\)>20971520/);
  assert.match(code,/rawStorageSignedUrlIssued:false/);
  assert.match(code,/if \(gallery\.publiclyAccessible !== true\)/);
});
