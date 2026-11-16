import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {compile} from 'svelte/compiler';

const file = new URL('../src/lib/dev/LocalPlacementEditorDev.svelte', import.meta.url);

test('COMP03 product review uses one localized reference diagram, not a second geometry engine', async () => {
 const src = await readFile(file, 'utf8');
 const compiled = compile(src, {filename: file.pathname, generate:'client'});
 assert.ok(compiled.js.code.length > 0);
 assert.equal((src.match(/<Comp03ReferencePattern\b/g)||[]).length,1);
 assert.match(src,/import Comp03ReferencePattern from '\$lib\/wep\/Comp03ReferencePattern\.svelte';/);
 assert.match(src,/\{#if p\}[\s\S]*?data-placement-preview[\s\S]*?\{#if operation==='comp03'\}<p>\{words.seed\}: \{p.seedId\}<\/p><Comp03ReferencePattern locale=\{\$locale\}\/>/);
 assert.doesNotMatch(src, /Array\(9\)|class="shape"|\.shape\s*\{/);
 const gate=src.split('\n').find(l=>l.includes("{#if state.phase==='previewed'}<button"));
 assert.ok(gate);
 assert.match(gate,/\{#if state.phase==='previewed'\}<button disabled=\{pending\|\|!valid\|\|\(wardrobe\?p\?\.slot!==0\|\|p\?\.oldItemId!==50000352\|\|p\?\.newItemId!==50000214:backpack\?p\?\.sourceSlot!==x\|\|p\?\.destinationSlot!==y:operation==='comp03'\?p\?\.seedId!==seed:mixedRoad\?p\?\.gridId!==grid\|\|p\?\.retainedId!==x\|\|p\?\.movedId!==y:p\?\.gridId!==grid\|\|p\?\.x!==x\|\|p\?\.y!==y\)\} on:click=\{\(\)=>act\(w=>w.stage\(\)\)\}/);
 assert.match(src,/mixedRoad=operation==='sr03'\|\|operation==='rm01'/);
 assert.match(src,/data-product-writer="off"/);
 assert.match(src,/\{:else\}<p>X: \{p.x\} · Y: \{p.y\} · \{p.orientation\}<\/p>\{\/if\}/);
});
