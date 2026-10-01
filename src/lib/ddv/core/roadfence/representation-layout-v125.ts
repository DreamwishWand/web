import {
  ROADFENCE_NATIVE_CATALOG_SWITCH_V125
} from './catalog-v125-switch.js';
import {
  FenceMode
} from './logical.js';

type AnyRecord = Record<string, any>;

export const FENCE_REPRESENTATION_LAYOUT_SCHEMA =
  'ddv.fence-representation-layout@1';

export const FENCE_REPRESENTATION_LAYOUT_PROMOTION = Object.freeze({
  sourceDocumentId: '15ddjUrtZFYFi5KZpmzsrVBArLy0BjBHnmF9_iCbi104',
  gameVersion: '1.25.0',
  platform: 'Nintendo Switch',
  scope: 'read-model-preflight',
  persistentWriteAuthorized: false
});

export const FENCE_REPRESENTATION_LAYOUT_ERROR = Object.freeze({
  SEMANTIC_ANCHOR_IMMUTABLE:
    'FENCE_POST_SEMANTIC_ANCHOR_IMMUTABLE',
  INTERVAL_OVER_MAX:
    'FENCE_POST_INTERVAL_OVER_MAX',
  INTERVAL_UNSUPPORTED:
    'FENCE_POST_INTERVAL_UNSUPPORTED',
  OFF_RUN:
    'FENCE_POST_OFF_RUN',
  TOPOLOGY_CHANGED:
    'FENCE_POST_LAYOUT_TOPOLOGY_CHANGED',
  QUANTITY_CHANGED:
    'FENCE_POST_LAYOUT_QUANTITY_CHANGED'
});

export const FENCE_REPRESENTATION_INTENT = Object.freeze({
  EXACT_PRESERVATION: 'EXACT_PRESERVATION',
  GENERATED_DESIGN: 'GENERATED_DESIGN'
});

export const FENCE_REPRESENTATION_POLICY = Object.freeze({
  PRESERVE_EXISTING: 'PRESERVE_EXISTING',
  MANUAL_PINNED_POSTS: 'MANUAL_PINNED_POSTS',
  CENTERED_BALANCED: 'CENTERED_BALANCED'
});

function clone<T>(value: T): T {
  return structuredClone(value);
}

function plain(value: unknown): value is AnyRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function int(value: unknown) {
  const n = Number(value);
  return Number.isSafeInteger(n) ? n : null;
}

function coordKey(x: unknown, y: unknown) {
  return `${Number(x)},${Number(y)}`;
}

function edgeKey(a: string, b: string) {
  return a < b ? `${a}::${b}` : `${b}::${a}`;
}

function issue(
  code: string,
  detail: Record<string, unknown> = {}
) {
  return {
    severity: 'BLOCK' as const,
    code,
    ...clone(detail)
  };
}

function familyDescriptors(familyBaseItemID: number): AnyRecord[] {
  return Object.entries(
    ROADFENCE_NATIVE_CATALOG_SWITCH_V125.fenceItems
  )
    .map(([itemID, value]): AnyRecord => ({
      itemID: Number(itemID),
      ...((value ?? {}) as AnyRecord)
    }))
    .filter(
      (entry: AnyRecord) =>
        Number(entry.familyBaseItemID) === familyBaseItemID
    );
}

export function exactFenceExtensionKeys(
  familyBaseItemID: unknown,
  mode: unknown
) {
  const familyId = int(familyBaseItemID);
  const normalizedMode = String(mode ?? '');
  if (
    familyId === null ||
    ![FenceMode.ORTHOGONAL, FenceMode.DIAGONAL].includes(
      normalizedMode as any
    )
  ) {
    return [];
  }
  const role =
    normalizedMode === FenceMode.DIAGONAL ? 'diagExt' : 'ext';
  return Array.from(
    new Set(
      familyDescriptors(familyId)
        .filter((entry) => entry.role === role)
        .map((entry) => int(entry.key))
        .filter(
          (value): value is number =>
            value !== null && value > 0
        )
    )
  ).sort((a, b) => a - b);
}

