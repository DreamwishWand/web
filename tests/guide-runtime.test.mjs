import test from 'node:test';
import assert from 'node:assert/strict';
import {
  cleanGuideText,
  filterGuideViews,
  guideEventView,
  guideQuestView,
  guideDutyGroup,
  guideStarPathView,
  guideSystemView,
  validateGuideRuntime
} from '../src/lib/guide/runtime.js';

import { readFileSync } from 'node:fs';
import { guideCopy } from '../src/lib/guide/copy.js';

const runtime={
  schema:'wand.guide.runtime@1',
  target:{platform:'Nintendo Switch',gameVersion:'1.25.0',buildID:'52BD625D9B4E0053'},
  locales:['EN','FR','IT','DE','ES-ES','JA','ZH-CN','PT-BR'],
  records:{quests:[],starPaths:[],events:[],systems:[],issues:[]}
};

test('Guide runtime pins the exact supported build and required families',()=>{
  assert.equal(validateGuideRuntime(runtime),runtime);
  assert.throws(()=>validateGuideRuntime({...runtime,target:{...runtime.target,buildID:'BAD'}}),/supported v1.25.0 Switch build/);
  assert.throws(()=>validateGuideRuntime({...runtime,records:{...runtime.records,issues:null}}),/missing issues records/);
});

test('Guide cleans locbin presentation markup without rewriting content',()=>{
  assert.equal(cleanGuideText('<nobr>ドリーム</nobr>\u200B<nobr>ライト</nobr>'),'ドリームライト');
  assert.equal(cleanGuideText('Bonjour<nbsp>!'),'Bonjour !');
});

test('Quest titles use current official locale labels',()=>{
  const q=guideQuestView({id:1,titles:['Hello','Bonjour','Ciao','Hallo','Hola','こんにちは','你好','Olá'],status:'Available',category:'Default',steps:1,subSteps:1,objectives:2,guidance:'REVIEW_REQUIRED'},'ja');
  assert.equal(q.title,'こんにちは');
  assert.equal(q.objectives,2);
});

test('Unreviewed Event and System translations fail closed to reviewed English content',()=>{
  const event=guideEventView({name:'Event',all8Reviewed:false,localized:[{title:'English',guidance:'Reviewed'},{title:'Français',guidance:'Draft'}],occurrences:[]},'fr');
  assert.equal(event.title,'English');
  assert.equal(event.localeFallback,true);
  const system=guideSystemView({id:'SYS',title:'English system',summary:'Reviewed',reviewedLocales:['EN'],actions:[],mechanics:[],warnings:[],related:[]},'ja');
  assert.equal(system.localeFallback,true);
  assert.equal(system.title,'English system');
});

test('Guide search stays bounded to decoded public fields',()=>{
  const views=[{key:'1',title:'Quest Alpha',status:'Available'},{key:'2',title:'Quest Beta',status:'Complete'}];
  assert.deepEqual(filterGuideViews(views,'beta').map(x=>x.key),['2']);
  assert.deepEqual(filterGuideViews(views,'1').map(x=>x.key),['1']);
});

test('Star Path reference groups preserve every decoded label, count unresolved tokens, never invent duties',()=>{
  const src=JSON.parse(readFileSync(new URL('../static/ddv/guide/v1.25/runtime.json',import.meta.url),'utf8'));
  const before=JSON.stringify(src.records.starPaths);
  const main=guideStarPathView(src.records.starPaths.find(x=>x.id==='HauntingElegance2026'));
  const ftue=guideStarPathView(src.records.starPaths.find(x=>x.id==='StarPathFTUE'));
  for(const [records,total,visible,unresolved] of [[main.duties,121,121,0],[main.routineDuties,21,0,21],[ftue.duties,15,15,0],[ftue.routineDuties,3,3,0]]){
    const group=guideDutyGroup(records);
    assert.equal(group.total,total); assert.equal(group.labels.length,visible); assert.equal(group.unresolved,unresolved);
    assert.ok(group.labels.every(x=>x&&!x.toLowerCase().startsWith('liveops.')));
    assert.equal(group.labels.length+group.unresolved,group.total);
  }
  assert.deepEqual(guideDutyGroup(ftue.routineDuties).labels,ftue.routineDuties.map(x=>x.label));
  assert.equal(JSON.stringify(src.records.starPaths),before);
  assert.deepEqual(guideDutyGroup([null,{label:42},{label:'  '},{label:'Liveops.X'},{label:'liveops.y'},{label:'<nobr>Readable</nobr>'}]),{total:6,labels:['Readable'],unresolved:5});
  assert.deepEqual(guideDutyGroup(null),{total:0,labels:[],unresolved:0});
  for(const loc of ['en','fr','it','de','es-ES','ja','zh-CN','pt-BR']){
    assert.ok(guideCopy(loc).routineDuties.trim()); assert.ok(guideCopy(loc).unresolvedDutyText.trim());
    assert.notEqual(guideCopy(loc).routineDuties,guideCopy(loc).duties);
  }
});
