import {
  ROADFENCE_NATIVE_CATALOG_SWITCH_V125
} from '../ddv/core/roadfence/catalog-v125-switch.js';
import {
  captureRoadFenceReaderRegionV125,
  readRoadFenceNativeGridV125
} from '../ddv/core/roadfence/native-reader-v125.js';
import type {
  CaptureRegion,
  EditorDocument,
  NetworkCaptureAdapter
} from './scene-capture-runtime.ts';
import {
  createFencePostLayoutDraft
} from './fence-post-edit-contract.ts';

type AnyRecord = Record<string, any>;

export const ROADFENCE_READER_MAIN_MERGE_COMMIT =
  '5691cf8ed9992e8e5b9d83ce1de99632e132bd63';

function clone<T>(value: T): T {
  return structuredClone(value);
}

function plain(value: unknown): value is AnyRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function safeInteger(value: unknown, code: string): number {
  const number = Number(value);
  if (!Number.isSafeInteger(number)) throw new Error(code);
  return number;
}

function resolveRootGrid(profile: AnyRecord, rootGridId: unknown) {
  if (!plain(profile) || Number(profile?.GameInfo?.Version) !== 624) {
    throw new Error('WEP_ROADFENCE_PROFILE_CONTRACT_MISMATCH');
  }
  const gridId = safeInteger(rootGridId, 'WEP_ROADFENCE_ROOT_GRID_ID_INVALID');
  const grids = profile?.World?.GridCollection?.Grids;
  const grid = grids?.[String(gridId)] ?? grids?.[gridId];
  if (!plain(grid) || Number(grid.ID) !== gridId) {
    throw new Error('WEP_ROADFENCE_ROOT_GRID_NOT_FOUND');
  }
  return { gridId, grid };
}

function assertWriteBoundary(value: AnyRecord) {
  if (value?.persistentWriteAuthorized !== false) {
    throw new Error('WEP_ROADFENCE_WRITE_BOUNDARY_VIOLATION');
  }
}

function readerBlockResult(readerResult: AnyRecord) {
  const issues = Array.isArray(readerResult?.issues)
    ? clone(readerResult.issues)
    : [];
  const firstCode =
    issues.find(
      (entry: unknown) =>
        plain(entry) && typeof entry.code === 'string' && entry.code.length > 0
    )?.code ?? 'ROADFENCE_NATIVE_READER_NOT_SUPPORTED';
  return {
    status: 'blocked',
    code: String(firstCode),
    issues,
    persistentWriteAuthorized: false
  };
}

