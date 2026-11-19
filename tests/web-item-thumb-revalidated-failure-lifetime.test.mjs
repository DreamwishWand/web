import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {compile} from 'svelte/compiler';
import {createVerifiedItemThumbFailureGate} from '../src/lib/item-media/item-thumb-verified-image-failure.mjs';
import {STEAM1253_REVIEWED_RELEASE,SWITCH1253_REVIEWED_RELEASE} from '../src/lib/item-media/switch1253-public-item-images.mjs';
const old=Object.freeze({count:1}),revalidated=Object.freeze({count:1}),withdrawn=Object.freeze({count:0});
const door='/web/ddv/item-images/steam-1.25.3-schema626-lossless160-v1/be/'+'a'.repeat(64)+'.webp';
const replacement='/web/ddv/item-images/steam-1.25.3-schema626-lossless160-v1/4f/'+'b'.repeat(64)+'.webp';
test('initial verified catalog is the only source of a visible relative image; runtime is still media OFF',()=>{
 const gate=createVerifiedItemThumbFailureGate();
 assert.equal(STEAM1253_REVIEWED_RELEASE.mediaPublic,false);
 assert.equal(SWITCH1253_REVIEWED_RELEASE.mediaPublic,false);
 assert.equal(gate.visibleHref('NOT_CONFIGURED',old,door,0),null);
 assert.equal(gate.visibleHref('VERIFIED',old,door,0),door);
 assert.equal(gate.visibleHref('VERIFIED',old,'https://foreign.invalid/image.webp',0),null);
 assert.equal(gate.visibleHref('VERIFIED',old,null,0),null);
});
test('a failed URL stays hidden within one verified catalog, but can retry after verified catalog replacement',()=>{
 const gate=createVerifiedItemThumbFailureGate();
 assert.equal(gate.visibleHref('VERIFIED',old,door,0),door);
 assert.equal(gate.rejectFailed(old,door,door),true);
 assert.equal(gate.visibleHref('VERIFIED',old,door,1),null);
 assert.equal(gate.visibleHref('VERIFIED',old,door,2),null);
 assert.equal(gate.visibleHref('VERIFIED',revalidated,door,2),door);
 assert.equal(gate.rejectFailed(revalidated,door,door),true);
 assert.equal(gate.visibleHref('VERIFIED',revalidated,door,3),null);
});
test('old image error cannot poison a newer manifest or different URL',()=>{
 const gate=createVerifiedItemThumbFailureGate();
 assert.equal(gate.visibleHref('VERIFIED',old,door,0),door);
 assert.equal(gate.visibleHref('VERIFIED',revalidated,replacement,0),replacement);
 assert.equal(gate.rejectFailed(old,door,replacement),false);
 assert.equal(gate.rejectFailed(revalidated,door,replacement),false);
 assert.equal(gate.rejectFailed(revalidated,'https://foreign.invalid/p.webp',replacement),false);
 assert.equal(gate.visibleHref('VERIFIED',revalidated,replacement,1),replacement);
 assert.equal(gate.rejectFailed(revalidated,replacement,replacement),true);
 assert.equal(gate.visibleHref('VERIFIED',revalidated,replacement,2),null);
});
test('manifest refresh pending, withdrawal and unknown image all fail closed and never reuse stale href',()=>{
 const gate=createVerifiedItemThumbFailureGate();
 assert.equal(gate.visibleHref('VERIFIED',old,door,0),door);
 assert.equal(gate.visibleHref('NOT_CONFIGURED',null,door,0),null);
 assert.equal(gate.rejectFailed(old,door,door),false);
 assert.equal(gate.visibleHref('VERIFIED',withdrawn,null,0),null);
 assert.equal(gate.visibleHref('VERIFIED',withdrawn,door,0),door,
   'helper is display-only: only upstream sealed resolver may supply an actual URL');
 assert.equal(gate.visibleHref('NOT_CONFIGURED',null,door,0),null);
 assert.equal(gate.visibleHref('VERIFIED',revalidated,replacement,0),replacement);
});
test('actual Svelte ItemThumb compiles, keys image by URL and binds onerror to actual old node src',()=>{
 const src=readFileSync(new URL('../src/lib/ui/ItemThumb.svelte',import.meta.url),'utf8');
 const result=compile(src,{filename:'ItemThumb.svelte',generate:'client'});
 assert.ok(result.js.code.length>0);
 assert.match(src,/createVerifiedItemThumbFailureGate/);
 assert.match(src,/\{#key renderHref\}/);
 assert.match(src,/getAttribute\('src'\)/);
 assert.match(src,/rejectFailed\(\$switch1253PublicItemImageSource\.catalog,failedSrc,renderHref\)/);
 assert.match(src,/onMount\(\(\) => retainSwitch1253PublicItemImageSource\(base\)\)/);
 assert.match(src,/\$switch1253PublicItemImageSource\.status === 'VERIFIED'/);
});
