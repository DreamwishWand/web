// Independent synthetic native-process audit; no real Save or private artifact.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,mkdir,symlink,stat,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const exe=resolve(process.argv[2]),root=await mkdtemp(join(tmpdir(),'qac980-'));
const sha=x=>createHash('sha256').update(x).digest('hex');
const base='{"id":10000053, "Unknown":[0,true]}', ch='{"Base":'+base+', "SkinID":-2147483648,"Keep":{"x":null}}';
const arr='[ {"Base":{"id":10000002},"SkinID":0}, '+ch+' ]';
const marker='"ItemMarker_\\u0041bc"', entry='{"Amount":2147483647, "Marker":'+marker+',"Unknown":[1,null]}';
const inv='{"ID":4294967295,"CompatibleItemType":"ItemType_Skin","Inventory":{"170100001":{"Amount":1},"170000000":'+entry+'}}';
const lists='{"7":{"ID":7,"CompatibleItemType":"ItemType_ActivityItem","Inventory":{"170000000":{"Amount":9}}},"4294967295":'+inv+'}';
const world='{"Characters":'+arr+',"Unknown":{}}', player='{"ListInventories":'+lists+',"AvatarIsMale":true,"FemaleAvatar":{},"MaleAvatar":{"HairColorIndex":0,"HairHighlightColor":0}}';
const raw=Buffer.from('{"GameInfo":{"Version":626},"World":'+world+',"Player":'+player+'}');
const env={...process.env,WAND_LOCAL_INSTALLED_STEAM_FULLVERSION:'releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22',WAND_LOCAL_ORIGINAL_SHA256:'b'.repeat(64),WAND_LOCAL_ORIGINAL_SIZE_BYTES:'777'};
const path=n=>join(root,n+'.json'), args=(p,c='10000053',k='170000000')=>['--character-skin-receipt-only',c,k,'--out',p];
const call=(a,b=raw,e={})=>spawnSync(exe,a,{input:b,env:{...env,WAND_LOCAL_DECODED_SHA256:sha(b),...e},encoding:'utf8'});
const good=async(n,b=raw,c='10000053',k='170000000')=>{const p=path(n),x=call(args(p,c,k),b);assert.equal(x.status,0,x.stderr);assert.equal(x.stdout,'');assert.equal(x.stderr.trim(),'LOCAL_RUST_V1_PRIVATE_CHARACTER_SKIN_RECEIPT_WRITTEN');if(process.platform!=='win32')assert.equal((await stat(p)).mode&0o777,0o600);return JSON.parse(await readFile(p));};
const deny=async(n,b=raw,c='10000053',k='170000000',e={})=>{const p=path(n),x=call(args(p,c,k),b,e);assert.equal(x.status,12,x.stderr);assert.equal(x.stdout,'');assert.match(x.stderr,/^LOCAL_RUST_V1_DENIED:[A-Z_]+\s*$/);await assert.rejects(readFile(p),{code:'ENOENT'});};
const mutate=f=>{const d=JSON.parse(raw);f(d);return Buffer.from(JSON.stringify(d));};
try{
 await test('1 exact selected bytes, readset, non-key7 route and diagnostic-only identity',async()=>{
  const v=await good('hash');assert.equal(v.contract,'wand.native.private.character-skin-read@1');assert.equal(v.character.characterId,10000053);assert.equal(v.character.savedArrayIndexDiagnosticOnly,1);assert.equal(v.character.baseIdSavedField,'id');assert.equal(v.character.baseSha256,sha(base));assert.equal(v.character.characterSha256,sha(ch));assert.equal(v.character.currentSkinId,-2147483648);assert.equal(v.character.skinIdSha256,sha('-2147483648'));assert.equal(v.skinInventory.inventoryId,4294967295);assert.equal(v.skinInventory.savedAmount,2147483647);assert.equal(v.skinInventory.savedMarker,'ItemMarker_Abc');assert.equal(v.skinInventory.markerSha256,sha(marker));assert.equal(v.skinInventory.inventoryRecordSha256,sha(inv));assert.equal(v.skinInventory.entrySha256,sha(entry));
  for(const [k,b] of Object.entries({charactersSha256:arr,listInventoriesSha256:lists,worldSha256:world,playerSha256:player}))assert.equal(v.referenceReadSet[k],sha(b));assert.equal(v.decodedSha256,sha(raw));assert.equal(v.originalSha256SuppliedExternally,'b'.repeat(64));assert.equal(v.originalSizeBytesSuppliedExternally,777);assert.equal(v.revision,0);assert.equal(v.indexGeneration,1);assert.equal(v.fullDocumentRustValidated,true);
  for(const k of ['physicalGameInstallCryptographicallyProven','characterSkinCompatibilityVerified','ownedRightsVerified','productReadAccepted','writerAuthorized','editedCopyAuthorized','applyAuthorized','nativeV3Verified','cloudUploadPerformed','originalModifiedByHarness'])assert.equal(v[k],false,k);
  for(const k of ['catalogDefinitionVerified','actualConditionsEvaluated','activeReferenceClosureVerified','subscriberClosureVerified'])assert.equal(v.referenceReadSet[k],false,k);
  for(const k of ['nativeHasItemVerified','markerSemanticsVerified','rightsVerified'])assert.equal(v.skinInventory[k],false,k);
 });
 await test('2 reordered characters, escaped exact keys, old sentinel/zero/absent/same and marker absent',async()=>{
  for(const [i,old] of [undefined,0,-1,170000000].entries()){const b=mutate(d=>{d.World.Characters.reverse();const c=d.World.Characters[0];if(old===undefined)delete c.SkinID;else c.SkinID=old;delete d.Player.ListInventories[4294967295].Inventory[170000000].Marker;});const v=await good('old'+i,b);assert.equal(v.character.savedArrayIndexDiagnosticOnly,0);assert.equal(v.character.skinIdPresent,old!==undefined);assert.equal(v.character.currentSkinId,old??null);assert.equal(v.character.skinIdSha256,old===undefined?null:sha(String(old)));assert.equal(v.character.sameSavedSkin,old===170000000);assert.equal(v.skinInventory.markerPresent,false);assert.equal(v.skinInventory.savedMarker,null);assert.equal(v.skinInventory.markerSha256,null);}
  const v=await good('escape',Buffer.from(raw.toString().replace('"id":10000053','"\\u0069d":10000053').replace('"SkinID":-2147483648','"Skin\\u0049D":-2147483648')));assert.equal(v.character.currentSkinId,-2147483648);
 });
 await test('3 identity, shape, full-document and selector denial',async()=>{
  for(const [n,f] of [['alias',d=>d.World.Characters[1].Base={ID:10000053}],['duplicateNonTarget',d=>d.World.Characters.push({Base:{id:10000002}})],['badOtherId',d=>d.World.Characters[0].Base.id=170000000],['oldFloat',d=>d.World.Characters[1].SkinID=1.5],['oldSubtype',d=>d.World.Characters[1].SkinID=170100001],['array',d=>d.World.Characters={}],['schema',d=>d.GameInfo.Version=624]])await deny(n,mutate(f));
  await deny('escapedDuplicate',Buffer.from(raw.toString().replace('"id":10000053','"id":10000053,"\\u0069d":10000053')));await deny('trailing',Buffer.from(raw.toString()+'{}'));
  for(const [i,c,k] of [['0','10000099','170000000'],['1','10000053','170100001'],['2','+10000053','170000000'],['3','10000053','0170000000'],['4','10000053','2147483648']])await deny('selector'+i,raw,c,k);
 });
 await test('4 actual compatible route uniqueness, ID/key and amount/marker constraints',async()=>{
  const edits=[['ambiguous',d=>d.Player.ListInventories[7].CompatibleItemType='ItemType_Skin'],['wrongKey',d=>d.Player.ListInventories[4294967295].ID=7],['noRoute',d=>d.Player.ListInventories[4294967295].CompatibleItemType='ItemType_ActivityItem'],['otherKey',d=>d.Player.ListInventories[4294967295].Inventory[50000001]={Amount:1}],['negative',d=>d.Player.ListInventories[4294967295].Inventory[170000000].Amount=-1],['float',d=>d.Player.ListInventories[4294967295].Inventory[170000000].Amount=1.5],['nullMarker',d=>d.Player.ListInventories[4294967295].Inventory[170000000].Marker=null],['badMarker',d=>d.Player.ListInventories[4294967295].Inventory[170000000].Marker='ItemMarker_!'],['absent',d=>delete d.Player.ListInventories[4294967295].Inventory[170000000]]];for(const [n,f] of edits)await deny(n,mutate(f));
 });
 await test('5 positive inclusive count bounds and overflow',async()=>{
  const b=mutate(d=>{for(let i=0;i<510;i++)d.World.Characters.push({Base:{id:10001000+i}});});assert.equal((await good('512',b)).character.characterId,10000053);
  const d=JSON.parse(b);d.World.Characters.push({Base:{id:10002000}});await deny('513',Buffer.from(JSON.stringify(d)));
  const l=mutate(d=>{for(let i=100;i<226;i++)d.Player.ListInventories[i]={ID:i,CompatibleItemType:'ItemType_ActivityItem',Inventory:{}};});assert.equal((await good('128',l)).skinInventory.inventoryId,4294967295);const x=JSON.parse(l);x.Player.ListInventories[226]={ID:226,CompatibleItemType:'ItemType_ActivityItem',Inventory:{}};await deny('129',Buffer.from(JSON.stringify(x)));
 });
 await test('6 existing V1 and Avatar output, no overwrite, symlink, nonprivate parent, Build/SHA/size',async()=>{
  let x=call([]);assert.equal(x.status,0,x.stderr);const v=JSON.parse(x.stdout);assert.equal(v.contract,'wand.native.private.real-steam-v1@1');assert.equal(Object.hasOwn(v,'character'),false);
  const a=path('avatar');x=call(['--active-avatar-receipt-only','--out',a]);assert.equal(x.status,0,x.stderr);assert.equal(x.stdout,'');const av=JSON.parse(await readFile(a));assert.equal(av.activeBranch,'MaleAvatar');assert.equal(av.maleAvatar.hairColorIndex,0);assert.equal(Object.hasOwn(av,'skinInventory'),false);
  const p=path('sentinel');await writeFile(p,'keep');x=call(args(p));assert.equal(x.status,12);assert.equal(x.stdout,'');assert.equal(await readFile(p,'utf8'),'keep');
  if(process.platform!=='win32'){const l=path('link');await symlink(p,l);x=call(args(l));assert.equal(x.status,12);assert.equal(x.stdout,'');assert.equal(await readFile(p,'utf8'),'keep');const d=join(root,'public');await mkdir(d,{mode:0o755});x=call(args(join(d,'out')));assert.equal(x.status,12);assert.equal(x.stdout,'');}
  for(const [i,e] of [{WAND_LOCAL_ORIGINAL_SHA256:'0'.repeat(64)},{WAND_LOCAL_ORIGINAL_SIZE_BYTES:'134217729'},{WAND_LOCAL_DECODED_SHA256:'c'.repeat(64)},{WAND_LOCAL_INSTALLED_STEAM_FULLVERSION:'9A239D3DB569756D'}].entries())await deny('attest'+i,raw,'10000053','170000000',e);
 });
}finally{await rm(root,{recursive:true,force:true});}