export function createSwitchV125RoadFenceReaderBinding({
  profile,
  rootGridId
}: {
  profile: AnyRecord;
  rootGridId: unknown;
}) {
  const { gridId, grid } = resolveRootGrid(profile, rootGridId);
  const readerResult = readRoadFenceNativeGridV125({
    grid,
    gridId,
    catalog: ROADFENCE_NATIVE_CATALOG_SWITCH_V125
  });

  if (!plain(readerResult)) {
    throw new Error('WEP_ROADFENCE_READER_RESULT_INVALID');
  }
  assertWriteBoundary(readerResult);

  const safeSummary = Object.freeze({
    status: String(readerResult.status ?? 'blocked'),
    ok: readerResult.ok === true,
    gridId,
    roadNetworkCount: Array.isArray(readerResult.roads)
      ? readerResult.roads.length
      : 0,
    fenceNetworkCount: Array.isArray(readerResult.fences)
      ? readerResult.fences.length
      : 0,
    modeBoundaryTouchCount: Array.isArray(readerResult.modeBoundaryTouches)
      ? readerResult.modeBoundaryTouches.length
      : 0,
    coverage: clone(readerResult.coverage ?? {}),
    issues: clone(readerResult.issues ?? []),
    persistentWriteAuthorized: false
  });

  const captureFenceRepresentationModel = (networkId: string) => {
    if (readerResult.status !== 'supported' || readerResult.ok !== true) {
      return readerBlockResult(readerResult);
    }
    const result = createFencePostLayoutDraft(
      readerResult,
      String(networkId)
    );
    if (result?.draft?.persistentWriteAuthorized !== false) {
      throw new Error('WEP_FENCE_POST_WRITE_BOUNDARY_VIOLATION');
    }
    return clone(result);
  };

  const fenceRepresentationLayout = Object.freeze({
    contract: 'ddv.fence-representation-layout@1',
    promotionDocumentId: '15ddjUrtZFYFi5KZpmzsrVBArLy0BjBHnmF9_iCbi104',
    scope: 'read-model-preflight',
    persistentWriteAuthorized: false,
    listNetworks() {
      if (readerResult.status !== 'supported' || readerResult.ok !== true) {
        return [];
      }
      return (readerResult.fences ?? []).map((network: AnyRecord) => ({
        networkId: String(network.networkId),
        familyBaseItemID: Number(network.familyBaseItemID),
        familyName: String(network.familyName ?? ''),
        mode: String(network.mode ?? ''),
        logicalQuantity: Number(network.logicalQuantity ?? 0),
        persistentWriteAuthorized: false
      }));
    },
    captureModel: captureFenceRepresentationModel,
    createDraft: captureFenceRepresentationModel
  });

  const networkAdapter: NetworkCaptureAdapter = Object.freeze({
    capture(
      kind: 'roads' | 'fences',
      document: EditorDocument,
      region: CaptureRegion
    ) {
      if (
        Number(document?.target?.rootGridId) !== gridId ||
        document?.target?.gameVersion !== '1.25.0' ||
        document?.target?.platform !== 'Nintendo Switch'
      ) {
        return {
          status: 'blocked',
          code: 'WEP_ROADFENCE_DOCUMENT_TARGET_MISMATCH',
          issues: [
            {
              severity: 'BLOCK' as const,
              code: 'WEP_ROADFENCE_DOCUMENT_TARGET_MISMATCH'
            }
          ]
        };
      }

      if (readerResult.status !== 'supported' || readerResult.ok !== true) {
        return readerBlockResult(readerResult);
      }

      const captured = captureRoadFenceReaderRegionV125(
        readerResult,
        kind,
        clone(region)
      );
      if (!plain(captured)) {
        throw new Error('WEP_ROADFENCE_CAPTURE_RESULT_INVALID');
      }
      assertWriteBoundary(captured);
      return clone(captured);
    }
  });

  function captureRootDraft(document: EditorDocument) {
    const bounds = document?.metadata?.rootGridBounds;
    if (
      !bounds ||
      bounds.status !== 'AUTHORITATIVE_GRIDDATAPATH' ||
      !Number.isSafeInteger(Number(bounds.x)) ||
      !Number.isSafeInteger(Number(bounds.y)) ||
      !Number.isSafeInteger(Number(bounds.w)) ||
      !Number.isSafeInteger(Number(bounds.h)) ||
      Number(bounds.w) <= 0 ||
      Number(bounds.h) <= 0
    ) {
      return {
        status: 'blocked',
        code: 'WEP_ROADFENCE_ROOT_BOUNDS_REQUIRED',
        issues: [
          {
            severity: 'BLOCK' as const,
            code: 'WEP_ROADFENCE_ROOT_BOUNDS_REQUIRED'
          }
        ],
        networks: { roads: null, fences: null },
        persistentWriteAuthorized: false
      };
    }

    const region = {
      x: Number(bounds.x),
      y: Number(bounds.y),
      w: Number(bounds.w),
      h: Number(bounds.h)
    };
    const roads = networkAdapter.capture('roads', document, region);
    const fences = networkAdapter.capture('fences', document, region);
    const issues = [
      ...(roads?.issues ?? []),
      ...(fences?.issues ?? [])
    ];
    const supported =
      roads?.status === 'supported' &&
      fences?.status === 'supported';

    return {
      status: supported ? 'supported' : 'blocked',
      code: supported
        ? null
        : String(
            roads?.code ??
              fences?.code ??
              'WEP_ROADFENCE_ROOT_CAPTURE_BLOCKED'
          ),
      issues: clone(issues),
      networks: {
        roads:
          roads?.status === 'supported'
            ? clone(roads.data)
            : null,
        fences:
          fences?.status === 'supported'
            ? clone(fences.data)
            : null
      },
      persistentWriteAuthorized: false
    };
  }

  return Object.freeze({
    source: Object.freeze({
      mergeCommit: ROADFENCE_READER_MAIN_MERGE_COMMIT,
      gameVersion: '1.25.0',
      platform: 'Nintendo Switch',
      buildID: '52BD625D9B4E0053',
      rootGridId: gridId
    }),
    summary: safeSummary,
    networkAdapter,
    captureRootDraft,
    fenceRepresentationLayout,
    fencePostEditor: fenceRepresentationLayout,
    persistentWriteAuthorized: false
  });
}
