'use strict';
const a=require('node:assert/strict'),fs=require('node:fs'),cp=require('node:child_process'),{createHash}=require('node:crypto');
const sha=b=>createHash('sha256').update(b).digest('hex'),root='/tmp/qrc2006-';
const BID='releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22';
const cls=m=>require(root+m+'/ddv_save_core.js').WorkerWasmSource;
const methods=m=>Object.getOwnPropertyNames(cls(m).prototype).filter(k=>!['constructor','free','__destroy_into_raw'].includes(k)).sort();
const wasmExports=m=>WebAssembly.Module.exports(new WebAssembly.Module(fs.readFileSync(root+m+'/ddv_save_core_bg.wasm'))).map(k=>k.name);
const five=['preview_steam626_makeup_color1','stage_steam626_makeup_color1','toggle_steam626_makeup_color1','begin_steam626_makeup_color1_output','next_steam626_makeup_color1_output_chunk'];
for(const mode of ['off','own','mixed']){
 const names=methods(mode),wasm=wasmExports(mode);
 a.equal(new Set(names).size,names.length);
 for(const f of five){
  a.equal(names.includes(f),mode==='own',mode+' JS '+f);
  a.equal(wasm.includes('workerwasmsource_'+f),mode==='own',mode+' WASM '+f);
 }
 console.log('QRC2006_GENERATED_CENSUS',mode,names.length,wasm.length,sha(fs.readFileSync(root+mode+'/ddv_save_core_bg.wasm')));
}
a.deepEqual(methods('own').filter(k=>!methods('off').includes(k)).sort(),five.slice().sort(),'Makeup own-only API has no unrelated JS exports');
const raw=fs.readFileSync('/tmp/qrc2006-makeup-source.json'),initialHash=sha(raw),d=JSON.parse(raw),W=cls('own');
a.equal(d.GameInfo.Version,626);
a.equal(d.Player.MaleAvatar.Makeup['1'].ColorIndex1,53);
a.equal(d.Player.FemaleAvatar.Makeup['1'].ColorIndex1,60);
a.equal(d.Player.MaleAvatar.Makeup['1'].MakeupItemID,140100014);
a.equal(d.Player.FemaleAvatar.Makeup['1'].MakeupItemID,140100011,'physical inactive female owns different item');
for(const side of ['MaleAvatar','FemaleAvatar']){
 a.equal(d.Player[side].Makeup['1'].ColorIndex2,0,'physical saved C2 zero');
 a.equal(d.Player[side].Makeup['1'].ColorIndex3,0,'physical saved C3 zero');
}
a.equal(d.Player.ListInventories['3'].Inventory['140100014'].Amount,2);
a.equal(d.Player.ListInventories['3'].Inventory['140100011'].Amount,1);
a.equal(d.World.UnknownNotEdited.keep[0],true);
let nonce=0;
const create=(platform='steam-windows',kind='steam-full-version',bid=BID,schema=626)=>{
 const w=new W(platform,kind,bid,schema,true,new Uint8Array(32).fill(++nonce));
 w.append_chunk(raw);return w;
};
const scope=r=>[r.sessionId,BigInt(r.revision),BigInt(r.indexGeneration),r.decodedSha256];
let neg=0;
const deny=(f,label)=>{a.throws(f,undefined,label);neg++;};
{
 const denyWrongBuild=(platform,kind,bid,label)=>{
  const w=create(platform,kind,bid);
  let r;
  try {r=JSON.parse(w.finish());}
  catch(e){a.match(String(e),/EXACT_BUILD_ID_MISMATCH|BUILD_IDENTITY_NOT_ATTESTED|BUILD_PLATFORM_MISMATCH|EXACT_WORKER_BUILD_REQUIRED/);neg++;w.close();w.free();return;}
  deny(()=>w.preview_steam626_makeup_color1(...scope(r)),label);
  w.close();w.free();
 };
 denyWrongBuild('switch','switch-bid','9A239D3DB569756D','foreign Build');
 denyWrongBuild('steam-windows','steam-full-version','invalid-build','wrong Steam Build');
}
// Changed-only real physical saved shape negatives. Admission reject OR typed preview reject is fail-closed.
const badShape=[
 ['wrong female item',x=>x.Player.FemaleAvatar.Makeup['1'].MakeupItemID=140100014],
 ['wrong male item',x=>x.Player.MaleAvatar.Makeup['1'].MakeupItemID=140100011],
 ['male C2 definition -1',x=>x.Player.MaleAvatar.Makeup['1'].ColorIndex2=-1],
 ['male C3 nonzero',x=>x.Player.MaleAvatar.Makeup['1'].ColorIndex3=1],
 ['female C2 definition -1',x=>x.Player.FemaleAvatar.Makeup['1'].ColorIndex2=-1],
 ['female C3 nonzero',x=>x.Player.FemaleAvatar.Makeup['1'].ColorIndex3=1],
 ['male old scalar stale',x=>x.Player.MaleAvatar.Makeup['1'].ColorIndex1=52],
 ['female inactive scalar wrong',x=>x.Player.FemaleAvatar.Makeup['1'].ColorIndex1=59],
 ['active selected stock zero',x=>x.Player.ListInventories['3'].Inventory['140100014'].Amount=0],
 ['inactive saved stock zero',x=>x.Player.ListInventories['3'].Inventory['140100011'].Amount=0],
 ['wrong selected Marker',x=>x.Player.ListInventories['3'].Inventory['140100014'].Marker='ItemMarker_Favorite'],
 ['wrong Route3 type',x=>x.Player.ListInventories['3'].CompatibleItemType='ItemType_ActivityItem'],
 ['female active',x=>x.Player.AvatarIsMale=false],
 ['remove female owned item',x=>delete x.Player.ListInventories['3'].Inventory['140100011']],
];
for(const [name,change] of badShape){
 const broken=structuredClone(d);change(broken);
 const x=new W('steam-windows','steam-full-version',BID,626,true,new Uint8Array(32).fill(++nonce));
 x.append_chunk(Buffer.from(JSON.stringify(broken)));
 try{
  let receipt;
  try{receipt=JSON.parse(x.finish());}
  catch(err){
   a.match(String(err),/EXACT|MAKEUP|SOURCE|INVENTORY|ROUTE|SAVED|BUILD|INVALID|CORE|REJECT|DENIED|Error/i,name+' admission fail-closed');
   neg++;continue;
  }
  deny(()=>x.preview_steam626_makeup_color1(...scope(receipt)),'physical saved-shape '+name);
 }finally{x.close();x.free();}
}
const w=create(),r=JSON.parse(w.finish());
a.equal(r.schema,626);a.equal(r.decodedSha256,initialHash);
for(const f of ['writerAuthorized','editedCopyAuthorized','applyAuthorized','productReadAccepted'])a.equal(r[f],false,f);
const p=JSON.parse(w.preview_steam626_makeup_color1(...scope(r)));
a.equal(p.contract,'wand.worker.steam626.makeup-color1-exact1@1');
a.equal(p.makeupItemId,140100014);a.equal(p.slot,1);
a.equal(p.field,'ColorIndex1');a.equal(p.oldColorIndex,53);a.equal(p.newColorIndex,60);
a.equal(p.exactFieldChangedCount,1);a.equal(p.inventoryDelta,0);
for(const f of ['writerAuthorized','editedCopyAuthorized','originalOverwriteAuthorized'])a.equal(p[f],false,f);
const args=[p.tokenSha256,p.entrySha256,p.femaleSha256,p.maleSha256,p.routesSha256,p.projectedDecodedSha256];
const stage=(arr=args,receipt=r,instance=w)=>JSON.parse(instance.stage_steam626_makeup_color1(...arr,...scope(receipt)));
for(let i=0;i<6;i++){const bad=args.slice();bad[i]='0'.repeat(64);deny(()=>stage(bad),'hash '+i);}
deny(()=>stage(args,{...r,sessionId:'0'.repeat(32)}),'session');
deny(()=>stage(args,{...r,revision:r.revision+1}),'revision');
deny(()=>stage(args,{...r,indexGeneration:r.indexGeneration+1}),'generation');
deny(()=>stage(args,{...r,decodedSha256:'0'.repeat(64)}),'source hash');
const q=create(),qr=JSON.parse(q.finish());
deny(()=>stage(args,r,q),'foreign session');q.close();q.free();
deny(()=>w.begin_steam626_makeup_color1_output(...scope(r)),'uncommitted export');
deny(()=>w.toggle_steam626_makeup_color1(false,...scope(r)),'uncommitted undo');
const st=stage();a.equal(st.contract,p.contract);
a.equal(st.operationCount,1);a.equal(st.exactFieldChangedCount,1);
a.equal(st.applied,true);a.equal(st.writerAuthorized,false);a.equal(st.originalOverwriteAuthorized,false);
deny(()=>stage(),'replay');
deny(()=>w.preview_steam626_makeup_color1(...scope(st)),'stage-then-preview');
const u=JSON.parse(w.toggle_steam626_makeup_color1(false,...scope(st)));
a.equal(u.applied,false);
deny(()=>w.begin_steam626_makeup_color1_output(...scope(u)),'undone export');
const v=JSON.parse(w.toggle_steam626_makeup_color1(true,...scope(u)));
a.equal(v.applied,true);
const info=JSON.parse(w.begin_steam626_makeup_color1_output(...scope(v)));
a.equal(info.contract,'wand.worker.steam626.makeup-color1-exact1-output@1');
a.equal(info.writerAuthorized,false);a.equal(info.originalOverwriteAuthorized,false);
deny(()=>w.begin_steam626_makeup_color1_output(...scope(v)),'double begin');
const out=Buffer.from(w.next_steam626_makeup_color1_output_chunk());
a.equal(sha(out),info.decodedSha256);a.equal(out.length,info.decodedBytes);
a.equal(sha(out),st.stagedDecodedSha256);
deny(()=>w.next_steam626_makeup_color1_output_chunk(),'double chunk');
const wanted=structuredClone(d);wanted.Player.MaleAvatar.Makeup['1'].ColorIndex1=60;
a.deepEqual(JSON.parse(out),wanted,'only fixed scalar edits');
a.equal(sha(fs.readFileSync('/tmp/qrc2006-makeup-source.json')),initialHash);
w.close();w.free();
const path='/tmp/qrc2006-makeup-output.json';
fs.writeFileSync(path,out,{flag:'wx',mode:0o600});
const child="const a=require('node:assert/strict'),fs=require('node:fs'),{createHash}=require('node:crypto');const b=fs.readFileSync(process.argv[1]);const W=require('/tmp/qrc2006-own/ddv_save_core.js').WorkerWasmSource;const w=new W('steam-windows','steam-full-version',process.argv[3],626,true,new Uint8Array(32).fill(77));w.append_chunk(b);const r=JSON.parse(w.finish());a.equal(r.schema,626);a.equal(r.decodedSha256,process.argv[2]);a.equal(createHash('sha256').update(b).digest('hex'),process.argv[2]);a.equal(r.writerAuthorized,false);w.close();w.free();";
cp.execFileSync(process.execPath,['-e',child,path,sha(out),BID],{stdio:'inherit'});
console.log('QRC2006_CORRECTED_GENERATED_ABI_ACTUAL_PASS','1POS',neg+'NEG','EXACT1','INDEPENDENT_REOPEN',sha(out),'ORIGINAL',initialHash,'REAL_SAVED_SHAPE_SYNTHETIC_NOT_ENCRYPTED_PRODUCT_V2');
