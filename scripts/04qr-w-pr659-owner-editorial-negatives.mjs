// 04 QR-W / PR659 — independent changed-risk negatives, source frozen at a45d91c.
// Right-safe synthetic only. The red checks intentionally fail on an unsafe Source contract.
import assert from "node:assert/strict";
import {execFileSync} from "node:child_process";
import {
  planSoloOwnerEditorialReview,
  planSoloOwnerIssue,
  verifySoloOwnerCaseClosure
} from "../ops/dbk-solo-owner-postpublish.mjs";

const SOURCE = "a45d91c17cc67182709657deda31e387454d0388";
const BASE = "c639edc59a93197b1cc11da0cf604a926b5d144d";
const sourceFiles = new Map([
  ["docs/rights/dbk-solo-owner-public-correction-20261106.md","069cef7afef42a497c78e4a8c6bf8a61330b46b6"],
  ["ops/dbk-solo-owner-postpublish.mjs","7c8301240e9b612d94d66313d8ee1711def9e982"],
  ["tests/dbk-solo-owner-postpublish.test.mjs","25691da54c8b51dede5bb153b54fa82f139a2f2a"]
]);
const qaFiles = [
  ".github/workflows/04qr-w-pr659-owner-editorial-negative.yml",
  "scripts/04qr-w-pr659-owner-editorial-negatives.mjs"
];
const git = (...args) => execFileSync("git",args,{encoding:"utf8"}).trim();

const ident = {platform:"Nintendo Switch",fullVersion:"1.25.3",bid:"9A239D3DB569756D",schema:626};
const owner = {
  kind:"GUIDE_ARTICLE", entityRef:"SYNTHETIC-GUIDE-1", revisionRef:"REV-OLD-1",
  ownerControlled:true, rightsBasis:"OWNER_AUTHORED_VERIFIED", technicalRightsVerified:true,
  visibility:"PUBLIC", privacyChecked:true, minorPrivate:false, dreamsnapsEmbargo:false,
  moderationState:"CLEAR", withdrawn:false, sourceVersionScoped:true,
  sourceIdentity:ident, targetIdentity:ident, thirdPartyCreatorMedia:false,
  publicHostGateVerified:true, publicAllowlistEvidence:true
};
const issue = {
  issueRef:"CASE-SYNTHETIC-1", entityRef:"SYNTHETIC-GUIDE-1",
  observedRevision:"REV-OLD-1", kind:"GUIDE_ARTICLE", type:"EDITORIAL_CORRECTION"
};
const verifiedLookingReceipt = {
  ...{issueRef:issue.issueRef,entityRef:issue.entityRef,observedRevision:issue.observedRevision},
  ownerDispositionVerified:true,privateEvidenceRef:"SYNTHETIC-OWNER",
  publicGetAndCacheChecked:true,hostEvidenceRef:"SYNTHETIC-HTTP",
  rollbackReconciled:true,rollbackEvidenceRef:"SYNTHETIC-ROLLBACK"
};
let failures = 0;
function check(marker,fn) {
  try { fn(); console.log("QR659_PASS_"+marker); }
  catch(e) { failures++;console.error("QR659_TRUE_RED_"+marker+": "+e.message); }
}

check("SOURCE3_BLOB_AND_QA2_FROZEN",()=>{
  assert.equal(git("rev-parse",SOURCE),SOURCE);
  const srcDiff = git("diff","--name-only",BASE,SOURCE).split("\n").filter(Boolean).sort();
  assert.deepEqual(srcDiff,[...sourceFiles.keys()].sort());
  for(const [file,sha] of sourceFiles) assert.equal(git("hash-object",file),sha,file);
  assert.deepEqual(git("diff","--name-only",SOURCE,"HEAD").split("\n").filter(Boolean).sort(),qaFiles);
});
check("ACCEPTED_OWNER_EDITORIAL_BASELINE_NO_PUBLIC_AUTH",()=>{
  const r=planSoloOwnerEditorialReview(owner);
  assert.equal(r.eligible,true);
  assert.equal(r.publicationAuthorization,"NOT_GRANTED");
  const plan=planSoloOwnerIssue(issue);
  assert.equal(plan.valid,true);
  assert.equal(plan.automationPerformed,false);
  const closed=verifySoloOwnerCaseClosure(plan,{...verifiedLookingReceipt,sourceRevisionAfter:"REV-NEW-2"});
  assert.equal(closed.readyForHumanRecordReview,true);
  assert.equal(closed.publicReleaseAuthorized,false);
  assert.equal(closed.operatorActionPerformed,false);
});
check("RIGHTS_PRIVACY_EMBARGO_DENIES_WITHOUT_RETEST",()=>{
  assert.equal(planSoloOwnerEditorialReview({...owner,technicalRightsVerified:false}).eligible,false);
  assert.equal(planSoloOwnerEditorialReview({...owner,minorPrivate:true}).eligible,false);
  assert.equal(planSoloOwnerEditorialReview({...owner,dreamsnapsEmbargo:true}).eligible,false);
});
check("EDITORIAL_CLOSURE_REQUIRES_NEW_REVISION",()=>{
  const plan=planSoloOwnerIssue(issue);
  const r=verifySoloOwnerCaseClosure(plan,verifiedLookingReceipt);
  assert.equal(r.readyForHumanRecordReview,false,
    "Missing sourceRevisionAfter must never allow an editorial correction case to be recorded ready");
});
check("EDITORIAL_CLOSURE_REJECTS_MALFORMED_REVISION",()=>{
  const plan=planSoloOwnerIssue(issue);
  for(const after of [{},[],42,""]) {
    const result=verifySoloOwnerCaseClosure(plan,{...verifiedLookingReceipt,sourceRevisionAfter:after});
    assert.equal(result.readyForHumanRecordReview,false,
      "Invalid or empty sourceRevisionAfter accepted: "+JSON.stringify(after));
  }
});
check("CREATOR_WORK_UNCLASSIFIED_THIRDPARTY_MEDIA_FAILCLOSED",()=>{
  const candidate={...owner,kind:"CREATOR_WORK"};
  delete candidate.thirdPartyCreatorMedia;
  const r=planSoloOwnerEditorialReview(candidate);
  assert.equal(r.eligible,false,
    "Creator Work without explicit third-party-media classification/consent must not enter post-publication queue");
  assert.equal(r.publicationAuthorization,"NOT_GRANTED");
});
check("CREATOR_WORK_EXPLICIT_UNCONSENTED_MEDIA_DENIES",()=>{
  const r=planSoloOwnerEditorialReview({
    ...owner,kind:"CREATOR_WORK",thirdPartyCreatorMedia:true,creatorConsentVerified:false
  });
  assert.equal(r.eligible,false);
  assert.equal(r.publicationAuthorization,"NOT_GRANTED");
});
console.log("QR659_CHANGED_ONLY_RESULTS",JSON.stringify({failures,source:SOURCE,base:BASE,qaFiles:qaFiles.length,sourceFiles:sourceFiles.size}));
if(failures) process.exitCode=1;
