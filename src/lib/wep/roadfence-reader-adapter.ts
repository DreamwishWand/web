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

function positiveInteger(value: unknown, code: string) {
  const number = safeInteger(value, code);
  if (number <= 0) throw new Error(code);
  return number;
}

function normalizeRegion(region: CaptureRegion) {
  return {
    x: safeInteger(region?.x, 'WEP_ROADFENCE_DRAFT_REGION_INVALID'),
    y: safeInteger(region?.y, 'WEP_ROADFENCE_DRAFT_REGION_INVALID'),
    w: positiveInteger(region?.w, 'WEP_ROADFENCE_DRAFT_REGION_INVALID'),
    h: positiveInteger(region?.h, 'WEP_ROADFENCE_DRAFT_REGION_INVALID')
  };
}

function comparePoint(
  left: { x: number; y: number },
  right: { x: number; y: number }
) {
  return left.y - right.y || left.x - right.x;
}

function unitIntersectsRegion(
  point: AnyRecord,
  unitSpan: number,
  region: CaptureRegion
) {
  const x = safeInteger(point?.x, 'WEP_ROADFENCE_DRAFT_POINT_INVALID');
  const y = safeInteger(point?.y, 'WEP_ROADFENCE_DRAFT_POINT_INVALID');
  return (
    x < region.x + region.w &&
    x + unitSpan > region.x &&
    y < region.y + region.h &&
    y + unitSpan > region.y
  );
}

function unitContainedByRegion(
  point: AnyRecord,
  unitSpan: number,
  region: CaptureRegion
) {
  const x = safeInteger(point?.x, 'WEP_ROADFENCE_DRAFT_POINT_INVALID');
  const y = safeInteger(point?.y, 'WEP_ROADFENCE_DRAFT_POINT_INVALID');
  return (
    x >= region.x &&
    y >= region.y &&
    x + unitSpan <= region.x + region.w &&
    y + unitSpan <= region.y + region.h
  );
}

function draftNetworkPoints(kind: 'roads' | 'fences', network: AnyRecord) {
  if (kind === 'roads') {
    return Array.isArray(network?.cells) ? network.cells : [];
  }
  return Array.isArray(network?.graph?.nodes)
    ? network.graph.nodes
    : [];
}

function localizeDraftRoadNetwork(
  network: AnyRecord,
  region: CaptureRegion,
  artifactNetworkId: string
) {
  const cells = [...draftNetworkPoints('roads', network)]
    .map((cell: AnyRecord) => ({
      x:
        safeInteger(cell.x, 'WEP_ROADFENCE_DRAFT_POINT_INVALID') -
        region.x,
      y:
        safeInteger(cell.y, 'WEP_ROADFENCE_DRAFT_POINT_INVALID') -
        region.y,
      mode: String(cell.mode ?? 'orthogonal')
    }))
    .sort(comparePoint);
  return {
    networkId: artifactNetworkId,
    familyBaseItemID: positiveInteger(
      network.familyBaseItemID,
      'WEP_ROADFENCE_DRAFT_FAMILY_INVALID'
    ),
    ...(network.familyName
      ? { familyName: String(network.familyName) }
      : {}),
    cells
  };
}

