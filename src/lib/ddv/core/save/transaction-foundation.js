import { SafeProfileEditSession, diffPaths } from './safe-edit-session.js';
import { RUNTIME_ASSERTION_CONTRACT, createRuntimeAssertionManifest, evaluateSavePreflight } from './save-preflight.js';
import { BuildMatchStatus, CURRENT_V125_BUILD_CONTRACTS, PlatformFamily, matchSupportedBuild } from './versioning.js';

export const TRANSACTION_PLAN_CONTRACT='dreamwish.ddv.save-transaction-plan@1';
export const TRANSACTION_CANDIDATE_CONTRACT='dreamwish.ddv.save-transaction-candidate@1';
export const SEMANTIC_DIFF_CONTRACT='dreamwish.ddv.save-semantic-diff@1';
export const TRANSACTION_VERIFICATION_CONTRACT='dreamwish.ddv.save-transaction-verification@1';
export const MUTATION_ADAPTER_CONTRACT='dreamwish.ddv.save-mutation-adapter@1';
export const WRITE_CANDIDATE_CAPABILITY='WRITE_CANDIDATE';

const MAX_PLAN_JSON_BYTES=1024*1024;
const ALWAYS_FORBIDDEN_PREFIXES=Object.freeze(['/GameInfo']);
const GRID_IDENTITY_POLICY='PRESERVE_ALL_GRID_OBJECT_IDENTITIES';
const ARRAY_POLICY='PRESERVE_ORDER_AND_LENGTH_OUTSIDE_INTENTIONAL';
const UNKNOWN_POLICY='OPAQUE_UNCHANGED_REQUIRED';
const SERIALIZER_POLICY='REJECT_SEMANTIC_NORMALIZATION';

