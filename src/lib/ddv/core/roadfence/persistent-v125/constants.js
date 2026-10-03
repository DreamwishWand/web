import { FenceMode } from '../logical.js';

export const ROADFENCE_PERSISTENT_COMPILER_V125_CONTRACT = 'ddv.roadfence-persistent-compiler@1';
export const ROADFENCE_NATIVE_MUTATION_SET_V125_CONTRACT = 'ddv.roadfence-native-mutation-set@1';
export const ROADFENCE_STRUCTURAL_TRANSACTION_DEPENDENCY = 'DDV-SAFE-STRUCTURAL-GRID-OBJECT-TRANSACTION-EXTENSION-V125-V1_0';
export const ROADFENCE_PERSISTENT_COMPILER_V125_ID = '01c-persistent-roadfence-compiler-writer-v125-v1';
export const ROADFENCE_SEMANTIC_OWNER = '01C CORE — Road / Fence';

export const CURRENT_GAME_VERSION = '1.25.0';
export const CURRENT_TID = '0100D39012C1A000';
export const CURRENT_BID = '52BD625D9B4E0053';
export const CURRENT_SCHEMA = 624;

export const ITEM = Object.freeze({
  MAIN_STREET: 40100068,
  PATH_GOLD: 40100038,
  BIOME2_FENCE: 40700246,
  FAIRY_LIGHT_FENCE: 40700268
});

export const RoadFenceWriterSupportStatus = Object.freeze({
  ROAD_CONFIRMED_WRITABLE: 'ROAD_CONFIRMED_WRITABLE',
  FENCE_CONFIRMED_WRITABLE: 'FENCE_CONFIRMED_WRITABLE',
  READ_MODEL_ONLY: 'READ_MODEL_ONLY',
  RUNTIME_REQUIRED: 'RUNTIME_REQUIRED',
  UNSUPPORTED: 'UNSUPPORTED',
  UNKNOWN: 'UNKNOWN'
});

export const RoadFencePersistentOperation = Object.freeze({
  ROAD_SET_TOPOLOGY: 'ROAD_SET_TOPOLOGY',
  ROAD_ERASE: 'ROAD_ERASE',
  ROAD_SAME_FAMILY_MERGE: 'ROAD_SAME_FAMILY_MERGE',
  FENCE_SET_TOPOLOGY: 'FENCE_SET_TOPOLOGY',
  FENCE_TOPOLOGY_ERASE: 'FENCE_TOPOLOGY_ERASE',
  FENCE_STYLE_REPLACE: 'FENCE_STYLE_REPLACE',
  FENCE_MOVE_POST: 'FENCE_MOVE_POST',
  FENCE_INSERT_POST: 'FENCE_INSERT_POST',
  FENCE_REMOVE_POST: 'FENCE_REMOVE_POST'
});

export const FENCE_GENERATED_LAYOUT_REQUEST_CONTRACT =
  'ddv.fence-generated-layout-request@1';

export const FenceRepresentationPolicy = Object.freeze({
  EXACT_PRESERVATION: 'EXACT_PRESERVATION',
  EXPLICIT_USER_LAYOUT: 'EXPLICIT_USER_LAYOUT',
  PRESERVE_EXISTING: 'PRESERVE_EXISTING',
  MANUAL_PINNED_POSTS: 'MANUAL_PINNED_POSTS',
  CENTERED_BALANCED: 'CENTERED_BALANCED',
  GENERATED_NATIVE_GREEDY: 'GENERATED_NATIVE_GREEDY'
});

export const REPRESENTATION_ONLY_FENCE_OPS = new Set([
  RoadFencePersistentOperation.FENCE_MOVE_POST,
  RoadFencePersistentOperation.FENCE_INSERT_POST,
  RoadFencePersistentOperation.FENCE_REMOVE_POST
]);

export function persistentModeState(mode) {
  if (mode === FenceMode.ORTHOGONAL) return null;
  if (mode === FenceMode.DIAGONAL) return { FenceMode: { Diagonal: true } };
  throw Object.assign(new Error('unsupported persistent mode'), { code: 'ROAD_MODE_STATE_UNSUPPORTED' });
}
