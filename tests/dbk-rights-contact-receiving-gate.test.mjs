import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {preflightRightsContactReceiving,currentRightsContactDraft,RIGHTS_CONTACT_CANDIDATE,
  RIGHTS_CONTACT_LABEL_DRAFTS} from '../ops/dbk-rights-contact-receiving-gate.mjs';
import {IMAGE_NOTICE_LOCALES,planGameImageTakedown} from '../ops/ddv-item-image-operator-gate.mjs';
import {planSoloOwnerIssue} from '../ops/dbk-solo-owner-postpublish.mjs';

const imagePacket=JSON.parse(readFileSync(new URL('../ops/ddv-item-image-operator-readiness-template.json',import.meta.url),'utf8'));
const ref='PRIVATE-OPERATOR-EVIDENCE-01';
const stamp='2026-11-08T01:00:00Z';
const ready=()=>({
  email:RIGHTS_CONTACT_CANDIDATE,
  domain:{name:'dreamwishwand.com',verified:true,receivingEnabled:true},
  mailbox:{address:RIGHTS_CONTACT_CANDIDATE,provisioned:true,ownerControlled:true,routingReceiptRef:ref},
  ownerManualReview:true,ownerReviewRef:ref,
  inboundTest:{messageId:'mail-in-001',privateReceiptRef:ref,observedAt:stamp,
    fromIndependentExternalAccount:true,arrivedInRightsInbox:true},
  replyTest:{messageId:'mail-out-001',privateReceiptRef:ref,observedAt:stamp,
    replyFromRightsInbox:true,deliveredToExternalAccount:true},
  noticeCopy:{publicAddressRendered:false,publicHostVerified:false,
    locales:Object.fromEntries(IMAGE_NOTICE_LOCALES.map(locale=>[locale,{
      text:imagePacket.locales[locale].text,humanReviewed:true,reviewEvidenceRef:ref}]))}
});
test('actual Resend sender-only status and missing Inbox stay fail-closed; address draft is not live',()=>{
  const r=ready();r.domain.receivingEnabled=false;r.mailbox.provisioned=false;
  const out=preflightRightsContactReceiving(r);
  assert.equal(out.readyForOwnerReceiptReview,false);
  assert.ok(out.reasons.includes('DOMAIN_RECEIVING_NOT_ENABLED'));
  assert.ok(out.reasons.includes('OWNER_INBOX_AND_ROUTING_NOT_VERIFIED'));
  assert.equal(out.publicContactEnabled,false);
  assert.equal(currentRightsContactDraft().inboundDelivery,'NOT_RUN');
});
test('synthetic complete packet is *only* eligible for manual Owner review, never public release',()=>{
  const out=preflightRightsContactReceiving(ready());
  assert.equal(out.readyForOwnerReceiptReview,true);
  assert.deepEqual(out.reasons,[]);
  assert.equal(out.realMailboxProofByCode,false);
  assert.equal(out.publicationAuthorization,'NOT_GRANTED');
  assert.equal(out.publicContactEnabled,false);
  assert.equal(out.copyrightLicenceStatus,'UNKNOWN');
});
test('inbound receipt, independent reply, routing and Owner control are distinct mandatory gates',()=>{
  for(const mutate of [
    r=>{r.inboundTest.arrivedInRightsInbox=false},
    r=>{r.replyTest.deliveredToExternalAccount=false},
    r=>{r.replyTest.messageId=r.inboundTest.messageId},
    r=>{r.mailbox.ownerControlled=false},
    r=>{r.mailbox.routingReceiptRef=null},
    r=>{r.ownerManualReview=false},
    r=>{r.email='security@example.org'},
    r=>{r.domain.name='example.org'},
    r=>{r.inboundTest.observedAt='UNKNOWN'}
  ]){
    const packet=ready();mutate(packet);
    assert.equal(preflightRightsContactReceiving(packet).readyForOwnerReceiptReview,false);
  }
});
test('all eight notice locales are draft only until reviewed; absent locale blocks',()=>{
  assert.deepEqual(Object.keys(RIGHTS_CONTACT_LABEL_DRAFTS).sort(),[...IMAGE_NOTICE_LOCALES].sort());
  assert.deepEqual(Object.keys(imagePacket.locales).sort(),[...IMAGE_NOTICE_LOCALES].sort());
  assert.ok(IMAGE_NOTICE_LOCALES.every(l=>imagePacket.locales[l].humanReviewed===false));
  const x=ready();x.noticeCopy.locales.ja.humanReviewed=false;
  assert.ok(preflightRightsContactReceiving(x).reasons.includes('LOCALE_NOTICE_NOT_OWNER_REVIEWED:ja'));
  const y=ready();delete y.noticeCopy.locales['zh-CN'];
  assert.ok(preflightRightsContactReceiving(y).reasons.includes('LOCALE_NOTICE_NOT_OWNER_REVIEWED:zh-CN'));
});
test('public display cannot be assumed from synthetic receipts or lack of hosted verification',()=>{
  const p=ready();p.noticeCopy.publicAddressRendered=true;
  assert.ok(preflightRightsContactReceiving(p).reasons.includes('PUBLIC_CONTACT_DISPLAY_BEFORE_ACCEPTANCE'));
  assert.equal(preflightRightsContactReceiving({}).publicContactEnabled,false);
  assert.equal(preflightRightsContactReceiving(null).readyForOwnerReceiptReview,false);
});
test('old proven connected-hash takedown and Owner triage are reused without mutation',()=>{
  const hex=c=>c.repeat(64);
  const rows=[{itemId:'101',sourcePngSha256:hex('a'),webpSha256:hex('b')},
    {itemId:'102',sourcePngSha256:hex('a'),webpSha256:hex('c')}];
  const scope=planGameImageTakedown(rows,{kind:'ITEM_ID',value:'101'});
  assert.equal(scope.resolvable,true);
  assert.deepEqual(scope.itemIds,['101','102']);
  const i=planSoloOwnerIssue({issueRef:'private-case-01',entityRef:'item-101',
    observedRevision:'r1',kind:'ITEM_IMAGE',type:'RIGHTS_NOTICE',
    manifestRows:rows,imageSelector:{kind:'ITEM_ID',value:'101'},
    claimantPrivateEmail:'MUST_NOT_LEAK'});
  assert.equal(i.decision,'OWNER_QUARANTINE_FIRST');
  assert.equal(JSON.stringify(i).includes('MUST_NOT_LEAK'),false);
  assert.equal(i.publicationAuthorization,'NOT_GRANTED');
  assert.equal(i.automationPerformed,false);
});
