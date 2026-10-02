import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

import {
  SCROOGE_STORE_V112_SCHEMA,
  SCROOGE_STORE_V112_SHA256,
  createSwitchV125ScroogeStoreBindingFromContract
} from '../src/lib/wep/scrooge-store-v112.ts';

const contract=JSON.parse(readFileSync(
  new URL('../static/ddv/core/world/v1.25/scrooge-store-state-v125.json',import.meta.url),
  'utf8'
));
const binding=createSwitchV125ScroogeStoreBindingFromContract(contract);

test('WEP consumes promoted Scrooge Store v1.12 as read-only',()=>{
  assert.equal(binding.schema,SCROOGE_STORE_V112_SCHEMA);
  assert.equal(binding.artifactId,'DDV-SCROOGE-STORE-STATE-V125-V1_12');
  assert.equal(binding.contractSha256,SCROOGE_STORE_V112_SHA256);
  assert.equal(binding.platform,'Nintendo Switch');
  assert.equal(binding.gameVersion,'1.25.0');
  assert.equal(binding.persistentWriteAuthorized,false);
  assert.equal(binding.mutationHandlerAuthorized,false);
});

test('exact ProfileWorld.Stores BuildingItemID resolves Store inventory',()=>{
  const profile={
    ProfileWorld:{
      Stores:[
        {
          BuildingItemID:12345678,
          Displays:[
            {
              DisplayItemID:2140000001,
              DisplayInfo:{
                Slots:[
                  {
                    Item:{id:40000001,amount:1},
                    IsAvailable:true,
                    CurrencyId:80000000
                  },
                  {
                    Item:null,
                    IsAvailable:false,
                    CurrencyId:0
                  }
                ],
                LayoutType:'FourItems',
                LastRefresh:'2026-10-01T00:00:00Z'
              }
            }
          ],
          LastRefresh:'2026-10-01T00:00:00Z',
          WeightedItems:{40000001:100,40000002:75},
          CurrentSequenceIndexPerUpgrade:[-1,2]
        }
      ],
      Shops:[
        {
          BuildingItemID:87654321,
          Displays:[]
        }
      ]
    }
  };

  const result=binding.resolveStoreForItem(profile,12345678);
  assert.equal(result.status,'resolved');
  assert.equal(result.sourceCollection,'ProfileWorld.Stores');
  assert.equal(result.store.buildingItemId,12345678);
  assert.equal(result.store.displayCount,1);
  assert.equal(result.store.totalSlotCount,2);
  assert.equal(result.store.availableSlotCount,1);
  assert.equal(result.store.weightedItemCount,2);
  assert.deepEqual(result.store.currentSequenceIndexPerUpgrade,[-1,2]);
  assert.deepEqual(result.store.displays[0].slots[0].item,{
    status:'resolved',
    id:40000001,
    amount:1
  });
  assert.equal(result.persistentWriteAuthorized,false);
});

test('WEP never falls back from Stores to ProfileWorld.Shops',()=>{
  const profile={
    ProfileWorld:{
      Stores:[],
      Shops:[{
        BuildingItemID:87654321,
        Displays:[]
      }]
    }
  };
  const result=binding.resolveStoreForItem(profile,87654321);
  assert.equal(result.status,'not-store');
  assert.equal(result.store,null);
});

test('duplicate StoreInfo identity fails closed',()=>{
  const profile={
    ProfileWorld:{
      Stores:[
        {BuildingItemID:111,Displays:[]},
        {BuildingItemID:111,Displays:[]}
      ]
    }
  };
  const result=binding.resolveStoreForItem(profile,111);
  assert.equal(result.status,'blocked');
  assert.equal(result.code,'SCROOGE_STORE_IDENTITY_AMBIGUOUS');
  assert.equal(result.matchCount,2);
  assert.equal(result.store,null);
});

test('missing Store collection and invalid ItemID fail closed',()=>{
  assert.equal(
    binding.resolveStoreForItem({},123).code,
    'SCROOGE_STORE_COLLECTION_UNAVAILABLE'
  );
  assert.equal(
    binding.resolveStoreForItem({ProfileWorld:{Stores:[]}},0).code,
    'SCROOGE_STORE_ITEM_ID_INVALID'
  );
});

const source=readFileSync(
  new URL('../src/lib/wep/scrooge-store-v112.ts',import.meta.url),
  'utf8'
);
test('Store binder contains no hard-coded Scrooge Building ItemID list',()=>{
  assert.doesNotMatch(source,/20300\d{3}/);
  assert.match(source,/ProfileWorld\?\.Stores/);
  assert.match(source,/BuildingItemID/);
});

const route=readFileSync(
  new URL('../src/routes/editor/world/+page.svelte',import.meta.url),
  'utf8'
);
test('World Editor exposes the v1.12 Store state only as read-only inspector data',()=>{
  assert.match(route,/createSwitchV125ScroogeStoreBinding/);
  assert.match(route,/Scrooge Store Inventory/);
  assert.match(route,/Read-only Core v1\.12 view/);
  assert.match(route,/ProfileWorld\.Stores\[\]\.BuildingItemID/);
  assert.doesNotMatch(route,/purchaseScrooge|restockScrooge|writeScroogeStore/);
});
