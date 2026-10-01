import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const path = new URL('../static/ddv/core/world/v1.25/building-read-model-preflight-v125.json', import.meta.url);
const contract = JSON.parse(fs.readFileSync(path, 'utf8'));

test('v1.10 Building contract is exact-version read/model/preflight only', () => {
  assert.equal(contract.schema, 'ddv.building-read-model-preflight@1');
  assert.equal(contract.artifactId, 'DDV-BUILDING-V125-V1_10');
  assert.equal(contract.version, 'v1.10');
  assert.equal(contract.status, 'PROMOTED');
  assert.equal(contract.mutable, false);
  assert.equal(contract.target.platform, 'Nintendo Switch');
  assert.equal(contract.target.gameVersion, '1.25.0');
  assert.equal(contract.target.buildId, '52BD625D9B4E0053');
  assert.equal(contract.writerBoundary.persistentWriteAuthorized, false);
  assert.equal(contract.writerBoundary.WORLD_PERSISTENT_WRITE_V125, false);
  assert.deepEqual(contract.writerBoundary.authorizedActions, ['read', 'model', 'capture', 'preflight']);
  assert.ok(contract.writerBoundary.prohibitedActions.includes('Apply'));
  assert.ok(contract.writerBoundary.prohibitedActions.includes('atomic persistent commit'));
});

test('v1.10 does not rewrite protected v1.5/v1.7/v1.8/v1.9 baselines', () => {
  const prior = contract.sourceEvidence.protectedPriorContracts.join('\n');
  for (const version of ['v1.5', 'v1.7', 'v1.8', 'v1.9']) assert.match(prior, new RegExp(version.replace('.', '\\.')));
  assert.equal(contract.sourceEvidence.candidateContractSha256, 'a6dd394debdd57f491415be25e9c69200794b2adffef4c53b7d9b88cc49b9b2c');
});

test('Building identity keeps portable definition separate from save-local instance and PlayerHouse binding IDs', () => {
  assert.equal(contract.identity.portableDefinitionIdentity, 'ItemID');
  assert.equal(contract.identity.saveLocalInstanceIdentity, 'GridObject.ID');
  for (const local of ['GridObject.ID', 'GridID', 'HouseData.PlayerHouseIndex', 'PlayerHouse interior Grid IDs']) {
    assert.ok(contract.identity.destinationLocalIdentities.includes(local));
  }
});

test('typed Building state never falls back to generic Furniture serialization', () => {
  assert.deepEqual(contract.serializedStateFamilies.HouseData, ['Built', 'UpgradeState', 'PlayerHouseIndex']);
  assert.deepEqual(contract.serializedStateFamilies.BuildingWithSkinData, ['UpgradeState', 'CurrentSkinItemID']);
  assert.deepEqual(contract.serializedStateFamilies.StallData, ['UpgradeState', 'ShopData', 'CurrentSkinItemID']);
  assert.match(contract.serializedStateFamilies.rule, /must not fall back/);
});

test('ordinary classification is positive only after all House/Other special signals resolve false', () => {
  assert.deepEqual(contract.classification.houseOrOtherOrdinaryGate.eligibleBuildingItemTypes, ['House', 'Other']);
  assert.equal(contract.classification.houseOrOtherOrdinaryGate.unknownSignalResult, 'UNKNOWN_BUILDING_SEMANTICS');
  const required = contract.classification.houseOrOtherOrdinaryGate.requiredAuthoritativeFalseSignals;
  for (const signal of ['isPlayerHouse', 'isCharacterHouse', 'isFastTravel', 'hasBuildingStateSynchronizer', 'hasOtherGlobalOrSharedBinding']) {
    assert.ok(required.includes(signal));
  }
  assert.equal(contract.classification.directSpecialByBuildingItemType.Stall, 'SPECIAL_GRID_BUILDING');
  assert.equal(contract.classification.directSpecialByBuildingItemType.Garden, 'SPECIAL_GRID_BUILDING');
  assert.equal(contract.classification.directSpecialByBuildingItemType.PlayerHouse, 'SPECIAL_GRID_BUILDING');
  assert.equal(contract.classification.directSpecialByBuildingItemType.OffGridBuilding, 'OFF_GRID_BUILDING');
});

