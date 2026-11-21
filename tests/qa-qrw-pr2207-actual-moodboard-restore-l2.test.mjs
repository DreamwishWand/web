// QA ONLY NEVER MERGE: actual Svelte restoreBackup consumer L2, fixed PR2207 d3fa.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {
 MOODBOARD_STORAGE_KEY as MAIN,MOODBOARD_BACKUP_KEY as PREVIOUS,
 createEmptyMoodboardDocument,createMoodboard,parseMoodboardDocument,
 serializeMoodboardDocument
} from '../src/lib/moodboards/store.js';
import {persistMoodboardLocalChange} from '../src/lib/moodboards/local-persist-compensated.mjs';

const route=readFileSync(new URL('../src/routes/moodboards/+page.svelte',import.meta.url),'utf8');
const begin=route.indexOf('function restoreBackup(){');
const end=route.indexOf('async function openInWorldEditor()',begin);
assert.ok(begin>=0&&end>begin,'actual unchanged fixed Source restoreBackup function available');
const actualFn=route.slice(begin,end);
assert.match(actualFn,/if\(localStorage\.getItem\(MOODBOARD_STORAGE_KEY\)!==observedRaw\)/);
assert.match(actualFn,/persistMoodboardLocalChange\(localStorage,next,observedRaw\)/);
assert.match(actualFn,/observedRaw=committed;document=next;selectedId=next\.boards\[0\]/);
assert.ok(actualFn.indexOf('observedRaw=committed;')>actualFn.indexOf('persistMoodboardLocalChange('));
assert.doesNotMatch(actualFn,/localStorage\.setItem/);
assert.doesNotMatch(actualFn,/writeSave|upload|fetch\(|GameFavorite|setOwned/);
const stamp='2026-11-18T00:00:00.000Z';
const a=createMoodboard(createEmptyMoodboardDocument(stamp),{title:'Before A'},{now:stamp,idFactory:()=>11}).document;
const b=createMoodboard(a,{title:'After B'},{now:stamp,idFactory:()=>12}).document;
const c=createMoodboard(b,{title:'Different Tab C'},{now:stamp,idFactory:()=>13}).document;
const rawA=serializeMoodboardDocument(a),rawB=serializeMoodboardDocument(b),rawC=serializeMoodboardDocument(c);

function rig({main=rawB,previous=rawA}={}){
 const map=new Map(),writes=[];
 if(main!==null)map.set(MAIN,main);
 if(previous!==null)map.set(PREVIOUS,previous);
 const storage={
  getItem(key){return map.has(key)?map.get(key):null},
  setItem(key,value){writes.push('SET:'+key);map.set(key,String(value));},
  removeItem(key){writes.push('REMOVE:'+key);map.delete(key);}
 };
 const initial=main===null?createEmptyMoodboardDocument(stamp):parseMoodboardDocument(main);
 const env={localStorage:storage,MOODBOARD_STORAGE_KEY:MAIN,MOODBOARD_BACKUP_KEY:PREVIOUS,
  parseMoodboardDocument,persistMoodboardLocalChange,
  __raw:main,__initial:initial,__selected:initial.boards[0]?.id??''};
 const script=[
  "let observedRaw=globalThis.__raw;let document=globalThis.__initial;let selectedId=globalThis.__selected;let status='';",
  "const copy={portableCollision:'COLLISION',noBackup:'NO_BACKUP',invalid:'INVALID',restored:'RESTORED'};",
  actualFn,
  "globalThis.click=()=>restoreBackup();",
  "globalThis.state=()=>({status,observedRaw,selectedId,titles:document.boards.map(x=>x.title)});"
 ].join('\n');
 vm.runInNewContext(script,env);
 return {map,writes,storage,click:()=>env.click(),state:()=>env.state()};
}
function data(s){return {main:s.map.get(MAIN)??null,previous:s.map.get(PREVIOUS)??null}}
function denied(s,old,which='INVALID'){
 assert.equal(s.state().status,which,'actual Svelte must refuse success');
 assert.equal(s.state().observedRaw,rawB,'UI expected raw unchanged on denial');
 assert.equal(JSON.stringify(s.state().titles),JSON.stringify(['Before A','After B']),
   'Svelte displayed document never mutates on denied Restore');
 if(old)assert.deepEqual(data(s),old,'both raw user documents unchanged on compensated failure');
}
let pos=0,neg=0;
{
 const x=rig(),before=data(x);
 x.click();
 assert.equal(x.state().status,'RESTORED');
 assert.equal(x.state().observedRaw,rawA);
 assert.equal(JSON.stringify(x.state().titles),JSON.stringify(['Before A']));
 assert.deepEqual(data(x),{main:rawA,previous:rawB});
 pos++;
 x.click();
 assert.equal(x.state().status,'RESTORED');
 assert.deepEqual(data(x),before);
 assert.equal(JSON.stringify(x.state().titles),JSON.stringify(['Before A','After B']));
 pos++;
}
{
 const currentRaw=' \n'+rawB+' \t';
 const x=rig({main:currentRaw,previous:rawA});
 x.click();
 assert.equal(x.state().status,'RESTORED');
 assert.equal(x.map.get(MAIN),rawA);
 assert.equal(x.map.get(PREVIOUS),currentRaw,'raw Current whitespace is recoverable exactly');
 pos++;
}
{
 const x=rig({previous:null});x.click();
 assert.equal(x.state().status,'NO_BACKUP');assert.equal(x.map.get(MAIN),rawB);
 assert.equal(x.map.has(PREVIOUS),false);assert.equal(x.writes.length,0);neg++;
}
for(const previous of ['{bad','',JSON.stringify({boards:[]})]){
 const x=rig({previous});x.click();
 denied(x,null,previous===''?'NO_BACKUP':'INVALID');
 assert.equal(x.map.get(MAIN),rawB);
 assert.equal(x.map.get(PREVIOUS),previous);
 assert.equal(x.writes.length,0);neg++;
}
{
 const x=rig();x.map.set(MAIN,rawC);const old=data(x);
 x.click();denied(x,null,'COLLISION');assert.deepEqual(data(x),old);
 assert.equal(x.writes.length,0);neg++;
}
{
 const x=rig(),prior=data(x),get=x.storage.getItem.bind(x.storage);
 let mainReads=0;
 x.storage.getItem=k=>{
  const value=get(k);
  if(k===MAIN&&++mainReads===1)x.map.set(MAIN,rawC);
  return value;
 };
 x.click();
 assert.equal(x.state().status,'INVALID');
 assert.equal(x.state().observedRaw,rawB);
 assert.equal(JSON.stringify(x.state().titles),JSON.stringify(['Before A','After B']));
 assert.equal(x.map.get(MAIN),rawC);
 assert.equal(x.map.get(PREVIOUS),prior.previous);
 assert.equal(x.writes.length,0);neg++;
}
{
 const x=rig();x.storage.getItem=()=>{throw Error('STORAGE_UNAVAILABLE')};x.click();
 denied(x,null);assert.equal(x.writes.length,0);neg++;
}
{
 const x=rig(),before=data(x),set=x.storage.setItem.bind(x.storage);
 x.storage.setItem=(k,v)=>{if(k===PREVIOUS)throw Error('BACKUP_QUOTA');set(k,v)};
 x.click();denied(x,before);neg++;
}
{
 const x=rig(),before=data(x),set=x.storage.setItem.bind(x.storage);let first=true;
 x.storage.setItem=(k,v)=>{set(k,v);if(k===PREVIOUS&&first){first=false;throw Error('PARTIAL_BACKUP')}};
 x.click();denied(x,before);neg++;
}
{
 const x=rig(),before=data(x),set=x.storage.setItem.bind(x.storage);
 x.storage.setItem=(k,v)=>{if(k===MAIN)throw Error('PRIMARY_QUOTA');set(k,v)};
 x.click();denied(x,before);neg++;
}
{
 const x=rig(),before=data(x),set=x.storage.setItem.bind(x.storage);let first=true;
 x.storage.setItem=(k,v)=>{set(k,v);if(k===MAIN&&first){first=false;throw Error('PARTIAL_PRIMARY')}};
 x.click();denied(x,before);neg++;
}
{
 const x=rig(),before=data(x),set=x.storage.setItem.bind(x.storage);let first=true;
 x.storage.setItem=(k,v)=>{if(k===PREVIOUS&&first){first=false;return;}set(k,v)};
 x.click();denied(x,before);neg++;
}
{
 const x=rig(),before=data(x),set=x.storage.setItem.bind(x.storage);let first=true;
 x.storage.setItem=(k,v)=>{if(k===MAIN&&first){first=false;return;}set(k,v)};
 x.click();denied(x,before);neg++;
}
{
 const x=rig(),set=x.storage.setItem.bind(x.storage);let count=0;
 x.storage.setItem=(k,v)=>{
  if(k===MAIN&&++count===1){set(k,v);throw Error('POSTWRITE_PRIMARY');}
  if(k===MAIN)throw Error('DENIED_PRIMARY_COMPENSATION');
  set(k,v);
 };
 x.click();denied(x,null);
 assert.equal(x.map.get(PREVIOUS),rawA,'backup restored independently');
 assert.notEqual(x.map.get(MAIN),rawB,'partially mutated main cannot be falsely accepted');
 neg++;
}
{
 const x=rig(),set=x.storage.setItem.bind(x.storage);let main=0,backup=0;
 x.storage.setItem=(k,v)=>{
  if(k===PREVIOUS&&++backup>1)throw Error('DENIED_BACKUP_COMPENSATION');
  if(k===MAIN&&++main===1){set(k,v);throw Error('POSTWRITE_PRIMARY');}
  set(k,v);
 };
 x.click();denied(x,null);
 assert.equal(x.map.get(MAIN),rawB,'main restored even when backup compensation denied');
 assert.notEqual(x.map.get(PREVIOUS),rawA);
 neg++;
}
{
 const x=rig(),set=x.storage.setItem.bind(x.storage);let main=0,backup=0;
 x.storage.setItem=(k,v)=>{
  if(k===PREVIOUS&&++backup>1)throw Error('DENIED_BACKUP_COMPENSATION');
  if(k===MAIN&&++main===1){set(k,v);throw Error('POSTWRITE_PRIMARY');}
  if(k===MAIN)throw Error('DENIED_MAIN_COMPENSATION');
  set(k,v);
 };
 x.click();denied(x,null);
 assert.notEqual(x.map.get(MAIN),rawB);
 assert.notEqual(x.map.get(PREVIOUS),rawA);
 neg++;
}
assert.equal(pos,3);
assert.equal(neg,16);
console.log('QRW2207_ACTUAL_SVELTE_MANUAL_RESTORE_CAS_L2',JSON.stringify({
 positive:pos,negative:neg,sourceRouteBlob:'7dd6d9c1f7e5b395531e4095ad8b0cd67455165d',
 inheritedHelperBlob:'2a43a5d83ffcad4880c0c3b3cb62e7d0443b0c0c',
 actualHostedRestored:'NOT_RUN',encryptedGameSaveWriter:false,twoKeyStorageAtomicity:false
}));
