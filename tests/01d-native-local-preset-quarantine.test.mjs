import test from 'node:test';
import assert from 'node:assert/strict';
import {nativeLocalPresetQuarantineWarnings} from '../src/lib/presets/native-local-preset-quarantine.mjs';
const valid=()=>({GridCollection:{Grids:{'0':{ID:0,Objects:{'0':{ID:0,State:null}}}},DiffGrids:{}},ThumbnailItems:[40000001]});
test('clean schema624 local file has no extra quarantine and is not a native restore claim',()=>{
  const x=valid();
  assert.deepEqual(nativeLocalPresetQuarantineWarnings(x),[]);
});
test('bad or missing DiffGrids must quarantine rather than treating as empty',()=>{
  for(const shape of [undefined,null,[],42,'bad']){
    const x=valid();x.GridCollection.DiffGrids=shape;
    assert.ok(nativeLocalPresetQuarantineWarnings(x).includes('DIFF_GRIDS_MALFORMED'));
  }
});
test('invalid Grid.Objects shape must quarantine rather than silently erase',()=>{
  for(const shape of [undefined,null,[],42,'wrong']){
    const x=valid();x.GridCollection.Grids['0'].Objects=shape;
    assert.ok(nativeLocalPresetQuarantineWarnings(x).includes('GRID_OBJECTS_MALFORMED'));
  }
});
test('invalid object, state or subgrid must quarantine',()=>{
  for(const [record,expected] of [[null,'GRID_OBJECT_RECORD_MALFORMED'],[42,'GRID_OBJECT_RECORD_MALFORMED'],[{ID:0,State:42},'GRID_OBJECT_STATE_MALFORMED'],[{ID:0,State:{SubGrid:'bad'}},'SUBGRID_REFERENCE_MALFORMED']]){
    const x=valid();x.GridCollection.Grids['0'].Objects['0']=record;
    assert.ok(nativeLocalPresetQuarantineWarnings(x).includes(expected));
  }
});
test('thumbnail invalid ID/number coercion cannot silently become a safe summary',()=>{
  for(const shape of [[0],[-1],[NaN],['40000001'],[2.5],['bad']]){
    const x=valid();x.ThumbnailItems=shape;
    assert.ok(nativeLocalPresetQuarantineWarnings(x).includes('THUMBNAIL_ITEM_ID_MALFORMED'));
  }
});
test('unknown fields are kept untouched, no Source/Writer/ToM inference',()=>{
  const x=valid();x.OpaqueFuture={newField:[1,2]};
  const frozenBefore=JSON.stringify(x);
  assert.deepEqual(nativeLocalPresetQuarantineWarnings(x),[]);
  assert.equal(JSON.stringify(x),frozenBefore);
  assert.equal(Object.hasOwn(nativeLocalPresetQuarantineWarnings(x),'gameSaveApplyAuthorized'),false);
});
