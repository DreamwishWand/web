// 04 QR-W fixed-new-HEAD differential QA for 08 WEB PR751.
// Specification-only; no managed HTTPS/JWT/RLS/Provider/Cloud/Writer tested.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';

const BASE='01f45bd20ab98da2b6dc7c807738c20592621f47';
const OLD='0d242bfab98e5dae7c50f76a90cfdc1eb7994a31';
const SOURCE='46067fa1d7f40ed1e24502527276abec4e81b41e';
const sourceBlobs=new Map([
 ['docs/web/profile-host-routing-contract-20261107.json','82fec891c89e6bf17dc52ad1bbcbf361d0d78a56'],
 ['docs/web/profile-host-routing-contract-20261107.md','300b8f5e6040bf20ce3fffcd231c2505e45e8a85'],
 ['tests/web-public-profile-host-routing-contract.test.mjs','cb624120a0c0e26f387605cedbb543ac668bbf9b']
]);
const qaOnly=[
 '.github/workflows/04qr-w-pr751-repaired-independent-20261107.yml',
 'tests/04qr-w-pr751-repaired-independent-20261107.test.mjs'
].sort();
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
const files=(a,b)=>git('diff','--name-only',a,b).split('\n').filter(Boolean).sort();
const read=p=>readFileSync(p,'utf8');
const spec=JSON.parse(read('docs/web/profile-host-routing-contract-20261107.json'));
const textDoc=read('docs/web/profile-host-routing-contract-20261107.md');
const readGitJSON=(commit,path)=>JSON.parse(git('show',commit+':'+path));
const records=()=>new Map(spec.host_acceptance.map(r=>[r.case,r]));

test('QRW751-R1 freeze new Source3 from old Source3 RED, exact 2 QA-only paths and unchanged product',()=>{
 assert.equal(git('merge-base',BASE,SOURCE),BASE);
 assert.equal(git('merge-base',OLD,SOURCE),OLD);
 assert.equal(git('rev-list','--count',OLD+'..'+SOURCE),'1','one bounded Owner repair commit');
 assert.deepEqual(files(BASE,SOURCE),[...sourceBlobs.keys()].sort());
 assert.deepEqual(files(OLD,SOURCE),[...sourceBlobs.keys()].sort(),'repair changes only original three Source docs/test paths');
 for(const [p,sha] of sourceBlobs){
  assert.equal(git('rev-parse',SOURCE+':'+p),sha,p+' frozen Source blob');
  assert.equal(git('hash-object',p),sha,p+' QA never rewrites Source');
 }
 assert.equal(git('merge-base',SOURCE,'HEAD'),SOURCE);
 const qaDiff=files(SOURCE,'HEAD');
 if(qaDiff.length===qaOnly.length){
  assert.deepEqual(qaDiff,qaOnly,'direct Source-head checkout has exactly two QA files');
 }else{
  // Normal PR Verify checks out a temporary merge with the accepted protected main;
  // focused QA checks out the immutable QA branch HEAD. Distinguish both explicitly.
  const MAIN='069b47d4fc32fe947ca652328de8cbba72421504';
  const acceptedMainPaths=[
   '.github/workflows/web-stage1-collection-ux.yml',
   'docs/community/public-users-handle-security-20261107.md',
   'scripts/web-stage1-collection-chrome.mjs',
   'src/lib/community/public-profile-handle-syntax.mjs',
   'src/routes/collection/+page.svelte',
   'tests/comm-public-profile-handle-syntax.test.mjs',
   'tests/web-stage1-collection-root.test.mjs'
  ].sort();
  assert.equal(git('merge-base',MAIN,'HEAD'),MAIN,'synthetic HEAD must descend from accepted main');
  assert.deepEqual(qaDiff,[...qaOnly,...acceptedMainPaths].sort(),'synthetic merge only adds exact main ancestors and two QA files');
  assert.deepEqual(files(MAIN,'HEAD'),[...sourceBlobs.keys(),...qaOnly].sort(),'merge introduces only original Source3 plus QA2 versus protected main');
  for(const p of acceptedMainPaths){
   assert.equal(git('rev-parse',MAIN+':'+p),git('rev-parse','HEAD:'+p),p+' must match accepted protected main blob exactly');
  }
 }
 const former=readGitJSON(OLD,'docs/web/profile-host-routing-contract-20261107.json');
 assert.ok(former.host_acceptance.some(x=>x.case==='other_account_or_revoked_private_library'&&x.subject==='AUTH_OTHER_OR_REVOKED'),'older independent QR752 TRUE_RED preserved');
 assert.ok(!spec.host_acceptance.some(x=>x.case==='other_account_or_revoked_private_library'),'Source removed prior conflated contract');
 console.log('QRW751_REPAIRED_SHA_LINEAGE_AND_OLD_RED_PRESERVED_PASS');
});

