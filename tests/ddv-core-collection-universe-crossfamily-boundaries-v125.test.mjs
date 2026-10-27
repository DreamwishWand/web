import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const e=JSON.parse(readFileSync('static/ddv/core/collection/v1.25/native-universe-clothing-furniture-boundaries-v125.json','utf8'));
const defs=JSON.parse(readFileSync('static/ddv/core/collection/v1.25/collection-definition-source-compact-v125.json','utf8')).records;
const decodeVarint=hex=>{const b=Buffer.from(hex,'hex');let n=0,s=0,p=0;while(p<b.length){const z=b[p++];n+=(z&127)*2**s;if(z<128)return {n,consumed:p,bytes:b.length};s+=7;}throw Error('varint');};
test('Pinned same original v1.25.0 sources, no schema626 or historical d548 substitution',()=>{
 assert.deepEqual(e.scope,{platform:'Nintendo Switch',version:'1.25.0',bid:'52BD625D9B4E0053',saveSchema:624});
 assert.equal(e.originalSha256.nso,'3258d5e05aded708c06017b8763fa37bfb696385a2ab29dd8a182d3938cbc0e0');
 assert.equal(e.originalSha256.metadataV31,'07e919f07f7be2df883b7292bd3c699f670b4c1e8ff496ef7747447f5baa9f7c');
 assert.equal(e.originalSha256.lossless,'df78c309a8023667c92426e3b929ed3e51aadf10d943835a3673cefa585f8048');
 assert.equal(e.originalSha256.support,'537cfcf14beca1e76496d4f9c5b60bd7e31d385a16fd69e63083df6978fdf4b9');
 assert.equal(e.originalSha256.historicalD548,'NEED_SOURCE_NOT_EQUATED');
});
test('All unresolved 124 are Universe occurrences, distinct source values per Family and byType Ignore default false',()=>{
 const pairs=[['Clothing',61,4],['Furniture',63,3]];
 for(const [name,count,outer] of pairs){
  const all=[];
  for(const d of defs)for(const item of d[5]||[])if(item[0]===name){assert.deepEqual(Object.keys(item[1]),['Universe']);assert.equal(item[2],0);all.push({id:d[0],universe:item[1].Universe});}
  assert.equal(all.length,count);assert.equal(new Set(all.map(x=>x.universe)).size,count);
  const f=e.originalCollectionDefinitions[name.toLowerCase()];assert.equal(f.universeSelectorOccurrences,count);assert.equal(f.outerCase,outer);assert.equal(f.innerCase,2);assert.equal(f.byTypeIgnoreExplicit,0);
  const x=all.find(z=>z.id===f.sample.id);assert.equal(x.universe,f.sample.universe);
  const v=decodeVarint(f.sample.universeWire);assert.equal(v.n,0x10);const w=decodeVarint(f.sample.universeWire.slice(v.consumed*2));
  assert.equal(w.n,f.sample.universe);assert.equal(w.consumed,w.bytes);
  assert.match(f.sample.fullSha256,/^[a-f0-9]{64}$/);
 }
 assert.equal(e.originalCollectionDefinitions.universeOccurrences,undefined);
 assert.equal(e.originalCollectionDefinitions.noSourceUniverseRowAloneProvesNativeMembership,true);
});
test('Original metadata CType 9204/9078 original interfaces preserve separate concrete ICollectionItem getter identities',()=>{
 const [c,f]=e.originalConcrete;
 assert.equal(c.typeDef,9204);assert.equal(f.typeDef,9078);
 assert.equal(c.icollectionInterfaceOffset+1,c.icollectionVtableSlot);
 assert.equal(f.icollectionInterfaceOffset+1,f.icollectionVtableSlot);
 assert.equal(c.getterMethodDef,85802);assert.equal(f.getterMethodDef,83816);
 assert.equal(c.variationImplemented,false);assert.equal(f.variationImplemented,false);
 assert.equal(c.getterRva,'0x4604120');assert.equal(f.getterRva,'0x45435D0');
 assert.equal(c.getterExpression,'!IsHidden');
 assert.equal(c.getterOpcode16,'08e042391f010071e0179f1ac0035fd6');
 assert.equal(f.secondaryNativeStringCompareHelperRva,'0x6253A20');
 assert.equal(f.positiveGetter,'UNKNOWN');
});
test('Full original source row audit does not imply Universe membership or positive furniture getter',()=>{
 const [c,f]=e.originalConcrete;
 assert.equal(c.originalSourceRowsShaVerified,1900);assert.equal(c.hiddenTrue,95);assert.equal(c.hiddenAbsentDefaultFalse,1805);
 assert.equal(c.representative.id,50700002);assert.equal(c.representative.staticGetter,true);
 assert.equal(c.hiddenNegative.staticGetter,false);
 assert.equal(f.sourceRowsShaVerified,4949);assert.equal(f.sourceHiddenTrue,1299);
 assert.equal(f.sourceHiddenAbsentDefaultFalse,3650);
 assert.equal(f.example.id,40000047);
 assert.equal(f.hiddenNegative.staticGetter,false);
 assert.equal(f.positiveGetter,'UNKNOWN');
});
test('Native Universe branch, Sets lambdas and adjacent generic MemoryShard must not be conflated',()=>{
 assert.equal(e.nativeClothing.universeBranch,'0x4BFB884');
 assert.equal(e.nativeClothing.universeCase2Compare,'0x4BFB8B0');
 assert.equal(e.nativeClothing.differentGetAllCallAt0x4BFB978.typeName,'MemoryShardItemData');
 assert.equal(e.nativeClothing.differentGetAllCallAt0x4BFB978.typeDef,9068);
 assert.equal(e.nativeClothing.wrongPredicate.includes('Sets case1'),true);
 assert.equal(e.nativeFurniture.universeBranch,'0x4BFBD7C');
 assert.equal(e.nativeFurniture.universeCase2Compare,'0x4BFBDAC');
 assert.equal(e.nativeFurniture.wrongPredicate.includes('Sets case1'),true);
 assert.equal(e.nativeClothing.unresolved.includes('cannot equate SetItemID to Universe value'),true);
});
test('Crossfamily original ID uniqueness, zero new native closures and strict fail-closed safety',()=>{
 const id=e.identityAudit;
 assert.equal(id.originalItems,17413);assert.equal(id.uniqueItemIDs,17413);assert.equal(id.duplicateItemIDs,0);
 assert.equal(id.originalDefinitions,293);assert.equal(id.uniqueDefinitionIDs,293);assert.equal(id.duplicateDefinitionIDs,0);
 const c=e.coverage;assert.equal(c.ownerStaticBefore,132);assert.equal(c.closedNow,0);assert.equal(c.ownerStaticAfter,132);
 assert.deepEqual(c.remaining,{Clothing:61,Furniture:63});assert.equal(c.lastIndependentlyAccepted,103);
 const s=e.safety;assert.equal(s.universePredicateClosed,false);assert.equal(s.universeSelectorsAdded,0);
 assert.equal(s.denominator,null);assert.equal(s.finalMembershipKnown,false);
 for(const k of ['personalMetrics','nativeSaveWriter','presetApply','communityPublishing','entitlementEditing','steamOr626Transfer'])assert.equal(s[k],false,k);
 for(const k of ['owned','collected','missing'])assert.equal(s[k],'UNKNOWN');
});
