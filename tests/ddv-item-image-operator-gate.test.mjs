import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {
  OWNER_IMAGE_DECISION, IMAGE_NOTICE_LOCALES, validateImageSuppressionLedger,
  preflightGameItemImage, planGameImageTakedown, prepareGameImageTakedownSuppression, preflightGameImageOperatorReceipt
} from "../ops/ddv-item-image-operator-gate.mjs";

const template = JSON.parse(readFileSync(new URL("../ops/ddv-item-image-operator-readiness-template.json", import.meta.url), "utf8"));
const digest = s => s.repeat(64);
const source = { platform: "Nintendo Switch", fullVersion: "1.24.13", bid: "R39-SYNTHETIC-BID", schema: 623 };
const target = { platform: "Nintendo Switch", fullVersion: "1.25.3", bid: "9A239D3DB569756D", schema: 626 };
const ctx = { targetIdentity: target };
const image = {
  itemId: "40000047", sourceGuid: "SYNTHETIC-GUID-NOT-REAL-ASSET",
  sourcePngSha256: digest("a"), webpSha256: digest("b"),
  sourceIdentity: source, sourceEvidenceRef: "SYNTHETIC_R39_EVIDENCE",
  targetIdentity: target, targetMappingVerified: true, targetEvidenceRef: "SYNTHETIC_CURRENT_ITEMID_PROOF",
  visibilityClass: "PLAYER_VISIBLE_VERIFIED", nativePlayerVisibleVerified: true,
  visibilityEvidenceRef: "SYNTHETIC_VISIBLE_UI_PROOF", unreleased: false,
  isPrivateSaveMedia: false, isUserCreatedMedia: false
};

test("actual verified single support contact clears ONLY mailbox check; image publication and operator review remain OFF", () => {
  assert.equal(template.ownerDecision, OWNER_IMAGE_DECISION);
  assert.equal(template.copyrightLicenceStatus, "UNKNOWN");
  assert.equal(template.publicationState, "OFF");
  assert.deepEqual(Object.keys(template.locales), IMAGE_NOTICE_LOCALES);
  assert.ok(Object.values(template.locales).every(r => r.humanReviewed === false && r.reviewEvidenceRef === null));
  const result = preflightGameImageOperatorReceipt(template);
  assert.equal(result.readyForOperatorReview, false);
  for (const code of IMAGE_NOTICE_LOCALES) assert.ok(result.reasons.includes("ATTRIBUTION_LOCALE_NOT_REVIEWED:" + code));
  assert.deepEqual(template.rightsContact, {
    url: "mailto:support@dreamwishwand.com",
    tested: true,
    verificationEvidenceRef: "E-07DBK-20261117-ACT419-SUPPORT-LIVE-INBOUND-OUTBOUND-SCOPED-PASS"
  });
  assert.ok(!result.reasons.includes("WORKING_RIGHTS_CONTACT_NOT_PROVED"));
  for (const missing of [
    null,
    {...template.rightsContact, tested:false},
    {...template.rightsContact, verificationEvidenceRef:null},
    {...template.rightsContact, url:"mailto:invalid"}
  ]) {
    assert.ok(preflightGameImageOperatorReceipt({...template, rightsContact:missing}).reasons.includes("WORKING_RIGHTS_CONTACT_NOT_PROVED"));
  }
  assert.ok(result.reasons.includes("EXPLICIT_OPERATOR_DEPLOYMENT_NOT_AUTHORIZED"));
  // Historic independent QA PR2061 caught a real false acceptance of a
  // foreign mailto with ?bcc using the support inbox's actual proof.
  const ownerMail = template.rightsContact;
  for (const url of [
    "mailto:a@example.test?bcc=private",
    "mailto:support@dreamwishwand.com?bcc=private@example.test",
    "mailto:support@dreamwishwand.com?subject=test",
    "mailto:support@dreamwishwand.com#fragment",
    "mailto:support@dreamwishwand.com%3Fbcc=private",
    "mailto:support@dreamwishwand.com,other@example.test",
    "mailto:foreign@example.test",
    "https://example.test/rights"
  ]) {
    const forged = {...ownerMail, url};
    const output = preflightGameImageOperatorReceipt({...template,rightsContact:forged});
    assert.equal(output.readyForOperatorReview,false,url);
    assert.ok(output.reasons.includes("WORKING_RIGHTS_CONTACT_NOT_PROVED"),url);
  }
  const forgedProof = {...ownerMail, verificationEvidenceRef:"SYNTHETIC_OTHER_INBOX"};
  assert.ok(preflightGameImageOperatorReceipt({...template,rightsContact:forgedProof})
    .reasons.includes("WORKING_RIGHTS_CONTACT_NOT_PROVED"));
  const syntheticStillSeparate = {
    url:"mailto:operator@example.org", tested:true,
    verificationEvidenceRef:"SYNTHETIC_EVIDENCE"
  };
  assert.ok(!preflightGameImageOperatorReceipt({...template,rightsContact:syntheticStillSeparate})
    .reasons.includes("WORKING_RIGHTS_CONTACT_NOT_PROVED"),
    "generic controlled synthetic receipt semantics unchanged");
});

