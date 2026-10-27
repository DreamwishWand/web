import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

const e=JSON.parse(readFileSync('static/ddv/core/collection/v1.25/native-activity-mineral-original-predicate-v125.json','utf8'));
const c=JSON.parse(readFileSync('static/ddv/core/collection/v1.25/collection-definition-source-compact-v125.json','utf8'));
const digest=b=>createHash('sha256').update(b).digest('hex');
const dec=(b,at)=>{let x=0,shift=0,p=at;while(true){assert.ok(p<b.length,'bounded varint');const z=b[p++];x+=(z&127)*2**shift;if(!(z&128))return [x,p];shift+=7;assert.ok(shift<=49);}};
function wire(b){let p=0,rows=[];while(p<b.length){let k;[k,p]=dec(b,p);const f=k>>>3,w=k&7;let v;if(w===0)[v,p]=dec(b,p);else if(w===2){let n;[n,p]=dec(b,p);assert.ok(n>=0&&p+n<=b.length);v=b.subarray(p,p+n);p+=n;}else throw Error('unexpected protobuf wire type '+w);rows.push({f,w,v});}return rows;}
function one(rows,f){const a=rows.filter(x=>x.f===f);assert.equal(a.length,1,'exactly one field '+f);return a[0];}

test('scope is precisely Switch1250 schema624; untraced and unsupported sources remain closed',()=>{
 assert.deepEqual(e.scope,{platform:'Nintendo Switch',gameVersion:'1.25.0',bid:'52BD625D9B4E0053',saveSchema:624});
 assert.equal(e.sources.historicalD548.rawOriginalSource,'NEED_SOURCE');
 assert.equal(e.sources.historicalD548.equatedToOriginal,false);
 assert.equal(e.safety.switch1253OrSteamTransferred,false);
 // These source digests are asserted publisher claims, NOT independent rehashes of original binaries.
 assert.equal(e.sources.exeFsMain.sha256,'3258d5e05aded708c06017b8763fa37bfb696385a2ab29dd8a182d3938cbc0e0');
 assert.equal(e.sources.originalMetadata.sha256,'07e919f07f7be2df883b7292bd3c699f670b4c1e8ff496ef7747447f5baa9f7c');
 assert.equal(e.sources.dumpCs.sha256,'a94ae73d522f160d21255b195b4d834bf5c79db59ddbd8cdfc32e54c6e0671f0');
});

test('published group wire is independently parsed: ByType Activity.Mineral empty, separate ByItem ignored',()=>{
 const parent=one(wire(Buffer.from(e.definition.groupField9WireHex,'hex')),9).v;
 const gr=wire(parent);
 const typed=wire(one(gr,2).v);
 assert.equal(typed.some(z=>z.f===1),false,'ByType.Ignore absent, default false');
 const outer=wire(one(typed,6).v);
 assert.equal(one(outer,7).v.length,0,'Mineral message explicit empty');
 const byItem=wire(one(gr,1).v);
 assert.equal(one(byItem,1).v,1,'ByItem.Ignore=true, not ByType.Ignore');
 const items=one(byItem,2).v;
 const [id,end]=dec(items,0);
 assert.equal(id,31600040);assert.equal(end,items.length);
 assert.equal(e.definition.id,2120000084);
 const recs=c.records.filter(x=>x[0]===2120000084);
 assert.equal(recs.length,1);
 assert.deepEqual(recs[0][5],[['ActivityItem',{Mineral:{}},0]]);
 assert.equal(recs[0][2],e.definition.originalRawPayloadSha256);
 // Compact hash points to original payload; the 114B raw payload itself is not available to this CI.
});

test('two generic arguments are encoded, unlike Flower singleton MethodSpec',()=>{
 const n=e.native, g=n.generic;
 const u=Number.parseInt(g.encodedUsage,16);
 assert.equal((u&0x3ffff)>>>1,98775);
 const b=Buffer.from(g.methodSpecHex,'hex');
 assert.equal(b.length,12);
 assert.equal(b.readUInt32LE(0),103722);
 assert.equal(b.readInt32LE(4),-1);
 assert.equal(b.readUInt32LE(8),34633);
 assert.deepEqual(g.genericArgTypes.map(a=>a.typeDefIndex),[9063,10400]);
 assert.equal(n.mineralArm.endExclusiveRva,'0x4BFDF64');
 assert.equal(Number.parseInt(n.mineralArm.endExclusiveRva,16)-Number.parseInt(n.mineralArm.startRva,16),252);
 assert.equal(n.mineralArm.itemTypeArgument.value,3);
 assert.equal(n.mineralArm.subtypeArgument.value,16);
 assert.equal(n.mineralArm.call.nativeTarget,'0x37816F0');
});

