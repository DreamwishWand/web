// 04 QR-W independent new-only negative QA of 07 DBK Item image takedown operator plan.
// All rows are synthetic; NO actual copyrighted art or private data in shared CI.
import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {
 planGameImageTakedown,
 preflightGameItemImage,
 preflightGameImageOperatorReceipt,
 validateImageSuppressionLedger,
 IMAGE_NOTICE_LOCALES
} from '../ops/ddv-item-image-operator-gate.mjs';

const MAIN='6428d080786bf3b2035be86b945b1460dbf1452a';
const SOURCE='84972812d025f486f813ae289aeb0af8cd24458f';
const OWNER=[
 'docs/rights/ddv-item-image-release-operator-20261105.md',
 'ops/ddv-item-image-operator-gate.mjs',
 'ops/ddv-item-image-operator-readiness-template.json',
 'tests/ddv-item-image-operator-gate.test.mjs'
].sort();
const QA=[
 '.github/workflows/04qr-w-pr612-image-operator-independent.yml',
 'tests/04qr-w-pr612-image-operator-independent.test.mjs'
].sort();
const git=(...v)=>execFileSync('git',v,{encoding:'utf8'}).trim();
test('independent immutable original Source4+QA2, no artifact/public writer changes',()=>{
 assert.equal(git('merge-base',MAIN,SOURCE),MAIN);
 assert.equal(git('merge-base',SOURCE,'HEAD'),SOURCE);
 assert.deepEqual(git('diff','--name-only',MAIN,SOURCE).split('\n').sort(),OWNER);
 assert.deepEqual(git('diff','--name-only',SOURCE,'HEAD').split('\n').sort(),QA);
 for(const [p,sha] of Object.entries({
  'ops/ddv-item-image-operator-gate.mjs':'ba0125601a1cacf878bdea1bbe5b13b6c1fa486d',
  'ops/ddv-item-image-operator-readiness-template.json':'d9e0020017b4c979fc41c4578f9504fd0d0f7121',
  'tests/ddv-item-image-operator-gate.test.mjs':'4003a3d29f3f45620cb876bed15e086d3b506879'
 }))assert.equal(git('rev-parse',SOURCE+':'+p),sha,p);
 console.log('QR612_SOURCE_4_QA_2_IMMUTABLE_PROVENANCE_PASS');
});

const S=x=>x.repeat(64);
const sourceIdentity={platform:'Nintendo Switch',fullVersion:'1.24.13',bid:'R39-SYNTHETIC-BID',schema:623};
const targetIdentity={platform:'Nintendo Switch',fullVersion:'1.25.3',bid:'9A239D3DB569756D',schema:626};
const row=(id,src,webp)=>({
 itemId:String(id),sourceGuid:'SYNTHETIC-ONLY-'+id,
 sourcePngSha256:S(src),webpSha256:S(webp),
 sourceIdentity,sourceEvidenceRef:'SYNTHETIC_SOURCE_REF',
 targetIdentity,targetMappingVerified:true,targetEvidenceRef:'SYNTHETIC_TARGET_REF',
 visibilityClass:'PLAYER_VISIBLE_VERIFIED',nativePlayerVisibleVerified:true,
 visibilityEvidenceRef:'SYNTHETIC_VISIBLE_REF',unreleased:false,
 isPrivateSaveMedia:false,isUserCreatedMedia:false
});
const A=row(40000041,'a','b');
const B=row(40000042,'a','c');
const C=row(40000043,'d','c');
const D=row(40000044,'d','e');
const U=row(40000045,'f','1');

test('Owner packet remains OFF and cannot assert operational or licence readiness',()=>{
 const template=JSON.parse(readFileSync(new URL('../ops/ddv-item-image-operator-readiness-template.json',import.meta.url),'utf8'));
 assert.equal(template.publicationState,'OFF');
 assert.equal(template.rightsContact,null);
 assert.equal(template.copyrightLicenceStatus,'UNKNOWN');
 assert.equal(template.suppressionLedgerProvenance,'NOT_VERIFIED');
 assert.deepEqual(Object.keys(template.locales),IMAGE_NOTICE_LOCALES);
 const result=preflightGameImageOperatorReceipt(template);
 assert.equal(result.readyForOperatorReview,false);
 assert.ok(result.reasons.includes('WORKING_RIGHTS_CONTACT_NOT_PROVED'));
 assert.ok(result.reasons.includes('EXPLICIT_OPERATOR_DEPLOYMENT_NOT_AUTHORIZED'));
 assert.equal(preflightGameItemImage(A,{targetIdentity},null).candidate,false);
 assert.equal(validateImageSuppressionLedger(null),false);
 console.log('QR612_OPERATOR_OFF_EIGHT_LOCALE_NOT_REVIEWED_LOCAL_ONLY_PASS');
});

test('takedown plan MUST close transitive PNG ↔ WebP aliases, never strand equivalent bytes',()=>{
 // A --(same PNG a)--> B --(same WebP c)--> C --(same PNG d)--> D.
 // Each content-equal alias can still serve the targeted image by alternate ItemID.
 // U is unrelated and MUST remain outside the suppression scope.
 const plan=planGameImageTakedown([A,B,C,D,U],{kind:'ITEM_ID',value:A.itemId});
 assert.equal(plan.resolvable,true,'valid complete synthetic linked graph');
 assert.deepEqual(plan.itemIds,[A.itemId,B.itemId,C.itemId,D.itemId],
  'all transitive content-hash aliases need a takedown plan, not a one-hop subset');
 assert.deepEqual(plan.hashes,[S('a'),S('b'),S('c'),S('d'),S('e')],
  'linked original and derivative content hashes must cover the closed component');
 assert.ok(plan.actionsRequired.includes('VERIFY_PUBLIC_GET_AND_CACHE_DENIAL'));
 console.log('QR612_TRANSITIVE_CONTENT_ALIAS_TAKEDOWN_CLOSURE_PASS');
});

test('takedown plan MUST fail closed when any linked alias lacks verifiable WebP SHA',()=>{
 // A source PNG hash is shared, but the second row's derivative is corrupt.
 // Omitting that alias would falsely report a "resolvable" complete removal.
 const unsafe={...B,webpSha256:'UNVERIFIED'};
 const plan=planGameImageTakedown([A,unsafe,U],{kind:'ITEM_ID',value:A.itemId});
 assert.equal(plan.resolvable,false,'incomplete linked image source may not be silently dropped');
 assert.ok(plan.reasons.length>0);
 console.log('QR612_UNVERIFIED_LINKED_DERIVATIVE_FAILCLOSED_PASS');
});

test('unrelated content stays outside the takedown group',()=>{
 const p=planGameImageTakedown([A,U],{kind:'ITEM_ID',value:A.itemId});
 assert.equal(p.resolvable,true);
 assert.deepEqual(p.itemIds,[A.itemId]);
 assert.deepEqual(p.hashes,[S('a'),S('b')]);
 assert.equal(preflightGameItemImage(U,{targetIdentity},[]).candidate,true,
  'a separate synthetic item is not automatically hidden by unrelated complaint');
});
