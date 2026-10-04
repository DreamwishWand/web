import { SafeProfileEditSession, diffPaths } from '../ddv/core/save/safe-edit-session.js';
import {
  BuildIdentityKind,
  BuildMatchStatus,
  PlatformFamily,
  RuntimeGateStatus,
  matchSupportedBuild
} from '../ddv/core/save/versioning.js';
import {
  NATIVE_PRESET_ACTIVE_LIMIT,
  NATIVE_PRESET_BACKUP_SCHEMA,
  NATIVE_PRESET_PROFILE_SCHEMA,
  nativePresetPayloadIsDeleted,
  nativePresetPayloadWarnings,
  validateNativePresetBackup
} from './native-preset-runtime.js';

export const NATIVE_PRESET_RESTORE_CONTRACT='ddv.native-decoration-preset-persistent-restore-v125@1';
export const NATIVE_PRESET_RESTORE_CANDIDATE_CONTRACT='ddv.native-decoration-preset-restore-write-candidate@1';
export const NATIVE_PRESET_RESTORE_VERIFICATION_CONTRACT='ddv.native-decoration-preset-restore-verification@1';
export const NATIVE_PRESET_RESTORE_OPERATION_ID='NATIVE_DECORATION_PRESET_RESTORE_APPEND_V125';
export const NATIVE_PRESET_RESTORE_SEMANTIC_OWNER='01 CORE / 01E — Native DecorationPreset Restore';
export const NATIVE_PRESET_RESTORE_ALLOWED_PATH='/World/DecorationPresets';
export const NATIVE_PRESET_RESTORE_SWITCH_BID='52BD625D9B4E0053';
export const NATIVE_PRESET_RESTORE_GAME_VERSION='1.25.0';

export const NATIVE_PRESET_RESTORE_SWITCH_TARGET=Object.freeze({
  platform:PlatformFamily.Switch,
  kind:BuildIdentityKind.SwitchBid,
  value:NATIVE_PRESET_RESTORE_SWITCH_BID
});

const SOURCE_EVIDENCE=Object.freeze([
  Object.freeze({id:'DDV-V1.25-WAND-PRESET-IMPLEMENTATION-STATIC-CONTRACT-2026-09-29',status:'CONFIRMED_STATIC'}),
  Object.freeze({id:'DDV-V1.25-WAND-CONTROLLED-RUNTIME-P1I-2026-09-30',status:'CONFIRMED_SWITCH_APPEND_PERSISTENCE_ORACLE'}),
  Object.freeze({id:'DDV-SAFE-PERSISTENT-TRANSACTION-FOUNDATION-V125-V1_0',status:'INTEGRATOR_PROMOTED'})
]);

function asRecord(value){return value!==null&&typeof value==='object'&&!Array.isArray(value)?value:null;}
function safeInt(value){const n=Number(value);return Number.isSafeInteger(n)?n:null;}
function clone(value){return structuredClone(value);}
function canonicalize(value){
  if(Array.isArray(value))return value.map(canonicalize);
  if(value&&typeof value==='object'){
    const out={};
    for(const key of Object.keys(value).sort())out[key]=canonicalize(value[key]);
    return out;
  }
  return value;
}
function canonicalJson(value){return JSON.stringify(canonicalize(value));}
function semanticEqual(a,b){return canonicalJson(a)===canonicalJson(b);}
function sameStrings(a,b){return a.length===b.length&&a.every((v,i)=>v===b[i]);}
function unique(values){return [...new Set(values)];}
function fail(code,detail=''){
  const error=new Error(detail?`${code}: ${detail}`:code);
  error.code=code;
  return error;
}
async function sha256Hex(bytes){
  if(!globalThis.crypto?.subtle)throw fail('NATIVE_PRESET_RESTORE_WEBCRYPTO_UNAVAILABLE');
  const digest=await globalThis.crypto.subtle.digest('SHA-256',bytes);
  return [...new Uint8Array(digest)].map(v=>v.toString(16).padStart(2,'0')).join('');
}
async function sha256Canonical(value){return sha256Hex(new TextEncoder().encode(canonicalJson(value)));}

