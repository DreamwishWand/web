import test from 'node:test';
import assert from 'node:assert/strict';
import {validateOwnerLocalSteamAttestation,
 OWNER_LOCAL_V1_ATTESTATION_CONTRACT,OWNER_LOCAL_STEAM_FULL_VERSION}
 from '../tools/owner-local-steam-v1/attestation.mjs';
const SHA='c'.repeat(64);
const CLAIM={contract:OWNER_LOCAL_V1_ATTESTATION_CONTRACT,
 platform:'steam-windows',buildKind:'steam-full-version',
 fullVersion:OWNER_LOCAL_STEAM_FULL_VERSION,schema:626,originalSha256:SHA,
 evidenceKind:'owner-observed-installed-steam-fullversion',
 observedOutsideSave:true};
test('Owner-local exact external Steam candidate and SHA never authorizes product/physical build',()=>{
 const r=validateOwnerLocalSteamAttestation(CLAIM);
 assert.equal(r.expectedOriginalSha256,SHA);
 assert.equal(r.physicalBuildVerified,false);
 assert.equal(r.synthetic,false);
 assert.deepEqual(r.build,{
  platform:'steam-windows',buildKind:'steam-full-version',
  buildId:OWNER_LOCAL_STEAM_FULL_VERSION,schema:626,externallyConfirmed:true
 });
 assert.ok(!('writerAuthorized' in r));
});
test('Unknown version, wrong platform/BID, schema624 and cross-save device inference denied',()=>{
 for(const bad of [
  {},{platform:'switch'},{buildKind:'switch-bid'},
  {fullVersion:'unknown'},{fullVersion:'1.25.3'},
  {schema:624},{schema:625},{observedOutsideSave:false},
  {evidenceKind:'from-save-gameinfo-last-save-device'},
  {deviceType:'DeviceType_Switch'},
  {buildId:'9A239D3DB569756D'},{steamBuildProof:true}
 ]){
  assert.throws(()=>validateOwnerLocalSteamAttestation({...CLAIM,...bad}),
    /OWNER_LOCAL_WAIT/);
 }
});
test('Expected source sha mandatory, strictly lower-case hex; missing attestation WAIT_BUILD',()=>{
 assert.throws(()=>validateOwnerLocalSteamAttestation(null),/WAIT_BUILD/);
 for(const sha of ['',SHA.toUpperCase(),'G'.repeat(64),'0'.repeat(63),'0'.repeat(65),42]){
  assert.throws(()=>validateOwnerLocalSteamAttestation({...CLAIM,originalSha256:sha}),
   /OWNER_LOCAL_WAIT_SOURCE_SHA256/);
 }
});
test('CI synthetic fixtures never accepted in owner-only non-CI Worker',()=>{
 const synth={...CLAIM,evidenceKind:'ci-synthetic-fixture',observedOutsideSave:false};
 assert.throws(()=>validateOwnerLocalSteamAttestation(synth),/SYNTHETIC_NOT_AUTHORIZED/);
 const r=validateOwnerLocalSteamAttestation(synth,{allowSyntheticFixture:true});
 assert.equal(r.synthetic,true);
 assert.equal(r.physicalBuildVerified,false);
 assert.equal(r.evidenceKind,'ci-synthetic-fixture');
 assert.throws(()=>validateOwnerLocalSteamAttestation(
   {...synth,observedOutsideSave:true},{allowSyntheticFixture:true}),/SYNTHETIC/);
});
