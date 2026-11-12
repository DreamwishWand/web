// Independent QA-only, synthetic input; never real Save or output artifact.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,mkdir,symlink,stat,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const exe=resolve(process.argv[2]);
const hash=b=>createHash('sha256').update(b).digest('hex');
const entry='{"Amount":9999, "Unknown":{"opaque":[null,true,4]}}';
const raw=Buffer.from('{"GameInfo":{"Version":626},"World":{},"Player":{"ListInventories":{ "7":{"ID":7,"CompatibleItemType":"ItemType_ActivityItem","Inventory":{"30000001":{"Amount":1},"40000001":{"Amount":20}}},"9":{"ID":9,"CompatibleItemType":"ItemType_Furniture","Inventory":{"40000002":'+entry+'}}}}}');
const build='releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22';
const root=await mkdtemp(join(tmpdir(),'qac965-'));
const env={...process.env,WAND_LOCAL_INSTALLED_STEAM_FULLVERSION:build,WAND_LOCAL_ORIGINAL_SHA256:'b'.repeat(64),WAND_LOCAL_ORIGINAL_SIZE_BYTES:'777',WAND_LOCAL_DECODED_SHA256:hash(raw)};
const run=(args,body=raw,extra={})=>spawnSync(exe,args,{input:body,env:{...env,WAND_LOCAL_DECODED_SHA256:hash(body),...extra},encoding:'utf8'});
const fresh=n=>join(root,n+'.json');
const discover=p=>['--new-inventory-candidate','--out',p];
const explicit=(p,i='9',j='40000002')=>['--inventory',i,j,'--out',p];
const good=async(p,args,body=raw)=>{const x=run(args,body);assert.equal(x.status,0,x.stderr);assert.equal(x.stdout,'');assert.equal(x.stderr.trim(),'LOCAL_AMOUNT_READ_PRIVATE_RECEIPT_WRITTEN');const v=JSON.parse(await readFile(p));return v};
const deny=async(p,args,body=raw,extra={})=>{const x=run(args,body,extra);assert.equal(x.status,12,x.stderr);assert.equal(x.stdout,'');assert.match(x.stderr,/^LOCAL_AMOUNT_READ_DENIED:[A-Z_]+\s*$/);if(p)await assert.rejects(readFile(p),{code:'ENOENT'});};
try{
 await test('1 raw entry hash, furniture upper bound, same bytes, independent session and exact explicit selection',async()=>{
  const a=fresh('auto'),b=fresh('explicit');const v=await good(a,discover(a)),w=await good(b,explicit(b));
  assert.equal(v.inventoryId,9);assert.equal(v.itemId,40000002);assert.equal(v.oldAmount,9999);assert.equal(v.nativeItemType,4);assert.equal(v.compatibleItemType,'ItemType_Furniture');assert.equal(v.entrySha256,hash(entry));assert.equal(v.decodedSha256,hash(raw));assert.equal(w.entrySha256,v.entrySha256);assert.notEqual(v.sessionId,w.sessionId);assert.equal(v.revision,0);assert.equal(v.indexGeneration,1);
  assert.equal(v.selectionKind,'NEW_BOUNDED_CANDIDATE_NOT_E1172_IDENTITY');assert.equal(w.selectionKind,'EXPLICIT_EXISTING_SELECTOR_NOT_E1172_IDENTITY_PROOF');
  for(const k of ['physicalGameInstallCryptographicallyProven','canonicalItemDbVerified','rightsVerified','variationVerified','nativeReferenceClosureVerified','subscriberClosureVerified','productReadAccepted','writerAuthorized','editedCopyAuthorized','applyAuthorized','nativeV3Verified','originalModifiedByHarness','cloudUploadPerformed'])assert.equal(v[k],false,k);
  assert.equal(v.originalSha256SuppliedExternally,'b'.repeat(64));assert.equal(v.originalSizeBytesSuppliedExternally,777);assert.equal(v.fullDocumentRustValidated,true);assert.equal(v.oneCoreMintedExistingTarget,true);
  if(process.platform!=='win32')assert.equal((await stat(a)).mode&0o777,0o600);
 });
 await test('2 escaped inventory key and whitespace use same scanner, exact raw hash',async()=>{
  const body=Buffer.from(raw.toString().replace('"9":','"\\u0039" : ').replace('"40000002":','"\\u00340000002" : '));
  const p=fresh('escaped');const v=await good(p,discover(p),body);assert.equal(v.inventoryId,9);assert.equal(v.itemId,40000002);assert.equal(v.entrySha256,hash(entry));
 });
 await test('3 invalid bounds, type mismatch, and absent explicit target cannot mint',async()=>{
  for(const [n,body] of [['over',raw.toString().replace('9999','10000')],['float',raw.toString().replace('9999','2.5')],['type',raw.toString().replace('ItemType_Furniture','ItemType_Ingredient')]]){
   const p=fresh(n);await deny(p,discover(p),Buffer.from(body));
  }const p=fresh('missing');await deny(p,explicit(p,'9','40000003'));
 });
 await test('4 malformed source, wrong schema, trailing JSON and duplicate decoded key rejected',async()=>{
  for(const [n,body] of [['schema',raw.toString().replace('626','624')],['trailing',raw.toString()+'{}'],['dup',raw.toString().replace('"Amount":9999','"Amount":9999,"\\u0041mount":2')]]){
   const p=fresh(n);await deny(p,discover(p),Buffer.from(body));
  }
 });
 await test('5 external Build, original SHA and size, decoded SHA fail closed',async()=>{
  const bad=[{WAND_LOCAL_INSTALLED_STEAM_FULLVERSION:'9A239D3DB569756D'},{WAND_LOCAL_ORIGINAL_SHA256:'0'.repeat(64)},{WAND_LOCAL_ORIGINAL_SIZE_BYTES:'0'},{WAND_LOCAL_ORIGINAL_SIZE_BYTES:'134217729'},{WAND_LOCAL_DECODED_SHA256:'c'.repeat(64)}];
  for(let i=0;i<bad.length;i++){const p=fresh('external'+i);await deny(p,discover(p),raw,bad[i]);}
 });
 await test('6 pre-existing receipt and symlink cannot overwrite; no stdout or private path leak',async()=>{
  const p=fresh('existing');await writeFile(p,'sentinel');const x=run(discover(p));assert.equal(x.status,12);assert.equal(x.stdout,'');assert.equal(x.stderr.trim(),'LOCAL_AMOUNT_READ_DENIED:PRIVATE_OUTPUT_ALREADY_EXISTS');assert.equal(await readFile(p,'utf8'),'sentinel');
  if(process.platform!=='win32'){const link=fresh('link');await symlink(p,link);const y=run(discover(link));assert.equal(y.status,12);assert.equal(y.stdout,'');assert.equal(await readFile(p,'utf8'),'sentinel');const dir=join(root,'public');await mkdir(dir,{mode:0o755});const q=join(dir,'receipt');await deny(q,discover(q));}
 });
}finally{await rm(root,{recursive:true,force:true});}
