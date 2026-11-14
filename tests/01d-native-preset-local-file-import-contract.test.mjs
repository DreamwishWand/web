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

test('stale native preset removal rejects a replaced same-ID entry and retains disjoint data',async()=>{
 const m=await import('../src/lib/presets/native-local-file-import-contract.mjs');
 const {NATIVE_PRESET_LIBRARY_KEY:key}=await import('../src/lib/presets/native-preset-runtime.js');
 let raw=null,writes=0,tail=Promise.resolve();
 const storage={getItem:k=>{assert.equal(k,key);return raw;},setItem:(k,v)=>{assert.equal(k,key);raw=v;writes++;}};
 const locks={request:(name,opts,fn)=>{assert.equal(name,m.NATIVE_PRESET_LIBRARY_LOCK);assert.equal(opts.mode,'exclusive');const next=tail.then(fn);tail=next.catch(()=>{});return next;}};
 const run=options=>m.transactNativePresetLibrary({storage,locks,...options});
 const a=backup(),b={...a,payload:{...a.payload,PresetName:'replacement',OpaqueFuture:{replacement:true}}},c={...backup(),id:'native_disjoint'};
 const remove=(entry,expectedIncarnation)=>run({operation:'remove',id:entry.id,expectedEntry:JSON.stringify(entry),expectedIncarnation});
 await run({operation:'merge',backups:[a]});
 const old=(await run({operation:'read'})).library;
 const stale=old.backups[0],oldGeneration=old.localEntryIncarnations.entries[a.id];
 await remove(a,oldGeneration);await run({operation:'merge',backups:[b]});
 const replaced=raw;assert.equal(writes,3);
 await assert.rejects(remove(stale,oldGeneration),/STALE_ENTRY/);assert.equal(raw,replaced);assert.equal(writes,3);
 await assert.rejects(run({operation:'remove',id:b.id}),/EXPECTED_ENTRY_REQUIRED/);
 await assert.rejects(run({operation:'remove',id:b.id,expectedEntry:'{}'}),/STALE_ENTRY/);
 await assert.rejects(remove(c),/ENTRY_MISSING/);assert.equal(raw,replaced);assert.equal(writes,3);
 await run({operation:'merge',backups:[c]});
 await remove(b,JSON.parse(replaced).localEntryIncarnations.entries[b.id]);assert.deepEqual(JSON.parse(raw).backups,[c]);assert.equal(writes,5);
 const ui=readFileSync('src/lib/presets/NativePresetManager.svelte','utf8');
 assert.match(ui,/expectedEntry=JSON.stringify\(backup\)/);
 assert.match(ui,/operation:'remove',id,expectedEntry/);
 assert.match(ui,/removeBackup\(backup\)/);
});

