import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {MOODBOARD_COPY} from '../src/lib/moodboards/copy.js';
import {createEmptyMoodboardDocument,createMoodboard,parseMoodboardDocument,serializeMoodboardDocument} from '../src/lib/moodboards/store.js';
const root=readFileSync(new URL('../src/routes/moodboards/+page.svelte',import.meta.url),'utf8');

test('DEC-UX-24: Moodboards root uses a responsive visual-card grid and title-only direct create',()=>{
 const form=root.match(/<form class="create-board new-board"[\s\S]*?<\/form>/)?.[0]??'';
 assert.ok(form.includes('data-moodboard-quick-create'));
 assert.match(form,/<input bind:value=\{newTitle\} required\/>/);
 assert.match(form,/<button type="submit">\{copy\.create\}<\/button>/);
 assert.doesNotMatch(form,/<textarea/);
 assert.doesNotMatch(form,/newDescription|bind:value=\{newDescription\}/);
 assert.match(root,/data-moodboard-root-grid/);
 assert.match(root,/class="board-card-grid"/);
 assert.match(root,/grid-template-columns:repeat\(auto-fit,minmax\(min\(100%,185px\),1fr\)\)/);
 assert.match(root,/\.layout\{display:grid;grid-template-columns:minmax\(0,1fr\)/);
 assert.match(root,/\.new-board button\{min-height:44px\}/);
 assert.match(root,/\{#each document\.boards as board \(board\.id\)\}/);
 assert.match(root,/data-moodboard-cover aria-hidden="true"/);
 assert.match(root,/data-moodboard-root-menu/);
});

test('DEC-UX-24: New Moodboard immediately selects and focuses its workspace without changing the Store',()=>{
 assert.match(root,/function createBoard\(\)\{/);
 assert.match(root,/createMoodboard\(document,\{title:newTitle\}\)/);
 assert.match(root,/selectedId=result\.board\.id/);
 assert.match(root,/tick\(\)\.then\(\(\)=>workspaceHeading\?\.focus\(\)\)/);
 assert.match(root,/<h2 bind:this=\{workspaceHeading\} tabindex="-1" data-moodboard-workspace-title>/);
 assert.match(root,/if selected/);
 assert.match(root,/MOODBOARD_BACKUP_KEY/);
 assert.match(root,/exportPortableMoodboard/);
 assert.match(root,/importPortableMoodboard/);
 assert.match(root,/createMoodboardHandoff/);
 const stamp='2026-11-18T00:00:00.000Z';
 const original=createEmptyMoodboardDocument(stamp);
 const result=createMoodboard(original,{title:'Existing',description:'Pre-existing design notes'},{
  now:stamp,idFactory:()=> 'stable-board'
 });
 const reopened=parseMoodboardDocument(serializeMoodboardDocument(result.document));
 assert.equal(reopened.boards[0].description,'Pre-existing design notes','old rich metadata must survive');
 assert.equal(original.boards.length,0,'pure Store remains immutable');
});

test('DEC-UX-24: eight locales retain direct creation labels and existing managed board operations',()=>{
 assert.equal(Object.keys(MOODBOARD_COPY).length,8);
 for(const loc of ['en','fr','it','de','es-ES','ja','zh-CN','pt-BR']){
  assert.ok(MOODBOARD_COPY[loc].newBoard?.trim(),loc+' newBoard');
  assert.ok(MOODBOARD_COPY[loc].titleLabel?.trim(),loc+' titleLabel');
  assert.ok(MOODBOARD_COPY[loc].create?.trim(),loc+' create');
 }
 assert.match(root,/on:click=\{\(\)=>removeBoard\(board\.id\)\}/);
 assert.match(root,/on:click=\{\(\)=>removeBoard\(selected\.id\)\}/);
 assert.match(root,/data-moodboard-portability-note/);
 assert.match(root,/data-moodboard-atomic-entry/);
});
