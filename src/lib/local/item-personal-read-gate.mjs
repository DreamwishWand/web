// 08 WEB — explicitly consumer-side, no native or personal-save reader implementation.
// 01A PR383/QA391 W1-only Worker and 01D PR379/QA392 raw bool/amount are
// NOT a same-Source Inventory/Ownership consumer in current protected main.
export const ITEM_PERSONAL_READ_CONTRACT='wand.item-personal-read-gate@1';
export const ITEM_PERSONAL_READ_ENABLED=false;
export const ITEM_PERSONAL_EDIT_ENABLED=false;
export const ITEM_PERSONAL_WRITER_ENABLED=false;
export const ITEM_PERSONAL_BACKUP_EXPORT_ENABLED=false;
export const LOCAL_ITEM_REFERENCE_SCOPE=Object.freeze({
 platform:'Nintendo Switch',fullVersion:'1.25.0',bid:'52BD625D9B4E0053',schema:624
});
export const LOCAL_W1_READ_SCOPE=Object.freeze({
 platform:'Nintendo Switch',fullVersion:'1.25.3',bid:'9A239D3DB569756D',schema:626
});
export function itemPersonalReadState({
 catalogScope=LOCAL_ITEM_REFERENCE_SCOPE,sessionSource=null,capabilities=null,nativeEvidence=null
}={}){
 const match=!!sessionSource&&
   ['platform','fullVersion','bid','schema'].every(k=>catalogScope?.[k]===sessionSource?.[k])&&
   (catalogScope?.sourceDigest??null)===(sessionSource?.sourceDigest??null);
 const accepts=capabilities?.readInventory===true&&capabilities?.readOwnership===true&&
   nativeEvidence?.operationAccepted===true&&nativeEvidence?.verifiedSourceSha256===sessionSource?.sourceSha256;
 // Even matching syntactic client envelopes cannot turn on Owned until trusted
 // Core and independent Native evidence and exact operation QA are integrated.
 // This PR intentionally never binds that Core source; production remains UNKNOWN.
 return Object.freeze({
  state:'UNKNOWN',owned:null,discovered:null,amount:null,
  numerator:null,denominator:null,completion:null,writeAuthorized:false,
  originalBackupAvailable:false,editedCopyAvailable:false,
  hasMatchingCatalogAndSession:match,
  capabilityRequested:accepts&&match,
  capabilityAvailable:false,
  reason:!sessionSource?'NO_TRUSTED_ITEM_SESSION':!match?'SOURCE_SCOPE_MISMATCH':'NATIVE_ITEM_READ_NOT_ACCEPTED'
 });
}
