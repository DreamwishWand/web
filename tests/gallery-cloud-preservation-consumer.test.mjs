import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseGalleryCloudPreservation,parseGalleryRetirementPreflight} from '../src/lib/community/gallery-preflight.js';
import {galleryStage1Catalogs} from '../src/lib/i18n/messages/community/gallery-stage1.js';
const workId='22222222-2222-4222-8222-222222222222';
const revision='55555555-5555-4555-8555-555555555555';
const manifest={
 workRowFound:true,currentRevisionId:revision,currentRevisionPresent:true,currentRevisionSealed:true,
 revisionRowCount:3,historicalRevisionRowCount:2,sealedRevisionRowCount:3,
 coverReferenceCount:3,coverWithoutCompositionCount:0,mediaReferenceCount:6,
 distinctMediaCount:3,invalidOrNonOwnedMediaCount:0,structuralIntegrityObserved:true
};
const cloud={
 contract:'ddv.gallery-cloud-preservation-readiness@1',
 entitlement:{source:'not_configured',state:'unverified',verified:false,active:false,providerEvidencePresent:false},
 ownerAccountResolved:true,creatorOwnershipAndModerationValid:true,databaseManifest:manifest,
 storageObjectByteReadbackVerified:false,cloudPrivateStorageAclVerified:false,
 cloudBackupAndRestoreVerified:false,cloudEntitlementVerified:false,
 dependencyGraphCoverageVerified:false,signedUrlAndCacheRevocationProven:false,
 privateSaveAuthorized:false,privateDetailAuthorized:false,restoreAuthorized:false,
 republishAuthorized:false,
 blockedReasons:['GALLERY_CLOUD_ENTITLEMENT_SOURCE_NOT_CONFIGURED','GALLERY_CLOUD_PRIVATE_MEDIA_DURABILITY_UNVERIFIED',
 'GALLERY_PRIVATE_MEDIA_ACL_NOT_ACCEPTED','GALLERY_CLOUD_BACKUP_RESTORE_NOT_ACCEPTED',
 'GALLERY_DEPENDENCY_GRAPH_INCOMPLETE','GALLERY_PREVIOUS_SIGNED_URL_REPLAY_UNPROVEN']
};
const preflight={
 contract:'ddv.gallery-public-retirement-preflight@1',workId,rowVersion:1,revisionId:revision,
 ownerEligible:true,graphComplete:false,dependencyCoverage:{},blockedReasons:['GALLERY_DEPENDENCY_GRAPH_INCOMPLETE'],
 cloudEntitlementVerified:false,cloudPrivateStorageVerified:false,cloudOwnerRestoreVerified:false,
 previousSignedUrlsRevoked:false,cdnAndBrowserPurgeProven:false,cloudPreservation:cloud
};
const parse=(p=preflight)=>parseGalleryRetirementPreflight(p,workId);
const clone=x=>structuredClone(x);
test('nested v1 validates owner manifest and keeps structural database facts distinct from Cloud',()=>{
 const p=parse(), c=p.cloudPreservation;
 assert.equal(c.contract,'ddv.gallery-cloud-preservation-readiness@1');
 assert.equal(c.status.workStructureObserved,true);
 assert.equal(c.status.revisionHistoryObserved,true);
 assert.equal(c.status.coverReferencesObserved,true);
 assert.equal(c.status.mediaOwnershipObserved,true);
 assert.equal(c.status.ownerCreatorObserved,true);
 assert.equal(c.databaseManifest.historicalRevisionRowCount,2);
 assert.equal(c.entitlement.source,'not_configured');
 assert.equal(c.entitlement.verified,false);
 assert.equal(c.cloudBackupAndRestoreVerified,false);
 for(const key of ['deleteEnabled','keepPrivateEnabled','restoreEnabled','republishEnabled'])assert.equal(p[key],false);
 for(const key of ['privateSaveEnabled','privateDetailEnabled','restoreEnabled','republishEnabled'])assert.equal(c[key],false);
 assert.equal(c.status.privateAclVerified,false);
 assert.equal(c.status.storageBytesVerified,false);
 assert.equal(c.status.backupRestoreVerified,false);
 assert.equal(c.status.dependencyGraphVerified,false);
});
test('flat legacy without cloudPreservation stays read-only and UNKNOWN (not synthesized false)',()=>{
 const legacy=clone(preflight);delete legacy.cloudPreservation;
 const p=parse(legacy);
 assert.equal(p.cloudPreservation,null);
 assert.equal(p.cloudEntitlementVerified,false);
 assert.equal(p.deleteEnabled,false);
});
test('unknown nested version, missing fields, null nested and malformed response fail closed',()=>{
 const variations=[
  x=>x.cloudPreservation.contract='ddv.gallery-cloud-preservation-readiness@2',
  x=>delete x.cloudPreservation.databaseManifest,
  x=>delete x.cloudPreservation.entitlement,
  x=>delete x.cloudPreservation.databaseManifest.mediaReferenceCount,
  x=>x.cloudPreservation.databaseManifest.currentRevisionId=workId,
  x=>x.cloudPreservation.databaseManifest.currentRevisionId='SECRET',
  x=>x.cloudPreservation.entitlement.source='invented_payment_provider',
  x=>x.cloudPreservation.entitlement.state='active',
  x=>x.cloudPreservation.entitlement.verified='yes',
  x=>x.cloudPreservation.blockedReasons='none',
  x=>x.cloudPreservation.storageObjectByteReadbackVerified=null,
  x=>x.cloudPreservation.databaseManifest.revisionRowCount=-1,
  x=>x.cloudPreservation.databaseManifest.sealedRevisionRowCount=4,
  x=>x.cloudPreservation.databaseManifest.coverWithoutCompositionCount=4,
  x=>x.cloudPreservation.databaseManifest.distinctMediaCount=7,
  x=>x.cloudPreservation.databaseManifest.structuralIntegrityObserved='true',
  x=>x.cloudPrivateStorageVerified=true,
  x=>x.cloudPreservation=null,
  x=>x.ownerEligible=false,
  x=>x.contract='wrong',
  x=>x.workId=revision
 ];
 for(const change of variations){const x=clone(preflight);change(x);assert.throws(()=>parse(x),{message:'GALLERY_PREFLIGHT_INVALID'});}
 for(const value of [null,{},[],{data:preflight}])assert.throws(()=>parse(value));
});
test('observed structural false and cover/media inconsistency become diagnostic failures',()=>{
 const x=clone(preflight);
 x.cloudPreservation.databaseManifest.structuralIntegrityObserved=false;
 x.cloudPreservation.databaseManifest.coverWithoutCompositionCount=1;
 x.cloudPreservation.databaseManifest.invalidOrNonOwnedMediaCount=1;
 x.cloudPreservation.creatorOwnershipAndModerationValid=false;
 const cp=parse(x).cloudPreservation;
 assert.equal(cp.status.workStructureObserved,false);
 assert.equal(cp.status.coverReferencesObserved,false);
 assert.equal(cp.status.mediaOwnershipObserved,false);
 assert.equal(cp.status.ownerCreatorObserved,false);
 assert.equal(cp.status.revisionHistoryObserved,true);
 assert.equal(cp.privateSaveEnabled,false);
});
test('history without older revisions stays known empty, not invented historical verification',()=>{
 const x=clone(preflight);
 const m=x.cloudPreservation.databaseManifest;
 m.revisionRowCount=1;m.historicalRevisionRowCount=0;m.sealedRevisionRowCount=1;
 assert.equal(parse(x).cloudPreservation.databaseManifest.historicalRevisionRowCount,0);
});
test('wrong owner, anonymous and malformed external errors cannot be turned into capability',()=>{
 assert.throws(()=>parse({...preflight,ownerEligible:false}));
 assert.throws(()=>parseGalleryRetirementPreflight(undefined,workId));
 assert.throws(()=>parse({...preflight,cloudPreservation:{}}));
 const view=readFileSync(new URL('../src/routes/gallery/my/+page.svelte',import.meta.url),'utf8');
 assert.match(view,/client!.query\('galleryRetirementPreflight',\{workId\}\)/);
 assert.match(view,/preflightGeneration/);
 assert.match(view,/client\?\.session\?\.accessToken===accessToken/);
 assert.match(view,/cloudPreservation/);
 assert.match(view,/cloudReadOnlySummary/);
 assert.match(view,/cloudLegacyUnavailable/);
 assert.doesNotMatch(view,/\{preflightError\}|\{preflight\.revisionId\}/);
 for(const action of ['publishUpdate','deleteWork','unpublish'])
  assert.ok(view.includes(`disabled aria-disabled="true">{t('galleryv1.${action}'`));
 assert.doesNotMatch(view,/client.command\('(?:deleteGalleryPhoto|galleryRestorePrivate|unpublishKeepPrivate)'/);
});
test('eight-language Cloud readiness reasons and no fake Cloud active state',()=>{
 const keys=['cloudPreflightError','cloudReadOnlySummary','cloudReadinessTitle','cloudManifestExplanation',
 'cloudWorkStructure','cloudRevisionHistory','cloudCoverReferences','cloudMediaOwnership',
 'cloudOwnerCreator','cloudEntitlement','cloudStorageReadback','cloudPrivateAccess',
 'cloudBackupRestore','cloudDependentWorks','cloudPreviousLinks','cloudObserved',
 'cloudNotVerified','cloudNotConfigured','cloudEvidenceObserved','cloudUnavailableReasons',
 'cloudManifestProblems','cloudActionsDisabled','cloudLegacyUnavailable','cloudPreflightEmpty'];
 assert.deepEqual(Object.keys(galleryStage1Catalogs).sort(),
 ['de','en','es-ES','fr','it','ja','pt-BR','zh-CN'].sort());
 for(const [lang,cat] of Object.entries(galleryStage1Catalogs))
  for(const key of keys)assert.ok(cat['galleryv1.'+key],lang+'/'+key);
});