const required=new Map([
 ['anonymous_private_library',{subject:'ANONYMOUS',status:401}],
 ['authenticated_own_library',{subject:'AUTH_VALID_OWNER',status:200}],
 ['other_account_private_library',{subject:'AUTH_VALID_OTHER_ACCOUNT',status:403}],
 ['revoked_private_library',{subject:'AUTH_REVOKED_JWT',status:401}],
 ['expired_private_library',{subject:'AUTH_EXPIRED_JWT',status:401}],
 ['logged_out_private_library',{subject:'AUTH_LOGGED_OUT_SESSION',status:401}]
]);
const sensitive=['other_account_private_library','revoked_private_library','expired_private_library','logged_out_private_library'];

function securityErrors(input){
 const errors=[],rows=new Map();
 for(const r of input.host_acceptance??[]){
  if(rows.has(r.case))errors.push('DUPLICATE_'+r.case);
  rows.set(r.case,r);
  if(r.current!=='NOT_RUN')errors.push('PREMATURE_HTTP_PROOF_'+r.case);
 }
 if(rows.has('other_account_or_revoked_private_library'))errors.push('OLD_COMBINED_AUTH_CASE');
 for(const [name,contract] of required){
  const r=rows.get(name);
  if(!r){errors.push('MISSING_'+name);continue;}
  if(r.path!=='/library/'||r.subject!==contract.subject||r.required_status!==contract.status||r.current!=='NOT_RUN')
   errors.push('BAD_SUBJECT_STATUS_OR_SCOPE_'+name);
  if(name==='authenticated_own_library'){
   for(const key of ['server_authorized_current_actor','own_data_only','no_store']){
    if(!r.must_have?.includes(key))errors.push('MISSING_OWNER_'+key);
   }
  }
 }
 const requiredDenials={
  other_account_private_library:['no_private_data','no_shared_cache','no_store','valid_actor_not_resource_owner','independent_current_actor_acl_rls_denial'],
  revoked_private_library:['no_private_data','no_shared_cache','no_store','token_revocation_checked_server_side','no_reuse_revoked_session'],
  expired_private_library:['no_private_data','no_shared_cache','no_store','server_expires_at_checked','no_silent_refresh_authorization'],
  logged_out_private_library:['no_private_data','no_shared_cache','no_store','logout_session_invalidated','no_stale_private_response']
 };
 for(const [name,fields] of Object.entries(requiredDenials)){
  const r=rows.get(name);
  if(!r)continue;
  for(const field of fields)if(!r.must_have?.includes(field))errors.push('MISSING_'+name+'_'+field);
 }
 if(new Set(input.host_acceptance?.map(r=>r.case)).size!==(input.host_acceptance??[]).length)errors.push('DUPLICATE_CASES');
 if(input.release_state!=='NO_GO'||input.operation!=='WEB_READ_ONLY_SPEC_ONLY')errors.push('PROMOTED_OPERATION');
 if(Object.values(input.public_flags??{}).some(Boolean)||Object.keys(input.public_flags??{}).length!==5)errors.push('PUBLIC_FLAG_ON');
 if(input.existing_host?.arbitrary_dynamic_200_confirmed!==false||input.existing_host?.managed_https_proof!=='NOT_RUN')errors.push('FAKE_HOST_RUNTIME');
 for(const r of input.routes??[]){
  if(r.http!=='NOT_RUN'||r.indexable!==false||r.may_serve_without_verified_consent!==false)
   errors.push('FAKE_PUBLISHED_ROUTE_'+r.route);
 }
 for(const key of ['NO_OTHER_ACCOUNT_LIBRARY_ACCESS','NO_REVOKED_EXPIRED_LOGGED_OUT_LIBRARY_ACCESS','NO_PRIVATE_CACHE_SHARED_CDN','NO_FAKE_SPA_404_AS_HTTP200','NO_CLIENT_ONLY_301_CLAIM','NO_DREAMSNAPS_VOTE_SUBMISSION_LEAK']){
  if(!input.required_negative_tests?.includes(key))errors.push('NEGATIVE_REMOVED_'+key);
 }
 return errors;
}