function targetIsExactSwitchV125(target){
  return target?.platform===PlatformFamily.Switch
    && target?.kind===BuildIdentityKind.SwitchBid
    && target?.value===NATIVE_PRESET_RESTORE_SWITCH_BID;
}
function presetList(profile){return asRecord(profile?.World)?.DecorationPresets;}
function destinationPresetState(presets){
  let active=0;
  const invalidStateFlagIndices=[];
  for(let i=0;i<presets.length;i++){
    const flags=safeInt(presets[i]?.StateFlags);
    if(flags===null||flags<0){invalidStateFlagIndices.push(i);continue;}
    if(!nativePresetPayloadIsDeleted(presets[i]))active++;
  }
  return {active,physical:presets.length,invalidStateFlagIndices};
}
function supportedBackupShape(payload,reasons){
  const record=asRecord(payload);
  if(!record){reasons.push('BACKUP_PAYLOAD_OBJECT_REQUIRED');return;}
  const collection=asRecord(record.GridCollection);
  const grids=asRecord(collection?.Grids);
  const diffs=asRecord(collection?.DiffGrids);
  if(!collection)reasons.push('BACKUP_GRID_COLLECTION_REQUIRED');
  if(!grids)reasons.push('BACKUP_GRIDS_REQUIRED');
  else if(Object.keys(grids)[0]!=='0')reasons.push('BACKUP_ROOT_GRID_0_MUST_SERIALIZE_FIRST');
  if(!diffs)reasons.push('BACKUP_DIFF_GRIDS_OBJECT_REQUIRED');
  else if(Object.keys(diffs).length!==0)reasons.push('BACKUP_DIFF_GRIDS_EMPTY_REQUIRED');
  if(typeof record.PresetName!=='string')reasons.push('BACKUP_PRESET_NAME_STRING_REQUIRED');
  if(!Array.isArray(record.ThumbnailItems)||record.ThumbnailItems.some(v=>safeInt(v)===null||safeInt(v)<0))
    reasons.push('BACKUP_THUMBNAIL_ITEMS_INVALID');
  const flags=safeInt(record.StateFlags);
  if(flags===null||flags<0)reasons.push('BACKUP_STATE_FLAGS_INVALID');
  else{
    if(nativePresetPayloadIsDeleted(record))reasons.push('BACKUP_DELETED_TOMBSTONE_UNSUPPORTED');
    if(flags!==0)reasons.push('BACKUP_STATE_FLAGS_ZERO_REQUIRED');
  }
  if(record.ShareInfo!==null)reasons.push('BACKUP_SHARE_INFO_NULL_REQUIRED');
  const warnings=nativePresetPayloadWarnings(record);
  if(warnings.length)reasons.push(...warnings.map(code=>`BACKUP_SHAPE_${code}`));
}

