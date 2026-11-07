import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const file = pathname => readFileSync(new URL('../'+pathname,import.meta.url),'utf8');
const c=JSON.parse(file('docs/web/profile-host-routing-contract-20261107.json'));

test('08WEB host contract authority and explicit no-publication state',()=>{
 assert.equal(c.contract_id,'W_WEB_P0_USERS_HANDLE_HOST_ROUTING_SPEC_20261107');
 assert.equal(c.operation,'WEB_READ_ONLY_SPEC_ONLY');
 assert.equal(c.authority,'OWNER_PUBLIC_PROFILE_USERS_HANDLE_20261107');
 assert.equal(c.release_state,'NO_GO');
 assert.deepEqual(c.public_flags,{community:false,provider:false,cloud:false,writer:false,production:false});
 assert.equal(c.existing_host.production_source_change,'NONE');
 assert.equal(c.existing_host.managed_https_proof,'NOT_RUN');
 assert.equal(c.existing_host.arbitrary_dynamic_200_confirmed,false);
});

test('08WEB actual protected-main host is static 404 fallback not dynamic HTTP200 proof',()=>{
 const kit=file('svelte.config.js');
 const layout=file('src/routes/+layout.ts');
 const pages=file('.github/workflows/pages.yml');
 const typed=file('src/routes/[primary=sharedId]/+page.ts');
 const typedSub=file('src/routes/[primary=sharedId]/[secondary=sharedId]/+page.ts');
 assert.match(kit,/adapter-static/);
 assert.match(kit,/fallback: '404.html'/);
 assert.match(kit,/BASE_PATH/);
 assert.match(layout,/prerender = true/);
 assert.match(layout,/trailingSlash = 'always'/);
 assert.match(pages,/BASE_PATH: \/web/);
 assert.match(pages,/build\/404.html/);
 assert.match(pages,/actions\/deploy-pages@v4/);
 assert.match(typed,/prerender = false/);
 assert.match(typedSub,/prerender = false/);
 assert.equal(c.existing_host.fallback,'404.html');
 assert.equal(c.existing_host.base_path,'/web');
 assert.equal(c.hosting_decision.chosen_for_now,'KEEP_EXISTING_PAGES_404_FAILCLOSED_NO_NEW_PUBLIC_ROUTES');
 assert.ok(!existsSync(new URL('../src/routes/users/[handle]/+page.svelte',import.meta.url)));
 assert.ok(!existsSync(new URL('../src/routes/library/+page.svelte',import.meta.url)));
});

test('08WEB one public mutable user locator distinct from immutable Work IDs and private library',()=>{
 const byRoute=Object.fromEntries(c.routes.map(route=>[route.route,route]));
 assert.equal(c.routes.length,Object.keys(byRoute).length,'no duplicate route contracts');
 assert.equal(byRoute['/users/{handle}/'].key_kind,'MUTABLE_HANDLE');
 assert.equal(byRoute['/users/{handle}/'].stable_principal,'IMMUTABLE_ACCOUNT_ID');
 assert.equal(byRoute['/{primary-id}/{secondary-id}/{slug?}'].key_kind,'IMMUTABLE_TYPED_ENTITY_REF');
 assert.equal(byRoute['/{primary-id}/{secondary-id}/{slug?}'].stable_principal,'IMMUTABLE_WORK_ID');
 for(const route of ['/library/','/library/gallery/','/library/presets/']){
  assert.equal(byRoute[route].indexable,false);
  assert.equal(byRoute[route].key_kind,'SESSION_ACCOUNT');
  assert.equal(byRoute[route].state,'HOLD_AUTH_PRIVATE');
 }
 assert.match(file('src/routes/creator/+page.svelte'),/URLSearchParams\(window\.location\.search\)\.get\('id'\)/);
 assert.equal(byRoute['/creator/?id={profile-id}'].state,'PRESERVE_EXISTING_NO_REDIRECT');
 for(const route of c.routes){
  assert.equal(route.http,'NOT_RUN',route.route+' cannot invent managed results');
  assert.equal(route.indexable,false,route.route+' no current index authorization');
  assert.equal(route.may_serve_without_verified_consent,false);
 }
});