test('published 16-byte AArch64 getter decodes as ldrb +0x60, cmp zero, cset EQ, ret',()=>{
 const b=Buffer.from(e.concrete.getCanBeCollected.instructionHex,'hex');
 assert.equal(b.length,16);
 assert.equal(digest(b),'9173b888b01aea203e357cfeda024f06898a1824ae272ffcf5c2389d294bbd4c');
 const ins=[0,4,8,12].map(off=>b.readUInt32LE(off));
 assert.equal(ins[0],0x39418008); // LDRB W8,[X0,#0x60]
 assert.equal((ins[0]>>>10)&0xfff,0x60);
 assert.equal(ins[1],0x7100011f); // CMP W8,#0
 assert.equal(ins[2],0x1a9f17e0); // CSINC W0,WZR,WZR,NE == CSET W0,EQ
 assert.equal(ins[3],0xd65f03c0);
 assert.equal(e.concrete.icollectionOffset+e.concrete.icollectionGetterVirtualSlot,34);
 assert.equal(e.concrete.methodDefIndex,83420);
 assert.equal(e.concrete.getCanBeCollected.expression,'!IsMissionItem');
 assert.equal(e.concrete.protobuf.missionFlagField,11);
 // This does NOT verify provenance of opcode bytes nor of TypeDef/InterfaceOffset from original NSO+metadata.
});

test('source reference 256 selectors has exactly one Mineral; 53 raw typed records are not independently attested',()=>{
 assert.equal(c.records.length,293);
 const sourceTypes=c.records.flatMap(r=>r[5]||[]);
 assert.equal(sourceTypes.length,256);
 const mineral=c.records.filter(r=>(r[5]||[]).some(s=>s[0]==='ActivityItem'&&Object.hasOwn(s[1]||{},'Mineral')));
 assert.deepEqual(mineral.map(r=>r[0]),[2120000084]);
 assert.equal(e.coverage.previous,101);
 assert.equal(e.coverage.newStaticSelectorClosed,1);
 assert.equal(e.coverage.now,102);
 assert.equal(e.coverage.remainingUnknown,154);
 assert.equal(Object.values(e.coverage.byFamily).reduce((a,b)=>a+b,0),154);
 assert.equal(e.originalTypedMineralSource.recordsChecked,53,'OWNER claim only, original 53 raw protobuf entries unavailable in CI');
 assert.equal(e.originalTypedMineralSource.negativeOtherSubtype.subtype,17);
 assert.equal(e.originalTypedMineralSource.negativeOtherSubtype.staticMineralTypedSelector,'NEGATIVE_DISTINCT_SOURCE_SUBTYPE');
 assert.equal(e.originalTypedMineralSource.examples.find(x=>x.itemId===31600040).byItemIgnoreSeparately,true);
});

test('no projection-only audit can grant independent original-source PASS or runtime/personal/writer rights',()=>{
 assert.equal(e.safety.independentQrAccepted,false);
 assert.equal(e.safety.realDeviceRuntimeEvidence,false);
 assert.equal(e.safety.finalMembershipKnown,false);
 assert.equal(e.safety.denominator,null);
 for(const k of ['owned','collected','missing']) assert.equal(e.safety[k],'UNKNOWN');
 for(const k of ['personalCollectionMetricsEnabled','nativeSaveWriterEnabled','presetApplyEnabled','communityPublishingEnabled','entitlementEditEnabled'])assert.equal(e.safety[k],false);
 assert.equal(e.native.separateCommonIsValidGate,true);
 assert.equal(e.native.projector.hasMineralWhere,false);
 assert.equal(e.originalTypedMineralSource.notRuntimeEnumeratorOutput,true);
});
