// 04 QR-W independent changed-only Rights contact preflight, no live mail, no DNS/provider.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {RIGHTS_CONTACT_CANDIDATE,preflightRightsContactReceiving,
 currentRightsContactDraft} from '../ops/dbk-rights-contact-receiving-gate.mjs';
import {IMAGE_NOTICE_LOCALES} from '../ops/ddv-item-image-operator-gate.mjs';

const SOURCE='ad8d60868d188d4f94a98256c6c5a4c698f58cbd';
const PARENT='b7d86d47125f1764919b67898c39badaf35976d8';
const original=new Map([
 ['docs/rights/dbk-rights-contact-receiving-20261108.md','640352873b85f37bf73e0af1973cdd317e28aca9'],
 ['ops/dbk-rights-contact-receiving-gate.mjs','ca83c05524eacdfb5668f7889a8f1e68d7d33434'],
 ['tests/dbk-rights-contact-receiving-gate.test.mjs','b20469bdfc6ba7a1cc9674f54245016ef328fb57']
]);
const qa=[
 '.github/workflows/04qr-w-pr786-rights-contact-newonly-20261109.yml',
 'scripts/04qr-w-pr786-rights-contact-newonly-20261109.mjs'
].sort();
const git=(...a)=>execFileSync('git',a,{encoding:'utf8'}).trim();
const files=(a,b)=>git('diff','--name-only',a,b).split('\n').filter(Boolean).sort();
assert.equal(git('merge-base',PARENT,SOURCE),PARENT);
assert.deepEqual(files(PARENT,SOURCE),[...original.keys()].sort());
assert.equal(git('merge-base',SOURCE,'HEAD'),SOURCE);
assert.deepEqual(files(SOURCE,'HEAD'),qa);
for(const [p,sha] of original){
 assert.equal(git('rev-parse',SOURCE+':'+p),sha);
 assert.equal(git('hash-object',p),sha);
}
assert.equal(git('diff','--name-only',PARENT,SOURCE,'--',
 'src/','static/','supabase/','.github/workflows/pages.yml','ops/ddv-item-image-operator-gate.mjs','ops/dbk-solo-owner-postpublish.mjs'),'');
console.log('QRW786_SOURCE3_IMMUTABLE_QA_ONLY2_NO_PUBLIC_CONTACT_PAGE_OR_PROVIDER_DIFF_PASS');

const packet=JSON.parse(readFileSync('ops/ddv-item-image-operator-readiness-template.json','utf8'));
const receipt='PRIVATE-TEST-NOT-ACTUAL';
const stamp='2026-11-08T01:00:00Z';
const ready=()=>({
 email:RIGHTS_CONTACT_CANDIDATE,
 domain:{name:'dreamwishwand.com',verified:true,receivingEnabled:true},
 mailbox:{address:RIGHTS_CONTACT_CANDIDATE,provisioned:true,ownerControlled:true,routingReceiptRef:receipt},
 ownerManualReview:true,ownerReviewRef:receipt,
 inboundTest:{messageId:'mail-in-001',privateReceiptRef:receipt,observedAt:stamp,
  fromIndependentExternalAccount:true,arrivedInRightsInbox:true},
 replyTest:{messageId:'mail-out-002',privateReceiptRef:receipt,observedAt:stamp,
  replyFromRightsInbox:true,deliveredToExternalAccount:true},
 noticeCopy:{publicAddressRendered:false,publicHostVerified:false,
  locales:Object.fromEntries(IMAGE_NOTICE_LOCALES.map(l=>[l,{
   text:packet.locales[l].text,humanReviewed:true,reviewEvidenceRef:receipt
  }]))}
});
const current=currentRightsContactDraft();
assert.equal(current.proposedAddress,RIGHTS_CONTACT_CANDIDATE);
assert.equal(current.receivingEnabled,false);
assert.equal(current.inboxProvisioned,false);
assert.equal(current.inboundDelivery,'NOT_RUN');
assert.equal(current.replyDelivery,'NOT_RUN');
assert.equal(current.contactPublicEnabled,false);
assert.equal(current.copyrightLicenceStatus,'UNKNOWN');
const synthetic=preflightRightsContactReceiving(ready());
assert.equal(synthetic.readyForOwnerReceiptReview,true,'synthetic packet is only a review candidate');
assert.equal(synthetic.realMailboxProofByCode,false);
assert.equal(synthetic.publicContactEnabled,false);
assert.equal(synthetic.publicationAuthorization,'NOT_GRANTED');
assert.equal(synthetic.operatorActionPerformed,false);
assert.equal(synthetic.copyrightLicenceStatus,'UNKNOWN');
console.log('QRW786_SYNTHETIC_PRECHECK_REVIEW_ONLY_PUBLIC_CONTACT_FALSE_REAL_MAIL_NOT_RUN_PASS');

const denial=[
 ['sender only not receiving',p=>{p.domain.receivingEnabled=false;}],
 ['no mailbox',p=>{p.mailbox.provisioned=false;}],
 ['no owner control',p=>{p.mailbox.ownerControlled=false;}],
 ['routing missing',p=>{p.mailbox.routingReceiptRef=null;}],
 ['independent inbound false',p=>{p.inboundTest.fromIndependentExternalAccount=false;}],
 ['inbound not arrived',p=>{p.inboundTest.arrivedInRightsInbox=false;}],
 ['reply not delivered',p=>{p.replyTest.deliveredToExternalAccount=false;}],
 ['reply reused inbound Message-ID',p=>{p.replyTest.messageId=p.inboundTest.messageId;}],
 ['Owner review false',p=>{p.ownerManualReview=false;}],
 ['unknown candidate address',p=>{p.email='support@example.invalid';}],
 ['unreviewed ja',p=>{p.noticeCopy.locales.ja.humanReviewed=false;}],
 ['missing zh-CN locale',p=>{delete p.noticeCopy.locales['zh-CN'];}],
 ['rendered public contact no managed host',p=>{p.noticeCopy.publicAddressRendered=true;}]
];
for(const [label,mutate] of denial){
 const p=ready();mutate(p);
 assert.equal(preflightRightsContactReceiving(p).readyForOwnerReceiptReview,false,'denied: '+label);
}
console.log('QRW786_SYNTHETIC_NEGATIVE_13_RECEIVING_ROUTING_OWNER_EIGHT_LOCALE_DENY_PASS');

// This preflight cannot attest that a real mailbox or public host exists.
// Synthetic caller-controlled publicHostVerified=true MUST NOT override
// the fact that public contact is already rendered before Owner approval.
for(const [name,value] of [
 ['BOOLEAN_TRUE',true],['STRING_TRUE','true'],['NUMBER_ONE',1]
]){
 const p=ready();
 p.noticeCopy.publicAddressRendered=value;
 p.noticeCopy.publicHostVerified=true;
 const outcome=preflightRightsContactReceiving(p);
 assert.equal(outcome.publicContactEnabled,false,'regardless of input never public');
 assert.equal(outcome.publicationAuthorization,'NOT_GRANTED');
 assert.equal(outcome.readyForOwnerReceiptReview,false,
  'PREMATURE_PUBLIC_CONTACT_SHOULD_REJECT_'+name+' even when caller claims publicHostVerified');
}
console.log('QRW786_SYNTHETIC_PUBLISHED_CONTACT_CANNOT_BYPASS_OWNER_OPERATOR_GATE_PASS');
console.log('QRW786_INDEPENDENT_SOURCE_ONLY_SCOPED_PASS_MANAGED_INBOX_RIGHTS_HOST_NOT_RUN');
