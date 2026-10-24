import { PUBLIC_MEDIA_UUID } from './public-media.js';
/**
 * A read-only owner decision, never a permission to mutate Work or media.
 * 03 COMM v14 currently returns operationAuthorized=false even to the owner.
 */
export function parseGalleryRetirementPreflight(value,workId){
  if(!PUBLIC_MEDIA_UUID.test(workId)||!value||typeof value!=='object'||
    value.contract!=='ddv.gallery-public-retirement-preflight@1'||
    value.workId!==workId||value.ownerEligible!==true||
    !Number.isSafeInteger(value.rowVersion)||value.rowVersion<1||
    !(value.revisionId===null||PUBLIC_MEDIA_UUID.test(value.revisionId))||
    typeof value.graphComplete!=='boolean'||
    !value.dependencyCoverage||typeof value.dependencyCoverage!=='object'||
    !Array.isArray(value.blockedReasons)||!value.blockedReasons.every(x=>typeof x==='string'))
    throw new Error('GALLERY_PREFLIGHT_INVALID');
  return Object.freeze({
    workId:value.workId,rowVersion:value.rowVersion,revisionId:value.revisionId,
    graphComplete:value.graphComplete,
    dependencyCoverage:value.dependencyCoverage,
    cloudEntitlementVerified:value.cloudEntitlementVerified===true,
    cloudPrivateStorageVerified:value.cloudPrivateStorageVerified===true,
    previousSignedUrlsRevoked:value.previousSignedUrlsRevoked===true,
    cdnAndBrowserPurgeProven:value.cdnAndBrowserPurgeProven===true,
    blockedReasons:value.blockedReasons.slice(),
    // This client has NO destructive command regardless of positive future flags.
    deleteEnabled:false,keepPrivateEnabled:false,restoreEnabled:false,republishEnabled:false
  });
}