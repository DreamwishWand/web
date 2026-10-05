import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { catalogs } from '../src/lib/i18n/messages/index.js';
import { placeholders } from '../src/lib/i18n/catalog-schema.js';
import {
  HOME_STAGE1_CONSUMER,
  COLLECTION_STAGE1_CONSUMER,
  DECORATE_STAGE1_CONSUMER
} from '../src/lib/ui/consumer-fixtures.js';

const locales=['en','fr','it','de','es-ES','ja','zh-CN','pt-BR'];
const read=(path)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('shared Stage 1 consumer fixtures express closed Home, Collection and Decorate structures without owning Product semantics',()=>{
  assert.deepEqual(HOME_STAGE1_CONSUMER.coreProducts.map(x=>x.id),['decorate','collection','guide','presets','gallery','dreamsnaps']);
  assert.equal(HOME_STAGE1_CONSUMER.qa.id,'qa');
  assert.equal(HOME_STAGE1_CONSUMER.qa.variant,'horizontal');
  assert.deepEqual(COLLECTION_STAGE1_CONSUMER.personalStateControl,['all','owned','missing']);
  assert.equal(COLLECTION_STAGE1_CONSUMER.activeFilterPresentation,'removable-chip');
  assert.deepEqual(COLLECTION_STAGE1_CONSUMER.filterPresentation,{desktop:'end',mobile:'bottom'});
  assert.deepEqual(COLLECTION_STAGE1_CONSUMER.collectionInfoPresentation,{desktop:'end',mobile:'full'});
  assert.equal(COLLECTION_STAGE1_CONSUMER.mobileBulkActionPattern,'sticky-action-bar');
  assert.deepEqual(DECORATE_STAGE1_CONSUMER.entryCards.map(x=>x.id),['explore','moodboards','worldEditor']);
  assert.equal(DECORATE_STAGE1_CONSUMER.moodboardOrganization.pointerAndTouchDrag,true);
  assert.equal(DECORATE_STAGE1_CONSUMER.moodboardOrganization.equivalentNonDragActionsRequired,true);
});

test('Home is a Product hub with explicit neutral Decorate entry and no rejected marketing hero',()=>{
  const home=read('src/routes/+page.svelte');
  assert.match(home,/HOME_STAGE1_CONSUMER/);
  assert.match(home,/home-product-grid/);
  assert.match(home,/home-qa-entry/);
  assert.doesNotMatch(home,/<section class="hero"/);
  assert.doesNotMatch(home,/YOUR VALLEY, YOUR WISH|Every little wish deserves a little magic|Choose your next wish/);
  assert.equal(HOME_STAGE1_CONSUMER.coreProducts.find(x=>x.id==='decorate')?.href,'/decorate/');
});

test('shared shell has explicit Home, contextual region and capability slots without Product navigation duplication',()=>{
  const header=read('src/lib/SiteHeader.svelte');
  assert.match(header,/data-shared-app-shell/);
  assert.match(header,/class="app-home-action ui-icon-button"/);
  assert.match(header,/class="toolbar-context"/);
  assert.match(header,/data-shell-control="save"/);
  assert.match(header,/data-shell-control="account"/);
  assert.match(header,/shell\.account\.signedIn && shell\.notifications\.available/);
  assert.match(header,/shared\.shell\.discoverWand/);
  assert.doesNotMatch(header,/class="main-nav"/);
  for(const productPath of ['/explore/','/collection/','/guide/','/presets/','/gallery/','/dreamsnaps/','/qa/']){
    assert.equal(header.includes(productPath),false,productPath+' must not be global Product navigation');
  }
});

test('mobile shell is structurally separate and exposes no DDV Save control',()=>{
  const header=read('src/lib/SiteHeader.svelte');
  const start=header.indexOf('<div class="mobile-app-toolbar">');
  const end=header.indexOf('</header>',start);
  const mobile=header.slice(start,end);
  assert.match(mobile,/app-home-action/);
  assert.match(mobile,/data-shell-control="account-mobile"/);
  assert.match(mobile,/notifications-mobile/);
  assert.doesNotMatch(mobile,/data-shell-control="save"/);
});

