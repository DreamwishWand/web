// 04 QR-W / PR562 NEW-only independent verification. No unapproved Guide copy or real Save.
import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {
 GUIDE_PRIMARY_MECHANIC_BRIDGE_REVISION,GUIDE_PRIMARY_MECHANIC_GROUPS,
 canonicalGuideGroupForPrimaryMechanic,primaryMechanicCandidatesForCanonicalGuideGroup,
 canonicalGuideCategoryForGroup
} from '../src/lib/guide/systems-primary-mechanic-bridge.mjs';

const MAIN='bd2edd00d029f866986aff96435615218398f991';
const SOURCE='ca1e09ccd803bcddc56310f23027cfff0b675c57';
const srcPaths=[
 '.github/workflows/web-guide-systems-primary-bridge.yml',
 'src/lib/guide/systems-primary-mechanic-bridge.mjs',
 'tests/web-guide-systems-primary-mechanic-bridge.test.mjs'
].sort();
const qaPaths=[
 '.github/workflows/04qr-w-pr562-guide-bridge-independent.yml',
 'tests/04qr-w-pr562-guide-bridge-independent.test.mjs'
].sort();
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
// Independent fixed witnesses: canonical 7/21 IDs from PR133 catalog Git blob
// b37996f4544fcd736b44d888aee4daec585e7178, primary keys from PR547
// Git blob c872c967de6cc62b8555b4aeb7744838ed524be1 and Owner 2026-10-24 taxonomy.
// This is an exact per-key oracle, NOT a duplicate production category model.
const expected=[
 ['basics-progression-settings','play-basics','quest_progression activity_tracking energy energy_rewards sprint real_time_sync'],
 ['basics-progression-settings','progression-duties','dreamlight_duties dreamlight_duty_reroll star_paths star_path_duties star_path_rewards events_event_board'],
 ['basics-progression-settings','settings-saves-dlc','cloud_cross_save premium_dlc_entitlements gameplay_control_settings accessibility_settings'],
 ['exploration-travel-tools','worlds-unlocks','realms biome_world_access floating_islands expansion_adventure_access'],
 ['exploration-travel-tools','maps-fast-travel','map_world_travel fast_travel'],
 ['exploration-travel-tools','tools-obstacles','royal_tools fishing_rod pickaxe_tool shovel_tool watering_can camera_tool obstacle_clearing'],
 ['villagers-companions-mounts','villagers-friendship','character_unlocks friendship hangout_roles npc_schedules best_friends dream_styles cheshire_hangout'],
 ['villagers-companions-mounts','critters-companions','critter_feeding companions'],
 ['villagers-companions-mounts','mounts-abilities','mounts mount_bonding mount_gear_customization mount_abilities'],
 ['gathering-cooking-crafting','gathering-farming','gardening crops fruit_trees flowers fishing mining foraging moana_boat walle_garden'],
 ['gathering-cooking-crafting','timebending-gathering','timebending'],
 ['gathering-cooking-crafting','cooking-crafting-conversion','cooking restaurant_orders crafting uncrafting timebending_station_transmute'],
 ['gathering-cooking-crafting','machines-automation','ancient_machines ancient_auto_cooker ancient_gardener ancient_vacuum slow_cooker bee_house'],
 ['inventory-collections-shops','inventory-storage-collection','inventory_backpack storage_containers collection memories snippets_lorekeeper'],
 ['inventory-collections-shops','currencies-shops-purchases','dreamlight_resource currencies_resources scrooge_store selling_stalls premium_shop star_coin mist_resource storybook_magic_resource daisy_coin moonstones'],
 ['inventory-collections-shops','mail-rewards-codes','mailbox_rewards campaign_codes'],
 ['decorating-customization','placement-building-housing','decorating_mode furniture_placement top_down_camera landscaping roads_fences player_house_rooms moving_houses'],
 ['decorating-customization','wardrobe-touch-of-magic','touch_of_magic_clothing touch_of_magic_furniture avatar_wardrobe_customization'],
 ['decorating-customization','native-presets-reuse','native_decoration_presets decoration_group_mode blueprints boutique_displays'],
 ['photography-social-activities','photos-dreamsnaps','photo_mode photo_poses_emotes dreamsnaps dreamsnaps_submission_requirements dreamsnaps_voting'],
 ['photography-social-activities','social-challenges-minigames','multiplayer_valley_visits boutique_challenges scramblecoin quest_puzzles exhibition obstacle_course bridge_game']
].map(([category,group,keys])=>({category,group,keys:keys.split(' ')}));

test('frozen Source/head: exactly 3 metadata files plus independent QA-only 2 files, no route/manifest/rights mutation',()=>{
 assert.equal(git('merge-base',MAIN,SOURCE),MAIN);
 assert.deepEqual(git('diff','--name-only',MAIN,SOURCE).split('\n').sort(),srcPaths);
 assert.deepEqual(git('diff','--name-only',SOURCE,'HEAD').split('\n').sort(),qaPaths);
 const blobs={
  'src/lib/guide/systems-primary-mechanic-bridge.mjs':'59fe25e9746bf4dd1a5a19d690f6512aa49c8dfc',
  'tests/web-guide-systems-primary-mechanic-bridge.test.mjs':'f335d4af944b6844759607568b4748c9de755e70',
  '.github/workflows/web-guide-systems-primary-bridge.yml':'e836c7351e9aafb7bf98df1e33d3138b62192f9a'
 };
 for(const [path,sha] of Object.entries(blobs))assert.equal(git('rev-parse',SOURCE+':'+path),sha);
 assert.equal(git('diff','--name-only',MAIN,SOURCE,'--','src/routes','static','supabase','src/lib/wep','src/lib/ddv','.github/workflows/pages.yml'), '');
});

