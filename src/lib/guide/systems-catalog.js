// Source: 06C owner-approved seven-category taxonomy + 07 DBK 2026-10-24 45-page CSV.
// The 45 records are reviewed EN editorial inventory, NOT approved public articles.
// IDs are derived stable taxonomy/primary mechanic handles, not newly approved product names.
export const SYSTEMS_SOURCE = Object.freeze({platform:'Nintendo Switch',gameVersion:'1.25.0',buildID:'52BD625D9B4E0053',schema:624,taxonomyRevision:'2026-10-24',reviewedEnglishCount:45,publicApprovedCount:0});
export const SYSTEM_CATEGORIES = Object.freeze([
  {
    "id": "basics-progression-settings",
    "en": "Basics, Progression & Settings",
    "ja": "基本・進行・設定",
    "groups": [
      {
        "id": "play-basics",
        "en": "Play Basics",
        "ja": "プレイの基本"
      },
      {
        "id": "progression-duties",
        "en": "Progression & Duties",
        "ja": "進行・デューティ"
      },
      {
        "id": "settings-saves-dlc",
        "en": "Settings, Saves & DLC Access",
        "ja": "設定・セーブ・DLC利用権"
      }
    ]
  },
  {
    "id": "exploration-travel-tools",
    "en": "Exploration, Travel & Tools",
    "ja": "探索・移動・道具",
    "groups": [
      {
        "id": "worlds-unlocks",
        "en": "Worlds & Unlocks",
        "ja": "世界とエリアの解放"
      },
      {
        "id": "maps-fast-travel",
        "en": "Maps & Fast Travel",
        "ja": "マップと移動"
      },
      {
        "id": "tools-obstacles",
        "en": "Tools & Obstacles",
        "ja": "道具と障害物"
      }
    ]
  },
  {
    "id": "villagers-companions-mounts",
    "en": "Villagers, Companions & Mounts",
    "ja": "住民・仲間・マウント",
    "groups": [
      {
        "id": "villagers-friendship",
        "en": "Villagers & Friendship",
        "ja": "住民と友情"
      },
      {
        "id": "critters-companions",
        "en": "Critters & Companions",
        "ja": "クリッターとコンパニオン"
      },
      {
        "id": "mounts-abilities",
        "en": "Mounts & Abilities",
        "ja": "マウントと能力"
      }
    ]
  },
  {
    "id": "gathering-cooking-crafting",
    "en": "Gathering, Cooking & Crafting",
    "ja": "採集・料理・クラフト",
    "groups": [
      {
        "id": "gathering-farming",
        "en": "Gathering & Farming",
        "ja": "採集・農業・釣り・採掘"
      },
      {
        "id": "timebending-gathering",
        "en": "Timebending Gathering",
        "ja": "Timebendingでの採集"
      },
      {
        "id": "cooking-crafting-conversion",
        "en": "Cooking, Crafting & Conversion",
        "ja": "料理・製作・変換"
      },
      {
        "id": "machines-automation",
        "en": "Machines & Automation",
        "ja": "設備と自動化"
      }
    ]
  },
  {
    "id": "inventory-collections-shops",
    "en": "Inventory, Collections & Shops",
    "ja": "所持品・収集・ショップ",
    "groups": [
      {
        "id": "inventory-storage-collection",
        "en": "Inventory, Storage & Collection",
        "ja": "所持品・収納・図鑑"
      },
      {
        "id": "currencies-shops-purchases",
        "en": "Currencies, Shops & Purchases",
        "ja": "通貨・ショップ・購入"
      },
      {
        "id": "mail-rewards-codes",
        "en": "Mail, Rewards & Codes",
        "ja": "郵便・報酬・コード"
      }
    ]
  },
  {
    "id": "decorating-customization",
    "en": "Decorating & Customization",
    "ja": "飾り付け・カスタマイズ",
    "groups": [
      {
        "id": "placement-building-housing",
        "en": "Placement, Building & Housing",
        "ja": "配置・建築・住宅"
      },
      {
        "id": "wardrobe-touch-of-magic",
        "en": "Wardrobe & Touch of Magic",
        "ja": "服・家具のカスタマイズ"
      },
      {
        "id": "native-presets-reuse",
        "en": "Native Presets & Reuse",
        "ja": "ゲーム内プリセット・デザイン再利用"
      }
    ]
  },
  {
    "id": "photography-social-activities",
    "en": "Photography, Social & Activities",
    "ja": "撮影・交流・アクティビティ",
    "groups": [
      {
        "id": "photos-dreamsnaps",
        "en": "Photos & DreamSnaps",
        "ja": "写真とDreamSnaps"
      },
      {
        "id": "social-challenges-minigames",
        "en": "Social, Challenges & Minigames",
        "ja": "交流・チャレンジ・ミニゲーム"
      }
    ]
  }
]);
// Shipping source contains ONLY explicitly publication-approved page bindings.
// Reviewed English inventory is isolated in tests/fixtures, never in client bundles.
export const APPROVED_SYSTEM_PAGES = Object.freeze([]);
export const PAGE_INDEX = new Map(APPROVED_SYSTEM_PAGES.map(page => [page.id,page]));
export const CATEGORY_INDEX = new Map(SYSTEM_CATEGORIES.map(category => [category.id,category]));
