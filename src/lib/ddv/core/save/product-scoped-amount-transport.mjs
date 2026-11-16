// ACT916 transport over the existing Rust owner. Never construct another
// session, decide eligibility, edit JSON, or expose internal scopes to UI.
const CONTRACT='wand.worker.steam626.scoped-amount@1',OUTPUT='wand.worker.steam626.scoped-amount-output@1';
const SWITCH_CONTRACT='wand.worker.switch626.scoped-chest@1',SWITCH_DISCOVERY='wand.worker.switch626.scoped-chest-discovery@1';
const fail=()=>{throw Error('PRODUCT_SCOPED_AMOUNT_DENIED')};
const sha=v=>typeof v==='string'&&/^[0-9a-f]{64}$/.test(v);
const uint=v=>Number.isSafeInteger(v)&&v>=0&&v<=0xffffffff;
const only=(v,keys)=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join(',')===keys.split(',').sort().join(',');
const digest=async b=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',b)),n=>n.toString(16).padStart(2,'0')).join('');
// Shared existing one-session scoped edit ledger / bounded output transport.
// Domain wrappers select only their fixed ABI and receipt contract. Never UI.
// The owner constructs exactly ONE domain transport for its active Session.
export function createScopedEditLifecycle(wasm,initial,{parse,current,revoke,maxBytes,chunkBytes,contract,stageContract=contract,outputContract,toggleMethod,beginMethod,nextMethod,exactCount=1,expectedProjection=()=>null}){
 if(typeof document!=='undefined'||!wasm||typeof parse!=='function'||typeof current!=='function'||typeof revoke!=='function'||
  !Number.isSafeInteger(maxBytes)||maxBytes<1||maxBytes>128*1024*1024||!Number.isSafeInteger(chunkBytes)||chunkBytes<1||chunkBytes>1024*1024||
  !([1,3,9].includes(exactCount)||(exactCount===7&&contract==='wand.worker.scoped-edit@1'&&stageContract==='wand.worker.switch624.scoped-frp01-exact7@1'&&outputContract==='wand.worker.switch624.scoped-frp01-exact7-output@1'&&toggleMethod==='toggle_switch624_frp01'&&beginMethod==='begin_switch624_frp01_output'&&nextMethod==='next_switch624_frp01_output_chunk')||(exactCount===8&&contract==='wand.worker.scoped-edit@1'&&['wand.worker.steam626.scoped-sr03-mixed-q5@1','wand.worker.switch626.scoped-rm01-mixed-q5@1'].includes(stageContract)&&outputContract==='wand.worker.scoped-edit-output@1'&&toggleMethod==='toggle_scoped_edit'&&beginMethod==='begin_scoped_edit_output'&&nextMethod==='next_scoped_edit_output_chunk'))||typeof expectedProjection!=='function'||typeof wasm[toggleMethod]!=='function'||typeof wasm[beginMethod]!=='function'||typeof wasm[nextMethod]!=='function')fail();
 let scope=initial,ledger=null,consumed=false;
 const ensure=()=>{if(!current()||consumed)fail()};
 const args=()=>[scope.sessionId,BigInt(scope.revision),BigInt(scope.indexGeneration),scope.decodedSha256];
 const checked=fn=>{ensure();try{return fn()}catch{if(current())revoke();fail()}};
 const scopeMatches=r=>r.sessionId===scope.sessionId&&r.decodedSha256===scope.decodedSha256;
 function stageReceipt(raw,applied,expectedContract=contract){
  const r=parse(raw,4096);
  if(!only(r,'contract,sessionId,revision,indexGeneration,decodedSha256,stagedDecodedSha256,operationCount,exactFieldChangedCount,applied,writerAuthorized,originalOverwriteAuthorized')||
   r.contract!==expectedContract||!scopeMatches(r)||r.revision!==scope.revision+1||r.indexGeneration!==scope.indexGeneration+1||
   !sha(r.stagedDecodedSha256)||r.stagedDecodedSha256===scope.decodedSha256||
   (ledger&&r.stagedDecodedSha256!==ledger.stagedDecodedSha256)||(!ledger&&expectedProjection()!==null&&r.stagedDecodedSha256!==expectedProjection())||r.operationCount!==exactCount||r.exactFieldChangedCount!==exactCount||
   r.applied!==applied||r.writerAuthorized!==false||r.originalOverwriteAuthorized!==false)fail();
  scope=Object.freeze({...scope,revision:r.revision,indexGeneration:r.indexGeneration});ledger=Object.freeze(r);
  return Object.freeze({applied,exactFieldChangedCount:exactCount});
 }
 const stage=call=>checked(()=>{if(ledger||typeof call!=='function')fail();return stageReceipt(call(...args()),true,stageContract)});
 const toggle=redo=>checked(()=>{
  if(typeof redo!=='boolean'||!ledger||ledger.applied===redo)fail();
  return stageReceipt(wasm[toggleMethod](redo,...args()),redo);
 });
 async function takeOutput(){
  ensure();let bytes;
  try{
   if(!ledger||!ledger.applied)fail();
   const r=parse(wasm[beginMethod](...args()),4096);
   consumed=true;
   if(!only(r,'contract,decodedBytes,decodedSha256,writerAuthorized,originalOverwriteAuthorized')||
    r.contract!==outputContract||!Number.isSafeInteger(r.decodedBytes)||r.decodedBytes<1||r.decodedBytes>maxBytes||
    r.decodedSha256!==ledger.stagedDecodedSha256||r.writerAuthorized!==false||r.originalOverwriteAuthorized!==false)fail();
   bytes=new Uint8Array(r.decodedBytes);
   for(let at=0;at<bytes.length;){
    if(!current())fail();
    const part=wasm[nextMethod]();
    if(!(part instanceof Uint8Array)||part.length!==Math.min(chunkBytes,bytes.length-at)){
     if(part instanceof Uint8Array)part.fill(0);fail();
    }
    bytes.set(part,at);at+=part.length;part.fill(0);
   }
   if(await digest(bytes)!==r.decodedSha256||!current())fail();
   // Worker-private decoded bytes only for the existing P1G codec.
   const result=Object.freeze({decodedBytes:bytes,decodedSha256:r.decodedSha256});
   // If cleanup fails, the finally block must still wipe the decoded buffer.
   revoke();bytes=null;return result;
  }catch{if(current())revoke();fail()}
  finally{if(bytes)bytes.fill(0)}
 }
 return Object.freeze({checked,args,scopeMatches,scope:()=>scope,stage,toggle,takeOutput,
  hasMutation:()=>ledger!==null||consumed});
}

