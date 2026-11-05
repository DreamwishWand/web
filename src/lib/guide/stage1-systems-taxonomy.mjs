// Approved Guide > Systems taxonomy. Source: DDV_WAND_PRODUCT_UX_STAGE1_CURRENT,
// final 06C return (2026-10-24) + Owner-approved Systems taxonomy document.
// Candidate evidence keys are NOT public Guide articles, current-game availability or entitlements.
export const GUIDE_SYSTEM_TARGET = Object.freeze({
  platform: 'Nintendo Switch', version: '1.25.0',
  bid: '52BD625D9B4E0053', schema: 624,
  publicArticlesApproved: 0
});

const group = (id, ja, en, keys) => Object.freeze({
  id, ja, en, keys: Object.freeze(keys.split(' ').filter(Boolean))
});
const category = (id, ja, en, descriptionJa, descriptionEn, groups) => Object.freeze({
  id, ja, en, descriptionJa, descriptionEn,
  groups: Object.freeze(groups), candidateCount: groups.reduce((sum, g) => sum + g.keys.length, 0)
});

export const GUIDE_SYSTEM_CATEGORIES = Object.freeze([
  category('basics','基本・進行・設定','Basics, Progression & Settings',
    'ゲームを始め、日常の進行やデータ管理を理解する','Understand play basics, progression and settings',[
    group('play-basics','プレイの基本','Play Basics','quest_progression activity_tracking energy energy_rewards sprint real_time_sync'),
    group('progression-duties','進行・デューティ','Progression & Duties','dreamlight_duties dreamlight_duty_reroll star_paths star_path_duties star_path_rewards events_event_board'),
    group('settings-saves-dlc','設定・セーブ・DLC利用権','Settings, Saves & DLC Access','cloud_cross_save premium_dlc_entitlements gameplay_control_settings accessibility_settings')
  ]),
  category('exploration','探索・移動・道具','Exploration, Travel & Tools',
    '行ける場所を増やし、移動し、道具を使う','Explore worlds, travel and use tools',[
    group('worlds-unlocks','世界とエリアの解放','Worlds & Unlocks','realms biome_world_access floating_islands expansion_adventure_access'),
    group('maps-travel','マップと移動','Maps & Fast Travel','map_world_travel fast_travel'),
    group('tools-obstacles','道具と障害物','Tools & Obstacles','royal_tools fishing_rod pickaxe_tool shovel_tool watering_can camera_tool obstacle_clearing')
  ]),
  category('villagers','住民・仲間・マウント','Villagers, Companions & Mounts',
    'キャラクターや仲間を解放し一緒に遊ぶ','Meet villagers, companions and mounts',[
    group('villagers-friendship','住民と友情','Villagers & Friendship','character_unlocks friendship hangout_roles npc_schedules best_friends dream_styles cheshire_hangout'),
    group('critters-companions','クリッターとコンパニオン','Critters & Companions','critter_feeding companions'),
    group('mounts-abilities','マウントと能力','Mounts & Abilities','mounts mount_bonding mount_gear_customization mount_abilities')
  ]),
  category('gathering','採集・料理・クラフト','Gathering, Cooking & Crafting',
    '資源を集め、加工し、自動化する','Gather, cook, craft and automate',[
    group('gathering-farming','採集・農業・釣り・採掘','Gathering & Farming','gardening crops fruit_trees flowers fishing mining foraging moana_boat walle_garden'),
    group('timebending','Timebendingでの採集','Timebending Gathering','timebending'),
    group('cooking-crafting','料理・製作・変換','Cooking, Crafting & Conversion','cooking restaurant_orders crafting uncrafting timebending_station_transmute'),
    group('machines-automation','設備と自動化','Machines & Automation','ancient_machines ancient_auto_cooker ancient_gardener ancient_vacuum slow_cooker bee_house')
  ]),
  category('inventory','所持品・収集・ショップ','Inventory, Collections & Shops',
    'アイテムを見つけ、保存し、集め、購入する','Find, store, collect and shop for items',[
    group('inventory-storage','所持品・収納・図鑑','Inventory, Storage & Collection','inventory_backpack storage_containers collection memories snippets_lorekeeper'),
    group('currencies-shops','通貨・ショップ・購入','Currencies, Shops & Purchases','dreamlight_resource currencies_resources scrooge_store selling_stalls premium_shop star_coin mist_resource storybook_magic_resource daisy_coin moonstones'),
    group('mail-rewards','郵便・報酬・コード','Mail, Rewards & Codes','mailbox_rewards campaign_codes')
  ]),
  category('decorating','飾り付け・カスタマイズ','Decorating & Customization',
    '世界・部屋・アバター・家具を編集する','Decorate worlds and customize outfits and furniture',[
    group('placement-housing','配置・建築・住宅','Placement, Building & Housing','decorating_mode furniture_placement top_down_camera landscaping roads_fences player_house_rooms moving_houses'),
    group('wardrobe-tom','服・家具のカスタマイズ','Wardrobe & Touch of Magic','touch_of_magic_clothing touch_of_magic_furniture avatar_wardrobe_customization'),
    group('native-presets','ゲーム内プリセット・デザイン再利用','Native Presets & Reuse','native_decoration_presets decoration_group_mode blueprints boutique_displays')
  ]),
  category('activities','撮影・交流・アクティビティ','Photography, Social & Activities',
    '写真を撮り、チャレンジやゲームに参加する','Take photos and explore challenges and activities',[
    group('photos-dreamsnaps','写真とDreamSnaps','Photos & DreamSnaps','photo_mode photo_poses_emotes dreamsnaps dreamsnaps_submission_requirements dreamsnaps_voting'),
    group('social-minigames','交流・チャレンジ・ミニゲーム','Social, Challenges & Minigames','multiplayer_valley_visits boutique_challenges scramblecoin quest_puzzles exhibition obstacle_course bridge_game')
  ])
]);

