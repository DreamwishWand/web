import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  NATIVE_PRESET_BACKUP_SCHEMA,NATIVE_PRESET_LIBRARY_SCHEMA,
  createNativePresetBackup,extractNativePresetSnapshots
} from '../src/lib/presets/native-preset-runtime.js';
import {
  inspectNativePresetLocalFileBytes,inspectNativeToMLocalFileContract,
  NATIVE_LOCAL_PRESET_FILE_MAX_BYTES,NATIVE_LOCAL_TOM_FILE_SUPPORTED
} from '../src/lib/presets/native-local-file-import-contract.mjs';

const bytes=v=>new TextEncoder().encode(JSON.stringify(v));
const payload=({deleted=false,shareInfo=null,root=true}={})=>({
  GridCollection:{
    Grids:root?{'0':{ID:0,NextGridObjectID:1,Objects:{
      '0':{ID:0,ItemID:40000001,X:0,Y:0,State:null,UnknownExtra:{items:['retained']}}
    }}}:{},
    DiffGrids:{},NextGridID:root?1:0
  },
  PresetName:'Local Only',ThumbnailItems:[40000001],
  ShareInfo:shareInfo,StateFlags:deleted?16:0,OpaqueFuture:{a:1,b:[2,3]}
});
const backup=opts=>{
  const source=payload(opts);
  const snap=extractNativePresetSnapshots({World:{DecorationPresets:[source]}})[0];
  return createNativePresetBackup(snap,{sourceName:'Local Test.p1g',
    now:'2026-11-04T04:00:00Z',idFactory:()=> 'fixture'});
};
test('Valid original schema624 single DDV-native preset can be inspected for offline import; no Save Writer/public cloud',async()=>{
  const input=backup();
  assert.equal(input.schema,NATIVE_PRESET_BACKUP_SCHEMA);
  const r=await inspectNativePresetLocalFileBytes(bytes(input));
  assert.equal(r.status,'LOCAL_FILE_VALIDATED_PRESERVE_ONLY');
  assert.equal(r.localFileReady,true);
  assert.equal(r.backups.length,1);
  assert.equal(r.backups[0].quarantine,false);
  assert.deepEqual(r.backups[0].backup.payload.OpaqueFuture,{a:1,b:[2,3]});
  assert.deepEqual(r.backups[0].backup.payload.GridCollection.Grids['0'].Objects['0'].UnknownExtra,{items:['retained']});
  assert.match(r.informationalFileSha256,/^[0-9a-f]{64}$/);
  assert.equal(r.sourceProfileSchema,624);
  assert.equal(r.sourceGameVersion,null);
  assert.equal(r.sourceBID,null);
  assert.equal(r.sourceBuildAttested,false);
  assert.equal(r.gameSaveApplyAuthorized,false);
  assert.equal(r.publicSharingAuthorized,false);
  assert.equal(r.communityPresetCreated,false);
  assert.equal(r.originalSourceModified,false);
  assert.equal(r.localFileWrittenByThisFunction,false);
});
test('Validated library import is local-only and requires unique immutable IDs',async()=>{
  const one=backup(),two={...backup(),id:'native_second'};
  const r=await inspectNativePresetLocalFileBytes(bytes({
    schema:NATIVE_PRESET_LIBRARY_SCHEMA,version:1,backups:[one,two]
  }));
  assert.equal(r.backups.length,2);assert.equal(r.gameSaveApplyAuthorized,false);
  const dup=await inspectNativePresetLocalFileBytes(bytes({
    schema:NATIVE_PRESET_LIBRARY_SCHEMA,version:1,backups:[one,one]
  }));
  assert.equal(dup.code,'LOCAL_PRESET_FILE_DUPLICATE_ID');
});
test('Malformed native payload can be quarantined for preservation, never treated as a verified restorable preset',async()=>{
  const altered=backup({root:false});
  const r=await inspectNativePresetLocalFileBytes(bytes(altered));
  assert.equal(r.status,'LOCAL_FILE_VALIDATED_WITH_QUARANTINED_BACKUPS');
  assert.equal(r.backups[0].quarantine,true);
  assert.ok(r.backups[0].structuralWarnings.includes('ROOT_GRID_0_MISSING'));
  assert.equal(r.gameSaveApplyAuthorized,false);
  const shared=await inspectNativePresetLocalFileBytes(bytes(backup({shareInfo:{Code:'private-opaque'}})));
  assert.equal(shared.backups[0].quarantine,true);
  assert.equal(shared.publicSharingAuthorized,false);
  const tombstone=await inspectNativePresetLocalFileBytes(bytes(backup({deleted:true})));
  assert.equal(tombstone.backups[0].quarantine,true);
});
test('New imported backup cannot self-assert write, schema626, published rights or a valid source BID',async()=>{
  const b=backup();
  for(const forged of [
    {...b,persistentWriteAuthorized:true},
    {...b,productApplyAuthorized:true},
    {...b,publicSharingAuthorized:true},
    {...b,source:{...b.source,profileSchemaVersion:626}},
    {...b,source:{...b.source,physicalPresetIndex:-1}},
    {...b,payload:{...b.payload,StateFlags:'0'}},
    {...b,payload:{...b.payload,ThumbnailItems:'bad'}},
    {...b,payload:{...b.payload,ShareInfo:undefined}}
  ]) {
    const r=await inspectNativePresetLocalFileBytes(bytes(forged));
    assert.equal(r.status,'BLOCKED');
    assert.equal(r.gameSaveApplyAuthorized,false);
  }
  const withClaim={...b,source:{...b.source,
    sourceFullVersion:'1.25.3',buildId:'9A239D3DB569756D',rights:'approved'}};
  const r=await inspectNativePresetLocalFileBytes(bytes(withClaim));
  assert.equal(r.status,'LOCAL_FILE_VALIDATED_PRESERVE_ONLY');
  assert.equal(r.sourceBuildAttested,false);
  assert.equal(r.sourceBID,null);
  assert.equal(r.publicSharingAuthorized,false);
});
test('Invalid JSON, forbidden prototype keys, wrong format and excessive bytes are rejected',async()=>{
  const text=JSON.stringify(backup());
  const poisoned=text.replace('"version":1','"__proto__":{"granted":true},"version":1');
  for(const x of [
    new Uint8Array([0xff,0xff]),new TextEncoder().encode(poisoned),
    bytes({schema:'wand.tom-native-backup@1',version:1}),
    bytes({schema:NATIVE_PRESET_LIBRARY_SCHEMA,version:1,backups:[]}),
    new Uint8Array(NATIVE_LOCAL_PRESET_FILE_MAX_BYTES+1)
  ]) {
    const r=await inspectNativePresetLocalFileBytes(x);
    assert.equal(r.status,'BLOCKED');
    assert.equal(r.backups,null);
  }
});
test('Touch of Magic remains separate until independently source-bound; NEVER import it as DecorationPreset',()=>{
  assert.equal(NATIVE_LOCAL_TOM_FILE_SUPPORTED,false);
  const r=inspectNativeToMLocalFileContract();
  assert.equal(r.status,'BLOCKED');
  assert.equal(r.code,'NATIVE_TOM_FORMAT_AND_OWNER_PROVENANCE_NOT_YET_VERIFIED');
  assert.equal(r.gameSaveApplyAuthorized,false);
});

