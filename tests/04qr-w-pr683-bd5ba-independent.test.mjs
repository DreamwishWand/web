// 04 QR-W NEW_ONLY independent R10 source/async-epoch QA; synthetic profiles only.
import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {openWorldSaveBytes} from '../src/lib/wep/world-save-source.ts';
import {makeSyntheticP1gProfile} from './helpers/p1g-fixture.mjs';
const SOURCE='bd5ba22ec9d91fa17686d39b842bf462166aacf0';
const ANCESTOR='0de7a828b2aa4104980727a6d77c7277aac3db02';
const sourceBlobs=new Map([
 ['docs/wep/world-editor-localization-inventory-20261002.json','2bd9c89c78f1b0da5d1ca997c1af77b6fa1c341e'],
 ['scripts/wep-schema626-readonly-browser-acceptance.mjs','e0a52b0458cf04f2563512097a914d07382d9249'],
 ['src/lib/wep/world-readonly-copy.js','0db2b06c03502f0559b2dd86984ff54aa728d832'],
 ['src/lib/wep/world-save-source.ts','0ed344b94574911c5d797032b5d315a2176194a8'],
 ['src/routes/editor/world/+page.svelte','a928519afd56c9d7b1e321442c317e24d7603286'],
 ['tests/wep-world-readonly626.test.mjs','7c6dc9f9fda3b80a67db1dc83b406b144a2560e5']
]);
const qaPaths=[
 '.github/workflows/04qr-w-pr683-bd5ba-independent.yml',
 'scripts/04qr-w-pr683-bd5ba-chrome.mjs',
 'tests/04qr-w-pr683-bd5ba-independent.test.mjs'
].sort();
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
const diff=(a,b)=>git('diff','--name-only',a,b).split('\n').filter(Boolean).sort();
const make=()=>({
 GameInfo:{Version:626,InitialVersion:518,LastSaveDeviceInfo:{deviceType:'DeviceType_Switch'}},
 Player:{OpaquePlayer:{noCloud:true}},
 World:{
  Villages:[{Areas:{'1':{GridIDs:[5]}}},{Areas:{'2':{GridIDs:[6]}}}],
  GridCollection:{Grids:{
   '5':{ID:5,Objects:{'101':{State:{value:1}}}},
   '6':{ID:6,Objects:{'102':{State:{value:2}}}}
  }}
 },
 OpaqueRoot:{future:{sentinel:'not-writable'}}
});
const open=async p=>openWorldSaveBytes(makeSyntheticP1gProfile(p),{sourcePlatform:'steam-windows'});
const diag=async p=>(await open(p)).structuralDiagnostics;

test('QR683-01 frozen latest source six blobs, old accepted source difference four only and QA adds exactly three',()=>{
 assert.equal(git('rev-parse',SOURCE),SOURCE);
 assert.equal(git('merge-base',ANCESTOR,SOURCE),ANCESTOR);
 assert.deepEqual(diff(ANCESTOR,SOURCE),[
  'docs/wep/world-editor-localization-inventory-20261002.json',
  'scripts/wep-schema626-readonly-browser-acceptance.mjs',
  'src/routes/editor/world/+page.svelte',
  'tests/wep-world-readonly626.test.mjs'
 ]);
 for(const [path,blob] of sourceBlobs){
  assert.equal(git('rev-parse',SOURCE+':'+path),blob,'source tree '+path);
  assert.equal(git('hash-object',path),blob,'source kept unchanged '+path);
 }
 assert.deepEqual(diff(SOURCE,'HEAD'),qaPaths,'no modified product files/old tests');
});

test('QR683-02 Second Village Areas absent, first Village valid -> global unknown, never first=1',async()=>{
 const p=make();
 delete p.World.Villages[1].Areas;
 const out=await open(p);
 assert.equal(out.structuralDiagnostics.villageCount,2);
 assert.equal(out.structuralDiagnostics.areaRecordCount,null);
 assert.equal(out.compatibility.productionReadAccepted,false);
 assert.equal(out.compatibility.exactBuildKnown,false);
 assert.equal(out.compatibility.routesAuthorized,false);
 assert.equal(out.compatibility.persistentWriteAuthorized,false);
});