export function classifyNativePresetRestoreV125({
  profile,
  backup,
  sourcePlatform=PlatformFamily.Unknown,
  targetBuild=NATIVE_PRESET_RESTORE_SWITCH_TARGET
}={}){
  const reasons=[];
  if(sourcePlatform!==PlatformFamily.Switch||!targetIsExactSwitchV125(targetBuild))
    reasons.push('EXACT_SWITCH_V125_BUILD_REQUIRED');

  const gameInfo=asRecord(profile?.GameInfo);
  if(safeInt(gameInfo?.Version)!==NATIVE_PRESET_PROFILE_SCHEMA)reasons.push('PROFILE_SCHEMA_624_REQUIRED');
  const presets=presetList(profile);
  if(!Array.isArray(presets))reasons.push('NATIVE_PRESET_LIST_REQUIRED');

  let validBackup=null;
  try{validBackup=validateNativePresetBackup(backup);}
  catch{reasons.push('BACKUP_SCHEMA_UNSUPPORTED');}
  if(validBackup){
    if(validBackup.schema!==NATIVE_PRESET_BACKUP_SCHEMA||validBackup.version!==1)reasons.push('BACKUP_SCHEMA_UNSUPPORTED');
    if(safeInt(validBackup?.source?.profileSchemaVersion)!==NATIVE_PRESET_PROFILE_SCHEMA)
      reasons.push('BACKUP_PROFILE_SCHEMA_624_REQUIRED');
    if(validBackup.deleted!==false)reasons.push('BACKUP_ACTIVE_SOURCE_REQUIRED');
    supportedBackupShape(validBackup.payload,reasons);
  }

  let state=null;
  if(Array.isArray(presets)){
    state=destinationPresetState(presets);
    if(state.invalidStateFlagIndices.length)reasons.push('DESTINATION_STATE_FLAGS_INVALID');
    if(state.active>=NATIVE_PRESET_ACTIVE_LIMIT)reasons.push('NATIVE_ACTIVE_LIMIT_REACHED');
  }

  const reasonCodes=Object.freeze(unique(reasons));
  if(reasonCodes.length){
    return Object.freeze({
      contract:NATIVE_PRESET_RESTORE_CONTRACT,
      status:'REJECTED',
      admissible:false,
      reasonCodes,
      persistentWriteAuthorized:false,
      PERSISTENT_WRITE:false,
      productApplyAuthorized:false,
      directSourceReplacementAuthorized:false
    });
  }

  return Object.freeze({
    contract:NATIVE_PRESET_RESTORE_CONTRACT,
    status:'ADMISSIBLE',
    admissible:true,
    reasonCodes:Object.freeze([]),
    target:Object.freeze({
      platform:PlatformFamily.Switch,
      gameVersion:NATIVE_PRESET_RESTORE_GAME_VERSION,
      profileSchemaVersion:NATIVE_PRESET_PROFILE_SCHEMA,
      buildIdentity:NATIVE_PRESET_RESTORE_SWITCH_BID
    }),
    operation:'APPEND_ONLY',
    destination:Object.freeze({
      physicalPresetCountBefore:state.physical,
      activePresetCountBefore:state.active,
      physicalPresetIndex:state.physical,
      activeSlotOrdinalZeroBased:state.active,
      physicalPresetCountAfter:state.physical+1,
      activePresetCountAfter:state.active+1,
      tombstoneReuse:false,
      replacement:false
    }),
    payload:clone(validBackup.payload),
    backup:Object.freeze({
      id:String(validBackup.id??''),
      sourcePhysicalPresetIndex:safeInt(validBackup?.source?.physicalPresetIndex),
      sourceActiveSlotOrdinalZeroBased:safeInt(validBackup?.source?.activeSlotOrdinalZeroBased),
      sourceProfileSchemaVersion:NATIVE_PRESET_PROFILE_SCHEMA
    }),
    preservation:Object.freeze({
      preExistingPhysicalEntries:'BYTE_SEMANTIC_UNCHANGED',
      unrelatedProfileState:'UNCHANGED',
      unknownPayloadFields:'OPAQUE_COPIED',
      sourcePhysicalIndex:'PROVENANCE_ONLY_NOT_COPIED_AS_IDENTITY',
      nativeShareValidity:'NOT_SYNTHESIZED'
    }),
    persistentWriteAuthorized:false,
    PERSISTENT_WRITE:false,
    productApplyAuthorized:false,
    directSourceReplacementAuthorized:false
  });
}

function requireSession(session){
  if(!session||typeof session.getSnapshot!=='function'||typeof session.getPreflightContext!=='function'||
     typeof session.exportVerifiedCopy!=='function'||!(session.source instanceof Uint8Array))
    throw fail('NATIVE_PRESET_RESTORE_SAFE_SESSION_REQUIRED');
}
function runtimeOperation(){
  return Object.freeze({
    id:NATIVE_PRESET_RESTORE_OPERATION_ID,
    owner:NATIVE_PRESET_RESTORE_SEMANTIC_OWNER,
    kind:'APPEND_NATIVE_DECORATION_PRESET',
    structuralCapabilitiesSupported:true,
    planSupported:true,
    validationPassed:true,
    runtimeGate:RuntimeGateStatus.Pending
  });
}