export function createScopedAmountTransport(wasm,initial,options){
 return createAmountTransport(wasm,initial,options,false);
}
// Explicit trusted Build binding, never schema inference or a UI-selected ABI.
export function createSwitch626ChestTransport(wasm,initial,identity,options){
 if(!identity||identity.platform!=='switch'||identity.buildKind!=='switch-bid'||identity.buildId!=='9A239D3DB569756D'||identity.schema!==626||
  !initial||initial.contract!=='wand.product.single-save-session.boundary@1'||initial.schema!==626||
  initial.revision!==0||initial.indexGeneration!==1||typeof initial.sessionId!=='string'||!(/^[a-f0-9]{32}$/).test(initial.sessionId)||/^0+$/.test(initial.sessionId)||
  !sha(initial.decodedSha256)||initial.productWorkerBound!==true||initial.fullDocumentJsonValidated!==true||
  initial.writerAuthorized!==false||initial.editedCopyAuthorized!==false||initial.applyAuthorized!==false)fail();
 return createAmountTransport(wasm,initial,options,true);
}
export function createSwitch626Catalog0Transport(wasm,initial,identity,options){
 if(!identity||identity.platform!=='switch'||identity.buildKind!=='switch-bid'||identity.buildId!=='9A239D3DB569756D'||identity.schema!==626||
  !initial||initial.contract!=='wand.product.single-save-session.boundary@1'||initial.schema!==626||
  initial.revision!==0||initial.indexGeneration!==1||typeof initial.sessionId!=='string'||!(/^[a-f0-9]{32}$/).test(initial.sessionId)||/^0+$/.test(initial.sessionId)||
  !sha(initial.decodedSha256)||initial.productWorkerBound!==true||initial.fullDocumentJsonValidated!==true||
  initial.writerAuthorized!==false||initial.editedCopyAuthorized!==false||initial.applyAuthorized!==false)fail();
 return createAmountTransport(wasm,initial,options,true,false,true);
}
export function createSteam626ChestTransport(wasm,initial,identity,options){
 if(!identity||identity.platform!=='steam-windows'||identity.buildKind!=='steam-full-version'||identity.buildId!=='releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22'||identity.schema!==626||
  !initial||initial.contract!=='wand.product.single-save-session.boundary@1'||initial.schema!==626||
  initial.revision!==0||initial.indexGeneration!==1||typeof initial.sessionId!=='string'||!(/^[a-f0-9]{32}$/).test(initial.sessionId)||/^0+$/.test(initial.sessionId)||
  !sha(initial.decodedSha256)||initial.productWorkerBound!==true||initial.fullDocumentJsonValidated!==true||
  initial.writerAuthorized!==false||initial.editedCopyAuthorized!==false||initial.applyAuthorized!==false)fail();
 return createAmountTransport(wasm,initial,options,false,true);
}
function createAmountTransport(wasm,initial,{parse,current,revoke,maxBytes,chunkBytes},sw,steamChest=false,catalog=false){
 const chest=(sw&&!catalog)||steamChest;
 const fixedCatalogId=40000076;
 const candidateContract=catalog?'wand.worker.switch626.scoped-catalog0@1':sw?SWITCH_CONTRACT:CONTRACT;
 const discoveryContract=catalog?'wand.worker.switch626.scoped-catalog0-discovery@1':sw?SWITCH_DISCOVERY:'wand.worker.steam626.scoped-amount-discovery@1';
 const discoverMethod=catalog?'discover_switch626_catalog0':sw?'discover_switch626_chest':'discover_scoped_amount';
 const previewMethod=catalog?'preview_switch626_catalog0':sw?'preview_switch626_chest':'preview_scoped_amount';
 const stageMethod=catalog?'stage_switch626_catalog0':sw?'stage_switch626_chest':'stage_scoped_amount';
 const toggleMethod=sw?'toggle_scoped_edit':'toggle_scoped_amount';
 const beginMethod=sw?'begin_scoped_edit_output':'begin_scoped_amount_output';
 const nextMethod=sw?'next_scoped_edit_output_chunk':'next_scoped_amount_output_chunk';
 if(typeof document!=='undefined'||!wasm||typeof parse!=='function'||typeof current!=='function'||typeof revoke!=='function')fail();
 for(const k of [previewMethod,stageMethod,toggleMethod,beginMethod,nextMethod,...((chest||catalog)?[discoverMethod]:[])])
  if(typeof wasm[k]!=='function')fail();
 let preview=null;
 const life=createScopedEditLifecycle(wasm,initial,{parse,current,revoke,maxBytes,chunkBytes,
  contract:sw?'wand.worker.scoped-edit@1':CONTRACT,stageContract:candidateContract,
  outputContract:sw?'wand.worker.scoped-edit-output@1':OUTPUT,toggleMethod,beginMethod,nextMethod});
 const {checked,args,scopeMatches}=life;
 const summary=()=>Object.freeze({profile:preview.profile,id:preview.id,selector:preview.selector,itemId:preview.itemId,
  oldAmount:preview.oldAmount,newAmount:preview.newAmount,scopedCandidate:true,writerAuthorized:false,editedCopyAuthorized:false});
 // PR1311 fixed Worker-private ABI. Only Core may enumerate/accept rows.
 // The existing transport owns scope and revocation; no UI offsets or plans.
 function discoverTargets(profile){
  return checked(()=>{
   if(life.hasMutation()||life.scope().revision!==0||life.scope().indexGeneration!==1||typeof wasm[discoverMethod]!=='function'||
    !(catalog?profile==='catalog0-furniture':chest?profile==='linked-crop-chest48':['linked-crop-chest48','catalog0-furniture'].includes(profile)))fail();
   const targets=[],seen=new Set();
   // One independent profile per discovery: an unrelated inventory failure
   // must not stop an otherwise valid Chest route (and vice versa).
   {
    let offset=0;
    for(let pages=0;;pages++){
     if(pages>=256)fail();
     const r=parse(wasm[discoverMethod](...(sw?[offset]:[profile,offset]),...args()),8192);
     if(!only(r,'contract,profile,sessionId,revision,indexGeneration,decodedSha256,offset,nextOffset,scanned,rows,writerAuthorized,editedCopyAuthorized')||
      r.contract!==discoveryContract||r.profile!==profile||!scopeMatches(r)||
      r.revision!==life.scope().revision||r.indexGeneration!==life.scope().indexGeneration||r.offset!==offset||
      !uint(r.scanned)||r.scanned>16||offset+r.scanned>4096||(offset>0&&r.scanned===0)||
      !(r.nextOffset===null||(r.scanned===16&&r.nextOffset===offset+16&&r.nextOffset<4096))||
      !Array.isArray(r.rows)||r.rows.length>r.scanned||r.writerAuthorized!==false||r.editedCopyAuthorized!==false)fail();
     for(const row of r.rows){
      if(!only(row,'profile,id,selector,itemId,oldAmount')||row.profile!==profile||!uint(row.id)||!uint(row.selector)||
       !uint(row.itemId)||row.itemId===0||!uint(row.oldAmount)||(catalog&&row.itemId!==fixedCatalogId)||
       !(profile==='linked-crop-chest48'?row.id>1&&row.selector<48&&row.oldAmount===50:
        row.id===0&&row.selector===row.itemId&&row.oldAmount>=2&&row.oldAmount<=9999))fail();
      const key=profile+':'+row.id+':'+row.selector;
      if(seen.has(key)||targets.length>=256)fail();
      seen.add(key);targets.push(Object.freeze({...row}));
     }
     if(r.nextOffset===null)break;
     offset=r.nextOffset;
    }
   }
   return Object.freeze(targets);
  });
 }
 function previewTarget(s){
  return checked(()=>{
   if(life.hasMutation()||!only(s,'profile,id,selector,newAmount')||!uint(s.id)||!uint(s.selector)||!uint(s.newAmount)||s.newAmount<1||(chest&&(s.profile!=='linked-crop-chest48'||s.newAmount!==49))||
    (catalog&&(s.profile!=='catalog0-furniture'||s.id!==0||s.selector!==fixedCatalogId||s.newAmount>=9999))||
    !((s.profile==='catalog0-furniture'&&s.id===0&&s.selector>0)||(s.profile==='linked-crop-chest48'&&s.id>1&&s.selector<48)))fail();
   const r=parse(wasm[previewMethod](...(sw?[]:[s.profile]),s.id,s.selector,s.newAmount,...args()),4096);
   if(!only(r,'contract,profile,id,selector,itemId,oldAmount,newAmount,entrySha256,sessionId,revision,indexGeneration,decodedSha256,scopedCandidate,writerAuthorized,editedCopyAuthorized')||
    r.contract!==candidateContract||r.profile!==s.profile||r.id!==s.id||r.selector!==s.selector||r.newAmount!==s.newAmount||
    !uint(r.itemId)||r.itemId===0||(r.profile==='catalog0-furniture'&&r.itemId!==s.selector)||
    !uint(r.oldAmount)||r.oldAmount!==s.newAmount+1||(catalog&&(r.itemId!==fixedCatalogId||r.oldAmount>9999))||!sha(r.entrySha256)||!scopeMatches(r)||
    r.revision!==life.scope().revision||r.indexGeneration!==life.scope().indexGeneration||
    r.scopedCandidate!==true||r.writerAuthorized!==false||r.editedCopyAuthorized!==false)fail();
   preview=Object.freeze(r);return summary();
  });
 }
 const stage=()=>checked(()=>{
  if(!preview||life.hasMutation())fail();
  return Object.freeze({...summary(),...life.stage((...a)=>wasm[stageMethod](...(sw?[]:[preview.profile]),preview.id,preview.selector,preview.oldAmount,preview.newAmount,preview.entrySha256,...a))});
 });
 const toggle=redo=>checked(()=>Object.freeze({...summary(),...life.toggle(redo)}));
 return Object.freeze({discoverTargets,previewTarget,stage,toggle,takeOutput:life.takeOutput,hasMutation:life.hasMutation});
}
