import { PUBLIC_MEDIA_UUID } from './public-media.js';

/** The owner JWT service-only projection is evidence of DB structure, never a Cloud backup.
 * Old flat responses still parse, with cloudPreservation=null meaning NOT OBSERVED.
 * Unsupported or malformed nested v1 is rejected as a whole (fail closed).
 */
const invalid=()=>{throw new Error('GALLERY_PREFLIGHT_INVALID')};
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const boolean=x=>typeof x==='boolean';
const count=x=>Number.isSafeInteger(x)&&x>=0;
const uuidOrNull=x=>x===null||(typeof x==='string'&&PUBLIC_MEDIA_UUID.test(x));
const strings=x=>Array.isArray(x)&&x.length<=100&&x.every(s=>typeof s==='string'&&s.length>0&&s.length<=150);
const freeze=x=>Object.freeze(x);

/** @returns {Readonly<object>} nested Cloud v1, or throws without authorizing mutations */
export function parseGalleryCloudPreservation(value,currentRevisionId){
  if(!object(value)||value.contract!=='ddv.gallery-cloud-preservation-readiness@1')
    invalid();
  const ent=value.entitlement,db=value.databaseManifest;
  if(!object(ent)||!object(db)||ent.source!=='not_configured'||
    ent.state!=='unverified'||ent.verified!==false||ent.active!==false||
    ent.providerEvidencePresent!==false||
    value.ownerAccountResolved!==true||!boolean(value.creatorOwnershipAndModerationValid)||
    db.workRowFound!==true||!uuidOrNull(db.currentRevisionId)||
    db.currentRevisionId!==currentRevisionId||
    !boolean(db.currentRevisionPresent)||!boolean(db.currentRevisionSealed)||
    !boolean(db.structuralIntegrityObserved)||
    !['revisionRowCount','historicalRevisionRowCount','sealedRevisionRowCount',
      'coverReferenceCount','coverWithoutCompositionCount','mediaReferenceCount',
      'distinctMediaCount','invalidOrNonOwnedMediaCount'].every(key=>count(db[key]))||
    !['storageObjectByteReadbackVerified','cloudPrivateStorageAclVerified',
      'cloudBackupAndRestoreVerified','cloudEntitlementVerified','dependencyGraphCoverageVerified',
      'signedUrlAndCacheRevocationProven','privateSaveAuthorized','privateDetailAuthorized',
      'restoreAuthorized','republishAuthorized'].every(key=>boolean(value[key]))||
    !strings(value.blockedReasons))
      invalid();
  if(db.sealedRevisionRowCount>db.revisionRowCount||
    db.historicalRevisionRowCount>db.revisionRowCount||
    db.coverWithoutCompositionCount>db.coverReferenceCount||
    db.distinctMediaCount>db.mediaReferenceCount||
    db.invalidOrNonOwnedMediaCount>db.distinctMediaCount||
    (db.currentRevisionSealed&&!db.currentRevisionPresent)||
    (db.currentRevisionPresent&&db.revisionRowCount===0)||
    (db.currentRevisionId===null&&db.currentRevisionPresent)||
    (db.structuralIntegrityObserved&&(
       !db.currentRevisionPresent||!db.currentRevisionSealed||
       db.revisionRowCount!==db.sealedRevisionRowCount||
       db.coverReferenceCount===0||db.coverWithoutCompositionCount!==0||
       db.invalidOrNonOwnedMediaCount!==0||
       !value.creatorOwnershipAndModerationValid
    )))invalid();
  // Display granular observed facts; do not promote any of them to a
  // certified Cloud entitlement, private ACL, byte durability or restore.
  const status=freeze({
    workStructureObserved:db.workRowFound===true&&db.structuralIntegrityObserved===true,
    revisionHistoryObserved:db.revisionRowCount>0&&db.revisionRowCount===db.sealedRevisionRowCount&&
      db.currentRevisionPresent===true&&db.currentRevisionSealed===true,
    coverReferencesObserved:db.coverReferenceCount>0&&db.coverWithoutCompositionCount===0,
    mediaOwnershipObserved:db.distinctMediaCount>0&&db.invalidOrNonOwnedMediaCount===0,
    ownerCreatorObserved:value.ownerAccountResolved===true&&value.creatorOwnershipAndModerationValid===true,
    dependencyGraphVerified:value.dependencyGraphCoverageVerified===true,
    storageBytesVerified:value.storageObjectByteReadbackVerified===true,
    privateAclVerified:value.cloudPrivateStorageAclVerified===true,
    backupRestoreVerified:value.cloudBackupAndRestoreVerified===true
  });
  return freeze({
    contract:value.contract,
    entitlement:freeze({source:ent.source,state:ent.state,verified:ent.verified,
      active:ent.active,providerEvidencePresent:ent.providerEvidencePresent}),
    databaseManifest:freeze({
      currentRevisionPresent:db.currentRevisionPresent,currentRevisionSealed:db.currentRevisionSealed,
      revisionRowCount:db.revisionRowCount,historicalRevisionRowCount:db.historicalRevisionRowCount,
      sealedRevisionRowCount:db.sealedRevisionRowCount,coverReferenceCount:db.coverReferenceCount,
      coverWithoutCompositionCount:db.coverWithoutCompositionCount,mediaReferenceCount:db.mediaReferenceCount,
      distinctMediaCount:db.distinctMediaCount,invalidOrNonOwnedMediaCount:db.invalidOrNonOwnedMediaCount,
      structuralIntegrityObserved:db.structuralIntegrityObserved
    }),
    status,
    storageObjectByteReadbackVerified:value.storageObjectByteReadbackVerified,
    cloudPrivateStorageAclVerified:value.cloudPrivateStorageAclVerified,
    cloudBackupAndRestoreVerified:value.cloudBackupAndRestoreVerified,
    cloudEntitlementVerified:value.cloudEntitlementVerified,
    dependencyGraphCoverageVerified:value.dependencyGraphCoverageVerified,
    signedUrlAndCacheRevocationProven:value.signedUrlAndCacheRevocationProven,
    blockedReasons:freeze([...value.blockedReasons]),
    // Even a future all-green metadata snapshot NEVER enables mutation.
    privateSaveEnabled:false,privateDetailEnabled:false,restoreEnabled:false,
    republishEnabled:false,deleteEnabled:false,keepPrivateEnabled:false
  });
}