test('08WEB host positives, negatives and live gates stay NOT_RUN',()=>{
 const rows=Object.fromEntries(c.host_acceptance.map(x=>[x.case,x]));
 assert.equal(Object.keys(rows).length,c.host_acceptance.length);
 assert.equal(rows.published_consented_active_profile.required_status,200);
 assert.equal(rows.unknown_or_unconsented_profile.required_status,404);
 assert.equal(rows.safe_existing_old_handle_alias.required_status,302);
 assert.equal(rows.anonymous_private_library.required_status,401);
 assert.equal(rows.authenticated_own_library.required_status,200);
 assert.equal(rows.other_account_private_library.required_status,403);
 assert.equal(rows.revoked_private_library.required_status,401);
 assert.equal(rows.expired_private_library.required_status,401);
 assert.equal(rows.logged_out_private_library.required_status,401);
 assert.equal(rows.other_account_or_revoked_private_library,undefined,'old combined Other/Revoked row forbidden');
 const privateRows=Object.values(rows).filter(r=>r.path==='/library/');
 const other=privateRows.filter(r=>r.subject.includes('OTHER')&&!/REVOKED|EXPIRED/.test(r.subject));
 const revoked=privateRows.filter(r=>r.subject.includes('REVOKED')&&!r.subject.includes('OTHER'));
 const expired=privateRows.filter(r=>r.subject.includes('EXPIRED')&&!r.subject.includes('OTHER'));
 const logout=privateRows.filter(r=>r.subject.includes('LOGGED_OUT'));
 assert.equal(other.length,1,'valid other Account must have its own denial case');
 assert.equal(revoked.length,1,'revoked token must have its own denial case');
 assert.equal(expired.length,1,'expired token must have its own denial case');
 assert.equal(logout.length,1,'logout must have its own denial case');
 for(const row of [...other,...revoked,...expired,...logout]){
  assert.equal(row.current,'NOT_RUN','future target only');
  assert.ok([401,403,404].includes(row.required_status));
  assert.ok(row.must_have.includes('no_private_data'));
  assert.ok(row.must_have.some(v=>/cache|no_store/.test(v)));
 }
 assert.notEqual(other[0].case,revoked[0].case);
 assert.equal(rows.work_public_approved_version.required_status,200);
 assert.equal(rows.work_private_or_moderated.required_status,404);
 assert.ok(rows.safe_existing_old_handle_alias.must_have.includes('not_reassigned_alias'));
 assert.ok(rows.work_public_approved_version.must_have.includes('no_creator_handle_as_work_id'));
 for(const row of c.host_acceptance)assert.equal(row.current,'NOT_RUN',row.case+' is not real hosted QA');
 assert.ok(c.hosting_decision.rejected.includes('SPA_404_FALLBACK_AS_SEO200'));
 assert.ok(c.hosting_decision.rejected.includes('NOINDEX_AS_AUTHORIZATION'));
 assert.ok(c.hosting_decision.rejected.includes('HANDLE_SYNTAX_AS_IDENTITY_OR_CONSENT'));
 assert.ok(c.hosting_decision.rejected.includes('CLIENT_SIDE_REDIRECT_AS_HTTP301'));
 assert.ok(c.required_negative_tests.includes('NO_DREAMSNAPS_VOTE_SUBMISSION_LEAK'));
 assert.ok(c.required_negative_tests.includes('NO_FOREIGN_OR_REVOKED_LIBRARY_DATA'));
 assert.ok(c.required_negative_tests.includes('NO_OTHER_ACCOUNT_LIBRARY_ACCESS'));
 assert.ok(c.required_negative_tests.includes('NO_REVOKED_EXPIRED_LOGGED_OUT_LIBRARY_ACCESS'));

 assert.ok(c.required_negative_tests.includes('NO_UNVERIFIED_LEGACY_ALIAS_REDIRECT'));
 assert.ok(c.required_negative_tests.includes('NO_FAKE_SPA_404_AS_HTTP200'));
 assert.ok(c.required_negative_tests.includes('NO_PRIVATE_CACHE_SHARED_CDN'));
 assert.deepEqual(c.accessibility_acceptance,['8_LOCALES','320PX','200_PERCENT_ZOOM','KEYBOARD','FOCUS_VISIBLE','FOCUS_RETURN','NO_HIDDEN_FOCUS']);
});

test('08WEB no early route/host promotion and explicit Owner host prerequisites',()=>{
 const future=Object.fromEntries(c.hosting_decision.future_paths.map(x=>[x.id,x.preconditions]));
 assert.ok(future.APPROVED_HOST_SIDE_SSR_GATEWAY.includes('OWNER_HOST_PROVIDER_OPERATOR_APPROVAL'));
 assert.ok(future.APPROVED_HOST_SIDE_SSR_GATEWAY.includes('AUTH_SESSION_RLS_ACTOR_REVOCATION'));
 assert.ok(future.APPROVED_HOST_SIDE_SSR_GATEWAY.includes('INDEPENDENT_QR_W_AND_QR_S'));
 assert.ok(future.EXPLICIT_FINITE_STATIC_SNAPSHOT.includes('RIGHTS_CONSENT_PER_EXACT_PROFILE_AND_WORK'));
 assert.ok(future.EXPLICIT_FINITE_STATIC_SNAPSHOT.includes('REVOKE_WITH_CDN_INVALIDATION'));
 assert.ok(future.EXPLICIT_FINITE_STATIC_SNAPSHOT.includes('NO_PRIVATE_DATA_IN_ARTIFACT'));
 assert.deepEqual(c.known_release_gates,['G-RC','G-PREVIEW','G-WRITER','G-COMMUNITY_PUBLIC','G-FORMAL']);
 assert.ok(!existsSync(new URL('../src/routes/users/+page.svelte',import.meta.url)));
});