test("synthetic fully scoped operator receipt can clear only SOURCE preflight, never publish", () => {
  const fake = structuredClone(template);
  fake.rightsContact = { url: "mailto:operator@example.org", tested: true,
    verificationEvidenceRef: "SYNTHETIC_EVIDENCE" };
  fake.locales = Object.fromEntries(IMAGE_NOTICE_LOCALES.map(locale => [locale, {
    ...fake.locales[locale], humanReviewed: true, reviewEvidenceRef: "SYNTHETIC_LOCALE_RECEIPT"
  }]));
  for (const c of Object.values(fake.controls)) {
    c.verified = true;
    c.evidenceRef = "SYNTHETIC_OPERATOR_RECEIPT";
  }
  fake.assetBundleSha256 = digest("c");
  fake.assetManifestEvidenceRef = "SYNTHETIC_MANIFEST_REF";
  fake.deploymentAuthorizationRef = "SYNTHETIC_DEPLOYMENT_REF";
  // A verified empty/current suppression ledger is distinct from an UNKNOWN
  // ledger restored by an older bundle or a stale deployment.
  fake.suppressionLedger = [];
  fake.suppressionLedgerProvenance = "SYNTHETIC_SCOPED_LEDGER_VERIFIED";
  assert.deepEqual(preflightGameImageOperatorReceipt(fake), { readyForOperatorReview: true, reasons: [] });
  assert.equal(preflightGameImageOperatorReceipt({...fake, rightsContact: {...fake.rightsContact, tested: false}}).readyForOperatorReview, false);
  assert.equal(preflightGameImageOperatorReceipt({...fake, rightsContact: {...fake.rightsContact, tested: undefined}}).readyForOperatorReview, false);
  assert.equal(preflightGameImageOperatorReceipt({...fake, rightsContact: {...fake.rightsContact, url: "mailto:invented"}}).readyForOperatorReview, false);
  assert.ok(preflightGameImageOperatorReceipt({...fake, locales: {...fake.locales, ja:{...fake.locales.ja, humanReviewed:false}}})
    .reasons.includes("ATTRIBUTION_LOCALE_NOT_REVIEWED:ja"));
  assert.ok(preflightGameImageOperatorReceipt({...fake, controls: {...fake.controls, cdnInvalidation: {verified:false,evidenceRef:null}}})
    .reasons.includes("OPERATOR_CONTROL_NOT_PROVED:cdnInvalidation"));
  assert.ok(preflightGameImageOperatorReceipt({...fake, copyrightLicenceStatus:"DOCUMENTED",copyrightLicenceEvidenceRef:null})
    .reasons.includes("CLAIMED_LICENCE_HAS_NO_EVIDENCE"));
  const deny = (packet, label) => {
    const output = preflightGameImageOperatorReceipt(packet);
    assert.equal(output.readyForOperatorReview,false,label);
    assert.ok(output.reasons.includes("SUPPRESSION_LEDGER_OR_PROVENANCE_NOT_VERIFIED"),label);
  };
  for (const provenance of [
    null,undefined,false, "", "UNKNOWN", "NOT_RUN", "NOT_VERIFIED",
    "not_verified", "NOT_VERIFIED ", " SYNTHETIC_SCOPED_LEDGER_VERIFIED",
    "SYNTHETIC_SCOPED_LEDGER_VERIFIED\nINJECTED"
  ]) deny({...fake,suppressionLedgerProvenance:provenance},String(provenance));
  for (const ledger of [
    null,undefined,{}, "[]",
    [{kind:"SOURCE_SHA256",value:"invalid",state:"HIDDEN",incidentRef:"SYNTHETIC"}],
    [{kind:"ITEM_ID",value:"40000047",state:"RESTORED",incidentRef:"SYNTHETIC"}],
    [{kind:"WEBP_SHA256",value:digest("b"),state:"HIDDEN",incidentRef:"NOT_RUN"}],
    [{kind:"ITEM_ID",value:"40000047",state:"HIDDEN",incidentRef:""}]
  ]) deny({...fake,suppressionLedger:ledger},JSON.stringify(ledger));
  // Valid HIDDEN records never permit the corresponding asset candidate.
  const suppressed = [{kind:"SOURCE_SHA256",value:image.sourcePngSha256,state:"HIDDEN",incidentRef:"SYNTHETIC_TAKEDOWN"}];
  assert.deepEqual(preflightGameImageOperatorReceipt({...fake,suppressionLedger:suppressed}),
    {readyForOperatorReview:true,reasons:[]});
  assert.ok(preflightGameItemImage(image,ctx,suppressed).reasons.includes("ITEM_OR_SHARED_HASH_HIDDEN"));
});

