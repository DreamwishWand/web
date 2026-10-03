import test from 'node:test';
import assert from 'node:assert/strict';
import {
  decodeCollectionRecord,
  filterCollectionRecords,
  validateCollectionRuntimeIndex
} from '../src/lib/collection/runtime.js';

const index = {
  s:'wand.collection.runtime@1',
  t:{platform:'Nintendo Switch',gameVersion:'1.25.0',buildID:'52BD625D9B4E0053'},
  l:['EN','FR','IT','DE','ES-ES','JA','ZH-CN','PT-BR'],
  f:['Furniture','Characters'], c:['READ_ONLY','TRACKED'], m:['UNLOCKED_LOCKED','QUANTITY_STOCK'],
  w:['IsDreamlightValley'], u:['Mickey','Frozen'], e:['BaseGame'], n:2,
  shards:[{file:'records-00.json',offset:0,count:2,bytes:10,sha256:'a'.repeat(64)}]
};

test('Collection runtime index enforces exact supported build and denominator', () => {
  assert.equal(validateCollectionRuntimeIndex(index), index);
  assert.throws(() => validateCollectionRuntimeIndex({...index,n:3}), /denominator mismatch/);
  assert.throws(() => validateCollectionRuntimeIndex({...index,t:{...index.t,buildID:'BAD'}}), /supported v1.25.0 Switch build/);
});

test('Collection record decoding keeps user taxonomy and strips display markup', () => {
  const record = decodeCollectionRecord(index, [42,1,0,0,[0],[1],[0],['Anna','Anna','Anna','Anna','Anna','<nobr>アナ<\/nobr>','安娜','Anna']], 'ja');
  assert.equal(record.itemId, 42);
  assert.equal(record.family, 'Characters');
  assert.equal(record.label, 'アナ');
  assert.deepEqual(record.worlds, ['IsDreamlightValley']);
  assert.deepEqual(record.universes, ['Frozen']);
});

test('Collection search matches localized labels and exact structured facets', () => {
  const records = [
    decodeCollectionRecord(index,[1,0,1,1,[0],[0],[0],['Chair','Chaise','Sedia','Stuhl','Silla','いす','椅子','Cadeira']],'en'),
    decodeCollectionRecord(index,[2,1,0,0,[0],[1],[0],['Anna','Anna','Anna','Anna','Anna','アナ','安娜','Anna']],'en')
  ];
  assert.deepEqual(filterCollectionRecords(records,{query:'椅子'}).map(x=>x.itemId),[1]);
  assert.deepEqual(filterCollectionRecords(records,{family:'Characters'}).map(x=>x.itemId),[2]);
  assert.deepEqual(filterCollectionRecords(records,{universe:'Mickey'}).map(x=>x.itemId),[1]);
});
