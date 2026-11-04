import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {APPROVED_ENTITY_ROUTE_MANIFEST,ENTITY_PUBLISHING_ENABLED,compileEntityHostPlan,
 entityPathIdentity,expectedDirectHttpStatus} from '../src/lib/foundation/public-entity-host-contract.mjs';
import {itemPersonalReadState,LOCAL_ITEM_REFERENCE_SCOPE,LOCAL_W1_READ_SCOPE,
 ITEM_PERSONAL_READ_ENABLED,ITEM_PERSONAL_WRITER_ENABLED} from '../src/lib/local/item-personal-read-gate.mjs';
import {ITEM_CAPABILITY_COPY,itemCapabilityCopy} from '../src/lib/local/item-capability-copy.mjs';
const read=x=>readFileSync(x,'utf8');
const scope={...LOCAL_ITEM_REFERENCE_SCOPE,sourceDigest:'a'.repeat(64)};
const record=()=>({
 entityKind:'ITEM',visibility:'PUBLIC',rights:'ACCEPTED',privacy:'PUBLIC_OPT_IN',
 moderation:'ACCEPTED',independentQa:'PASS',publishConsent:'VERIFIED',
 rightsVersion:'R1',publishedRevision:'b'.repeat(64),sourceScope:{...scope},
 acceptedSourceScope:{...scope},primaryId:'40000047',secondaryId:null,
 canonicalPath:'/web/ja/40000047/',aliases:[{path:'/web/ja/40000047/old-title/',
 samePublicEntityProof:'INDEPENDENT_PASS',sourceScope:{...scope}}]
});
test('production approved manifest empty; dynamic 404 fallback is not positive direct 200 or redirect',()=>{
 assert.equal(ENTITY_PUBLISHING_ENABLED,false);
 assert.deepEqual(APPROVED_ENTITY_ROUTE_MANIFEST,[]);
 const p=compileEntityHostPlan();
 assert.equal(p.status,'COMPILED_ONLY');
 assert.deepEqual(p.pages,[]);
 assert.deepEqual(p.redirects,[]);
 assert.equal(expectedDirectHttpStatus('/web/ja/40000047/',p).status,404);
 assert.equal(expectedDirectHttpStatus('/web/ja/40000047/old-title/',p).status,404);
 assert.equal(entityPathIdentity('/web/ja/40000047/old-title/').slug,'old-title');
 assert.equal(entityPathIdentity('/web/ja/40000047/12345/').secondary,'12345');
 for(const bad of ['/web/xx/40000047/','/web/ja/00047/','/web/ja/40000047/1e9/',
  '/web/ja/40000047/abc/999/','/other/ja/40000047/','/web/ja/40000047']){
  assert.equal(entityPathIdentity(bad),null,bad);
 }
 assert.match(read('src/routes/[locale=wandLocale]/[primary=sharedId]/+page.ts'),/prerender\s*=\s*false/);
 assert.match(read('src/lib/entity/SharedEntityDetail.svelte'),/noindex,follow/);
});
test('SYNTHETIC hypothetical host plan 200+301 only if every evidence and source scope field independently complete',()=>{
 const e=record(),p=compileEntityHostPlan([e]);
 assert.equal(p.status,'COMPILED_ONLY');
 assert.equal(p.publicEnabled,false);
 assert.equal(p.hostAccepted,false);
 assert.equal(expectedDirectHttpStatus(e.canonicalPath,p).status,200);
 assert.deepEqual(expectedDirectHttpStatus(e.aliases[0].path,p),
 {status:301,location:e.canonicalPath,reason:'REQUIRES_REAL_HTTP_REDIRECT_HOST'});
 const fail=mutate=>{const x=record();mutate(x);assert.equal(compileEntityHostPlan([x]).status,'DENIED');};
 for(const field of ['visibility','rights','privacy','moderation','independentQa','publishConsent']){
  fail(x=>{x[field]='PENDING';});
 }
 fail(x=>{x.sourceScope={...scope,fullVersion:'1.25.3'};});
 fail(x=>{x.sourceScope={...scope,bid:'9A239D3DB569756D'};});
 fail(x=>{x.sourceScope={...scope,schema:626};});
 fail(x=>{x.sourceScope={...scope,sourceDigest:'c'.repeat(64)};});
 fail(x=>{x.publishedRevision='UNKNOWN';});
 fail(x=>{x.canonicalPath='/web/ja/40000047/1/';});
 fail(x=>{x.primaryId='40000048';});
 fail(x=>{x.aliases[0].samePublicEntityProof='UNVERIFIED';});
 fail(x=>{x.aliases[0].sourceScope={...scope,fullVersion:'1.25.3'};});
 fail(x=>{x.aliases[0].path='/web/ja/40000048/old-title/';});
 fail(x=>{x.aliases=[...x.aliases,x.aliases[0]];});
 assert.equal(compileEntityHostPlan([e,e]).status,'DENIED');
 const child={...record(),canonicalPath:'/web/ja/40000047/123/',secondaryId:'123',aliases:[]};
 assert.equal(compileEntityHostPlan([child]).status,'DENIED');
 child.specializationEvidence='INDEPENDENT_PASS';
 assert.equal(compileEntityHostPlan([child]).status,'COMPILED_ONLY');
});
test('Item ownership and amount never positive from W1 single session or exact-looking client fields',()=>{
 assert.equal(ITEM_PERSONAL_READ_ENABLED,false);
 assert.equal(ITEM_PERSONAL_WRITER_ENABLED,false);
 const empty=itemPersonalReadState();
 assert.equal(empty.reason,'NO_TRUSTED_ITEM_SESSION');
 assert.deepEqual([empty.owned,empty.discovered,empty.amount,empty.numerator,empty.denominator,empty.completion],[null,null,null,null,null,null]);
 const mismatch=itemPersonalReadState({sessionSource:LOCAL_W1_READ_SCOPE,capabilities:{readInventory:true,readOwnership:true},
 nativeEvidence:{operationAccepted:true}});
 assert.equal(mismatch.state,'UNKNOWN');
 assert.equal(mismatch.reason,'SOURCE_SCOPE_MISMATCH');
 assert.equal(mismatch.capabilityAvailable,false);
 const forged=itemPersonalReadState({catalogScope:{...LOCAL_ITEM_REFERENCE_SCOPE},
 sessionSource:{...LOCAL_ITEM_REFERENCE_SCOPE,sourceSha256:'f'.repeat(64)},
 capabilities:{readInventory:true,readOwnership:true,writeInventory:true},nativeEvidence:{operationAccepted:true,verifiedSourceSha256:'f'.repeat(64)}});
 assert.equal(forged.state,'UNKNOWN');
 assert.equal(forged.capabilityAvailable,false);
 assert.equal(forged.writeAuthorized,false);
 assert.equal(forged.originalBackupAvailable,false);
 assert.equal(forged.editedCopyAvailable,false);
});
test('all 8 locale Item unavailable labels and user-facing actual W1/Preset links, no invented personal SAVE',()=>{
 const locales=['en','ja','fr','it','de','es-ES','zh-CN','pt-BR'];
 assert.deepEqual(Object.keys(ITEM_CAPABILITY_COPY).sort(),locales.sort());
 for(const l of locales)for(const key of ['title','catalog','session','owned','discovered','amount','progress','unknown','reason','writer','w1','presets','noUpload']){
  assert.ok(typeof itemCapabilityCopy(l)[key]==='string'&&itemCapabilityCopy(l)[key].length>=1,l+key);
 }
 assert.equal(itemCapabilityCopy('unsupported'),itemCapabilityCopy('en'));
 const gate=read('src/lib/local/ItemReadCapabilityNotice.svelte');
 assert.match(gate,/data-owned=\{state.state.toLowerCase\(\)\}/);
 assert.match(gate,/data-writer="off"/);
 assert.match(gate,/editor\/timing/);
 assert.match(gate,/presets/);
 assert.match(read('src/routes/editor/items/+layout.svelte'),/ItemReadCapabilityNotice/);
 assert.match(read('src/routes/editor/items/+page.svelte'),/SharedCatalogDiscovery/);
 assert.match(read('src/routes/editor/items/+page.svelte'),/SharedCatalogDiscovery/);
 assert.doesNotMatch(read('src/routes/editor/items/+page.svelte'),/type="file"/);
});
