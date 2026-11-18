import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {BETA_EDITOR_PENDING_OPERATIONS,EDITOR_BETA_LOCALES,editorBetaCopy} from '../src/lib/product-home/editor-beta-availability.mjs';
import {EDITOR_HUB_LOCALES,editorHubCopy} from '../src/lib/product-home/editor-hub-copy.mjs';

const hub=readFileSync(new URL('../src/routes/editor/+page.svelte',import.meta.url),'utf8');

test('Progressive beta exposes eight distinct Save operations as pending-only, never invented editor routes',()=>{
 const ids=BETA_EDITOR_PENDING_OPERATIONS.map(x=>x.id);
 assert.equal(ids.length,8);
 assert.equal(new Set(ids).size,8);
 assert.deepEqual(ids,[
  'inventory-quantity','chest-storage','collection-ownership','world-grid',
  'appearance-hair-skin','wardrobe','time-spawn','save-backup-restore'
 ]);
 for(const entry of BETA_EDITOR_PENDING_OPERATIONS){
  assert.equal(entry.state,'pending');
  assert.equal(entry.href,null);
  assert.equal(entry.writerAuthorized,false);
  assert.ok(Object.isFrozen(entry));
 }
 assert.ok(Object.isFrozen(BETA_EDITOR_PENDING_OPERATIONS));
 assert.match(hub,/data-beta-save-operations data-beta-save-authorized="false"/);
 assert.match(hub,/data-beta-operation=\{operation\.id\}/);
 assert.match(hub,/data-beta-state="pending" data-beta-writer-authorized="false"/);
 assert.match(hub,/aria-disabled="true"/);
 assert.match(hub,/\{#each BETA_EDITOR_PENDING_OPERATIONS as operation,i \(operation\.id\)\}/);
 assert.doesNotMatch(hub,/href=\{operation\.(?:href|path)\}/);
 assert.doesNotMatch(hub,/on:click=\{[^}]*operation/);
 assert.doesNotMatch(hub,/data-beta-save-authorized="true"/);
 assert.doesNotMatch(hub,/data-beta-writer-authorized="true"/);
});

test('Pre-existing functioning routes are labeled local/read/test and public Writer is never inferred',()=>{
 const available=[
  ['data-editor-moodboards','local-moodboards','local','/moodboards/'],
  ['data-editor-catalog','catalog-read','read','/editor/items/'],
  ['data-editor-world','local-world','local','/editor/world/'],
  ['data-editor-timing','timing-read','read','/editor/timing/'],
  ['data-steam-reader-entry','test-steam-reader','test','/editor/steam-reader/'],
  ['data-editor-collection','test-collection','test','/editor/collection/']
 ];
 for(const [testId,capability,state,route] of available){
  assert.ok(hub.includes(testId),testId);
  assert.ok(hub.includes('data-beta-capability="'+capability+'"'),capability);
  assert.ok(hub.includes('data-beta-state="'+state+'"'),capability);
  assert.ok(hub.includes(route),route);
 }
 assert.match(hub,/\{#if collectionReady\}/,'no direct bypass of existing test-only Collection route gate');
 assert.match(hub,/getScopedCollectionMountInfo\(\)/,'original gate read retained');
 assert.match(hub,/data-editor-writer-boundary/,'keep product Save Writer warning');
 assert.match(hub,/data-beta-save-authorized="false"/);
 assert.doesNotMatch(hub,/toggle_scoped_edit|stage_fixed_collection|begin_scoped_edit_output/);
});

test('All eight locales include per-operation labels and explicit read/local/test/pending distinctions',()=>{
 assert.deepEqual([...EDITOR_BETA_LOCALES].sort(),[...EDITOR_HUB_LOCALES].sort());
 for(const locale of EDITOR_BETA_LOCALES){
  const value=editorBetaCopy(locale);
  assert.equal(value.operations.length,BETA_EDITOR_PENDING_OPERATIONS.length);
  assert.ok(Object.isFrozen(value)&&Object.isFrozen(value.operations));
  for(const key of ['title','intro','local','read','test','pending','pendingTitle','pendingDetail','moodboards','moodboardsDetail','catalogDetail','worldDetail','timingDetail','readerDetail','collectionDetail'])
   assert.ok(typeof value[key]==='string'&&value[key].trim().length>=2,locale+' '+key);
  for(const x of value.operations)assert.ok(typeof x==='string'&&x.trim().length>=2,locale+' operation');
  assert.ok(editorHubCopy(locale).boundary,locale+' writer boundary');
 }
 assert.equal(editorBetaCopy('unknown').title,editorBetaCopy('en').title);
});
