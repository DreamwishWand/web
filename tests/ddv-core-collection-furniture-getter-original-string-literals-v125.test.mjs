import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const x=JSON.parse(readFileSync('static/ddv/core/collection/v1.25/native-furniture-getter-string-literals-v125.json','utf8'));
function vv(b,i){let n=0,s=0;while(true){assert.ok(i<b.length);const q=b[i++];n+=(q&127)*2**s;if(q<128)return [n,i];s+=7;assert.ok(s<56);}}
function firstProtobuf(b){let i=0,rows=[];while(i<b.length){const [tag,j]=vv(b,i);i=j;let value;if((tag&7)===0){[value,i]=vv(b,i);}else if((tag&7)===2){const [len,end]=vv(b,i);i=end;assert.ok(i+len<=b.length);value=b.subarray(i,i+len);i+=len;}else throw new Error('wire type');rows.push({number:tag>>>3,wireType:tag&7,value});}return rows;}
test('Furniture getter new evidence is original Switch 1.25.0 only with d548 still NEED_SOURCE',()=>{
 assert.deepEqual(x.scope,{platform:'Nintendo Switch',gameVersion:'1.25.0',buildId:'52BD625D9B4E0053',saveSchema:624});
 assert.equal(x.original.main.sha256,'3258d5e05aded708c06017b8763fa37bfb696385a2ab29dd8a182d3938cbc0e0');
 assert.equal(x.original.metadata.sha256,'07e919f07f7be2df883b7292bd3c699f670b4c1e8ff496ef7747447f5baa9f7c');
 assert.equal(x.original.dump.sha256,'a94ae73d522f160d21255b195b4d834bf5c79db59ddbd8cdfc32e54c6e0671f0');
 assert.equal(x.original.losslessGzip.sha256,'df78c309a8023667c92426e3b929ed3e51aadf10d943835a3673cefa585f8048');
 assert.equal(x.original.supportGzip.sha256,'537cfcf14beca1e76496d4f9c5b60bd7e31d385a16fd69e63083df6978fdf4b9');
 assert.equal(x.original.historicalD548.provenance,'NEED_SOURCE');assert.equal(x.original.historicalD548.equatedToOriginal,false);
});
test('Encoded original metadata string literal usages decode two exact prohibitions, not speculative text',()=>{
 const refs=x.native.originalStringReferences;
 assert.equal(refs.length,2);
 assert.deepEqual(refs.map(r=>r.literal),['Request!','Mission!']);
 for(const r of refs){const n=Number.parseInt(r.encodedUsage,16);assert.equal(n>>>29,5);assert.equal((n&0x1fffffff)>>>1,r.metadataLiteralIndex);assert.equal(r.literalRecordLength,8);}
 assert.equal(refs[0].metadataLiteralIndex,26775);assert.equal(refs[0].literalDataRelativeOffset,0xe241b);
 assert.equal(refs[1].metadataLiteralIndex,21897);assert.equal(refs[1].literalDataRelativeOffset,0xbd6f7);
 assert.equal(refs[0].utf8Sha256,'682978e8a051bc4782ab08be95ca3316eefda04c3edc4fbbbef4c59b882e6762');
 assert.equal(refs[1].utf8Sha256,'e0049c6d184493605a7c8944d5a77ed18238f78c0cf48810b9598d5c463c41e2');
});
test('Original getter uses Ordinal String.IndexOf twice after IsHidden and distinguishes null Name branch',()=>{
 const n=x.native;
 assert.equal(n.getterRva,'0x45435D0');assert.equal(n.getterBytes,208);
 assert.equal(n.getterSha256,'01aab89f1f4d58ec91067a3f65324145d24c10acb590aa4398874b68d92d2b3f');
 assert.equal(n.isHiddenReadRva,'0x4543620');assert.equal(n.protobufIsHiddenField,24);
 assert.equal(n.nameReadRva,'0x454363C');assert.equal(n.protobufNameField,2);
 assert.deepEqual(n.originalStringReferences.map(r=>r.indexOfCallRva),['0x4543658','0x4543684']);
 assert.equal(n.indexOf.callTarget,'0x6253A20');assert.equal(n.indexOf.comparisonType,4);assert.equal(n.indexOf.comparisonName,'Ordinal');assert.equal(n.indexOf.caseSensitive,true);
 assert.equal(n.nullNameHandling.includes('exception helper'),true);
 assert.equal(n.staticGetterExpression,'!FurnitureItemData.IsHidden && Name.IndexOf("Request!",0,Name.Length,Ordinal)<0 && Name.IndexOf("Mission!",0,Name.Length,Ordinal)<0');
 assert.equal(n.runtimeObserved,false);
});
test('Bounded original protobuf inputs distinguish explicit hidden true from absent default false',()=>{
 const q=x.originalTypedSource;assert.equal(q.perRowSha256Verified,4949);
 assert.equal(q.isHiddenAbsentDefaultFalse,3650);assert.equal(q.isHiddenExplicitTrue,1299);
 assert.equal(q.hiddenWithMissionName,1106);assert.equal(q.hiddenWithoutMissionName,193);assert.equal(q.requestPrefixSourceRows,0);
 assert.equal(q.conditionalStaticGetterTrue,3650);assert.equal(q.conditionalStaticGetterFalse,1299);
 for(const r of q.examples){const name=firstProtobuf(Buffer.from(r.nameField2Hex,'hex'));assert.equal(name.length,1);assert.equal(name[0].number,2);assert.equal(name[0].value.toString('utf8'),r.name);assert.match(r.rawSha256,/^[a-f0-9]{64}$/);if(r.isHiddenField24Present){const h=firstProtobuf(Buffer.from(r.isHiddenField24Hex,'hex'));assert.equal(h.length,1);assert.equal(h[0].number,24);assert.equal(h[0].value,1);}else assert.equal(r.staticGetter,true);}
 assert.equal(q.sourceOnlyNotLiveMembership,true);
});
test('Closing getter string literals does NOT accept any of 124 Universe selectors or real user collection eligibility',()=>{
 const b=x.universeAndMembershipBoundary,s=x.safety;
 assert.equal(b.clothingUniverseSelectorOccurrences,61);assert.equal(b.furnitureUniverseSelectorOccurrences,63);
 assert.equal(b.nativeUniverseCase2AndSetLink,'NEED_SOURCE_NATIVE_CALL_CHAIN');
 assert.equal(b.furnitureSelectorIdsPromoted,0);assert.equal(b.clothingSelectorIdsPromoted,0);
 assert.equal(b.ownerStaticPredicateBefore,132);assert.equal(b.ownerStaticPredicateAfter,132);
 assert.deepEqual(b.unresolved124,{Clothing:61,Furniture:63});
 assert.equal(b.notEquivalentToSetUniverseJoin,true);assert.equal(b.separateByItemIgnoreAndCommonIsValid,true);
 assert.equal(s.qrAccepted,false);assert.equal(s.finalMembershipKnown,false);assert.equal(s.denominator,null);
 for(const k of ['personalMetrics','nativeWriter','presetApply','communityPublishing','entitlementEditing','crossVersionSemantics'])assert.equal(s[k],false,k);
 for(const k of ['owned','collected','missing'])assert.equal(s[k],'UNKNOWN');
});
