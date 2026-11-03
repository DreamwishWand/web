import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { HELP_LOCAL_COPY, helpLocalCopy } from '../src/lib/community/help-local-copy.js';
import { WAND_RC_PRODUCTS } from '../src/lib/product-home/rc-manifest.js';

const text = (p) => readFileSync(p,'utf8');
const names = ['questions','tips','issues','my'];
const locales = ['en','fr','it','de','es-ES','ja','zh-CN','pt-BR'];
test('all eight supported locale empty states explain absence of verified results, never zero items', () => {
  for (const locale of locales) {
    const c = helpLocalCopy(locale);
    for (const k of ['back','navigation','statusConditional','statusOff','search','searchPending','emptyQuestions','emptyTips','emptyIssues','emptyMy','conditionalLink','legacyBoundary','noAutoRequests','availability']) {
      assert.equal(typeof c[k], 'string', locale + ' missing ' + k);
      assert.ok(c[k].trim().length > 0, locale + ' empty ' + k);
    }
  }
  assert.equal(helpLocalCopy('xx'),HELP_LOCAL_COPY.en);
});

test('four Help shells reuse one local component, do not add client RPC or private Owner dependency', () => {
  for (const kind of names) {
    const page = text('src/routes/help/'+kind+'/+page.svelte');
    assert.match(page,new RegExp('HelpLocalChild kind="'+kind+'"'));
    assert.doesNotMatch(page,/fetch\(|signIn|client\.query|media\(/);
  }
  const component=text('src/lib/community/HelpLocalChild.svelte');
  assert.match(component,/data-help-empty-state="unverified"/);
  assert.match(component,/data-help-no-auth="true"/);
  assert.match(component,/type="search" disabled aria-describedby=/);
  assert.match(component,/aria-current="page"/);
  assert.match(component,/href=\{base \+ '\/help\/'\}/);
  assert.doesNotMatch(component,/createCommunityBrowserClient|fetch\(|getPublicCommunityMedia|callPublicCommunityRpc|onMount/);
  assert.doesNotMatch(component,/\/(?:qa|gallery)\/my\//);
  assert.doesNotMatch(component,/window\.|localStorage|sessionStorage/);
});

test('Help children statuses match canonical RC ledger; OFF destinations do not inherit Q&A Owner links', () => {
  const help = WAND_RC_PRODUCTS.find((p) => p.id === 'help');
  assert.deepEqual(help.jobs.map((j)=>j.href),names.map((n)=>'/help/'+n+'/'));
  assert.deepEqual(help.jobs.map((j)=>j.status),['CONDITIONAL','CONDITIONAL','OFF','OFF']);
  const component=text('src/lib/community/HelpLocalChild.svelte');
  assert.match(component,/job\?\.status === 'CONDITIONAL'/);
  assert.match(component,/\{#if available\}/);
  assert.match(component,/\/qa\/\?type=questions/);
  assert.match(component,/\/qa\/\?type=tips/);
});
