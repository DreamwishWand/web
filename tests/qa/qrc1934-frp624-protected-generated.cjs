'use strict';
const a=require('node:assert/strict'),fs=require('node:fs'),cp=require('node:child_process'),{createHash}=require('node:crypto');
const sha=b=>createHash('sha256').update(b).digest('hex'),root='/tmp/qrc1934-';
const cls=m=>require(root+m+'/ddv_save_core.js').WorkerWasmSource;
const methods=m=>Object.getOwnPropertyNames(cls(m).prototype).filter(x=>!['constructor','free','__destroy_into_raw'].includes(x)).sort();
const wasm=m=>WebAssembly.Module.exports(new WebAssembly.Module(fs.readFileSync(root+m+'/ddv_save_core_bg.wasm'))).map(x=>x.name);
const five=['preview_switch624_frp01','stage_switch624_frp01','toggle_switch624_frp01','begin_switch624_frp01_output','next_switch624_frp01_output_chunk'];
for(const m of ['off','own','mixed']){
 const n=methods(m),ex=wasm(m);
 a.equal(new Set(n).size,n.length);
 if(m==='off'){a.equal(n.length,8,'OFF exact JS surface');a.equal(ex.length,17,'OFF exact WASM surface');}
 if(m==='own'){a.equal(n.length,15,'PROTECTED own exact JS15');a.equal(ex.length,24,'PROTECTED own exact WASM24');}
 if(m==='mixed'){a.ok(n.length>=8 && ex.length>=17,'mixed profile preserves base');}
 for(const name of ['stage_amount','preview_amount','begin_amount_output'])a.equal(n.includes(name),false,m+' unauthorized generic amount alias '+name);
 a.deepEqual(five.filter(k=>n.includes(k)).sort(),m==='own'?[...five].sort():[],m);
 for(const k of five)a.equal(ex.includes('workerwasmsource_'+k),m==='own',m+' '+k);
 console.log('QRC1934_GENERATED_ABI_CENSUS',m,n.length,ex.length,sha(fs.readFileSync(root+m+'/ddv_save_core_bg.wasm')));
}
const source=fs.readFileSync('/tmp/qrc1934-frp624-source.json'),sourceSHA=sha(source),orig=JSON.parse(source),X=cls('own');
a.equal(orig.GameInfo.Version,624);a.equal(orig.World.GridCollection.Grids['90001'].NextGridObjectID,50);
let nonce=0;function fresh(platform='switch',kind='switch-bid',bid='52BD625D9B4E0053',schema=624){
 const w=new X(platform,kind,bid,schema,true,new Uint8Array(32).fill(++nonce));w.append_chunk(source);return w;
}
const sc=r=>[r.sessionId,BigInt(r.revision),BigInt(r.indexGeneration),r.decodedSha256];
let neg=0;function deny(f,label){a.throws(f,undefined,label);neg++;}
{
 const w=fresh();deny(()=>w.preview_switch624_frp01(90001,10,11,12,'0'.repeat(32),0n,0n,'0'.repeat(64)),'not admitted');w.close();w.free();
 const q=fresh('switch','switch-bid','9A239D3DB569756D',626);deny(()=>q.finish_switch624_frp01_readonly(),'wrong Build');q.close();q.free();
 const f=fresh('steam-windows','steam-full-version','fake-build',624);deny(()=>f.finish_switch624_frp01_readonly(),'foreign');f.close();f.free();
 const g=fresh();deny(()=>g.finish(),'generic admission');g.close();g.free();
}
const w=fresh(),r=JSON.parse(w.finish_switch624_frp01_readonly());
a.equal(r.schema,624);a.equal(r.decodedSha256,sourceSHA);
for(const k of ['writerAuthorized','editedCopyAuthorized','applyAuthorized','productReadAccepted'])a.equal(r[k],false,k);
const p=JSON.parse(w.preview_switch624_frp01(90001,10,11,12,...sc(r)));
a.equal(p.contract,'wand.worker.switch624.scoped-frp01-exact7@1');
a.equal(p.exactFieldChangedCount,7);a.equal(p.inventoryDelta,0);
a.equal(p.nextGridObjectId,50);a.equal(p.oldStock,10);a.equal(p.newStock,20);a.equal(p.oldRowsSha256.length,3);
for(const k of ['writerAuthorized','editedCopyAuthorized','originalOverwriteAuthorized','productReadAccepted'])a.equal(p[k],false,k);
const args=[90001,10,11,12,p.nextGridObjectId,p.oldStock,p.newStock,p.rootSha256,p.gridSha256,p.counterSha256,
 p.housesSha256,p.oldStockSha256,p.newStockSha256,p.oldRowsSha256.join(''),p.projectedDecodedSha256];
