import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  WAND_TIMING_SWITCH_BID, validateTimekeeperRegistry, projectRecurringEventsReadonly,
  filterRecurringEventsReadonly
} from '../src/lib/timing/recurring-readonly.mjs';
const registry = JSON.parse(readFileSync(new URL('../static/ddv/timing/v1.25.3/recurring-events.json',import.meta.url),'utf8'));
const fixture=()=>({GameInfo:{Version:626},World:{RecurringEvents:{
 '155':{ItemSpawning:{RecurringEventItemID:2010000021,NextOccurrence:'2126-08-20T00:00:00Z',LastOccurrence:'2026-08-20T00:00:00Z'}},
 '8':{ItemSpawning:{RecurringEventItemID:2010000003,NextOccurrence:'2026-11-03T08:00:00Z'}}
}}});
test('Timekeeper fixed registry has 508 events and full all-linked 489 item entries',()=>{
 const byId=validateTimekeeperRegistry(registry);
 assert.equal(byId.size,508);
 assert.equal(registry.source.buildId,WAND_TIMING_SWITCH_BID);
 assert.equal(byId.get(2010000003).items.length,4);
 assert.equal(byId.get(2010000021).items[0].id,31700014);
});
test('read-only view separates saved map key / EventID / ItemID and preserves 2126',()=>{
 const source=fixture(),before=JSON.stringify(source);
 const res=projectRecurringEventsReadonly(source,registry);
 assert.equal(res.writerAuthorized,false);
 assert.equal(res.encodeCopyAuthorized,false);
 assert.equal(res.savedContainerCount,2);
 assert.equal(res.rows.length,2);
 const softwood=res.rows.find(x=>x.eventId===2010000021);
 assert.equal(softwood.mapKey,'155');
 assert.equal(softwood.sourcePointer,'/World/RecurringEvents/155/ItemSpawning/NextOccurrence');
 assert.equal(softwood.items[0].itemId,31700014);
 assert.equal(softwood.nextOccurrence,'2126-08-20T00:00:00Z');
 assert.equal(softwood.editable,false);
 assert.equal(res.rows.find(x=>x.eventId===2010000003).items.length,4);
 assert.deepEqual(filterRecurringEventsReadonly(res.rows,'31300006').map(x=>x.eventId),[2010000003]);
 assert.deepEqual(filterRecurringEventsReadonly(res.rows,'31700014').map(x=>x.eventId),[2010000021]);
 assert.equal(JSON.stringify(source),before);
});
test('schema or fake build registry fails closed without writer',()=>{
 assert.throws(()=>projectRecurringEventsReadonly({...fixture(),GameInfo:{Version:624}},registry),/SCHEMA626_MAP_REQUIRED/);
 assert.throws(()=>validateTimekeeperRegistry({...registry,source:{...registry.source,buildId:'UNVERIFIED'}}),/REGISTRY_SOURCE_MISMATCH/);
 assert.throws(()=>validateTimekeeperRegistry({...registry,source:{...registry.source,writerAuthorization:true}}),/REGISTRY_SOURCE_MISMATCH/);
 const source=fixture();
 source.World.RecurringEvents['155'].UnknownVariant={NextOccurrence:'2026-01-01T00:00:00Z'};
 const res=projectRecurringEventsReadonly(source,registry);
 assert.equal(res.rows.find(x=>x.mapKey==='155'&&x.oneof==='ItemSpawning').ambiguous,true);
});
