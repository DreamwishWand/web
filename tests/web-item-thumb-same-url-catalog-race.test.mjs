import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {compile} from 'svelte/compiler';
import {createVerifiedItemThumbFailureGate} from '../src/lib/item-media/item-thumb-verified-image-failure.mjs';
const immutableWebp='/web/ddv/item-images/steam-1.25.3-schema626-lossless160-v1/be/'+'a'.repeat(64)+'.webp';
const first=Object.freeze({signedGeneration:'A'});
const next=Object.freeze({signedGeneration:'B'});
test('old signed catalog SAME-URL error is rejected after new verified catalog arrives',()=>{
 const gate=createVerifiedItemThumbFailureGate();
 assert.equal(gate.visibleHref('VERIFIED',first,immutableWebp,0),immutableWebp);
 // One exact URL across distinct independently revalidated signed catalogs.
 assert.equal(gate.visibleHref('VERIFIED',next,immutableWebp,0),immutableWebp);
 assert.equal(gate.rejectFailed(first,immutableWebp,immutableWebp),false);
 assert.equal(gate.visibleHref('VERIFIED',next,immutableWebp,1),immutableWebp);
 assert.equal(gate.rejectFailed(next,immutableWebp,immutableWebp),true);
 assert.equal(gate.visibleHref('VERIFIED',next,immutableWebp,2),null);
});
test('catalog replacement refreshes a failed same-URL image without a caller-supplied publish grant',()=>{
 const gate=createVerifiedItemThumbFailureGate();
 assert.equal(gate.visibleHref('VERIFIED',first,immutableWebp,0),immutableWebp);
 assert.equal(gate.rejectFailed(first,immutableWebp,immutableWebp),true);
 assert.equal(gate.visibleHref('VERIFIED',first,immutableWebp,1),null);
 assert.equal(gate.visibleHref('VERIFIED',next,immutableWebp,2),immutableWebp);
 assert.equal(gate.visibleHref('NOT_CONFIGURED',null,immutableWebp,3),null);
 assert.equal(gate.rejectFailed(next,immutableWebp,immutableWebp),false);
});
test('actual Svelte captures catalog for each img request and remounts on same-URL revalidation',()=>{
 const src=readFileSync(new URL('../src/lib/ui/ItemThumb.svelte',import.meta.url),'utf8');
 const compiled=compile(src,{filename:'ItemThumb.svelte',generate:'client'});
 assert.ok(compiled.js.code.length>0);
 assert.match(src,/const requestCatalog = \\$switch1253PublicItemImageSource\\.catalog;/);
 assert.match(src,/rejectFailed\\(requestCatalog,failedSrc,renderHref\\)/);
 assert.match(src,/node\\.addEventListener\\('error',onError\\)/);
 assert.match(src,/node\\.removeEventListener\\('error',onError\\)/);
 assert.match(src,/\\{#key \\$switch1253PublicItemImageSource\\.catalog\\}[\\s\\S]*\\{#key renderHref\\}[\\s\\S]*use:bindVerifiedImageFailure/);
 assert.doesNotMatch(src,/on:error=\\{failedImage\\}/);
 // Exact signed URL authority remains upstream of rendering; no policy ON.
 assert.match(src,/scopedSwitch1253ItemImageHref\\(base,itemId,\\$switch1253PublicItemImageSource\\.catalog\\)/);
 assert.match(src,/\\$switch1253PublicItemImageSource\\.status === 'VERIFIED'/);
});