const stage=(v=args,e=r,inst=w)=>JSON.parse(inst.stage_switch624_frp01(...v,...sc(e)));
for(const i of [7,8,9,10,11,12,13,14]){const v=args.slice();v[i]='0'.repeat(i===13?192:64);deny(()=>stage(v),'SHA CAS '+i);}
for(const i of [0,1,2,3,4,5,6]){const v=args.slice();v[i]++;deny(()=>stage(v),'target CAS '+i);}
deny(()=>stage(args,{...r,sessionId:'0'.repeat(32)}),'session');
deny(()=>stage(args,{...r,revision:r.revision+1}),'revision');
deny(()=>stage(args,{...r,indexGeneration:r.indexGeneration+1}),'generation');
deny(()=>stage(args,{...r,decodedSha256:'0'.repeat(64)}),'sourceSHA');
const q=fresh(),qr=JSON.parse(q.finish_switch624_frp01_readonly());
deny(()=>stage(args,r,q),'cross-session');q.close();q.free();
deny(()=>w.begin_switch624_frp01_output(...sc(r)),'pre-Stage export');
const staged=stage();a.equal(staged.contract,p.contract);a.equal(staged.operationCount,7);a.equal(staged.exactFieldChangedCount,7);
a.equal(staged.applied,true);a.equal(staged.writerAuthorized,false);a.equal(staged.originalOverwriteAuthorized,false);
deny(()=>stage(),'replay');
const u=JSON.parse(w.toggle_switch624_frp01(false,...sc(staged)));a.equal(u.applied,false);
deny(()=>w.begin_switch624_frp01_output(...sc(u)),'undone export');
const v=JSON.parse(w.toggle_switch624_frp01(true,...sc(u)));a.equal(v.applied,true);
const info=JSON.parse(w.begin_switch624_frp01_output(...sc(v)));
a.equal(info.contract,'wand.worker.switch624.scoped-frp01-exact7-output@1');
a.equal(info.writerAuthorized,false);a.equal(info.originalOverwriteAuthorized,false);
deny(()=>w.begin_switch624_frp01_output(...sc(v)),'duplicate begin');
const out=Buffer.from(w.next_switch624_frp01_output_chunk());
a.equal(out.length,info.decodedBytes);a.equal(sha(out),info.decodedSha256);
a.equal(sha(out),staged.stagedDecodedSha256);deny(()=>w.next_switch624_frp01_output_chunk(),'duplicate chunk');
a.equal(sha(fs.readFileSync('/tmp/qrc1934-frp624-source.json')),sourceSHA);
const expected=structuredClone(orig),grid=expected.World.GridCollection.Grids['90001'],first=grid.Objects['10'];
grid.NextGridObjectID=53;for(const i of ['10','11','12'])delete grid.Objects[i];
for(const [id,item,dy,left] of [[50,40700268,0,false],[51,40700269,2,true],[52,40700268,4,false]])
 grid.Objects[id]={ID:id,ItemID:item,X:first.X,Y:first.Y+dy,Orientation:left?'GridOrientation_Left':'GridOrientation_Down',State:null};
a.deepEqual(JSON.parse(out),expected,'exact7 only');
w.close();w.free();
const path='/tmp/qrc1934-editedcopy.json';fs.writeFileSync(path,out,{flag:'wx',mode:0o600});
const child="const a=require('node:assert/strict'),fs=require('node:fs'),{createHash}=require('node:crypto');const b=fs.readFileSync(process.argv[1]);const {WorkerWasmSource}=require('/tmp/qrc1934-own/ddv_save_core.js');const w=new WorkerWasmSource('switch','switch-bid','52BD625D9B4E0053',624,true,new Uint8Array(32).fill(51));w.append_chunk(b);const r=JSON.parse(w.finish_switch624_frp01_readonly());a.equal(r.decodedSha256,process.argv[2]);a.equal(r.schema,624);a.equal(createHash('sha256').update(b).digest('hex'),process.argv[2]);a.equal(r.writerAuthorized,false);w.close();w.free();";
cp.execFileSync(process.execPath,['-e',child,path,sha(out)],{stdio:'inherit'});
console.log('QRC1934_GENERATED_FRP624_ABI_ACTUAL_PASS','1POS',neg+'NEG','EXACT7','INDEPENDENT_REOPEN',sha(out),'ORIGINAL',sourceSHA);
