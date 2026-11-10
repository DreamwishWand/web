// Public synthetic only. ACTUAL generated Rust WASM runs in the existing
// isolated Chrome module Worker; no raw decoded bytes sent to parent/UI.
// This tests the newly bridged Rust-only metadata ABI, not Product operation ON.
export async function runSavedDiffGridsBridge(WorkerWasmSource) {
 const assert=(yes,reason)=>{if(!yes)throw Error('R22_TYPED_WORKER_'+reason)};
 const refused=(run,contains)=>{
   try{run()}catch(e){
     assert(String(e.message||e).includes(contains),'WRONG_NEGATIVE_'+contains);
     return;
   }
   throw Error('R22_TYPED_WORKER_UNEXPECTED_ACCEPT_'+contains);
 };
 const steam='releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22';
 const source={GameInfo:{Version:626},Player:{},World:{GridCollection:{DiffGrids:{}}},
    UnknownRoot:{secret:'SECRET_SYNTHETIC_OPAQUE_NEVER_EXPORT'}};
 for(let n=0;n<17;n++){
   source.World.GridCollection.DiffGrids[n]={
     ID:n,DefaultLayoutGridID:n===0?0:n+100,
     GridDefaultLayoutPath:'unresolved/synthetic-layout-'+n+'.json',
     GridDefaultLayoutType:'Synth.GridCollection, SynthAssembly',
     DefaultGridHashCode:-37,DefaultGridDataHashCode:624,
     ModifiedObjects:{7:{ID:7},8:{ID:8}},
     RemovedObjects:n===1?{first:7,second:9}:[7,9],
     UnknownPerGrid:{secret:'SECRET_SYNTHETIC_OPAQUE_NEVER_EXPORT'}
   };
 }
 const encoded=new TextEncoder().encode(JSON.stringify(source));
 const build=['steam-windows','steam-full-version',steam,626,true];
 const create=(args=build,data=encoded)=>{
   const seed=crypto.getRandomValues(new Uint8Array(32));
   const wasm=new WorkerWasmSource(...args,seed);
   seed.fill(0);
   // This test fixture is <1MiB; no full source/body returned by any method.
   wasm.append_chunk(data);
   return wasm;
 };
 const wasm=create();
 const receipt=JSON.parse(wasm.finish());
 assert(receipt.fullDocumentJsonValidated===true,'FULL_DOC');
 assert(receipt.productWorkerBound===true,'WORKER_BOUND');
 assert(receipt.schema===626&&receipt.revision===0&&receipt.indexGeneration===1,'SCHEMA_AND_CAS');
 const s=[receipt.sessionId,BigInt(receipt.revision),BigInt(receipt.indexGeneration),receipt.decodedSha256];
 const issue=JSON.parse(wasm.issue_saved_diffgrids_typed_cursor(...s));
 assert(issue.contract==='wand.worker.stored-diffgrids-typed-metadata-readonly@1','CONTRACT');
 assert(issue.indexedRecords===17&&issue.maxRecordsPerPage===8,'ISSUE_COUNTS');
 assert(issue.externalLayoutStatus==='UNRESOLVED_EXTERNAL_LAYOUT','ISSUE_UNKNOWN');
 assert(issue.sessionId===receipt.sessionId&&issue.decodedSha256===receipt.decodedSha256,'ISSUE_SCOPE');
 assert(!issue.allNativeReferencesVerified&&!issue.productReadAccepted&&!issue.writerAuthorized,'ISSUE_AUTH');
 let token=issue.cursor;
 let count=0;
 let overlapPairs=0;
 let pages=0;
 let max=0;
 for(let n=0;n<3;n++){
   const p=JSON.parse(wasm.read_saved_diffgrids_typed_page(token,...s));
   assert(p.contract===issue.contract,'PAGE_CONTRACT');
   assert(p.sessionId===receipt.sessionId&&p.decodedSha256===receipt.decodedSha256,'PAGE_SCOPE');
   assert(p.revision===0&&p.indexGeneration===1,'PAGE_REV');
   assert(p.records.length===(n===2?1:8),'BOUNDED_8_8_1');
   assert(!p.nativeEffectiveGridVerified&&!p.allNativeReferencesVerified&&
      !p.productReadAccepted&&!p.writerAuthorized,'PAGE_AUTH');
   assert(p.externalLayoutStatus==='UNRESOLVED_EXTERNAL_LAYOUT','PAGE_EXTERNAL_UNKNOWN');
   for(const rec of p.records){
     assert(Number.isSafeInteger(rec.gridId)&&rec.gridId>=0,'TYPED_GRID_ID');
     assert(rec.defaultGridHashCode===-37&&rec.defaultGridDataHashCode===624,'SAVED_HASH_VALUES');
     assert(rec.gridDefaultLayoutType==='Synth.GridCollection, SynthAssembly','STORED_TYPE');
     assert(rec.gridDefaultLayoutPath.startsWith('unresolved/'),'STORED_PATH_NOT_LOADED');
     assert(rec.modifiedObjectCount===2&&rec.removedObjectCount===2,'TYPED_COUNTS');
     assert(rec.modifiedObjectIds.length===2&&rec.removedObjectIds.length===2,'TYPED_OBJECT_IDS');
     assert(rec.modifiedRemovedSameIdPairs===1,'OVERLAP_COUNT_NOT_NATIVE_LEGAL');
     assert(rec.externalLayoutStatus==='UNRESOLVED_EXTERNAL_LAYOUT'&&
       rec.nativeEffectiveGridVerified===false,'GRID_EXTERNAL_UNKNOWN');
     overlapPairs+=rec.modifiedRemovedSameIdPairs;
   }
   if(n===0){
     assert(p.records[0].gridId===0&&p.records[0].defaultLayoutGridId===0,'GRID_ZERO_LITERAL');
     assert(p.records[0].removedShape==='array','ARRAY_STORED_SHAPE');
     assert(p.records[1].removedShape==='object-map','OBJECT_MAP_STORED_SHAPE');
   }
   assert(!JSON.stringify(p).includes('SECRET_SYNTHETIC_OPAQUE_NEVER_EXPORT'),'NO_UNKNOWN_FULLJSON_LEAK');
   count+=p.records.length;
   pages+=1;max=Math.max(max,p.records.length);
   refused(()=>wasm.read_saved_diffgrids_typed_page(token,...s),'INDEX_CURSOR_UNKNOWN_OR_CONSUMED');
   refused(()=>wasm.read_typed_page(token,...s),'INDEX_CURSOR_UNKNOWN_OR_CONSUMED');
   if(n<2)assert(p.nextCursor&&p.nextCursor!==token,'ROTATED_CURSOR');
   else assert(p.nextCursor===null,'FINISHED_CURSOR');
   token=p.nextCursor;
 }
 assert(count===17&&pages===3&&max===8&&overlapPairs===17,'TOTAL_17');
 // Existing root cursor also belongs to that same cache, but cannot be used
 // to access saved DiffGrids typed metadata.
 const world=JSON.parse(wasm.issue_typed_cursor('world',...s));
 refused(()=>wasm.read_saved_diffgrids_typed_page(world.cursor,...s),
    'SAVED_DIFFGRIDS_CURSOR_SCOPE_INVALID');
 const worldPage=JSON.parse(wasm.read_typed_page(world.cursor,...s));
 assert(worldPage.fields.length===1,'LEGACY_WORLD_READ_UNCHANGED');
 refused(()=>wasm.issue_saved_diffgrids_typed_cursor(s[0],1n,s[2],s[3]),'SESSION_REVISION_GENERATION_CAS');
 refused(()=>wasm.issue_saved_diffgrids_typed_cursor(s[0],s[1],2n,s[3]),'SESSION_REVISION_GENERATION_CAS');
 refused(()=>wasm.issue_saved_diffgrids_typed_cursor('f'.repeat(32),s[1],s[2],s[3]),'SESSION_SOURCE_SCOPE_MISMATCH');
 refused(()=>wasm.issue_saved_diffgrids_typed_cursor(s[0],s[1],s[2],'f'.repeat(64)),'SESSION_SOURCE_SCOPE_MISMATCH');
 refused(()=>wasm.read_saved_diffgrids_typed_page('0'.repeat(32),...s),'SAVED_DIFFGRIDS_CURSOR_UNKNOWN_OR_CONSUMED');
 // A cursor from a different, valid Steam session is never portable.
 const other=create();const or=JSON.parse(other.finish());
 refused(()=>other.read_saved_diffgrids_typed_page(issue.cursor,or.sessionId,0n,1n,or.decodedSha256),
    'SAVED_DIFFGRIDS_CURSOR_UNKNOWN_OR_CONSUMED');
 other.close();
 wasm.close();
 refused(()=>wasm.issue_saved_diffgrids_typed_cursor(...s),'WORKER_SESSION_NOT_READY');
 refused(()=>wasm.read_saved_diffgrids_typed_page(issue.cursor,...s),'WORKER_SESSION_NOT_READY');
 // Exact same schema in Switch does not permit Steam DiffGrids operation.
 const switchWasm=create(['switch','switch-bid','9A239D3DB569756D',626,true]);
 const sw=JSON.parse(switchWasm.finish());
 refused(()=>switchWasm.issue_saved_diffgrids_typed_cursor(sw.sessionId,0n,1n,sw.decodedSha256),
    'SAVED_DIFFGRIDS_EXACT_STEAM_BUILD_REQUIRED');
 switchWasm.close();
 const wrongBuild=create(['steam-windows','steam-full-version','UNKNOWN',626,true]);
 refused(()=>wrongBuild.finish(),'EXACT_BUILD_ID_MISMATCH');
 const wrongSchema=create(['steam-windows','steam-full-version',steam,624,true]);
 refused(()=>wrongSchema.finish(),'BUILD_IDENTITY_NOT_ATTESTED');
 // Full-document validation denies missing root and duplicate JSON keys.
 const badGrid=new TextEncoder().encode('{"GameInfo":{"Version":626},"Player":{},"World":{"GridCollection":{"DiffGrids":{"7":{"ID":8}}}}}');
 const malformed=create(build,badGrid);
 const mr=JSON.parse(malformed.finish()); // strict JSON, but map ID witness is illegal.
 refused(()=>malformed.issue_saved_diffgrids_typed_cursor(mr.sessionId,0n,1n,mr.decodedSha256),
    'SAVED_DIFFGRIDS_KEY_ID_MISMATCH');
 malformed.close();
 const duplicate=new TextEncoder().encode('{"GameInfo":{"Version":626},"Player":{},"World":{"GridCollection":{"DiffGrids":{"7":{"ID":7},"7":{"ID":7}}}}}');
 const repeated=create(build,duplicate);
 refused(()=>repeated.finish(),'JSON_DUPLICATE_KEY');
 return Object.freeze({pages,records:count,maxRecordsPerPage:max,overlapPairs,
   wasmWorker:true,actualRustWasm:true,realOwnerSaveUsed:false,
   cursorReplayDenied:true,workerCloseDenied:true,
   externalLayoutUnresolved:true,productReadAccepted:false,writerAuthorized:false});
}
