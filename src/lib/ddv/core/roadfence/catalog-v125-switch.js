export const ROADFENCE_CATALOG_SWITCH_V125_SOURCE = Object.freeze({
  gameVersion: '1.25.0',
  platform: 'Nintendo Switch',
  buildID: '52BD625D9B4E0053',
  databaseGeneration: 'v1.25-01D',
  queryIndexDriveId: '1peCPbCJ0LrgCjOAs9oiOzACzga_ZFyfJ',
  queryIndexSha256: 'f3472e53bfcd55f13249cc79ddeae83ea71168fcb356c7038a0c0935eca2d06e'
});

const ROAD_FAMILIES = Object.freeze([
  [40100006, "Road_Brick"],
  [40100008, "Road_Bayou"],
  [40100009, "Road_Evil"],
  [40100010, "Road_Meadow"],
  [40100012, "Road_Savannah"],
  [40100014, "Road_Snow"],
  [40100015, "Road_Beach"],
  [40100016, "Road_Forest"],
  [40100018, "Road_Asphalt"],
  [40100019, "Road_Gold"],
  [40100020, "Road_OpalGem"],
  [40100021, "Road_OpalGold"],
  [40100030, "Road_Candy"],
  [40100031, "Path_Candy"],
  [40100032, "Path_Asphalt"],
  [40100033, "Path_Bayou"],
  [40100034, "Path_Beach"],
  [40100035, "Path_Brick"],
  [40100036, "Path_Evil"],
  [40100037, "Path_Forest"],
  [40100038, "Path_Gold"],
  [40100039, "Path_Meadow"],
  [40100040, "Path_OpalGem"],
  [40100041, "Path_OpalGold"],
  [40100042, "Path_Savannah"],
  [40100043, "Path_Snow"],
  [40100050, "Road_Atlantean"],
  [40100053, "Path_StoneSlabs"],
  [40100054, "Road_StoneSlabs"],
  [40100055, "Path_Atlantean"],
  [40100056, "Path_A"],
  [40100057, "Path_A_Green"],
  [40100058, "Path_B"],
  [40100059, "Path_B_Blue"],
  [40100060, "Path_AncientA"],
  [40100062, "Road_AncientA"],
  [40100064, "Road_C_Green"],
  [40100065, "Road_C_Yellow"],
  [40100066, "Path_D_PurpleGreen"],
  [40100067, "Path_D_Yellow"],
  [40100068, "Path_MainStreet"],
  [40100075, "Path_RockiesCobbleStone"],
  [40100076, "Road_RockiesCobbleStone"],
  [40100082, "Path_FashionPath1"],
  [40100085, "Path_20thCenturyRoadPath"],
  [40100086, "Road_20thCenturyRoadPath"],
  [40100087, "Path_HoneyLimestone"],
  [40100091, "Path_Tatooine"],
  [40100092, "Road_Tatooine"]
]);

