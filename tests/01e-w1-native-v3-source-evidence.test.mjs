import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {
  W1_SOURCE_TARGET, W1_NATIVE_STATIC_DEPENDENCIES,
  inspectW1StaticRegistry, describeW1NativeV3Gaps
} from '../src/lib/ddv/timing/w1-native-v3-source-evidence.mjs';

const canonical = new URL('../static/ddv/timing/v1.25.3/recurring-events.json',import.meta.url);
const sourceRefIds = [2010000021,2010000022,2010000024,2010000025,
                      2010000099,2010000121,2010000122,2010000123];
function fixture() {
  const events = sourceRefIds.map((id,i)=>({
    id, name: id===2010000021?'Wood!Wetland_Softwood':'SYNTHETIC_SOURCE',
    eventPolicy:'W1',active:i<4,items:[{id:31700014}]
  }));
  for (let i=0;i<500;i++)events.push({id:900000000+i,name:'unrelated',items:[]});
  return {
    schema:'wand.timing.recurring-registry@1',
    source:{version:'1.25.3',buildId:'9A239D3DB569756D',schema:626,
      rawEventSHA256:W1_SOURCE_TARGET.originalRomfsEventSha256,
      writerAuthorization:false},events
  };
}

test('W1 same-build source event→Softwood only, never Softwood→unique event',()=>{
  const r=inspectW1StaticRegistry(fixture(),{nativeV3Accepted:true,productWriterAuthorized:true});
  assert.equal(r.status,'VERSION_PINNED_REGISTRY_SOURCE_SHAPE_MATCH');
  assert.equal(r.sourceEventToItemMatched,true);
  assert.deepEqual(r.referrerEventIds,sourceRefIds.slice().sort((a,b)=>a-b));
  assert.equal(r.activeReferrerCount,4);
  assert.equal(r.itemIdUniqueProducer,false);
  assert.equal(r.reverseItemIdLookupAuthorized,false);
  assert.equal(r.sourceBlobAuthenticatedByThisFunction,false);
  assert.equal(r.installedBidAuthenticatedByThisFunction,false);
  assert.equal(r.nativeV3Accepted,false);
  assert.equal(r.productWriterAuthorized,false);
  assert.equal(r.automaticDateRepairAuthorized,false);
});

test('source only evidence never upgrades Native Grid/Clock or edited-copy capability',()=>{
  const w=describeW1NativeV3Gaps(inspectW1StaticRegistry(fixture()));
  assert.equal(w.status,'NATIVE_V3_OUTSTANDING');
  assert.equal(w.nativeV3Accepted,false);
  assert.equal(w.editedCopyAuthorized,false);
  assert.equal(w.productWriterAuthorized,false);
  assert.deepEqual(w.changesCurrentlyAuthorized,[]);
  assert.deepEqual(w.changedFieldsAllowedIfSeparatelyAccepted,
    ['/World/RecurringEvents/155/ItemSpawning/NextOccurrence']);
  assert.ok(w.requiredSourceClosures.includes('ACTUAL_SOFTWOOD_OWNER_GROUP_QUOTA_NOT_ITEMID_REVERSE_LOOKUP'));
  assert.ok(w.requiredNativeOutcomes.includes('LAST_OCCURRENCE_TO_RESCHEDULE_NEXT_AND_COLD_SAVE_REOPEN'));
  assert.equal(W1_NATIVE_STATIC_DEPENDENCIES.evidenceClass,'SOURCE_ONLY');
  assert.equal(W1_NATIVE_STATIC_DEPENDENCIES.basicMaximum,8);
  assert.equal(W1_NATIVE_STATIC_DEPENDENCIES.villageAreaType,1);
  assert.equal(W1_NATIVE_STATIC_DEPENDENCIES.overdueMaximumSeconds,480*Math.floor(8/1));
});

test('mismatched version/BID/schema/ROMFS source and simulated Writer flag fail closed',()=>{
  for (const [k,value] of [
    ['version','1.25.0'],['buildId','52BD625D9B4E0053'],
    ['schema',624],['rawEventSHA256','0'.repeat(64)],['writerAuthorization',true]
  ]){
    const d=fixture();d.source[k]=value;
    assert.equal(inspectW1StaticRegistry(d).status,'SOURCE_UNAVAILABLE',k);
  }
});

test('event/map identity collision and missing source referrer fail closed',()=>{
  const cases=[
    d=>{d.events[0].id=2010000022;},
    d=>{d.events[0].items[0].id=31700015;},
    d=>{d.events[1].items=[];},
    d=>{d.events[0].active=false;},
    d=>{d.events[0].eventPolicy='OTHER';},
    d=>{d.events[0].name='OtherArea';},
    d=>{d.events[1].id=d.events[2].id;},
    d=>{d.events.pop();}
  ];
  for(const patch of cases){const d=fixture();patch(d);
    const result=inspectW1StaticRegistry(d);
    assert.equal(result.status,'SOURCE_UNAVAILABLE');
    assert.equal(result.productWriterAuthorized,false);
    assert.equal(describeW1NativeV3Gaps(result).nativeV3Accepted,false);
  }
});

test('missing/forged source, fake Native receipt and unknown values cannot authorize',()=>{
  for(const x of [null,[],{}, {status:'VERSION_PINNED_REGISTRY_SOURCE_SHAPE_MATCH',sourceEventToItemMatched:true}]){
    assert.equal(describeW1NativeV3Gaps(x).productWriterAuthorized,false);
  }
  assert.equal(inspectW1StaticRegistry({}).status,'SOURCE_UNAVAILABLE');
  assert.equal(inspectW1StaticRegistry(fixture(),{nativeRuntimeObserved:true}).nativeClockAndColdLoadObserved,false);
});

test('canonical Git-tracked 508-event source corpus is unchanged', {
  skip:!existsSync(canonical) && 'canonical registry unavailable in isolated local test (present in repository CI)'
},()=>{
  const bytes=readFileSync(canonical);
  const blob=createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
  assert.equal(blob,W1_SOURCE_TARGET.staticRegistryGitBlob);
  const data=JSON.parse(bytes.toString('utf8'));
  const r=inspectW1StaticRegistry(data);
  assert.equal(r.status,'VERSION_PINNED_REGISTRY_SOURCE_SHAPE_MATCH');
  assert.equal(r.referrerEventIds.length,8);
  assert.equal(r.nativeV3Accepted,false);
});
