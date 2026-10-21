import test from 'node:test';
import assert from 'node:assert/strict';
import { backpackSlots } from '../src/lib/editor/backpack-slots.mjs';

const make = (size, inventory = []) => ({Player:{ContainerInventories:{'0':{ID:0,Size:size,Inventory:inventory}}}});
test('42 logical cells, regardless of materialized array length', () => {
  const model=backpackSlots(make(42,[{ItemID:31100000,Amount:50,State:null}]),[{containerKey:'0',slotIndex:0,itemID:31100000,amount:50,editable:true,path:'/Player/ContainerInventories/0/Inventory/0/Amount'}]);
  assert.equal(model.capacity,42);
  assert.equal(model.cells.length,42);
  assert.equal(model.cells[0].status,'editable');
  assert.equal(model.cells[41].status,'empty');
});
test('pending amount is projected without mutating source', () => {
  const original={ItemID:31100000,Amount:50,State:null};
  const entry={containerKey:'0',slotIndex:0,itemID:31100000,amount:50,editable:true,path:'/amount'};
  assert.equal(backpackSlots(make(42,[original]),[entry],new Map([['/amount',{to:49}]])).cells[0].amount,49);
  assert.equal(original.Amount,50);
});
test('unknown materialized records are not presented as free slots', () => {
  const model=backpackSlots(make(3,[{ItemID:123,Amount:0},{ExtraField:5},{}]));
  assert.deepEqual(model.cells.map(c=>c.status),['unknown','unknown','empty']);
});
test('invalid capacities and malformed inventory are rejected', () => {
  assert.equal(backpackSlots(make(1,[{},{}])),null);
  assert.equal(backpackSlots(make(-1,[])),null);
});
test('capacity beyond 42 is not silently discarded', () => {
  assert.equal(backpackSlots(make(48)).cells.length,48);
  const oversized=backpackSlots(make(97));
  assert.equal(oversized.truncated,true);
  assert.equal(oversized.cells.length,96);
});