export async function createNativePresetRestoreWriteCandidate({
  session,
  backup,
  targetBuild=NATIVE_PRESET_RESTORE_SWITCH_TARGET,
  candidateId='01e-native-preset-restore-v125'
}={}){
  requireSession(session);
  const ctx=session.getPreflightContext();
  const build=matchSupportedBuild(ctx.saveIdentity,targetBuild);
  if(build.status!==BuildMatchStatus.Exact||!build.contract)
    throw fail('NATIVE_PRESET_RESTORE_UNSUPPORTED_TARGET_BUILD',build.reason);
  if(build.contract.gameVersion!==NATIVE_PRESET_RESTORE_GAME_VERSION||ctx.saveIdentity.sourcePlatform!==PlatformFamily.Switch)
    throw fail('NATIVE_PRESET_RESTORE_EXACT_SWITCH_SOURCE_REQUIRED');

  const before=session.getSnapshot();
  const preflight=classifyNativePresetRestoreV125({
    profile:before,backup,sourcePlatform:ctx.saveIdentity.sourcePlatform,targetBuild
  });
  if(!preflight.admissible)
    throw fail('NATIVE_PRESET_RESTORE_PREFLIGHT_FAILED',preflight.reasonCodes.join(','));

  const validBackup=validateNativePresetBackup(backup);
  const payload=clone(preflight.payload);
  const operation=runtimeOperation();
  const exportResult=await session.exportVerifiedCopy({
    edit(draft){
      const atApply=classifyNativePresetRestoreV125({
        profile:draft,backup:validBackup,sourcePlatform:PlatformFamily.Switch,targetBuild
      });
      if(!atApply.admissible)throw fail('NATIVE_PRESET_RESTORE_SOURCE_DRIFT',atApply.reasonCodes.join(','));
      if(atApply.destination.physicalPresetIndex!==preflight.destination.physicalPresetIndex||
         atApply.destination.activePresetCountBefore!==preflight.destination.activePresetCountBefore)
        throw fail('NATIVE_PRESET_RESTORE_SOURCE_DRIFT');
      draft.World.DecorationPresets.push(clone(payload));
    },
    exactAllowedPaths:[NATIVE_PRESET_RESTORE_ALLOWED_PATH],
    targetBuild,
    operation
  });

  if(exportResult.noOp||!sameStrings([...exportResult.changedPaths],[NATIVE_PRESET_RESTORE_ALLOWED_PATH]))
    throw fail('NATIVE_PRESET_RESTORE_UNEXPECTED_GENERATED_DIFF',exportResult.changedPaths.join(','));

  const backupRecordSha256=await sha256Canonical(validBackup);
  const payloadSha256=await sha256Canonical(payload);
  const baseManifest=Object.freeze({
    contract:NATIVE_PRESET_RESTORE_CANDIDATE_CONTRACT,
    restoreContract:NATIVE_PRESET_RESTORE_CONTRACT,
    candidateId:String(candidateId),
    semanticOwner:NATIVE_PRESET_RESTORE_SEMANTIC_OWNER,
    capability:Object.freeze({required:'WRITE_CANDIDATE',writeCandidate:true,persistentWrite:false}),
    input:Object.freeze({
      platform:PlatformFamily.Switch,
      gameVersion:NATIVE_PRESET_RESTORE_GAME_VERSION,
      profileGameInfoVersion:NATIVE_PRESET_PROFILE_SCHEMA,
      targetBuild:clone(targetBuild),
      exactBuildContractId:build.contract.id,
      codecContract:ctx.codecContract,
      inputFormat:ctx.inputFormat,
      originalFileLength:session.source.length,
      originalSha256:exportResult.sourceRawSha256
    }),
    output:Object.freeze({
      candidateFileLength:exportResult.editedBytes.length,
      candidateSha256:exportResult.editedRawSha256,
      inputFormat:exportResult.format
    }),
    sourceBackup:Object.freeze({
      schema:validBackup.schema,
      version:validBackup.version,
      id:String(validBackup.id??''),
      backupRecordSha256,
      payloadSha256,
      sourcePhysicalPresetIndex:safeInt(validBackup?.source?.physicalPresetIndex),
      sourceActiveSlotOrdinalZeroBased:safeInt(validBackup?.source?.activeSlotOrdinalZeroBased)
    }),
    destination:clone(preflight.destination),
    operation:Object.freeze({
      id:operation.id,
      kind:operation.kind,
      owner:operation.owner,
      runtimeGate:operation.runtimeGate,
      allowedChanges:Object.freeze([NATIVE_PRESET_RESTORE_ALLOWED_PATH])
    }),
    preservation:clone(preflight.preservation),
    sourceEvidence:clone(SOURCE_EVIDENCE),
    verificationAtGeneration:Object.freeze({
      canonicalReopen:'PASS',
      schemaVersion:'PASS',
      exactAllowedPath:'PASS',
      unrelatedStatePreservation:'PASS_BY_EXACT_DIFF',
      preExistingPresetPreservation:'REQUIRES_INDEPENDENT_VERIFIER',
      appendedPayloadEquivalence:'REQUIRES_INDEPENDENT_VERIFIER'
    }),
    persistentWriteAuthorized:false,
    PERSISTENT_WRITE:false,
    productApplyAuthorized:false,
    directSourceReplacementAuthorized:false
  });
  const manifestSha256=await sha256Canonical(baseManifest);
  const manifest=Object.freeze({...baseManifest,manifestSha256});

  return Object.freeze({
    contract:NATIVE_PRESET_RESTORE_CANDIDATE_CONTRACT,
    manifest,
    sourceBackup:clone(validBackup),
    expectedPayload:payload,
    backupOriginalBytes:exportResult.backupOriginalBytes.slice(),
    candidateBytes:exportResult.editedBytes.slice(),
    persistentWriteAuthorized:false,
    PERSISTENT_WRITE:false,
    productApplyAuthorized:false,
    directSourceReplacementAuthorized:false
  });
}

