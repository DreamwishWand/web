import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SUPPORTED_DETAIL_LOCALES, parseSharedPrimaryId } from '../src/lib/entity/shared-catalog-detail.mjs';
import { inspectPublicProfileHandleSegment } from '../src/lib/community/public-profile-handle-syntax.mjs';
import {
 OWNER_CUSTOM_DOMAIN, CUSTOM_DOMAIN_PREFLIGHT_OPERATION, EXISTING_PAGES_BASE_PATH,
 PUBLIC_STATIC_CANONICAL_PATHS, PUBLIC_ALIAS_REDIRECTS_ACCEPTED,
 PUBLIC_USER_PROFILE_HTTP200_ACCEPTED, PUBLIC_ENTITY_HTTP200_ACCEPTED,
 canonicalForApprovedStaticPath, inspectCustomDomainPath
} from '../src/lib/foundation/canonical-domain-preview.mjs';
const file=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('canonical is emitted only by explicitly opted-in owned custom root build on finite safe prerender routes',()=>{
 assert.equal(CUSTOM_DOMAIN_PREFLIGHT_OPERATION,'WEB_SOURCE_ONLY_CANONICAL_DOMAIN_AND_DIRECT_ROUTE_PREFLIGHT');
 assert.equal(OWNER_CUSTOM_DOMAIN,'https://dreamwishwand.com');
 assert.equal(EXISTING_PAGES_BASE_PATH,'/web');
 for(const path of PUBLIC_STATIC_CANONICAL_PATHS){
  assert.equal(canonicalForApprovedStaticPath(path,{basePath:'',origin:OWNER_CUSTOM_DOMAIN}),
   OWNER_CUSTOM_DOMAIN+path);
  assert.equal(canonicalForApprovedStaticPath(path,{basePath:'/web',origin:OWNER_CUSTOM_DOMAIN}),null);
  assert.equal(canonicalForApprovedStaticPath(path,{basePath:'',origin:''}),null);
  assert.equal(canonicalForApprovedStaticPath(path,{basePath:'',origin:'http://dreamwishwand.com'}),null);
  assert.equal(canonicalForApprovedStaticPath(path,{basePath:'',origin:'https://www.dreamwishwand.com'}),null);
 }
 assert.equal(PUBLIC_STATIC_CANONICAL_PATHS.length,new Set(PUBLIC_STATIC_CANONICAL_PATHS).size);
 for(const path of ['/web/','/web/collection/','/users/verified_01/','/library/',
   '/ja/40000047/','/40000047/','/40000047/40000048/',
   '/community-lab/','/gallery/my/','/editor/items/','/collection//','/collection/%2F',
   '/ja/entity/quest/12345/']){
  assert.equal(canonicalForApprovedStaticPath(path,{basePath:'',origin:OWNER_CUSTOM_DOMAIN}),null,path);
 }
});

test('unaccepted entity/alias/handle syntax can never authorize HTTP200, redirect or public indexing',()=>{
 assert.equal(PUBLIC_ENTITY_HTTP200_ACCEPTED,false);
 assert.equal(PUBLIC_USER_PROFILE_HTTP200_ACCEPTED,false);
 assert.equal(PUBLIC_ALIAS_REDIRECTS_ACCEPTED,false);
 assert.equal(parseSharedPrimaryId('40000047'),40000047);
 assert.equal(inspectPublicProfileHandleSegment('example_123').status,'SYNTAX_ONLY_UNVERIFIED');
 const cases=[
  ['/40000047/','UNACCEPTED_ENTITY_ID_ROUTE'],
  ['/40000047/40000048/','UNACCEPTED_ENTITY_ID_ROUTE'],
  ['/users/example_123/','UNACCEPTED_PUBLIC_HANDLE_ROUTE'],
  ['/users/admin/','UNACCEPTED_PUBLIC_HANDLE_ROUTE'],
  ['/library/','PRIVATE_ACCOUNT_ROUTE'],
  ['/library/presets/','PRIVATE_ACCOUNT_ROUTE'],
  ['/ja/40000047/','UNACCEPTED_OR_UNKNOWN'],
  ['/40000047/chair/','UNACCEPTED_OR_UNKNOWN'],
  ['/users/example_123/%2e%2e/','INVALID'],
  ['/users/a//','INVALID'],
  ['https://dreamwishwand.com/users/example_123/','INVALID']
 ];
 for(const [path,kind] of cases){
  const checked=inspectCustomDomainPath(path);
  assert.equal(checked.kind,kind,path);
  assert.equal(checked.eligibleForPublicIndex,false);
  assert.equal(checked.authoritativeStatus,null,'never label locally planned status as live HTTP');
 }
 const publicPath=inspectCustomDomainPath('/collection/');
 assert.equal(publicPath.kind,'PUBLIC_STATIC_PRERENDER_CANDIDATE');
 assert.equal(publicPath.authoritativeStatus,null);
});

test('existing GitHub Pages remains exactly /web and static 404 fallback; no DNS/CNAME/workflow mutation',()=>{
 const config=file('svelte.config.js'),pages=file('.github/workflows/pages.yml');
 const layout=file('src/routes/+layout.svelte');
 const routeConfig=file('src/routes/+layout.ts');
 for(const token of ["base: process.env.BASE_PATH ?? ''","fallback: '404.html'"])
  assert.ok(config.includes(token),token);
 assert.match(pages,/BASE_PATH: \/web/);
 assert.match(pages,/branches: \[main\]/);
 assert.match(pages,/actions\/deploy-pages@v4/);
 assert.match(routeConfig,/prerender = true/);
 assert.match(routeConfig,/trailingSlash = 'always'/);
 assert.match(file('src/routes/[primary=sharedId]/+page.ts'),/prerender = false/);
 assert.match(file('src/routes/[locale=wandLocale]/[primary=sharedId]/+page.ts'),/prerender = false/);
 assert.match(layout,/\$page\.url\.pathname/);
 assert.match(layout,/import\.meta\.env\.VITE_WAND_CANONICAL_ORIGIN/);
 assert.match(layout,/<link rel="canonical" href=\{canonicalPreview\}/);
 assert.doesNotMatch(layout,/<meta[^>]+http-equiv=["']refresh|window\.location/);
 assert.deepEqual(SUPPORTED_DETAIL_LOCALES,['en','fr','it','de','es-ES','ja','zh-CN','pt-BR']);
});
