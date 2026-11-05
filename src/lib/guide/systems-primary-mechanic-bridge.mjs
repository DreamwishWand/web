// DDVRE / 08 WEB — read-only owner taxonomy bridge; 2026-11-05.
// SSoT: Guide Systems seven-category/21-group final 2026-10-24.
// Canonical categoryId/groupId are the stable published-contract IDs from
// PR133 systems-catalog.js. Keys were independently validated as the exact
// 106 owner-approved mechanic *candidate* assignments in PR547 / 04QR-W PR551.
// These are TOPIC IDs, NEVER Native Save ObjectIDs, entitlements, Item EntityRefs,
// published article identities, rights approvals, writer operations or URLs.
// Do not import the alternative PR547 systems-stage1-taxonomy model or route.
// The PR133 ddv.guide.systems-public@1 manifest (0/45 approved) remains authority.
export const GUIDE_PRIMARY_MECHANIC_BRIDGE_REVISION = 'wand.guide.systems.primary-keys@2026-10-24';
export const GUIDE_PRIMARY_MECHANIC_GROUPS = Object.freeze(
  [
  {
    "categoryId": "basics-progression-settings",
    "groupId": "play-basics",
    "primaryMechanicKeys": [
      "quest_progression",
      "activity_tracking",
      "energy",
      "energy_rewards",
      "sprint",
      "real_time_sync"
    ]
  },
  {
    "categoryId": "basics-progression-settings",
    "groupId": "progression-duties",
    "primaryMechanicKeys": [
      "dreamlight_duties",
      "dreamlight_duty_reroll",
      "star_paths",
      "star_path_duties",
      "star_path_rewards",
      "events_event_board"
    ]
  },
  {
    "categoryId": "basics-progression-settings",
    "groupId": "settings-saves-dlc",
    "primaryMechanicKeys": [
      "cloud_cross_save",
      "premium_dlc_entitlements",
      "gameplay_control_settings",
      "accessibility_settings"
    ]
  },
  {
    "categoryId": "exploration-travel-tools",
    "groupId": "worlds-unlocks",
    "primaryMechanicKeys": [
      "realms",
      "biome_world_access",
      "floating_islands",
      "expansion_adventure_access"
    ]
  },
  {
    "categoryId": "exploration-travel-tools",
    "groupId": "maps-fast-travel",
    "primaryMechanicKeys": [
      "map_world_travel",
      "fast_travel"
    ]
  },
  {
    "categoryId": "exploration-travel-tools",
    "groupId": "tools-obstacles",
    "primaryMechanicKeys": [
      "royal_tools",
      "fishing_rod",
      "pickaxe_tool",
      "shovel_tool",
      "watering_can",
      "camera_tool",
      "obstacle_clearing"
    ]
  },
  {
    "categoryId": "villagers-companions-mounts",
    "groupId": "villagers-friendship",
    "primaryMechanicKeys": [
      "character_unlocks",
      "friendship",
      "hangout_roles",
      "npc_schedules",
      "best_friends",
      "dream_styles",
      "cheshire_hangout"
    ]
  },
  {
    "categoryId": "villagers-companions-mounts",
    "groupId": "critters-companions",
    "primaryMechanicKeys": [
      "critter_feeding",
      "companions"
    ]
  },
  {
    "categoryId": "villagers-companions-mounts",
    "groupId": "mounts-abilities",
    "primaryMechanicKeys": [
      "mounts",
      "mount_bonding",
      "mount_gear_customization",
      "mount_abilities"
    ]
  },
  {
    "categoryId": "gathering-cooking-crafting",
    "groupId": "gathering-farming",
    "primaryMechanicKeys": [
      "gardening",
      "crops",
      "fruit_trees",
      "flowers",
      "fishing",
      "mining",
      "foraging",
      "moana_boat",
      "walle_garden"
    ]
  },
  {
    "categoryId": "gathering-cooking-crafting",
    "groupId": "timebending-gathering",
    "primaryMechanicKeys": [
      "timebending"
    ]
  },
  {
    "categoryId": "gathering-cooking-crafting",
    "groupId": "cooking-crafting-conversion",
    "primaryMechanicKeys": [
      "cooking",
      "restaurant_orders",
      "crafting",
      "uncrafting",
      "timebending_station_transmute"
    ]
  },
  {
    "categoryId": "gathering-cooking-crafting",
    "groupId": "machines-automation",
    "primaryMechanicKeys": [
      "ancient_machines",
      "ancient_auto_cooker",
      "ancient_gardener",
      "ancient_vacuum",
      "slow_cooker",
      "bee_house"
    ]
  },
  {
    "categoryId": "inventory-collections-shops",
    "groupId": "inventory-storage-collection",
    "primaryMechanicKeys": [
      "inventory_backpack",
      "storage_containers",
      "collection",
      "memories",
      "snippets_lorekeeper"
    ]
  },
  {
    "categoryId": "inventory-collections-shops",
    "groupId": "currencies-shops-purchases",
    "primaryMechanicKeys": [
      "dreamlight_resource",
      "currencies_resources",
      "scrooge_store",
      "selling_stalls",
      "premium_shop",
      "star_coin",
      "mist_resource",
      "storybook_magic_resource",
      "daisy_coin",
      "moonstones"
    ]
  },
  {
    "categoryId": "inventory-collections-shops",
    "groupId": "mail-rewards-codes",
    "primaryMechanicKeys": [
      "mailbox_rewards",
      "campaign_codes"
    ]
  },
  {
    "categoryId": "decorating-customization",
    "groupId": "placement-building-housing",
    "primaryMechanicKeys": [
      "decorating_mode",
      "furniture_placement",
      "top_down_camera",
      "landscaping",
      "roads_fences",
      "player_house_rooms",
      "moving_houses"
    ]
  },
  {
    "categoryId": "decorating-customization",
    "groupId": "wardrobe-touch-of-magic",
    "primaryMechanicKeys": [
      "touch_of_magic_clothing",
      "touch_of_magic_furniture",
      "avatar_wardrobe_customization"
    ]
  },
  {
    "categoryId": "decorating-customization",
    "groupId": "native-presets-reuse",
    "primaryMechanicKeys": [
      "native_decoration_presets",
      "decoration_group_mode",
      "blueprints",
      "boutique_displays"
    ]
  },
  {
    "categoryId": "photography-social-activities",
    "groupId": "photos-dreamsnaps",
    "primaryMechanicKeys": [
      "photo_mode",
      "photo_poses_emotes",
      "dreamsnaps",
      "dreamsnaps_submission_requirements",
      "dreamsnaps_voting"
    ]
  },
  {
    "categoryId": "photography-social-activities",
    "groupId": "social-challenges-minigames",
    "primaryMechanicKeys": [
      "multiplayer_valley_visits",
      "boutique_challenges",
      "scramblecoin",
      "quest_puzzles",
      "exhibition",
      "obstacle_course",
      "bridge_game"
    ]
  }
].map(group => Object.freeze({
    ...group,
    primaryMechanicKeys: Object.freeze(group.primaryMechanicKeys)
  }))
);
const groupIndex = new Map(GUIDE_PRIMARY_MECHANIC_GROUPS.map(group => [group.groupId, group]));
const keyIndex = new Map(GUIDE_PRIMARY_MECHANIC_GROUPS.flatMap(group =>
  group.primaryMechanicKeys.map(key => [key, group.groupId])
));
export function canonicalGuideGroupForPrimaryMechanic(key) {
  return typeof key === 'string' ? (keyIndex.get(key) ?? null) : null;
}
export function primaryMechanicCandidatesForCanonicalGuideGroup(groupId) {
  return typeof groupId === 'string'
    ? (groupIndex.get(groupId)?.primaryMechanicKeys ?? Object.freeze([]))
    : Object.freeze([]);
}
export function canonicalGuideCategoryForGroup(groupId) {
  return typeof groupId === 'string' ? (groupIndex.get(groupId)?.categoryId ?? null) : null;
}
