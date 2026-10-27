import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const base='static/ddv/core/collection/v1.25/';
const flower=JSON.parse(readFileSync(base+'native-activity-flower-original-predicate-v125.json'));
const prev=JSON.parse(readFileSync(base+'native-activity-raw-wire-hastag-fallback-v125.json'));
const compact=JSON.parse(readFileSync(base+'collection-definition-source-compact-v125.json'));
const byId=new Map(compact.records.map(r=>[r[0],r]));
const newId=2120000083;

test('QR202-FLOWER-01: one new selector only, prior Activity 4 intact and Mineral case7 remains unpromoted',()=>{
 assert.equal(prev.coverage.confirmedStaticSelectorCount,96);
 assert.equal(flower.coverage.previousConfirmed,prev.coverage.confirmedStaticSelectorCount);
 assert.equal(flower.coverage.closedNow,1);
 assert.equal(flower.coverage.nowConfirmed,flower.coverage.previousConfirmed+1);
 assert.equal(flower.coverage.nowConfirmed+flower.coverage.remainingUnknown,256);
 const statuses=flower.selectionAudit.filter(x=>x.state==='OWNER_CONFIRMED_STATIC_PREDICATE');
 assert.deepEqual(statuses.map(x=>x.id),[newId]);
 const unknown=flower.selectionAudit.filter(x=>x.state==='UNKNOWN');
 assert.equal(unknown.length,7);
 assert.equal(new Set(flower.selectionAudit.map(x=>x.id)).size,8);
 assert.equal(flower.selectionAudit.find(x=>x.id===2120000084).selector,'Mineral:{}');
 assert.equal(flower.selectionAudit.find(x=>x.id===2120000084).state,'UNKNOWN');
 assert.deepEqual(flower.coverage.unknownFamilies,{ActivityItem:7,Crafting:28,Clothing:61,Furniture:63});
 assert.equal(Object.values(flower.coverage.unknownFamilies).reduce((a,b)=>a+b,0),159);
});

test('QR202-FLOWER-02: empty Flower is an explicit case and 117 typed Source rows are NOT 94 live candidates',()=>{
 const row=byId.get(newId);
 assert.ok(row);
 assert.equal(row[2],flower.selector.definitionRawSha256);
 assert.equal(row[0],newId);
 assert.deepEqual(row[5],[['ActivityItem',{Flower:{}},0]]);
 assert.equal(flower.selector.outerField,6);
 assert.equal(flower.selector.innerField,3);
 assert.equal(flower.selector.wire.flowerField3,'1a00');
 assert.equal(flower.selector.byTypeIgnore.fieldPresent,false);
 assert.equal(flower.selector.byItemGroupPresent,false);
 assert.equal(flower.originalNative.projector.noPredicateWhereInFlowerCase,true);
 const source=flower.rawTypedFlowerSource;
 assert.equal(source.auditedOriginalProtobufRows,source.missionAbsentDefaultFalse+source.missionPresentTrue);
 assert.equal(source.auditedOriginalProtobufRows,117);
 assert.equal(source.missionAbsentDefaultFalse,94);
 assert.equal(source.missionPresentTrue,23);
 assert.equal(source.typedGetterTrueSourceRows,94);
 assert.equal(source.typedGetterFalseSourceRows,23);
 assert.equal(source.theseAreNotRuntimeItemDatabaseRecords,true);
 assert.equal(flower.safety.runtimeItemDatabaseVerified,false);
 assert.equal(flower.safety.finalMembershipKnown,false);
 assert.equal(flower.safety.denominator,null);
});

test('QR202-FLOWER-03: original-type scope cannot promote inherited metadata, writers or 626/Steam',()=>{
 const s=flower.scope,src=flower.originalSources;
 assert.deepEqual(s,{platform:'Nintendo Switch',version:'1.25.0',buildId:'52BD625D9B4E0053',saveSchema:624});
 assert.equal(src.historicalUntracedMetadata.sourceStatus,'NEED_SOURCE_NOT_EQUATED');
 assert.notEqual(src.historicalUntracedMetadata.sha256,src.metadata.sha256);
 assert.equal(flower.concrete.typeDefIndex,9472);
 assert.equal(flower.concrete.interfaceOffset+flower.concrete.interfaceGetterSlot,flower.concrete.concreteVtableSlot);
 assert.equal(flower.concrete.nativeCanBeCollected.expression,'!IsMissionItem');
 assert.equal(flower.concrete.variationInterfaceAbsent,true);
 assert.equal(flower.originalNative.getAllByType.genericTypeDefIndex,9472);
 assert.equal(flower.originalNative.getAllByType.itemTypeArgument,3);
 for(const k of ['finalMembershipKnown','runtimeItemDatabaseVerified','personalCollectionMetricsAuthorized','entitlementsAuthorized','nativeWriterAuthorized','presetApplyAuthorized','communityPublisherAuthorized','steamOrSchema626Transferred','independentQRNewClosure'])assert.equal(flower.safety[k],false,k);
 for(const k of ['owned','collected','missing'])assert.equal(flower.safety[k],'UNKNOWN');
 assert.equal(flower.safety.denominator,null);
});
