/* 01B v1.25.3 targeted Preset share/import error semantics.
 * Fail-closed client-side interpretation only. Never invokes game/server APIs.
 * Nintendo Switch v1.25.3 exact BID; no Steam/native-writer inference.
 */
'use strict';
export const PRESET_BANNED_SEMANTICS_CONTRACT='ddv.preset-share-import-banned-v1253@1';
export const PRESET_BANNED_REQUEST_ID='01B-V1253-PRESET-SHARE-IMPORT-BANNED-V1';
export const PRESET_BANNED_LOCALIZATION_KEY='menu.decoration_preset_banned_text';
export const PRESET_BANNED_BUILD=Object.freeze({platform:'Nintendo Switch',gameVersion:'1.25.3',buildIdentity:'9A239D3DB569756D',profileSchemaVersion:626});
export const PRESET_RESULT_FAMILIES=Object.freeze({
  SHARE:'GenerateDecorationPresetShareCode.Types.Result',
  IMPORT:'EDecorationPresetError'
});
const HARD_FLAGS=Object.freeze({persistentWriteAuthorized:false,WORLD_PERSISTENT_WRITE_V125:false,PERSISTENT_WRITE:false,productApplyAuthorized:false,directSourceReplacementAuthorized:false,nativeWriterAuthorized:false});
function sourceMatch(v){return !!v&&v.platform===PRESET_BANNED_BUILD.platform&&v.gameVersion===PRESET_BANNED_BUILD.gameVersion&&v.buildIdentity===PRESET_BANNED_BUILD.buildIdentity&&v.profileSchemaVersion===PRESET_BANNED_BUILD.profileSchemaVersion;}
function response(status,code,family,key,reason){return Object.freeze({
  contract:PRESET_BANNED_SEMANTICS_CONTRACT,status,code,family,reasonCode:reason,
  displayLocalizationKey:key,remoteRejection:status==='BANNED',
  canBypassServerPolicy:false,canImportWithoutExistingValidation:false,
  mayEnterExistingValidatedFlow:status==='UPSTREAM_SUCCESS_ONLY',...HARD_FLAGS
});}
export function classifyPresetShareImportResultV1253({source,family,code}={}){
  if(!sourceMatch(source))return response('UNSUPPORTED_BUILD',code??null,family??null,null,'EXACT_SWITCH_V1253_REQUIRED');
  if(!Object.values(PRESET_RESULT_FAMILIES).includes(family))return response('UNKNOWN_RESULT_FAMILY',code??null,family??null,null,'PRESET_RESULT_FAMILY_UNSUPPORTED');
  if(!Number.isInteger(code))return response('UNKNOWN_RESULT',code??null,family,null,'PRESET_RESULT_CODE_INVALID');
  const bannedCode=family===PRESET_RESULT_FAMILIES.SHARE?14:17;
  if(code===bannedCode)return response('BANNED',code,family,PRESET_BANNED_LOCALIZATION_KEY,'SERVER_REJECTED_BANNED');
  if(code===0)return response('UPSTREAM_SUCCESS_ONLY',0,family,null,'EXISTING_VALIDATION_STILL_REQUIRED');
  // Other errors, including unknown future numbers, must not be collapsed into success.
  return response('REJECTED_OR_UNRECOGNIZED',code,family,null,'UPSTREAM_RESULT_NOT_SUCCESS');
}