test('Native manager imports both single/local-library backups ONLY after validation and retains disabled DDV restore',()=>{
  const ui=readFileSync('src/lib/presets/NativePresetManager.svelte','utf8');
  assert.match(ui,/inspectNativePresetLocalFileBytes\(new Uint8Array\(await file\.arrayBuffer\(\)\)\)/);
  assert.match(ui,/!reviewed\.localFileReady\|\|!reviewed\.backups/);
  assert.match(ui,/transactNativePresetLibrary/);
  assert.match(ui,/await mergeBackups\(/);
  assert.match(ui,/file\.size>NATIVE_LOCAL_PRESET_FILE_MAX_BYTES/);
  assert.match(ui,/reviewed\.backups\.map\(\(x:any\)=>x\.backup\)/);
  assert.match(ui,/disabled title=\{copy\.blocked\}>\{copy\.restore\}/);
  assert.match(ui,/disabled title=\{copy\.blocked\}>\{copy\.push\}/);
  assert.doesNotMatch(ui,/const imported=parseNativePresetLibrary\(await file\.text\(\)\)/);
});

test('QA674 exact import hook: incomplete schema624 SubGrid and DiffGrid entries are quarantined without payload loss',async()=>{
  for(const badRef of [{},{GridID:null},{GridID:'2'},{GridID:-1},{GridID:1.5}]){
    const b=backup();
    b.payload.GridCollection.Grids['0'].Objects['0'].State={SubGrid:badRef};
    const before=structuredClone(b.payload);
    const r=await inspectNativePresetLocalFileBytes(bytes(b));
    assert.equal(r.status,'LOCAL_FILE_VALIDATED_WITH_QUARANTINED_BACKUPS');
    assert.equal(r.backups[0].quarantine,true);
    assert.ok(r.backups[0].structuralWarnings.includes('SUBGRID_REFERENCE_MALFORMED'));
    assert.deepEqual(r.backups[0].backup.payload,before);
    assert.equal(r.gameSaveApplyAuthorized,false);
    assert.equal(r.sourceBuildAttested,false);
  }
  const invalidDiff=backup();
  invalidDiff.payload.GridCollection.DiffGrids={'9':null};
  const before=structuredClone(invalidDiff.payload);
  const result=await inspectNativePresetLocalFileBytes(bytes(invalidDiff));
  assert.equal(result.status,'LOCAL_FILE_VALIDATED_WITH_QUARANTINED_BACKUPS');
  assert.ok(result.backups[0].structuralWarnings.includes('DIFF_GRIDS_MALFORMED'));
  assert.deepEqual(result.backups[0].backup.payload,before);
  assert.equal(result.publicSharingAuthorized,false);
  const clean=backup();
  clean.payload.GridCollection.DiffGrids={'9':{UnknownOpaque:'retain'}};
  clean.payload.GridCollection.Grids['0'].Objects['0'].State={SubGrid:{GridID:0,UnknownOpaque:'retain'}};
  const ok=await inspectNativePresetLocalFileBytes(bytes(clean));
  assert.equal(ok.status,'LOCAL_FILE_VALIDATED_PRESERVE_ONLY');
  assert.equal(ok.gameSaveApplyAuthorized,false);
});

test('migration transaction preserves latest target, exact duplicate idempotence, collision and corrupt bytes',async()=>{
 const m=await import('../src/lib/presets/native-local-file-import-contract.mjs');
 const {NATIVE_PRESET_LIBRARY_KEY:key}=await import('../src/lib/presets/native-preset-runtime.js');
 let raw=null,writes=0;
 const storage={getItem:k=>{assert.equal(k,key);return raw;},setItem:(k,v)=>{assert.equal(k,key);raw=v;writes++;}};
 const locks={request:async(name,opts,fn)=>{assert.equal(name,m.NATIVE_PRESET_LIBRARY_LOCK);assert.equal(opts.mode,'exclusive');return fn();}};
 const run=(backups,operation='merge')=>m.transactNativePresetLibrary({storage,locks,operation,backups});
 const first=backup(), second={...backup(),id:'native_second'};
 await run([first]);const one=raw;
 await run([first]);assert.equal(raw,one);assert.equal(writes,1);
 await assert.rejects(run([{...first,payload:{...first.payload,PresetName:'conflict'}}]),/ID_COLLISION/);
 assert.equal(raw,one);assert.equal(writes,1);
 await run([second]);assert.deepEqual(JSON.parse(raw).backups,[first,second]);
 const before=raw;raw='{"corrupt":true}';
 await assert.rejects(run([first]),/STORAGE_INVALID/);assert.equal(raw,'{"corrupt":true}');
 raw=before;await assert.rejects(m.transactNativePresetLibrary({storage,locks:null,operation:'merge',backups:[first]}),/LOCK_UNAVAILABLE/);
 assert.equal(raw,before);
});


test('QA529 stale tab remove must not delete replacement with same ID after intervening remove and import',async()=>{
 const {transactNativePresetLibrary:tx}=await import('../src/lib/presets/native-local-file-import-contract.mjs');
 const {NATIVE_PRESET_LIBRARY_KEY:key}=await import('../src/lib/presets/native-preset-runtime.js');
 let raw=null,writes=0;
 const storage={getItem:k=>{assert.equal(k,key);return raw},setItem:(k,v)=>{assert.equal(k,key);raw=v;writes++}};
 let tail=Promise.resolve();
 const locks={request:(name,options,fn)=>{assert.equal(options.mode,'exclusive');const result=tail.then(fn);tail=result.catch(()=>{});return result;}};
 const run=options=>tx({storage,locks,...options});
 const old=backup();await run({operation:'merge',backups:[old]});
 const stale=(await run({operation:'read'})).library.backups[0];
 await run({operation:'remove',id:old.id});
 const replacement={...old,payload:{...old.payload,PresetName:'replacement'}};
 await run({operation:'merge',backups:[replacement]});
 const before=raw,beforeWrites=writes;
 assert.deepEqual(JSON.parse(before).backups,[replacement]);
 // Exact existing UI call: the stale tab captures only backup.id.
 let rejected=false;try{await run({operation:'remove',id:stale.id});}catch{rejected=true;}
 assert.deepEqual({rejected,raw,writes},{rejected:true,raw:before,writes:beforeWrites},
   'stale removal must reject and preserve replacement bytes; cooperative lock cannot substitute for identity');
});
test('QA529 new serialized contention and raw guard preserve accepted disjoint payloads and reject collision',async()=>{
 const {transactNativePresetLibrary:tx}=await import('../src/lib/presets/native-local-file-import-contract.mjs');
 const {NATIVE_PRESET_LIBRARY_KEY:key}=await import('../src/lib/presets/native-preset-runtime.js');
 let raw=null,writes=0,tail=Promise.resolve();
 const storage={getItem:k=>{assert.equal(k,key);return raw},setItem:(k,v)=>{assert.equal(k,key);raw=v;writes++}};
 const locks={request:(name,options,fn)=>{const result=tail.then(fn);tail=result.catch(()=>{});return result;}};
 const run=options=>tx({storage,locks,...options});
 const a=backup(),b={...backup({deleted:true}),id:'native_q529_b'},c={...backup({root:false}),id:'native_q529_c'};
 const results=await Promise.allSettled([run({operation:'merge',backups:[a,b]}),run({operation:'merge',backups:[c]}),run({operation:'merge',backups:[{...a,payload:{...a.payload,PresetName:'conflict'}}]})]);
 assert.deepEqual(results.map(r=>r.status),['fulfilled','fulfilled','rejected']);
 assert.deepEqual(JSON.parse(raw).backups,[a,b,c]);assert.equal(writes,2);
 const before=raw;await assert.rejects(run({operation:'merge',backups:[{...a,id:'native_q529_bad',persistentWriteAuthorized:true}]}),/IMPORT_INVALID/);
 assert.equal(raw,before);assert.equal(writes,2);
 let reads=0;const changed='{"external":"preserve"}';
 const adversarial={getItem:()=>++reads===1?before:changed,setItem:()=>assert.fail('stale write')};
 await assert.rejects(tx({storage:adversarial,locks,operation:'merge',backups:[{...a,id:'native_q529_new'}]}),/STALE_STORAGE/);
});
