import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeShellPath, resolveProductShell } from '../src/lib/ui/product-shell-navigation.mjs';
import { readFileSync } from 'node:fs';

const langs = ['en','ja','fr','it','de','es-ES','zh-CN','pt-BR'];

test('HOME-UX-43/44 product-local nav, never a seven-Product universal toolbar', () => {
  for (const lang of langs) {
    const home = resolveProductShell('/web/', lang);
    assert.equal(home.id, null);
    assert.deepEqual(home.sections, []);
    const decorate = resolveProductShell('/web/decorate/', lang);
    assert.equal(decorate.id, 'decorate');
    assert.equal(decorate.rootHref, '/decorate/');
    assert.equal(decorate.atRoot, true);
    assert.deepEqual(decorate.sections.map(x=>x.href), ['/explore/','/moodboards/','/editor/world/']);
    const help = resolveProductShell('/web/help/',lang);
    assert.deepEqual(help.sections.map(x=>x.href), ['/help/questions/','/help/tips/','/help/issues/','/help/my/']);
    const dream = resolveProductShell('/web/dreamsnaps/', lang);
    assert.deepEqual(dream.sections.map(x=>x.href), ['/dreamsnaps/community/','/dreamsnaps/submit/','/dreamsnaps/judge/','/dreamsnaps/results/','/dreamsnaps/my/']);
    const gallery = resolveProductShell('/web/gallery/', lang);
    assert.deepEqual(gallery.sections.map(x=>x.href), ['/gallery/my/']); // two other gallery categories are root-local buttons, not routes.
    for(const product of ['/collection/','/guide/','/presets/']) assert.equal(resolveProductShell('/web'+product,lang).sections.length,0);
    assert.ok(decorate.rootLabel && help.rootLabel && dream.rootLabel);
  }
});

test('HOME-UX-45/49/52 nested active state, refresh/deep links and compact World Editor', () => {
  assert.equal(normalizeShellPath('/web/moodboards/my-private/?tab=1'),'/moodboards/my-private/');
  const world = resolveProductShell('/web/editor/world/', 'ja');
  assert.equal(world.presentation, 'immersive');
  assert.equal(world.id,'decorate');
  assert.equal(world.sections.filter(x=>x.current).length,1);
  assert.equal(world.sections.find(x=>x.current)?.href,'/editor/world/');
  assert.equal(world.rootHref,'/decorate/');
  const nested = resolveProductShell('/web/dreamsnaps/results/history/', 'en');
  assert.equal(nested.sections.find(x=>x.current)?.href,'/dreamsnaps/results/');
  assert.equal(nested.sections.filter(x=>x.current).length,1);
  assert.equal(resolveProductShell('/web/gallery/my/','en').sections.find(x=>x.current)?.id,'my');
  assert.equal(resolveProductShell('/web/help/questions/','en').sections.find(x=>x.current)?.id,'questions');
  assert.equal(resolveProductShell('/web/explore/','ja').sections.find(x=>x.current)?.id,'explore');
  assert.equal(resolveProductShell('/web/qa/','ja').id,'help');
  assert.equal(resolveProductShell('/web/unknown/','ja').id,null);
  assert.equal(resolveProductShell('/web/discover/','ja').sections.length,0);
});

test('HOME-UX-47/48/50/51 shell role separation and fail-closed unsupported actions', () => {
  const header = readFileSync(new URL('../src/lib/SiteHeader.svelte',import.meta.url),'utf8');
  const layout = readFileSync(new URL('../src/routes/+layout.svelte',import.meta.url),'utf8');
  assert.match(layout,/<SiteHeader \/>/);
  assert.match(header,/data-product-local-navigation/);
  assert.match(header,/data-immersive-recovery/);
  assert.match(header,/data-mobile-product-sections/);
  assert.match(header,/data-product-local-mobile/);
  assert.match(header,/afterNavigate\(/);
  assert.match(header,/setShellContextActions\(\[\]\)/);
  assert.match(header,/shell\.save\.href/);
  assert.match(header,/shell\.account\.href/);
  assert.doesNotMatch(header,/activate\('open-ddv-save'/);
  assert.doesNotMatch(header,/activate\(shell\.account/);
  assert.doesNotMatch(header,/data-global-product-switcher/);
  assert.doesNotMatch(header,/class="global-tool-rail"/);
});