/** #119/#116 integrated source-pinned snapshot: PR #129 7ed57b73368a8ae5cfb4d3e7cb576c647577dfd8.
 * This is a diagnostic projection ONLY, neither a complete graph nor an atomic lock.
 * Legacy preflight without the entire integrated projection stays UNKNOWN.
 */
const coverageKinds=['scene','biome','floating_island','tom_furniture','tom_clothing','native_listing'];
const coverageValues=new Set(['VERIFIED','VERIFIED_EMPTY','REGISTRY_MISSING','SEMANTICS_UNKNOWN','VERSION_UNSUPPORTED']);
const relationValues=/^[A-Z][A-Z0-9_]{0,99}$/;
const dependencyFields=[
 'dependencyCoverageContract','dependencyCoverageClassification','dependencyRelationCoverage',
 'dependencyMissingSources','dependencyBlockedReasons','dependencyGraphFingerprintSha256',
 'dependencySnapshotNotAtomicMutationFence','dependencySnapshotRowVersion',
 'dependencySourceVersionState','dependencyOwnerMismatchEdgeCount',
 'dependencyCreatorMismatchEdgeCount'
];
function parseGalleryDependencyProjection(value) {
  const present=dependencyFields.filter(key=>Object.hasOwn(value,key));
  if(!present.length)return null; // Older Flat v1 remains supported; no invented coverage.
  if(present.length!==dependencyFields.length)invalid();
  const classification=value.dependencyCoverageClassification;
  const relations=value.dependencyRelationCoverage;
  const source=value.dependencySourceVersionState;
  const fingerprint=value.dependencyGraphFingerprintSha256;
  if(value.dependencyCoverageContract!=='ddv.gallery-cross-product-coverage@1'||
    !object(classification)||!object(relations)||
    Object.keys(classification).length!==coverageKinds.length||
    !coverageKinds.every(kind=>coverageValues.has(classification[kind]))||
    !Object.keys(relations).every(key=>/^[a-z][a-z0-9_]{0,79}$/.test(key)&&
      typeof relations[key]==='string'&&relationValues.test(relations[key]))||
    Object.keys(relations).length===0||
    !strings(value.dependencyMissingSources)||
    !strings(value.dependencyBlockedReasons)||
    !(fingerprint===null||(typeof fingerprint==='string'&&/^[0-9a-f]{64}$/.test(fingerprint)))||
    value.dependencySnapshotNotAtomicMutationFence!==true||
    !Number.isSafeInteger(value.dependencySnapshotRowVersion)||
    value.dependencySnapshotRowVersion!==value.rowVersion||
    !(source===null||coverageValues.has(source))||
    !count(value.dependencyOwnerMismatchEdgeCount)||
    !count(value.dependencyCreatorMismatchEdgeCount))invalid();
  return freeze({
    coverageContract:value.dependencyCoverageContract,
    classification:freeze({...classification}),
    relationCoverage:freeze({...relations}),
    missingSources:freeze([...value.dependencyMissingSources]),
    blockedReasons:freeze([...value.dependencyBlockedReasons]),
    graphFingerprintSha256:fingerprint, // Never a mutation fence; UI shows presence only.
    snapshotRowVersion:value.dependencySnapshotRowVersion,
    sourceVersionState:source,
    ownerMismatchEdgeCount:value.dependencyOwnerMismatchEdgeCount,
    creatorMismatchEdgeCount:value.dependencyCreatorMismatchEdgeCount,
    diagnosticOnly:true,atomicMutationFence:false,retirementAuthorized:false,
    observedSourcesComplete:false,
    coverageVerified:source==='VERIFIED'&&
      coverageKinds.every(kind=>['VERIFIED','VERIFIED_EMPTY'].includes(classification[kind]))&&
      value.dependencyMissingSources.length===0&&
      value.dependencyBlockedReasons.length===0&&
      value.dependencyOwnerMismatchEdgeCount===0&&
      value.dependencyCreatorMismatchEdgeCount===0
  });
}

