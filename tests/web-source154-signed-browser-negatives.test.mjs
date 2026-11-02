import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(p,'utf8');
const route=read('src/routes/disposable-owner-signed-bridge/+page.svelte');
const web=read('scripts/web-source154-signed-browser-chrome.mjs');
const py=read('scripts/web-source154-signed-browser-fixture.py');
const prod=read('src/lib/dreamsnaps/owner-product-readonly.js');
const decoder=read('src/lib/dreamsnaps/source153-owner-consumer-v2.js');
const server=read('supabase/functions/community-dreamsnap-owner/index.ts');
test('new work remains disposable only, no product Owner route or flag',()=>{
 assert.match(route,/import\.meta\.env\.DEV/);
 assert.match(route,/LOCAL_DISPOSABLE_ONLY/);
 assert.match(route,/data-owner-actions="disabled"/);
 for(const k of ['OWNER_PRODUCT_READONLY_ENABLED','OWNER_PRODUCT_MANAGED_INGRESS_ACCEPTED'])
  assert.match(prod,new RegExp('export const '+k+' = false'));
 for(const k of ['OWNER_MANAGEMENT_ENABLED','SOURCE153_OWNER_V2_LIVE_ENABLED',
  'SOURCE153_BROWSER_E2_PRODUCTION_ENABLED','OWNER_REVALIDATION_PRODUCTION_ENABLED'])
  assert.match(read('src/lib/dreamsnaps/'+(
   k==='OWNER_MANAGEMENT_ENABLED'?'owner-management.js':
   k==='SOURCE153_OWNER_V2_LIVE_ENABLED'?'source153-owner-consumer-v2.js':
   k==='SOURCE153_BROWSER_E2_PRODUCTION_ENABLED'?'source153-owner-browser-e2.js':
   'owner-read-revalidation.js')),new RegExp(k+' = false'));
});
test('one reusable immutable Shared Auth + strict WEB267/PR291',()=>{
 assert.match(route,/createCommunityBrowserClient/);
 assert.match(route,/createOwnerSharedAuthConsumer/);
 assert.match(route,/createOwnerReadRevalidation/);
 assert.match(route,/readIsolatedSource153Owner/);
 assert.match(decoder,/privateUncacheable/);
 assert.match(decoder,/response\.status!==200/);
 assert.match(decoder,/response\.status===409 \|\| response\.status===412/);
});
test('browser tests actual authenticated revocation and old JWT, not mock owner response',()=>{
 for(const x of ['session-revoke','scope:\x27local\x27','scope:\x27global\x27',
  'REFRESH_CANNOT_REAUTHORIZE_REVOKED_A1','MISSED_NOTICE_OLD_JWT_SERVER_DENIED',
  'HELD_200_CANNOT_RESTORE_LOGGED_OUT_VIEW','UNSAFE_CACHE_POLICY',
  'ownerPath','refresh_token','source154'])
   if(x!=='source154')assert.ok(web.includes(x),x);
 assert.doesNotMatch(web,/page\.route\([^]*?fulfill\(\{status:200,body:/i);
 assert.match(web,/route\.fetch\(\)/);
 assert.match(web,/checkHeaders/);
});
test('fixture pins original signed E2, migration+1 only in memory, no external auth',()=>{
 assert.match(py,/tests\/comm-e2-source153-signed-positive\.py/);
 assert.match(py,/migration\.replace\("==153","==154"\)/);
 assert.match(py,/DATABASE_URL/);
 assert.match(py,/SUPABASE_PROJECT_ID/);
 assert.match(py,/CHROME_FAILED/);
 assert.doesNotMatch(py,/https:\/\/.*supabase\.co/);
});
test('production Source153 stays untouched in branch, no new auth implementation',()=>{
 assert.match(server,/withSupabase\(\{auth:'user'\}/);
 assert.match(server,/community_authorize_session/);
 assert.doesNotMatch(route,/operation:'session-revoke'/);
 assert.doesNotMatch(route,/SIGNED_OWNER_VERIFIED/);
});
