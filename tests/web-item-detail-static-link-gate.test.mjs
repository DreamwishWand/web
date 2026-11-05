import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PUBLIC_DETAIL_ACCEPTED, sharedEntityHref, SUPPORTED_DETAIL_LOCALES } from '../src/lib/entity/shared-catalog-detail.mjs';

// No static prerendered ItemID route has been released for GitHub Pages.
// A Vite development server still supports the legacy local-only detail E2E.
const source=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const surfaces=[
  'src/routes/explore/+page.svelte',
  'src/routes/collection/+page.svelte',
  'src/lib/entity/SharedCatalogDiscovery.svelte'
];
test('public detail gate remains OFF until direct HTTP200 static routes are accepted',()=>{
  assert.equal(PUBLIC_DETAIL_ACCEPTED,false);
  assert.equal(SUPPORTED_DETAIL_LOCALES.length,8);
  assert.match(source('src/routes/[locale=wandLocale]/[primary=sharedId]/+page.ts'),/prerender\s*=\s*false/);
  assert.match(source('src/routes/[primary=sharedId]/+page.ts'),/prerender\s*=\s*false/);
  assert.match(source('src/routes/+layout.ts'),/prerender\s*=\s*true/);
  for(const locale of SUPPORTED_DETAIL_LOCALES)
    assert.equal(sharedEntityHref('/web',locale,40001238),'/web/'+locale+'/40001238/');
});
test('all three public Item entry surfaces gate direct Item links in production, preserve local inspection',()=>{
  for(const p of surfaces){
    const s=source(p);
    assert.match(s,/import\.meta\.env\.DEV\s*\|\|\s*PUBLIC_DETAIL_ACCEPTED/,p);
    assert.match(s,/\{#if detailNavigationAvailable\}[\s\S]*?<a href=\{(?:sharedEntityHref|sharedCatalogDirectoryHref)\(/,p);
    assert.match(s,/\{:else\}[\s\S]*?data-detail-unavailable="true"/,p);
    assert.match(s,/data-detail-unavailable="true"/,p);
    assert.doesNotMatch(s,/window\.location|on:click=\{\(\)=>.*sharedEntityHref/,p);
  }
  const related=source('src/lib/entity/SharedCatalogDiscovery.svelte');
  assert.equal((related.match(/\{#if detailNavigationAvailable\}/g)||[]).length,2,'related + search both gate hrefs');
  assert.equal((related.match(/data-detail-unavailable="true"/g)||[]).length,2);
});
test('failed public Item detail routes keep true HTTP404, and healthy nearby features remain',()=>{
  const explore=source(surfaces[0]),collection=source(surfaces[1]);
  assert.match(explore,/class="card-review"/);
  assert.match(explore,/class="quick-review"/);
  assert.match(collection,/data-stage1-item-info/);
  assert.match(collection,/data-personal-progress="unknown" data-writer="off"/);
  const detail=source('src/lib/entity/SharedEntityDetail.svelte');
  assert.match(detail,/noindex,follow/);
  assert.match(detail,/data-writer="off"/);
  assert.match(source('.github/workflows/web-shared-catalog-detail.yml'),/WEB_ITEM_DETAIL_STATIC_HTTP404_LINK_EXACT5_SCOPED_PASS/);
});
