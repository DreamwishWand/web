// 04 QR-W independent changed-only QA for 08 WEB PR751.
// SPEC_ONLY: static contract / actual source boundary. No managed HTTP, Provider, Auth or publish.
// Intentionally reject conflating revoked token with another authenticated Account.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';

const BASE='01f45bd20ab98da2b6dc7c807738c20592621f47';
const SOURCE='0d242bfab98e5dae7c50f76a90cfdc1eb7994a31';
const exactBlobs=new Map([
 ['docs/web/profile-host-routing-contract-20261107.json','c63ccd69221aea727710eb6581637e6e3df10801'],
 ['docs/web/profile-host-routing-contract-20261107.md','84885d74486f6885c343dba57a227819bb8ed504'],
 ['tests/web-public-profile-host-routing-contract.test.mjs','672d35954905bf245511bd063ea30173083bb826']
]);
const qaPaths=[
 '.github/workflows/04qr-w-pr751-host404-independent.yml',
 'tests/04qr-w-pr751-host404-independent.test.mjs'
].sort();
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
const diff=(from,to)=>git('diff','--name-only',from,to).split('\n').filter(Boolean).sort();
const read=p=>readFileSync(p,'utf8');
const c=JSON.parse(read('docs/web/profile-host-routing-contract-20261107.json'));
const doc=read('docs/web/profile-host-routing-contract-20261107.md');
const rows=new Map(c.host_acceptance.map(x=>[x.case,x]));
const routes=new Map(c.routes.map(x=>[x.route,x]));

test('QR751-01 original three immutable owner source blobs; QA branch adds only two audit files',()=>{
 assert.equal(git('merge-base',BASE,SOURCE),BASE);
 assert.equal(git('rev-list','--count',BASE+'..'+SOURCE),'1');
 assert.deepEqual(diff(BASE,SOURCE),[...exactBlobs.keys()].sort());
 for(const [p,sha] of exactBlobs){
  assert.equal(git('rev-parse',SOURCE+':'+p),sha,p+' original Git blob');
  assert.equal(git('hash-object',p),sha,p+' unchanged on QA');
 }
 assert.equal(git('merge-base',SOURCE,'HEAD'),SOURCE);
 assert.deepEqual(diff(SOURCE,'HEAD'),qaPaths);
});

test('QR751-02 current Pages is static 404 fallback, not arbitrary /users URL direct 200/301 or SEO pass',()=>{
 const config=read('svelte.config.js');
 const layout=read('src/routes/+layout.ts');
 const pages=read('.github/workflows/pages.yml');
 const tracked=git('ls-tree','-r','--name-only',SOURCE).split('\n');
 assert.match(config,/@sveltejs\/adapter-static/);
 assert.match(config,/fallback: '404\.html'/);
 assert.match(config,/BASE_PATH/);
 assert.match(layout,/prerender = true/);
 assert.match(layout,/trailingSlash = 'always'/);
 assert.match(pages,/BASE_PATH: \/web/);
 assert.match(pages,/build\/404\.html/);
 assert.match(pages,/actions\/deploy-pages@v4/);
 for(const path of ['svelte.config.js','src/routes/+layout.ts','.github/workflows/pages.yml']){
  assert.equal(git('rev-parse',BASE+':'+path),git('rev-parse',SOURCE+':'+path));
 }
 assert.ok(!tracked.some(p=>p.startsWith('src/routes/users/')),'no arbitrary user route implemented');
 assert.ok(!tracked.some(p=>p.startsWith('src/routes/library/')),'no private library route implemented');
 assert.ok(tracked.includes('src/routes/creator/+page.svelte'),'legacy query route preserved');
 assert.equal(c.existing_host.product,'github_pages_project_site');
 assert.equal(c.existing_host.base_path,'/web');
 assert.equal(c.existing_host.fallback,'404.html');
 assert.equal(c.existing_host.arbitrary_dynamic_200_confirmed,false);
 assert.equal(c.existing_host.managed_https_proof,'NOT_RUN');
 assert.equal(c.existing_host.production_source_change,'NONE');
 assert.equal(c.hosting_decision.chosen_for_now,'KEEP_EXISTING_PAGES_404_FAILCLOSED_NO_NEW_PUBLIC_ROUTES');
 for(const rejected of ['DYNAMIC_SVELTE_PAGE_ALONE_AS_HTTP200','SPA_404_FALLBACK_AS_SEO200','CLIENT_SIDE_REDIRECT_AS_HTTP301','AUTOMATIC_MAIN_OR_PAGES_DEPLOY','BLIND_INDEXING_OR_SITEMAP'])
  assert.ok(c.hosting_decision.rejected.includes(rejected),rejected);
 assert.match(doc,/does \*\*not\*\* create a public route/);
 assert.match(doc,/\*\*actual host GET status = NOT_RUN\*\*/);
});