function requireCandidate(candidate){
  if(!candidate||candidate.contract!==NATIVE_PRESET_RESTORE_CANDIDATE_CONTRACT||
     candidate.manifest?.contract!==NATIVE_PRESET_RESTORE_CANDIDATE_CONTRACT||
     !(candidate.backupOriginalBytes instanceof Uint8Array)||!(candidate.candidateBytes instanceof Uint8Array))
    throw fail('NATIVE_PRESET_RESTORE_CANDIDATE_INVALID');
  for(const key of ['persistentWriteAuthorized','PERSISTENT_WRITE','productApplyAuthorized','directSourceReplacementAuthorized']){
    if(candidate[key]!==false||candidate.manifest[key]!==false)
      throw fail('NATIVE_PRESET_RESTORE_SAFETY_FLAG_MISMATCH',key);
  }
}

export async function verifyNativePresetRestoreWriteCandidate({
  candidate,
  codec,
  targetBuild=NATIVE_PRESET_RESTORE_SWITCH_TARGET
}={}){
  requireCandidate(candidate);
  if(!codec||typeof codec.loadProfile!=='function')throw fail('NATIVE_PRESET_RESTORE_CODEC_REQUIRED');
  if(!targetIsExactSwitchV125(targetBuild)||!semanticEqual(candidate.manifest.input.targetBuild,targetBuild))
    throw fail('NATIVE_PRESET_RESTORE_VERIFIER_TARGET_MISMATCH');

  const manifestWithoutHash={...candidate.manifest};
  delete manifestWithoutHash.manifestSha256;
  if(await sha256Canonical(manifestWithoutHash)!==candidate.manifest.manifestSha256)
    throw fail('NATIVE_PRESET_RESTORE_MANIFEST_HASH_MISMATCH');
  if(await sha256Canonical(candidate.sourceBackup)!==candidate.manifest.sourceBackup.backupRecordSha256)
    throw fail('NATIVE_PRESET_RESTORE_BACKUP_RECORD_HASH_MISMATCH');
  if(await sha256Canonical(candidate.expectedPayload)!==candidate.manifest.sourceBackup.payloadSha256)
    throw fail('NATIVE_PRESET_RESTORE_PAYLOAD_HASH_MISMATCH');
  if(!semanticEqual(candidate.expectedPayload,candidate.sourceBackup.payload))
    throw fail('NATIVE_PRESET_RESTORE_BACKUP_PAYLOAD_BINDING_MISMATCH');

  const sourceSha=await sha256Hex(candidate.backupOriginalBytes);
  const outputSha=await sha256Hex(candidate.candidateBytes);
  if(sourceSha!==candidate.manifest.input.originalSha256)throw fail('NATIVE_PRESET_RESTORE_SOURCE_HASH_MISMATCH');
  if(outputSha!==candidate.manifest.output.candidateSha256)throw fail('NATIVE_PRESET_RESTORE_CANDIDATE_HASH_MISMATCH');
  if(candidate.backupOriginalBytes.length!==candidate.manifest.input.originalFileLength)
    throw fail('NATIVE_PRESET_RESTORE_SOURCE_LENGTH_MISMATCH');
  if(candidate.candidateBytes.length!==candidate.manifest.output.candidateFileLength)
    throw fail('NATIVE_PRESET_RESTORE_CANDIDATE_LENGTH_MISMATCH');

  const sourceSession=await SafeProfileEditSession.open({
    sourceBytes:candidate.backupOriginalBytes,codec,sourcePlatform:PlatformFamily.Switch
  });
  const outputSession=await SafeProfileEditSession.open({
    sourceBytes:candidate.candidateBytes,codec,sourcePlatform:PlatformFamily.Switch
  });
  const sourceBuild=matchSupportedBuild(sourceSession.getPreflightContext().saveIdentity,targetBuild);
  const outputBuild=matchSupportedBuild(outputSession.getPreflightContext().saveIdentity,targetBuild);
  if(sourceBuild.status!==BuildMatchStatus.Exact||outputBuild.status!==BuildMatchStatus.Exact)
    throw fail('NATIVE_PRESET_RESTORE_VERIFIER_BUILD_MISMATCH');
  if(sourceSession.getPreflightContext().codecContract!==candidate.manifest.input.codecContract||
     outputSession.getPreflightContext().codecContract!==candidate.manifest.input.codecContract)
    throw fail('NATIVE_PRESET_RESTORE_VERIFIER_CODEC_MISMATCH');
  if(sourceSession.getPreflightContext().inputFormat!==candidate.manifest.input.inputFormat||
     outputSession.getPreflightContext().inputFormat!==candidate.manifest.output.inputFormat)
    throw fail('NATIVE_PRESET_RESTORE_FORMAT_CHANGED');

  const before=sourceSession.getSnapshot(),after=outputSession.getSnapshot();
  const preflight=classifyNativePresetRestoreV125({
    profile:before,backup:candidate.sourceBackup,sourcePlatform:PlatformFamily.Switch,targetBuild
  });
  if(!preflight.admissible)throw fail('NATIVE_PRESET_RESTORE_VERIFIER_PREFLIGHT_FAILED',preflight.reasonCodes.join(','));
  if(!semanticEqual(preflight.destination,candidate.manifest.destination))
    throw fail('NATIVE_PRESET_RESTORE_DESTINATION_BINDING_MISMATCH');

  const beforePresets=presetList(before),afterPresets=presetList(after);
  if(!Array.isArray(beforePresets)||!Array.isArray(afterPresets))
    throw fail('NATIVE_PRESET_RESTORE_VERIFIER_PRESET_LIST_MISSING');
  if(afterPresets.length!==beforePresets.length+1)
    throw fail('NATIVE_PRESET_RESTORE_VERIFIER_APPEND_LENGTH_MISMATCH');
  for(let i=0;i<beforePresets.length;i++){
    if(!semanticEqual(beforePresets[i],afterPresets[i]))
      throw fail('NATIVE_PRESET_RESTORE_EXISTING_PRESET_CHANGED',String(i));
  }
  const appended=afterPresets[beforePresets.length];
  if(!semanticEqual(appended,candidate.expectedPayload))
    throw fail('NATIVE_PRESET_RESTORE_APPENDED_PAYLOAD_MISMATCH');
  const appendedWarnings=nativePresetPayloadWarnings(appended);
  if(appendedWarnings.length)throw fail('NATIVE_PRESET_RESTORE_APPENDED_PAYLOAD_INVALID',appendedWarnings.join(','));
  if(nativePresetPayloadIsDeleted(appended)||safeInt(appended.StateFlags)!==0||appended.ShareInfo!==null)
    throw fail('NATIVE_PRESET_RESTORE_APPENDED_METADATA_UNSUPPORTED');

  const beforeState=destinationPresetState(beforePresets),afterState=destinationPresetState(afterPresets);
  if(afterState.active!==beforeState.active+1||afterState.physical!==beforeState.physical+1)
    throw fail('NATIVE_PRESET_RESTORE_COUNT_TRANSITION_MISMATCH');

  const changedPaths=diffPaths(before,after).slice().sort();
  if(!sameStrings(changedPaths,[NATIVE_PRESET_RESTORE_ALLOWED_PATH]))
    throw fail('NATIVE_PRESET_RESTORE_UNRELATED_STATE_CHANGED',changedPaths.join(','));

  return Object.freeze({
    contract:NATIVE_PRESET_RESTORE_VERIFICATION_CONTRACT,
    status:'PASS',
    candidateId:candidate.manifest.candidateId,
    sourceSha256:sourceSha,
    candidateSha256:outputSha,
    semanticDiff:Object.freeze({
      changedPaths:Object.freeze(changedPaths),
      preExistingPhysicalEntriesUnchanged:true,
      appendedPhysicalPresetIndex:beforePresets.length,
      appendedPayloadEquivalent:true,
      physicalPresetCountBefore:beforeState.physical,
      physicalPresetCountAfter:afterState.physical,
      activePresetCountBefore:beforeState.active,
      activePresetCountAfter:afterState.active,
      unrelatedStatePreserved:true,
      unknownPayloadFieldsPreservedByWholePayloadEquivalence:true
    }),
    runtimeGate:RuntimeGateStatus.Pending,
    persistentWriteAuthorized:false,
    PERSISTENT_WRITE:false,
    productApplyAuthorized:false,
    directSourceReplacementAuthorized:false
  });
}
