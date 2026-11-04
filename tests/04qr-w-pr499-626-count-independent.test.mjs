/**
 * 04QR-W / PR499 frozen source-only 626 gridObjectEntryCount repair QA.
 * No genuine user P1G. No re-run accepted 04QR470/489/491 scope.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {
 openWorldSaveBytes, WEP_WORLD_READONLY_626_PROVENANCE
} from '../src/lib/wep/world-save-source.ts';
import {makeSyntheticP1gProfile} from './helpers/p1g-fixture.mjs';

const MAIN='5b1b1d359a7be27455556f708b5959ffed9e13f3';
const SOURCE='1110f5359f4bcd9b1e27cc78c41c4de688920c6f';
const original=[
 ['scripts/wep-schema626-readonly-browser-acceptance.mjs','7c63a131e5dc75002e06158c7a826ceb03feaa8e'],
 ['src/lib/wep/world-save-source.ts','9888b91c92953cf0f9fd828d2ba0cb763e35dac5'],
 ['tests/wep-schema626-gridobject-structural-count.test.mjs','ab48f8e251511c017d81b130ceef04a040c8a8d4'],
 ['tests/wep-world-readonly626.test.mjs','5719697f0dcabaf8b1008082346568e7d289627b']
];
const git=(...a)=>execFileSync('git',a,{encoding:'utf8'}).trim();
const accepted={
 sourcePlatform:'switch',
 targetBuild:{platform:'switch',kind:'switch-bid',value:'9A239D3DB569756D'},
 sourceEvidence:WEP_WORLD_READONLY_626_PROVENANCE
};
const profile=()=>({
 GameInfo:{Version:626,InitialVersion:518,LastSaveDeviceInfo:{deviceType:'DeviceType_Windows'}},
 Player:{},World:{
  Villages:[{Areas:{'7':{GridIDs:[10],Unlocked:true}}}],
  GridCollection:{
   Grids:{'10':{ID:10,Objects:{
    '42':{State:{FutureOpaque:true}},
    '43':{State:{FutureOpaque:true}}
   }}},
   DiffGrids:{'10':{ID:10,Objects:{'99':{State:{}}}}}
  }
 }
});
const inspect=async p=>{
 const bytes=makeSyntheticP1gProfile(p);
 const original=bytes.slice();
 let out;
 try {out=await openWorldSaveBytes(bytes,accepted);}
 catch(e){ assert.deepEqual(bytes,original);return {error:e}; }
 assert.deepEqual(bytes,original);
 return out;
};

test('protected main5b → PR499 exact four changes, all other WEP/01B/Worker sources untouched',()=>{
 assert.equal(git('merge-base',MAIN,SOURCE),MAIN);
 assert.deepEqual(git('diff','--name-only',MAIN,SOURCE).split('\n').sort(),
  original.map(x=>x[0]).sort());
 for(const [p,sha] of original)assert.equal(git('hash-object',p),sha,p);
 assert.equal(git('hash-object','src/routes/editor/world/+page.svelte'),
  '5ae7f7640a99b05083b20b784fb0cbf3693fee84');
 assert.equal(git('hash-object','src/lib/wep/real-save-spatial-read.ts'),
  '48b32c3bd3132c6e48a47d7b8f017a35642d2623');
});

test('QA-only exact three new paths, never source mutation or QA ancestor re-run',()=>{
 assert.deepEqual(git('diff','--name-only',SOURCE,'HEAD').split('\n').sort(),[
  '.github/workflows/04qr-w-pr499-626-count-independent.yml',
  'scripts/04qr-w-pr499-626-count-actual-chromium.mjs',
  'tests/04qr-w-pr499-626-count-independent.test.mjs'
 ]);
});

test('new typed structural 626 count excludes overlapping DiffGrids and does not grant any Writer',async()=>{
 const p=profile();
 const r=await inspect(p);
 assert.ok(!r.error,r.error?.message);
 assert.equal(r.structuralDiagnostics?.gridObjectEntryCount,2);
 assert.equal(r.structuralDiagnostics?.gridRecordCount,1);
 assert.equal(r.compatibility.readOnly,true);
 assert.equal(r.compatibility.routesAuthorized,false);
 assert.equal(r.compatibility.persistentWriteAuthorized,false);
 assert.equal(r.compatibility.productApplyAuthorized,false);
 assert.notEqual(r.structuralDiagnostics?.gridObjectEntryCount,3);
});

test('malformed missing, array, string raw Objects refuse invented 0; synthetic source immutability',async()=>{
 for(const mutation of [
  p=>{delete p.World.GridCollection.Grids['10'].Objects;},
  p=>{p.World.GridCollection.Grids['10'].Objects=[];},
  p=>{p.World.GridCollection.Grids['10'].Objects='fake';},
  p=>{p.World.GridCollection.Grids['10'].Objects=null;},
  p=>{delete p.World.GridCollection.Grids;}
 ]){
  const p=profile(); mutation(p);
  const r=await inspect(p);
  if(r.error){assert.match(String(r.error.message),/INVALID|GRID|PROFILE|STRUCTURAL|CONTRACT/i);}
  else{
   assert.equal(r.structuralDiagnostics?.gridObjectEntryCount,null);
   assert.equal(r.compatibility.persistentWriteAuthorized,false);
   assert.equal(r.compatibility.productApplyAuthorized,false);
  }
 }
});

test('626 count remains diagnostic-only in UI, direct source path cannot mint 2D/Provider',()=>{
 const source=readFileSync('src/lib/wep/world-save-source.ts','utf8');
 const ui=readFileSync('src/routes/editor/world/+page.svelte','utf8');
 assert.match(source,/gridObjectEntryCount: number \| null/);
 assert.match(source,/gridObjectEntryCount,/);
 assert.match(ui,/worldSource\.structuralDiagnostics\?\.gridObjectEntryCount \?\? '—'/);
 assert.match(ui,/data-wep-626-gridobject-entries/);
 const chrome=readFileSync('scripts/04qr-w-pr499-626-count-actual-chromium.mjs','utf8');
 assert.match(chrome,/serviceWorkers:'block'/);
 assert.match(chrome,/routeWebSocket\('\*\*\/\*'/);
 assert.match(chrome,/\['GET','HEAD'\]\.includes\(route\.request\(\)\.method\(\)\)/);
 assert.match(chrome,/QA_MUST_NOT_USE_OWNER_PRIVATE_P1G/);
});