export function fenceRepresentationCatalogConstraints(
  familyBaseItemID: unknown,
  mode: unknown
) {
  const familyId = int(familyBaseItemID);
  const normalizedMode = String(mode ?? '');
  const family =
    familyId === null ? [] : familyDescriptors(familyId);
  const base = family.find((entry) => entry.role === 'base');
  const exactExtensionKeys = exactFenceExtensionKeys(
    familyId,
    normalizedMode
  );

  if (
    familyId === null ||
    !base ||
    ![FenceMode.ORTHOGONAL, FenceMode.DIAGONAL].includes(
      normalizedMode as any
    ) ||
    exactExtensionKeys.length === 0
  ) {
    return {
      ok: false,
      familyBaseItemID: familyId,
      familyName: String(base?.familyName ?? ''),
      mode: normalizedMode,
      exactExtensionKeys,
      supportedIntervals: [1],
      minimumPostInterval: 1,
      maximumPostInterval: null,
      issues: [
        issue(
          FENCE_REPRESENTATION_LAYOUT_ERROR.INTERVAL_UNSUPPORTED,
          {
            familyBaseItemID: familyId,
            mode: normalizedMode,
            reason: 'CORE_FAMILY_MODE_EXTENSION_VOCABULARY_UNAVAILABLE'
          }
        )
      ],
      source: '01C_VERSIONED_FAMILY_MODE_CATALOG',
      persistentWriteAuthorized: false
    };
  }

  const maximumPostInterval =
    1 + Math.max(...exactExtensionKeys);
  return {
    ok: true,
    familyBaseItemID: familyId,
    familyName: String(base.familyName ?? ''),
    mode: normalizedMode,
    exactExtensionKeys,
    supportedIntervals: [
      1,
      ...exactExtensionKeys.map((key) => key + 1)
    ],
    minimumPostInterval: 1,
    maximumPostInterval,
    issues: [],
    source: '01C_VERSIONED_FAMILY_MODE_CATALOG',
    persistentWriteAuthorized: false
  };
}

function graphIndex(graph: AnyRecord, fallbackMode: string) {
  if (
    !plain(graph) ||
    !Array.isArray(graph.nodes) ||
    !Array.isArray(graph.edges)
  ) {
    throw new Error('CORE_FENCE_REPRESENTATION_GRAPH_INVALID');
  }
  const nodes = new Map<string, AnyRecord>();
  for (const raw of graph.nodes) {
    const id = String(raw?.id ?? '');
    const x = int(raw?.x);
    const y = int(raw?.y);
    if (!id || x === null || y === null || nodes.has(id)) {
      throw new Error('CORE_FENCE_REPRESENTATION_NODE_INVALID');
    }
    nodes.set(id, {
      id,
      x,
      y,
      mode: String(raw?.mode ?? fallbackMode)
    });
  }
  const adjacency = new Map(
    [...nodes.keys()].map((id) => [id, new Set<string>()])
  );
  const seenEdges = new Set<string>();
  for (const raw of graph.edges) {
    const a = String(raw?.a ?? '');
    const b = String(raw?.b ?? '');
    const key = edgeKey(a, b);
    if (
      !nodes.has(a) ||
      !nodes.has(b) ||
      a === b ||
      seenEdges.has(key)
    ) {
      throw new Error('CORE_FENCE_REPRESENTATION_EDGE_INVALID');
    }
    seenEdges.add(key);
    adjacency.get(a)!.add(b);
    adjacency.get(b)!.add(a);
  }
  return { nodes, adjacency };
}

function straightDegreeTwo(
  nodeId: string,
  nodes: Map<string, AnyRecord>,
  adjacency: Map<string, Set<string>>
) {
  const links = [...(adjacency.get(nodeId) ?? [])];
  if (links.length !== 2) return false;
  const node = nodes.get(nodeId)!;
  const a = nodes.get(links[0])!;
  const b = nodes.get(links[1])!;
  const dx1 = Math.sign(a.x - node.x);
  const dy1 = Math.sign(a.y - node.y);
  const dx2 = Math.sign(b.x - node.x);
  const dy2 = Math.sign(b.y - node.y);
  return dx1 === -dx2 && dy1 === -dy2;
}

function semanticReason(
  nodeId: string,
  nodes: Map<string, AnyRecord>,
  adjacency: Map<string, Set<string>>,
  modeBoundaryNodeIds: Set<string>
) {
  if (modeBoundaryNodeIds.has(nodeId)) return 'MODE_BOUNDARY';
  const degree = adjacency.get(nodeId)?.size ?? 0;
  if (degree <= 1) return 'ENDPOINT';
  if (degree >= 3) return 'JUNCTION';
  if (!straightDegreeTwo(nodeId, nodes, adjacency)) {
    return 'CORNER';
  }
  return null;
}

