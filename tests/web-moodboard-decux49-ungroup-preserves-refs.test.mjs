import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {MOODBOARD_COPY} from '../src/lib/moodboards/copy.js';
import {
  createEmptyMoodboardDocument, createMoodboard, createMoodboardGroup,
  addMoodboardReference, deleteMoodboardGroup,
  moodboardSections, parseMoodboardDocument, serializeMoodboardDocument
} from '../src/lib/moodboards/store.js';
const source=readFileSync(new URL('../src/routes/moodboards/+page.svelte',import.meta.url),'utf8');
const STAMP='2026-11-18T00:00:00.000Z';
const id=name=>()=>name;

function fixture(){
 let doc=createMoodboard(createEmptyMoodboardDocument(STAMP),{title:'Garden'}, {now:STAMP,idFactory:id('board')}).document;
 const board=doc.boards[0].id;
 const groups={};
 for(const name of ['Garden','Kitchen']){
  const r=createMoodboardGroup(doc,board,name,{now:STAMP,idFactory:id(name)});
  doc=r.document;groups[name]=r.group.id;
 }
 const refs=[
  {type:'ITEM',label:'Plant',entityId:'40000047',groupIds:[groups.Garden]},
  {type:'WAND_PRESET',label:'Terrace',entityId:'preset_123',groupIds:[groups.Garden,groups.Kitchen]},
  {type:'NOTE',label:'Greens',note:'Arrange plants near path',groupIds:[groups.Garden]},
  {type:'NOTE',label:'Cozy',note:'Warm morning',groupIds:[groups.Kitchen]}
 ];
 for(let i=0;i<refs.length;i++){
  const r=addMoodboardReference(doc,board,refs[i],{now:STAMP,idFactory:id('ref'+i)});
  doc=r.document;
 }
 return {doc,board,groups};
}

test('DEC-UX-49: removing Garden only leaves ITEM/PRESET/NOTE canonical references and other group intact',()=>{
 const {doc,board,groups}=fixture();
 const previous=serializeMoodboardDocument(doc);
 const next=deleteMoodboardGroup(doc,board,groups.Garden,{deleteExclusiveContents:false,now:STAMP});
 assert.deepEqual(next.boards[0].groups.map(x=>x.id),[groups.Kitchen]);
 assert.equal(next.boards[0].references.length,4,'no group-exclusive item or Note may be deleted');
 const byLabel=Object.fromEntries(next.boards[0].references.map(r=>[r.label,r]));
 assert.deepEqual(byLabel.Plant.groupIds,[]);
 assert.deepEqual(byLabel.Greens.groupIds,[]);
 assert.deepEqual(byLabel.Terrace.groupIds,[groups.Kitchen],'shared reference stays in surviving group exactly once');
 assert.deepEqual(byLabel.Cozy.groupIds,[groups.Kitchen]);
 assert.equal(moodboardSections(next.boards[0]).find(x=>x.kind==='UNSORTED').references.length,2);
 assert.equal(serializeMoodboardDocument(doc),previous,'input must remain immutable');
 assert.deepEqual(parseMoodboardDocument(previous,STAMP),doc,'previous snapshot can be independently reopened');
 assert.throws(()=>deleteMoodboardGroup(next,board,groups.Garden),/Unknown Moodboard Group/,'stale target must reject');
});

test('DEC-UX-49: current UI is explicitly non-destructive, 44px accessible, and preserves existing backup and data controls',()=>{
 assert.match(source,/deleteMoodboardGroup,/);
 assert.match(source,/function ungroup\(groupId:string\)/);
 assert.match(source,/selected\.groups\.some\(\(group:any\)=>group\.id===groupId\)/);
 assert.match(source,/deleteMoodboardGroup\(document,selected\.id,groupId,\{deleteExclusiveContents:false\}\)/);
 assert.match(source,/data-moodboard-ungroup=\{section\.id\}/);
 assert.match(source,/aria-label=\{copy\.ungroup\+': '\+section\.title\}/);
 assert.match(source,/section\.kind==='GROUP'/);
 assert.doesNotMatch(source,/deleteExclusiveContents:true/);
 assert.match(source,/\.group-actions button\{[^}]*min-height:44px/);
 assert.match(source,/localStorage\.setItem\(MOODBOARD_BACKUP_KEY,current\)/);
 assert.match(source,/localStorage\.setItem\(MOODBOARD_STORAGE_KEY,serializeMoodboardDocument\(next\)\)/);
 assert.match(source,/exportPortableMoodboard/);
 assert.match(source,/importPortableMoodboard/);
 assert.match(source,/createMoodboardHandoff/);
});

test('DEC-UX-49: all eight locale labels distinguish Group container removal from reference deletion',()=>{
 assert.deepEqual(Object.keys(MOODBOARD_COPY).sort(),['en','fr','it','de','es-ES','ja','zh-CN','pt-BR'].sort());
 for(const [loc,copy] of Object.entries(MOODBOARD_COPY)){
  assert.ok(copy.ungroup.length>7,loc);
  assert.notEqual(copy.ungroup,copy.remove);
  assert.notEqual(copy.ungroup,copy.delete);
  assert.ok(copy.ungroup.includes('(')||copy.ungroup.includes('（'),loc+' non-destructive copy');
 }
});
