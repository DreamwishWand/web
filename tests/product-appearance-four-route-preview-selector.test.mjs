import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {compile} from 'svelte/compiler';

const sourceUrl=new URL('../src/lib/dev/LocalPlacementEditorDev.svelte',import.meta.url);

test('four exact Eye/Makeup appearance routes preview with no caller-controlled selector',async()=>{
 const src=await readFile(sourceUrl,'utf8');
 assert.ok(src.includes("$: eye=operation==='eyecolor2'||operation==='eyecolor2-switch';"));
 assert.ok(src.includes("$: makeup=operation==='makeup-color1'||operation==='makeup-color1-switch';"));
 const preview=src.split('\n').find(line=>line.includes('const preview=()=>act(w=>w.preview('));
 assert.ok(preview,'expected single product preview callback');
 assert.ok(preview.includes('(wardrobe||appearance||eye||makeup)?undefined:backpack?'),
  'all four fixed appearance operations must omit a caller-supplied preview selector');
 assert.ok(!preview.includes('(wardrobe||appearance||eye)?undefined:'),
  'regression: Makeup preview must not fall through to placement grid selector');
 assert.ok(preview.includes("backpack?{sourceSlot:x,destinationSlot:y}:"),'existing Backpack selector unchanged');
 assert.ok(preview.includes("operation==='comp03'?{seedId:seed}:"),'existing COMP03 selector unchanged');
 assert.ok(preview.includes('mixedRoad?{gridId:grid,retainedId:x,movedId:y}:{gridId:grid,x,y}'),
  'existing spatial selector unchanged');
 assert.ok(compile(src,{filename:'LocalPlacementEditorDev.svelte',generate:'client'}).js.code.length>0);
});