test('QRW751-R2 new four separate future private-denial target statuses and cache constraints, strictly NOT_RUN',()=>{
 assert.deepEqual(securityErrors(spec),[]);
 const map=records();
 for(const [name,{subject,status}] of required){
  const r=map.get(name);
  assert.ok(r);
  assert.equal(r.subject,subject);
  assert.equal(r.required_status,status);
  assert.equal(r.current,'NOT_RUN');
 }
 assert.notEqual(map.get('other_account_private_library').case,map.get('revoked_private_library').case);
 assert.equal(spec.host_acceptance.filter(r=>r.path==='/library/').length,6);
 assert.match(textDoc,/valid JWT belonging to another Account.*403/i);
 assert.match(textDoc,/explicitly revoked JWT.*401/i);
 assert.match(textDoc,/expired JWT.*401/i);
 assert.match(textDoc,/logged-out invalidated session.*401/i);
 assert.match(textDoc,/statuses remain \x60NOT_RUN\x60|All statuses remain \x60NOT_RUN\x60/i);
 console.log('QRW751_REPAIRED_VALID_OTHER403_REVOKED401_EXPIRED401_LOGOUT401_DENIAL_PASS');
});

test('QRW751-R3 adversarial mutation negatives independently reject conflated, misattributed or leaked private-state contracts',()=>{
 const make=()=>structuredClone(spec);
 let count=0;
 const negative=(label,mutate)=>{
  const c=make();mutate(c);
  const errors=securityErrors(c);
  assert.ok(errors.length>0,label+' must fail independent contract validator');
  count++;
 };
 negative('old combined OTHER|REVOKED',c=>c.host_acceptance.push({case:'other_account_or_revoked_private_library',subject:'AUTH_OTHER_OR_REVOKED',path:'/library/',required_status:403,current:'NOT_RUN',must_have:['no_private_data']}));
 negative('valid OTHER account mistaken for REVOKED',c=>c.host_acceptance.find(x=>x.case==='other_account_private_library').subject='AUTH_REVOKED_JWT');
 negative('revoked JWT treated as valid-other 403',c=>c.host_acceptance.find(x=>x.case==='revoked_private_library').required_status=403);
 negative('expired JWT allowed through as Owner200',c=>c.host_acceptance.find(x=>x.case==='expired_private_library').required_status=200);
 negative('logged-out session forged live PASS',c=>c.host_acceptance.find(x=>x.case==='logged_out_private_library').current='PASS');
 negative('revoked response retains private bytes',c=>c.host_acceptance.find(x=>x.case==='revoked_private_library').must_have=c.host_acceptance.find(x=>x.case==='revoked_private_library').must_have.filter(x=>x!=='no_private_data'));
 negative('other Account uses shared CDN cache',c=>c.host_acceptance.find(x=>x.case==='other_account_private_library').must_have=c.host_acceptance.find(x=>x.case==='other_account_private_library').must_have.filter(x=>x!=='no_shared_cache'));
 negative('expired silently refreshed despite invalid token',c=>c.host_acceptance.find(x=>x.case==='expired_private_library').must_have=c.host_acceptance.find(x=>x.case==='expired_private_library').must_have.filter(x=>x!=='no_silent_refresh_authorization'));
 negative('logged-out stale response retained',c=>c.host_acceptance.find(x=>x.case==='logged_out_private_library').must_have=c.host_acceptance.find(x=>x.case==='logged_out_private_library').must_have.filter(x=>x!=='no_stale_private_response'));
 negative('duplicate valid OTHER case',c=>c.host_acceptance.push({...c.host_acceptance.find(x=>x.case==='other_account_private_library')}));
 negative('private Library claimed live',c=>c.routes.find(x=>x.route==='/library/').http='200');
 negative('premature community public ON',c=>c.public_flags.community=true);
 negative('fake arbitrary dynamic HTTP200',c=>c.existing_host.arbitrary_dynamic_200_confirmed=true);
 assert.equal(count,13);
 console.log('QRW751_REPAIRED_13_NEGATIVE_MUTANTS_REJECTED_PASS');
});

