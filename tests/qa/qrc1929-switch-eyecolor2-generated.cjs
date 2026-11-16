'use strict';
const a=require('node:assert/strict'),fs=require('node:fs'),cp=require('node:child_process'),{createHash}=require('node:crypto');
const sha=b=>createHash('sha256').update(b).digest('hex');
const root='/tmp/qrc1929-',BID='9A239D3DB569756D';
const cls=m=>require(root+m+'/ddv_save_core.js').WorkerWasmSource;
const methods=m=>Object.getOwnPropertyNames(cls(m).prototype).filter(k=>!['constructor','free','__destroy_into_raw'].includes(k)).sort();
const wasmMethods=m=>WebAssembly.Module.exports(new WebAssembly.Module(fs.readFileSync(root+m+'/ddv_save_core_bg.wasm'))).map(x=>x.name);
const five=['preview_switch626_eyecolor2','stage_switch626_eyecolor2','toggle_switch626_eyecolor2','begin_switch626_eyecolor2_output','next_switch626_eyecolor2_output_chunk'];
for(const m of ['off','own','mixed']){
 const names=methods(m),wasm=wasmMethods(m);
 a.equal(new Set(names).size,names.length);
 for(const f of five){
  a.equal(names.includes(f),m==='own',m+' JS '+f);
  a.equal(wasm.includes('workerwasmsource_'+f),m==='own',m+' WASM '+f);
 }
 console.log('QRC1929_GENERATED_ABI_CENSUS',m,names.length,wasm.length,sha(fs.readFileSync(root+m+'/ddv_save_core_bg.wasm')));
}
const source=fs.readFileSync('/tmp/qrc1929-eyecolor2-source.json'),originalHash=sha(source),initial=JSON.parse(source),W=cls('own');
a.equal(initial.GameInfo.Version,626);a.equal(initial.Player.MaleAvatar.Eyeball.ColorIndex2,64);
a.equal(initial.Player.FemaleAvatar.Eyeball.ColorIndex2,69);
let nonce=0;
const create=(platform='switch',kind='switch-bid',bid=BID,schema=626)=>{
 const w=new W(platform,kind,bid,schema,true,new Uint8Array(32).fill(++nonce));w.append_chunk(source);return w;
};
const scope=r=>[r.sessionId,BigInt(r.revision),BigInt(r.indexGeneration),r.decodedSha256];
let neg=0;const deny=(cb,label)=>{a.throws(cb,undefined,label);neg++;};
const denyWrongBuild=(platform,kind,bid,label)=>{
 const w=create(platform,kind,bid);let receipt;
 try{receipt=JSON.parse(w.finish());}
 catch(err){a.ok(String(err).length>0,label);neg++;w.close();w.free();return;}
 deny(()=>w.preview_switch626_eyecolor2(...scope(receipt)),label);
 w.close();w.free();
};
denyWrongBuild('steam-windows','steam-full-version','releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22','Steam denied');
denyWrongBuild('switch','switch-bid','bad-bid','wrong Switch denied');
const w=create(),r=JSON.parse(w.finish());
a.equal(r.schema,626);a.equal(r.decodedSha256,originalHash);
for(const f of ['writerAuthorized','editedCopyAuthorized','applyAuthorized'])a.equal(r[f],false,f);
const p=JSON.parse(w.preview_switch626_eyecolor2(...scope(r)));
a.equal(p.contract,'wand.worker.switch626.eyecolor2-exact1@1');
a.equal(p.eyeballItemId,70000010);a.equal(p.field,'ColorIndex2');
a.equal(p.oldColorIndex,64);a.equal(p.newColorIndex,69);
a.equal(p.exactFieldChangedCount,1);a.equal(p.inventoryDelta,0);
for(const f of ['writerAuthorized','editedCopyAuthorized','originalOverwriteAuthorized','productReadAccepted'])a.equal(p[f],false,f);
const args=[p.activeEyeSha256,p.inactiveEyeSha256,p.maleSha256,p.femaleSha256,p.stockEntrySha256,p.routeSha256,p.selectedTokenSha256,p.projectedDecodedSha256];
const stage=(values=args,receipt=r,worker=w)=>JSON.parse(worker.stage_switch626_eyecolor2(...values,...scope(receipt)));
for(let i=0;i<args.length;i++){
 const values=args.slice();values[i]='0'.repeat(64);deny(()=>stage(values),'fixed SHA CAS '+i);
}
deny(()=>stage(args,{...r,sessionId:'0'.repeat(32)}),'session');
deny(()=>stage(args,{...r,revision:r.revision+1}),'revision');
deny(()=>stage(args,{...r,indexGeneration:r.indexGeneration+1}),'generation');
deny(()=>stage(args,{...r,decodedSha256:'0'.repeat(64)}),'decoded SHA');
const x=create();const xr=JSON.parse(x.finish());
deny(()=>stage(args,r,x),'foreign session');x.close();x.free();
deny(()=>w.begin_switch626_eyecolor2_output(...scope(r)),'export before Stage');
deny(()=>w.toggle_switch626_eyecolor2(false,...scope(r)),'Undo before Stage');
const staged=stage();
a.equal(staged.contract,p.contract);a.equal(staged.operationCount,1);a.equal(staged.exactFieldChangedCount,1);
a.equal(staged.applied,true);a.equal(staged.writerAuthorized,false);a.equal(staged.originalOverwriteAuthorized,false);
deny(()=>stage(),'replay');
deny(()=>w.preview_switch626_eyecolor2(...scope(staged)),'preview after stage');
const undone=JSON.parse(w.toggle_switch626_eyecolor2(false,...scope(staged)));
a.equal(undone.applied,false);
deny(()=>w.begin_switch626_eyecolor2_output(...scope(undone)),'undone export');
const redone=JSON.parse(w.toggle_switch626_eyecolor2(true,...scope(undone)));
a.equal(redone.applied,true);
const output=JSON.parse(w.begin_switch626_eyecolor2_output(...scope(redone)));
a.equal(output.contract,'wand.worker.switch626.eyecolor2-exact1-output@1');
a.equal(output.writerAuthorized,false);a.equal(output.originalOverwriteAuthorized,false);
deny(()=>w.begin_switch626_eyecolor2_output(...scope(redone)),'second export begin');
const bytes=Buffer.from(w.next_switch626_eyecolor2_output_chunk());
a.equal(bytes.length,output.decodedBytes);a.equal(sha(bytes),output.decodedSha256);
a.equal(sha(bytes),staged.stagedDecodedSha256);
deny(()=>w.next_switch626_eyecolor2_output_chunk(),'second output chunk');
const expected=structuredClone(initial);expected.Player.MaleAvatar.Eyeball.ColorIndex2=69;
a.deepEqual(JSON.parse(bytes),expected,'only one exact changed existing color field');
a.equal(sha(fs.readFileSync('/tmp/qrc1929-eyecolor2-source.json')),originalHash);
w.close();w.free();
const outputPath='/tmp/qrc1929-eyecolor2-edited.json';fs.writeFileSync(outputPath,bytes,{flag:'wx',mode:0o600});
const child="const a=require('node:assert/strict'),fs=require('node:fs'),{createHash}=require('node:crypto');const b=fs.readFileSync(process.argv[1]),W=require('/tmp/qrc1929-own/ddv_save_core.js').WorkerWasmSource;const w=new W('switch','switch-bid',process.argv[3],626,true,new Uint8Array(32).fill(88));w.append_chunk(b);const r=JSON.parse(w.finish());a.equal(r.schema,626);a.equal(r.decodedSha256,process.argv[2]);a.equal(createHash('sha256').update(b).digest('hex'),process.argv[2]);a.equal(r.writerAuthorized,false);w.close();w.free();";
cp.execFileSync(process.execPath,['-e',child,outputPath,sha(bytes),BID],{stdio:'inherit'});
console.log('QRC1929_EYECOLOR2_GENERATED_ABI_ACTUAL_PASS','1POS',neg+'NEG','EXACT1','INDEPENDENT_REOPEN',sha(bytes),'ORIGINAL',originalHash);
