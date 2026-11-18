import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {BAMBOO_READONLY_OFF_SCOPE,BAMBOO_READONLY_DISPLAY_FIELDS,BAMBOO_READONLY_OFF_LOCALES,bambooReadonlyOffCopy} from '../src/lib/wep/steam-bamboo-readonly-off-copy.mjs';
const route=readFileSync(new URL('../src/routes/editor/bamboo/steam/+page.svelte',import.meta.url),'utf8');
const pages=readFileSync(new URL('../.github/workflows/pages.yml',import.meta.url),'utf8');
const cargo=readFileSync(new URL('../crates/ddv-save-core/Cargo.toml',import.meta.url),'utf8');

test('08WEB Bamboo route is OFF without independent signed exact ReadDomain feature, no new UI authority',()=>{
 assert.deepEqual(BAMBOO_READONLY_OFF_SCOPE,{
  contract:'wand.web.steam626.bamboo.ui-off@1',
  operation:'steam626.bamboo40700007.readonly',
  platform:'SteamWindows',buildKind:'SteamFullVersion',
  buildId:'releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22',
  schema:626,itemId:40700007,
  signedScopedReaderAvailable:false,localFileInputEnabled:false,
  productReadAccepted:false,writerAuthorized:false,
  stageAuthorized:false,exportAuthorized:false,cloudUploadAuthorized:false
 });
 assert.ok(Object.isFrozen(BAMBOO_READONLY_OFF_SCOPE));
 assert.match(cargo,/product-steam626-bamboo-readonly = \["indexed-read"\]/);
 assert.match(pages,/--features worker-wasm,indexed-read/);
 assert.doesNotMatch(pages,/--features worker-wasm,indexed-read,product-steam626-bamboo-readonly/);
 assert.match(route,/data-bamboo-reader-ui="scoped-preparation"/);
 assert.match(route,/data-bamboo-runtime="off"/);
 assert.match(route,/data-bamboo-writer-authorized="false"/);
 assert.match(route,/data-bamboo-source-file-enabled="false"/);
 assert.match(route,/data-bamboo-operation-on="false"/);
 assert.match(route,/data-bamboo-item-id=\{BAMBOO_READONLY_OFF_SCOPE\.itemId\}/);
 assert.match(route,/data-bamboo-schema=\{BAMBOO_READONLY_OFF_SCOPE\.schema\}/);
 assert.match(route,/data-bamboo-signed-feature-available=\{String\(BAMBOO_READONLY_OFF_SCOPE\.signedScopedReaderAvailable\)\}/);
 assert.match(route,/data-bamboo-readiness="off"/);
 assert.doesNotMatch(route,/<(?:input|form|button|textarea|select)\b/,'must never offer unsafely enabled Save input');
 assert.doesNotMatch(route,/\bnew Worker\s*\(|new File\s*\(|fetch\s*\(|localStorage\s*\.|stage_steam626|read_steam626_bamboo_single_target\s*\(/,'no second reader engine, source payload or staged operation');
 assert.match(route,/<meta name="robots" content="noindex,nofollow"/);
});

test('08WEB Bamboo display enumerates only bounded oldStock/nextGridObjectId/digest witnesses, no session keys',()=>{
 assert.deepEqual([...BAMBOO_READONLY_DISPLAY_FIELDS],['oldStock','nextGridObjectId','rootSha256','gridSha256']);
 assert.ok(Object.isFrozen(BAMBOO_READONLY_DISPLAY_FIELDS));
 assert.match(route,/\{#each BAMBOO_READONLY_DISPLAY_FIELDS as field\}/);
 assert.match(route,/<output aria-label=\{copy\[field\]\}>—<\/output>/,'never claim a forged read receipt');
 assert.doesNotMatch(route,/sessionId|indexGeneration|decodedSha256|WorkerEnvelope|expectedRevision|CAS|take_output/,'UI never displays or mints Rust scope');
 assert.match(route,/href=\{base\+'\/editor\/'\}/);
});

test('08WEB Bamboo readable OFF reason is available in all eight launch locales',()=>{
 assert.deepEqual([...BAMBOO_READONLY_OFF_LOCALES].sort(),['en','ja','fr','it','de','es-ES','zh-CN','pt-BR'].sort());
 for(const lang of BAMBOO_READONLY_OFF_LOCALES){
  const copy=bambooReadonlyOffCopy(lang);
  for(const key of ['title','kicker','target','off','reason','results','oldStock','nextGridObjectId','rootSha256','gridSha256','privacy','back'])
   assert.ok(typeof copy[key]==='string'&&copy[key].trim().length>3,lang+':'+key);
  assert.ok(Object.isFrozen(copy));
 }
 assert.equal(bambooReadonlyOffCopy('forged').title,bambooReadonlyOffCopy('en').title);
});
