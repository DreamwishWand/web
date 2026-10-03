import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  BUILDING_V110_CLASS,
  BUILDING_V110_SHA256,
  BUILDING_V111_PROJECTION_SCHEMA,
  BUILDING_V111_PROJECTION_SHA256,
  createSwitchV125BuildingBinding
} from '../src/lib/wep/building-v110.ts';

const root = new URL('../', import.meta.url);

async function localFetch(url) {
  const pathname = new URL(String(url), 'https://wand.invalid').pathname;
  const bytes = await readFile(
    new URL(`./static${pathname}`, root)
  );
  return new Response(bytes, { status: 200 });
}

async function binding() {
  return createSwitchV125BuildingBinding({
    fetchImpl: localFetch
  });
}

test('WEP binds the promoted Building v1.10 contract by canonical SHA', async () => {
  const b = await binding();
  assert.equal(
    b.contract,
    'ddv.building-read-model-preflight@1'
  );
  assert.equal(b.artifactId, 'DDV-BUILDING-V125-V1_10');
  assert.equal(b.contractSha256, BUILDING_V110_SHA256);
  assert.equal(b.platform, 'Nintendo Switch');
  assert.equal(b.gameVersion, '1.25.0');
  assert.equal(b.buildId, '52BD625D9B4E0053');
  assert.equal(b.profileSchemaVersion, 624);
  assert.equal(b.persistentWriteAuthorized, false);
});

test('WEP binds the promoted ItemID-keyed Building v1.11 projection', async () => {
  const b = await binding();
  assert.equal(
    b.classificationProjection,
    BUILDING_V111_PROJECTION_SCHEMA
  );
  assert.equal(
    b.classificationProjectionArtifact,
    'DDV-BUILDING-CLASSIFICATION-V125-V1_11'
  );
  assert.equal(
    b.classificationProjectionSha256,
    BUILDING_V111_PROJECTION_SHA256
  );

  const well = b.classificationEvidenceForItemId(20300008);
  assert.equal(well.buildingItemType, 'Other');
  assert.equal(well.signals.isFastTravel, true);
  assert.equal(
    b.classifyItemId(20300008).classification,
    BUILDING_V110_CLASS.SPECIAL
  );

  const unknown = b.classifyItemId(20300112);
  assert.equal(
    unknown.classification,
    BUILDING_V110_CLASS.UNKNOWN
  );
  assert.equal(
    unknown.blockers[0].code,
    BUILDING_V110_CLASS.UNKNOWN
  );

  assert.equal(
    b.classificationEvidenceForItemId(999999999),
    null
  );
  assert.equal(
    b.classifyItemId(999999999).classification,
    BUILDING_V110_CLASS.UNKNOWN
  );
});

test('current v1.11 projection contains no ordinary Building member', async () => {
  const b = await binding();
  for (const itemId of [
    20000006,
    20100000,
    20200002,
    20300008,
    20400001,
    20500005,
    20300112
  ]) {
    assert.notEqual(
      b.classifyItemId(itemId).classification,
      BUILDING_V110_CLASS.ORDINARY
    );
  }
});

test('Canvas annotation replaces blanket Building reasons with promoted classification blockers', async () => {
  const b = await binding();
  const annotated = b.annotateEditorDocument({
    objects: [
      {
        editorId: 'well',
        itemId: 20300008,
        layer: 'building',
        editability: 'readonly',
        metadata: {
          reasons: ['BUILDING_READ_ONLY'],
          stateKind: 'BuildingWithSkinData'
        }
      },
      {
        editorId: 'unknown',
        itemId: 20300112,
        layer: 'building',
        editability: 'readonly',
        metadata: {
          reasons: ['BUILDING_READ_ONLY']
        }
      }
    ]
  });

  const well = annotated.objects[0];
  assert.equal(
    well.metadata.buildingClassification.classification,
    BUILDING_V110_CLASS.SPECIAL
  );
  assert.equal(
    well.metadata.buildingSemantics.signals.isFastTravel,
    true
  );
  assert.equal(
    well.metadata.reasons.includes('BUILDING_READ_ONLY'),
    false
  );
  assert.equal(
    well.metadata.reasons.includes(
      'WELL_FASTTRAVEL_GLOBAL_STATE_AND_IDENTITY_REQUIRE_DEDICATED_LIFECYCLE'
    ),
    true
  );

  const unknown = annotated.objects[1];
  assert.equal(
    unknown.metadata.buildingClassification.classification,
    BUILDING_V110_CLASS.UNKNOWN
  );
  assert.equal(
    unknown.metadata.reasons.includes(
      'UNKNOWN_BUILDING_SEMANTICS'
    ),
    true
  );
});

test('direct promoted BuildingItemType classes stay typed and writer-disabled', async () => {
  const b = await binding();

  const stall = b.classifyEvidence({
    buildingItemType: 'Stall'
  });
  assert.equal(
    stall.classification,
    BUILDING_V110_CLASS.SPECIAL
  );
  assert.equal(stall.subtype, 'StallShop');
  assert.equal(stall.persistentWriteAuthorized, false);

  const offGrid = b.classifyEvidence({
    buildingItemType: 'OffGridBuilding'
  });
  assert.equal(
    offGrid.classification,
    BUILDING_V110_CLASS.OFF_GRID
  );
  assert.equal(offGrid.subtype, 'OffGridBuilding');
});