test('QR683-03 second Grid Objects absent/malformed -> global unknown, explicit empty -> 0',async()=>{
 const missing=make();
 delete missing.World.GridCollection.Grids['6'].Objects;
 assert.equal((await diag(missing)).gridObjectEntryCount,null);
 const malformed=make();
 malformed.World.GridCollection.Grids['6'].Objects=['fake'];
 assert.equal((await diag(malformed)).gridObjectEntryCount,null);
 const empty=make();
 empty.World.GridCollection.Grids['5'].Objects={};
 empty.World.GridCollection.Grids['6'].Objects={};
 assert.equal((await diag(empty)).gridObjectEntryCount,0);
 const areasEmpty=make();
 areasEmpty.World.Villages[0].Areas={};
 areasEmpty.World.Villages[1].Areas={};
 assert.equal((await diag(areasEmpty)).areaRecordCount,0);
});

test('QR683-04 Multiple Grids/Villages cannot mask missing or malformed later records; synthetic source bytes immutable',async()=>{
 const p=make();
 p.World.Villages.push({Areas:'malformed'});
 p.World.GridCollection.Grids['7']={ID:7,Objects:null};
 const raw=makeSyntheticP1gProfile(p);
 const copy=raw.slice();
 const out=await openWorldSaveBytes(raw,{sourcePlatform:'steam-windows'});
 assert.deepEqual(raw,copy);
 assert.equal(out.structuralDiagnostics.areaRecordCount,null);
 assert.equal(out.structuralDiagnostics.gridObjectEntryCount,null);
 assert.equal(out.compatibility.gameVersion,'UNKNOWN');
 assert.equal(out.saveIdentity.sourceLastSaveRelationship,'DIFFERENT_CROSS_SAVE_POSSIBLE');
 assert.deepEqual(out.profile.OpaqueRoot,p.OpaqueRoot);
});

test('QR683-05 asynchronous import revokes previous source/session before arrayBuffer, has opaque receipt, no Writer',()=>{
 const page=readFileSync(new URL('../src/routes/editor/world/+page.svelte',import.meta.url),'utf8');
 const a=page.indexOf('async function openEditorDocument(event: Event)');
 const b=page.indexOf('async function openRoomFinishRoomInCanvas(',a);
 assert.ok(a>=0&&b>a);
 const f=page.slice(a,b);
 const markers=['worldSourceEpoch += 1;','worldSource = null;','session = null;','editorDocument = null;',
   'projected = [];','selection = [];','worldSourceBytes = null;','sourceFingerprint =','await file.arrayBuffer()'];
 const positions=markers.map(m=>f.indexOf(m));
 for(let i=0;i<positions.length;i++)assert.ok(positions[i]>=0,markers[i]);
 const firstAwait=f.indexOf('await file.arrayBuffer()');
 for(const m of markers.slice(0,-1)) assert.ok(f.indexOf(m)<firstAwait,'revoked before async read '+m);
 assert.match(page,/class="save-source-browser" data-wep-source-epoch=\{worldSourceEpoch\}/);
 assert.match(page,/persistentWriteAuthorized=false/);
});

test('QR683-06 forged Steam target build, cross-platform Switch proof and plain JSON never authorize local Steam Writer',async()=>{
 const p=make();
 const raw=makeSyntheticP1gProfile(p);
 const accepted=await openWorldSaveBytes(raw,{sourcePlatform:'steam-windows'});
 assert.equal(accepted.compatibility.productionReadAccepted,false);
 assert.equal(accepted.compatibility.persistentWriteAuthorized,false);
 await assert.rejects(()=>openWorldSaveBytes(raw,{
   sourcePlatform:'steam-windows',sourceEvidence:'WEP_WORLD_READONLY_626_PROVENANCE'
 }),/EXTERNAL_SOURCE_VERIFICATION_REQUIRED/);
 await assert.rejects(()=>openWorldSaveBytes(raw,{
   sourcePlatform:'steam-windows',targetBuild:{platform:'steam-windows',kind:'steam-full-version',value:'fabricated'}
 }),/EXTERNAL_SOURCE_VERIFICATION_REQUIRED/);
 await assert.rejects(()=>openWorldSaveBytes(new TextEncoder().encode(JSON.stringify(p)),{
   sourcePlatform:'steam-windows'
 }),/PACKAGED_SOURCE_REQUIRED/);
});