test('Building skin remains a typed portable linkage with native-equivalent validation gates', () => {
  assert.equal(contract.buildingSkin.portableCodec, 'ddv.building-skin@1');
  assert.deepEqual(contract.buildingSkin.portableState, ['targetBuildingItemId', 'skinItemId']);
  assert.equal(contract.buildingSkin.baseGridObjectItemIdReplacedBySkin, false);
  assert.equal(contract.buildingSkin.preflight.nonzeroSkinRequiresNativeEquivalentValidator, true);
  assert.equal(contract.buildingSkin.preflight.ownershipAvailabilityCompatibilityMustBeValidated, true);
  assert.equal(contract.buildingSkin.preflight.defaultResetSemanticsMayNotBeInferred, true);
});

test('PlayerHouse portable anchor and destination-local binding are separated', () => {
  assert.equal(contract.playerHouse.portableCodec, 'ddv.player-house-binding@1');
  assert.equal(contract.playerHouse.portableDefinitionAnchor, 'House.HouseItemID');
  assert.ok(contract.playerHouse.sourceAndDestinationLocalFields.includes('HouseData.PlayerHouseIndex'));
  assert.equal(contract.playerHouse.bindingValidation.indexZeroValid, true);
  assert.equal(contract.playerHouse.bindingValidation.noMatchingInterior, 'BLOCK_PLAYERHOUSE_CREATE_LIFECYCLE_REQUIRED');
  assert.equal(contract.playerHouse.bindingValidation.multipleMatchingInteriors, 'BLOCK_PLAYERHOUSE_AMBIGUOUS_DESTINATION_BINDING');
  assert.equal(contract.playerHouse.placementPolicy.status, 'FAIL_CLOSED');
});

test('ordinary same-grid transform has model/preflight eligibility but never persistent authorization', () => {
  const ordinary = contract.operationGates.sameGridTransform.ordinary;
  assert.equal(ordinary.modelEligibility, 'ELIGIBLE_FOR_READ_PREVIEW_PREFLIGHT');
  assert.equal(ordinary.persistentCommitAuthorized, false);
  assert.ok(ordinary.requires.includes('v1.7 bounds'));
  assert.ok(ordinary.requires.includes('v1.8 FloorType'));
  assert.ok(ordinary.requires.includes('v1.9 native placement legality'));
  assert.equal(contract.operationGates.sameGridTransform.specialOrUnknown.modelEligibility, 'BLOCKED');
});

test('cross-grid transfer, base replacement, and special placement remain explicit fail-closed blockers', () => {
  assert.equal(contract.operationGates.crossGridTransfer.status, 'BLOCKED');
  assert.equal(contract.operationGates.baseReplacement.status, 'BLOCKED');
  assert.equal(contract.operationGates.placement.specialOrOffGrid.status, 'BLOCKED');
  assert.equal(contract.operationGates.removal.status, 'BLOCKED_FOR_PERSISTENT_ACTION');
});

test('promotion review never promotes unresolved evidence to valid behavior', () => {
  const allowed = new Set([
    'PROMOTABLE_CONFIRMED',
    'PROMOTABLE_WITH_FAIL_CLOSED_BOUNDARY',
    'NOT_PROMOTABLE_YET',
    'NEEDS_TARGETED_01B_EVIDENCE',
    'NEEDS_RUNTIME_01E_EVIDENCE'
  ]);
  for (const entry of contract.promotionReview) assert.ok(allowed.has(entry.decision), entry.finding);
  assert.ok(contract.promotionReview.some((x) => x.decision === 'NEEDS_TARGETED_01B_EVIDENCE'));
  assert.ok(contract.promotionReview.some((x) => x.decision === 'NEEDS_RUNTIME_01E_EVIDENCE'));
  assert.equal(contract.unresolved.notRequiredForCurrentReadModelPreflightPromotion, true);
});

test('WEP activation replaces blanket blocker only with typed gates and keeps special Apply invalid', () => {
  assert.equal(contract.wepActivation.replaceBlanketBlocker, 'BUILDING_DESTINATION_SEMANTICS_UNRESOLVED');
  assert.equal(contract.wepActivation.withTypedCategoryGates, true);
  assert.ok(contract.wepActivation.safeToConsumeNow.includes('same-grid ordinary transform model eligibility'));
  assert.ok(contract.wepActivation.mustNotTreatAsValid.includes('PlayerHouse placement/apply'));
  assert.ok(contract.wepActivation.mustNotTreatAsValid.includes('generic base Building replacement'));
});
