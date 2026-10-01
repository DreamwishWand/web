import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import fs from 'node:fs';

const url=new URL('../static/ddv/core/world/v1.25/building-classification-projection-v125.json',import.meta.url);
const raw=fs.readFileSync(url,'utf8');
const contract=JSON.parse(raw);

assert.equal(contract.schema,'ddv.building-classification-projection@1');
assert.equal(contract.artifact,'DDV-BUILDING-CLASSIFICATION-V125-V1_11');
assert.equal(contract.status,'PROMOTED');
assert.equal(contract.target.platform,'Nintendo Switch');
assert.equal(contract.target.gameVersion,'1.25.0');
assert.equal(contract.target.buildId,'52BD625D9B4E0053');
assert.equal(contract.target.profileSchema,624);
assert.equal(contract.parentBaseline.artifact,'DDV-BUILDING-V125-V1_10');
assert.equal(contract.parentBaseline.sha256,'ca4e718218fbcd7e33080ede6ad5849b360c2fa237fb4c5630197a2234e2ab20');
assert.equal(contract.writerBoundary.persistentWriteAuthorized,false);
assert.equal(contract.writerBoundary.WORLD_PERSISTENT_WRITE_V125,false);

assert.equal(contract.records.length,440);
assert.equal(new Set(contract.records.map((r)=>r[0])).size,440);

const classCounts={S:0,X:0,U:0,O:0};
const typeCounts={H:0,S:0,G:0,O:0,X:0,P:0};
for(const r of contract.records){
  const [itemID,type,isPlayerHouse,isCharacterHouse,isFastTravel,hasSynchronizer,hasOtherBinding,classification]=r;
  assert.ok(Number.isSafeInteger(itemID));
  typeCounts[type]++;
  classCounts[classification]++;

  let expected='U';
  if(type==='X') expected='X';
  else if(type==='P'||type==='S'||type==='G') expected='S';
  else if(type==='H'||type==='O'){
    const signals=[isPlayerHouse,isCharacterHouse,isFastTravel,hasSynchronizer,hasOtherBinding];
    if(signals.every((v)=>v===false)) expected='O';
    else if(signals.some((v)=>v==null)) expected='U';
    else expected='S';
  }
  assert.equal(classification,expected,`classification mismatch for ItemID ${itemID}`);
}

assert.deepEqual(classCounts,{S:357,X:82,U:1,O:0});
assert.deepEqual(typeCounts,{H:55,S:80,G:17,O:70,X:82,P:136});
assert.deepEqual(contract.summary.ordinaryItemIDs,[]);
assert.deepEqual(contract.summary.unknownItemIDs,[20300112]);

const unknown=contract.records.find((r)=>r[0]===20300112);
assert.deepEqual(unknown,[20300112,'O',false,false,false,false,null,'U']);
assert.equal(contract.unknown.length,1);
assert.equal(contract.unknown[0].itemID,20300112);
assert.equal(contract.unknown[0].reason,'UNKNOWN_FAIL_CLOSED_CONSUMER_BINDING_NOT_CLOSED');

const sha=createHash('sha256').update(raw).digest('hex');
assert.equal(sha,'f389f1af6add09fe50d28c6d0a501a212256abd7f4f1e5f6a868c13fdc6f9411');

console.log('PASS ddv.building-classification-projection@1 v1.11');
