// Independent 04 QR-W NEW_ONLY Q03 on corrected 02WEP PR683/c17a.
// Never use a private P1G. This is synthetic/source-scoped, not Native V2/V3.
import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {openWorldSaveBytes} from '../src/lib/wep/world-save-source.ts';
import {makeSyntheticP1gProfile} from './helpers/p1g-fixture.mjs';

const SOURCE='c17a7c3535d5f19d1552710063447686910702b2';
const OLD_RED_SOURCE='bd5ba22ec9d91fa17686d39b842bf462166aacf0';
const original=new Map([
 ['docs/wep/world-editor-localization-inventory-20261002.json','4336d61d8db47fad19383f1cd7425681e0fefb30'],
 ['scripts/wep-schema626-readonly-browser-acceptance.mjs','54b2fcec62d411582a0bd2075799f2c6e8601703'],
 ['src/lib/wep/world-readonly-copy.js','0db2b06c03502f0559b2dd86984ff54aa728d832'],
 ['src/lib/wep/world-save-source.ts','0ed344b94574911c5d797032b5d315a2176194a8'],
 ['src/routes/editor/world/+page.svelte','f91db92b44fb4dd35dd0ac6ef26c380eedf44c9e'],
 ['tests/wep-world-readonly626.test.mjs','383aaa423b1b0d0fb231f1b6665d9ae0f000c559']
]);
const qaFiles=[
 '.github/workflows/04qr-w-pr683-c17a-independent.yml',
 'scripts/04qr-w-pr683-c17a-chrome.mjs',
 'tests/04qr-w-pr683-c17a-independent.test.mjs'
].sort();
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
const diff=(a,b)=>git('diff','--name-only',a,b).split('\n').filter(Boolean).sort();
const page=readFileSync(new URL('../src/routes/editor/world/+page.svelte',import.meta.url),'utf8');
const fn=page.slice(page.indexOf('async function openEditorDocument(event: Event)'),page.indexOf('async function openRoomFinishRoomInCanvas('));
function profile(){
 return {GameInfo:{Version:626,InitialVersion:518,LastSaveDeviceInfo:{deviceType:'DeviceType_Switch'}},
 Player:{Opaque:{keep:true}},
 World:{
  Villages:[{Areas:{'0':{GridIDs:[5]}}},{Areas:{'1':{GridIDs:[6]}}}],
  GridCollection:{Grids:{'5':{ID:5,Objects:{'7':{State:{}}}},'6':{ID:6,Objects:{'8':{State:{}}}}}}
 },UnknownRoot:{future:'preserve'}};
}
test('QR683-C17A-01 source6 exact blobs; rejected bd5ba diff4; QA only three files',()=>{
 assert.equal(git('rev-parse',SOURCE),SOURCE);
 assert.equal(git('merge-base',OLD_RED_SOURCE,SOURCE),OLD_RED_SOURCE);
 assert.deepEqual(diff(OLD_RED_SOURCE,SOURCE),[
  'docs/wep/world-editor-localization-inventory-20261002.json',
  'scripts/wep-schema626-readonly-browser-acceptance.mjs',
  'src/routes/editor/world/+page.svelte',
  'tests/wep-world-readonly626.test.mjs'
 ]);
 for(const [p,blob] of original){
  assert.equal(git('rev-parse',SOURCE+':'+p),blob,p+' Git blob immutable');
  assert.equal(git('hash-object',p),blob,p+' source unchanged');
 }
 assert.deepEqual(diff(SOURCE,'HEAD'),qaFiles);
});
test('QR683-C17A-02 operation epoch frozen, same request gates after all async awaits',()=>{
 assert.ok(fn.startsWith('async function openEditorDocument'));
 for(const anchor of ['const importEpoch = worldSourceEpoch;','const isCurrentImport = () => importEpoch === worldSourceEpoch;',
  'const importPlatform = sourcePlatform;','const importBid = sourceBuildId.trim().toUpperCase();',
  'const importProvenance = sourceProvenanceConfirmed;'])assert.ok(fn.includes(anchor),anchor);
 for(const expression of [
  /await file\.arrayBuffer\(\)\);\s*if \(!isCurrentImport\(\)\) return;/,
  /await sha256Fingerprint\(bytes\);\s*if \(!isCurrentImport\(\)\) return;/,
  /await openWorldSaveBytes\(bytes,[\s\S]*?\);\s*if \(!isCurrentImport\(\)\) return;/,
  /await createSwitchV125BuildingBinding[\s\S]*?if \(!isCurrentImport\(\)\) return;/,
  /await createSwitchV125ScroogeStoreBinding[\s\S]*?if \(!isCurrentImport\(\)\) return;/,
  /await createSwitchV125ProgressionIntegrationBinding[\s\S]*?if \(!isCurrentImport\(\)\) return;/,
  /await restoreRecoveryRecord[\s\S]*?importEpoch\);\s*if \(!isCurrentImport\(\)\) return;/,
  /catch \(error\) \{\s*\/\/ An older failing decode[\s\S]*?if \(!isCurrentImport\(\)\) return;/,
  /finally \{[\s\S]*?if \(isCurrentImport\(\)\) \{\s*loading = false;\s*input\.value = '';/,
 ])assert.match(fn,expression);
 assert.match(page,/expectedSourceEpoch !== null && worldSourceEpoch !== expectedSourceEpoch/);
 assert.match(page,/if \(expectedSourceEpoch === null\) worldSourceEpoch \+= 1;/);
});
test('QR683-C17A-03 backups cannot be saved before epoch gates and local proof cannot grant writer',()=>{
 const fingerprint=fn.indexOf('const fingerprint = await sha256Fingerprint(bytes)');
 const read=fn.indexOf('const opened = await openWorldSaveBytes(bytes');
 const check=fn.indexOf('if (!isCurrentImport()) return;',read);
 const backup=fn.indexOf('originalSaveBackup = createOriginalSaveBackup(',read);
 const assignment=fn.indexOf('worldSource = opened;',read);
 assert.ok(fingerprint>0&&read>fingerprint&&check>read&&backup>check&&assignment>backup);
 assert.match(fn,/sourceEvidence: importPlatform === 'switch' && importProvenance/);
 assert.match(page,/persistentWriteAuthorized=false/);
});
test('QR683-C17A-04 second missing Village/Grid never masked by first, synthetic immutable',async()=>{
 const p=profile();
 delete p.World.Villages[1].Areas;
 delete p.World.GridCollection.Grids['6'].Objects;
 const bytes=makeSyntheticP1gProfile(p),orig=bytes.slice();
 const out=await openWorldSaveBytes(bytes,{sourcePlatform:'steam-windows'});
 assert.deepEqual(bytes,orig);
 assert.equal(out.structuralDiagnostics.areaRecordCount,null);
 assert.equal(out.structuralDiagnostics.gridObjectEntryCount,null);
 assert.equal(out.compatibility.productionReadAccepted,false);
 assert.equal(out.compatibility.gameVersion,'UNKNOWN');
 assert.equal(out.compatibility.persistentWriteAuthorized,false);
 const empty=profile();
 empty.World.Villages[0].Areas={};
 empty.World.Villages[1].Areas={};
 empty.World.GridCollection.Grids['5'].Objects={};
 empty.World.GridCollection.Grids['6'].Objects={};
 const zero=await openWorldSaveBytes(makeSyntheticP1gProfile(empty),{sourcePlatform:'steam-windows'});
 assert.equal(zero.structuralDiagnostics.areaRecordCount,0);
 assert.equal(zero.structuralDiagnostics.gridObjectEntryCount,0);
});
