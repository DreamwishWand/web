// Product Owner canonical Guide > Systems taxonomy, 2026-10-24.
// Identity/Source: Nintendo Switch v1.25.0 BID 52BD625D9B4E0053 schema624.
// 106 verified mechanic candidate key assignments ARE NOT 106 published pages.
// Do not attach entitlement/Native writer/media/public rights capability to this taxonomy.
export const GUIDE_SYSTEMS_TAXONOMY_VERSION = 'wand.guide.systems.stage1@1';
export const GUIDE_SYSTEMS_SOURCE = Object.freeze({
  platform:'Nintendo Switch',gameVersion:'1.25.0',bid:'52BD625D9B4E0053',schema:624
});
export const GUIDE_SYSTEMS_PUBLIC_PAGES_ENABLED=false;
export const GUIDE_SYSTEMS_CATEGORIES=Object.freeze([
  {
    "id": "basics",
    "ja": "基本・進行・設定",
    "en": "Basics, Progression & Settings",
    "expected": 16,
    "subgroups": [
      {
        "ja": "プレイの基本",
        "en": "Play Basics",
        "expected": 6,
        "mechanicKeys": [
          "quest_progression",
          "activity_tracking",
          "energy",
          "energy_rewards",
          "sprint",
          "real_time_sync"
        ]
      },
      {
        "ja": "進行・デューティ",
        "en": "Progression & Duties",
        "expected": 6,
        "mechanicKeys": [
          "dreamlight_duties",
          "dreamlight_duty_reroll",
          "star_paths",
          "star_path_duties",
          "star_path_rewards",
          "events_event_board"
        ]
      },
      {
        "ja": "設定・セーブ・DLC利用権",
        "en": "Settings, Saves & DLC Access",
        "expected": 4,
        "mechanicKeys": [
          "cloud_cross_save",
          "premium_dlc_entitlements",
          "gameplay_control_settings",
          "accessibility_settings"
        ]
      }
    ],
    "descriptionJa": "ゲームを始め、日常の進行やデータ管理を理解する"
  },
  {
    "id": "exploration",
    "ja": "探索・移動・道具",
    "en": "Exploration, Travel & Tools",
    "expected": 13,
    "subgroups": [
      {
        "ja": "世界とエリアの解放",
        "en": "Worlds & Unlocks",
        "expected": 4,
        "mechanicKeys": [
          "realms",
          "biome_world_access",
          "floating_islands",
          "expansion_adventure_access"
        ]
      },
      {
        "ja": "マップと移動",
        "en": "Maps & Fast Travel",
        "expected": 2,
        "mechanicKeys": [
          "map_world_travel",
          "fast_travel"
        ]
      },
      {
        "ja": "道具と障害物",
        "en": "Tools & Obstacles",
        "expected": 7,
        "mechanicKeys": [
          "royal_tools",
          "fishing_rod",
          "pickaxe_tool",
          "shovel_tool",
          "watering_can",
          "camera_tool",
          "obstacle_clearing"
        ]
      }
    ],
    "descriptionJa": "行ける場所を増やし、移動し、道具を使う"
  },
  {
    "id": "villagers",
    "ja": "住民・仲間・マウント",
    "en": "Villagers, Companions & Mounts",
    "expected": 13,
    "subgroups": [
      {
        "ja": "住民と友情",
        "en": "Villagers & Friendship",
        "expected": 7,
        "mechanicKeys": [
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
        "ja": "クリッターとコンパニオン",
        "en": "Critters & Companions",
        "expected": 2,
        "mechanicKeys": [
          "critter_feeding",
          "companions"
        ]
      },
      {
        "ja": "マウントと能力",
        "en": "Mounts & Abilities",
        "expected": 4,
        "mechanicKeys": [
          "mounts",
          "mount_bonding",
          "mount_gear_customization",
          "mount_abilities"
        ]
      }
    ],
    "descriptionJa": "キャラクターや仲間を解放し一緒に遊ぶ"
  },
  {
    "id": "gathering",
    "ja": "採集・料理・クラフト",
    "en": "Gathering, Cooking & Crafting",
    "expected": 21,
    "subgroups": [
      {
        "ja": "採集・農業・釣り・採掘",
        "en": "Gathering & Farming",
        "expected": 9,
        "mechanicKeys": [
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
        "ja": "Timebendingでの採集",
        "en": "Timebending Gathering",
        "expected": 1,
        "mechanicKeys": [
          "timebending"
        ]
      },
      {
        "ja": "料理・製作・変換",
        "en": "Cooking, Crafting & Conversion",
        "expected": 5,
        "mechanicKeys": [
          "cooking",
          "restaurant_orders",
          "crafting",
          "uncrafting",
          "timebending_station_transmute"
        ]
      },
      {
        "ja": "設備と自動化",
        "en": "Machines & Automation",
        "expected": 6,
        "mechanicKeys": [
          "ancient_machines",
          "ancient_auto_cooker",
          "ancient_gardener",
          "ancient_vacuum",
          "slow_cooker",
          "bee_house"
        ]
      }
    ],
    "descriptionJa": "資源を集め、加工し、自動化する"
  },
  {
    "id": "inventory",
    "ja": "所持品・収集・ショップ",
    "en": "Inventory, Collections & Shops",
    "expected": 17,
    "subgroups": [
      {
        "ja": "所持品・収納・図鑑",
        "en": "Inventory, Storage & Collection",
        "expected": 5,
        "mechanicKeys": [
          "inventory_backpack",
          "storage_containers",
          "collection",
          "memories",
          "snippets_lorekeeper"
        ]
      },
      {
        "ja": "通貨・ショップ・購入",
        "en": "Currencies, Shops & Purchases",
        "expected": 10,
        "mechanicKeys": [
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
        "ja": "郵便・報酬・コード",
        "en": "Mail, Rewards & Codes",
        "expected": 2,
        "mechanicKeys": [
          "mailbox_rewards",
          "campaign_codes"
        ]
      }
    ],
    "descriptionJa": "アイテムを見つけ、保存し、集め、購入する"
  },
  {
    "id": "decorating",
    "ja": "飾り付け・カスタマイズ",
    "en": "Decorating & Customization",
    "expected": 14,
    "subgroups": [
      {
        "ja": "配置・建築・住宅",
        "en": "Placement, Building & Housing",
        "expected": 7,
        "mechanicKeys": [
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
        "ja": "服・家具のカスタマイズ",
        "en": "Wardrobe & Touch of Magic",
        "expected": 3,
        "mechanicKeys": [
          "touch_of_magic_clothing",
          "touch_of_magic_furniture",
          "avatar_wardrobe_customization"
        ]
      },
      {
        "ja": "ゲーム内プリセット・デザイン再利用",
        "en": "Native Presets & Reuse",
        "expected": 4,
        "mechanicKeys": [
          "native_decoration_presets",
          "decoration_group_mode",
          "blueprints",
          "boutique_displays"
        ]
      }
    ],
    "descriptionJa": "世界・部屋・アバター・家具を編集する"
  },
  {
    "id": "activities",
    "ja": "撮影・交流・アクティビティ",
    "en": "Photography, Social & Activities",
    "expected": 12,
    "subgroups": [
      {
        "ja": "写真とDreamSnaps",
        "en": "Photos & DreamSnaps",
        "expected": 5,
        "mechanicKeys": [
          "photo_mode",
          "photo_poses_emotes",
          "dreamsnaps",
          "dreamsnaps_submission_requirements",
          "dreamsnaps_voting"
        ]
      },
      {
        "ja": "交流・チャレンジ・ミニゲーム",
        "en": "Social, Challenges & Minigames",
        "expected": 7,
        "mechanicKeys": [
          "multiplayer_valley_visits",
          "boutique_challenges",
          "scramblecoin",
          "quest_puzzles",
          "exhibition",
          "obstacle_course",
          "bridge_game"
        ]
      }
    ],
    "descriptionJa": "写真を撮り、チャレンジやゲームに参加する"
  }
].map(category=>Object.freeze({
  ...category,subgroups:Object.freeze(category.subgroups.map(group=>Object.freeze({
    ...group,mechanicKeys:Object.freeze(group.mechanicKeys)
  })))
})));
const translated=Object.freeze({
  "en": [
    "Basics, Progression & Settings",
    "Exploration, Travel & Tools",
    "Villagers, Companions & Mounts",
    "Gathering, Cooking & Crafting",
    "Inventory, Collections & Shops",
    "Decorating & Customization",
    "Photography, Social & Activities"
  ],
  "fr": [
    "Bases, progression et paramètres",
    "Exploration, voyages et outils",
    "Villageois, compagnons et montures",
    "Récolte, cuisine et artisanat",
    "Inventaire, collections et boutiques",
    "Décoration et personnalisation",
    "Photographie, échanges et activités"
  ],
  "it": [
    "Basi, progressi e impostazioni",
    "Esplorazione, viaggi e strumenti",
    "Abitanti, compagni e cavalcature",
    "Raccolta, cucina e creazione",
    "Inventario, collezioni e negozi",
    "Decorazione e personalizzazione",
    "Fotografia, socialità e attività"
  ],
  "de": [
    "Grundlagen, Fortschritt & Einstellungen",
    "Erkundung, Reisen & Werkzeuge",
    "Dorfbewohner, Begleiter & Reittiere",
    "Sammeln, Kochen & Herstellen",
    "Inventar, Sammlungen & Läden",
    "Dekoration & Anpassung",
    "Fotografie, Soziales & Aktivitäten"
  ],
  "es-ES": [
    "Conceptos básicos, progreso y ajustes",
    "Exploración, viajes y herramientas",
    "Habitantes, compañeros y monturas",
    "Recolección, cocina y creación",
    "Inventario, colecciones y tiendas",
    "Decoración y personalización",
    "Fotografía, comunidad y actividades"
  ],
  "ja": [
    "基本・進行・設定",
    "探索・移動・道具",
    "住民・仲間・マウント",
    "採集・料理・クラフト",
    "所持品・収集・ショップ",
    "飾り付け・カスタマイズ",
    "撮影・交流・アクティビティ"
  ],
  "zh-CN": [
    "基础、进度与设置",
    "探索、旅行与工具",
    "村民、伙伴与坐骑",
    "采集、烹饪与制作",
    "背包、收藏与商店",
    "装饰与自定义",
    "摄影、社交与活动"
  ],
  "pt-BR": [
    "Noções básicas, progresso e configurações",
    "Exploração, viagem e ferramentas",
    "Moradores, companheiros e montarias",
    "Coleta, culinária e criação",
    "Inventário, coleções e lojas",
    "Decoração e personalização",
    "Fotografia, interação e atividades"
  ]
});
const labelKey=Object.freeze(['basics','exploration','villagers','gathering','inventory','decorating','activities']);
const canonicalAliases=Object.freeze({
  basics:Object.freeze(['DLC ownership','DLC entitlement','DLC sync','cross-save','セーブ','利用権']),
  exploration:Object.freeze(['DLC world entry','DLC expansion world unlock','拡張世界','バイオーム']),
  villagers:Object.freeze(['friendship','companions','友情','マウント']),
  gathering:Object.freeze(['crafting','farming','timebending','料理','採集']),
  inventory:Object.freeze(['storage','collection','shops','収納','図鑑']),
  decorating:Object.freeze(['road','fence','touch of magic','家具','レイアウト']),
  activities:Object.freeze(['camera','DreamSnaps','social','写真','投票'])
});
export function guideSystemsCategoryLabel(id,locale='en'){
  const index=labelKey.indexOf(id);
  if(index<0)return null;
  return (translated[locale]??translated.en)[index];
}
export function filterGuideSystemsCategories(query='',locale='en'){
  const term=String(query).trim().toLocaleLowerCase();
  if(!term)return GUIDE_SYSTEMS_CATEGORIES;
  return GUIDE_SYSTEMS_CATEGORIES.filter(c=>
    [guideSystemsCategoryLabel(c.id,locale),c.ja,c.en,c.descriptionJa,
      ...canonicalAliases[c.id],
      ...c.subgroups.flatMap(g=>[g.en,g.ja,...g.mechanicKeys])]
      .join(' ').toLocaleLowerCase().includes(term));
}
export function findGuideSystemsCategory(id){
  return GUIDE_SYSTEMS_CATEGORIES.find(c=>c.id===id)??null;
}
