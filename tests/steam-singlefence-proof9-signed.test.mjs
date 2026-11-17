import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {SINGLEFENCE_PROOF9_PINS as pins,SINGLEFENCE_PROOF9_BID as buildId}
 from '../scripts/readonly-release/steam-singlefence-proof9-preflight.mjs';
import {validateProofGitSnapshot,proofWorkflowContext,PROOF_SIGNER}
 from '../scripts/readonly-release/steam-singlefence-proof9-signed.mjs';
const y=readFileSync(new URL('../.github/workflows/steam626-singlefence-proof9.yml',import.meta.url),'utf8');
const cli=readFileSync(new URL('../scripts/readonly-release/steam-singlefence-proof9-signed.mjs',import.meta.url),'utf8');
const source='a'.repeat(40);
const ctx=()=>({WAND_PROOF_EXPECTED_SOURCE:source,GITHUB_ACTIONS:'true',
 GITHUB_REPOSITORY:'DreamwishWand/web',GITHUB_REPOSITORY_ID:'1371485649',
 GITHUB_EVENT_NAME:'workflow_dispatch',GITHUB_REF:'refs/heads/main',
 GITHUB_SHA:source,GITHUB_WORKFLOW_SHA:source,
 GITHUB_WORKFLOW_REF:'DreamwishWand/web/.github/workflows/steam626-singlefence-proof9.yml@refs/heads/main'});
const fixture=()=>({repositoryId:1371485649,sourceHead:source,buildId,
 blobs:Object.fromEntries(pins.map(p=>[p.path,{sha:p.sha,mode:p.mode,type:p.type}]))});
