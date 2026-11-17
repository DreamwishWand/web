'use strict';
const a=require('node:assert/strict'),fs=require('node:fs'),{createHash}=require('node:crypto');
const root='/tmp/qrc2034-',sha=b=>createHash('sha256').update(b).digest('hex');
const X=profile=>require(root+profile+'/ddv_save_core.js').WorkerWasmSource;
const methods=profile=>Object.getOwnPropertyNames(X(profile).prototype).filter(n=>!['constructor','free','__destroy_into_raw'].includes(n)).sort();
const wasmExports=profile=>WebAssembly.Module.wasmExports(new WebAssembly.Module(fs.readFileSync(root+profile+'/ddv_save_core_bg.wasm'))).map(x=>x.name);
const method='read_steam626_singlefence_target',wasmMethod='workerwasmsource_'+method;
let base=methods('off'), own=methods('own'),mixed=methods('mixed');
for(const p of ['off','own','mixed']){
  let m=methods(p),ex=wasmExports(p);
  a.equal(new Set(m).size,m.length,'no duplicate JS API');
  a.equal(m.includes(method),p==='own',p+' dedicated JS binding only on own');
  a.equal(ex.includes(wasmMethod),p==='own',p+' dedicated WASM binding only on own');
  a.equal(m.some(s=>s.startsWith('stage_steam626_singlefence')||s.startsWith('begin_steam626_singlefence')||s.startsWith('toggle_steam626_singlefence')||s.startsWith('export_steam626_singlefence')),false,'SingleFence ReadDomain never opens writer');
  console.log('QRC2034_SINGLEFENCE_GENERATED_ABI',p,m.length,ex.length,sha(fs.readFileSync(root+p+'/ddv_save_core_bg.wasm')));
}
a.deepEqual(own.filter(s=>!base.includes(s)),[method],'own-only JS addition exactly one Reader');
a.deepEqual(wasmExports('own').filter(s=>!wasmExports('off').includes(s)),[wasmMethod],'own-only WASM addition exactly one Reader');
a.equal(base.includes(method),false);a.equal(mixed.includes(method),false);
const sourcePath='/tmp/qrc2034-singlefence-fixture.json';
const bytes=fs.readFileSync(sourcePath),originalSHA=sha(bytes),fixture=JSON.parse(bytes);
const {x,y}=JSON.parse(fs.readFileSync('/tmp/qrc2034-singlefence-coords.json'));
a.equal(fixture.GameInfo.Version,626);a.equal(fixture.World.GridCollection.Grids['90001'].NextGridObjectID,50);
const STEAM='releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22';
let nonce=0,positive=0,negative=0;
const mk=(data=bytes,platform='steam-windows',kind='steam-full-version',id=STEAM,schema=626,attested=true)=>{
  const w=new (X('own'))(platform,kind,id,schema,attested,new Uint8Array(32).fill(++nonce));
  w.append_chunk(data);const r=JSON.parse(w.finish());return{w,r};
};
const scope=r=>[r.sessionId,BigInt(r.revision),BigInt(r.indexGeneration),r.decodedSha256];
const get=(w,r,gid=90001,atX=x,atY=y)=>JSON.parse(w[method](gid,atX,atY,...scope(r)));
const deny=(fn,label)=>{a.throws(fn,undefined,label);negative++;};
const withMutated=(modify,label)=>{
  const other=structuredClone(fixture);modify(other);
  let opened;
  try{opened=mk(Buffer.from(JSON.stringify(other)));deny(()=>get(opened.w,opened.r),label);}
  catch(e){if(opened)throw e;negative++;}
  finally{opened?.w?.close();opened?.w?.free();}
};
{
 const {w,r}=mk();const before=JSON.stringify(r);
 const value=get(w,r);positive++;
 a.equal(value.contract,'wand.worker.steam626.singlefence.readonly-target@1');
 a.equal(value.platform,'SteamWindows');a.equal(value.schema,626);a.equal(value.itemId,40700246);
 a.equal(value.gridId,90001);a.equal(value.x,x);a.equal(value.y,y);
 a.equal(value.nextGridObjectId,50);a.equal(value.oldStock,10);a.equal(value.stockDelta,0);
 a.equal(value.readOnly,true);for(const k of ['writerAuthorized','stageAuthorized','editedCopyAuthorized','operationOn','productReadAccepted'])a.equal(value[k],false,k);
 a.equal(value.sessionId,r.sessionId);a.equal(value.decodedSha256,r.decodedSha256);
 a.equal(JSON.stringify(r),before);a.equal(sha(fs.readFileSync(sourcePath)),originalSHA);
 deny(()=>get(w,{...r,revision:r.revision+1}),'stale revision');
 deny(()=>get(w,{...r,indexGeneration:r.indexGeneration+1}),'generation mismatch');
 deny(()=>get(w,{...r,decodedSha256:'f'.repeat(64)}),'source hash mismatch');
 deny(()=>get(w,{...r,sessionId:'f'.repeat(32)}),'forged session ID');
 deny(()=>get(w,{...r,sessionId:'INVALID'}),'bad hex');
 deny(()=>get(w,r,90000),'foreign grid');
 deny(()=>get(w,r,90001,x+1,y),'wrong geometry x');
 deny(()=>get(w,r,90001,392,y),'outside bounds');
 deny(()=>w.append_chunk(bytes),'double append after finish');
 deny(()=>w.finish(),'double finish');
 a.equal(typeof w.stage_steam626_singlefence_target,'undefined');
 a.equal(typeof w.begin_steam626_singlefence_output,'undefined');
 w.close();deny(()=>get(w,r),'closed session');w.free();
}
const denyBuild=(platform,kind,id,schema,attested,label)=>{
  let w;
  try{const res=mk(bytes,platform,kind,id,schema,attested);w=res.w;deny(()=>get(res.w,res.r),label);}
  catch(e){if(w)throw e;negative++;}
  finally{w?.close();w?.free();}
};
denyBuild('switch','switch-bid','9A239D3DB569756D',626,true,'foreign Switch');
denyBuild('steam-windows','steam-full-version','WRONG-STEAM626',626,true,'wrong Steam Build');
denyBuild('steam-windows','steam-full-version',STEAM,625,true,'wrong schema');
denyBuild('steam-windows','steam-full-version',STEAM,626,false,'unattested Build');
denyBuild('steam-windows','switch-bid',STEAM,626,true,'wrong Build kind');
withMutated(d=>{d.Player.ListInventories['0'].Inventory['40700246'].Amount=1;},'insufficient Favorite');
withMutated(d=>{d.Player.ListInventories['0'].Inventory['40700246'].Marker='ItemMarker_None';},'non-favorite stock');
withMutated(d=>{d.Player.ListInventories['0'].Inventory['40700246'].Amount=10000;},'out of stock bounds');
withMutated(d=>{delete d.Player.ListInventories['0'].Inventory['40700246'];},'absent Catalog target');
withMutated(d=>{d.Player.ListInventories['0'].CompatibleItemType='ItemType_Clothing';},'bad inventory route');
withMutated(d=>{d.World.GridCollection.Grids['90001'].Objects['10'].X=x;d.World.GridCollection.Grids['90001'].Objects['10'].Y=y;},'occupied placement');
withMutated(d=>{d.World.GridCollection.Grids['90001'].NextGridObjectID=2147483647;},'counter overflow');
withMutated(d=>{d.Unknown={GridID:90001,ObjectID:50};},'foreign saved reference');
withMutated(d=>{d.World.Villages[0].Areas['2'].Unlocked=false;},'locked Area');
withMutated(d=>{d.World.GridCollection.Grids['90001'].GridDataPath='Untrusted-path';},'altered grid');
a.equal(sha(fs.readFileSync(sourcePath)),originalSHA,'never mutate original fixture');
console.log('QRC2034_SINGLEFENCE_GENERATED_ACTUAL_PASS',positive+'POS',negative+'NEG','ONLY_READER','NO_STAGE_OR_EXPORT',originalSHA);