export async function createVerifiedWriteCandidate({session,plan,adapter,contracts=CURRENT_V125_BUILD_CONTRACTS}){
  requireSession(session);
  const p=normalizePlan(plan);
  requireAdapter(adapter,p);
  const before=session.getSnapshot(),ctx=session.getPreflightContext();
  const build=matchSupportedBuild(ctx.saveIdentity,p.input.targetBuild,contracts);
  if(build.status!==BuildMatchStatus.Exact||!build.contract)throw txError('TX_UNSUPPORTED_TARGET_BUILD',build.reason);
  validateInputIdentity({session,ctx,plan:p,buildContract:build.contract});
  validateTargetIdentity(before,p.target);
  assertConditions(before,p.preconditions,'TX_PRECONDITION_FAILED');
  const beforeIdentity=collectGridObjectIdentity(before);
  const preflight=evaluateSavePreflight({
    session,targetBuild:p.input.targetBuild,operation:p.operation,
    persistence:{backupReady:true,atomicReplaceReady:false,postCommitVerifyReady:false}
  });
  if(!preflight.capabilities.planOperation||!preflight.capabilities.encodeCopy)
    throw txError('TX_WRITE_CANDIDATE_CAPABILITY_NOT_READY',summarizeFindings(preflight.findings));
  if(preflight.capabilities.persistentReplace||preflight.persistentWriteAuthorized)
    throw txError('TX_PERSISTENT_WRITE_MUST_REMAIN_FALSE');

  let exported;
  try{
    exported=await session.exportVerifiedCopy({
      edit:draft=>adapter.apply(draft,structuredClone(p.intent),p),
      exactAllowedPaths:p.allowedChanges.map(x=>x.path),
      targetBuild:p.input.targetBuild,operation:p.operation
    });
  }catch(error){throw wrapStageError('TX_MUTATION_OR_SERIALIZATION_FAILED',error);}

  const reopened=await SafeProfileEditSession.open({
    sourceBytes:exported.editedBytes,codec:session.codec,
    sourcePlatform:ctx.saveIdentity.sourcePlatform,contracts
  });
  const after=reopened.getSnapshot();
  assertConditions(after,p.postconditions,'TX_POSTCONDITION_FAILED');
  validateTargetIdentity(after,p.target);
  const semanticDiff=buildSemanticDiff(before,after,p,beforeIdentity);
  assertAcceptableDiff(semanticDiff);
  if(!sameStringArray(exported.changedPaths,semanticDiff.allChangedPaths))
    throw txError('TX_EXPORT_DIFF_DISAGREES_WITH_SEMANTIC_DIFF');

  const runtimeAssertion=createRuntimeAssertionManifest({preflight,exportResult:exported});
  if(runtimeAssertion.persistentWriteAuthorized||runtimeAssertion.capabilitiesAtExport.persistentReplace)
    throw txError('TX_RUNTIME_ASSERTION_PERSISTENT_WRITE_MUST_REMAIN_FALSE');

  const planSha256=await sha256Text(canonicalJson(p));
  const baseManifest=deepFreeze({
    contract:TRANSACTION_CANDIDATE_CONTRACT,planContract:TRANSACTION_PLAN_CONTRACT,
    planId:p.planId,planSha256,semanticOwner:p.semanticOwner,mutationAdapter:structuredClone(p.mutationAdapter),
    capability:{required:WRITE_CANDIDATE_CAPABILITY,writeCandidate:true,persistentWrite:false},
    input:{
      platform:p.input.platform,gameVersion:p.input.gameVersion,profileGameInfoVersion:p.input.profileGameInfoVersion,
      originalFileLength:session.source.length,originalSha256:exported.sourceRawSha256,codecContract:p.input.codecContract,
      targetBuild:structuredClone(p.input.targetBuild),exactBuildContractId:build.contract.id
    },
    output:{
      format:exported.format,candidateFileLength:exported.editedBytes.length,
      candidateSha256:exported.editedRawSha256,noOp:Boolean(exported.noOp)
    },
    target:structuredClone(p.target),
    operation:{id:p.operation.id,owner:p.operation.owner,kind:p.operation.kind,runtimeGate:p.operation.runtimeGate},
    semanticDiff,
    verification:{
      temporarySerialization:'PASS',canonicalReparse:'PASS',schemaVersion:'PASS',expectedPostcondition:'PASS',
      unrelatedStatePreservation:'PASS',gridObjectIdentityPreservation:'PASS',opaqueUnknownPreservation:'PASS',
      runtimeAssertionContract:runtimeAssertion.contract
    },
    sourceEvidence:structuredClone(p.sourceEvidence),
    persistentWriteAuthorized:false,WORLD_PERSISTENT_WRITE_V125:false
  });
  const candidateManifestSha256=await sha256Text(canonicalJson(baseManifest));
  return Object.freeze({
    manifest:deepFreeze({...baseManifest,candidateManifestSha256}),
    plan:deepFreeze(structuredClone(p)),runtimeAssertion,
    backupOriginalBytes:exported.backupOriginalBytes.slice(),candidateBytes:exported.editedBytes.slice()
  });
}