const denied=f=>assert.throws(f,/SINGLEFENCE_PROOF9_SIGNED_SCOPE_DENIED/);
test('Proof9 exact existing ten signed Reader input SHA/modes: preflight only, no authorization',()=>{
 const p=validateProofGitSnapshot(fixture());
 assert.equal(p.status,'SINGLEFENCE_PROOF9_EXACT10_SOURCE_ONLY');
 assert.equal(p.pinCount,10);
 for(const k of ['proofDispatched','signedSubjectsVerified','writerAuthorized','operationOn'])
  assert.equal(p[k],false);
 assert.equal(PROOF_SIGNER.signerWorkflow,
  'DreamwishWand/web/.github/workflows/steam626-singlefence-proof9.yml');
});
test('Proof9 source snapshots fail-closed missing, wrong blob, mode, tree/symlink and extra',()=>{
 for(const p of pins){
  const no=fixture();delete no.blobs[p.path];denied(()=>validateProofGitSnapshot(no));
  const bad=fixture();bad.blobs[p.path].sha='f'.repeat(40);denied(()=>validateProofGitSnapshot(bad));
  const mode=fixture();mode.blobs[p.path].mode='120000';denied(()=>validateProofGitSnapshot(mode));
  const type=fixture();type.blobs[p.path].type='tree';denied(()=>validateProofGitSnapshot(type));
 }
 const extra=fixture();extra.blobs['private-save.p1g']={sha:'f'.repeat(40),mode:'100644',type:'blob'};
 denied(()=>validateProofGitSnapshot(extra));
 for(const d of [{repositoryId:42},{sourceHead:'HEAD'},{sourceHead:''},
  {buildId:'Switch626'},{writerAuthorized:true},{signedSubjectsVerified:true}]){
  denied(()=>validateProofGitSnapshot({...fixture(),...d}));
 }
});
test('Proof9 protected main workflow context excludes PR, forks, stale head, wrong issuer',()=>{
 assert.equal(proofWorkflowContext(ctx()),source);
 for(const d of [{GITHUB_EVENT_NAME:'push'},{GITHUB_EVENT_NAME:'pull_request'},
  {GITHUB_REPOSITORY:'DreamwishWand/site'},{GITHUB_REPOSITORY_ID:'0'},
  {WAND_PROOF_EXPECTED_SOURCE:'f'.repeat(40)},{GITHUB_REF:'refs/heads/dev'},
  {GITHUB_WORKFLOW_SHA:'f'.repeat(40)},
  {GITHUB_WORKFLOW_REF:'DreamwishWand/web/.github/workflows/pages.yml@refs/heads/main'},
  {GITHUB_SHA:'f'.repeat(40)},{GITHUB_ACTIONS:'false'}])
  denied(()=>proofWorkflowContext({...ctx(),...d}));
});
test('Proof9 dedicated workflow only explicit dispatch, exact main CI CAS and signed three metadata-only',()=>{
 assert.match(y,/^on:\n  workflow_dispatch:/m);
 assert.doesNotMatch(y,/\n  (?:push|pull_request|schedule):/);
 assert.match(y,/if: github.event_name == 'workflow_dispatch' && inputs.scoped_singlefence_proof_source != '' && github.ref == 'refs\/heads\/main'/);
 assert.match(y,/persist-credentials: false/);
 assert.match(y,/--no-default-features --features product-steam626-singlefence-readonly,worker-wasm/);
 assert.match(y,/actions\/attest-build-provenance@v2/);
 assert.match(y,/actions\/upload-artifact@v4/);
 assert.doesNotMatch(y,/actions\/(?:deploy-pages|upload-pages-artifact)@|npm run build|seal-private-v2|src\/routes|static\/worker-wasm\/ddv_save_core/);
 const required=['source-check','ci-build','build-subjects','ci-recheck',
  'actions/attest-build-provenance@v2','verify-signed','actions/upload-artifact@v4'];
 let last=-1;for(const text of required){const p=y.indexOf(text);assert.ok(p>last,text);last=p;}
 const up=y.slice(y.indexOf('actions/upload-artifact@v4'));
 assert.match(up,/pins\.json/);assert.match(up,/attestation-bundle\.jsonl/);
 assert.doesNotMatch(up,/ddv_save_core|fixtures\/steam626-singlefence-proof9\/ddv|static\/|build\//);
 assert.match(cli,/verifySignedReleaseSubjects\(dir,source,bundle,PROOF_SIGNER/);
 assert.match(cli,/revalidateProtectedCi\(ci,JSON\.parse\(raw\),get\)/);
 assert.match(cli,/GIT_NO_REPLACE_OBJECTS:'1'/);
 assert.match(cli,/git\('merge-base','--is-ancestor',signedReaderAncestor,source\)/);
 assert.match(cli,/proofOnly:true,publicAssets:false,productConsumerEnabled:false/);
 assert.match(cli,/realEncryptedSaveV2Verified:false/);
});

test('Proof9 fixed private staging rejects symlinked tests/wasm-distribution/fixtures and child, while allowing fresh absent fixture parent only',()=>{
 const trust=cli.slice(cli.indexOf('async function privateProofDirectory('),cli.indexOf('async function readProofBytes('));
 assert.ok(trust.startsWith('async function privateProofDirectory(createFresh=false)'));
 assert.match(trust,/realpath\(root\)/);
 assert.match(trust,/for\(const \[i,part\] of \['tests','wasm-distribution','fixtures'\]\.entries\(\)\)/);
 assert.match(trust,/st=await lstat\(parent\)/);
 assert.match(trust,/i!==2\|\|!createFresh\|\|error\?\.code!=='ENOENT'/);
 assert.match(trust,/mkdir\(parent,\{recursive:false\}\)/);
 assert.match(trust,/st\.isSymbolicLink\(\)\|\|!st\.isDirectory\(\)/);
 assert.match(trust,/canonical=await realpath\(parent\)/);
 assert.match(trust,/canonical!==parent/);
 assert.match(trust,/mkdir\(dir,\{recursive:false\}\)/);
 assert.match(trust,/child=await lstat\(dir\);canonical=await realpath\(dir\)/);
 assert.match(trust,/child\.isSymbolicLink\(\)\|\|!child\.isDirectory\(\)\|\|canonical!==dir/);
 assert.doesNotMatch(trust,/recursive:true/);
});
test('Proof9 signs only existing canonical private bytes and creates no public output or overwrite route',()=>{
 const staged=cli.slice(cli.indexOf('async function generateProofSubjects('),cli.indexOf('async function actualProtectedCi('));
 assert.match(staged,/const receipt=inspectProofSubjects\(\[raw,js,wasm\],source\)/);
 assert.match(staged,/const dir=await privateProofDirectory\(true\)/);
 assert.match(staged,/if\(await privateProofDirectory\(\)!==dir\)fail\(\)/);
 assert.match(staged,/writeFile\(join\(dir,names\[i\]\),\[raw,js,wasm\]\[i\],\{flag:'wx',mode:0o600\}\)/);
 assert.match(cli,/async function readProofBytes\(\)\{\s*const dir=await privateProofDirectory\(\)/);
 assert.match(cli,/const dir=await privateProofDirectory\(\);\s*const verified=await verifySignedReleaseSubjects/);
 assert.doesNotMatch(staged,/deploy-pages|upload-pages-artifact|static\/worker-wasm|build\/worker-wasm/);
});
