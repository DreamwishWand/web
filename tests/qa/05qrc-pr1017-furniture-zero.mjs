// Synthetic only: independent old/new native executable and actual saved restrictions.
import assert from 'node:assert/strict';
import {mkdtemp,readFile,stat,rm} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {test} from 'node:test';
const [old,newer]=process.argv.slice(2).map(x=>resolve(x)),root=await mkdtemp(join(tmpdir(),'qac1017-'));
const sha=b=>createHash('sha256').update(b).digest('hex');
const entry='{"Amount":12, "Marker":"Keep","Unknown":[1,null]}';
const record='{"ID":0,"CompatibleItemType":"ItemType_Furniture","CompatibleFurnitureTypes":{"List":["FurnitureItemType_SnippetTrap"]},"Inventory":{"40000001":{"Amount":8},"40900001":'+entry+'}}';
const positive='{"ID":4,"CompatibleItemType":"ItemType_ActivityItem","Inventory":{"30000001":{"Amount":9}}}';
const body=r=>Buffer.from('{"GameInfo":{"Version":626},"World":{},"Player":{"ListInventories":{'+r+'}}}');
const b=body('"0":'+record+',"4":'+positive), baseline=body('"4":'+positive);
const env={...process.env,WAND_LOCAL_INSTALLED_STEAM_FULLVERSION:'releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22',WAND_LOCAL_ORIGINAL_SHA256:'b'.repeat(64),WAND_LOCAL_ORIGINAL_SIZE_BYTES:'777'};
const call=(exe,n,raw,sel,e={})=>{const p=join(root,n+'.json');return {p,r:spawnSync(exe,[...(sel??['--new-inventory-candidate']),'--out',p],{input:raw,env:{...env,WAND_LOCAL_DECODED_SHA256:sha(raw),...e},encoding:'utf8'})}};
const good=async(exe,n,raw,sel)=>{const {p,r}=call(exe,n,raw,sel);assert.equal(r.status,0,r.stderr);assert.equal(r.stdout,'');assert.equal((await stat(p)).mode&0o777,0o600);return JSON.parse(await readFile(p));};
const deny=async(exe,n,raw,sel,e)=>{const {p,r}=call(exe,n,raw,sel,e);assert.equal(r.status,12,r.stderr);assert.equal(r.stdout,'');await assert.rejects(readFile(p),{code:'ENOENT'});};
const explicit=['--inventory','0','40900001'];
try{
 await test('old/new causal, actual restriction not default, auto explicit hash',async()=>{
  const a=await good(old,'oldPositive',baseline),v=await good(newer,'newPositive',baseline);assert.equal(a.entrySha256,v.entrySha256);
  await deny(old,'oldZero',b);await deny(old,'oldExplicit',b,explicit);
  const x=await good(newer,'auto',b),y=await good(newer,'explicit',b,explicit);for(const z of [x,y]){assert.equal(z.inventoryId,0);assert.equal(z.itemId,40900001);assert.equal(z.oldAmount,12);assert.equal(z.entrySha256,sha(entry));assert.equal(z.decodedSha256,sha(b));for(const k of ['writerAuthorized','productReadAccepted','editedCopyAuthorized','applyAuthorized','rightsVerified','variationVerified','canonicalItemDbVerified','nativeReferenceClosureVerified','subscriberClosureVerified','nativeV3Verified'])assert.equal(z[k],false,k);}
 });
 await test('strict saved restriction and subtype with positive fallback',async()=>{
  await deny(newer,'default',b,['--inventory','0','40000001']);
  for(const [i,r] of [record.replace('"FurnitureItemType_SnippetTrap"','"FurnitureItemType_Default"'),record.replace('"FurnitureItemType_SnippetTrap"','"FurnitureItemType_SnippetTrap","FurnitureItemType_SnippetTrap"'),record.replace('"FurnitureItemType_SnippetTrap"','"Unknown"'),record.replace('"CompatibleFurnitureTypes":','"UnknownRestriction":'),record.replace('"CompatibleFurnitureTypes":','"CompatibleActivityItemTypes":{},"CompatibleFurnitureTypes":'),record.replace('"ID":0','"ID":1'),record.replace('"ID":0','"ID":"0"'),record.replace('"ItemType_Furniture"','"ItemType_ActivityItem"'),record.replace('"Amount":12','"Amount":1')].entries())await deny(newer,'bad'+i,body('"0":'+r),explicit);
  const x=await good(newer,'fallback',body('"0":'+record.replace('"FurnitureItemType_SnippetTrap"','"FurnitureItemType_Fence"')+',"4":'+positive));assert.equal(x.inventoryId,4);
 });
 await test('bounds, canonical key, duplicate and scope negatives',async()=>{
  const big=record.replace('"ID":0','"ID":0,'+Array.from({length:64},(_,i)=>'"X'+i+'":0').join(','));
  for(const [i,r] of ['"0":'+big,'"00":'+record,'"0":'+record+',"\\u0030":'+record,'"0":'+record.replace('"List":[','"List":[true,')].entries())await deny(newer,'shape'+i,body(r),explicit);
  for(const [i,k] of ['0','2147483648','30000001','40000001'].entries())await deny(newer,'item'+i,b,['--inventory','0',k]);
  await deny(newer,'badBuild',b,explicit,{WAND_LOCAL_INSTALLED_STEAM_FULLVERSION:'9A239D3DB569756D'});await deny(newer,'badSha',b,explicit,{WAND_LOCAL_DECODED_SHA256:'f'.repeat(64)});
 });
}finally{await rm(root,{recursive:true,force:true});}