export async function verifyWriteCandidate({candidate,codec,contracts=CURRENT_V125_BUILD_CONTRACTS}){
  if(!candidate||typeof candidate!=='object')throw txError('TX_CANDIDATE_REQUIRED');
  if(!codec||typeof codec.loadProfile!=='function')throw txError('TX_CODEC_REQUIRED');
  const manifest=candidate.manifest,p=normalizePlan(candidate.plan);
  if(!manifest||manifest.contract!==TRANSACTION_CANDIDATE_CONTRACT)throw txError('TX_CANDIDATE_MANIFEST_INVALID');
  if(!(candidate.backupOriginalBytes instanceof Uint8Array)||!(candidate.candidateBytes instanceof Uint8Array))
    throw txError('TX_CANDIDATE_BYTES_REQUIRED');
  if(manifest.persistentWriteAuthorized!==false||manifest.WORLD_PERSISTENT_WRITE_V125!==false||manifest.capability?.persistentWrite!==false)
    throw txError('TX_PERSISTENT_WRITE_MUST_REMAIN_FALSE');

  if(manifest.planSha256!==await sha256Text(canonicalJson(p)))throw txError('TX_PLAN_HASH_MISMATCH');
  const unhashed={...manifest};delete unhashed.candidateManifestSha256;
  if(manifest.candidateManifestSha256!==await sha256Text(canonicalJson(unhashed)))throw txError('TX_CANDIDATE_MANIFEST_HASH_MISMATCH');
  const sourceSha256=await sha256Hex(candidate.backupOriginalBytes),candidateSha256=await sha256Hex(candidate.candidateBytes);
  if(sourceSha256!==manifest.input.originalSha256)throw txError('TX_BACKUP_HASH_MISMATCH');
  if(candidateSha256!==manifest.output.candidateSha256)throw txError('TX_CANDIDATE_HASH_MISMATCH');
  if(candidate.backupOriginalBytes.length!==manifest.input.originalFileLength)throw txError('TX_BACKUP_LENGTH_MISMATCH');
  if(candidate.candidateBytes.length!==manifest.output.candidateFileLength)throw txError('TX_CANDIDATE_LENGTH_MISMATCH');

  const sourceSession=await SafeProfileEditSession.open({sourceBytes:candidate.backupOriginalBytes,codec,sourcePlatform:manifest.input.platform,contracts});
  const outputSession=await SafeProfileEditSession.open({sourceBytes:candidate.candidateBytes,codec,sourcePlatform:manifest.input.platform,contracts});
  const buildContract=requireExactBuild(sourceSession,p.input.targetBuild,contracts);
  validateInputIdentity({session:sourceSession,ctx:sourceSession.getPreflightContext(),plan:p,buildContract});
  const before=sourceSession.getSnapshot(),after=outputSession.getSnapshot();
  validateTargetIdentity(before,p.target);validateTargetIdentity(after,p.target);
  assertConditions(before,p.preconditions,'TX_PRECONDITION_FAILED');
  assertConditions(after,p.postconditions,'TX_POSTCONDITION_FAILED');
  const semanticDiff=buildSemanticDiff(before,after,p,collectGridObjectIdentity(before));
  assertAcceptableDiff(semanticDiff);
  assertManifestBindings({
    manifest,plan:p,semanticDiff,sourceSession,outputSession,buildContract,sourceSha256,candidateSha256
  });
  return deepFreeze({
    contract:TRANSACTION_VERIFICATION_CONTRACT,status:'PASS',planId:p.planId,
    sourceSha256,candidateSha256,semanticDiff,persistentWriteAuthorized:false,WORLD_PERSISTENT_WRITE_V125:false
  });
}

export function buildSemanticDiff(before,after,plan,beforeIdentity=collectGridObjectIdentity(before)){
  const p=normalizePlan(plan),allChangedPaths=Object.freeze(diffPaths(before,after).slice().sort());
  const intentionalSet=new Set(p.allowedChanges.map(x=>x.path));
  const forbiddenPrefixes=[...ALWAYS_FORBIDDEN_PREFIXES,...p.forbiddenPathPrefixes];
  const intentional=[],forbidden=[],unknown=[],unrelated=[];
  for(const path of allChangedPaths){
    if(matchesAnyPrefix(path,forbiddenPrefixes))forbidden.push(path);
    else if(intentionalSet.has(path))intentional.push(path);
    else if(matchesAnyPrefix(path,p.preservation.unknownPathPrefixes))unknown.push(path);
    else unrelated.push(path);
  }
  const identityDelta=compareIdentityInventories(beforeIdentity,collectGridObjectIdentity(after));
  return deepFreeze({
    contract:SEMANTIC_DIFF_CONTRACT,allChangedPaths,intentionalChangedPaths:intentional,
    serializerNormalizedEquivalentPaths:[],unrelatedChangedPaths:unrelated,unknownChangedPaths:unknown,
    forbiddenChangedPaths:forbidden,identityDelta,arrayPolicy:ARRAY_POLICY,unknownStatePolicy:UNKNOWN_POLICY,
    serializerNormalizationPolicy:SERIALIZER_POLICY,
    accepted:!forbidden.length&&!unrelated.length&&!unknown.length&&!identityDelta.changed
  });
}

