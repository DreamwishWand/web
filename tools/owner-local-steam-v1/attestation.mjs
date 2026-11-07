// Owner-local READ_ONLY claim parser. Does NOT prove a physical game build.
// No personal Save is sent to GitHub, Pages, a provider or any network endpoint.
export const OWNER_LOCAL_V1_ATTESTATION_CONTRACT='wand.owner.local.steam-p1g-rust-v1@1';
export const OWNER_LOCAL_STEAM_FULL_VERSION='releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22';
const shaHex=/^[a-f0-9]{64}$/;
const fail=code=>{throw Error(code)};
const plain=o=>o!==null&&typeof o==='object'&&!Array.isArray(o)&&
  Object.getPrototypeOf(o)===Object.prototype;
export function validateOwnerLocalSteamAttestation(attestation,{allowSyntheticFixture=false}={}){
  if(!plain(attestation))fail('OWNER_LOCAL_WAIT_BUILD_ATTESTATION_REQUIRED');
  const keys=['contract','platform','buildKind','fullVersion','schema',
    'originalSha256','evidenceKind','observedOutsideSave'].sort().join(',');
  if(Object.keys(attestation).sort().join(',')!==keys)
    fail('OWNER_LOCAL_WAIT_BUILD_ATTESTATION_FIELDS');
  if(attestation.contract!==OWNER_LOCAL_V1_ATTESTATION_CONTRACT||
     attestation.platform!=='steam-windows'||
     attestation.buildKind!=='steam-full-version'||
     attestation.fullVersion!==OWNER_LOCAL_STEAM_FULL_VERSION||
     attestation.schema!==626)
    fail('OWNER_LOCAL_WAIT_BUILD_EXACT_STEAM_VERSION');
  if(typeof attestation.originalSha256!=='string'||
     !shaHex.test(attestation.originalSha256))
    fail('OWNER_LOCAL_WAIT_SOURCE_SHA256');
  const synthetic=attestation.evidenceKind==='ci-synthetic-fixture';
  if(synthetic){
    if(!allowSyntheticFixture||attestation.observedOutsideSave!==false)
      fail('OWNER_LOCAL_WAIT_BUILD_SYNTHETIC_NOT_AUTHORIZED');
  }else if(attestation.evidenceKind!=='owner-observed-installed-steam-fullversion'||
           attestation.observedOutsideSave!==true){
    fail('OWNER_LOCAL_WAIT_BUILD_INDEPENDENT_OBSERVATION');
  }
  // "externallyConfirmed" is necessary for the existing Rust dev-only
  // target allowlist, but neither this claim nor schema626 alone physically
  // proves a Steam installation or permits PRODUCT_OPERATION_ENABLED.
  return Object.freeze({
    expectedOriginalSha256:attestation.originalSha256,
    evidenceKind:attestation.evidenceKind,
    synthetic,
    physicalBuildVerified:false,
    build:Object.freeze({
      platform:'steam-windows',buildKind:'steam-full-version',
      buildId:OWNER_LOCAL_STEAM_FULL_VERSION,schema:626,
      externallyConfirmed:true
    })
  });
}
