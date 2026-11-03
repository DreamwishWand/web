import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { releaseEligible, publicSearchEntries, publicEmptyState, LAUNCH_LOCALES, HELP_CHILDREN } from "../scripts/dbk-rc-seed-contract.mjs";
const d=JSON.parse(readFileSync(new URL("../docs/knowledge/rc-job-content-delta-20261103.json",import.meta.url),"utf8"));
const ver=d.sourceVersionBaseline;
const good={jobId:"GDE-SYS",contentKind:"CURATED_GUIDE_CONTENT",releaseEligible:true,rightsDecision:"APPROVED",moderationDecision:"CLEAR",correctionState:"CURRENT",independentQaAccepted:true,sourceIdentityVerified:true,visibility:"PUBLIC",localeReviewed:["ja"],sourceVersion:ver,freshnessClass:"VERSION_SCOPED"};
const ctx={locale:"ja",sourceVersion:ver,asOf:"2026-11-03T12:00:00Z"};
test("15 canonical RC consumer rows and 7 release gates remain unpromoted",()=>{
 assert.equal(d.jobs.length,14); assert.equal(new Set(d.jobs.map(x=>x.jobId)).size,14);
 assert.equal(d.seedGates.length,7);
 assert.ok(d.jobs.every(x=>x.releaseEligible===false && x.publicIndexEligible===false && x.updatedAtActual===null && x.rightsDecision===null));
 assert.ok(d.seedGates.every(x=>x.publicAcceptance==="BLOCKED"));
 assert.equal(d.articleEvidence.publicApproved,0);assert.equal(d.articleEvidence.reviewedEnglish,45);
});
test("seven Systems taxonomy and 4 Help children are not confused",()=>{
 assert.deepEqual(HELP_CHILDREN,["Questions","Tips","Issues","My Activity"]);
 assert.deepEqual(d.consumerRules.guideRoots,["Quests","Star Paths","Events","Systems"]);
 assert.equal(d.consumerRules.unanswered,"Questions filter, not fifth child");
});
test("all eight locales fail closed on source-only seed",()=>{
 for(const locale of LAUNCH_LOCALES){const r=publicEmptyState(d.jobs,{...ctx,locale});assert.equal(r.empty,true);assert.equal(r.visible.length,0);}
});
test("synthetic approved row proves strict conditional gates",()=>{
 assert.equal(releaseEligible(good,ctx),true);
 assert.equal(releaseEligible({...good,rightsDecision:null},ctx),false);
 assert.equal(releaseEligible({...good,moderationDecision:"HOLD"},ctx),false);
 assert.equal(releaseEligible({...good,correctionState:"PENDING"},ctx),false);
 assert.equal(releaseEligible({...good,localeReviewed:["en"]},ctx),false);
 assert.equal(releaseEligible({...good,sourceVersion:{...ver,fullVersion:"1.25.3"}},ctx),false);
 assert.equal(releaseEligible({...good,sourceVersion:null},ctx),false);
 assert.equal(releaseEligible({...good,dlcRequired:true,dlcVerified:false},ctx),false);
 assert.equal(releaseEligible({...good,usesMedia:true,mediaRightsVerified:false},ctx),false);
 assert.equal(releaseEligible({...good,syntheticTestFixture:true},ctx),false);
 assert.equal(releaseEligible({...good,embargoed:true},ctx),false);
 assert.equal(releaseEligible({...good,contentKind:"PRIVATE_ISSUE_REPORT"},ctx),false);
});
test("stale, missing, expired official snapshots fail closed",()=>{
 const live={...good,freshnessClass:"LIVE_24H",verifiedAt:"2026-11-03T10:00:00Z",expiresAt:"2026-11-04T10:00:00Z"};
 assert.equal(releaseEligible(live,ctx),true);
 for(const row of [{...live,verifiedAt:null},{...live,verifiedAt:"2026-11-01T00:00:00Z"},{...live,expiresAt:"2026-11-03T11:00:00Z"}]) assert.equal(releaseEligible(row,ctx),false);
});
test("public adapter never carries body/private source/media or unpublished search entries",()=>{
 const items=[good,{...good,jobId:"CHC-I",contentKind:"PRIVATE_ISSUE_REPORT"},{...good,jobId:"GAL-DEC",rightsDecision:null}];
 const output=publicSearchEntries(items,ctx);assert.equal(output.length,1);assert.deepEqual(Object.keys(output[0]).sort(),["canonicalEntityId","contentKind","jobId","sourceVersion"].sort());
});
