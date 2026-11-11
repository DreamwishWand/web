// Synthetic-only Steam626 profile. No Owner Save or credential in Actions.
import {mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {syntheticProfile,makeSyntheticP1gProfile} from '../helpers/p1g-fixture.mjs';
const root=syntheticProfile('DeviceType_Windows');
root.GameInfo.Version=626;
root.Player={
  ListInventories:{
    '4':{ID:4,CompatibleItemType:'ItemType_Ingredient',
      Inventory:{'30000001':{Amount:50,Marker:'ItemMarker_None',Unknown:{keep:'🌿'}}}}
  },
  ContainerInventories:{
    '5':{ID:5,BelongsToPlayer:true,ParentItemID:420,Size:1,
      Inventory:[{ItemID:30000002,Amount:12,ItemState:{marker:'opaque'}}]}
  }
};
root.World={GridCollection:{DiffGrids:{}},Clock:0};
root.Opaque={future:{unicode:'🌿🍃',keep:'opaque-marker'}};
const original=Buffer.from(JSON.stringify(root),'utf8');
const encrypted=makeSyntheticP1gProfile(root);
await mkdir(new URL('./fixtures/',import.meta.url),{recursive:true});
await writeFile(new URL('./fixtures/synthetic626-amount.p1g',import.meta.url),encrypted);
await writeFile(new URL('./fixtures/expected.json',import.meta.url),
 JSON.stringify({syntheticOnly:true,
   originalSha256:createHash('sha256').update(encrypted).digest('hex'),
   decodedSha256:createHash('sha256').update(original).digest('hex'),
   originalSizeBytes:encrypted.length})+'\n');
console.log('STAGE_I_SYNTHETIC_ONLY_GENERATED');
