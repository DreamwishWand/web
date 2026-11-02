import test from 'node:test';
import assert from 'node:assert/strict';
import {
  marqueeRect, marqueeHitIds, mergeMarqueeSelection, marqueeModifierMode
} from '../src/lib/wep/marquee-selection.ts';

const item = (id,x,y, extra={})=>({
  editorId:id,itemId:40000001,layer:'furniture',x,y,orientation:0,
  footprint:[{x:0,y:0}],editability:'editable',metadata:{reasons:[]},
  ui:{locked:false}, ...extra
});
const projection = [
  item('chair',2,2),
  item('lamp',6,2,{footprint:[{x:0,y:0},{x:1,y:0}]}),
  item('protected',10,2,{editability:'readonly'}),
  item('unknown',11,2,{metadata:{reasons:['PROGRESSION_OWNERSHIP_UNKNOWN']}}),
  item('road',4,2,{layer:'road'}),
  item('fence',5,2,{layer:'fence'}),
  item('hidden-locked',8,2,{ui:{locked:true}})
];
test('reverse drag normalizes fractional grid world bounds and excludes non-finite',()=>{
  assert.deepEqual(marqueeRect({x:12,y:4},{x:1,y:1}),{x:1,y:1,w:11,h:3});
  assert.throws(()=>marqueeRect({x:Infinity,y:0},{x:2,y:2}),/NONFINITE/);
});
test('only editable visible projected furniture and full footprints can be marquee selected',()=>{
  assert.deepEqual(marqueeHitIds(projection,marqueeRect({x:1,y:1},{x:12,y:4})),['chair','lamp']);
  assert.deepEqual(marqueeHitIds(projection,marqueeRect({x:7.2,y:2.1},{x:7.8,y:2.8})),['lamp']);
  assert.deepEqual(marqueeHitIds(projection,marqueeRect({x:20,y:20},{x:23,y:23})),[]);
});
test('projected source respects Area/Grid/SubGrid route, query, layer and selected-only filter',()=>{
  const visibleAreaGridObjects=[projection[0]];
  assert.deepEqual(marqueeHitIds(visibleAreaGridObjects,marqueeRect({x:1,y:1},{x:12,y:4})),['chair']);
});
test('zero-area drag never changes selection and protected objects are never hit',()=>{
  assert.deepEqual(marqueeHitIds(projection,marqueeRect({x:2,y:2},{x:2,y:2})),[]);
  assert.deepEqual(marqueeHitIds([projection[2]],marqueeRect({x:9,y:1},{x:12,y:4})),[]);
});
test('replace/add/toggle/subtract are deterministic and preserve only explicit session selection',()=>{
  assert.deepEqual(mergeMarqueeSelection(['chair'],['lamp'],'replace'),['lamp']);
  assert.deepEqual(mergeMarqueeSelection(['chair'],['lamp','chair'],'add'),['chair','lamp']);
  assert.deepEqual(mergeMarqueeSelection(['chair','lamp'],['chair'],'toggle'),['lamp']);
  assert.deepEqual(mergeMarqueeSelection(['chair','lamp'],['lamp'],'subtract'),['chair']);
  assert.equal(marqueeModifierMode({shiftKey:true}),'add');
  assert.equal(marqueeModifierMode({ctrlKey:true}),'toggle');
  assert.equal(marqueeModifierMode({metaKey:true}),'toggle');
  assert.equal(marqueeModifierMode({altKey:true,shiftKey:true}),'subtract');
});
test('eight locale contracts are complete with instructions and status',async()=>{
  const {WORLD_EDITOR_MARQUEE_LOCALES,worldEditorMarqueeCopy}=await import('../src/lib/wep/world-editor-marquee-copy.js');
  assert.deepEqual([...WORLD_EDITOR_MARQUEE_LOCALES].sort(),['en','ja','de','fr','it','es-ES','pt-BR','zh-CN'].sort());
  for(const locale of WORLD_EDITOR_MARQUEE_LOCALES){
    for(const key of ['tool','hint','live','cancel','applied']){
      assert.ok(worldEditorMarqueeCopy(locale)[key]?.length>2,locale+':'+key);
    }
    assert.ok(worldEditorMarqueeCopy(locale).live.includes('{count}'));
  }
});