test("asset can only be a technical pack candidate with exact version/visibility/provenance", () => {
  assert.deepEqual(preflightGameItemImage(image, ctx, []), {candidate:true,reasons:[]});
  for(const [row,context,ledger,expected] of [
    [{...image, targetIdentity:{...target,schema:624}},ctx,[],"TARGET_VERSION_BID_SCHEMA_UNVERIFIED"],
    [image,{targetIdentity:{...target,bid:"WRONG_BID"}},[],"TARGET_VERSION_BID_SCHEMA_UNVERIFIED"],
    [{...image, sourceIdentity:{...source,bid:null}},ctx,[],"SOURCE_IDENTITY_UNVERIFIED"],
    [{...image, targetMappingVerified:false},ctx,[],"TARGET_VERSION_BID_SCHEMA_UNVERIFIED"],
    [{...image, visibilityClass:"UNRELEASED"},ctx,[],"UNRELEASED_OR_VISIBILITY_UNKNOWN"],
    [{...image, unreleased:true},ctx,[],"UNRELEASED_OR_VISIBILITY_UNKNOWN"],
    [{...image, nativePlayerVisibleVerified:false},ctx,[],"UNRELEASED_OR_VISIBILITY_UNKNOWN"],
    [{...image, isPrivateSaveMedia:true},ctx,[],"PRIVATE_OR_USER_MEDIA_EXCLUDED"],
    [{...image, isUserCreatedMedia:true},ctx,[],"PRIVATE_OR_USER_MEDIA_EXCLUDED"],
    [{...image, sourcePngSha256:"not hash"},ctx,[],"IMAGE_DIGEST_INVALID"],
    [image,ctx,undefined,"SUPPRESSION_LEDGER_MISSING_OR_INVALID"]
  ]) {
    const result=preflightGameItemImage(row,context,ledger);
    assert.equal(result.candidate,false,expected);
    assert.ok(result.reasons.includes(expected),JSON.stringify(result));
  }
});

test("per-item or shared-source/WebP hash HIDE overrides all technical positive metadata", () => {
  const blocked = (kind,value) => [{kind,value,state:"HIDDEN",incidentRef:"SYNTHETIC_TAKEDOWN"}];
  for(const [kind,value] of [["ITEM_ID",40000047],["ITEM_ID","40000047"],
     ["SOURCE_SHA256",digest("a")],["WEBP_SHA256",digest("b")]]) {
    const ledger=blocked(kind,value);
    assert.equal(validateImageSuppressionLedger(ledger),true);
    assert.ok(preflightGameItemImage(image,ctx,ledger).reasons.includes("ITEM_OR_SHARED_HASH_HIDDEN"));
  }
  assert.equal(validateImageSuppressionLedger([{kind:"ITEM_ID",value:"40000047",state:"UNKNOWN",incidentRef:"x"}]),false);
  assert.equal(preflightGameItemImage(image,ctx,[{kind:"WEBP_SHA256",value:"bad",state:"HIDDEN",incidentRef:"x"}]).candidate,false);
});