function normalizedTopologyShape(logicalTopology: AnyRecord) {
  const mode = String(logicalTopology?.mode ?? '');
  const graph = logicalTopology?.graph ?? {};
  const nodes = Array.isArray(graph.nodes)
    ? graph.nodes
        .map((node: AnyRecord) => ({
          id: String(node?.id ?? ''),
          x: Number(node?.x),
          y: Number(node?.y),
          mode: String(node?.mode ?? mode)
        }))
        .sort((a: AnyRecord, b: AnyRecord) =>
          a.id.localeCompare(b.id)
        )
    : [];
  const edges = Array.isArray(graph.edges)
    ? graph.edges
        .map((edge: AnyRecord) => {
          const a = String(edge?.a ?? '');
          const b = String(edge?.b ?? '');
          return a < b ? { a, b } : { a: b, b: a };
        })
        .sort((a: AnyRecord, b: AnyRecord) =>
          edgeKey(a.a, a.b).localeCompare(edgeKey(b.a, b.b))
        )
    : [];
  return {
    familyBaseItemID: Number(logicalTopology?.familyBaseItemID),
    mode,
    graph: { nodes, edges }
  };
}

export function fenceLogicalTopologyFingerprint(
  logicalTopology: AnyRecord
) {
  return JSON.stringify(normalizedTopologyShape(logicalTopology));
}

function modeBoundaryNodeIds(
  readerResult: AnyRecord,
  networkId: string,
  nodesByCoordinate: Map<string, AnyRecord>
) {
  const output = new Set<string>();
  for (const touch of readerResult?.modeBoundaryTouches ?? []) {
    for (const side of [touch?.a, touch?.b]) {
      if (String(side?.networkId ?? '') !== networkId) continue;
      const node = nodesByCoordinate.get(
        coordKey(side?.x, side?.y)
      );
      if (node) output.add(String(node.id));
    }
  }
  return output;
}

function buildSemanticAnchorsAndRuns(
  graph: AnyRecord,
  mode: string,
  explicitModeBoundaryNodeIds: string[]
) {
  const { nodes, adjacency } = graphIndex(graph, mode);
  const boundaryIds = new Set(explicitModeBoundaryNodeIds);
  const semanticAnchors: AnyRecord[] = [];
  const semanticIds = new Set<string>();

  for (const node of nodes.values()) {
    const reason = semanticReason(
      node.id,
      nodes,
      adjacency,
      boundaryIds
    );
    if (!reason) continue;
    semanticIds.add(node.id);
    semanticAnchors.push({
      nodeId: node.id,
      x: node.x,
      y: node.y,
      reason
    });
  }

  if (nodes.size > 1 && semanticIds.size === 0) {
    throw new Error(
      'CORE_FENCE_REPRESENTATION_SEMANTIC_ANCHOR_UNRESOLVED'
    );
  }

  const visitedEdges = new Set<string>();
  const runs: AnyRecord[] = [];
  const dedupe = new Set<string>();

  for (const startId of semanticIds) {
    for (const firstId of adjacency.get(startId) ?? []) {
      const initialEdge = edgeKey(startId, firstId);
      if (visitedEdges.has(initialEdge)) continue;

      const path = [startId, firstId];
      visitedEdges.add(initialEdge);
      let previous = startId;
      let current = firstId;

      while (!semanticIds.has(current)) {
        const next = [...(adjacency.get(current) ?? [])].filter(
          (id) => id !== previous
        );
        if (next.length !== 1) {
          throw new Error(
            'CORE_FENCE_REPRESENTATION_RUN_DECOMPOSITION_INVALID'
          );
        }
        const nextId = next[0];
        visitedEdges.add(edgeKey(current, nextId));
        path.push(nextId);
        previous = current;
        current = nextId;
      }

      const edgeSignature = path
        .slice(1)
        .map((id, index) => edgeKey(path[index], id))
        .sort()
        .join('|');
      if (dedupe.has(edgeSignature)) continue;
      dedupe.add(edgeSignature);

      const forward =
        String(path[0]).localeCompare(String(path[path.length - 1])) <= 0;
      const nodeIds = forward ? path : [...path].reverse();
      runs.push({
        runId: `run:${runs.length}`,
        mode,
        nodeIds,
        startAnchorNodeId: nodeIds[0],
        endAnchorNodeId: nodeIds[nodeIds.length - 1],
        intervalLength: nodeIds.length - 1
      });
    }
  }

  semanticAnchors.sort((a, b) =>
    String(a.nodeId).localeCompare(String(b.nodeId))
  );
  return { semanticAnchors, runs, nodes, adjacency };
}

