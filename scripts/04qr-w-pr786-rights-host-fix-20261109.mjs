// Independent fixed-HEAD source-diff QA (no real mailbox, provider or public release)
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {preflightRightsContactReceiving,currentRightsContactDraft,RIGHTS_CONTACT_CANDIDATE} from '../ops/dbk-rights-contact-receiving-gate.mjs';
import {IMAGE_NOTICE_LOCALES} from '../ops/ddv-item-image-operator-gate.mjs';
const SOURCE='69220b7105608a42318cf1d296a80997675bc6f3';
const OLD='ad8d60868d188d4f94a98256c6c5a4c698f58cbd';
const BASE='b7d86d47125f1764919b67898c39badaf35976d8';
const original=new Map([
 ['docs/rights/dbk-rights-contact-receiving-20261108.md','640352873b85f37bf73e0af1973cdd317e28aca9'],
 ['ops/dbk-rights-contact-receiving-gate.mjs','42701c1f60d63637566d8fcb2797cf033518b504'],
 ['tests/dbk-rights-contact-receiving-gate.test.mjs','b5caa51854641c36c42f63b2dd157e673a2961c9']
]);
const changed=['ops/dbk-rights-contact-receiving-gate.mjs','tests/dbk-rights-contact-receiving-gate.test.mjs'];
const qa=['scripts/04qr-w-pr786-rights-host-fix-20261109.mjs','.github/workflows/04qr-w-pr786-rights-host-fix-20261109.yml'];
const git=(...a)=>execFileSync('git',a,{encoding:'utf8'}).trim();
const diff=(a,b)=>git('diff','--name-only',a,b).split('\n').filter(Boolean).sort();
assert.equal(git('merge-base',BASE,OLD),BASE);
assert.equal(git('merge-base',OLD,SOURCE),OLD);
assert.deepEqual(diff(OLD,SOURCE),changed.sort());
assert.deepEqual(diff(BASE,SOURCE),[...original.keys()].sort());
assert.equal(git('merge-base',SOURCE,'HEAD'),SOURCE);
assert.deepEqual(diff(SOURCE,'HEAD'),qa.sort());
for(const [p,sha] of original){
 assert.equal(git('rev-parse',SOURCE+':'+p),sha);
 assert.equal(git('hash-object',p),sha);
}
assert.equal(git('diff','--name-only',BASE,SOURCE,'--','src','static','supabase','ops/ddv-item-image-operator-gate.mjs','ops/dbk-solo-owner-postpublish.mjs'),'');
console.log('QRW786_SOURCE3_IMMUTABLE_OLD_TO_NEW_REPAIR2_QA_ONLY2_PASS');
const raw=JSON.parse(readFileSync('ops/ddv-item-image-operator-readiness-template.json','utf8'));
const receipt='PRIVATE-SYNTHETIC-RECEIPT-01';
const stamp='2026-11-08T01:00:00Z';
const ready=()=>({
 email:RIGHTS_CONTACT_CANDIDATE,
 domain:{name:'dreamwishwand.com',verified:true,receivingEnabled:true},
 mailbox:{address:RIGHTS_CONTACT_CANDIDATE,provisioned:true,ownerControlled:true,routingReceiptRef:receipt},
 ownerManualReview:true,ownerReviewRef:receipt,
 inboundTest:{messageId:'synthetic-in-01',privateReceiptRef:receipt,observedAt:stamp,fromIndependentExternalAccount:true,arrivedInRightsInbox:true},
 replyTest:{messageId:'synthetic-out-02',privateReceiptRef:receipt,observedAt:stamp,replyFromRightsInbox:true,deliveredToExternalAccount:true},
 noticeCopy:{publicAddressRendered:false,publicHostVerified:false,
  locales:Object.fromEntries(IMAGE_NOTICE_LOCALES.map(l=>[l,{text:raw.locales[l].text,humanReviewed:true,reviewEvidenceRef:receipt}]))}
});
const checkOFF=v=>{
 assert.equal(v.realMailboxProofByCode,false);
 assert.equal(v.publicContactEnabled,false);
 assert.equal(v.publicationAuthorization,'NOT_GRANTED');
 assert.equal(v.operatorActionPerformed,false);
 assert.equal(v.copyrightLicenceStatus,'UNKNOWN');
};
const baseline=preflightRightsContactReceiving(ready());
assert.equal(baseline.readyForOwnerReceiptReview,true);
assert.deepEqual(baseline.reasons,[]);
checkOFF(baseline);
const current=currentRightsContactDraft();
assert.equal(current.receivingEnabled,false);
assert.equal(current.inboxProvisioned,false);
assert.equal(current.contactPublicEnabled,false);
assert.equal(current.inboundDelivery,'NOT_RUN');
assert.equal(current.replyDelivery,'NOT_RUN');
let count=0;
for(const host of [true,false,'true',1,null,undefined]){
 for(const val of [true,'true',1,0,'false',null,undefined,{},[],'0']){
  const p=ready();p.noticeCopy.publicAddressRendered=val;p.noticeCopy.publicHostVerified=host;
  const out=preflightRightsContactReceiving(p);
  assert.equal(out.readyForOwnerReceiptReview,false,'host '+String(host)+' public '+String(val));
  assert.ok(out.reasons.includes('PUBLIC_CONTACT_DISPLAY_BEFORE_ACCEPTANCE'));
  checkOFF(out);count++;
 }
 const missing=ready();delete missing.noticeCopy.publicAddressRendered;missing.noticeCopy.publicHostVerified=host;
 const o=preflightRightsContactReceiving(missing);
 assert.equal(o.readyForOwnerReceiptReview,false);
 assert.ok(o.reasons.includes('PUBLIC_CONTACT_DISPLAY_BEFORE_ACCEPTANCE'));checkOFF(o);count++;
 const safe=ready();safe.noticeCopy.publicHostVerified=host;
 const yes=preflightRightsContactReceiving(safe);
 assert.equal(yes.readyForOwnerReceiptReview,true);checkOFF(yes);
}
for(const notice of [null,{},[],{publicHostVerified:true},{publicAddressRendered:true,publicHostVerified:true}]){
 const p=ready();p.noticeCopy=notice;
 const out=preflightRightsContactReceiving(p);
 assert.equal(out.readyForOwnerReceiptReview,false);
 assert.ok(out.reasons.includes('PUBLIC_CONTACT_DISPLAY_BEFORE_ACCEPTANCE'));checkOFF(out);count++;
}
for(const mutate of [
 p=>{p.domain.receivingEnabled='true'},
 p=>{p.mailbox.ownerControlled='true'},
 p=>{p.ownerManualReview=1},
 p=>{p.noticeCopy.locales.ja.humanReviewed='true'},
 p=>{delete p.noticeCopy.locales['zh-CN']},
 p=>{p.replyTest.messageId=p.inboundTest.messageId}
]){
 const p=ready();mutate(p);const out=preflightRightsContactReceiving(p);
 assert.equal(out.readyForOwnerReceiptReview,false);checkOFF(out);count++;
}
assert.deepEqual([...IMAGE_NOTICE_LOCALES].sort(),['en','de','es-ES','fr','it','ja','pt-BR','zh-CN'].sort());
console.log('QRW786_PUBLIC_HOST_FORGERY_STRICT_FALSE_'+count+'_NEGATIVE_PASS');
console.log('QRW786_FIXED_SOURCE_SYNTHETIC_SCOPE_ONLY_NO_REAL_CONTACT_PROOF');