function assertAcceptableDiff(diff){
  if(diff.forbiddenChangedPaths.length)throw txError('TX_FORBIDDEN_STATE_CHANGED',diff.forbiddenChangedPaths.join(', '));
  if(diff.unknownChangedPaths.length)throw txError('TX_UNKNOWN_STATE_CHANGED',diff.unknownChangedPaths.join(', '));
  if(diff.unrelatedChangedPaths.length)throw txError('TX_UNRELATED_STATE_CHANGED',diff.unrelatedChangedPaths.join(', '));
  if(diff.identityDelta.changed)throw txError('TX_GRID_OBJECT_IDENTITY_CHANGED',JSON.stringify(diff.identityDelta));
  if(diff.serializerNormalizedEquivalentPaths.length)throw txError('TX_SERIALIZER_NORMALIZATION_NOT_ALLOWED');
}

function assertManifestBindings({manifest,plan,semanticDiff,sourceSession,outputSession,buildContract,sourceSha256,candidateSha256}){
  const sourceCtx=sourceSession.getPreflightContext(),outputCtx=outputSession.getPreflightContext();
  if(manifest.planContract!==TRANSACTION_PLAN_CONTRACT||manifest.planId!==plan.planId||manifest.semanticOwner!==plan.semanticOwner)
    throw txError('TX_MANIFEST_PLAN_BINDING_MISMATCH');
  if(!semanticEqual(manifest.mutationAdapter,plan.mutationAdapter))
    throw txError('TX_MANIFEST_PLAN_BINDING_MISMATCH','mutationAdapter');
  const expectedCapability={required:WRITE_CANDIDATE_CAPABILITY,writeCandidate:true,persistentWrite:false};
  if(!semanticEqual(manifest.capability,expectedCapability))
    throw txError('TX_MANIFEST_PLAN_BINDING_MISMATCH','capability');

  const expectedInput={
    platform:plan.input.platform,gameVersion:plan.input.gameVersion,profileGameInfoVersion:plan.input.profileGameInfoVersion,
    originalFileLength:sourceSession.source.length,originalSha256:sourceSha256,codecContract:plan.input.codecContract,
    targetBuild:plan.input.targetBuild,exactBuildContractId:buildContract.id
  };
  if(!semanticEqual(manifest.input,expectedInput))
    throw txError('TX_MANIFEST_INPUT_BINDING_MISMATCH');
  if(outputCtx.saveIdentity.sourcePlatform!==plan.input.platform||
     outputCtx.saveIdentity.profileGameInfoVersion!==plan.input.profileGameInfoVersion||
     outputCtx.codecContract!==plan.input.codecContract)
    throw txError('TX_OUTPUT_IDENTITY_BINDING_MISMATCH');

  const expectedOutput={
    format:sourceCtx.inputFormat,candidateFileLength:candidateBytesLength(outputSession),
    candidateSha256,noOp:semanticDiff.allChangedPaths.length===0
  };
  if(!semanticEqual(manifest.output,expectedOutput)||outputCtx.inputFormat!==sourceCtx.inputFormat)
    throw txError('TX_MANIFEST_OUTPUT_BINDING_MISMATCH');
  if(!semanticEqual(manifest.target,plan.target))
    throw txError('TX_MANIFEST_TARGET_BINDING_MISMATCH');
  const expectedOperation={id:plan.operation.id,owner:plan.operation.owner,kind:plan.operation.kind,runtimeGate:plan.operation.runtimeGate};
  if(!semanticEqual(manifest.operation,expectedOperation))
    throw txError('TX_MANIFEST_OPERATION_BINDING_MISMATCH');
  if(!semanticEqual(manifest.semanticDiff,semanticDiff))
    throw txError('TX_MANIFEST_SEMANTIC_DIFF_BINDING_MISMATCH');
  if(!semanticEqual(manifest.sourceEvidence,plan.sourceEvidence))
    throw txError('TX_MANIFEST_EVIDENCE_BINDING_MISMATCH');
  const expectedVerification={
    temporarySerialization:'PASS',canonicalReparse:'PASS',schemaVersion:'PASS',expectedPostcondition:'PASS',
    unrelatedStatePreservation:'PASS',gridObjectIdentityPreservation:'PASS',opaqueUnknownPreservation:'PASS',
    runtimeAssertionContract:RUNTIME_ASSERTION_CONTRACT
  };
  if(!semanticEqual(manifest.verification,expectedVerification))
    throw txError('TX_MANIFEST_VERIFICATION_BINDING_MISMATCH');
}
function candidateBytesLength(session){return session.source.length;}

