import {
  ROADFENCE_NATIVE_CATALOG_SWITCH_V125
} from '../ddv/core/roadfence/catalog-v125-switch.js';
import {
  FenceMode
} from '../ddv/core/roadfence/logical.js';

type AnyRecord = Record<string, any>;

export const FENCE_POST_LAYOUT_SCHEMA =
  'dreamwish-wand-wep-fence-post-layout-draft';
export const FENCE_POST_LAYOUT_VERSION = 1;

export const FENCE_POST_EDIT_OPERATION = Object.freeze({
  MOVE: 'MOVE_POST',
  INSERT: 'INSERT_POST',
  REMOVE: 'REMOVE_POST',
  PIN: 'PIN_POST',
  UNPIN: 'UNPIN_POST',
  AUTO_LAYOUT: 'AUTO_LAYOUT'
});

export const FENCE_POST_AUTO_LAYOUT = Object.freeze({
  PRESERVE_EXISTING: 'PRESERVE_EXISTING',
  CENTERED_BALANCED: 'CENTERED_BALANCED'
});

function clone<T>(value: T): T {
  return structuredClone(value);
}

function plain(value: unknown): value is AnyRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function coordKey(x: unknown, y: unknown) {
  return `${Number(x)},${Number(y)}`;
}

function edgeKey(a: string, b: string) {
  return a < b ? `${a}::${b}` : `${b}::${a}`;
}

function familyDescriptors(familyBaseItemID: number) {
  return Object.entries(
    ROADFENCE_NATIVE_CATALOG_SWITCH_V125.fenceItems
  )
    .map(([itemID, value]) => ({
      itemID: Number(itemID),
      ...(value as AnyRecord)
    }))
    .filter(
      (entry) =>
        Number(entry.familyBaseItemID) === Number(familyBaseItemID)
    );
}

export function fenceFamilyPostConstraints(
  familyBaseItemID: number,
  mode: string
) {
  if (
    mode !== FenceMode.ORTHOGONAL &&
    mode !== FenceMode.DIAGONAL
  ) {
    throw new Error('WEP_FENCE_POST_MODE_UNSUPPORTED');
  }
  const family = familyDescriptors(Number(familyBaseItemID));
  const base = family.find((entry) => entry.role === 'base');
  if (!base) {
    throw new Error('WEP_FENCE_POST_FAMILY_BASE_UNRESOLVED');
  }
  const role =
    mode === FenceMode.ORTHOGONAL ? 'ext' : 'diagExt';
  const keys = family
    .filter((entry) => entry.role === role)
    .map((entry) => Number(entry.key))
    .filter(
      (value) => Number.isSafeInteger(value) && value > 0
    )
    .sort((a, b) => a - b);
  if (!keys.length) {
    throw new Error('WEP_FENCE_POST_VARIATION_SET_UNRESOLVED');
  }
  for (let index = 0; index < keys.length; index += 1) {
    if (keys[index] !== index + 1) {
      throw new Error(
        'WEP_FENCE_POST_VARIATION_SET_NONCONTIGUOUS'
      );
    }
  }
  const maxExtensionKey = keys[keys.length - 1];
  return Object.freeze({
    familyBaseItemID: Number(familyBaseItemID),
    familyName: String(base.familyName ?? ''),
    mode,
    maxExtensionKey,
    maxInterval: maxExtensionKey + 1,
    source: '01C_CORE_CATALOG_VARIATION_SET',
    persistentWriteAuthorized: false
  });
}

function normalizeNetwork(readerResult: AnyRecord, networkId: string) {
  if (
    !plain(readerResult) ||
    readerResult.status !== 'supported' ||
    readerResult.ok !== true ||
    readerResult.persistentWriteAuthorized !== false
  ) {
    throw new Error('WEP_FENCE_POST_READER_NOT_SUPPORTED');
  }
  const network = (readerResult.fences ?? []).find(
    (entry: AnyRecord) =>
      String(entry?.networkId ?? '') === String(networkId)
  );
  if (!plain(network) || network.kind !== 'fence') {
    throw new Error('WEP_FENCE_POST_NETWORK_NOT_FOUND');
  }
  if (
    !plain(network.graph) ||
    !Array.isArray(network.graph.nodes) ||
    !Array.isArray(network.graph.edges)
  ) {
    throw new Error('WEP_FENCE_POST_GRAPH_INVALID');
  }
  return network;
}