test('House or Other becomes ordinary only when every promoted special signal is authoritatively false', async () => {
  const b = await binding();
  const allFalse = {
    isPlayerHouse: false,
    isCharacterHouse: false,
    isFastTravel: false,
    hasBuildingStateSynchronizer: false,
    hasOtherGlobalOrSharedBinding: false
  };

  const ordinary = b.classifyEvidence({
    buildingItemType: 'House',
    signals: allFalse
  });
  assert.equal(
    ordinary.classification,
    BUILDING_V110_CLASS.ORDINARY
  );

  const unknown = b.classifyEvidence({
    buildingItemType: 'House',
    signals: {
      ...allFalse,
      hasOtherGlobalOrSharedBinding: null
    }
  });
  assert.equal(
    unknown.classification,
    BUILDING_V110_CLASS.UNKNOWN
  );
  assert.equal(
    unknown.blockers[0].code,
    BUILDING_V110_CLASS.UNKNOWN
  );

  const special = b.classifyEvidence({
    buildingItemType: 'Other',
    signals: {
      ...allFalse,
      isCharacterHouse: true
    }
  });
  assert.equal(
    special.classification,
    BUILDING_V110_CLASS.SPECIAL
  );
  assert.equal(special.subtype, 'CharacterHouse');
});

test('protected PlayerHouse binding evidence is special and never ordinary', async () => {
  const b = await binding();
  const result = b.classifyEvidence({
    restorationKind: 'PLAYER_HOUSE'
  });
  assert.equal(
    result.classification,
    BUILDING_V110_CLASS.SPECIAL
  );
  assert.equal(result.subtype, 'PlayerHouse');
  assert.equal(
    result.blockers[0].code,
    'BUILDING_SPECIAL_SEMANTICS_UNRESOLVED'
  );
});

test('promoted StallData typed state is consumed as special rather than generic Building', async () => {
  const b = await binding();
  const result = b.classifyEvidence({
    sourceStateFamily: 'StallData'
  });
  assert.equal(
    result.classification,
    BUILDING_V110_CLASS.SPECIAL
  );
  assert.equal(result.subtype, 'StallShop');
  assert.equal(
    result.blockers[0].code,
    'STALL_SHOP_LOCAL_GLOBAL_STATE_LIFECYCLE_UNRESOLVED'
  );
});

test('ordinary same-grid transform requires all promoted route and placement gates', async () => {
  const b = await binding();
  const evidence = {
    buildingItemType: 'House',
    signals: {
      isPlayerHouse: false,
      isCharacterHouse: false,
      isFastTravel: false,
      hasBuildingStateSynchronizer: false,
      hasOtherGlobalOrSharedBinding: false
    }
  };

  const ready = b.sameGridTransformPreflight({
    evidence,
    routeSupported: true,
    cardinalTransformSupported: true,
    boundsReady: true,
    floorMapReady: true,
    placementResult: {
      nativeClass: 'NATIVE_VALID_CLEAR'
    }
  });
  assert.equal(ready.ready, true);
  assert.equal(ready.persistentWriteAuthorized, false);

  const replacement = b.sameGridTransformPreflight({
    evidence,
    routeSupported: true,
    cardinalTransformSupported: true,
    boundsReady: true,
    floorMapReady: true,
    placementResult: {
      nativeClass:
        'NATIVE_VALID_REPLACES_OR_REMOVES_EXISTING'
    }
  });
  assert.equal(replacement.ready, false);
  assert.equal(
    replacement.blockers.some(
      (x) =>
        x.code ===
        'NATIVE_REPLACEMENT_OR_REMOVAL_POLICY_REQUIRED'
    ),
    true
  );
});

test('ordinary placement remains blocked until all three destination validators and native placement are valid', async () => {
  const b = await binding();
  const evidence = {
    buildingItemType: 'Other',
    signals: {
      isPlayerHouse: false,
      isCharacterHouse: false,
      isFastTravel: false,
      hasBuildingStateSynchronizer: false,
      hasOtherGlobalOrSharedBinding: false
    }
  };

  const missing = b.ordinaryPlacementPreflight({
    evidence,
    boundsReady: true,
    floorMapReady: true,
    placementResult: {
      nativeClass: 'NATIVE_VALID_CLEAR'
    }
  });
  assert.equal(missing.ready, false);
  assert.deepEqual(
    new Set(missing.blockers.map((x) => x.code)),
    new Set([
      'WEP_BUILDING_STOCK_OWNERSHIP_VALIDATOR_NOT_BOUND',
      'WEP_BUILDING_MULTIPLICITY_VALIDATOR_NOT_BOUND',
      'WEP_BUILDING_TYPED_STATE_VALIDATOR_NOT_BOUND'
    ])
  );

  const ready = b.ordinaryPlacementPreflight({
    evidence,
    destinationStockOwnership: { status: 'VALID' },
    currentSceneMultiplicity: { status: 'VALID' },
    typedInitialStateCompatibility: { status: 'VALID' },
    boundsReady: true,
    floorMapReady: true,
    placementResult: {
      nativeClass: 'NATIVE_VALID_CLEAR'
    }
  });
  assert.equal(ready.ready, true);
  assert.equal(ready.blockers.length, 0);
  assert.equal(ready.persistentWriteAuthorized, false);
});

test('special, off-grid and unknown placement classes stay blocked regardless of generic validator success', async () => {
  const b = await binding();
  for (const evidence of [
    { restorationKind: 'PLAYER_HOUSE' },
    { buildingItemType: 'OffGridBuilding' },
    { buildingItemType: 'House', signals: {} }
  ]) {
    const result = b.ordinaryPlacementPreflight({
      evidence,
      destinationStockOwnership: { status: 'VALID' },
      currentSceneMultiplicity: { status: 'VALID' },
      typedInitialStateCompatibility: { status: 'VALID' },
      boundsReady: true,
      floorMapReady: true,
      placementResult: {
        nativeClass: 'NATIVE_VALID_CLEAR'
      }
    });
    assert.equal(result.ready, false);
    assert.equal(result.persistentWriteAuthorized, false);
  }
});