test('QRW751-R4 non-promotion sentinel: static 404 is not SSR HTTP200/301, immutable Work ID remains separate',()=>{
 const file=read('svelte.config.js');
 const layout=read('src/routes/+layout.ts');
 const pages=read('.github/workflows/pages.yml');
 assert.match(file,/@sveltejs\/adapter-static/);
 assert.match(file,/fallback: '404\.html'/);
 assert.match(layout,/prerender = true/);
 assert.match(pages,/BASE_PATH: \/web/);
 const tracked=git('ls-tree','-r','--name-only',SOURCE).split('\n');
 assert.ok(!tracked.some(p=>p.startsWith('src/routes/users/')));
 assert.ok(!tracked.some(p=>p.startsWith('src/routes/library/')));
 assert.ok(tracked.includes('src/routes/creator/+page.svelte'));
 for(const path of ['svelte.config.js','src/routes/+layout.ts','.github/workflows/pages.yml']){
  assert.equal(git('rev-parse',BASE+':'+path),git('rev-parse',SOURCE+':'+path),path+' no hosting mutation');
 }
 assert.equal(spec.hosting_decision.chosen_for_now,'KEEP_EXISTING_PAGES_404_FAILCLOSED_NO_NEW_PUBLIC_ROUTES');
 for(const s of ['SPA_404_FALLBACK_AS_SEO200','NOINDEX_AS_AUTHORIZATION','HANDLE_SYNTAX_AS_IDENTITY_OR_CONSENT','CLIENT_SIDE_REDIRECT_AS_HTTP301','AUTOMATIC_MAIN_OR_PAGES_DEPLOY']){
  assert.ok(spec.hosting_decision.rejected.includes(s),s);
 }
 const routes=new Map(spec.routes.map(r=>[r.route,r]));
 assert.equal(routes.get('/users/{handle}/').key_kind,'MUTABLE_HANDLE');
 assert.equal(routes.get('/users/{handle}/').stable_principal,'IMMUTABLE_ACCOUNT_ID');
 assert.equal(routes.get('/{primary-id}/{secondary-id}/{slug?}').key_kind,'IMMUTABLE_TYPED_ENTITY_REF');
 assert.equal(routes.get('/{primary-id}/{secondary-id}/{slug?}').stable_principal,'IMMUTABLE_WORK_ID');
 assert.equal(routes.get('/creator/?id={profile-id}').state,'PRESERVE_EXISTING_NO_REDIRECT');
 assert.ok(spec.hosting_decision.future_paths.find(x=>x.id==='APPROVED_HOST_SIDE_SSR_GATEWAY').preconditions.includes('OWNER_HOST_PROVIDER_OPERATOR_APPROVAL'));
 console.log('QRW751_REPAIRED_STATIC404_HOST_GATE_AND_IMMUTABLE_WORK_ID_PASS');
});