function localizeDraftFenceNetwork(
  network: AnyRecord,
  region: CaptureRegion,
  artifactNetworkId: string
) {
  const sourceNodes = [...draftNetworkPoints('fences', network)]
    .map((node: AnyRecord) => ({
      sourceId: String(node.id ?? ''),
      x:
        safeInteger(node.x, 'WEP_ROADFENCE_DRAFT_POINT_INVALID') -
        region.x,
      y:
        safeInteger(node.y, 'WEP_ROADFENCE_DRAFT_POINT_INVALID') -
        region.y,
      mode: String(node.mode ?? network.mode ?? 'orthogonal')
    }))
    .sort(
      (left, right) =>
        comparePoint(left, right) ||
        left.sourceId.localeCompare(right.sourceId)
    );
  if (sourceNodes.some((node) => !node.sourceId)) {
    throw new Error('WEP_ROADFENCE_DRAFT_FENCE_NODE_ID_INVALID');
  }
  const idMap = new Map(
    sourceNodes.map((node, index) => [
      node.sourceId,
      `n${index}`
    ])
  );
  const nodes = sourceNodes.map((node, index) => ({
    id: `n${index}`,
    x: node.x,
    y: node.y,
    mode: node.mode
  }));
  const edges = [...(network?.graph?.edges ?? [])]
    .map((edge: AnyRecord) => ({
      a: idMap.get(String(edge.a ?? '')),
      b: idMap.get(String(edge.b ?? ''))
    }))
    .sort((left, right) =>
      `${left.a}:${left.b}`.localeCompare(
        `${right.a}:${right.b}`
      )
    );
  if (edges.some((edge) => !edge.a || !edge.b)) {
    throw new Error('WEP_ROADFENCE_DRAFT_FENCE_EDGE_INVALID');
  }
  return {
    networkId: artifactNetworkId,
    familyBaseItemID: positiveInteger(
      network.familyBaseItemID,
      'WEP_ROADFENCE_DRAFT_FAMILY_INVALID'
    ),
    ...(network.familyName
      ? { familyName: String(network.familyName) }
      : {}),
    mode: String(network.mode ?? 'orthogonal'),
    graph: { nodes, edges }
  };
}

