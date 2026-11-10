// 05 QR-C independent PR893 scoped QA ONLY: new Worker WASM ABI/forwarder.
// Runs inside a genuine isolated Chrome Module Worker with generated Rust WASM.
// Only synthetic data. NEVER real P1G or Owner credentials.
export async function runIndependentPr893Worker(WorkerWasmSource){
 const assert=(v,msg)=>{if(!v)throw Error('QA05QRC893_'+msg)};
 const denied=(cb,text)=>{
   try{cb()}catch(error){
     const message=String(error?.message||error);
     assert(message.includes(text),'WRONG_DENIAL_'+text+'_'+message.slice(0,110));
     return;
   }
   throw Error('QA05QRC893_UNEXPECTED_ACCEPT_'+text);
 };
 const steam='releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22';
 const ident=['steam-windows','steam-full-version',steam,626,true];
 const buildDoc=(n=9)=>{
   const d={GameInfo:{Version:626},Player:{Unknown:'NEVER_LEAK_OTHER_DOMAIN_QA'},
     World:{GridCollection:{DiffGrids:{}}},NeverIndexed:{secret:'NEVER_LEAK_UNKNOWN_ROOT_QA'}};
   for(let i=0;i<n;i++)d.World.GridCollection.DiffGrids[i]={
     ID:i,DefaultLayoutGridID:0,
     GridDefaultLayoutPath:'synthetic/unresolved/'+i+'.json',
     GridDefaultLayoutType:'Fake.Grid, NoNativeResolution',
     DefaultGridHashCode:-2147483648,DefaultGridDataHashCode:2147483647,
     ModifiedObjects:{'7':{ID:7,Future:'NEVER_LEAK_INNER_FIELD_QA'}},
     RemovedObjects:[7,8],
     UnknownExtra:'NEVER_LEAK_DIFF_EXTRA_QA'
   };
   return d;
 };
 const open=(doc,identity=ident)=>{
   const entropy=crypto.getRandomValues(new Uint8Array(32));
   const worker=new WorkerWasmSource(...identity,entropy);
   entropy.fill(0);
   const data=new TextEncoder().encode(typeof doc==='string'?doc:JSON.stringify(doc));
   for(let off=0;off<data.length;off+=512*1024){
     worker.append_chunk(data.subarray(off,Math.min(off+512*1024,data.length)));
   }
   return worker;
 };
 const scope=r=>[r.sessionId,BigInt(r.revision),BigInt(r.indexGeneration),r.decodedSha256];
 const strictOutput=(text,needRecords)=>{
   assert(typeof text==='string','JSON_RETURN_STRING');
   assert(text.length<=512*1024,'PAGE_LE_512K');
   const value=JSON.parse(text);
   assert(value.externalLayoutStatus==='UNRESOLVED_EXTERNAL_LAYOUT','EXTERNAL_UNRESOLVED');
   assert(value.productReadAccepted===false&&value.writerAuthorized===false&&
     value.allNativeReferencesVerified===false,'NO_NATIVE_WRITER_AUTH');
   assert(!text.includes('NEVER_LEAK_OTHER_DOMAIN_QA')&&
     !text.includes('NEVER_LEAK_UNKNOWN_ROOT_QA')&&
     !text.includes('NEVER_LEAK_INNER_FIELD_QA')&&
     !text.includes('NEVER_LEAK_DIFF_EXTRA_QA'),'NO_OPAQUE_SOURCE_LEAK');
   if(needRecords!==undefined)assert(value.records.length===needRecords,'CORRECT_BOUNDED_RECORD_COUNT');
   return value;
 };
 const host=open(buildDoc(9));
 const receipt=JSON.parse(host.finish());
 assert(receipt.productWorkerBound===true&&receipt.fullDocumentJsonValidated===true,'CORE_RECEIPT');
 assert(receipt.revision===0&&receipt.indexGeneration===1&&receipt.schema===626,'SESSION_VERSION');
 assert(receipt.productReadAccepted===false&&receipt.writerAuthorized===false,'RECEIPT_OFF');
 const s=scope(receipt);
 const issued=JSON.parse(host.issue_saved_diffgrids_typed_cursor(...s));
 assert(issued.sessionId===receipt.sessionId&&issued.decodedSha256===receipt.decodedSha256,
   'RUST_OWNED_SESSION_IDENTITY');
 assert(issued.indexedRecords===9&&issued.maxRecordsPerPage===8,'INDEXED_RECEIPT_9');
 assert(issued.productReadAccepted===false&&issued.writerAuthorized===false,'ISSUE_FLAGS_OFF');
 const first=strictOutput(host.read_saved_diffgrids_typed_page(issued.cursor,...s),8);
 assert(first.nextCursor&&first.nextCursor!==issued.cursor,'CURSOR_ROTATED');
 assert(first.records.every(g=>g.defaultLayoutGridId===0&&
   g.defaultGridHashCode===-2147483648&&g.defaultGridDataHashCode===2147483647&&
   g.externalLayoutStatus==='UNRESOLVED_EXTERNAL_LAYOUT'&&
   g.nativeEffectiveGridVerified===false),'STORED_ONLY_NOT_NATIVE');
 assert(first.records.every(g=>g.modifiedObjectCount===1&&g.removedObjectCount===2&&
    g.modifiedRemovedSameIdPairs===1),'TYPED_MODIFIED_REMOVED');
 denied(()=>host.read_saved_diffgrids_typed_page(issued.cursor,...s),
   'SAVED_DIFFGRIDS_CURSOR_UNKNOWN_OR_CONSUMED');
 denied(()=>host.read_typed_page(first.nextCursor,...s),
   'INDEX_TYPED_DIFFGRIDS_CURSOR_REQUIRED');
 const second=strictOutput(host.read_saved_diffgrids_typed_page(first.nextCursor,...s),1);
 assert(second.nextCursor===null,'END_OF_NINE');
 const ids=[...first.records,...second.records].map(g=>g.gridId).sort((a,b)=>a-b);
 assert(ids.length===9&&ids.every((id,j)=>id===j),'NO_INDEX_LOSS_OR_DUPLICATE');
 denied(()=>host.read_saved_diffgrids_typed_page(first.nextCursor,...s),
   'SAVED_DIFFGRIDS_CURSOR_UNKNOWN_OR_CONSUMED');
 const world=JSON.parse(host.issue_typed_cursor('world',...s));
 denied(()=>host.read_saved_diffgrids_typed_page(world.cursor,...s),
   'SAVED_DIFFGRIDS_CURSOR_SCOPE_INVALID');
 const worldPage=JSON.parse(host.read_typed_page(world.cursor,...s));
 assert(worldPage.fields.length===1&&worldPage.productReadAccepted===false,'EXISTING_WORLD_UNCHANGED');
 const foreign=open(buildDoc(9)),fr=JSON.parse(foreign.finish()),fs=scope(fr);
 const own=JSON.parse(foreign.issue_saved_diffgrids_typed_cursor(...fs));
 assert(own.cursor!==issued.cursor&&fr.sessionId!==receipt.sessionId,'NO_CROSS_SESSION_COLLISION');
 denied(()=>foreign.read_saved_diffgrids_typed_page(first.nextCursor,...fs),
   'SAVED_DIFFGRIDS_CURSOR_UNKNOWN_OR_CONSUMED');
 denied(()=>host.issue_saved_diffgrids_typed_cursor('f'.repeat(32),s[1],s[2],s[3]),
   'SESSION_SOURCE_SCOPE_MISMATCH');
 denied(()=>host.issue_saved_diffgrids_typed_cursor(s[0],s[1]+1n,s[2],s[3]),
   'SESSION_REVISION_GENERATION_CAS');
 denied(()=>host.issue_saved_diffgrids_typed_cursor(s[0],s[1],s[2]+1n,s[3]),
   'SESSION_REVISION_GENERATION_CAS');
 denied(()=>host.issue_saved_diffgrids_typed_cursor(s[0],s[1],s[2],'f'.repeat(64)),
   'SESSION_SOURCE_SCOPE_MISMATCH');
 denied(()=>host.issue_saved_diffgrids_typed_cursor('F'.repeat(32),s[1],s[2],s[3]),
   'WORKER_SCOPE_HEX_INVALID');
 denied(()=>host.read_saved_diffgrids_typed_page('0'.repeat(32),...s),
   'SAVED_DIFFGRIDS_CURSOR_UNKNOWN_OR_CONSUMED');
 foreign.close();host.close();
 denied(()=>host.issue_saved_diffgrids_typed_cursor(...s),'WORKER_SESSION_NOT_READY');
 denied(()=>host.read_saved_diffgrids_typed_page(issued.cursor,...s),'WORKER_SESSION_NOT_READY');

 const sw=open(buildDoc(1),['switch','switch-bid','9A239D3DB569756D',626,true]);
 const sr=JSON.parse(sw.finish());
 denied(()=>sw.issue_saved_diffgrids_typed_cursor(...scope(sr)),
   'SAVED_DIFFGRIDS_EXACT_STEAM_BUILD_REQUIRED');
 sw.close();
 const badBuild=open(buildDoc(1),['steam-windows','steam-full-version','OTHER',626,true]);
 denied(()=>badBuild.finish(),'EXACT_BUILD_ID_MISMATCH');
 const malformed=open('{"GameInfo":{"Version":626},"Player":{},"World":{"GridCollection":{"DiffGrids":{"1":{"ID":2}}}}}');
 const mr=JSON.parse(malformed.finish());
 denied(()=>malformed.issue_saved_diffgrids_typed_cursor(...scope(mr)),
   'SAVED_DIFFGRIDS_KEY_ID_MISMATCH');
 malformed.close();

 // New ABI stricter than inherited Core 16,384-ID limit. Error has no page.
 const tooMany=buildDoc(1),mod={};
 for(let i=0;i<2049;i++)mod[String(i)]={ID:i};
 tooMany.World.GridCollection.DiffGrids[0].ModifiedObjects=mod;
 const overCount=open(tooMany),or=JSON.parse(overCount.finish()),os=scope(or);
 const granted=JSON.parse(overCount.issue_saved_diffgrids_typed_cursor(...os));
 denied(()=>overCount.read_saved_diffgrids_typed_page(granted.cursor,...os),
   'WORKER_TYPED_OBJECT_ID_COUNT_BOUNDS');
 denied(()=>overCount.read_saved_diffgrids_typed_page(granted.cursor,...os),
   'SAVED_DIFFGRIDS_CURSOR_UNKNOWN_OR_CONSUMED');
 overCount.close();

 // Eight 2,048/2,048 safe numeric 16-digit IDs yield >512KiB typed response.
 // Underlying immutable Rust Session may index, but Worker must reject rather
 // than exposing a large serialized JSON. Input is synthetic and chunked.
 const large=buildDoc(8),largeMods={},largeRemoved=[];
 for(let i=0;i<2048;i++){
   const key=String(1000000000000000+i);
   largeMods[key]={ID:Number(key)};
   largeRemoved.push(Number(key));
 }
 for(const grid of Object.values(large.World.GridCollection.DiffGrids)){
   grid.ModifiedObjects=largeMods;grid.RemovedObjects=largeRemoved;
 }
 const bounded=open(large),br=JSON.parse(bounded.finish()),bs=scope(br);
 const bg=JSON.parse(bounded.issue_saved_diffgrids_typed_cursor(...bs));
 denied(()=>bounded.read_saved_diffgrids_typed_page(bg.cursor,...bs),'WORKER_TYPED_PAGE_BYTE_BOUNDS');
 bounded.close();

 const empty=open(buildDoc(0)),er=JSON.parse(empty.finish()),es=scope(er);
 const eg=JSON.parse(empty.issue_saved_diffgrids_typed_cursor(...es));
 const ep=strictOutput(empty.read_saved_diffgrids_typed_page(eg.cursor,...es),0);
 assert(ep.nextCursor===null,'EMPTY_PAGE_CURSOR_FINAL');
 empty.close();

 return Object.freeze({independent:true,realRustWasm:true,realChromeWorker:true,
   boundedRecordsPerPage:8,storedRecords9:true,scopeAndCasDenied:true,
   cursorReplayDenied:true,crossDomainDenied:true,largeResponseDenied:true,
   objectCountDenied:true,buildMismatchDenied:true,closedWorkerDenied:true,
   productReadAccepted:false,writerAuthorized:false,realSave:false});
}