test('full independent PR133 stable 7 category/21 subgroup handles and PR547 106 ordered candidate keys match exactly',()=>{
 assert.equal(GUIDE_PRIMARY_MECHANIC_BRIDGE_REVISION,'wand.guide.systems.primary-keys@2026-10-24');
 assert.equal(expected.length,21);
 assert.deepEqual(GUIDE_PRIMARY_MECHANIC_GROUPS.map(g=>({category:g.categoryId,group:g.groupId,keys:[...g.primaryMechanicKeys]})),expected);
 assert.equal(new Set(expected.map(x=>x.group)).size,21);
 assert.equal(new Set(expected.map(x=>x.category)).size,7);
 const all=expected.flatMap(x=>x.keys);
 assert.equal(all.length,106);
 assert.equal(new Set(all).size,106);
 for(const row of expected){
  assert.equal(canonicalGuideCategoryForGroup(row.group),row.category);
  assert.deepEqual([...primaryMechanicCandidatesForCanonicalGuideGroup(row.group)],row.keys);
  assert.ok(Object.isFrozen(GUIDE_PRIMARY_MECHANIC_GROUPS.find(g=>g.groupId===row.group)));
  assert.ok(Object.isFrozen(primaryMechanicCandidatesForCanonicalGuideGroup(row.group)));
  for(const key of row.keys)assert.equal(canonicalGuideGroupForPrimaryMechanic(key),row.group);
 }
});

test('adversarial input: unknown/prototype/HTML/Unicode/alias/native and nonstring keys never produce a positive identity',()=>{
 const badKeys=['__proto__','constructor','prototype','toString','hasOwnProperty','valueOf',
   'roads_fences ',' Roads_Fences','dreamsnaps\u0000','dreamsnaps/vote','../private',
   'https://example.org','<script>alert(1)</script>','%2e%2e','道路・フェンス',
   'premium-dlc-entitlements','624','626','NativeObjectID','000000047',''];
 for(const key of [...badKeys,null,undefined,0,624,626,{},Object.create(null),[],new String('roads_fences'),Symbol('dreamsnaps')]){
  assert.equal(canonicalGuideGroupForPrimaryMechanic(key),null,typeof key);
 }
 for(const id of ['__proto__','constructor','toString','WORLD','native-presets-reuse/../','',null,[],{}]){
  assert.deepEqual(primaryMechanicCandidatesForCanonicalGuideGroup(id),[]);
  assert.equal(canonicalGuideCategoryForGroup(id),null);
 }
 const frozen=primaryMechanicCandidatesForCanonicalGuideGroup('placement-building-housing');
 assert.throws(()=>frozen.push('new_unauthorized_topic'),TypeError);
 assert.equal(canonicalGuideGroupForPrimaryMechanic('roads_fences'),'placement-building-housing');
 assert.equal(canonicalGuideGroupForPrimaryMechanic('premium_dlc_entitlements'),'settings-saves-dlc');
 assert.equal(canonicalGuideGroupForPrimaryMechanic('expansion_adventure_access'),'worlds-unlocks');
 assert.equal(canonicalGuideGroupForPrimaryMechanic('dreamsnaps_voting'),'photos-dreamsnaps');
});

test('bridge cannot independently publish articles, guess newer Native schema, access provider or open writer',()=>{
 const s=readFileSync('src/lib/guide/systems-primary-mechanic-bridge.mjs','utf8');
 assert.match(s,/PR133 ddv\.guide\.systems-public@1 manifest \(0\/45 approved\) remains authority/);
 assert.match(s,/NEVER Native Save ObjectIDs/);
 assert.doesNotMatch(s,/^\s*(?:import|export)\s+.*(?:systems-stage1-taxonomy|systems-public|systems-catalog)/m);
 for(const absent of [
  /export const (?:SYSTEM_CATEGORIES|GUIDE_SYSTEMS_CATEGORIES|APPROVED_SYSTEM_PAGES)/,
  /(?:fetch|XMLHttpRequest|WebSocket|upload|publishWork|writeSave|saveGame)\s*\(/,
  /publicationApproved\s*:\s*true|rightsApproved\s*:\s*true|publicApprovedCount\s*:\s*45/,
  /(?:productWriterAuthorized|originalOverwriteAuthorized)\s*=\s*true/,
  /schema\s*:\s*626|gameVersion\s*:\s*['"]1\.25\.3['"]/,
  /<\s*(?:img|script|iframe)\b/i
 ])assert.doesNotMatch(s,absent);
 // Existing main has no Owner PR133 45 approved guide pages; metadata must never imply those are public.
 assert.deepEqual(srcPaths.filter(x=>x.startsWith('src/routes/')||x.startsWith('static/')),[]);
});

test('QA GitHub Actions is QA-only; no secrets, private P1G, runtime media or unsafe automatic deployment',()=>{
 const y=readFileSync('.github/workflows/04qr-w-pr562-guide-bridge-independent.yml','utf8');
 assert.match(y,/branches: \['web\/guide-systems-canonical-106-key-bridge-20261105'\]/);
 assert.match(y,/persist-credentials: false/);
 assert.match(y,/node --test tests\/04qr-w-pr562-guide-bridge-independent.test.mjs/);
 assert.doesNotMatch(y,/secrets\.|workflow_dispatch|continue-on-error/);
 assert.doesNotMatch(y,/^\s*WEP_PRIVATE_P1G_PATH\s*:/m,'must never set private P1G path');
 assert.match(y,/test -z "\$\{WEP_PRIVATE_P1G_PATH:-\}"/,'must actively deny private P1G execution');
 assert.doesNotMatch(y,/deploy-pages|publish-pages|write-all/);
});