export function createDraftAwareNetworkCaptureAdapter(
  baseAdapter: NetworkCaptureAdapter | null = null
): NetworkCaptureAdapter {
  return Object.freeze({
    capture(
      kind: 'roads' | 'fences',
      document: EditorDocument,
      regionInput: CaptureRegion
    ) {
      const container = (document as AnyRecord)?.networks?.[kind];
      if (!plain(container)) {
        return baseAdapter
          ? baseAdapter.capture(kind, document, regionInput)
          : {
              status: 'blocked',
              code: 'WEP_ROADFENCE_DRAFT_CAPTURE_UNAVAILABLE',
              issues: [
                {
                  severity: 'BLOCK' as const,
                  code: 'WEP_ROADFENCE_DRAFT_CAPTURE_UNAVAILABLE'
                }
              ]
            };
      }
      if (
        container.schema !== 'dreamwish-wand-wep-network-capture' ||
        Number(container.version) !== 1 ||
        container.kind !== kind ||
        container.originPolicy !== 'root-grid-top-left'
      ) {
        return {
          status: 'blocked',
          code: 'WEP_ROADFENCE_DRAFT_CAPTURE_CONTRACT_MISMATCH',
          issues: [
            {
              severity: 'BLOCK' as const,
              code: 'WEP_ROADFENCE_DRAFT_CAPTURE_CONTRACT_MISMATCH'
            }
          ]
        };
      }
      assertWriteBoundary(container);

      const unitSpan = positiveInteger(
        (document as AnyRecord)?.target?.tessellationFactor,
        'WEP_ROADFENCE_DRAFT_UNIT_SPAN_UNRESOLVED'
      );
      const region = normalizeRegion(regionInput);
      const source = Array.isArray(container.networks)
        ? container.networks
        : [];
      const contained: AnyRecord[] = [];
      const clipped: AnyRecord[] = [];

      for (const network of source) {
        if (!plain(network)) {
          throw new Error('WEP_ROADFENCE_DRAFT_NETWORK_INVALID');
        }
        const points = draftNetworkPoints(kind, network);
        if (!points.length) continue;
        const touches = points.some((point: AnyRecord) =>
          unitIntersectsRegion(point, unitSpan, region)
        );
        if (!touches) continue;
        const fullyContained = points.every((point: AnyRecord) =>
          unitContainedByRegion(point, unitSpan, region)
        );
        if (fullyContained) contained.push(network);
        else clipped.push(network);
      }

      if (clipped.length) {
        return {
          status: 'blocked',
          code: 'TOPOLOGY_CLIPPED_UNSUPPORTED',
          issues: clipped.map((network) => ({
            severity: 'BLOCK' as const,
            code: 'TOPOLOGY_CLIPPED_UNSUPPORTED',
            kind,
            networkId: String(network.networkId ?? ''),
            familyBaseItemID: Number(network.familyBaseItemID ?? 0)
          }))
        };
      }

      contained.sort((left, right) => {
        const leftPoints = [...draftNetworkPoints(kind, left)].sort(comparePoint);
        const rightPoints = [...draftNetworkPoints(kind, right)].sort(comparePoint);
        const a = leftPoints[0] ?? { x: Number.MAX_SAFE_INTEGER, y: Number.MAX_SAFE_INTEGER };
        const b = rightPoints[0] ?? { x: Number.MAX_SAFE_INTEGER, y: Number.MAX_SAFE_INTEGER };
        return (
          comparePoint(a, b) ||
          Number(left.familyBaseItemID ?? 0) -
            Number(right.familyBaseItemID ?? 0) ||
          String(left.networkId ?? '').localeCompare(
            String(right.networkId ?? '')
          )
        );
      });

      const sourceToArtifact = new Map<string, string>();
      const networks = contained.map((network, index) => {
        const artifactNetworkId =
          kind === 'roads' ? `r${index}` : `f${index}`;
        sourceToArtifact.set(
          String(network.networkId ?? ''),
          artifactNetworkId
        );
        return kind === 'roads'
          ? localizeDraftRoadNetwork(
              network,
              region,
              artifactNetworkId
            )
          : localizeDraftFenceNetwork(
              network,
              region,
              artifactNetworkId
            );
      });

      const modeBoundaryTouches =
        kind === 'fences' &&
        Array.isArray(container.modeBoundaryTouches)
          ? container.modeBoundaryTouches
              .filter(
                (touch: AnyRecord) =>
                  sourceToArtifact.has(
                    String(touch?.a?.networkId ?? '')
                  ) &&
                  sourceToArtifact.has(
                    String(touch?.b?.networkId ?? '')
                  )
              )
              .map((touch: AnyRecord) => ({
                classification: String(
                  touch.classification ?? ''
                ),
                authoritativeConnectedEdge: false,
                a: {
                  networkId: sourceToArtifact.get(
                    String(touch.a.networkId)
                  ),
                  x:
                    safeInteger(
                      touch.a.x,
                      'WEP_ROADFENCE_DRAFT_POINT_INVALID'
                    ) - region.x,
                  y:
                    safeInteger(
                      touch.a.y,
                      'WEP_ROADFENCE_DRAFT_POINT_INVALID'
                    ) - region.y,
                  mode: String(touch.a.mode ?? '')
                },
                b: {
                  networkId: sourceToArtifact.get(
                    String(touch.b.networkId)
                  ),
                  x:
                    safeInteger(
                      touch.b.x,
                      'WEP_ROADFENCE_DRAFT_POINT_INVALID'
                    ) - region.x,
                  y:
                    safeInteger(
                      touch.b.y,
                      'WEP_ROADFENCE_DRAFT_POINT_INVALID'
                    ) - region.y,
                  mode: String(touch.b.mode ?? '')
                }
              }))
          : [];

      return {
        status: 'supported',
        data: {
          schema: 'dreamwish-wand-wep-network-capture',
          version: 1,
          kind,
          originPolicy: 'capture-region-top-left',
          networks,
          ...(modeBoundaryTouches.length
            ? { modeBoundaryTouches }
            : {}),
          normalization: {
            sourceGridObjectIdsRemoved: true,
            artifactNetworkIdsLocal: true,
            partialTopologyFailsClosed: true
          },
          persistentWriteAuthorized: false
        }
      };
    }
  });
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
    const bounds = document?.metadata?.rootGridBounds as AnyRecord | null | undefined;
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