/** Existing owner-only read-only retirement preflight; no capability is inferred. */
export function parseGalleryRetirementPreflight(value,workId){
  if(!PUBLIC_MEDIA_UUID.test(workId)||!object(value)||
    value.contract!=='ddv.gallery-public-retirement-preflight@1'||
    value.workId!==workId||value.ownerEligible!==true||
    !Number.isSafeInteger(value.rowVersion)||value.rowVersion<1||
    !uuidOrNull(value.revisionId)||
    !boolean(value.graphComplete)||!object(value.dependencyCoverage)||
    !strings(value.blockedReasons))invalid();
  if(Object.hasOwn(value,'cloudPreservation')&&value.cloudPreservation===null)invalid();
  const cloudPreservation=Object.hasOwn(value,'cloudPreservation')
    ?parseGalleryCloudPreservation(value.cloudPreservation,value.revisionId):null;
  const dependencyProjection=parseGalleryDependencyProjection(value);
  if(cloudPreservation){
    // Explicit disagreement between flat & nested authority is malformed.
    if(!boolean(value.cloudEntitlementVerified)||!boolean(value.cloudPrivateStorageVerified)||
      !boolean(value.cloudOwnerRestoreVerified)||!boolean(value.previousSignedUrlsRevoked)||
      !boolean(value.cdnAndBrowserPurgeProven)||
      value.cloudEntitlementVerified!==cloudPreservation.cloudEntitlementVerified||
      value.cloudPrivateStorageVerified!==cloudPreservation.cloudPrivateStorageAclVerified||
      value.cloudOwnerRestoreVerified!==cloudPreservation.cloudBackupAndRestoreVerified||
      value.previousSignedUrlsRevoked!==cloudPreservation.signedUrlAndCacheRevocationProven||
      value.cdnAndBrowserPurgeProven!==cloudPreservation.signedUrlAndCacheRevocationProven)invalid();
  }
  return freeze({
    workId:value.workId,rowVersion:value.rowVersion,revisionId:value.revisionId,
    graphComplete:value.graphComplete,
    dependencyCoverage:freeze({...value.dependencyCoverage}),
    cloudEntitlementVerified:value.cloudEntitlementVerified===true,
    cloudPrivateStorageVerified:value.cloudPrivateStorageVerified===true,
    previousSignedUrlsRevoked:value.previousSignedUrlsRevoked===true,
    cdnAndBrowserPurgeProven:value.cdnAndBrowserPurgeProven===true,
    cloudPreservation,dependencyProjection,
    blockedReasons:freeze(value.blockedReasons.slice()),
    deleteEnabled:false,keepPrivateEnabled:false,restoreEnabled:false,republishEnabled:false
  });
}