export const GUIDE_ROOT_SECTIONS = Object.freeze(['systems', 'quests', 'starPaths', 'events']);
export const GUIDE_SYSTEM_EVIDENCE_KEYS = Object.freeze(
  GUIDE_SYSTEM_CATEGORIES.flatMap(c => c.groups.flatMap(g => g.keys))
);
export function assertGuideSystemsTaxonomy() {
  const groups = GUIDE_SYSTEM_CATEGORIES.flatMap(c => c.groups);
  if (GUIDE_SYSTEM_CATEGORIES.length !== 7 || groups.length !== 21 ||
      GUIDE_SYSTEM_EVIDENCE_KEYS.length !== 106 ||
      new Set(GUIDE_SYSTEM_EVIDENCE_KEYS).size !== 106 ||
      new Set(groups.map(g=>g.id)).size !== 21) {
    throw new Error('Guide Systems taxonomy must retain 7 categories, 21 groups, 106 unique internal keys.');
  }
  return true;
}
// Keys are searchable navigation evidence ONLY; never resolve to public articles,
// return publication permissions, or claim a current version's game mechanics.
export function searchGuideSystemCategories(query = '', locale = 'en') {
  const q = String(query).trim().toLocaleLowerCase();
  if (!q) return GUIDE_SYSTEM_CATEGORIES;
  return GUIDE_SYSTEM_CATEGORIES.map(c => {
    const allText = [c.ja,c.en,c.descriptionJa,c.descriptionEn].join(' ').toLocaleLowerCase();
    if (allText.includes(q)) return c;
    const groups = c.groups.filter(g =>
      [g.ja,g.en,...g.keys].join(' ').toLocaleLowerCase().includes(q)
    );
    return groups.length ? { ...c, groups } : null;
  }).filter(x => x !== null);
}
export function guideTaxonomyLabel(entry, locale) {
  return locale === 'ja' ? entry.ja : entry.en;
}