test('local incarnation CAS rejects identical reincarnation and preserves legacy/disjoint/portable boundaries',async()=>{
 const m=await import('../src/lib/presets/native-local-file-import-contract.mjs');
 const {NATIVE_PRESET_LIBRARY_KEY:key,createEmptyNativePresetLibrary,serializeNativePresetLibrary}=await import('../src/lib/presets/native-preset-runtime.js');
 const a=backup(),b={...backup(),id:'native_disjoint'},c={...backup(),id:'native_third'};
 const legacy={...createEmptyNativePresetLibrary(),backups:[a],opaqueTop:{keep:true}};
 let raw=serializeNativePresetLibrary(legacy),writes=0,tail=Promise.resolve();
 const storage={getItem:k=>{assert.equal(k,key);return raw;},setItem:(k,v)=>{assert.equal(k,key);raw=v;writes++;}};
 const locks={request:(name,opts,fn)=>{const next=tail.then(fn);tail=next.catch(()=>{});return next;}};
 const run=options=>m.transactNativePresetLibrary({storage,locks,...options});
 const remove=(entry,expectedIncarnation)=>run({operation:'remove',id:entry.id,expectedEntry:JSON.stringify(entry),expectedIncarnation});
 const initial=raw;assert.deepEqual((await run({operation:'read'})).library,legacy);assert.equal(raw,initial);assert.equal(writes,0);
 await run({operation:'merge',backups:[a]});assert.equal(raw,initial);assert.equal(writes,0);
 await run({operation:'merge',backups:[b]});
 const migrated=JSON.parse(raw);assert.equal(migrated.localEntryIncarnations.entries[a.id],0);
 assert.deepEqual(migrated.opaqueTop,legacy.opaqueTop);assert.deepEqual(migrated.backups,[a,b]);
 await remove(a,0);await run({operation:'merge',backups:[a]});
 const reincarnated=raw,gen=JSON.parse(raw).localEntryIncarnations.entries[a.id];
 assert.ok(gen>0);assert.equal(writes,3);
 await assert.rejects(remove(a,0),/STALE_INCARNATION/);
 await assert.rejects(remove(a),/EXPECTED_INCARNATION_REQUIRED/);
 assert.equal(raw,reincarnated);assert.equal(writes,3);
 await run({operation:'merge',backups:[c]});await remove(a,gen);
 assert.deepEqual(JSON.parse(raw).backups,[b,c]);assert.equal(writes,5);
 await remove(b,JSON.parse(raw).localEntryIncarnations.entries[b.id]);
 await remove(c,JSON.parse(raw).localEntryIncarnations.entries[c.id]);
 const empty=JSON.parse(raw);assert.deepEqual(empty.backups,[]);assert.deepEqual(empty.localEntryIncarnations.entries,{});
 await run({operation:'merge',backups:[a]});
 const again=JSON.parse(raw);assert.ok(again.localEntryIncarnations.entries[a.id]>=empty.localEntryIncarnations.next);
 await assert.rejects(remove(a,gen),/STALE_INCARNATION/);
 const good=raw,goodWrites=writes;
 for(const value of [null,{next:1,entries:{}},{next:1,entries:{[a.id]:1}},{next:2,entries:{[a.id]:0,extra:0}},{next:2,entries:{[a.id]:'0'}}]){
  raw=JSON.stringify({...again,localEntryIncarnations:value});
  const corrupt=raw;await assert.rejects(run({operation:'read'}),/INCARNATION_INVALID/);
  await assert.rejects(run({operation:'merge',backups:[b]}),/INCARNATION_INVALID/);
  assert.equal(raw,corrupt);assert.equal(writes,goodWrites);
 }
 raw=good;
 // Imported envelope metadata is not trusted to grant an origin incarnation.
 const forged=await m.inspectNativePresetLocalFileBytes(bytes({...again,localEntryIncarnations:{next:1,entries:{[a.id]:0}}}));
 assert.equal(forged.localFileReady,true);assert.deepEqual(forged.backups.map(x=>x.backup),[a]);
 const ui=readFileSync('src/lib/presets/NativePresetManager.svelte','utf8');
 assert.match(ui,/expectedIncarnation=library\.localEntryIncarnations\?\.entries\[id\]\?\?0/);
 assert.match(ui,/operation:'remove',id,expectedEntry,expectedIncarnation/);
 assert.match(ui,/localEntryIncarnations,\.\.\.portable/);
});