test("takedown plan propagates shared PNG through alternate WebP derivative without deleting anything", () => {
  const image2={...image,itemId:"40000048",sourcePngSha256:digest("a"),webpSha256:digest("d")};
  const image3={...image,itemId:"40000049",sourcePngSha256:digest("e"),webpSha256:digest("f")};
  const manifest=[image,image2,image3];
  const plan=planGameImageTakedown(manifest,{kind:"ITEM_ID",value:"40000047"});
  assert.equal(plan.resolvable,true);
  assert.deepEqual(plan.itemIds,["40000047","40000048"]);
  assert.deepEqual(plan.hashes,[digest("a"),digest("b"),digest("d")]);
  assert.ok(plan.actionsRequired.includes("INVALIDATE_CDN_AND_OLD_URLS"));
  assert.deepEqual(planGameImageTakedown(manifest,{kind:"ITEM_ID",value:"99999999"}).reasons,["MAPPING_MISSING_OR_UNVERIFIED"]);
  assert.equal(planGameImageTakedown(manifest,{kind:"SOURCE_SHA256",value:"not a sha"}).resolvable,false);
  assert.equal(planGameImageTakedown([image,{...image2,itemId:null}],{kind:"ITEM_ID",value:"40000047"}).resolvable,false);
});

test("complete shared-image takedown staging preserves old HIDDEN entries and closes PNG/WebP transitive aliases", () => {
  const rows=[
    {...image,itemId:"40000101",sourcePngSha256:digest("a"),webpSha256:digest("b")},
    {...image,itemId:"40000102",sourcePngSha256:digest("a"),webpSha256:digest("c")},
    {...image,itemId:"40000103",sourcePngSha256:digest("d"),webpSha256:digest("c")},
    {...image,itemId:"40000104",sourcePngSha256:digest("d"),webpSha256:digest("e")},
    {...image,itemId:"40000105",sourcePngSha256:digest("f"),webpSha256:digest("1")}
  ];
  const existing=[{kind:"ITEM_ID",value:"77700012",state:"HIDDEN",incidentRef:"SYNTHETIC_PRIOR_INCIDENT"}];
  const old=structuredClone(existing), original=structuredClone(rows);
  const selector={kind:"ITEM_ID",value:"40000101"};
  const result=prepareGameImageTakedownSuppression(rows,selector,existing,"SYNTHETIC_NEW_INCIDENT");
  assert.equal(result.prepared,true);
  assert.deepEqual(result.reasons,[]);
  assert.deepEqual(result.itemIds,["40000101","40000102","40000103","40000104"]);
  assert.deepEqual(result.hashes,["a","b","c","d","e"].map(digest));
  assert.equal(result.additions,9);
  assert.equal(result.suppressionLedger.length,10);
  assert.deepEqual(result.suppressionLedger.find(e=>e.value==="77700012"),existing[0]);
  assert.equal(Object.isFrozen(result.suppressionLedger),true);
  assert.deepEqual(existing,old,"cannot mutate existing ledger");
  assert.deepEqual(rows,original,"cannot mutate original manifest");
  assert.equal(validateImageSuppressionLedger(result.suppressionLedger),true);
  for(const row of rows.slice(0,4)){
    const review=preflightGameItemImage(row,ctx,result.suppressionLedger);
    assert.equal(review.candidate,false,row.itemId);
    assert.ok(review.reasons.includes("ITEM_OR_SHARED_HASH_HIDDEN"),row.itemId);
  }
  assert.deepEqual(preflightGameItemImage(rows[4],ctx,result.suppressionLedger),{candidate:true,reasons:[]});
  assert.ok(result.actionsRequired.includes("INVALIDATE_CDN_AND_OLD_URLS"));
  // Independent entrypoint seed and row ordering cannot lose the transitive closure.
  for(const reversed of [rows.slice().reverse(),[rows[2],rows[4],rows[0],rows[3],rows[1]]]){
    const again=prepareGameImageTakedownSuppression(reversed,
      {kind:"WEBP_SHA256",value:digest("c")},existing,"SYNTHETIC_NEW_INCIDENT");
    assert.equal(again.prepared,true);
    assert.deepEqual(again.suppressionLedger,result.suppressionLedger);
  }
  const idempotent=prepareGameImageTakedownSuppression(rows,selector,
    result.suppressionLedger,"SYNTHETIC_SECOND_INCIDENT");
  assert.equal(idempotent.prepared,true);
  assert.equal(idempotent.additions,0);
  assert.deepEqual(idempotent.suppressionLedger,result.suppressionLedger,
    "a repeated complaint must not erase the original incident receipt");
});