function capturedBaseNodeIds(
  readerResult: AnyRecord,
  network: AnyRecord,
  nodesByCoordinate: Map<string, AnyRecord>
) {
  const provenance =
    readerResult?.provenance?.fences?.[network.networkId];
  const nativeObjects = Array.isArray(provenance?.nativeObjects)
    ? provenance.nativeObjects
    : [];
  const pitch = int(network?.coordinateSpace?.savePitch);
  const residueX = int(network?.coordinateSpace?.saveResidueX);
  const residueY = int(network?.coordinateSpace?.saveResidueY);
  if (
    pitch === null ||
    pitch <= 0 ||
    residueX === null ||
    residueY === null
  ) {
    throw new Error(
      'CORE_FENCE_REPRESENTATION_COORDINATE_SPACE_INVALID'
    );
  }

  const output = new Set<string>();
  for (const entry of nativeObjects) {
    if (entry?.role !== 'base') continue;
    const sx = int(entry?.x);
    const sy = int(entry?.y);
    if (sx === null || sy === null) continue;
    const logicalX = (sx - residueX) / pitch;
    const logicalY = (sy - residueY) / pitch;
    if (
      !Number.isSafeInteger(logicalX) ||
      !Number.isSafeInteger(logicalY)
    ) {
      continue;
    }
    const node = nodesByCoordinate.get(
      coordKey(logicalX, logicalY)
    );
    if (node) output.add(String(node.id));
  }
  return output;
}

function runByInteriorNode(logicalTopology: AnyRecord) {
  const output = new Map<string, AnyRecord>();
  for (const run of logicalTopology?.runs ?? []) {
    const ids = Array.isArray(run?.nodeIds) ? run.nodeIds : [];
    for (let index = 1; index < ids.length - 1; index += 1) {
      const nodeId = String(ids[index]);
      if (output.has(nodeId)) {
        throw new Error(
          'CORE_FENCE_REPRESENTATION_INTERIOR_RUN_AMBIGUOUS'
        );
      }
      output.set(nodeId, run);
    }
  }
  return output;
}

export function captureFenceRepresentationLayoutModel(
  readerResult: AnyRecord,
  networkId: string
) {
  if (
    !plain(readerResult) ||
    readerResult.status !== 'supported' ||
    readerResult.ok !== true ||
    readerResult.persistentWriteAuthorized !== false
  ) {
    throw new Error(
      'CORE_FENCE_REPRESENTATION_READER_UNSUPPORTED'
    );
  }
  const network = (readerResult.fences ?? []).find(
    (entry: AnyRecord) =>
      String(entry?.networkId ?? '') === String(networkId)
  );
  if (
    !plain(network) ||
    network.kind !== 'fence' ||
    !plain(network.graph)
  ) {
    throw new Error(
      'CORE_FENCE_REPRESENTATION_NETWORK_UNRESOLVED'
    );
  }

  const familyBaseItemID = int(network.familyBaseItemID);
  const logicalQuantity = int(network.logicalQuantity);
  const mode = String(network.mode ?? '');
  if (
    familyBaseItemID === null ||
    logicalQuantity === null ||
    logicalQuantity < 1
  ) {
    throw new Error(
      'CORE_FENCE_REPRESENTATION_NETWORK_IDENTITY_INVALID'
    );
  }

  const graph = clone(network.graph);
  const initialIndex = graphIndex(graph, mode);
  const nodesByCoordinate = new Map(
    [...initialIndex.nodes.values()].map((node) => [
      coordKey(node.x, node.y),
      node
    ])
  );
  const boundaryIds = [
    ...modeBoundaryNodeIds(
      readerResult,
      String(network.networkId),
      nodesByCoordinate
    )
  ];
  const topology = buildSemanticAnchorsAndRuns(
    graph,
    mode,
    boundaryIds
  );
  const logicalTopology = {
    familyBaseItemID,
    familyName: String(network.familyName ?? ''),
    mode,
    logicalQuantity,
    graph,
    modeBoundaryNodeIds: boundaryIds.sort(),
    semanticAnchors: topology.semanticAnchors,
    runs: topology.runs
  };
  const fingerprint =
    fenceLogicalTopologyFingerprint(logicalTopology);
  const semanticIds = new Set(
    topology.semanticAnchors.map((entry) =>
      String(entry.nodeId)
    )
  );
  const nodeRun = runByInteriorNode(logicalTopology);
  const capturedBases = capturedBaseNodeIds(
    readerResult,
    network,
    nodesByCoordinate
  );
  const posts: AnyRecord[] = [];

  for (const nodeId of capturedBases) {
    if (semanticIds.has(nodeId)) continue;
    const node = topology.nodes.get(nodeId);
    const run = nodeRun.get(nodeId);
    if (
      !node ||
      !run ||
      !straightDegreeTwo(
        nodeId,
        topology.nodes,
        topology.adjacency
      )
    ) {
      continue;
    }
    posts.push({
      kind: 'DEGREE2_INTERIOR_POST',
      nodeId,
      runId: String(run.runId),
      x: node.x,
      y: node.y,
      pinned: true,
      source: 'CAPTURED_NATIVE_BASE'
    });
  }
  posts.sort((a, b) =>
    String(a.runId).localeCompare(String(b.runId)) ||
    Number(a.x) - Number(b.x) ||
    Number(a.y) - Number(b.y)
  );

  const model = {
    schema: FENCE_REPRESENTATION_LAYOUT_SCHEMA,
    contractSource: clone(FENCE_REPRESENTATION_LAYOUT_PROMOTION),
    networkId: String(network.networkId),
    logicalTopology,
    representationLayout: {
      intent: FENCE_REPRESENTATION_INTENT.EXACT_PRESERVATION,
      policy: FENCE_REPRESENTATION_POLICY.PRESERVE_EXISTING,
      posts
    },
    invariants: {
      sourceTopologyFingerprint: fingerprint,
      sourceLogicalQuantity: logicalQuantity
    },
    provenance: {
      saveLocalGridObjectIdentityExcluded: true,
      capturedNativeRepresentationPreserved: true
    },
    persistentWriteAuthorized: false
  };
  return {
    model,
    validation: validateFenceRepresentationLayoutModel(model)
  };
}

