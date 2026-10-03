/* Dreamwish Wand DDV Core 01B — current Nintendo Switch v1.25 GridData floor-map contract.
 * Read-only adapter from ddv.griddata-floor-map@1 into the existing v1.25 placement validator.
 * No placement-policy inference and no save/world mutation.
 */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.DdvCoreWorldV125GridDataFloor=api;})(typeof globalThis!=='undefined'?globalThis:null,function(){
'use strict';
const SCHEMA='ddv.griddata-floor-map@1';
const GAME_VERSION='1.25.0';
const PLATFORM='Nintendo Switch';
const BUILD_ID='52BD625D9B4E0053';
const PROFILE_SCHEMA=624;
const assert=(c,m)=>{if(!c)throw Error(m);};
const int=(v,m)=>{const n=Number(v);assert(Number.isSafeInteger(n),m);return n;};
function bitsForPalette(count){const n=int(count,'V125_FLOORMAP_PALETTE_COUNT');assert(n>=1&&n<=16,'V125_FLOORMAP_PALETTE_RANGE');if(n<=2)return 1;if(n<=4)return 2;return 4;}
function decodeBase64(s){assert(typeof s==='string','V125_FLOORMAP_BASE64');if(typeof atob==='function'){const x=atob(s),out=new Uint8Array(x.length);for(let i=0;i<x.length;i++)out[i]=x.charCodeAt(i)&255;return out;}if(typeof Buffer!=='undefined')return new Uint8Array(Buffer.from(s,'base64'));throw Error('V125_FLOORMAP_BASE64_RUNTIME');}
function validateSource(contract,expected={}){
 assert(contract&&contract.schema===SCHEMA,'V125_FLOORMAP_SCHEMA');
 assert(contract.gameVersion===GAME_VERSION,'V125_FLOORMAP_VERSION');
 assert(contract.platform===PLATFORM,'V125_FLOORMAP_PLATFORM');
 assert(contract.buildIdentity===BUILD_ID,'V125_FLOORMAP_BUILD');
 assert(Number(contract.profileSchemaVersion)===PROFILE_SCHEMA,'V125_FLOORMAP_PROFILE_SCHEMA');
 if(expected.gameVersion!==undefined)assert(expected.gameVersion===contract.gameVersion,'V125_FLOORMAP_EXPECTED_VERSION');
 if(expected.platform!==undefined)assert(expected.platform===contract.platform,'V125_FLOORMAP_EXPECTED_PLATFORM');
 if(expected.buildIdentity!==undefined&&expected.buildIdentity!==null)assert(expected.buildIdentity===contract.buildIdentity,'V125_FLOORMAP_EXPECTED_BUILD');
 if(expected.profileSchemaVersion!==undefined&&expected.profileSchemaVersion!==null)assert(Number(expected.profileSchemaVersion)===Number(contract.profileSchemaVersion),'V125_FLOORMAP_EXPECTED_PROFILE_SCHEMA');
 return true;
}
function decodeRecord(record){
 assert(record&&typeof record==='object','V125_FLOORMAP_RECORD');
 const sizeX=int(record.sizeX,'V125_FLOORMAP_SIZEX'),sizeY=int(record.sizeY,'V125_FLOORMAP_SIZEY');
 assert(sizeX>0&&sizeY>0,'V125_FLOORMAP_SIZE');
 assert(Array.isArray(record.palette),'V125_FLOORMAP_PALETTE');
 const palette=record.palette.map((v)=>{const n=int(v,'V125_FLOORMAP_PALETTE_VALUE');assert(n>=0&&n<=0xffffffff,'V125_FLOORMAP_PALETTE_VALUE');return n>>>0;});
 assert(new Set(palette).size===palette.length,'V125_FLOORMAP_PALETTE_DUPLICATE');
 const bits=bitsForPalette(palette.length);assert(Number(record.bitsPerCell)===bits,'V125_FLOORMAP_BITS');
 const packed=decodeBase64(record.packedIndicesBase64);
 const cells=sizeX*sizeY,need=Math.ceil(cells*bits/8);assert(packed.length===need,'V125_FLOORMAP_PACKED_LENGTH');
 const mask=(1<<bits)-1;
 for(let flat=0;flat<cells;flat++){
   const bitIndex=flat*bits,byteIndex=Math.floor(bitIndex/8),inByte=bitIndex&7,shift=8-bits-inByte;
   assert(shift>=0,'V125_FLOORMAP_PACKING');
   const idx=(packed[byteIndex]>>shift)&mask;assert(idx<palette.length,'V125_FLOORMAP_INDEX_RANGE');
 }
 return Object.freeze({
   sizeX,sizeY,encoding:'COMPACT_MSB',floorTypes:Object.freeze([]),
   compactedFloorTypeIndex:Object.freeze(palette),compactedFloorTypes:packed,
   sourceSha256:String(record.sourceSha256||''),floorMapSha256:String(record.floorMapSha256||'')
 });
}
function getGridData(contract,gridDataPath,expected={}){
 validateSource(contract,expected);assert(typeof gridDataPath==='string'&&gridDataPath.length>0,'V125_FLOORMAP_PATH');
 const record=contract.records?.[gridDataPath];if(!record)return null;return decodeRecord(record);
}
function createGridDataIndex(contract,expected={}){
 validateSource(contract,expected);const records=contract.records||{};assert(Number(contract.recordCount)===Object.keys(records).length,'V125_FLOORMAP_RECORD_COUNT');
 const out={};for(const path of Object.keys(records))out[path]=decodeRecord(records[path]);return Object.freeze(out);
}
return Object.freeze({revision:'V125_SWITCH_FLOOR_MAP_CONTRACT_1',SCHEMA,GAME_VERSION,PLATFORM,BUILD_ID,PROFILE_SCHEMA,bitsForPalette,validateSource,decodeRecord,getGridData,createGridDataIndex});
});
