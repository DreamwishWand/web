/**
 * 01D R39 source-only ItemId -> original GUID -> PNG-SHA bridge.
 *
 * This verifies an already-rebuilt historical source candidate. It is NOT
 * the published 08WEB manifest and never asserts target v1.25.0/v1.25.3
 * Item icon equivalence, current in-game availability, ownership or Rights.
 * The only producer of verified target rows is a separately accepted
 * same-version original-asset diff with independent QA.
 */
export const R39_IMAGE_SOURCE_CONTRACT = 'wand.01d.r39-source-provenance@1';
export const R39_SOURCE_SHA = Object.freeze({
  queryFoundation:'201729836d0bab2f097252b4e59effc8539d318a7a99f47fe624b8d7eaa3a05e',
  queryIndex:'a175dc6936496c00e3c94520a91a861b63a37ba86e2476cac939424a540f4882',
  portableManifest:'f0ea2248bc7a91d9a8afb655bf142150798aa96fbde1fd91ae028927b4ef3aba',
  derivativeManifest:'c619541497732e76441c52f6505b2ca2dbe1fd2baffdfda4fa4584b9819a7733'
});
export const R39_IMAGE_TARGETS = Object.freeze([
  Object.freeze({platform:'Nintendo Switch',gameVersion:'1.25.0',buildID:'52BD625D9B4E0053',schema:624}),
  Object.freeze({platform:'Nintendo Switch',gameVersion:'1.25.3',buildID:'9A239D3DB569756D',schema:626})
]);
export const R39_IMAGE_SOURCE_COUNTS = Object.freeze({
  itemDefinitions:16930,sourceIconItems:14601,withoutSourceIcon:2329,
  originalAddressMappings:12117,uniqueWebp:12082,shards:32,originalShardZipBytes:85464564
});
export const R39_IMAGE_CURRENT_TARGET_READY = false;
const hex=/^[a-f0-9]{64}$/;
const guid=/^guid:[a-f0-9]{32}$/;
const item=/^[1-9][0-9]{0,15}$/;
const record=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const blocked=(reason)=>Object.freeze({
  contract:R39_IMAGE_SOURCE_CONTRACT,status:'BLOCKED',reason,
  canPublishImage:false,targetVersionVerified:false,canShowPersonalOwned:false,
  releaseManifestEntry:null,assetHref:null
});
function inspectProvenance(p) {
  return record(p)&&p.schema===R39_IMAGE_SOURCE_CONTRACT&&
    p.status==='SOURCE_ONLY_R39_NO_CURRENT_VERSION_DEPLOY_PERMISSION'&&
    p.source?.platform==='Nintendo Switch'&&p.source.gameVersion==='1.24.13'&&
    p.source.generation==='R39'&&
    p.source.queryFoundationZipSha256===R39_SOURCE_SHA.queryFoundation&&
    p.source.queryIndexGzipSha256===R39_SOURCE_SHA.queryIndex&&
    p.source.portablePngManifestGzipSha256===R39_SOURCE_SHA.portableManifest&&
    p.source.webpDerivativeManifestSha256===R39_SOURCE_SHA.derivativeManifest&&
    p.target?.bindingAccepted===false&&p.target?.verifiedItems===0&&
    p.additionalTarget?.bindingAccepted===false&&p.additionalTarget?.verifiedItems===0&&
    p.counts?.querySourceItems===R39_IMAGE_SOURCE_COUNTS.itemDefinitions&&
    p.counts?.itemsWithSourceIcon===R39_IMAGE_SOURCE_COUNTS.sourceIconItems&&
    p.counts?.uniqueWebpVerified===R39_IMAGE_SOURCE_COUNTS.uniqueWebp;
}
/**
 * Source-only local analysis. A caller-supplied `targetVersionVerified` flag,
 * Owner approval or a matching ItemID cannot become authoritative Native evidence.
 */
export function inspectR39ItemImageCandidate({provenance,itemId,target}={}) {
  if(!inspectProvenance(provenance))return blocked('R39_ORIGINAL_SOURCE_NOT_ATTESTED');
  if(!record(target)||!R39_IMAGE_TARGETS.some(t=>
      t.platform===target.platform&&t.gameVersion===target.gameVersion&&
      t.buildID===target.buildID&&t.schema===target.schema))
    return blocked('TARGET_PLATFORM_VERSION_BID_SCHEMA_UNSUPPORTED');
  const id=String(itemId);
  if(!item.test(id)||!Number.isSafeInteger(Number(id)))
    return blocked('NONCANONICAL_ITEM_ID');
  const row=provenance.items?.[id];
  if(row===undefined)return blocked('R39_SOURCE_ITEM_ICON_NOT_PRESENT');
  if(!record(row)||row.sourceVersion!=='1.24.13'||
      row.identityStatus!=='SOURCE_VERIFIED_R39_ONLY'||
      row.currentVersionEquivalent!==null||row.releasedPlayerFacingInTarget!==null||
      !guid.test(row.sourceIconAddressGuid||'')||
      !hex.test(row.sourcePngSha256||'')||
      !hex.test(row.sourceRawPayloadSha256||''))
    return blocked('R39_SOURCE_ITEM_PROVENANCE_CONFLICT');
  const sha=row.sourcePngSha256;
  const shard=(Number.parseInt(sha.slice(0,2),16)>>3).toString(16).padStart(2,'0');
  const path='ddv/item-images/v1.24.13/'+shard+'/'+sha+'.webp';
  if(row.webpPath!==path)return blocked('R39_WEBP_SHARD_PATH_MISMATCH');
  return Object.freeze({
    contract:R39_IMAGE_SOURCE_CONTRACT,status:'R39_SOURCE_ONLY',
    reason:'TARGET_SAME_VERSION_ICON_GUID_AND_VISIBILITY_UNVERIFIED',
    source:Object.freeze({version:'1.24.13',guid:row.sourceIconAddressGuid,
      sourcePngSha256:sha,webpSourcePath:path}),
    target:Object.freeze({...target}),
    canPublishImage:false,targetVersionVerified:false,canShowPersonalOwned:false,
    releaseManifestEntry:null,assetHref:null,
    requiredEvidence:Object.freeze(['original-target-ItemID-iconGuid-source-hash',
      'same-build-target-source/visibility-version/rights-operation-QA',
      'verified-production-static-webp-content-and-operator-takedown'])
  });
}
