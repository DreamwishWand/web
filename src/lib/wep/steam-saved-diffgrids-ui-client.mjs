// 08 WEB: a page never receives Rust SessionID/Cursor/SHA, decoded JSON or
// ObjectID arrays. This client is an unprivileged UI selection-epoch transport.
export const READONLY_DIFFGRIDS_UI_CONTRACT='wand.local.encrypted-steam-p1g.stored-diffgrids-readonly@1';
export const STEAM_FULL_VERSION='releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22';
const SHA=/^[0-9a-f]{64}$/;
const isRecord=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const idOk=x=>(Number.isSafeInteger(x)&&x>=0)||(typeof x==='string'&&/^(?:0|[1-9][0-9]{0,15})$/.test(x));
const fieldKeys=['gridId','defaultLayoutGridId','defaultGridHashCode','defaultGridDataHashCode',
 'modifiedObjectCount','removedObjectCount','modifiedRemovedSameIdPairs',
 'externalLayoutStatus','nativeEffectiveGridVerified'];
const fieldsOk=r=>isRecord(r)&&Object.keys(r).sort().join(',')===fieldKeys.slice().sort().join(',')&&
 idOk(r.gridId)&&
 (r.defaultLayoutGridId===null||idOk(r.defaultLayoutGridId))&&
 [r.modifiedObjectCount,r.removedObjectCount,r.modifiedRemovedSameIdPairs].every(x=>Number.isSafeInteger(x)&&x>=0&&x<=2048)&&
 r.modifiedRemovedSameIdPairs<=Math.min(r.modifiedObjectCount,r.removedObjectCount)&&
 r.externalLayoutStatus==='UNRESOLVED_EXTERNAL_LAYOUT'&&r.nativeEffectiveGridVerified===false;
const fail=()=>{throw Error('DIFFGRIDS_UI_FAILED_CLOSED')};
const only=(record,names)=>isRecord(record)&&
 Object.keys(record).sort().join(',')===names.split(',').sort().join(',');
const OPEN_FIELDS='contract,selection,recordCount,maxRecordsPerPage,nextPageIndex,sourceShaMatched,originalSizeMatched,externallyObservedSteamFullVersion,physicalBuildCryptographicallyVerified,fullDocumentValidated,externalLayoutStatus,allNativeReferencesVerified,productReadAccepted,nativeV3Verified,writerAuthorized,applyAuthorized,cloudUploadPerformed,originalFileModified';
const PAGE_FIELDS='contract,selection,pageIndex,records,nextPageIndex,externalLayoutStatus,allNativeReferencesVerified,productReadAccepted,nativeV3Verified,writerAuthorized,applyAuthorized,cloudUploadPerformed';
const statusOk=s=>isRecord(s)&&s.contract===READONLY_DIFFGRIDS_UI_CONTRACT&&
 s.externalLayoutStatus==='UNRESOLVED_EXTERNAL_LAYOUT'&&
 s.productReadAccepted===false&&s.writerAuthorized===false&&
 s.allNativeReferencesVerified===false&&s.nativeV3Verified===false&&
 s.applyAuthorized===false&&s.cloudUploadPerformed===false;
const openOk=s=>only(s,OPEN_FIELDS)&&statusOk(s)&&Number.isSafeInteger(s.selection)&&s.selection>=1&&
 Number.isSafeInteger(s.recordCount)&&s.recordCount>=0&&s.recordCount<=50000&&
 s.maxRecordsPerPage===8&&s.nextPageIndex===0&&
 s.sourceShaMatched===true&&s.originalSizeMatched===true&&
 s.externallyObservedSteamFullVersion===true&&s.physicalBuildCryptographicallyVerified===false&&
 s.fullDocumentValidated===true&&s.originalFileModified===false;
const pageOk=(s,selection,index)=>only(s,PAGE_FIELDS)&&statusOk(s)&&s.selection===selection&&
 s.pageIndex===index&&Array.isArray(s.records)&&s.records.length<=8&&
 s.records.every(fieldsOk)&&
 (s.nextPageIndex===null||s.nextPageIndex===index+1);