function graphIndex(network: AnyRecord) {
  const nodes = new Map<string, AnyRecord>();
  for (const raw of network.graph.nodes) {
    const id = String(raw?.id ?? '');
    if (
      !id ||
      !Number.isSafeInteger(Number(raw?.x)) ||
      !Number.isSafeInteger(Number(raw?.y))
    ) {
      throw new Error('WEP_FENCE_POST_NODE_INVALID');
    }
    nodes.set(id, {
      id,
      x: Number(raw.x),
      y: Number(raw.y),
      mode: String(raw.mode ?? network.mode)
    });
  }
  const adjacency = new Map(
    [...nodes.keys()].map((id) => [id, new Set<string>()])
  );
  for (const raw of network.graph.edges) {
    const a = String(raw?.a ?? '');
    const b = String(raw?.b ?? '');
    if (!nodes.has(a) || !nodes.has(b) || a === b) {
      throw new Error('WEP_FENCE_POST_EDGE_INVALID');
    }
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
  boundaryKeys: Set<string>
) {
  const degree = adjacency.get(nodeId)?.size ?? 0;
  const node = nodes.get(nodeId)!;
  if (boundaryKeys.has(coordKey(node.x, node.y))) {
    return 'MODE_BOUNDARY';
  }
  if (degree <= 1) return 'ENDPOINT';
  if (degree >= 3) return 'JUNCTION';
  if (!straightDegreeTwo(nodeId, nodes, adjacency)) {
    return 'CORNER';
  }
  return null;
}

function capturedBaseCoordinates(
  readerResult: AnyRecord,
  network: AnyRecord
) {
  const provenance =
    readerResult?.provenance?.fences?.[network.networkId];
  const nativeObjects = Array.isArray(provenance?.nativeObjects)
    ? provenance.nativeObjects
    : [];
  const space = network.coordinateSpace;
  const pitch = Number(space?.savePitch);
  const residueX = Number(space?.saveResidueX);
  const residueY = Number(space?.saveResidueY);
  if (
    !Number.isSafeInteger(pitch) ||
    pitch <= 0 ||
    !Number.isSafeInteger(residueX) ||
    !Number.isSafeInteger(residueY)
  ) {
    throw new Error('WEP_FENCE_POST_COORDINATE_SPACE_INVALID');
  }
  return nativeObjects
    .filter((entry: AnyRecord) => entry?.role === 'base')
    .map((entry: AnyRecord) => ({
      x: (Number(entry.x) - residueX) / pitch,
      y: (Number(entry.y) - residueY) / pitch
    }))
    .filter(
      (entry: AnyRecord) =>
        Number.isSafeInteger(entry.x) &&
        Number.isSafeInteger(entry.y)
    );
}

function modeBoundaryCoordinates(
  readerResult: AnyRecord,
  networkId: string
) {
  const result = new Set<string>();
  for (const touch of readerResult.modeBoundaryTouches ?? []) {
    for (const side of [touch?.a, touch?.b]) {
      if (String(side?.networkId ?? '') === networkId) {
        result.add(coordKey(side.x, side.y));
      }
    }
  }
  return result;
}

function validateDraftShape(draft: AnyRecord) {
  if (
    !plain(draft) ||
    draft.schema !== FENCE_POST_LAYOUT_SCHEMA ||
    Number(draft.version) !== FENCE_POST_LAYOUT_VERSION ||
    draft.persistentWriteAuthorized !== false ||
    !plain(draft.graph) ||
    !Array.isArray(draft.graph.nodes) ||
    !Array.isArray(draft.graph.edges) ||
    !Array.isArray(draft.posts) ||
    !Array.isArray(draft.semanticAnchors)
  ) {
    throw new Error('WEP_FENCE_POST_DRAFT_INVALID');
  }
}

function anchorNodeIds(draft: AnyRecord) {
  return new Set([
    ...draft.semanticAnchors.map((entry: AnyRecord) =>
      String(entry.nodeId)
    ),
    ...draft.posts.map((entry: AnyRecord) =>
      String(entry.nodeId)
    )
  ]);
}

function straightIntervals(draft: AnyRecord) {
  validateDraftShape(draft);
  const { nodes, adjacency } = graphIndex({
    graph: draft.graph,
    mode: draft.mode
  });
  const anchors = anchorNodeIds(draft);
  const visited = new Set<string>();
  const intervals: AnyRecord[] = [];

  for (const startId of anchors) {
    for (const first of adjacency.get(startId) ?? []) {
      const firstEdge = edgeKey(startId, first);
      if (visited.has(firstEdge)) continue;

      let previous = startId;
      let current = first;
      let length = 1;
      visited.add(firstEdge);

      while (!anchors.has(current)) {
        const nextCandidates = [
          ...(adjacency.get(current) ?? [])
        ].filter((id) => id !== previous);
        if (nextCandidates.length !== 1) {
          throw new Error(
            'WEP_FENCE_POST_SEMANTIC_ANCHOR_COVERAGE_INVALID'
          );
        }
        const next = nextCandidates[0];
        visited.add(edgeKey(current, next));
        previous = current;
        current = next;
        length += 1;
      }

      intervals.push({
        a: startId,
        b: current,
        length,
        nodeA: clone(nodes.get(startId)),
        nodeB: clone(nodes.get(current))
      });
    }
  }

  const unique = new Map<string, AnyRecord>();
  for (const interval of intervals) {
    const key = edgeKey(interval.a, interval.b);
    if (!unique.has(key)) unique.set(key, interval);
  }
  return [...unique.values()];
}

export function validateFencePostLayoutDraft(draft: AnyRecord) {
  validateDraftShape(draft);
  const issues: AnyRecord[] = [];
  const constraints = fenceFamilyPostConstraints(
    Number(draft.familyBaseItemID),
    String(draft.mode)
  );
  const { nodes, adjacency } = graphIndex({
    graph: draft.graph,
    mode: draft.mode
  });

  const semantic = new Set(
    draft.semanticAnchors.map((entry: AnyRecord) =>
      String(entry.nodeId)
    )
  );
  const postIds = new Set<string>();
  for (const post of draft.posts) {
    const nodeId = String(post?.nodeId ?? '');
    if (
      !nodes.has(nodeId) ||
      semantic.has(nodeId) ||
      postIds.has(nodeId) ||
      !straightDegreeTwo(nodeId, nodes, adjacency)
    ) {
      issues.push({
        severity: 'BLOCK',
        code: 'FENCE_POST_REPRESENTATION_POST_INVALID',
        nodeId
      });
    }
    postIds.add(nodeId);
  }

  let intervals: AnyRecord[] = [];
  try {
    intervals = straightIntervals(draft);
    for (const interval of intervals) {
      if (interval.length > constraints.maxInterval) {
        issues.push({
          severity: 'BLOCK',
          code: 'FENCE_POST_MAX_SPAN_EXCEEDED',
          interval: clone(interval),
          maxInterval: constraints.maxInterval
        });
      }
    }
  } catch (error) {
    issues.push({
      severity: 'BLOCK',
      code: 'FENCE_POST_INTERVAL_ANALYSIS_FAILED',
      message: error instanceof Error ? error.message : String(error)
    });
  }

  return {
    ok: issues.length === 0,
    issues,
    constraints,
    intervals,
    topologyPreserved: true,
    logicalQuantityPreserved: true,
    persistentWriteAuthorized: false
  };
}

export function createFencePostLayoutDraft(
  readerResult: AnyRecord,
  networkId: string
) {
  const network = normalizeNetwork(readerResult, networkId);
  const { nodes, adjacency } = graphIndex(network);
  const boundaryKeys = modeBoundaryCoordinates(
    readerResult,
    network.networkId
  );
  const semanticAnchors: AnyRecord[] = [];
  const semanticIds = new Set<string>();

  for (const node of nodes.values()) {
    const reason = semanticReason(
      node.id,
      nodes,
      adjacency,
      boundaryKeys
    );
    if (!reason) continue;
    semanticIds.add(node.id);
    semanticAnchors.push({
      nodeId: node.id,
      x: node.x,
      y: node.y,
      reason,
      removableByPostEdit: false
    });
  }

  const nodeByCoordinate = new Map(
    [...nodes.values()].map((node) => [
      coordKey(node.x, node.y),
      node
    ])
  );
  const posts: AnyRecord[] = [];
  for (const coordinate of capturedBaseCoordinates(
    readerResult,
    network
  )) {
    const node = nodeByCoordinate.get(
      coordKey(coordinate.x, coordinate.y)
    );
    if (
      !node ||
      semanticIds.has(node.id) ||
      !straightDegreeTwo(node.id, nodes, adjacency)
    ) {
      continue;
    }
    posts.push({
      nodeId: node.id,
      x: node.x,
      y: node.y,
      pinned: true,
      source: 'CAPTURED_NATIVE_BASE'
    });
  }

  const draft = {
    schema: FENCE_POST_LAYOUT_SCHEMA,
    version: FENCE_POST_LAYOUT_VERSION,
    networkId: String(network.networkId),
    familyBaseItemID: Number(network.familyBaseItemID),
    familyName: String(network.familyName ?? ''),
    mode: String(network.mode),
    graph: clone(network.graph),
    logicalQuantity: Number(network.logicalQuantity),
    semanticAnchors,
    posts,
    layoutPolicy: 'PRESERVE_CAPTURED',
    provenance: {
      saveLocalGridObjectIdentityExcluded: true,
      capturedNativeBasePositionsRetained: true,
      maxSpanDerivedFromCoreCatalog: true
    },
    persistentWriteAuthorized: false
  };
  return {
    draft,
    validation: validateFencePostLayoutDraft(draft)
  };
}

function nodeAt(draft: AnyRecord, x: number, y: number) {
  return draft.graph.nodes.find(
    (node: AnyRecord) =>
      Number(node.x) === Number(x) &&
      Number(node.y) === Number(y)
  );
}

function replacePosts(
  draft: AnyRecord,
  posts: AnyRecord[],
  layoutPolicy: string
) {
  const next = {
    ...clone(draft),
    posts: clone(posts),
    layoutPolicy,
    persistentWriteAuthorized: false
  };
  return {
    draft: next,
    validation: validateFencePostLayoutDraft(next)
  };
}

export function insertFencePost(
  draft: AnyRecord,
  x: number,
  y: number,
  { pinned = true } = {}
) {
  validateDraftShape(draft);
  const node = nodeAt(draft, x, y);
  if (!node) throw new Error('FENCE_POST_TARGET_NOT_ON_TOPOLOGY');
  if (
    draft.semanticAnchors.some(
      (entry: AnyRecord) => entry.nodeId === node.id
    )
  ) {
    throw new Error('FENCE_POST_TARGET_IS_SEMANTIC_ANCHOR');
  }
  if (
    draft.posts.some(
      (entry: AnyRecord) => entry.nodeId === node.id
    )
  ) {
    throw new Error('FENCE_POST_ALREADY_EXISTS');
  }
  return replacePosts(
    draft,
    [
      ...draft.posts,
      {
        nodeId: node.id,
        x: Number(node.x),
        y: Number(node.y),
        pinned: pinned === true,
        source: 'MANUAL'
      }
    ],
    'MANUAL_PINNED_POSTS'
  );
}

export function removeFencePost(
  draft: AnyRecord,
  nodeId: string
) {
  validateDraftShape(draft);
  if (
    draft.semanticAnchors.some(
      (entry: AnyRecord) => entry.nodeId === nodeId
    )
  ) {
    throw new Error('FENCE_POST_SEMANTIC_ANCHOR_PROTECTED');
  }
  const existing = draft.posts.find(
    (entry: AnyRecord) => entry.nodeId === nodeId
  );
  if (!existing) throw new Error('FENCE_POST_NOT_FOUND');
  return replacePosts(
    draft,
    draft.posts.filter(
      (entry: AnyRecord) => entry.nodeId !== nodeId
    ),
    'MANUAL_PINNED_POSTS'
  );
}

export function moveFencePost(
  draft: AnyRecord,
  nodeId: string,
  x: number,
  y: number
) {
  validateDraftShape(draft);
  const existing = draft.posts.find(
    (entry: AnyRecord) => entry.nodeId === nodeId
  );
  if (!existing) throw new Error('FENCE_POST_NOT_FOUND');
  const removed = {
    ...clone(draft),
    posts: draft.posts.filter(
      (entry: AnyRecord) => entry.nodeId !== nodeId
    )
  };
  const inserted = insertFencePost(
    removed,
    x,
    y,
    { pinned: existing.pinned !== false }
  );
  return {
    ...inserted,
    draft: {
      ...inserted.draft,
      layoutPolicy: 'MANUAL_PINNED_POSTS'
    }
  };
}

export function setFencePostPinned(
  draft: AnyRecord,
  nodeId: string,
  pinned: boolean
) {
  validateDraftShape(draft);
  let found = false;
  const posts = draft.posts.map((entry: AnyRecord) => {
    if (entry.nodeId !== nodeId) return clone(entry);
    found = true;
    return { ...clone(entry), pinned: pinned === true };
  });
  if (!found) throw new Error('FENCE_POST_NOT_FOUND');
  return replacePosts(
    draft,
    posts,
    String(draft.layoutPolicy ?? 'MANUAL_PINNED_POSTS')
  );
}

function pathBetween(
  startId: string,
  endId: string,
  adjacency: Map<string, Set<string>>
) {
  const queue = [[startId]];
  const seen = new Set([startId]);
  while (queue.length) {
    const path = queue.shift()!;
    const last = path[path.length - 1];
    if (last === endId) return path;
    for (const next of adjacency.get(last) ?? []) {
      if (seen.has(next)) continue;
      seen.add(next);
      queue.push([...path, next]);
    }
  }
  throw new Error('FENCE_POST_PATH_UNRESOLVED');
}

function balancedInternalIndexes(length: number, maxInterval: number) {
  if (length <= maxInterval) return [];
  const segmentCount = Math.ceil(length / maxInterval);
  const base = Math.floor(length / segmentCount);
  const extra = length % segmentCount;
  const sizes = Array(segmentCount).fill(base);
  const centerOrder = [...sizes.keys()].sort((a, b) => {
    const ca = Math.abs(a - (segmentCount - 1) / 2);
    const cb = Math.abs(b - (segmentCount - 1) / 2);
    return ca - cb || a - b;
  });
  for (let index = 0; index < extra; index += 1) {
    sizes[centerOrder[index]] += 1;
  }
  const offsets = [];
  let cursor = 0;
  for (let index = 0; index < sizes.length - 1; index += 1) {
    cursor += sizes[index];
    offsets.push(cursor);
  }
  return offsets;
}

export function applyFencePostAutoLayout(
  draft: AnyRecord,
  policy: string
) {
  validateDraftShape(draft);
  if (policy === FENCE_POST_AUTO_LAYOUT.PRESERVE_EXISTING) {
    return {
      draft: clone(draft),
      validation: validateFencePostLayoutDraft(draft)
    };
  }
  if (policy !== FENCE_POST_AUTO_LAYOUT.CENTERED_BALANCED) {
    throw new Error('FENCE_POST_AUTO_LAYOUT_POLICY_UNSUPPORTED');
  }

  const constraints = fenceFamilyPostConstraints(
    Number(draft.familyBaseItemID),
    String(draft.mode)
  );
  const { nodes, adjacency } = graphIndex({
    graph: draft.graph,
    mode: draft.mode
  });
  const pinned = draft.posts.filter(
    (entry: AnyRecord) => entry.pinned === true
  );
  const fixed = new Set([
    ...draft.semanticAnchors.map((entry: AnyRecord) =>
      String(entry.nodeId)
    ),
    ...pinned.map((entry: AnyRecord) =>
      String(entry.nodeId)
    )
  ]);

  const working = {
    ...clone(draft),
    posts: clone(pinned)
  };
  const intervals = straightIntervals(working);
  const generated: AnyRecord[] = [];

  for (const interval of intervals) {
    if (interval.length <= constraints.maxInterval) continue;
    const path = pathBetween(interval.a, interval.b, adjacency);
    for (const offset of balancedInternalIndexes(
      interval.length,
      constraints.maxInterval
    )) {
      const nodeId = path[offset];
      if (!nodeId || fixed.has(nodeId)) continue;
      const node = nodes.get(nodeId)!;
      generated.push({
        nodeId,
        x: node.x,
        y: node.y,
        pinned: false,
        source: 'AUTO_CENTERED_BALANCED'
      });
      fixed.add(nodeId);
    }
  }

  return replacePosts(
    draft,
    [...pinned, ...generated],
    FENCE_POST_AUTO_LAYOUT.CENTERED_BALANCED
  );
}
