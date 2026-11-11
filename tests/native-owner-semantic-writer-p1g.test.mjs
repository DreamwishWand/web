// PUBLIC SYNTHETIC V2 only: original-first backup -> separate named edited P1G
// via the EXISTING DDV P1G Codec, fresh independent Node process ZIP/CRC reopen.
// No real Owner P1G, keys, attachments, paths or media in public CI.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,open,rm} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {p1gPackagedProfileCodec} from '../src/lib/ddv/core/save/p1g-packaged-profile-codec.js';
import {syntheticProfile,makeSyntheticP1gProfile} from './helpers/p1g-fixture.mjs';

const binary=process.env.WAND_TEST_SEMANTIC_RUST;
if(!binary){
 console.log('DEV_SEMANTIC_P1G_NATIVE_BINARY_ABSENT_GENERIC_NODE_NOT_RUN');
 process.exit(0);
}
const sha=b=>createHash('sha256').update(b).digest('hex');
const STEAM='releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22';
async function writeNewVerified(path,bytes) {
 const f=await open(path,'wx',0o600);
 try {await f.writeFile(bytes);await f.sync()}
 finally{await f.close()}
 const observed=await readFile(path);
 assert.equal(sha(observed),sha(bytes));
}
test('Original encrypted Backup first -> typed real 50→49 plus Chest12→11 -> distinct Edited-copy -> independent fresh P1G reopen',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'wand-r22-public-semantic-synthetic-'));
 try{
  const sourcePath=join(dir,'original.p1g'),
        backupPath=join(dir,'original.backup.p1g'),
        editedPath=join(dir,'edited-copy.p1g');
  const root=syntheticProfile('DeviceType_Windows');
  root.GameInfo.Version=626;
  root.Player={
   ListInventories:{'4':{ID:4,CompatibleItemType:'ItemType_Ingredient',
     Inventory:{'30000001':{Amount:50,Marker:'ItemMarker_None',
       Unknown:{future:true,ratio:1.00}}}}},
   ContainerInventories:{'12':{ID:12,BelongsToPlayer:true,
     ParentItemID:500000,Size:1,
     Inventory:[{ItemID:30000002,Amount:12,Keep:'opaque'}]}}
  };
  root.Other={OriginalUnknown:true};
  const original=new Uint8Array(makeSyntheticP1gProfile(root));
  assert.ok(original.length>0&&original.length%16===0);
  const originalHash=sha(original);
  await writeNewVerified(sourcePath,original);
  const loaded=await p1gPackagedProfileCodec.loadProfile(original);
  assert.equal(loaded.metadata.profileVersion,626);
  const before=loaded.jsonText;
  assert.equal(JSON.parse(before).Player.ListInventories['4'].Inventory['30000001'].Amount,50);
  // ORIGINAL-FIRST safety. The Rust native runner never receives a filename,
  // encrypted source bytes, private AES key or any permit to touch the source.
  await writeNewVerified(backupPath,original);
  assert.equal(sha(await readFile(backupPath)),originalHash);
  const env={...process.env,
   WAND_LOCAL_INSTALLED_STEAM_FULLVERSION:STEAM,
   WAND_LOCAL_ORIGINAL_SHA256:originalHash,
   WAND_LOCAL_ORIGINAL_SIZE_BYTES:String(original.length),
   WAND_LOCAL_DECODED_SHA256:sha(before),
   WAND_LOCAL_INVENTORY_ID:'4',
   WAND_LOCAL_CANONICAL_ITEM_ID:'30000001',
   WAND_LOCAL_COMPATIBLE_ITEM_TYPE:'ItemType_Ingredient',
   WAND_LOCAL_EXPECTED_OLD_AMOUNT:'50',WAND_LOCAL_NEW_AMOUNT:'49',
   WAND_LOCAL_CONTAINER_ID:'12',WAND_LOCAL_SLOT_INDEX:'0',
   WAND_LOCAL_SLOT_ITEM_ID:'30000002',
   WAND_LOCAL_CHEST_EXPECTED_OLD_AMOUNT:'12',WAND_LOCAL_CHEST_NEW_AMOUNT:'11'
  };
  const result=spawnSync(binary,['--semantic-inventory-and-chest-decrease-only'],{
   input:Buffer.from(before,'utf8'),env,maxBuffer:8*1024*1024,timeout:40000});
  assert.equal(result.status,0,result.stderr.toString('utf8').slice(0,150));
  assert.match(result.stderr.toString('utf8'),
   /PRIVATE_V2_RUST_REAL_AMOUNT_SEMANTIC_CHANGE_CAS_ATOMIC_UNDO_REDO_ONE_TIME_PIPE_PASS/);
  const editedDecoded=result.stdout.toString('utf8');
  assert.notEqual(sha(editedDecoded),sha(before));
  const editedObj=JSON.parse(editedDecoded);
  const originalObj=JSON.parse(before);
  assert.equal(editedObj.Player.ListInventories['4'].Inventory['30000001'].Amount,49);
  assert.equal(editedObj.Player.ContainerInventories['12'].Inventory[0].Amount,11);
  originalObj.Player.ListInventories['4'].Inventory['30000001'].Amount=49;
  originalObj.Player.ContainerInventories['12'].Inventory[0].Amount=11;
  assert.deepEqual(editedObj,originalObj);
  assert.match(editedDecoded,/"OriginalUnknown":true/);
  // Existing verified P1G Codec, same ZIP metadata and preserved unknowns.
  const editedP1g=await p1gPackagedProfileCodec.createEncodedProfile(editedDecoded,loaded.metadata);
  assert.ok(editedP1g instanceof Uint8Array&&editedP1g.length%16===0);
  await writeNewVerified(editedPath,editedP1g);
  assert.equal(sha(await readFile(sourcePath)),originalHash);
  assert.equal(sha(await readFile(backupPath)),originalHash);
  assert.notEqual(sha(editedP1g),originalHash);
  const again=await p1gPackagedProfileCodec.loadProfile(new Uint8Array(await readFile(editedPath)));
  assert.deepEqual(JSON.parse(again.jsonText),editedObj);
  // Distinct process and separate codec invocation. Not just same-process read.
  const fresh=spawnSync(process.execPath,[
   resolve('tests/helpers/native-semantic-p1g-independent-reopen.mjs'),
   editedPath,sha(before),sha(editedP1g)
  ],{encoding:'utf8',env:{...process.env},timeout:40000});
  assert.equal(fresh.status,0,(fresh.stderr||'').slice(0,200));
  assert.match(fresh.stdout,/INDEPENDENT_FRESH_NODE_P1G_ZIP_CRC_REOPEN_SEMANTIC_AMOUNT_49_11_PASS/);
  await assert.rejects(()=>open(editedPath,'wx'),{code:'EEXIST'}); // never overwrite
  assert.equal(sha(await readFile(sourcePath)),originalHash);
  console.log('DEV_SINGLE_RUST_PRODUCTSESSION_PUBLIC_SYNTHETIC_V2_ORIGINAL_BACKUP_EDITED_P1G_FRESH_NODE_REOPEN_TRUE_SEMANTIC_PASS');
 }finally{await rm(dir,{recursive:true,force:true})}
});