function intervalValidation(
  logicalTopology: AnyRecord,
  representationLayout: AnyRecord,
  constraints: AnyRecord
) {
  const issues: AnyRecord[] = [];
  const intervals: AnyRecord[] = [];
  const postsByRun = new Map<string, AnyRecord[]>();
  for (const post of representationLayout?.posts ?? []) {
    const runId = String(post?.runId ?? '');
    if (!postsByRun.has(runId)) postsByRun.set(runId, []);
    postsByRun.get(runId)!.push(post);
  }

  const supported = new Set<number>(
    constraints.supportedIntervals ?? []
  );
  for (const run of logicalTopology?.runs ?? []) {
    const nodeIds = Array.isArray(run?.nodeIds)
      ? run.nodeIds.map(String)
      : [];
    const indexes = [0, Math.max(0, nodeIds.length - 1)];
    for (const post of postsByRun.get(String(run.runId)) ?? []) {
      const index = nodeIds.indexOf(String(post.nodeId));
      if (index <= 0 || index >= nodeIds.length - 1) {
        issues.push(
          issue(FENCE_REPRESENTATION_LAYOUT_ERROR.OFF_RUN, {
            nodeId: String(post.nodeId ?? ''),
            runId: String(run.runId)
          })
        );
        continue;
      }
      indexes.push(index);
    }
    const unique = Array.from(new Set(indexes)).sort(
      (a, b) => a - b
    );
    for (let i = 1; i < unique.length; i += 1) {
      const distance = unique[i] - unique[i - 1];
      const current = {
        runId: String(run.runId),
        fromNodeId: nodeIds[unique[i - 1]],
        toNodeId: nodeIds[unique[i]],
        distance
      };
      intervals.push(current);
      if (
        constraints.maximumPostInterval !== null &&
        distance > constraints.maximumPostInterval
      ) {
        issues.push(
          issue(
            FENCE_REPRESENTATION_LAYOUT_ERROR.INTERVAL_OVER_MAX,
            {
              ...current,
              maximumPostInterval:
                constraints.maximumPostInterval
            }
          )
        );
      } else if (!supported.has(distance)) {
        issues.push(
          issue(
            FENCE_REPRESENTATION_LAYOUT_ERROR.INTERVAL_UNSUPPORTED,
            {
              ...current,
              exactExtensionKeys: clone(
                constraints.exactExtensionKeys ?? []
              )
            }
          )
        );
      }
    }
  }
  return { intervals, issues };
}