function normalizePlan(value){
  if(!value||typeof value!=='object')throw txError('TX_PLAN_REQUIRED');
  const p=structuredClone(value);
  if(p.contract!==TRANSACTION_PLAN_CONTRACT)throw txError('TX_PLAN_CONTRACT_UNSUPPORTED');
  requireString(p.planId,'TX_PLAN_ID_REQUIRED');requireString(p.semanticOwner,'TX_SEMANTIC_OWNER_REQUIRED');
  if(p.capabilityRequired!==WRITE_CANDIDATE_CAPABILITY)throw txError('TX_CAPABILITY_REQUIRED_INVALID');
  if(!p.input||typeof p.input!=='object')throw txError('TX_INPUT_IDENTITY_REQUIRED');
  if(!Object.values(PlatformFamily).includes(p.input.platform)||p.input.platform===PlatformFamily.Unknown)throw txError('TX_INPUT_PLATFORM_AMBIGUOUS');
  requireString(p.input.gameVersion,'TX_GAME_VERSION_REQUIRED');requireInt(p.input.profileGameInfoVersion,'TX_PROFILE_VERSION_REQUIRED');
  requireInt(p.input.originalFileLength,'TX_ORIGINAL_LENGTH_REQUIRED');requireSha(p.input.originalSha256,'TX_ORIGINAL_SHA256_REQUIRED');
  requireString(p.input.codecContract,'TX_CODEC_CONTRACT_REQUIRED');
  if(!p.input.targetBuild||typeof p.input.targetBuild!=='object')throw txError('TX_TARGET_BUILD_REQUIRED');
  requireString(p.input.targetBuild.platform,'TX_TARGET_PLATFORM_REQUIRED');requireString(p.input.targetBuild.kind,'TX_TARGET_BUILD_KIND_REQUIRED');requireString(p.input.targetBuild.value,'TX_TARGET_BUILD_VALUE_REQUIRED');

  if(!p.operation||typeof p.operation!=='object')throw txError('TX_OPERATION_REQUIRED');
  requireString(p.operation.id,'TX_OPERATION_ID_REQUIRED');requireString(p.operation.owner,'TX_OPERATION_OWNER_REQUIRED');requireString(p.operation.kind,'TX_OPERATION_KIND_REQUIRED');
  if(p.operation.owner!==p.semanticOwner)throw txError('TX_OPERATION_OWNER_MISMATCH');
  if(!p.target||p.target.kind!=='GRID_OBJECT')throw txError('TX_TARGET_KIND_UNSUPPORTED');
  requireInt(p.target.gridId,'TX_TARGET_GRID_ID_REQUIRED');requireInt(p.target.gridObjectId,'TX_TARGET_GRID_OBJECT_ID_REQUIRED');
  if(p.target.itemId!==null&&p.target.itemId!==undefined)requireInt(p.target.itemId,'TX_TARGET_ITEM_ID_INVALID');

  if(!p.mutationAdapter||p.mutationAdapter.contract!==MUTATION_ADAPTER_CONTRACT)throw txError('TX_MUTATION_ADAPTER_CONTRACT_REQUIRED');
  requireString(p.mutationAdapter.id,'TX_MUTATION_ADAPTER_ID_REQUIRED');requireString(p.mutationAdapter.owner,'TX_MUTATION_ADAPTER_OWNER_REQUIRED');
  if(p.mutationAdapter.owner!==p.semanticOwner)throw txError('TX_MUTATION_ADAPTER_OWNER_MISMATCH');

  p.preconditions=normalizeConditions(p.preconditions,'TX_PRECONDITIONS_INVALID');
  p.postconditions=normalizeConditions(p.postconditions,'TX_POSTCONDITIONS_INVALID');
  if(!Array.isArray(p.allowedChanges)||!p.allowedChanges.length)throw txError('TX_ALLOWED_CHANGES_REQUIRED');
  p.allowedChanges=p.allowedChanges.map(entry=>{
    if(!entry||typeof entry!=='object')throw txError('TX_ALLOWED_CHANGE_INVALID');
    validatePointer(entry.path,'TX_ALLOWED_CHANGE_PATH_INVALID');
    if(entry.classification!=='INTENTIONAL')throw txError('TX_ALLOWED_CHANGE_CLASSIFICATION_INVALID');
    return {path:entry.path,classification:'INTENTIONAL'};
  });
  if(new Set(p.allowedChanges.map(x=>x.path)).size!==p.allowedChanges.length)throw txError('TX_ALLOWED_CHANGE_DUPLICATE');
  p.forbiddenPathPrefixes=normalizePointers(p.forbiddenPathPrefixes??[],'TX_FORBIDDEN_PREFIX_INVALID');
  p.preservation=normalizePreservation(p.preservation);
  p.sourceEvidence=normalizeEvidence(p.sourceEvidence);
  if(!Object.prototype.hasOwnProperty.call(p,'intent'))p.intent=null;
  rejectPatchIntent(p.intent);
  if(new TextEncoder().encode(canonicalJson(p)).length>MAX_PLAN_JSON_BYTES)throw txError('TX_PLAN_TOO_LARGE');
  return deepFreeze(p);
}

