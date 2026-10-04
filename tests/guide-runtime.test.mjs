import test from 'node:test';
import assert from 'node:assert/strict';
import {
  cleanGuideText,
  filterGuideViews,
  guideEventView,
  guideQuestView,
  guideSystemView,
  validateGuideRuntime
} from '../src/lib/guide/runtime.js';

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