test("fail-closed takedown ledger proposal denies partial restore, duplicate, missing linked digest and fake incident", () => {
  const a={...image,itemId:"40000121",sourcePngSha256:digest("a"),webpSha256:digest("b")};
  const b={...image,itemId:"40000122",sourcePngSha256:digest("a"),webpSha256:digest("c")};
  const selected={kind:"ITEM_ID",value:a.itemId};
  const denied=(rows,selector,old,incident,reason)=>{
    const result=prepareGameImageTakedownSuppression(rows,selector,old,incident);
    assert.equal(result.prepared,false,reason);
    assert.deepEqual(result.reasons,[reason]);
    assert.equal("suppressionLedger" in result,false,reason+" no partial ledger");
  };
  for(const old of [null,undefined,{},[{kind:"ITEM_ID",value:a.itemId,state:"RESTORED",incidentRef:"SYNTHETIC"}],
    [{kind:"WEBP_SHA256",value:"invalid",state:"HIDDEN",incidentRef:"SYNTHETIC"}]])
    denied([a,b],selected,old,"SYNTHETIC_NEW_INCIDENT","EXISTING_SUPPRESSION_LEDGER_INVALID");
  const dupe=[{kind:"ITEM_ID",value:a.itemId,state:"HIDDEN",incidentRef:"SYNTHETIC_ONE"},
    {kind:"ITEM_ID",value:a.itemId,state:"HIDDEN",incidentRef:"SYNTHETIC_TWO"}];
  denied([a,b],selected,dupe,"SYNTHETIC_NEW_INCIDENT","EXISTING_SUPPRESSION_LEDGER_DUPLICATE");
  for(const incident of [null,"","UNKNOWN","NOT_RUN","NOT_VERIFIED","RESTORED"," incident","incident ","incident\nname"])
    denied([a,b],selected,[],incident,"TAKEDOWN_INCIDENT_EVIDENCE_INVALID");
  denied([a,{...b,webpSha256:null}],selected,[],"SYNTHETIC_NEW_INCIDENT","LINKED_IMAGE_MAPPING_INCOMPLETE");
  denied([a,b],{kind:"ITEM_ID",value:"999999999"},[],"SYNTHETIC_NEW_INCIDENT","MAPPING_MISSING_OR_UNVERIFIED");
  denied([a,b],{kind:"WEBP_SHA256",value:"unverified"},[],"SYNTHETIC_NEW_INCIDENT","INVALID_SELECTOR_VALUE");
});
test("no release: existing Guide/CHC Rights/Seed state unaffected by this dedicated operator module", () => {
  assert.equal(typeof OWNER_IMAGE_DECISION, "string");
  assert.equal(preflightGameImageOperatorReceipt(template).readyForOperatorReview,false);
  assert.equal(preflightGameItemImage({...image,targetMappingVerified:false},ctx,[]).candidate,false);
});