test('controlled icon primitives use first-party SVG and stateful controls have accessible names',()=>{
  const icon=read('src/lib/ui/Icon.svelte');
  const iconButton=read('src/lib/ui/IconButton.svelte');
  assert.match(icon,/<svg/);
  assert.match(icon,/aria-label=\{decorative \? undefined : label\}/);
  assert.match(iconButton,/aria-label=\{label\}/);
  assert.match(iconButton,/aria-pressed=\{pressed\}/);
  assert.match(iconButton,/aria-expanded=\{expanded\}/);
  assert.doesNotMatch(iconButton,/[☀☾✦✧★☆♥♡]/);
});

test('sheet/drawer reuses existing dialog focus transfer, trapping and restoration helpers',()=>{
  const sheet=read('src/lib/ui/Sheet.svelte');
  assert.match(sheet,/openModalDialog/);
  assert.match(sheet,/closeModalDialog/);
  assert.match(sheet,/trapDialogTab/);
  assert.match(sheet,/<dialog/);
  assert.match(sheet,/on:cancel=\{cancel\}/);
});

test('touch drag affordance requires an equivalent non-drag action relationship',()=>{
  const drag=read('src/lib/ui/TouchDragHandle.svelte');
  assert.match(drag,/alternativeActionsId/);
  assert.match(drag,/aria-describedby=\{alternativeActionsId\}/);
  assert.match(drag,/aria-controls=\{alternativeActionsId\}/);
  assert.match(drag,/on:pointerdown/);
  assert.match(drag,/on:pointermove/);
  assert.match(drag,/on:pointerup/);
});

test('shared responsive styles are fluid, mobile-adaptive and touch-sized',()=>{
  const css=read('src/app.css');
  assert.match(css,/\.responsive-frame\s*\{[^}]*clamp\(/s);
  assert.match(css,/\.responsive-card-grid\s*\{[^}]*repeat\(auto-fit/s);
  assert.match(css,/@media \(max-width: 820px\)/);
  assert.match(css,/\.mobile-app-toolbar\s*\{/);
  assert.match(css,/\.ui-icon-button\s*\{[^}]*width:44px[^}]*height:44px/s);
  assert.match(css,/\.ui-sheet-bottom \.ui-sheet-panel/);
  assert.match(css,/\.mobile-action-bar\s*\{[^}]*position:sticky/s);
});

test('all launch catalogs include shared shell/orientation keys with key and placeholder parity',()=>{
  const keys=[
    'shared.shell.home','shared.shell.discoverWand','shared.shell.contextActions',
    'shared.shell.globalControls','shared.shell.ddvSave','shared.shell.openSave',
    'shared.shell.notifications','shared.shell.notificationsUnread','shared.shell.profile',
    'shared.shell.signIn','shared.shell.settings','shared.orientation.title',
    'shared.orientation.intro','shared.orientation.products'
  ];
  for(const locale of locales){
    for(const key of keys){
      assert.equal(typeof catalogs[locale][key],'string',locale+':'+key);
      assert.ok(catalogs[locale][key].trim().length>0,locale+':'+key);
      assert.deepEqual(placeholders(catalogs[locale][key]),placeholders(catalogs.en[key]),locale+':'+key);
    }
  }
});

test('Decorate neutral entry has exactly three shared visual-card consumers and no extra explanatory intro',()=>{
  const route=read('src/routes/decorate/+page.svelte');
  assert.match(route,/DECORATE_STAGE1_CONSUMER\.entryCards/);
  assert.match(route,/GroupedCardGrid/);
  assert.match(route,/VisualCard/);
  assert.doesNotMatch(route,/page-intro|intro/);
});

test('Collection consumes shared responsive framing without changing its Product-owned runtime/taxonomy',()=>{
  const route=read('src/routes/collection/+page.svelte');
  assert.match(route,/ResponsiveFrame/);
  assert.match(route,/loadCollectionRuntime/);
  assert.match(route,/collectionFacetLabel/);
  assert.match(route,/filterCollectionRecords/);
});
