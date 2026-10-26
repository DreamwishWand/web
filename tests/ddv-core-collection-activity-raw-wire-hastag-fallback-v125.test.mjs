import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const evidence=JSON.parse(readFileSync('static/ddv/core/collection/v1.25/native-activity-raw-wire-hastag-fallback-v125.json','utf8'));
const prev=JSON.parse(readFileSync('static/ddv/core/collection/v1.25/native-activity-by-gameplay-tag-v125.json','utf8'));
const bytes=x=>Uint8Array.from(Buffer.from(x,'hex'));
function varint(b,pos) {
 let v=0,shift=0;
 while(true){assert.ok(pos<b.length,'protobuf truncated');const z=b[pos++];v+=(z&127)*2**shift;
 if(!(z&128))return [v,pos];shift+=7;assert.ok(shift<=56,'protobuf varint overflow');}
}
function wire(b) {
 const out=[];let p=0;
 while(p<b.length){const [key,next]=varint(b,p);p=next;const no=key>>>3,wt=key&7;
 let value;if(wt===0){[value,p]=varint(b,p);}else if(wt===2){const [len,q]=varint(b,p);p=q;assert.ok(p+len<=b.length,'truncated length');value=b.slice(p,p+len);p+=len;}
 else throw new Error('unexpected wire type');
 out.push({no,wt,value});}
 return out;
}
const field=(b,n)=>wire(b).filter(x=>x.no===n);
const one=(b,n)=>{const a=field(b,n);assert.equal(a.length,1,'expected exactly one field '+n);return a[0];};
const packed=b=>{let p=0,out=[];while(p<b.length){let v;[v,p]=varint(b,p);out.push(v);}return out;};

test('Actual fetched GZ provenance is kept separate from the unverified whole CollectionSet.json',()=>{
 const src=evidence.source;
 assert.equal(src.losslessItemDb.bytes,5090928);
 assert.equal(src.losslessItemDb.sha256,'df78c309a8023667c92426e3b929ed3e51aadf10d943835a3673cefa585f8048');
 assert.equal(src.supportTables.bytes,168583);
 assert.equal(src.supportTables.sha256,'537cfcf14beca1e76496d4f9c5b60bd7e31d385a16fd69e63083df6978fdf4b9');
 assert.equal(src.originalCollectionSetJson.sourceManifestExpectedBytes,45171);
 assert.equal(src.originalCollectionSetJson.sourceManifestExpectedSha256,'e4887dc5729b8660caadc0d8f875a199a331973ccfeb97c740542a27ac44cc87');
 assert.equal(src.originalCollectionSetJson.rawOriginalWholeFilePresentInSupportTables,false);
 assert.equal(src.originalCollectionSetJson.preservedIndividualRawProtobufPayloads,293);
 assert.equal(src.originalGlobalMetadata.version,31);
 assert.equal(src.historicalMetadataD548.equatedToOriginal,false);
});

test('Four limited real Group wire fragments decode outer ActivityItem6, ByGameplayTag8, with typed Ignore absent',()=>{
 const targets=new Map([[2120000015,2001200013],[2120000016,2001200014],[2120000017,2001200011],[2120000018,2001200012]]);
 assert.equal(evidence.definitionWire.records.length,4);
 for(const r of evidence.definitionWire.records){
  assert.equal(r.tag,targets.get(r.definitionId));assert.equal(r.byGameplayTagValue,r.tag);
  assert.match(r.rawSha256,/^[a-f0-9]{64}$/);
  const group=one(bytes(r.groupField9WireHex),9).value;
  const typed=one(group,2).value;
  assert.equal(field(typed,1).length,0,'Selector Ignore must be absent');
  const activity=one(typed,6).value;
  assert.equal(one(activity,8).value,r.tag);
  assert.equal(r.collectionsByTypeIgnore.fieldPresent,false);
  assert.equal(r.collectionsByTypeIgnore.effectiveDefault,false);
  const explicit=field(group,1);
  if(r.definitionId===2120000015||r.definitionId===2120000016)assert.equal(one(explicit[0].value,1).value,1);
  if(r.definitionId===2120000017)assert.equal(field(explicit[0].value,1).length,0);
  if(r.definitionId===2120000018)assert.equal(explicit.length,0);
 }
});

