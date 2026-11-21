// 07 DBK / W-RIGHTS-015 / R15 R21 — SOURCE_ONLY manual rights-contact readiness.
// Does not provision mailboxes, send mail, receive content, publish notices or purge media.
import {IMAGE_NOTICE_LOCALES} from './ddv-item-image-operator-gate.mjs';

export const RIGHTS_CONTACT_CANDIDATE = 'support@dreamwishwand.com';
export const RIGHTS_CONTACT_CONTRACT = 'wand.dbk.rights-contact-receipt-source@1';
export const RIGHTS_CONTACT_LABEL_DRAFTS = Object.freeze({
  en:'Rights and image-use notices',
  de:'Hinweise zu Rechten und Bildnutzung',
  'es-ES':'Avisos sobre derechos y uso de imágenes',
  fr:"Signalements relatifs aux droits et aux images",
  it:'Segnalazioni su diritti e uso delle immagini',
  ja:'権利・画像使用に関する申立て',
  'pt-BR':'Avisos sobre direitos e uso de imagens',
  'zh-CN':'权利与图片使用申诉'
});
// Copy is editorial DRAFT. No locale or legal clearance is implied by this constant.
const hasRef = s => typeof s === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:/-]{2,199}$/.test(s)
  && !['UNKNOWN','NOT_RUN','PENDING','SYNTHETIC'].includes(s);
const stamp = s => typeof s === 'string' && !Number.isNaN(Date.parse(s)) && /Z$/.test(s);
const message = v => v && hasRef(v.messageId) && hasRef(v.privateReceiptRef) && stamp(v.observedAt);
const failed = reasons => Object.freeze({
  contract:RIGHTS_CONTACT_CONTRACT, candidate:RIGHTS_CONTACT_CANDIDATE,
  readyForOwnerReceiptReview:reasons.length===0, reasons:Object.freeze(reasons),
  realMailboxProofByCode:false, publicContactEnabled:false, publicationAuthorization:'NOT_GRANTED',
  copyrightLicenceStatus:'UNKNOWN', operatorActionPerformed:false
});

// This is shape checking of *claimed* receipts only. A synthetic complete packet can return
// readyForOwnerReceiptReview=true, but cannot establish delivery or permit publication.
export function preflightRightsContactReceiving(packet) {
  const reasons=[];
  if (!packet || typeof packet!=='object' || Array.isArray(packet))
    return failed(['CONTACT_PACKET_MISSING']);
  if (packet.email!==RIGHTS_CONTACT_CANDIDATE)
    reasons.push('CANDIDATE_ADDRESS_MISMATCH');
  if (packet.domain?.name!=='dreamwishwand.com' || packet.domain?.verified!==true)
    reasons.push('DOMAIN_SENDER_VERIFICATION_UNPROVED');
  if (packet.domain?.receivingEnabled!==true)
    reasons.push('DOMAIN_RECEIVING_NOT_ENABLED');
  if (packet.mailbox?.address!==RIGHTS_CONTACT_CANDIDATE ||
      packet.mailbox?.provisioned!==true || packet.mailbox?.ownerControlled!==true ||
      !hasRef(packet.mailbox?.routingReceiptRef))
    reasons.push('OWNER_INBOX_AND_ROUTING_NOT_VERIFIED');
  if (packet.ownerManualReview!==true || !hasRef(packet.ownerReviewRef))
    reasons.push('OWNER_INDEPENDENT_RECEIPT_REVIEW_REQUIRED');
  const inbound=packet.inboundTest, outbound=packet.replyTest;
  if (!message(inbound) || inbound?.fromIndependentExternalAccount!==true ||
      inbound?.arrivedInRightsInbox!==true)
    reasons.push('EXTERNAL_INBOUND_RECEIVE_NOT_PROVED');
  if (!message(outbound) || outbound?.replyFromRightsInbox!==true ||
      outbound?.deliveredToExternalAccount!==true)
    reasons.push('INBOX_REPLY_DELIVERY_NOT_PROVED');
  if (inbound?.messageId && outbound?.messageId &&
      inbound.messageId===outbound.messageId)
    reasons.push('INBOUND_AND_REPLY_RECEIPTS_NOT_DISTINCT');
  // Only an explicitly non-public draft may be considered for Owner review.
  // Caller-controlled publicHostVerified must never waive an already rendered contact.
  if (packet.noticeCopy?.publicAddressRendered!==false)
    reasons.push('PUBLIC_CONTACT_DISPLAY_BEFORE_ACCEPTANCE');
  const locales=packet.noticeCopy?.locales;
  for(const locale of IMAGE_NOTICE_LOCALES){
    const n=locales?.[locale];
    if (!n || typeof n.text!=='string' || !n.text.includes('Dreamwish Wand') ||
        n.humanReviewed!==true || !hasRef(n.reviewEvidenceRef))
      reasons.push('LOCALE_NOTICE_NOT_OWNER_REVIEWED:'+locale);
  }
  if (Object.keys(RIGHTS_CONTACT_LABEL_DRAFTS).length!==IMAGE_NOTICE_LOCALES.length ||
      IMAGE_NOTICE_LOCALES.some(x=>!RIGHTS_CONTACT_LABEL_DRAFTS[x]))
    reasons.push('CONTACT_LABEL_LOCALE_SET_INVALID');
  return failed(reasons);
}

export function currentRightsContactDraft() {
  return Object.freeze({
    contract:RIGHTS_CONTACT_CONTRACT,
    proposedAddress:RIGHTS_CONTACT_CANDIDATE,
    mailtoCandidate:'mailto:'+RIGHTS_CONTACT_CANDIDATE,
    senderDomainAuthenticated:false, // status must be measured by operator; no persisted runtime snapshot
    receivingEnabled:false,
    inboxProvisioned:false,
    inboundDelivery:'NOT_RUN', replyDelivery:'NOT_RUN',
    contactPublicEnabled:false, copyrightLicenceStatus:'UNKNOWN',
    labelsHumanReviewed:false, labels:RIGHTS_CONTACT_LABEL_DRAFTS
  });
}