function normalizePreservation(value){
  if(!value||typeof value!=='object')throw txError('TX_PRESERVATION_POLICY_REQUIRED');
  if(value.gridObjectIdentityPolicy!==GRID_IDENTITY_POLICY)throw txError('TX_GRID_IDENTITY_POLICY_UNSUPPORTED');
  if(value.arrayPolicy!==ARRAY_POLICY)throw txError('TX_ARRAY_POLICY_UNSUPPORTED');
  if(value.unknownStatePolicy!==UNKNOWN_POLICY)throw txError('TX_UNKNOWN_STATE_POLICY_UNSUPPORTED');
  if(value.serializerNormalizationPolicy!==SERIALIZER_POLICY)throw txError('TX_SERIALIZER_POLICY_UNSUPPORTED');
  return {
    gridObjectIdentityPolicy:GRID_IDENTITY_POLICY,arrayPolicy:ARRAY_POLICY,unknownStatePolicy:UNKNOWN_POLICY,
    serializerNormalizationPolicy:SERIALIZER_POLICY,
    unknownPathPrefixes:normalizePointers(value.unknownPathPrefixes??[],'TX_UNKNOWN_PREFIX_INVALID')
  };
}
function normalizeEvidence(value){
  if(!Array.isArray(value)||!value.length)throw txError('TX_SOURCE_EVIDENCE_REQUIRED');
  return value.map(entry=>{if(!entry||typeof entry!=='object')throw txError('TX_SOURCE_EVIDENCE_INVALID');requireString(entry.id,'TX_SOURCE_EVIDENCE_ID_REQUIRED');requireString(entry.status,'TX_SOURCE_EVIDENCE_STATUS_REQUIRED');return {id:entry.id,status:entry.status};});
}
function normalizeConditions(value,code){
  if(!Array.isArray(value))throw txError(code);
  return value.map(entry=>{
    if(!entry||typeof entry!=='object')throw txError(code);validatePointer(entry.path,code);
    if(!['EQUALS','EXISTS','NOT_EXISTS'].includes(entry.operator))throw txError(code);
    if(entry.operator==='EQUALS'&&!Object.prototype.hasOwnProperty.call(entry,'value'))throw txError(code);
    return entry.operator==='EQUALS'?{path:entry.path,operator:entry.operator,value:structuredClone(entry.value)}:{path:entry.path,operator:entry.operator};
  });
}
function requireAdapter(adapter,p){
  if(!adapter||adapter.contract!==MUTATION_ADAPTER_CONTRACT||typeof adapter.apply!=='function')throw txError('TX_MUTATION_ADAPTER_INVALID');
  if(adapter.id!==p.mutationAdapter.id||adapter.owner!==p.mutationAdapter.owner)throw txError('TX_MUTATION_ADAPTER_BINDING_MISMATCH');
}
function validateInputIdentity({session,ctx,plan,buildContract}){
  if(ctx.saveIdentity.sourcePlatform!==plan.input.platform)throw txError('TX_SOURCE_PLATFORM_MISMATCH');
  if(ctx.saveIdentity.sourcePlatform===PlatformFamily.Unknown)throw txError('TX_SOURCE_PLATFORM_AMBIGUOUS');
  if(ctx.saveIdentity.sourceRawSha256!==plan.input.originalSha256)throw txError('TX_SOURCE_HASH_MISMATCH');
  if(session.source.length!==plan.input.originalFileLength)throw txError('TX_SOURCE_LENGTH_MISMATCH');
  if(ctx.saveIdentity.profileGameInfoVersion!==plan.input.profileGameInfoVersion)throw txError('TX_PROFILE_VERSION_MISMATCH');
  if(ctx.codecContract!==plan.input.codecContract)throw txError('TX_CODEC_CONTRACT_MISMATCH');
  if(buildContract.gameVersion!==plan.input.gameVersion)throw txError('TX_GAME_VERSION_MISMATCH');
  if(buildContract.platform!==plan.input.platform)throw txError('TX_BUILD_PLATFORM_MISMATCH');
}
function requireExactBuild(session,targetBuild,contracts){
  const build=matchSupportedBuild(session.getPreflightContext().saveIdentity,targetBuild,contracts);
  if(build.status!==BuildMatchStatus.Exact||!build.contract)throw txError('TX_UNSUPPORTED_TARGET_BUILD',build.reason);
  return build.contract;
}
function validateTargetIdentity(profile,target){
  const gc=asObj(asObj(profile.World)?.GridCollection),grids=asObj(gc?.Grids);
  const grid=asObj(grids?.[String(target.gridId)]??grids?.[target.gridId]);
  if(!grid||Number(grid.ID)!==target.gridId)throw txError('TX_TARGET_GRID_IDENTITY_MISMATCH');
  const objects=asObj(grid.Objects),obj=asObj(objects?.[String(target.gridObjectId)]??objects?.[target.gridObjectId]);
  if(!obj||Number(obj.ID)!==target.gridObjectId)throw txError('TX_TARGET_GRID_OBJECT_IDENTITY_MISMATCH');
  if(target.itemId!==null&&target.itemId!==undefined&&Number(obj.ItemID)!==target.itemId)throw txError('TX_TARGET_ITEM_IDENTITY_MISMATCH');
}
function assertConditions(profile,conditions,code){
  for(const c of conditions){
    const s=getPointer(profile,c.path);
    if(c.operator==='EXISTS'&&!s.exists)throw txError(code,c.path);
    if(c.operator==='NOT_EXISTS'&&s.exists)throw txError(code,c.path);
    if(c.operator==='EQUALS'&&(!s.exists||!semanticEqual(s.value,c.value)))throw txError(code,c.path);
  }
}
function collectGridObjectIdentity(profile){
  const out=[],gc=asObj(asObj(profile.World)?.GridCollection);
  if(!gc)return Object.freeze(out);
  walk(gc,'/World/GridCollection');out.sort((a,b)=>a.path.localeCompare(b.path));
  return Object.freeze(out.map(x=>Object.freeze(x)));
  function walk(value,path){
    if(Array.isArray(value)){value.forEach((v,i)=>walk(v,`${path}/${i}`));return;}
    const obj=asObj(value);if(!obj)return;
    if(Number.isSafeInteger(Number(obj.ID))&&Number.isSafeInteger(Number(obj.ItemID))&&Object.prototype.hasOwnProperty.call(obj,'X')&&Object.prototype.hasOwnProperty.call(obj,'Y'))
      out.push({path,id:Number(obj.ID),itemId:Number(obj.ItemID)});
    for(const [key,child] of Object.entries(obj))walk(child,`${path}/${escapePointer(key)}`);
  }
}
function compareIdentityInventories(before,after){
  const l=new Map(before.map(x=>[x.path,x])),r=new Map(after.map(x=>[x.path,x])),added=[],removed=[],reidentified=[];
  for(const [path,e] of l){const o=r.get(path);if(!o)removed.push(e);else if(e.id!==o.id||e.itemId!==o.itemId)reidentified.push({path,before:e,after:o});}
  for(const [path,e] of r)if(!l.has(path))added.push(e);
  return deepFreeze({policy:GRID_IDENTITY_POLICY,changed:!!(added.length||removed.length||reidentified.length),added,removed,reidentified});
}
function getPointer(root,pointer){
  if(pointer==='')return {exists:true,value:root};
  const tokens=pointer.slice(1).split('/').map(t=>t.replaceAll('~1','/').replaceAll('~0','~'));let cur=root;
  for(const token of tokens){
    if(Array.isArray(cur)){if(!/^(?:0|[1-9]\d*)$/.test(token)||Number(token)>=cur.length)return {exists:false};cur=cur[Number(token)];continue;}
    const obj=asObj(cur);if(!obj||!Object.prototype.hasOwnProperty.call(obj,token))return {exists:false};cur=obj[token];
  }
  return {exists:true,value:cur};
}
function rejectPatchIntent(value){
  const banned=new Set(['patch','patches','jsonPatch','jsonPatches','operations']);walk(value);
  function walk(v){if(Array.isArray(v)){v.forEach(walk);return;}const o=asObj(v);if(!o)return;for(const [k,c] of Object.entries(o)){if(banned.has(k))throw txError('TX_ARBITRARY_PATCH_INTENT_FORBIDDEN');walk(c);}}
}
function normalizePointers(value,code){if(!Array.isArray(value))throw txError(code);const out=value.map(x=>{validatePointer(x,code);return x;});if(new Set(out).size!==out.length)throw txError(code);return out;}
function validatePointer(value,code){if(typeof value!=='string'||!/^\/(?:[^~]|~[01])*(?:\/(?:[^~]|~[01])*)*$/.test(value))throw txError(code);}
function semanticEqual(a,b){return canonicalJson(a)===canonicalJson(b);}
function canonicalJson(v){return JSON.stringify(canonicalize(v));}
function canonicalize(v){if(Array.isArray(v))return v.map(canonicalize);if(v&&typeof v==='object'){const o={};for(const k of Object.keys(v).sort())o[k]=canonicalize(v[k]);return o;}return v;}
function matchesAnyPrefix(path,prefixes){return prefixes.some(p=>path===p||path.startsWith(`${p}/`));}
function summarizeFindings(v){return Array.isArray(v)?v.map(x=>x.code).join(', '):'';}
function requireSession(s){if(!s||typeof s.getSnapshot!=='function'||typeof s.getPreflightContext!=='function'||!(s.source instanceof Uint8Array))throw txError('TX_SAFE_SESSION_REQUIRED');}
function requireString(v,c){if(typeof v!=='string'||!v.length)throw txError(c);}
function requireInt(v,c){if(!Number.isSafeInteger(v)||v<0)throw txError(c);}
function requireSha(v,c){if(typeof v!=='string'||!/^[0-9a-f]{64}$/.test(v))throw txError(c);}
function asObj(v){return v!==null&&typeof v==='object'&&!Array.isArray(v)?v:null;}
function escapePointer(k){return k.replaceAll('~','~0').replaceAll('/','~1');}
function sameStringArray(a,b){return a.length===b.length&&a.every((v,i)=>v===b[i]);}
function txError(code,detail=''){const e=new Error(detail?`${code}: ${detail}`:code);e.code=code;return e;}
function wrapStageError(code,error){return txError(code,error instanceof Error?error.message:String(error));}
function deepFreeze(v){if(v&&typeof v==='object'&&!(v instanceof Uint8Array)&&!Object.isFrozen(v)){Object.freeze(v);for(const c of Object.values(v))deepFreeze(c);}return v;}
async function sha256Text(t){return sha256Hex(new TextEncoder().encode(t));}
async function sha256Hex(bytes){if(!globalThis.crypto?.subtle)throw txError('TX_WEBCRYPTO_UNAVAILABLE');const d=await globalThis.crypto.subtle.digest('SHA-256',bytes);return [...new Uint8Array(d)].map(v=>v.toString(16).padStart(2,'0')).join('');}
