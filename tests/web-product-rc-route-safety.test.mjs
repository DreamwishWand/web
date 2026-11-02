import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { WAND_RC_PRODUCTS, WAND_RC_RESTRICTED_OPERATIONS, WAND_RC_TARGET } from '../src/lib/product-home/rc-manifest.js';
const source = (path) => readFileSync(path,'utf8');

test('exactly six canonical Core products plus Community Help Center (not a seventh Core)', () => {
  assert.deepEqual(WAND_RC_PRODUCTS.map(p=>p.id),[
    'decorate','collection','guide','presets','gallery','dreamsnaps','help'
  ]);
  assert.equal(WAND_RC_PRODUCTS.slice(0,6).filter(x=>x.participationSurface).length,0);
  assert.equal(WAND_RC_PRODUCTS[6].participationSurface,true);
  assert.deepEqual(WAND_RC_PRODUCTS[6].jobs.map(x=>x.href),[
    '/help/questions/','/help/tips/','/help/issues/','/help/my/'
  ]);
  assert.deepEqual(WAND_RC_PRODUCTS[5].jobs.map(x=>x.href),[
    '/dreamsnaps/community/','/dreamsnaps/submit/','/dreamsnaps/judge/','/dreamsnaps/results/','/dreamsnaps/my/'
  ]);
});

test('RC manifest refers only to actual static SvelteKit routes and cannot confer release rights', () => {
  const all = WAND_RC_PRODUCTS.flatMap(p=>[{href:p.href},...p.jobs]);
  for (const {href} of all){
    assert.match(href,/^\/[a-z0-9/-]+\/$/,'Only local literal paths allowed');
    assert.ok(existsSync('src/routes'+href+'+page.svelte'),'Missing '+href);
  }
  for (const p of WAND_RC_PRODUCTS)for(const job of p.jobs)
    assert.ok(['RC_REQUIRED','CONDITIONAL','OFF'].includes(job.status));
  assert.equal(WAND_RC_TARGET.ownerConsumer,'OFF');
  assert.equal(WAND_RC_TARGET.writer,'OFF');
  assert.equal(WAND_RC_TARGET.release,'PUBLIC_NO_GO');
  assert.equal(WAND_RC_TARGET.managedIngress,'I01-I14_NOT_ACCEPTED');
  assert.equal(WAND_RC_TARGET.communitySource,'Source156_QR_PENDING');
  assert.ok(WAND_RC_RESTRICTED_OPERATIONS.every(x=>x.status==='OFF'));
  assert.equal(all.some(x=>x.href.includes('https:')),false);
});

test('home offers Community Help Center and clearly links availability/unsupported scope', () => {
  const home=source('src/routes/+page.svelte');
  assert.match(home,/href=\{base \+ '\/help\/'\}/);
  assert.match(home,/helpCopy.title/);
  assert.match(home,/data-product-rc-boundary="off"/);
  assert.match(home,/\/rc-status\//);
  const rc=source('src/routes/rc-status/+page.svelte');
  assert.match(rc,/data-rc-owner-off/);
  assert.match(rc,/data-rc-version/);
  assert.match(rc,/WAND_RC_PRODUCTS/);
});

test('existing fail-closed contracts preserved and no false personal Collection ownership', () => {
  const guide=source('src/routes/guide/+page.svelte');
  assert.match(guide,/\['quests','starPaths','events','systems'\]/);
  const collection=source('src/routes/collection/+page.svelte');
  assert.doesNotMatch(collection,/viewMode|ViewMode|setViewMode/);
  assert.match(collection,/COLLECTION_SUPPORTED_VERSION/);
  assert.match(collection,/data-collection-state="unsupported-version"/);
  const legacy=source('src/routes/gallery/dreamsnaps/+page.svelte');
  assert.match(legacy,/data-legacy-dreamsnaps="fail-closed"/);
  assert.doesNotMatch(legacy,/community_get_gallery_public_v1|signedUrl/);
  const community=source('src/routes/dreamsnaps/community/+page.svelte');
  assert.match(community,/data-community-dreamsnaps="fail-closed"/);
  assert.doesNotMatch(community,/signedUrl|media\('read'/);
  const my=source('src/routes/dreamsnaps/my/+page.svelte');
  assert.doesNotMatch(my,/setDreamsnapOfficialResultPublication/);
  const creator=source('src/routes/creator/+page.svelte');
  assert.match(creator,/resolveTypedWorkRoute/);
  const typed=source('src/lib/community/typed-work-route.js');
  assert.match(typed,/pending-public-detail-authority/);
  assert.match(typed,/sourceCannotBePublic/);
});
