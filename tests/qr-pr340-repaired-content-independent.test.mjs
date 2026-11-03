import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { releaseEligible, publicSearchEntries, publicEmptyState } from '../scripts/dbk-rc-seed-contract.mjs';

const d=JSON.parse(readFileSync(new URL('../docs/knowledge/rc-job-content-delta-20261103.json',import.meta.url),'utf8'));
const baseline=d.sourceVersionBaseline;
const ctx={locale:'ja',sourceVersion:baseline,asOf:'2026-11-03T12:00:00Z'};
const otherwiseApproved=()=>({
  jobId:'GDE-SYS',
  contentKind:'CURATED_GUIDE_CONTENT',
  publicIndexEligible:true,
  releaseEligible:true,
  updatedAtActual:'2026-11-03T10:00:00Z',
  rightsDecision:'APPROVED',
  moderationDecision:'CLEAR',
  correctionState:'CURRENT',
  independentQaAccepted:true,
  sourceIdentityVerified:true,
  visibility:'PUBLIC',
  localeReviewed:['ja'],
  sourceVersion:{...baseline},
  freshnessClass:'VERSION_SCOPED'
});
function deniedBoth(row,context=ctx){
  assert.equal(releaseEligible(row,context),false,'Unexpected publication eligibility');
  assert.deepEqual(publicSearchEntries([row],context),[],'Unexpected public search entry');
  assert.equal(publicEmptyState([row],context).empty,true,'Unexpected visible result');
}

test('new-only RED1: unknown freshness classes fail closed, never inferred evergreen',()=>{
  const good=otherwiseApproved();
  assert.equal(releaseEligible(good,ctx),true,'synthetic approved control must be eligible');
  const adversarial=['UNKNOWN_FUTURE_CLASS','EVERGREEN','',null,undefined,42];
  for(const freshnessClass of adversarial)deniedBoth({...good,freshnessClass});
  console.log('QR_D B K_UNKNOWN_FRESHNESS_FAILCLOSED_PASS'.replaceAll(' ',''));
});

test('new-only RED2: mismatched and missing exact schema reject even matching Platform+Version+BID',()=>{
  const good=otherwiseApproved();
  assert.equal(releaseEligible(good,ctx),true);
  assert.equal(baseline.platform,'Nintendo Switch');
  assert.equal(baseline.fullVersion,'1.25.0');
  assert.equal(baseline.bid,'52BD625D9B4E0053');
  assert.equal(baseline.schema,624);
  for(const schema of [626,null,undefined,'624',0,-1,624.5]){
    deniedBoth({...good,sourceVersion:{...baseline,schema}});
    deniedBoth(good,{...ctx,sourceVersion:{...baseline,schema}});
  }
  assert.equal(releaseEligible({...good,sourceVersion:baseline},{...ctx,sourceVersion:baseline}),true);
  console.log('QR_DBK_SCHEMA_624_VS_626_AND_UNKNOWN_FAILCLOSED_PASS');
});

test('actual source content never promoted: 14 jobs, 7 seed and 7 human gates, 0/45 public',()=>{
  assert.equal(d.classification,'SOURCE_ONLY_INTERNAL_RC_NOT_PUBLIC_APPROVAL');
  assert.equal(d.jobs.length,14);
  assert.equal(d.seedGates.length,7);
  assert.equal(d.humanGates.length,7);
  assert.ok(d.jobs.every(row=>row.releaseEligible===false && row.publicIndexEligible===false &&
    row.rightsDecision===null && row.updatedAtActual===null && row.independentQaAccepted===false));
  assert.ok(d.seedGates.every(row=>row.publicAcceptance==='BLOCKED'));
  assert.equal(d.articleEvidence.reviewedEnglish,45);
  assert.equal(d.articleEvidence.publicApproved,0);
  assert.equal(d.articleEvidence.rightsSigned,0);
  assert.equal(d.articleEvidence.nonEnglishHumanSigned,0);
  assert.equal(d.articleEvidence.nonEnglishHumanRequired,315);
  for(const locale of d.localeSet) {
    const view=publicEmptyState(d.jobs,{...ctx,locale});
    assert.deepEqual(view.visible,[]);
    assert.equal(view.empty,true);
  }
  assert.match(d.releaseDecision,/PUBLIC_PREVIEW_NO_GO/);
  console.log('QR_DBK_REAL_CONTENT_ZERO_PUBLIC_UNCHANGED_PASS');
});