test("transitive closure from PNG to WebP to PNG includes every linked Item and both content hashes", () => {
  const A={...image,itemId:"40000101",sourcePngSha256:digest("a"),webpSha256:digest("b")};
  const B={...image,itemId:"40000102",sourcePngSha256:digest("a"),webpSha256:digest("c")};
  const C={...image,itemId:"40000103",sourcePngSha256:digest("d"),webpSha256:digest("c")};
  const D={...image,itemId:"40000104",sourcePngSha256:digest("d"),webpSha256:digest("e")};
  const U={...image,itemId:"40000105",sourcePngSha256:digest("f"),webpSha256:digest("1")};
  const expectedIds=["40000101","40000102","40000103","40000104"];
  const expectedHashes=["a","b","c","d","e"].map(digest);
  for (const manifest of [[A,B,C,D,U],[U,D,C,B,A],[C,U,A,D,B]]) {
    const result=planGameImageTakedown(manifest,{kind:"ITEM_ID",value:A.itemId});
    assert.equal(result.resolvable,true);
    assert.deepEqual(result.itemIds,expectedIds);
    assert.deepEqual(result.hashes,expectedHashes);
    assert.equal(result.itemIds.includes(U.itemId),false);
    const byWebp=planGameImageTakedown(manifest,{kind:"WEBP_SHA256",value:digest("c")});
    assert.deepEqual(byWebp.itemIds,expectedIds);
    assert.deepEqual(byWebp.hashes,expectedHashes);
  }
});
test("damaged linked derivative or alias cannot be silently omitted from takedown closure", () => {
  const A={...image,itemId:"40000111",sourcePngSha256:digest("a"),webpSha256:digest("b")};
  const B={...image,itemId:"40000112",sourcePngSha256:digest("a"),webpSha256:"UNVERIFIED"};
  const C={...image,itemId:"40000113",sourcePngSha256:digest("d"),webpSha256:digest("b")};
  for(const rows of [[A,B],[B,A],[C,A,B]]) {
    const result=planGameImageTakedown(rows,{kind:"ITEM_ID",value:A.itemId});
    assert.equal(result.resolvable,false);
    assert.deepEqual(result.reasons,["LINKED_IMAGE_MAPPING_INCOMPLETE"]);
    assert.deepEqual(result.itemIds,[]);
    assert.deepEqual(result.hashes,[]);
  }
  const invalidItem={...A,itemId:null,webpSha256:digest("e")};
  assert.equal(planGameImageTakedown([A,invalidItem],{kind:"SOURCE_SHA256",value:digest("a")}).resolvable,false);
  // Same ItemID cannot be used to conceal a different damaged derivative.
  const duplicate={...A,webpSha256:null};
  assert.equal(planGameImageTakedown([A,duplicate],{kind:"ITEM_ID",value:A.itemId}).resolvable,false);
  // A corrupted UNLINKED row cannot force a false global takedown of unrelated source.
  assert.deepEqual(planGameImageTakedown([A,{...B,sourcePngSha256:digest("f")}],{kind:"ITEM_ID",value:A.itemId}).itemIds,[A.itemId]);
});

test("Steam image identity uses exact FullVersion evidence, not a manufactured Switch BID", () => {
  const steam = {platform:"Steam Windows",fullVersion:"releases_1.25-synthetic-build",schema:626,
    fullVersionSha256:digest("c")};
  const row={...image,sourceIdentity:steam,targetIdentity:steam};
  const context={targetIdentity:steam};
  assert.deepEqual(preflightGameItemImage(row,context,[]),{candidate:true,reasons:[]});
  assert.deepEqual(preflightGameItemImage({...row,sourceIdentity:{...steam,bid:null}},
    {targetIdentity:{...steam,bid:null}},[]),{candidate:true,reasons:[]});
  for (const invalid of [
    {...steam,fullVersionSha256:undefined}, {...steam,fullVersionSha256:"not-a-sha"},
    {...steam,bid:"9A239D3DB569756D"}, {...steam,bid:""},
    {...steam,fullVersion:"UNKNOWN"}, {...steam,fullVersion:"NOT_RUN"},
    {...steam,schema:-1}, {...steam,platform:"Unknown Platform"}
  ]) {
    const result=preflightGameItemImage({...row,sourceIdentity:invalid},context,[]);
    assert.equal(result.candidate,false);
    assert.ok(result.reasons.includes("SOURCE_IDENTITY_UNVERIFIED"));
  }
  for (const mismatch of [
    {...steam,fullVersionSha256:digest("d")}, {...steam,fullVersion:"releases_other_build"},
    {...steam,schema:624}, {...steam,bid:"9A239D3DB569756D"}, {...steam,fullVersionSha256:undefined},
    target, {...steam,platform:"Unknown Platform"}
  ]) {
    const result=preflightGameItemImage(row,{targetIdentity:mismatch},[]);
    assert.equal(result.candidate,false);
    assert.ok(result.reasons.includes("TARGET_VERSION_BID_SCHEMA_UNVERIFIED"));
  }
  assert.equal(preflightGameItemImage({...row,sourceEvidenceRef:"UNKNOWN"},context,[]).candidate,false);
  assert.equal(preflightGameItemImage({...row,targetEvidenceRef:"NOT_RUN"},context,[]).candidate,false);
  assert.equal(preflightGameItemImage({...row,targetMappingVerified:false},context,[]).candidate,false);
  assert.equal(preflightGameItemImage({...row,unreleased:true},context,[]).candidate,false);
  assert.equal(preflightGameItemImage(row,context,undefined).candidate,false);
  assert.equal(preflightGameItemImage(row,context,[{kind:"ITEM_ID",value:row.itemId,state:"HIDDEN",
    incidentRef:"SYNTHETIC_TAKEDOWN"}]).candidate,false);
  // Explicit cross-platform target mapping remains possible; same schema alone is not a mapping.
  assert.equal(preflightGameItemImage({...row,sourceIdentity:source},context,[]).candidate,true);
  assert.equal(preflightGameItemImage({...row,sourceIdentity:source,targetMappingVerified:false},context,[]).candidate,false);
  assert.equal(preflightGameItemImage(image,ctx,[]).candidate,true);
  assert.equal(preflightGameItemImage({...image,sourceIdentity:{...source,bid:null}},ctx,[]).candidate,false);
});

