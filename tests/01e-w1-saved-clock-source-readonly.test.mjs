import test from 'node:test';
import assert from 'node:assert/strict';
import {
  W1_SAVED_CLOCK_SOURCE_CONTRACT,inspectW1SavedClockSource
} from '../src/lib/ddv/timing/w1-saved-clock-source-readonly.mjs';
const context=Object.freeze({platform:'Nintendo Switch',gameVersion:'1.25.3',
  bid:'9A239D3DB569756D',schema:626,
  sourceSha256:'a'.repeat(64),sourceRevision:'untrusted-rev-1'});
const fixture=()=>({GameInfo:{Version:626},World:{RecurringEvents:{
  '155':{ItemSpawning:{RecurringEventItemID:2010000021,
    LastOccurrence:'2026-08-20T00:00:00Z',
    NextOccurrence:'2126-08-20T00:00:00Z',EndDate:null}},
  '42':{ItemSpawning:{RecurringEventItemID:2010000042,
    NextOccurrence:'2026-11-05T00:00:00Z'}}
}}});
const inspect=profile=>inspectW1SavedClockSource(profile,context);
const denied=result=>{
  assert.equal(result.status,'SOURCE_CLOCK_REFERENCE_REJECTED');
  assert.equal(result.nativeV3Accepted,false);
  assert.equal(result.nativeClockActualizeVerified,false);
  assert.equal(result.productWriterAuthorized,false);
  assert.equal(result.automatic2126RepairAuthorized,false);
};
test('source-only W1 fields retain intentional year2126 and present EndDate:null byte-lexemes',()=>{
  const p=fixture(),before=JSON.stringify(p),r=inspect(p);
  assert.equal(r.contract,W1_SAVED_CLOCK_SOURCE_CONTRACT);
  assert.equal(r.status,'SAVED_W1_CLOCK_SOURCE_FIELDS_ONLY');
  assert.equal(r.rawNextUtc,'2126-08-20T00:00:00Z');
  assert.equal(r.rawLastUtc,'2026-08-20T00:00:00Z');
  assert.equal(r.rawEndDateUtc,null);
  assert.equal(r.rawEndDateIsNull,true);
  assert.equal(r.eventId,2010000021);
  assert.equal(r.mapKey,'155');
  assert.equal(r.nextPointer,'/World/RecurringEvents/155/ItemSpawning/NextOccurrence');
  assert.equal(JSON.stringify(p),before);
  assert.equal(Object.isFrozen(r),true);
  for(const k of ['sourceIdentityAuthenticated','coreRevisionCasVerified',
    'temporalOrderVerifiedByNative','nativeClockActualizeVerified',
    'nativeExecuteAcceptedVerified','nativeLastToNextVerified',
    'nativeColdLoadVerified','nativeV3Accepted','productWriterAuthorized',
    'productEditedCopyAuthorized','originalOverwriteAuthorized',
    'automatic2126RepairAuthorized'])assert.equal(r[k],false,k);
});
test('wrong version, external BID/schema and forged source hints fail closed',()=>{
  for(const [key,value] of [['platform','Steam'],['gameVersion','1.25.0'],
    ['bid','52BD625D9B4E0053'],['schema',624],['sourceSha256','forged'],
    ['sourceRevision','']])denied(inspectW1SavedClockSource(fixture(),{...context,[key]:value}));
  const p=fixture();p.GameInfo.Version=624;denied(inspect(p));
});
test('map key 155 / exact oneof / EventID must match, no item reverse lookup',()=>{
  const edits=[
    p=>{p.World.RecurringEvents['156']=p.World.RecurringEvents['155'];delete p.World.RecurringEvents['155'];},
    p=>{p.World.RecurringEvents['155'].ItemSpawning.RecurringEventItemID=31700014;},
    p=>{p.World.RecurringEvents['155'].ItemSpawning.RecurringEventItemID=2010000022;},
    p=>{p.World.RecurringEvents['155'].FlowerSpawning={NextOccurrence:'2026-10-01T00:00:00Z'};},
    p=>{p.World.RecurringEvents['155']={OtherSpawning:{NextOccurrence:'2026-10-01T00:00:00Z'}};},
    p=>{p.World.RecurringEvents['155']=null;}
  ];
  for(const edit of edits){const p=fixture();edit(p);denied(inspect(p));}
});
test('a second oneof without NextOccurrence still makes Native source identity ambiguous',()=>{
  for(const extra of [
    {RecurringEventItemID:2010000022},
    {RecurringEventItemID:2010000022,LastOccurrence:'2026-01-01T00:00:00Z'},
    null,
    [],
    0
  ]){
    const p=fixture(), container=p.World.RecurringEvents['155'];
    container.UnknownSpawning=extra;
    const r=inspect(p);
    denied(r);
    assert.equal(r.reason,'SAVED_EVENT_ONEOF_AMBIGUOUS_OR_UNSUPPORTED');
  }
  const p=fixture();
  p.World.RecurringEvents['155'].ItemSpawning.NextOccurrence='2126-08-20T00:00:00Z';
  assert.equal(inspect(p).status,'SAVED_W1_CLOCK_SOURCE_FIELDS_ONLY');
});
test('invalid UTC calendars and absent or non-nullable raw fields fail closed',()=>{
  const invalid=['2026-02-29T00:00:00Z','2126-13-01T00:00:00Z',
    '2126-01-01T24:00:00Z','2126-01-01T00:60:00Z',
    '2126-01-01T00:00:60Z','2126-01-01T00:00:00+09:00',
    '0000-01-01T00:00:00Z','not-a-date',123,null];
  for(const field of ['NextOccurrence','LastOccurrence'])for(const value of invalid){
    const p=fixture();p.World.RecurringEvents['155'].ItemSpawning[field]=value;denied(inspect(p));
  }
  for(const field of ['NextOccurrence','LastOccurrence','EndDate']){
    const p=fixture();delete p.World.RecurringEvents['155'].ItemSpawning[field];denied(inspect(p));
  }
  for(const value of [false,{},[],123,'2126-02-30T00:00:00Z']){
    const p=fixture();p.World.RecurringEvents['155'].ItemSpawning.EndDate=value;denied(inspect(p));
  }
});
test('Gregorian leap date/fractional lexemes are preserved without normalization or Native inference',()=>{
  const p=fixture(),e=p.World.RecurringEvents['155'].ItemSpawning;
  e.NextOccurrence='2128-02-29T23:59:59.123456789Z';
  e.LastOccurrence='2024-02-29T00:00:00.1Z';
  e.EndDate='2130-12-31T00:00:00Z';
  const r=inspect(p);
  assert.equal(r.status,'SAVED_W1_CLOCK_SOURCE_FIELDS_ONLY');
  assert.equal(r.rawNextUtc,e.NextOccurrence);
  assert.equal(r.rawLastUtc,e.LastOccurrence);
  assert.equal(r.rawEndDateUtc,e.EndDate);
  assert.equal(r.rawEndDateIsNull,false);
  assert.equal(r.nativeLastToNextVerified,false);
});
test('untrusted caller Native/Writer/clock assertions never produce permission',()=>{
  const p=fixture();p.NativeV3Accepted=true;p.productWriterAuthorized=true;
  const r=inspectW1SavedClockSource(p,{...context,
    sourceIdentityAuthenticated:true,coreRevisionCasVerified:true,
    nativeClockActualizeVerified:true,productWriterAuthorized:true});
  assert.equal(r.status,'SAVED_W1_CLOCK_SOURCE_FIELDS_ONLY');
  assert.equal(r.sourceIdentityAuthenticated,false);
  assert.equal(r.coreRevisionCasVerified,false);
  assert.equal(r.nativeClockActualizeVerified,false);
  assert.equal(r.nativeExecuteAcceptedVerified,false);
  assert.equal(r.productWriterAuthorized,false);
});
