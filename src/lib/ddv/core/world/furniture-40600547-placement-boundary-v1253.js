/* 01B v1.25.3 exact Furniture 40600547 definition boundary.
 * A static shape/occupancy guard, NOT a native placement acceptance or save writer.
 */
'use strict';
export const FURNITURE_40600547_CONTRACT='ddv.furniture-40600547-placement-boundary-v1253@1';
export const FURNITURE_40600547_REQUEST_ID='01B-V1253-FURNITURE-40600547-PLACEMENT-BOUNDARY-V1';
export const FURNITURE_40600547_ID=40600547;
export const FURNITURE_40600547_BUILD=Object.freeze({platform:'Nintendo Switch',gameVersion:'1.25.3',buildIdentity:'9A239D3DB569756D',profileSchemaVersion:626});
export const FURNITURE_40600547_OLD=Object.freeze({
  gameVersion:'1.25.0',buildIdentity:'52BD625D9B4E0053',profileSchemaVersion:624,
  recordSha256:'fd7dc6e80b7735ef56351e449671bfcc53a86151149ce7936a665d8df5f4803a',
  gridArea:Object.freeze({SizeX:2,SizeY:2,Layers:Object.freeze([4,68,4,68])})
});
export const FURNITURE_40600547_NEW=Object.freeze({
  gameVersion:'1.25.3',buildIdentity:'9A239D3DB569756D',profileSchemaVersion:626,
  recordSha256:'1343a17b02f7eddd8ec77fdafd88a8af9df8d218be844e6754e9a2dd0caddfda',
  gridArea:Object.freeze({SizeX:1,SizeY:1,Layers:Object.freeze([66])})
});
const HARD_FLAGS=Object.freeze({persistentWriteAuthorized:false,WORLD_PERSISTENT_WRITE_V125:false,PERSISTENT_WRITE:false,productApplyAuthorized:false,directSourceReplacementAuthorized:false,nativeWriterAuthorized:false});
function result(status,reason){return Object.freeze({
  contract:FURNITURE_40600547_CONTRACT,itemId:FURNITURE_40600547_ID,status,reasonCode:reason,
  typedFields:Object.freeze(['FurnitureItemData.GridAreaData.SizeX','FurnitureItemData.GridAreaData.SizeY','FurnitureItemData.GridAreaData.Layers']),
  oldGridArea:FURNITURE_40600547_OLD.gridArea,newGridArea:FURNITURE_40600547_NEW.gridArea,
  currentNativePlacementValidity:'UNKNOWN',requiresExactVersionedNativePlacementValidator:true,
  mayAuthorizePlacement:false,mayAuthorizeMutation:false,...HARD_FLAGS
});}
export function classifyFurniture40600547DefinitionV1253({source,itemId,recordSha256,gridArea}={}){
  if(itemId!==FURNITURE_40600547_ID)return result('OUT_OF_SCOPE','ONLY_40600547');
  if(!source||source.platform!==FURNITURE_40600547_BUILD.platform||source.gameVersion!==FURNITURE_40600547_BUILD.gameVersion||source.buildIdentity!==FURNITURE_40600547_BUILD.buildIdentity||source.profileSchemaVersion!==FURNITURE_40600547_BUILD.profileSchemaVersion)
    return result('UNSUPPORTED_BUILD','EXACT_SWITCH_V1253_REQUIRED');
  const expected=FURNITURE_40600547_NEW;
  if(recordSha256!==expected.recordSha256||!gridArea||gridArea.SizeX!==1||gridArea.SizeY!==1||
      !Array.isArray(gridArea.Layers)||gridArea.Layers.length!==1||gridArea.Layers[0]!==66)
    return result('DEFINITION_MISMATCH','TARGET_FURNITURE_TYPED_DEFINITION_MISMATCH');
  return result('STATIC_DELTA_CONFIRMED_NATIVE_PENDING','NATIVE_PLACEMENT_RUNTIME_NOT_VERIFIED');
}