export function validateFenceRepresentationLayoutModel(
  model: AnyRecord
) {
  const issues: AnyRecord[] = [];
  if (
    !plain(model) ||
    model.schema !== FENCE_REPRESENTATION_LAYOUT_SCHEMA ||
    model.persistentWriteAuthorized !== false ||
    !plain(model.logicalTopology) ||
    !plain(model.representationLayout) ||
    !plain(model.invariants)
  ) {
    return {
      ok: false,
      issues: [
        issue(FENCE_REPRESENTATION_LAYOUT_ERROR.OFF_RUN, {
          reason: 'CORE_FENCE_REPRESENTATION_MODEL_INVALID'
        })
      ],
      topologyPreserved: false,
      logicalQuantityPreserved: false,
      constraints: null,
      intervals: [],
      persistentWriteAuthorized: false
    };
  }

  let topology: ReturnType<typeof buildSemanticAnchorsAndRuns>;
  try {
    topology = buildSemanticAnchorsAndRuns(
      model.logicalTopology.graph,
      String(model.logicalTopology.mode ?? ''),
      Array.isArray(model.logicalTopology.modeBoundaryNodeIds)
        ? model.logicalTopology.modeBoundaryNodeIds.map(String)
        : []
    );
  } catch (error) {
    issues.push(
      issue(FENCE_REPRESENTATION_LAYOUT_ERROR.TOPOLOGY_CHANGED, {
        reason:
          error instanceof Error ? error.message : String(error)
      })
    );
    return {
      ok: false,
      issues,
      topologyPreserved: false,
      logicalQuantityPreserved: false,
      constraints: null,
      intervals: [],
      persistentWriteAuthorized: false
    };
  }

  const currentFingerprint =
    fenceLogicalTopologyFingerprint(model.logicalTopology);
  const topologyPreserved =
    currentFingerprint ===
    String(model.invariants.sourceTopologyFingerprint ?? '');
  if (!topologyPreserved) {
    issues.push(
      issue(FENCE_REPRESENTATION_LAYOUT_ERROR.TOPOLOGY_CHANGED)
    );
  }

  const currentQuantity = int(
    model.logicalTopology.logicalQuantity
  );
  const sourceQuantity = int(
    model.invariants.sourceLogicalQuantity
  );
  const logicalQuantityPreserved =
    currentQuantity !== null &&
    sourceQuantity !== null &&
    currentQuantity === sourceQuantity;
  if (!logicalQuantityPreserved) {
    issues.push(
      issue(FENCE_REPRESENTATION_LAYOUT_ERROR.QUANTITY_CHANGED, {
        sourceLogicalQuantity: sourceQuantity,
        currentLogicalQuantity: currentQuantity
      })
    );
  }

  const expectedAnchors = topology.semanticAnchors.map(
    (entry) => ({
      nodeId: String(entry.nodeId),
      reason: String(entry.reason)
    })
  );
  const actualAnchors = Array.isArray(
    model.logicalTopology.semanticAnchors
  )
    ? model.logicalTopology.semanticAnchors
        .map((entry: AnyRecord) => ({
          nodeId: String(entry?.nodeId ?? ''),
          reason: String(entry?.reason ?? '')
        }))
        .sort((a: AnyRecord, b: AnyRecord) =>
          a.nodeId.localeCompare(b.nodeId)
        )
    : [];
  if (
    JSON.stringify(expectedAnchors) !==
    JSON.stringify(actualAnchors)
  ) {
    issues.push(
      issue(FENCE_REPRESENTATION_LAYOUT_ERROR.TOPOLOGY_CHANGED, {
        reason: 'SEMANTIC_ANCHOR_SET_CHANGED'
      })
    );
  }

  const constraints = fenceRepresentationCatalogConstraints(
    model.logicalTopology.familyBaseItemID,
    model.logicalTopology.mode
  );
  if (!constraints.ok) issues.push(...constraints.issues);

  const semanticIds = new Set(
    topology.semanticAnchors.map((entry) =>
      String(entry.nodeId)
    )
  );
  const nodeRun = runByInteriorNode({
    ...model.logicalTopology,
    runs: topology.runs
  });
  const seenPosts = new Set<string>();

  for (const post of model.representationLayout.posts ?? []) {
    const nodeId = String(post?.nodeId ?? '');
    const run = nodeRun.get(nodeId);
    if (semanticIds.has(nodeId)) {
      issues.push(
        issue(
          FENCE_REPRESENTATION_LAYOUT_ERROR
            .SEMANTIC_ANCHOR_IMMUTABLE,
          { nodeId }
        )
      );
      continue;
    }
    if (
      seenPosts.has(nodeId) ||
      !run ||
      String(post?.runId ?? '') !== String(run.runId) ||
      post?.kind !== 'DEGREE2_INTERIOR_POST' ||
      !topology.nodes.has(nodeId) ||
      !straightDegreeTwo(
        nodeId,
        topology.nodes,
        topology.adjacency
      )
    ) {
      issues.push(
        issue(FENCE_REPRESENTATION_LAYOUT_ERROR.OFF_RUN, {
          nodeId,
          runId: String(post?.runId ?? '')
        })
      );
      continue;
    }
    seenPosts.add(nodeId);
  }

  const interval = constraints.ok
    ? intervalValidation(
        {
          ...model.logicalTopology,
          runs: topology.runs
        },
        model.representationLayout,
        constraints
      )
    : { intervals: [], issues: [] };
  issues.push(...interval.issues);

  return {
    ok: issues.length === 0,
    issues,
    topologyPreserved,
    logicalQuantityPreserved,
    constraints,
    intervals: interval.intervals,
    semanticAnchors: clone(topology.semanticAnchors),
    runs: clone(topology.runs),
    persistentWriteAuthorized: false
  };
}