const output=r=>Object.freeze({
 gridId:String(r.gridId),
 modifiedObjectCount:r.modifiedObjectCount,
 removedObjectCount:r.removedObjectCount,
 modifiedRemovedSameIdPairs:r.modifiedRemovedSameIdPairs,
 externalLayoutStatus:'UNRESOLVED_EXTERNAL_LAYOUT'
});
export function createSavedDiffGridsUiClient(workerFactory){
 if(typeof workerFactory!=='function')fail();
 let worker,ready=false,epoch=0,seq=0,selection=null,openRequestId=null,
   nextIndex=null,total=null,countSeen=0,terminated=false;
 const waiting=new Map(),listeners=new Set();
 const notify=state=>{for(const listener of listeners)listener(state)};
 const clear=()=>{
   epoch++;selection=null;nextIndex=null;total=null;countSeen=0;openRequestId=null;
 };
 const rejectAll=()=>{
   for(const [,p] of waiting){p.reject(Error('DIFFGRIDS_UI_SESSION_REVOKED'))}
   waiting.clear();
 };
 const requireReady=()=>{if(!ready||terminated)fail()};
 const send=(kind,payload={})=>{
   requireReady();
   const requestId=++seq;
   const promise=new Promise((resolve,reject)=>waiting.set(requestId,{resolve,reject}));
   worker.postMessage({kind,requestId,...payload});
   return {requestId,promise};
 };
 function start(listener=()=>{}){
   if(worker||terminated)fail();
   listeners.add(listener);
   worker=workerFactory();
   worker.onmessage=({data})=>{
     if(data?.kind==='DIFFGRIDS_RUNTIME_READY'){
       ready=data.ready===true&&data.writerAuthorized===false;
       notify({ready,unsupported:!ready});
       return;
     }
     const p=waiting.get(data?.requestId);
     if(!p)return;
     waiting.delete(data.requestId);
     if(data.ok!==true||!isRecord(data.summary))p.reject(Error('DIFFGRIDS_UI_FAILED_CLOSED'));
     else p.resolve(data.summary);
   };
   worker.onerror=()=>{ready=false;clear();rejectAll();worker?.terminate();notify({ready:false,unsupported:true})};
   return ()=>{listeners.delete(listener)};
 }
 async function open(file,originalSha256,confirmed){
   requireReady();
   // A must be revoked even if B is malformed before any Worker OPEN.
   await close();
   if(!(file instanceof Blob)||file.size<16||file.size>128*1024*1024||
      file.size%16!==0||!SHA.test(originalSha256)||confirmed!==true)fail();
   const token=epoch;
   const {requestId,promise}=send('OPEN_LOCAL_STORED_DIFFGRIDS',{
     file,expectedEncryptedSizeBytes:file.size,
     attestation:{
       contract:'wand.owner.local.steam-p1g-rust-v1@1',
       platform:'steam-windows',buildKind:'steam-full-version',
       fullVersion:STEAM_FULL_VERSION,schema:626,
       originalSha256,evidenceKind:'owner-observed-installed-steam-fullversion',
       observedOutsideSave:true
     }
   });
   openRequestId=requestId;
   try{
     const s=await promise;
     if(token!==epoch||!openOk(s))fail();
     selection=s.selection;total=s.recordCount;nextIndex=0;
     return Object.freeze({recordCount:total,pageIndex:0,writerAuthorized:false});
   }catch(e){if(token===epoch)await close();throw Error('DIFFGRIDS_UI_FAILED_CLOSED')}
 }
 async function readNext(){
   requireReady();
   if(selection===null||nextIndex===null)fail();
   const token=epoch,s=selection,index=nextIndex;
   // Prevent two concurrent UI READ_NEXT calls from consuming one Rust token.
   nextIndex=null;
   try{
     const {promise}=send('READ_LOCAL_STORED_DIFFGRIDS_NEXT',{selection:s,pageIndex:index});
     const p=await promise;
     if(token!==epoch||!pageOk(p,s,index)||countSeen+p.records.length>total)fail();
     countSeen+=p.records.length;
     if(p.nextPageIndex===null&&countSeen!==total)fail();
     if(p.nextPageIndex!==null&&(p.records.length!==8||countSeen>=total))fail();
     nextIndex=p.nextPageIndex;
     return Object.freeze({pageIndex:index,records:Object.freeze(p.records.map(output)),
       hasNext:nextIndex!==null,recordCount:total});
   }catch{if(token===epoch)await close();throw Error('DIFFGRIDS_UI_FAILED_CLOSED')}
 }
 async function close(){
   if(terminated)return;
   const selected=selection,pending=openRequestId;
   clear();rejectAll();
   if(!ready)return;
   try{
     const payload=selected===null?
       {selection:null,openRequestId:pending}:{selection:selected};
     if(selected!==null||pending!==null){
       const x=send('CLOSE_LOCAL_STORED_DIFFGRIDS',payload);await x.promise;
     }
   }catch{ /* state already locally revoked; no authority from failure */ }
 }
 function dispose(){
   terminated=true;ready=false;clear();rejectAll();worker?.terminate();
   worker=null;listeners.clear();
 }
 return Object.freeze({start,open,readNext,close,dispose,
   getState:()=>Object.freeze({ready,hasSession:selection!==null,hasNext:nextIndex!==null,
     recordCount:total,writerAuthorized:false})});
}