const FENCE_FAMILIES = Object.freeze([
  ["IronBricks", 40700000, [40700057,40700002,40700058,40700004,40700059,40700006], [40700171,40700172,40700173,40700174]],
  ["BambooFence01", 40700007, [40700009,40700008,40700010,40700011,40700012,40700013], [40700147,40700148,40700149,40700150]],
  ["BambooFence02", 40700014, [40700015,40700016,40700017,40700018,40700019,40700020], [40700151,40700152,40700153,40700154]],
  ["ChainFence01", 40700021, [40700022,40700023,40700024,40700025,40700026,40700027], [40700155,40700156,40700157,40700158]],
  ["ChainFence02", 40700028, [40700029,40700030,40700031,40700032,40700033,40700034], [40700159,40700160,40700161,40700162]],
  ["DarkMountainFence", 40700035, [40700036,40700037,40700038,40700039,40700040,40700041], [40700163,40700164,40700165,40700166]],
  ["DarkWoodFence", 40700042, [40700043,40700044,40700045,40700046,40700047,40700048], [40700167,40700168,40700169,40700170]],
  ["UrbanWhiteFence", 40700049, [40700050,40700051,40700052,40700053,40700054,40700055], [40700133,40700135,40700137,40700138]],
  ["AncientFence", 40700060, [40700061,40700062,40700063,40700064,40700065,40700066], [40700139,40700140,40700141,40700142]],
  ["AtlanteanFence01", 40700067, [40700068,40700069,40700070,40700071,40700072,40700073], [40700143,40700144,40700145,40700146]],
  ["IronFence01", 40700081, [40700075,40700076,40700077,40700078,40700079,40700080], [40700175,40700176,40700177,40700178]],
  ["WoodenFence01", 40700088, [40700082,40700083,40700084,40700085,40700086,40700087], [40700187,40700188,40700189,40700190]],
  ["LionKingFences01", 40700104, [40700105,40700106,40700107,40700108,40700109,40700110], [40700179,40700180,40700181,40700182]],
  ["MythopiaFence01", 40700112, [40700113,40700114,40700115,40700116,40700117,40700118], [40700183,40700184,40700185,40700186]],
  ["ClassicFarmFence", 40700191, [40700192,40700193,40700194,40700195,40700196,40700197], [40700198,40700199,40700200,40700201]],
  ["ClassicFarmFenceSnow", 40700202, [40700207,40700208,40700209,40700210,40700211,40700212], [40700203,40700204,40700205,40700206]],
  ["RusticLogFence", 40700213, [40700214,40700215,40700216,40700217,40700218,40700219], [40700220,40700221,40700222,40700223]],
  ["RusticLogFenceSnow", 40700224, [40700225,40700226,40700227,40700228,40700229,40700230], [40700231,40700232,40700233,40700234]],
  ["Biome2Fence", 40700246, [40700247,40700248,40700249,40700250,40700251,40700252], [40700253,40700254,40700255,40700256]],
  ["BirdFeathersFence", 40700257, [40700258,40700259,40700260,40700261,40700262,40700263], [40700264,40700265,40700266,40700267]],
  ["FairyLightFence", 40700268, [40700269,40700270,40700271,40700272,40700273,40700274], [40700275,40700276,40700277,40700278]],
  ["LuxuriousWhiteFence", 40700279, [40700280,40700281,40700282,40700283,40700284,40700285], [40700286,40700287,40700288,40700289]],
  ["ClassicFarmFence01", 40700295, [40700300,40700301,40700302,40700303,40700304,40700305], [40700296,40700297,40700298,40700299]],
  ["HoneyLimestoneFence", 40700306, [40700311,40700312,40700313,40700314,40700315,40700316], [40700307,40700308,40700309,40700310]]
]);

function buildRoadItems() {
  return Object.fromEntries(ROAD_FAMILIES.map(([itemID, familyName]) => [
    String(itemID),
    { familyBaseItemID: itemID, familyName }
  ]));
}

function buildFenceItems() {
  const output = {};
  for (const [familyName, baseItemID, extItemIDs, diagItemIDs] of FENCE_FAMILIES) {
    output[String(baseItemID)] = {
      familyBaseItemID: baseItemID,
      familyName,
      role: 'base',
      gridSizeX: 1,
      gridSizeY: 1
    };
    extItemIDs.forEach((itemID, index) => {
      const key = index + 1;
      output[String(itemID)] = {
        familyBaseItemID: baseItemID, familyName, role: 'ext', key,
        gridSizeX: key, gridSizeY: 1
      };
    });
    diagItemIDs.forEach((itemID, index) => {
      const key = index + 1;
      output[String(itemID)] = {
        familyBaseItemID: baseItemID, familyName, role: 'diagExt', key,
        gridSizeX: key, gridSizeY: key
      };
    });
  }
  return output;
}

export const ROADFENCE_NATIVE_CATALOG_SWITCH_V125 = Object.freeze({
  schema: 'dreamwish-wand-roadfence-native-catalog',
  version: 1,
  gameVersion: ROADFENCE_CATALOG_SWITCH_V125_SOURCE.gameVersion,
  platform: ROADFENCE_CATALOG_SWITCH_V125_SOURCE.platform,
  buildID: ROADFENCE_CATALOG_SWITCH_V125_SOURCE.buildID,
  complete: true,
  source: ROADFENCE_CATALOG_SWITCH_V125_SOURCE,
  coverage: Object.freeze({
    roadFamilies: 49,
    roadPersistentItems: 49,
    fenceFamilies: 24,
    fencePersistentItems: 264
  }),
  roadItems: Object.freeze(buildRoadItems()),
  fenceItems: Object.freeze(buildFenceItems())
});