test('Bounded original Item raw field bytes decode packed Tags; missing mission field is protobuf default, not explicit false',()=>{
 const wanted=new Map([[30200001,[2001200013,2001200025,2001200028]],[30200086,[2001200011,2001200028]],[31100072,[2001200015,2001200014,2001200028]],[30200003,[2001200012,2001200028]]]);
 assert.equal(evidence.representativeItemWire.records.length,4);
 for(const row of evidence.representativeItemWire.records){
  const f=one(bytes(row.tagsFieldWireHex),row.tagsField);
  assert.equal(f.wt,2);
  assert.deepEqual(packed(f.value),wanted.get(row.itemId));
  assert.deepEqual(row.rawTags,wanted.get(row.itemId));
  assert.equal(row.missionFieldPresent,false);
  assert.equal(row.missionProtobufDefault,false);
  assert.equal(row.canBeCollectedStaticValue,true);
  assert.ok(row.rawBytes>200);
  assert.match(row.rawSha256,/^[a-f0-9]{64}$/);
 }
});

test('HasTag fallback is specifically IHasSet.get_SetItem -> ItemDatabase.TryGetItemData<SetItemData>, not tag-to-ItemDatabase shortcut',()=>{
 const x=evidence.originalNativeHasTag.fallbackWhenContainsFalse;
 assert.equal(evidence.originalNativeHasTag.rva,'0x4CC92D0');
 assert.equal(x.castInterfaceType,'IHasSet');
 assert.equal(x.castInterfaceTypeDef,10630);
 assert.equal(x.castInterfaceByvalTypeIndex,65697);
 assert.equal(x.castEncodedUsage,'0x20020143');
 assert.equal(x.interfaceMethod,'IHasSet.get_SetItem');
 assert.equal(x.interfaceMethodDefinitionIndex,104096);
 assert.equal(x.genericMethodSpecIndex,98993);
 assert.equal(x.genericMethodSpecRaw,'31950100ffffffff35230000');
 assert.equal(x.genericInstantiationIndex,9013);
 assert.equal(x.genericConcreteTypeDef,9664);
 assert.equal(x.genericConcreteTypeName,'SetItemData');
 assert.equal(x.queryItemId,'IHasSet.get_SetItem() returned Item ID (not selector Tag ID)');
 assert.equal(x.setTagsProtoField,6);
 assert.equal(x.setTagsBackingFieldOffset,'0x40');
 assert.equal(x.fallbackRepeatedContainsRva,'0x4CC9550');
 assert.equal(x.falseReturnRva,'0x4CC9558');
});

test('Both exact original sealed Crop and Ingredient concrete types lack IHasSet, so raw absence is a static typed-negative only',()=>{
 const concrete=evidence.originalNativeHasTag.concreteTypeInterface;
 assert.equal(concrete.IHasSet.typeDefIndex,10630);
 for(const t of ['CropItemData','IngredientItemData']){
  assert.equal(concrete[t].interfaceOffsetEntries,19);
  assert.equal(concrete[t].hasIHasTags,true);
  assert.equal(concrete[t].hasIHasSet,false);
  assert.equal(concrete[t].sealedInSameBuildDump,true);
 }
 const m=evidence.originalNativeHasTag.predicateResultMatrix;
 assert.equal(m.exactSourceCropIngredientConcrete.directTagFalse,'FALSE_STATIC_NATIVE_INPUT_NO_IHASSET');
 assert.equal(m.exactSourceCropIngredientConcrete.runtimeItemDbInstanceAndCollectionSets,'UNKNOWN');
 assert.equal(m.generalIHasTags.runtimeIHasSetReturnedSetOrItemDbUnknown,'UNKNOWN');
 assert.equal(prev.safety.rawTagAbsenceIsFinalNegative,false,'generic fallback must remain available');
});

test('New raw/fallback evidence does not add selectors or authorize personal Collection/writers/Steam',()=>{
 assert.deepEqual(evidence.coverage,{priorNativeSelectorPredicateClosed:96,additionalSelectorClosures:0,confirmedStaticSelectorCount:96,total:256,remainingUnknown:160,unknownByFamily:{ActivityItem:8,Crafting:28,Furniture:63,Clothing:61}});
 const x=evidence.safety;assert.equal(x.independentQR200NewRawAndFallbackAcceptance,false);assert.equal(x.denominator,null);
 assert.equal(x.unknownFinalNativeMembership,true);assert.equal(x.owned,'UNKNOWN');assert.equal(x.collected,'UNKNOWN');assert.equal(x.missing,'UNKNOWN');
 for(const k of ['personalCollectionMetricsAuthorized','nativeWriterAuthorized','presetApplyAuthorized','communityPublishingAuthorized','entitlementInferenceAuthorized','crossPlatformSemanticTransferAuthorized'])assert.equal(x[k],false);
});