test('QA544 independent incarnation exhaustion, multi-insert atomicity, malformed maps and stale tokens',async()=>{
 const {transactNativePresetLibrary:tx}=await import('../src/lib/presets/native-local-file-import-contract.mjs');
 const {NATIVE_PRESET_LIBRARY_KEY:key,createEmptyNativePresetLibrary,serializeNativePresetLibrary}=await import('../src/lib/presets/native-preset-runtime.js');
 const a=backup({shareInfo:{Code:'synthetic'}}),b={...backup({deleted:true}),id:'native_q544_b'},c={...backup({root:false}),id:'native_q544_c'};
 const limit=Number.MAX_SAFE_INTEGER;
 let raw=serializeNativePresetLibrary({...createEmptyNativePresetLibrary(),backups:[a],localEntryIncarnations:{next:limit-1,entries:{[a.id]:7}},opaqueTop:{keep:true}}),writes=0,tail=Promise.resolve();
 const storage={getItem:k=>{assert.equal(k,key);return raw},setItem:(k,v)=>{assert.equal(k,key);raw=v;writes++}};
 const locks={request:(name,opts,fn)=>{assert.equal(opts.mode,'exclusive');const r=tail.then(fn);tail=r.catch(()=>{});return r;}};
 const run=opts=>tx({storage,locks,...opts});
 const remove=(entry,g)=>run({operation:'remove',id:entry.id,expectedEntry:JSON.stringify(entry),expectedIncarnation:g});
 const before=raw;
 await assert.rejects(run({operation:'merge',backups:[b,c]}),/INCARNATION_EXHAUSTED/);
 assert.equal(raw,before);assert.equal(writes,0);
 await run({operation:'merge',backups:[a,b]});
 const accepted=raw,snap=JSON.parse(raw);
 assert.deepEqual(snap.backups,[a,b]);assert.equal(snap.localEntryIncarnations.next,limit);
 assert.deepEqual(snap.localEntryIncarnations.entries,{[a.id]:7,[b.id]:limit-1});assert.equal(writes,1);
 await run({operation:'merge',backups:[b,a]});assert.equal(raw,accepted);assert.equal(writes,1);
 for(const g of [null,undefined,'7',7.1,-1,Infinity,limit,limit-1,0]) {
  await assert.rejects(remove(a,g),/EXPECTED_INCARNATION_REQUIRED|STALE_INCARNATION/);
  assert.equal(raw,accepted);assert.equal(writes,1);
 }
 await assert.rejects(run({operation:'merge',backups:[c]}),/INCARNATION_EXHAUSTED/);
 const invalid=[
  {next:limit,entries:{[a.id]:7,[b.id]:7}},
  {next:limit,entries:{[a.id]:7,[b.id]:-1}},
  {next:limit+1,entries:{[a.id]:7,[b.id]:8}},
  {next:limit,entries:{[a.id]:7,[b.id]:limit}},
  {next:limit,entries:{[a.id]:7,[b.id]:8},extra:true},
  {next:limit,entries:{[a.id]:7,missing:8}},
  {next:limit,entries:[7,8]}
 ];
 for(const meta of invalid){
  raw=JSON.stringify({...snap,localEntryIncarnations:meta});
  const corrupt=raw;
  await assert.rejects(run({operation:'read'}),/INCARNATION_INVALID/);
  await assert.rejects(remove(a,7),/INCARNATION_INVALID/);
  assert.equal(raw,corrupt);assert.equal(writes,1);
 }
 raw=accepted;await remove(a,7);await remove(b,limit-1);
 assert.deepEqual(JSON.parse(raw).localEntryIncarnations,{next:limit,entries:{}});
 const empty=raw;await assert.rejects(run({operation:'merge',backups:[a]}),/INCARNATION_EXHAUSTED/);
 assert.equal(raw,empty);assert.equal(writes,3);
 assert.deepEqual(JSON.parse(raw).opaqueTop,{keep:true});
});
test('QA544 independent repeated legacy-zero to positive reincarnation and portable metadata isolation',async()=>{
 const {transactNativePresetLibrary:tx,inspectNativePresetLocalFileBytes:inspect}=await import('../src/lib/presets/native-local-file-import-contract.mjs');
 const {NATIVE_PRESET_LIBRARY_KEY:key,createEmptyNativePresetLibrary,serializeNativePresetLibrary}=await import('../src/lib/presets/native-preset-runtime.js');
 const a=backup({shareInfo:{Code:'synthetic'}}),b={...backup({deleted:true}),id:'native_q544_legacy_b'};
 let raw=serializeNativePresetLibrary({...createEmptyNativePresetLibrary(),backups:[a,b]}),writes=0,tail=Promise.resolve();
 const storage={getItem:k=>{assert.equal(k,key);return raw},setItem:(k,v)=>{assert.equal(k,key);raw=v;writes++}};
 const locks={request:(n,o,f)=>{const r=tail.then(f);tail=r.catch(()=>{});return r;}};
 const run=opts=>tx({storage,locks,...opts});
 const remove=(entry,g)=>run({operation:'remove',id:entry.id,expectedEntry:JSON.stringify(entry),expectedIncarnation:g});
 const first=raw;await run({operation:'merge',backups:[a,b]});assert.equal(raw,first);assert.equal(writes,0);
 const stale=[0];let g=0;
 for(let i=0;i<4;i++){
  await remove(a,g);
  const envelope={schema:NATIVE_PRESET_LIBRARY_SCHEMA,version:1,backups:[a],localEntryIncarnations:{next:9999,entries:{[a.id]:9998}}};
  const reviewed=await inspect(bytes(envelope));assert.equal(reviewed.localFileReady,true);
  await run({operation:'merge',backups:reviewed.backups.map(x=>x.backup)});
  const snap=JSON.parse(raw);g=snap.localEntryIncarnations.entries[a.id];
  assert.equal(g,i+1);assert.equal(snap.localEntryIncarnations.entries[b.id],0);
  assert.deepEqual(snap.backups,[b,a]);
  const saved=raw,w=writes;
  for(const prior of stale){await assert.rejects(remove(a,prior),/STALE_INCARNATION/);assert.equal(raw,saved);assert.equal(writes,w);}
  stale.push(g);
 }
 await remove(b,0);assert.deepEqual(JSON.parse(raw).backups,[a]);
 await remove(a,g);assert.deepEqual(JSON.parse(raw).localEntryIncarnations,{next:5,entries:{}});
 assert.equal(writes,10);
});
