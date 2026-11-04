import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectW1SavedClockSource,W1_SAVED_CLOCK_SOURCE_CONTRACT} from '../src/lib/ddv/timing/w1-saved-clock-source-readonly.mjs';

// INDEPENDENT 05 QR-C PR506 NEW-ONLY. Synthetic already decoded source objects;
// there is NO genuine private P1G, Native producer, Game Clock or Writer here.
const ctx={platform:'Nintendo Switch',gameVersion:'1.25.3',
  bid:'9A239D3DB569756D',schema:626,
  sourceSha256:'c'.repeat(64),sourceRevision:'qa-untrusted-626-source'};
function profile(){return {GameInfo:{Version:626},World:{RecurringEvents:{
  '155':{ItemSpawning:{RecurringEventItemID:2010000021,
    NextOccurrence:'2126-08-20T00:00:00Z',
    LastOccurrence:'2026-11-05T00:00:00Z',EndDate:null}}
}}};}
const inspect=p=>inspectW1SavedClockSource(p,ctx);
const allOff=r=>{
  for(const flag of [
    'sourceIdentityAuthenticated','coreRevisionCasVerified',
    'nativeClockActualizeVerified','nativeExecuteAcceptedVerified',
    'nativeLastToNextVerified','nativeColdLoadVerified','nativeV3Accepted',
    'productWriterAuthorized','productEditedCopyAuthorized',
    'originalOverwriteAuthorized','automatic2126RepairAuthorized'
  ])assert.equal(r[flag],false,flag);
};

test('plain deterministic strict-decoded 626 clock remains source-only; 2126 and null unchanged',()=>{
  const p=JSON.parse(JSON.stringify(profile()));const before=JSON.stringify(p);
  const r=inspect(p);
  assert.equal(r.contract,W1_SAVED_CLOCK_SOURCE_CONTRACT);
  assert.equal(r.status,'SAVED_W1_CLOCK_SOURCE_FIELDS_ONLY');
  assert.equal(r.rawNextUtc,'2126-08-20T00:00:00Z');
  assert.equal(r.rawEndDateUtc,null);
  assert.equal(r.rawEndDateIsNull,true);
  assert.equal(r.savedClockFieldsObserved,true);
  allOff(r);
  assert.equal(JSON.stringify(p),before);
});

test('untrusted inherited RecurringEventItemID cannot stand in for a serialized own field',()=>{
  const p=profile(),e=p.World.RecurringEvents['155'];
  const inherited=Object.create({RecurringEventItemID:2010000021});
  Object.assign(inherited,{
    NextOccurrence:'2126-08-20T00:00:00Z',
    LastOccurrence:'2026-11-05T00:00:00Z',EndDate:null
  });
  assert.equal(Object.hasOwn(inherited,'RecurringEventItemID'),false);
  e.ItemSpawning=inherited;
  const r=inspect(p);
  // Without an own ID, a genuine serialized Source cannot prove this EventID.
  assert.equal(r.status,'SOURCE_CLOCK_REFERENCE_REJECTED');
  allOff(r);
});

test('a changing NextOccurrence getter cannot pass UTC validation then return unvalidated raw clock',()=>{
  const p=profile(),event=p.World.RecurringEvents['155'].ItemSpawning;
  let accesses=0;
  Object.defineProperty(event,'NextOccurrence',{enumerable:true,configurable:true,
    get(){return ++accesses===1?'2126-08-20T00:00:00Z':'NOT_A_VALID_UTC';}
  });
  const r=inspect(p);
  assert.equal(r.status,'SOURCE_CLOCK_REFERENCE_REJECTED',
    'a source clock witness must not validate one value and emit another');
  allOff(r);
});

test('a changing EndDate getter cannot claim present null while returning bad raw clock and disagreeing flags',()=>{
  const p=profile(),event=p.World.RecurringEvents['155'].ItemSpawning;
  let accesses=0;
  Object.defineProperty(event,'EndDate',{enumerable:true,configurable:true,
    get(){return ++accesses===1?null:'not-a-valid-end-date';}
  });
  const r=inspect(p);
  assert.equal(r.status,'SOURCE_CLOCK_REFERENCE_REJECTED');
  allOff(r);
});

test('a hidden second own oneof cannot silently pass uniqueness through Object.entries filtering',()=>{
  const p=profile(),record=p.World.RecurringEvents['155'];
  Object.defineProperty(record,'AnotherSpawning',{enumerable:false,
    value:{RecurringEventItemID:2010000042,NextOccurrence:'2026-11-05T00:00:00Z'}});
  assert.deepEqual(Object.keys(record),['ItemSpawning']);
  assert.equal(Reflect.ownKeys(record).length,2);
  const r=inspect(p);
  assert.equal(r.status,'SOURCE_CLOCK_REFERENCE_REJECTED');
  allOff(r);
});

test('even plausible but reversed Last/Next ordering is never certified as Native scheduler truth',()=>{
  const p=profile(),e=p.World.RecurringEvents['155'].ItemSpawning;
  e.NextOccurrence='2026-11-05T00:00:00.012345678Z';
  e.LastOccurrence='2126-08-20T00:00:00Z';
  const r=inspect(p);
  assert.equal(r.status,'SAVED_W1_CLOCK_SOURCE_FIELDS_ONLY');
  assert.equal(r.rawNextUtc,e.NextOccurrence);
  assert.equal(r.rawLastUtc,e.LastOccurrence);
  assert.equal(r.temporalOrderVerifiedByNative,false);
  allOff(r);
});