function nodeAt(
  logicalTopology: AnyRecord,
  x: unknown,
  y: unknown
) {
  const tx = int(x);
  const ty = int(y);
  if (tx === null || ty === null) return null;
  return (
    logicalTopology?.graph?.nodes ?? []
  ).find(
    (node: AnyRecord) =>
      Number(node?.x) === tx && Number(node?.y) === ty
  ) ?? null;
}

function rejectOperation(
  model: AnyRecord,
  code: string,
  detail: Record<string, unknown> = {}
) {
  return {
    accepted: false,
    model: clone(model),
    issues: [issue(code, detail)],
    validation: validateFenceRepresentationLayoutModel(model),
    persistentWriteAuthorized: false
  };
}

function generatedCandidate(
  model: AnyRecord,
  posts: AnyRecord[],
  policy: string
) {
  return {
    ...clone(model),
    representationLayout: {
      ...clone(model.representationLayout),
      intent: FENCE_REPRESENTATION_INTENT.GENERATED_DESIGN,
      policy,
      posts: clone(posts)
    },
    persistentWriteAuthorized: false
  };
}

export function applyFenceRepresentationLayoutOperation(
  model: AnyRecord,
  operation: AnyRecord
) {
  const sourceValidation =
    validateFenceRepresentationLayoutModel(model);
  if (!sourceValidation.ok) {
    return {
      accepted: false,
      model: clone(model),
      issues: clone(sourceValidation.issues),
      validation: sourceValidation,
      persistentWriteAuthorized: false
    };
  }

  const semanticIds = new Set(
    sourceValidation.semanticAnchors.map((entry: AnyRecord) =>
      String(entry.nodeId)
    )
  );
  const nodeRuns = new Map<string, AnyRecord>();
  for (const run of sourceValidation.runs) {
    for (let i = 1; i < run.nodeIds.length - 1; i += 1) {
      nodeRuns.set(String(run.nodeIds[i]), run);
    }
  }
  const posts = clone(model.representationLayout.posts ?? []);
  const type = String(operation?.type ?? '');

  if (type === 'INSERT_POST') {
    const target = nodeAt(
      model.logicalTopology,
      operation?.x,
      operation?.y
    );
    const nodeId = String(target?.id ?? '');
    if (!target || !nodeRuns.has(nodeId)) {
      return rejectOperation(
        model,
        FENCE_REPRESENTATION_LAYOUT_ERROR.OFF_RUN,
        { x: operation?.x, y: operation?.y }
      );
    }
    if (semanticIds.has(nodeId)) {
      return rejectOperation(
        model,
        FENCE_REPRESENTATION_LAYOUT_ERROR
          .SEMANTIC_ANCHOR_IMMUTABLE,
        { nodeId }
      );
    }
    if (posts.some((post: AnyRecord) => post.nodeId === nodeId)) {
      return rejectOperation(
        model,
        FENCE_REPRESENTATION_LAYOUT_ERROR.OFF_RUN,
        { nodeId, reason: 'REPRESENTATION_POST_ALREADY_EXISTS' }
      );
    }
    const run = nodeRuns.get(nodeId)!;
    posts.push({
      kind: 'DEGREE2_INTERIOR_POST',
      nodeId,
      runId: String(run.runId),
      x: Number(target.x),
      y: Number(target.y),
      pinned: operation?.pinned !== false,
      source: 'MANUAL'
    });
  } else if (type === 'REMOVE_POST') {
    const nodeId = String(operation?.nodeId ?? '');
    if (semanticIds.has(nodeId)) {
      return rejectOperation(
        model,
        FENCE_REPRESENTATION_LAYOUT_ERROR
          .SEMANTIC_ANCHOR_IMMUTABLE,
        { nodeId }
      );
    }
    const index = posts.findIndex(
      (post: AnyRecord) => String(post.nodeId) === nodeId
    );
    if (index < 0) {
      return rejectOperation(
        model,
        FENCE_REPRESENTATION_LAYOUT_ERROR.OFF_RUN,
        { nodeId, reason: 'REPRESENTATION_POST_NOT_FOUND' }
      );
    }
    posts.splice(index, 1);
  } else if (type === 'MOVE_POST') {
    const sourceNodeId = String(operation?.nodeId ?? '');
    const sourceIndex = posts.findIndex(
      (post: AnyRecord) =>
        String(post.nodeId) === sourceNodeId
    );
    if (sourceIndex < 0) {
      return rejectOperation(
        model,
        FENCE_REPRESENTATION_LAYOUT_ERROR.OFF_RUN,
        { nodeId: sourceNodeId, reason: 'REPRESENTATION_POST_NOT_FOUND' }
      );
    }
    const target = nodeAt(
      model.logicalTopology,
      operation?.x,
      operation?.y
    );
    const targetNodeId = String(target?.id ?? '');
    if (!target || !nodeRuns.has(targetNodeId)) {
      return rejectOperation(
        model,
        FENCE_REPRESENTATION_LAYOUT_ERROR.OFF_RUN,
        { x: operation?.x, y: operation?.y }
      );
    }
    if (semanticIds.has(targetNodeId)) {
      return rejectOperation(
        model,
        FENCE_REPRESENTATION_LAYOUT_ERROR
          .SEMANTIC_ANCHOR_IMMUTABLE,
        { nodeId: targetNodeId }
      );
    }
    const sourceRunId = String(posts[sourceIndex].runId);
    const targetRun = nodeRuns.get(targetNodeId)!;
    if (String(targetRun.runId) !== sourceRunId) {
      return rejectOperation(
        model,
        FENCE_REPRESENTATION_LAYOUT_ERROR.OFF_RUN,
        {
          nodeId: sourceNodeId,
          sourceRunId,
          targetNodeId,
          targetRunId: String(targetRun.runId)
        }
      );
    }
    if (
      posts.some(
        (post: AnyRecord, index: number) =>
          index !== sourceIndex &&
          String(post.nodeId) === targetNodeId
      )
    ) {
      return rejectOperation(
        model,
        FENCE_REPRESENTATION_LAYOUT_ERROR.OFF_RUN,
        {
          nodeId: targetNodeId,
          reason: 'REPRESENTATION_POST_ALREADY_EXISTS'
        }
      );
    }
    posts[sourceIndex] = {
      ...posts[sourceIndex],
      nodeId: targetNodeId,
      runId: String(targetRun.runId),
      x: Number(target.x),
      y: Number(target.y),
      source: 'MANUAL'
    };
  } else {
    return rejectOperation(
      model,
      FENCE_REPRESENTATION_LAYOUT_ERROR.OFF_RUN,
      { reason: 'REPRESENTATION_OPERATION_UNSUPPORTED', type }
    );
  }

  const candidate = generatedCandidate(
    model,
    posts,
    FENCE_REPRESENTATION_POLICY.MANUAL_PINNED_POSTS
  );
  const validation =
    validateFenceRepresentationLayoutModel(candidate);
  if (!validation.ok) {
    return {
      accepted: false,
      model: clone(model),
      candidate: clone(candidate),
      issues: clone(validation.issues),
      validation,
      persistentWriteAuthorized: false
    };
  }
  return {
    accepted: true,
    model: candidate,
    issues: [],
    validation,
    persistentWriteAuthorized: false
  };
}
