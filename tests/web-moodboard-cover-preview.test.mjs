import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {moodboardCoverTiles} from '../src/lib/moodboards/cover-preview.mjs';
import {MOODBOARD_COPY} from '../src/lib/moodboards/copy.js';
import {createEmptyMoodboardDocument,createMoodboard,addMoodboardReference,MOODBOARD_REFERENCE_TYPES} from '../src/lib/moodboards/store.js';
const source=readFileSync(new URL('../src/routes/moodboards/+page.svelte',import.meta.url),'utf8');

test('DEC-UX-43: content-only cover is stable, four tiles, no legacy URL/public media',()=>{
 const original={references:[
  {id:'a',type:'ITEM',label:'Autumn Lantern',entityId:'40000048'},
  {id:'b',type:'URL',label:'https://external.example/private',url:'https://external.example/private'},
  {id:'c',type:'WAND_PRESET',label:'Garden layout',entityId:'local:1'},
  {id:'d',type:'NOTE',label:'My idea',note:'  soft    gold   accents  '},
  {id:'e',type:'GALLERY_WORK',label:'Do not publish'},
  {id:'f',type:'ITEM',label:'Fern'}
 ]};
 const initial=moodboardCoverTiles(original);
 assert.deepEqual(initial.map(x=>x.type),['ITEM','WAND_PRESET','NOTE','ITEM']);
 assert.deepEqual(initial.map(x=>x.text),['Autumn Lantern','Garden layout','soft gold accents','Fern']);
 assert.deepEqual(moodboardCoverTiles(original),initial);
 assert.equal(Object.isFrozen(initial),true);
 assert.deepEqual(moodboardCoverTiles({references:[]}).map(x=>x.type),['EMPTY','EMPTY','EMPTY','EMPTY']);
 assert.deepEqual(MOODBOARD_REFERENCE_TYPES,['ITEM','WAND_PRESET','NOTE']);
 assert.ok(initial.every(x=>!x.text.includes('external.example')));
 assert.equal(/https?:\/\/|fetch\(|import\(/.test(readFileSync(new URL('../src/lib/moodboards/cover-preview.mjs',import.meta.url),'utf8')),false);
});

test('DEC-UX-43: accepted local Moodboard store references render deterministic preview without schema change',()=>{
 const original=createEmptyMoodboardDocument('2026-11-18T00:00:00.000Z');
 const b=createMoodboard(original,{title:'Study'},{now:'2026-11-18T00:00:00.000Z',idFactory:()=> 'scope'});
 const n=addMoodboardReference(b.document,b.board.id,{type:'NOTE',label:'Warm light',note:'Pair lanterns with flowers'},{now:'2026-11-18T00:00:00.000Z',idFactory:()=> 'reference'});
 assert.deepEqual(moodboardCoverTiles(n.document.boards[0]).map(t=>t.type),['NOTE','EMPTY','EMPTY','EMPTY']);
 assert.equal(moodboardCoverTiles(n.document.boards[0])[0].text,'Pair lanterns with flowers');
 assert.equal(original.boards.length,0);
});

test('Eight-language management disclosure, target-specific delete and existing backup/World Editor stay intact',()=>{
 assert.equal(Object.keys(MOODBOARD_COPY).length,8);
 for(const locale of ['en','fr','it','de','es-ES','ja','zh-CN','pt-BR'])assert.ok(MOODBOARD_COPY[locale].manage?.trim(),locale);
 assert.match(source,/data-moodboard-root-card/);
 assert.match(source,/data-moodboard-cover aria-hidden="true"/);
 assert.match(source,/data-moodboard-root-menu/);
 assert.match(source,/data-moodboard-workspace-menu/);
 assert.match(source,/moodboardCoverTiles\(board\)/);
 assert.match(source,/on:click=\{\(\)=>removeBoard\(board\.id\)\}/);
 assert.match(source,/on:click=\{\(\)=>removeBoard\(selected\.id\)\}/);
 assert.match(source,/if\(selectedId===boardId\)selectedId=/);
 assert.match(source,/MOODBOARD_BACKUP_KEY/);
 assert.match(source,/exportPortableMoodboard/);
 assert.match(source,/importPortableMoodboard/);
 assert.match(source,/createMoodboardHandoff/);
 assert.doesNotMatch(source,/on:click=\{removeBoard\}/);
});