test('QR751-03 anonymous/private/consented/legacy Work identity boundaries do not fabricate publication',()=>{
 assert.equal(c.contract_id,'W_WEB_P0_USERS_HANDLE_HOST_ROUTING_SPEC_20261107');
 assert.equal(c.operation,'WEB_READ_ONLY_SPEC_ONLY');
 assert.equal(c.release_state,'NO_GO');
 assert.equal(c.evidence_tier,'SOURCE_ONLY');
 for(const [key,value] of Object.entries(c.public_flags))assert.equal(value,false,key);
 assert.equal(routes.size,c.routes.length,'no duplicate declared route');
 const profile=routes.get('/users/{handle}/');
 const legacy=routes.get('/creator/?id={profile-id}');
 const work=routes.get('/{primary-id}/{secondary-id}/{slug?}');
 assert.equal(profile.key_kind,'MUTABLE_HANDLE');
 assert.equal(profile.stable_principal,'IMMUTABLE_ACCOUNT_ID');
 assert.equal(profile.state,'HOLD_HOST_AND_AUTH');
 assert.equal(work.key_kind,'IMMUTABLE_TYPED_ENTITY_REF');
 assert.equal(work.stable_principal,'IMMUTABLE_WORK_ID');
 assert.equal(legacy.state,'PRESERVE_EXISTING_NO_REDIRECT');
 for(const key of ['/library/','/library/gallery/','/library/presets/']){
  assert.equal(routes.get(key).key_kind,'SESSION_ACCOUNT');
  assert.equal(routes.get(key).state,'HOLD_AUTH_PRIVATE');
 }
 for(const route of c.routes){
  assert.equal(route.http,'NOT_RUN',route.route);
  assert.equal(route.indexable,false,route.route);
  assert.equal(route.may_serve_without_verified_consent,false,route.route);
 }
 assert.ok(c.hosting_decision.rejected.includes('NOINDEX_AS_AUTHORIZATION'));
 assert.ok(c.hosting_decision.rejected.includes('HANDLE_SYNTAX_AS_IDENTITY_OR_CONSENT'));
 assert.match(doc,/03 COMM PR #747 syntax-only candidate parser is \*\*not\*\* uniqueness/);
});

test('QR751-04 future HTTPS acceptance target status never masquerades as actual test',()=>{
 const expected=[
  ['published_consented_active_profile',200],
  ['unknown_or_unconsented_profile',404],
  ['safe_existing_old_handle_alias',302],
  ['anonymous_private_library',401],
  ['authenticated_own_library',200],
  ['work_public_approved_version',200],
  ['work_private_or_moderated',404]
 ];
 assert.equal(rows.size,c.host_acceptance.length,'no duplicated acceptance case');
 for(const [name,code] of expected){
  const r=rows.get(name);
  assert.ok(r,name+' missing');
  assert.equal(r.required_status,code,name);
  assert.equal(r.current,'NOT_RUN',name+' future condition only');
 }
 for(const r of c.host_acceptance){
  assert.equal(r.current,'NOT_RUN',r.case+' not actually hosted');
  assert.ok(r.must_have.length>=2,r.case+' must describe access and privacy');
 }
 assert.ok(rows.get('safe_existing_old_handle_alias').must_have.includes('not_reassigned_alias'));
 assert.ok(rows.get('work_public_approved_version').must_have.includes('no_creator_handle_as_work_id'));
 assert.ok(rows.get('work_private_or_moderated').must_have.includes('no_dreamsnaps_vote_embargo_leak'));
 for(const risk of ['NO_FAKE_SPA_404_AS_HTTP200','NO_CLIENT_ONLY_301_CLAIM','NO_UNVERIFIED_LEGACY_ALIAS_REDIRECT','NO_FOREIGN_OR_REVOKED_LIBRARY_DATA','NO_PRIVATE_CACHE_SHARED_CDN','NO_DREAMSNAPS_VOTE_SUBMISSION_LEAK','NO_UNCONFIRMED_NATIVE_ITEM_ID_PUBLICATION'])
  assert.ok(c.required_negative_tests.includes(risk),risk);
});

test('QR751-05 Owner approval, current actor, CAS, consent and cache purge are prerequisites not implicit PASS',()=>{
 const fs=new Map(c.hosting_decision.future_paths.map(x=>[x.id,x.preconditions]));
 assert.deepEqual([...fs.keys()].sort(),['APPROVED_HOST_SIDE_SSR_GATEWAY','EXPLICIT_FINITE_STATIC_SNAPSHOT']);
 for(const item of ['OWNER_HOST_PROVIDER_OPERATOR_APPROVAL','AUTH_SESSION_RLS_ACTOR_REVOCATION','HANDLES_ALIAS_TRANSACTIONAL_CAS','PUBLIC_PROJECTION_CONSENT_RIGHTS_VERSION_MODERATION','CDN_CACHE_INVALIDATE_ROLLBACK_BACKUP','INDEPENDENT_QR_W_AND_QR_S'])
  assert.ok(fs.get('APPROVED_HOST_SIDE_SSR_GATEWAY').includes(item),item);
 for(const item of ['OWNER_OPT_IN_FINITE_ALLOWLIST','RIGHTS_CONSENT_PER_EXACT_PROFILE_AND_WORK','REVOKE_WITH_CDN_INVALIDATION','NO_PRIVATE_DATA_IN_ARTIFACT','EXACT_HTTP_200_404_DEPLOYED_TEST'])
  assert.ok(fs.get('EXPLICIT_FINITE_STATIC_SNAPSHOT').includes(item),item);
 assert.match(doc,/Do not disable existing Pages/);
 assert.match(doc,/No Site shutdown or dynamic Route Source yet|Do not add .*src\/routes\/users\/\[handle\]/);
 assert.match(doc,/noindex.*\*\*not\*\* access control/i);
 assert.deepEqual(c.known_release_gates,['G-RC','G-PREVIEW','G-WRITER','G-COMMUNITY_PUBLIC','G-FORMAL']);
});

test('QR751-06 revoked JWT and other authenticated Account are separately specified fail-closed, not conflated',()=>{
 // Project security contract distinguishes revoked/expired session from valid wrong-actor.
 // A single "other_account_or_revoked" 403 row is not enough to direct server HTTP/Auth tests.
 const a=rows.get('other_account_private_library');
 const b=rows.get('revoked_private_library');
 assert.ok(a,'explicit OTHER valid Account denied projection must have independent acceptance row');
 assert.ok(b,'explicit REVOKED JWT/session denied projection must have independent acceptance row');
 for(const [name,row] of [['OTHER',a],['REVOKED',b]]){
  assert.equal(row.current,'NOT_RUN',name+' managed evidence not fabricated');
  assert.ok([401,403,404].includes(row.required_status),name+' cannot serve private content');
  assert.ok(row.must_have.includes('no_private_data'),name);
  assert.ok(row.must_have.some(x=>/cache|no_store/.test(x)),name+' private cache denial');
 }
 assert.notEqual(a.subject,b.subject,'must distinguish valid wrong Account from revoked token');
});