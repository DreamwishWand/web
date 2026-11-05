import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  GUIDE_PRIMARY_MECHANIC_BRIDGE_REVISION,
  GUIDE_PRIMARY_MECHANIC_GROUPS,
  canonicalGuideGroupForPrimaryMechanic,
  primaryMechanicCandidatesForCanonicalGuideGroup,
  canonicalGuideCategoryForGroup
} from '../src/lib/guide/systems-primary-mechanic-bridge.mjs';

const cats=[
 ['basics-progression-settings',['play-basics','progression-duties','settings-saves-dlc'],[6,6,4]],
 ['exploration-travel-tools',['worlds-unlocks','maps-fast-travel','tools-obstacles'],[4,2,7]],
 ['villagers-companions-mounts',['villagers-friendship','critters-companions','mounts-abilities'],[7,2,4]],
 ['gathering-cooking-crafting',['gathering-farming','timebending-gathering','cooking-crafting-conversion','machines-automation'],[9,1,5,6]],
 ['inventory-collections-shops',['inventory-storage-collection','currencies-shops-purchases','mail-rewards-codes'],[5,10,2]],
 ['decorating-customization',['placement-building-housing','wardrobe-touch-of-magic','native-presets-reuse'],[7,3,4]],
 ['photography-social-activities',['photos-dreamsnaps','social-challenges-minigames'],[5,7]]
];

test('owner seven categories, 21 canonical PR133 group identities and all 106 exact primary topic candidate assignments',()=>{
 assert.equal(GUIDE_PRIMARY_MECHANIC_BRIDGE_REVISION,'wand.guide.systems.primary-keys@2026-10-24');
 assert.equal(GUIDE_PRIMARY_MECHANIC_GROUPS.length,21);
 let index=0;
 const all=[];
 for(const [categoryId,groupIds,counts] of cats){
  for(let i=0;i<groupIds.length;i++){
   const row=GUIDE_PRIMARY_MECHANIC_GROUPS[index++];
   assert.equal(row.categoryId,categoryId);
   assert.equal(row.groupId,groupIds[i]);
   assert.equal(row.primaryMechanicKeys.length,counts[i]);
   assert.equal(canonicalGuideCategoryForGroup(row.groupId),categoryId);
   assert.deepEqual(primaryMechanicCandidatesForCanonicalGuideGroup(row.groupId),row.primaryMechanicKeys);
   assert.ok(Object.isFrozen(row)&&Object.isFrozen(row.primaryMechanicKeys));
   all.push(...row.primaryMechanicKeys);
  }
 }
 assert.deepEqual(cats.map(x=>x[2].reduce((a,b)=>a+b,0)),[16,13,13,21,17,14,12]);
 assert.equal(all.length,106);
 assert.equal(new Set(all).size,106,'each primary candidate belongs to only one canonical group');
 assert.ok(all.every(x=>/^[a-z][a-z0-9_]*$/.test(x)),'internal topic keys are allowlisted—not URL paths or native IDs');
});

test('critical cross-domain taxonomy boundaries remain distinct and unknowns fail closed',()=>{
 for(const [key,group] of [
  ['cloud_cross_save','settings-saves-dlc'],
  ['premium_dlc_entitlements','settings-saves-dlc'],
  ['expansion_adventure_access','worlds-unlocks'],
  ['timebending','timebending-gathering'],
  ['snippets_lorekeeper','inventory-storage-collection'],
  ['roads_fences','placement-building-housing'],
  ['dreamsnaps','photos-dreamsnaps'],
  ['dreamsnaps_voting','photos-dreamsnaps']
 ]){
  assert.equal(canonicalGuideGroupForPrimaryMechanic(key),group,key);
 }
 for(const key of ['__proto__','constructor','toString','<script>alert(1)</script>','/guide/systems','../../private','unknown-key','unknown_native_id',null,{},0]){
  assert.equal(canonicalGuideGroupForPrimaryMechanic(key),null,String(key));
 }
 for(const group of ['constructor','__proto__','no-such-group',null,{}]){
  assert.deepEqual(primaryMechanicCandidatesForCanonicalGuideGroup(group),[]);
  assert.equal(canonicalGuideCategoryForGroup(group),null);
 }
});

test('new metadata does not introduce a second Guide Systems public contract, UI, Native reader, publisher or Writer',()=>{
 const contents=readFileSync(new URL('../src/lib/guide/systems-primary-mechanic-bridge.mjs',import.meta.url),'utf8');
 for(const bad of [
  'APPROVED_SYSTEM_PAGES =','export const SYSTEM_CATEGORIES','export const GUIDE_SYSTEMS_CATEGORIES',
  'SYSTEMS_PUBLIC_SCHEMA =','SYSTEMS_PUBLIC_PATH =',
  'publicationApproved: true','rightsApproved: true','publicApprovedCount:45',
  'fetch(', 'publishWork(', 'writeSave(', 'upload(', 'indexedDB', 'service_role', '<img', 'NativeObjectID'
 ]) assert.equal(contents.includes(bad),false,bad+' must remain absent');
 assert.match(contents,/NEVER Native Save ObjectIDs/);
 assert.match(contents,/ddv\.guide\.systems-public@1 manifest \(0\/45 approved\)/);
 assert.match(contents,/groupIndex = new Map/);
 assert.match(contents,/keyIndex = new Map/);
});
