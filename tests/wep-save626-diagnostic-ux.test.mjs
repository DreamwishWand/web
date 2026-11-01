import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  save626DiagnosticCopy, SAVE626_DIAGNOSTIC_LOCALES
} from '../src/lib/wep/save626-diagnostics-copy.js';
import {
  CURRENT_PROFILE_READ_CONTRACTS, matchProfileReadContract,
  detectSaveIdentity, ProfileReadCompatibilityStatus
} from '../src/lib/ddv/core/save/versioning.js';

test('8 locale diagnostic addenda have explicit Collection, unknown and local-only boundaries', () => {
  assert.deepEqual(SAVE626_DIAGNOSTIC_LOCALES.slice().sort(),
    ['en','fr','it','de','es-ES','ja','zh-CN','pt-BR'].sort());
  for(const l of SAVE626_DIAGNOSTIC_LOCALES){
    const c=save626DiagnosticCopy(l);
    for(const key of ['collectionBoundary','incompleteDiagnostic','localOnly']){
      assert.equal(typeof c[key],'string');
      assert.ok([...c[key]].length>=16, l+':'+key);
      assert.ok(!/https?:\/\//.test(c[key]));
    }
  }
  assert.match(save626DiagnosticCopy('en').incompleteDiagnostic,/unknown, not zero/);
  assert.match(save626DiagnosticCopy('ja').collectionBoundary,/未検証/);
});

test('Source read registry only accepts exact Switch BID/Version/Schema with independent source', () => {
  const target={platform:'switch',kind:'switch-bid',value:'9A239D3DB569756D'};
  const identity=detectSaveIdentity({GameInfo:{Version:626,
    LastSaveDeviceInfo:{deviceType:'DeviceType_Windows'}}},{sourcePlatform:'switch'});
  const exact=matchProfileReadContract(identity,target);
  assert.equal(exact.status,ProfileReadCompatibilityStatus.ExactAccepted);
  assert.equal(exact.contract.gameVersion,'1.25.3');
  assert.equal(exact.contract.productionReadAccepted,true);
  assert.equal(matchProfileReadContract(identity,{...target,value:'52BD625D9B4E0053'}).status,
    ProfileReadCompatibilityStatus.SchemaMismatch);
  assert.equal(matchProfileReadContract(identity,{...target,value:'0000000000000000'}).status,
    ProfileReadCompatibilityStatus.UnsupportedBuild);
  assert.equal(matchProfileReadContract({...identity,sourcePlatform:'unknown'},target).status,
    ProfileReadCompatibilityStatus.SourcePlatformMismatch);
  assert.equal(matchProfileReadContract({...identity,profileGameInfoVersion:625},target).status,
    ProfileReadCompatibilityStatus.SchemaMismatch);
  assert.equal(CURRENT_PROFILE_READ_CONTRACTS.find(c=>c.id.includes('switch-v1.25.3')).persistentWriteAuthorized,
    undefined);
});

test('World Editor 626 UI cannot leak personal collection or activate editor via incomplete diagnostics',()=>{
  const source=fs.readFileSync(new URL('../src/routes/editor/world/+page.svelte',import.meta.url),'utf8');
  const w=fs.readFileSync(new URL('../src/lib/wep/world-save-source.ts',import.meta.url),'utf8');
  const catalog=fs.readFileSync(new URL('../src/lib/collection/runtime.js',import.meta.url),'utf8');
  assert.match(source,/data-wep-626-incomplete/);
  assert.match(source,/data-wep-626-collection-gated/);
  assert.match(source,/data-wep-626-local-only/);
  assert.match(source,/opened\.compatibility\.readOnly \? null : bytes\.slice\(\)/);
  assert.match(source,/opened\.compatibility\.readOnly\s*\? null\s*: createOriginalSaveBackup/);
  assert.match(w,/routesAuthorized: false/);
  assert.match(w,/editingAuthorized: false/);
  assert.match(w,/verifiedReplacementCandidateAuthorized: false/);
  assert.match(w,/productApplyAuthorized: false/);
  assert.match(w,/persistentWriteAuthorized: false/);
  assert.match(catalog,/gameVersion !== '1\.25\.0'/);
  assert.match(catalog,/buildID !== '52BD625D9B4E0053'/);
});
