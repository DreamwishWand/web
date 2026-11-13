// Synthetic only: independent exact old/new native causal boundary.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,stat,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const [old,newer]=process.argv.slice(2).map(resolvePath=>resolve(resolvePath));
const root=await mkdtemp(join(tmpdir(),'qac1010-'));
const hash=b=>createHash('sha256').update(b).digest('hex');
const entry='{"Amount":2, "Marker":"ItemMarker_None","Unknown":[true,null]}';
const target='{"ID":41,"CompatibleItemType":"ItemType_Skin","Inventory":{"170000000":'+entry+'}}';
const zero='{"ID":0,"CompatibleItemType":"ItemType_Furniture","Inventory":{"170000000":{"Amount":999}}}';
const character='{"Base":{"id":10000053},"SkinID":170000001}';
const world='{"Characters":['+character+']}';
const body=(routes)=>Buffer.from('{"GameInfo":{"Version":626},"World":'+world+',"Player":{"ListInventories":{'+routes+'},"AvatarIsMale":false,"FemaleAvatar":{},"MaleAvatar":{}}}');
const base=body('"41":'+target), repaired=body('"41":'+target+',"0":'+zero);
const env={...process.env,WAND_LOCAL_INSTALLED_STEAM_FULLVERSION:'releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22',WAND_LOCAL_ORIGINAL_SHA256:'b'.repeat(64),WAND_LOCAL_ORIGINAL_SIZE_BYTES:'777'};
const run=(exe,n,b,c='10000053',k='170000000',e={})=>{const p=join(root,n+'.json');return {p,x:spawnSync(exe,['--character-skin-receipt-only',c,k,'--out',p],{input:b,env:{...env,WAND_LOCAL_DECODED_SHA256:hash(b),...e},encoding:'utf8'})}};
const good=async(exe,n,b)=>{const {p,x}=run(exe,n,b);assert.equal(x.status,0,x.stderr);assert.equal(x.stdout,'');assert.equal((await stat(p)).mode&0o777,0o600);return JSON.parse(await readFile(p));};
const deny=async(exe,n,b,c,k,e)=>{const {p,x}=run(exe,n,b,c,k,e);assert.equal(x.status,12,x.stderr);assert.equal(x.stdout,'');assert.match(x.stderr,/^LOCAL_RUST_V1_DENIED:[A-Z_]+\s*$/);await assert.rejects(readFile(p),{code:'ENOENT'});};
try{
 await test('1 actual old/new causal counterexample and invariant selected raw hashes',async()=>{
  const a=await good(old,'oldBase',base), b=await good(newer,'newBase',base);
  await deny(old,'oldZero',repaired);
  const c=await good(newer,'newZero',repaired);
  for(const v of [b,c]){assert.deepEqual(v.character,a.character);assert.deepEqual(v.skinInventory,a.skinInventory);assert.equal(v.skinInventory.entrySha256,hash(entry));assert.equal(v.skinInventory.inventoryRecordSha256,hash(target));assert.equal(v.character.characterSha256,hash(character));assert.equal(v.skinInventory.savedAmount,2);assert.equal(v.skinInventory.inventoryId,41);assert.equal(v.referenceReadSet.worldSha256,hash(world));}
  assert.equal(b.referenceReadSet.listInventoriesSha256,a.referenceReadSet.listInventoriesSha256);assert.notEqual(c.referenceReadSet.listInventoriesSha256,b.referenceReadSet.listInventoriesSha256);assert.equal(c.decodedSha256,hash(repaired));assert.equal(c.revision,0);assert.equal(c.indexGeneration,1);
  for(const k of ['writerAuthorized','productReadAccepted','editedCopyAuthorized','applyAuthorized','ownedRightsVerified','characterSkinCompatibilityVerified','nativeV3Verified','physicalGameInstallCryptographicallyProven'])assert.equal(c[k],false,k);
  for(const k of ['nativeHasItemVerified','markerSemanticsVerified','rightsVerified'])assert.equal(c.skinInventory[k],false,k);
  for(const k of ['catalogDefinitionVerified','actualConditionsEvaluated','activeReferenceClosureVerified','subscriberClosureVerified'])assert.equal(c.referenceReadSet[k],false,k);
 });
 await test('2 zero position, escaped canonical key, unrelated record never selected',async()=>{
  for(const [i,r] of ['"0":'+zero+',"41":'+target,'"\\u0030":'+zero+',"41":'+target].entries()){const v=await good(newer,'order'+i,body(r));assert.equal(v.skinInventory.savedAmount,2);assert.equal(v.skinInventory.inventoryId,41);}
 });
 await test('3 selected zero sole or duplicate and malformed unrelated identity remain denied',async()=>{
  const s0=target.replace('"ID":41','"ID":0');
  const cases=['"0":'+s0,'"0":'+s0+',"41":'+target,'"41":'+target+',"0":'+s0,'"0":'+zero.replace('"ID":0','"ID":1')+',"41":'+target,'"0":'+zero.replace('"ID":0','"ID":"0"')+',"41":'+target,'"0":'+zero.replace('"ID":0,','')+',"41":'+target,'"0":'+zero.replace('"ItemType_Furniture"','null')+',"41":'+target,'"00":'+zero+',"41":'+target,'"0":'+zero+',"\\u0030":'+zero+',"41":'+target,'"0":'+zero,'"0":'+zero+',"41":'+target.replace('"Amount":2','"Amount":0'),'"0":'+zero+',"41":'+target+',"42":'+target.replace('"ID":41','"ID":42')];
  for(const [i,r] of cases.entries())await deny(newer,'bad'+i,body(r));
 });
 await test('4 unchanged selector/build/SHA and legacy private modes',async()=>{
  await deny(newer,'subtype',repaired,'10000053','170100001');await deny(newer,'missing',repaired,'10000099','170000000');await deny(newer,'build',repaired,undefined,undefined,{WAND_LOCAL_INSTALLED_STEAM_FULLVERSION:'9A239D3DB569756D'});await deny(newer,'sha',repaired,undefined,undefined,{WAND_LOCAL_DECODED_SHA256:'f'.repeat(64)});
  const a=spawnSync(newer,[],{input:repaired,env:{...env,WAND_LOCAL_DECODED_SHA256:hash(repaired)},encoding:'utf8'});assert.equal(a.status,0,a.stderr);assert.equal(JSON.parse(a.stdout).contract,'wand.native.private.real-steam-v1@1');assert.equal(Object.hasOwn(JSON.parse(a.stdout),'skinInventory'),false);
  const p=join(root,'avatar.json'),v=spawnSync(newer,['--active-avatar-receipt-only','--out',p],{input:repaired,env:{...env,WAND_LOCAL_DECODED_SHA256:hash(repaired)},encoding:'utf8'});assert.equal(v.status,0,v.stderr);assert.equal(v.stdout,'');assert.equal(JSON.parse(await readFile(p)).activeBranch,'FemaleAvatar');
 });
}finally{await rm(root,{recursive:true,force:true});}