test("Steam operator rejects noncanonical Build and evidence without normalizing sentinels", () => {
  const steam={platform:"Steam Windows",fullVersion:"releases_1.25-synthetic-build",schema:626,
    fullVersionSha256:digest("c")};
  const row={...image,sourceIdentity:steam,targetIdentity:steam};
  const context={targetIdentity:steam};
  const expectDenied=(candidate,ctx,reason)=>{
    const result=preflightGameItemImage(candidate,ctx,[]);
    assert.equal(result.candidate,false);
    assert.ok(result.reasons.includes(reason),JSON.stringify(result));
  };
  for(const fullVersion of ["UNKNOWN "," UNKNOWN","NOT_RUN\t","\nNOT_RUN","unknown","not_run",
    "UNKNOWN\u00a0","\ufeffUNKNOWN","releases_1.25-synthetic-build "," releases_1.25-synthetic-build",
    "releases_1.25-synthetic-build\n","release build","release\u200bbuild","release\u0000build"]) {
    const invalid={...steam,fullVersion};
    expectDenied({...row,sourceIdentity:invalid},context,"SOURCE_IDENTITY_UNVERIFIED");
    expectDenied({...row,targetIdentity:invalid},{targetIdentity:invalid},"TARGET_VERSION_BID_SCHEMA_UNVERIFIED");
    expectDenied(row,{targetIdentity:invalid},"TARGET_VERSION_BID_SCHEMA_UNVERIFIED");
  }
  for(const fullVersionSha256 of [digest("c")+"\n",digest("c")+" ",digest("c").slice(1)]) {
    const invalid={...steam,fullVersionSha256};
    expectDenied({...row,sourceIdentity:invalid},context,"SOURCE_IDENTITY_UNVERIFIED");
    expectDenied({...row,targetIdentity:invalid},{targetIdentity:invalid},"TARGET_VERSION_BID_SCHEMA_UNVERIFIED");
    expectDenied(row,{targetIdentity:invalid},"TARGET_VERSION_BID_SCHEMA_UNVERIFIED");
  }
  for(const ref of ["UNKNOWN "," UNKNOWN","NOT_RUN\t","unknown","not_run","\ufeffUNKNOWN",
    "receipt "," receipt","receipt\n","receipt\u200b","receipt\u0000"]) {
    expectDenied({...row,sourceEvidenceRef:ref},context,"SOURCE_IDENTITY_UNVERIFIED");
    expectDenied({...row,targetEvidenceRef:ref},context,"TARGET_VERSION_BID_SCHEMA_UNVERIFIED");
  }
  assert.deepEqual(preflightGameItemImage({...row,sourceEvidenceRef:"verified source receipt",targetEvidenceRef:"verified target receipt"},context,[]),
    {candidate:true,reasons:[]});
  assert.deepEqual(preflightGameItemImage({...row,sourceIdentity:{...steam,fullVersionSha256:digest("C")}},context,[]),
    {candidate:true,reasons:[]});
  assert.deepEqual(preflightGameItemImage(image,ctx,[]),{candidate:true,reasons:[]});
});
