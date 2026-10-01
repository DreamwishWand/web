import {
  FenceMode,
  PERSISTENT_WRITE_AUTHORIZED,
  resolveFenceExtensionNativePlacement,
  validateFenceLogicalGraph
} from './logical.js';

export const ROADFENCE_NATIVE_READER_V125_SCHEMA =
  'dreamwish-wand-roadfence-native-reader';
export const ROADFENCE_NATIVE_READER_V125_VERSION = 1;
export const ROADFENCE_NATIVE_CATALOG_V125_SCHEMA =
  'dreamwish-wand-roadfence-native-catalog';

const GAME_VERSION = '1.25.0';
const ROAD_NEIGHBORS = Object.freeze([
  [-1, -1], [0, -1], [1, -1],
  [-1, 0],            [1, 0],
  [-1, 1],  [0, 1],  [1, 1]
]);

function plain(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function block(code, detail = {}) {
  return { severity: 'BLOCK', code, ...detail };
}

function safeInteger(value, label) {
  const number = Number(value);
  if (!Number.isSafeInteger(number)) {
    throw new TypeError(`${label} must be a safe integer`);
  }
  return number;
}

function positiveInteger(value, label) {
  const number = safeInteger(value, label);
  if (number <= 0) throw new RangeError(`${label} must be positive`);
  return number;
}

function modulo(value, divisor) {
  return ((value % divisor) + divisor) % divisor;
}

function coordKey(x, y) {
  return `${x},${y}`;
}

function edgeKey(a, b) {
  return a < b ? `${a}::${b}` : `${b}::${a}`;
}

function logicalNodeId(x, y) {
  return `v:${x}:${y}`;
}

function comparePoint(a, b) {
  return a.y - b.y || a.x - b.x;
}

function compareNode(a, b) {
  return comparePoint(a, b) || String(a.id).localeCompare(String(b.id));
}

function readMode(state) {
  if (state == null) return FenceMode.ORTHOGONAL;
  if (!plain(state)) throw new Error('NATIVE_MODE_STATE_INVALID');
  const keys = Object.keys(state);
  if (keys.length === 0) return FenceMode.ORTHOGONAL;
  if (
    keys.length === 1 &&
    keys[0] === 'FenceMode' &&
    plain(state.FenceMode) &&
    state.FenceMode.Diagonal === true
  ) {
    return FenceMode.DIAGONAL;
  }
  throw new Error('NATIVE_MODE_STATE_UNSUPPORTED');
}

function normalizeCatalog(catalog) {
  if (
    !plain(catalog) ||
    catalog.schema !== ROADFENCE_NATIVE_CATALOG_V125_SCHEMA ||
    catalog.version !== 1 ||
    catalog.gameVersion !== GAME_VERSION ||
    catalog.complete !== true ||
    !plain(catalog.roadItems) ||
    !plain(catalog.fenceItems)
  ) {
    throw new Error('ROADFENCE_NATIVE_CATALOG_CONTRACT_MISMATCH');
  }

  const roadItems = new Map();
  for (const [key, value] of Object.entries(catalog.roadItems)) {
    if (!plain(value)) throw new Error('ROADFENCE_NATIVE_CATALOG_ROAD_INVALID');
    const itemID = positiveInteger(key, 'Road itemID');
    const familyBaseItemID = positiveInteger(
      value.familyBaseItemID,
      'Road familyBaseItemID'
    );
    roadItems.set(itemID, Object.freeze({
      itemID,
      familyBaseItemID,
      familyName: value.familyName == null ? null : String(value.familyName)
    }));
  }

  const fenceItems = new Map();
  const fenceBaseByFamily = new Map();
  for (const [key, value] of Object.entries(catalog.fenceItems)) {
    if (!plain(value)) throw new Error('ROADFENCE_NATIVE_CATALOG_FENCE_INVALID');
    const itemID = positiveInteger(key, 'Fence itemID');
    const familyBaseItemID = positiveInteger(
      value.familyBaseItemID,
      'Fence familyBaseItemID'
    );
    const role = String(value.role ?? '');
    if (!['base', 'ext', 'diagExt'].includes(role)) {
      throw new Error('ROADFENCE_NATIVE_CATALOG_FENCE_ROLE_INVALID');
    }

    const descriptor = {
      itemID,
      familyBaseItemID,
      familyName: value.familyName == null ? null : String(value.familyName),
      role,
      key: null,
      gridSizeX: positiveInteger(value.gridSizeX ?? 1, 'Fence gridSizeX'),
      gridSizeY: positiveInteger(value.gridSizeY ?? 1, 'Fence gridSizeY')
    };

    if (role === 'base') {
      if (itemID !== familyBaseItemID) {
        throw new Error('ROADFENCE_NATIVE_CATALOG_FENCE_BASE_ID_MISMATCH');
      }
      if (fenceBaseByFamily.has(familyBaseItemID)) {
        throw new Error('ROADFENCE_NATIVE_CATALOG_FENCE_BASE_DUPLICATE');
      }
      fenceBaseByFamily.set(familyBaseItemID, descriptor);
    } else {
      descriptor.key = positiveInteger(value.key, 'Fence variation key');
      if (descriptor.gridSizeX !== descriptor.key) {
        throw new Error('ROADFENCE_NATIVE_CATALOG_FENCE_KEY_SIZE_MISMATCH');
      }
    }
    fenceItems.set(itemID, Object.freeze(descriptor));
  }

  for (const descriptor of fenceItems.values()) {
    if (!fenceBaseByFamily.has(descriptor.familyBaseItemID)) {
      throw new Error('ROADFENCE_NATIVE_CATALOG_FENCE_BASE_MISSING');
    }
  }

  for (const itemID of roadItems.keys()) {
    if (fenceItems.has(itemID)) {
      throw new Error('ROADFENCE_NATIVE_CATALOG_ITEM_CLASS_COLLISION');
    }
  }

  return { roadItems, fenceItems, fenceBaseByFamily };
}

function normalizeGridObjects(grid) {
  if (!plain(grid)) throw new TypeError('grid is required');
  const raw = grid.Objects;
  if (!(plain(raw) || Array.isArray(raw))) {
    throw new TypeError('grid.Objects must be an object or array');
  }

  const values = Array.isArray(raw) ? raw : Object.values(raw);
  return values.map((object, index) => {
    if (!plain(object)) {
      throw new TypeError(`grid object ${index} must be an object`);
    }
    return {
      raw: object,
      id: safeInteger(object.ID, 'GridObject.ID'),
      itemID: positiveInteger(object.ItemID, 'GridObject.ItemID'),
      x: safeInteger(object.X, 'GridObject.X'),
      y: safeInteger(object.Y, 'GridObject.Y'),
      orientation: String(object.Orientation ?? ''),
      state: object.State ?? null
    };
  });
}

function connectedRoadComponents(cells) {
  const byKey = new Map(cells.map((cell) => [coordKey(cell.x, cell.y), cell]));
  const unseen = new Set(byKey.keys());
  const components = [];

  while (unseen.size) {
    const seed = [...unseen].sort()[0];
    unseen.delete(seed);
    const queue = [seed];
    const component = [];

    while (queue.length) {
      const key = queue.shift();
      const cell = byKey.get(key);
      component.push(cell);
      for (const [dx, dy] of ROAD_NEIGHBORS) {
        const next = coordKey(cell.x + dx, cell.y + dy);
        if (unseen.has(next)) {
          unseen.delete(next);
          queue.push(next);
        }
      }
    }

    component.sort(comparePoint);
    components.push(component);
  }

  components.sort((a, b) => comparePoint(a[0], b[0]));
  return components;
}

function validFenceStep(a, b, mode) {
  const dx = Math.abs(a.x - b.x);
  const dy = Math.abs(a.y - b.y);
  if (mode === FenceMode.ORTHOGONAL) return dx + dy === 1;
  return dx === 1 && dy === 1;
}

function connectedGraphComponents(nodes, edges) {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const adjacency = new Map(nodes.map((node) => [node.id, new Set()]));
  for (const edge of edges) {
    adjacency.get(edge.a)?.add(edge.b);
    adjacency.get(edge.b)?.add(edge.a);
  }

  const unseen = new Set(nodeById.keys());
  const output = [];
  while (unseen.size) {
    const seed = [...unseen].sort()[0];
    unseen.delete(seed);
    const queue = [seed];
    const ids = [];

    while (queue.length) {
      const id = queue.shift();
      ids.push(id);
      for (const next of adjacency.get(id) ?? []) {
        if (unseen.has(next)) {
          unseen.delete(next);
          queue.push(next);
        }
      }
    }

    const set = new Set(ids);
    const componentNodes = ids.map((id) => nodeById.get(id)).sort(compareNode);
    const componentEdges = edges
      .filter((edge) => set.has(edge.a) && set.has(edge.b))
      .map((edge) => ({ a: edge.a, b: edge.b }))
      .sort((a, b) => edgeKey(a.a, a.b).localeCompare(edgeKey(b.a, b.b)));
    output.push({ nodes: componentNodes, edges: componentEdges, nodeIds: set });
  }

  output.sort((a, b) => compareNode(a.nodes[0], b.nodes[0]));
  return output;
}

function networkBounds(points) {
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  return {
    minX: Math.min(...xs),
    minY: Math.min(...ys),
    maxX: Math.max(...xs),
    maxY: Math.max(...ys)
  };
}

function readRoads(objects, catalog, tessellationFactor) {
  const issues = [];
  const networks = [];
  const provenance = {};
  const byFamily = new Map();

  for (const object of objects) {
    const descriptor = catalog.roadItems.get(object.itemID);
    if (!descriptor) continue;
    const list = byFamily.get(descriptor.familyBaseItemID) ?? [];
    list.push({ object, descriptor });
    byFamily.set(descriptor.familyBaseItemID, list);
  }

  const pitch = 2 * tessellationFactor;
  for (const [familyBaseItemID, entries] of [...byFamily.entries()].sort((a, b) => a[0] - b[0])) {
    const localIssues = [];
    const residueX = modulo(entries[0].object.x, pitch);
    const residueY = modulo(entries[0].object.y, pitch);
    const cells = [];
    const byCoordinate = new Map();

    for (const entry of entries) {
      const object = entry.object;
      if (
        modulo(object.x, pitch) !== residueX ||
        modulo(object.y, pitch) !== residueY
      ) {
        localIssues.push(block('ROAD_NATIVE_GRID_QUANTUM_MISMATCH', {
          familyBaseItemID,
          gridObjectId: object.id
        }));
        continue;
      }
      if (object.orientation !== 'GridOrientation_Down') {
        localIssues.push(block('ROAD_NATIVE_ORIENTATION_UNSUPPORTED', {
          familyBaseItemID,
          gridObjectId: object.id,
          orientation: object.orientation
        }));
        continue;
      }

      let mode;
      try {
        mode = readMode(object.state);
      } catch (error) {
        localIssues.push(block(String(error.message || error), {
          familyBaseItemID,
          gridObjectId: object.id
        }));
        continue;
      }

      const cell = {
        x: (object.x - residueX) / pitch,
        y: (object.y - residueY) / pitch,
        mode,
        source: object
      };
      const key = coordKey(cell.x, cell.y);
      if (byCoordinate.has(key)) {
        localIssues.push(block('ROAD_NATIVE_DUPLICATE_CELL', {
          familyBaseItemID,
          coordinate: { x: cell.x, y: cell.y }
        }));
        continue;
      }
      byCoordinate.set(key, cell);
      cells.push(cell);
    }

    if (localIssues.length) {
      issues.push(...localIssues);
      continue;
    }

    const components = connectedRoadComponents(cells);
    components.forEach((component, index) => {
      const networkId = `road:${familyBaseItemID}:${index}`;
      const logicalCells = component.map((cell) => ({
        x: cell.x,
        y: cell.y,
        mode: cell.mode
      }));
      networks.push({
        networkId,
        kind: 'road',
        familyBaseItemID,
        familyName: entries[0].descriptor.familyName,
        coordinateSpace: {
          unit: 'road-cell',
          savePitch: pitch,
          saveResidueX: residueX,
          saveResidueY: residueY
        },
        cells: logicalCells,
        logicalQuantity: logicalCells.length,
        bounds: networkBounds(logicalCells),
        persistentWriteAuthorized: PERSISTENT_WRITE_AUTHORIZED
      });
      provenance[networkId] = {
        gridObjectIds: component.map((cell) => cell.source.id).sort((a, b) => a - b),
        nativeObjects: component
          .map((cell) => ({
            gridObjectId: cell.source.id,
            itemID: cell.source.itemID,
            x: cell.source.x,
            y: cell.source.y,
            orientation: cell.source.orientation
          }))
          .sort((a, b) => a.gridObjectId - b.gridObjectId)
      };
    });
  }

  return { networks, provenance, issues };
}

function readFenceFamily(familyBaseItemID, entries, catalog, tessellationFactor) {
  const issues = [];
  const baseDescriptor = catalog.fenceBaseByFamily.get(familyBaseItemID);
  if (!baseDescriptor) {
    return {
      networks: [],
      provenance: {},
      modeBoundaryTouches: [],
      issues: [block('FENCE_NATIVE_BASE_DESCRIPTOR_MISSING', { familyBaseItemID })]
    };
  }

  const pitch = tessellationFactor;
  const residueX = modulo(entries[0].object.x, pitch);
  const residueY = modulo(entries[0].object.y, pitch);
  const baseSpanX = baseDescriptor.gridSizeX * tessellationFactor;
  const baseSpanY = baseDescriptor.gridSizeY * tessellationFactor;
  const byMode = new Map([
    [FenceMode.ORTHOGONAL, { bases: [], extensions: [] }],
    [FenceMode.DIAGONAL, { bases: [], extensions: [] }]
  ]);

  for (const entry of entries) {
    const object = entry.object;
    const descriptor = entry.descriptor;
    if (
      modulo(object.x, pitch) !== residueX ||
      modulo(object.y, pitch) !== residueY
    ) {
      issues.push(block('FENCE_NATIVE_GRID_QUANTUM_MISMATCH', {
        familyBaseItemID,
        gridObjectId: object.id
      }));
      continue;
    }

    let mode;
    try {
      mode = readMode(object.state);
    } catch (error) {
      issues.push(block(String(error.message || error), {
        familyBaseItemID,
        gridObjectId: object.id
      }));
      continue;
    }

    if (descriptor.role === 'ext' && mode !== FenceMode.ORTHOGONAL) {
      issues.push(block('FENCE_NATIVE_VARIATION_MODE_MISMATCH', {
        familyBaseItemID,
        gridObjectId: object.id,
        role: descriptor.role,
        mode
      }));
      continue;
    }
    if (descriptor.role === 'diagExt' && mode !== FenceMode.DIAGONAL) {
      issues.push(block('FENCE_NATIVE_VARIATION_MODE_MISMATCH', {
        familyBaseItemID,
        gridObjectId: object.id,
        role: descriptor.role,
        mode
      }));
      continue;
    }

    const normalized = {
      object,
      descriptor,
      mode,
      logicalX: (object.x - residueX) / pitch,
      logicalY: (object.y - residueY) / pitch
    };
    if (descriptor.role === 'base') byMode.get(mode).bases.push(normalized);
    else byMode.get(mode).extensions.push(normalized);
  }

  if (issues.length) {
    return { networks: [], provenance: {}, modeBoundaryTouches: [], issues };
  }

  const networks = [];
  const provenance = {};
  const baseNetwork = new Map();
  let familyNetworkIndex = 0;

  for (const mode of [FenceMode.ORTHOGONAL, FenceMode.DIAGONAL]) {
    const data = byMode.get(mode);
    if (!data.bases.length && !data.extensions.length) continue;
    if (!data.bases.length) {
      issues.push(block('FENCE_NATIVE_COMPONENT_WITHOUT_BASE', {
        familyBaseItemID,
        mode
      }));
      continue;
    }

    const baseAt = new Map();
    for (const base of data.bases) {
      const key = coordKey(base.logicalX, base.logicalY);
      if (baseAt.has(key)) {
        issues.push(block('FENCE_NATIVE_DUPLICATE_BASE', {
          familyBaseItemID,
          mode,
          coordinate: { x: base.logicalX, y: base.logicalY }
        }));
      } else {
        baseAt.set(key, base);
      }
    }
    if (issues.length) continue;

    const nodeByKey = new Map();
    const edgeByKey = new Map();
    const extensionLinks = [];

    const ensureNode = (x, y) => {
      const key = coordKey(x, y);
      if (!nodeByKey.has(key)) {
        nodeByKey.set(key, {
          id: logicalNodeId(x, y),
          x,
          y,
          mode
        });
      }
      return nodeByKey.get(key);
    };
    const addEdge = (a, b) => {
      const key = edgeKey(a.id, b.id);
      if (!edgeByKey.has(key)) edgeByKey.set(key, { a: a.id, b: b.id });
    };

    for (const base of data.bases) ensureNode(base.logicalX, base.logicalY);

    for (const extension of data.extensions) {
      const descriptor = extension.descriptor;
      const candidates = [];
      for (let i = 0; i < data.bases.length; i += 1) {
        for (let j = i + 1; j < data.bases.length; j += 1) {
          const a = data.bases[i];
          const b = data.bases[j];
          const dx = b.object.x - a.object.x;
          const dy = b.object.y - a.object.y;
          if (
            mode === FenceMode.ORTHOGONAL &&
            !(dx === 0 || dy === 0)
          ) {
            continue;
          }
          if (
            mode === FenceMode.DIAGONAL &&
            !(dx !== 0 && dy !== 0 && Math.abs(dx) === Math.abs(dy))
          ) {
            continue;
          }

          try {
            const placement = resolveFenceExtensionNativePlacement({
              fromSave: { x: a.object.x, y: a.object.y },
              toSave: { x: b.object.x, y: b.object.y },
              key: descriptor.key,
              variation: {
                itemID: descriptor.itemID,
                gridSizeX: descriptor.gridSizeX,
                gridSizeY: descriptor.gridSizeY
              },
              tessellationFactor,
              baseSpanX,
              baseSpanY
            });
            if (
              placement.x === extension.object.x &&
              placement.y === extension.object.y &&
              placement.orientation === extension.object.orientation
            ) {
              candidates.push([a, b]);
            }
          } catch {
            // Nonmatching base pair.
          }
        }
      }

      if (candidates.length !== 1) {
        issues.push(block(
          candidates.length === 0
            ? 'FENCE_NATIVE_EXTENSION_ENDPOINTS_UNRESOLVED'
            : 'FENCE_NATIVE_EXTENSION_ENDPOINTS_AMBIGUOUS',
          {
            familyBaseItemID,
            mode,
            gridObjectId: extension.object.id,
            candidateCount: candidates.length
          }
        ));
        continue;
      }

      const [from, to] = candidates[0];
      const dx = to.logicalX - from.logicalX;
      const dy = to.logicalY - from.logicalY;
      const stepX = Math.sign(dx);
      const stepY = Math.sign(dy);
      const steps = Math.max(Math.abs(dx), Math.abs(dy));
      if (steps !== descriptor.key + 1) {
        issues.push(block('FENCE_NATIVE_EXTENSION_LOGICAL_SPAN_MISMATCH', {
          familyBaseItemID,
          gridObjectId: extension.object.id,
          steps,
          key: descriptor.key
        }));
        continue;
      }

      const path = [];
      for (let index = 0; index <= steps; index += 1) {
        const x = from.logicalX + stepX * index;
        const y = from.logicalY + stepY * index;
        const key = coordKey(x, y);
        if (index > 0 && index < steps && baseAt.has(key)) {
          issues.push(block('FENCE_NATIVE_EXTENSION_CROSSES_PERSISTENT_BASE', {
            familyBaseItemID,
            gridObjectId: extension.object.id,
            coordinate: { x, y }
          }));
          break;
        }
        path.push(ensureNode(x, y));
      }
      if (path.length !== steps + 1) continue;
      for (let index = 1; index < path.length; index += 1) {
        addEdge(path[index - 1], path[index]);
      }
      extensionLinks.push({
        extension,
        endpointKeys: [
          coordKey(from.logicalX, from.logicalY),
          coordKey(to.logicalX, to.logicalY)
        ]
      });
    }

    if (issues.length) continue;

    const bases = [...data.bases];
    for (let i = 0; i < bases.length; i += 1) {
      for (let j = i + 1; j < bases.length; j += 1) {
        const a = {
          x: bases[i].logicalX,
          y: bases[i].logicalY
        };
        const b = {
          x: bases[j].logicalX,
          y: bases[j].logicalY
        };
        if (!validFenceStep(a, b, mode)) continue;
        addEdge(ensureNode(a.x, a.y), ensureNode(b.x, b.y));
      }
    }

    const allNodes = [...nodeByKey.values()].sort(compareNode);
    const allEdges = [...edgeByKey.values()].sort((a, b) =>
      edgeKey(a.a, a.b).localeCompare(edgeKey(b.a, b.b))
    );
    const validation = validateFenceLogicalGraph({
      nodes: allNodes,
      edges: allEdges
    });
    if (!validation.ok) {
      issues.push(block('FENCE_NATIVE_RECONSTRUCTED_GRAPH_INVALID', {
        familyBaseItemID,
        mode,
        errors: validation.errors
      }));
      continue;
    }

    const components = connectedGraphComponents(allNodes, allEdges);
    for (const component of components) {
      const networkId = `fence:${familyBaseItemID}:${mode}:${familyNetworkIndex++}`;
      const coordinateSet = new Set(component.nodes.map((node) => coordKey(node.x, node.y)));
      const sourceBases = data.bases.filter((base) =>
        coordinateSet.has(coordKey(base.logicalX, base.logicalY))
      );
      const sourceExtensions = extensionLinks
        .filter((link) => link.endpointKeys.every((key) => coordinateSet.has(key)))
        .map((link) => link.extension);

      networks.push({
        networkId,
        kind: 'fence',
        familyBaseItemID,
        familyName: baseDescriptor.familyName,
        mode,
        coordinateSpace: {
          unit: 'fence-logical-unit',
          savePitch: pitch,
          saveResidueX: residueX,
          saveResidueY: residueY
        },
        graph: {
          nodes: component.nodes.map((node) => ({
            id: node.id,
            x: node.x,
            y: node.y,
            mode: node.mode
          })),
          edges: component.edges.map((edge) => ({ ...edge }))
        },
        logicalQuantity: component.nodes.length,
        bounds: networkBounds(component.nodes),
        persistentWriteAuthorized: PERSISTENT_WRITE_AUTHORIZED
      });

      provenance[networkId] = {
        gridObjectIds: [
          ...sourceBases.map((base) => base.object.id),
          ...sourceExtensions.map((extension) => extension.object.id)
        ].sort((a, b) => a - b),
        nativeObjects: [
          ...sourceBases,
          ...sourceExtensions
        ]
          .map((entry) => ({
            gridObjectId: entry.object.id,
            itemID: entry.object.itemID,
            x: entry.object.x,
            y: entry.object.y,
            orientation: entry.object.orientation,
            role: entry.descriptor.role,
            key: entry.descriptor.key
          }))
          .sort((a, b) => a.gridObjectId - b.gridObjectId)
      };

      for (const base of sourceBases) {
        baseNetwork.set(
          `${mode}:${coordKey(base.logicalX, base.logicalY)}`,
          networkId
        );
      }
    }
  }

  if (issues.length) {
    return { networks: [], provenance: {}, modeBoundaryTouches: [], issues };
  }

  const modeBoundaryTouches = [];
  const orthBases = byMode.get(FenceMode.ORTHOGONAL).bases;
  const diagBases = byMode.get(FenceMode.DIAGONAL).bases;
  for (const a of orthBases) {
    for (const b of diagBases) {
      const dx = Math.abs(a.logicalX - b.logicalX);
      const dy = Math.abs(a.logicalY - b.logicalY);
      if (dx === 0 && dy === 0) {
        issues.push(block('FENCE_NATIVE_CROSS_MODE_BASE_OVERLAP', {
          familyBaseItemID,
          coordinate: { x: a.logicalX, y: a.logicalY }
        }));
        continue;
      }
      if (dx !== 1 || dy !== 1) continue;
      modeBoundaryTouches.push({
        familyBaseItemID,
        classification: 'geometric-cross-mode-touch',
        authoritativeConnectedEdge: false,
        a: {
          networkId: baseNetwork.get(
            `${FenceMode.ORTHOGONAL}:${coordKey(a.logicalX, a.logicalY)}`
          ),
          x: a.logicalX,
          y: a.logicalY,
          mode: FenceMode.ORTHOGONAL
        },
        b: {
          networkId: baseNetwork.get(
            `${FenceMode.DIAGONAL}:${coordKey(b.logicalX, b.logicalY)}`
          ),
          x: b.logicalX,
          y: b.logicalY,
          mode: FenceMode.DIAGONAL
        }
      });
    }
  }

  if (issues.length) {
    return { networks: [], provenance: {}, modeBoundaryTouches: [], issues };
  }

  return { networks, provenance, modeBoundaryTouches, issues: [] };
}

function readFences(objects, catalog, tessellationFactor) {
  const issues = [];
  const networks = [];
  const provenance = {};
  const modeBoundaryTouches = [];
  const byFamily = new Map();

  for (const object of objects) {
    const descriptor = catalog.fenceItems.get(object.itemID);
    if (!descriptor) continue;
    const list = byFamily.get(descriptor.familyBaseItemID) ?? [];
    list.push({ object, descriptor });
    byFamily.set(descriptor.familyBaseItemID, list);
  }

  for (const [familyBaseItemID, entries] of [...byFamily.entries()].sort((a, b) => a[0] - b[0])) {
    const result = readFenceFamily(
      familyBaseItemID,
      entries,
      catalog,
      tessellationFactor
    );
    issues.push(...result.issues);
    networks.push(...result.networks);
    Object.assign(provenance, result.provenance);
    modeBoundaryTouches.push(...result.modeBoundaryTouches);
  }

  return { networks, provenance, modeBoundaryTouches, issues };
}

export function readRoadFenceNativeGridV125({
  grid,
  gridId = grid?.ID ?? null,
  catalog,
  tessellationFactor = grid?.TessellationFactor
}) {
  const normalizedCatalog = normalizeCatalog(catalog);
  const factor = positiveInteger(tessellationFactor, 'TessellationFactor');
  const objects = normalizeGridObjects(grid);
  const normalizedGridId = gridId == null ? null : safeInteger(gridId, 'gridId');

  const roads = readRoads(objects, normalizedCatalog, factor);
  const fences = readFences(objects, normalizedCatalog, factor);
  const issues = [...roads.issues, ...fences.issues];
  const matchedIds = new Set([
    ...normalizedCatalog.roadItems.keys(),
    ...normalizedCatalog.fenceItems.keys()
  ]);
  const matchedObjectCount = objects.filter((object) => matchedIds.has(object.itemID)).length;

  return {
    schema: ROADFENCE_NATIVE_READER_V125_SCHEMA,
    version: ROADFENCE_NATIVE_READER_V125_VERSION,
    gameVersion: GAME_VERSION,
    gridId: normalizedGridId,
    tessellationFactor: factor,
    ok: issues.length === 0,
    status: issues.length === 0 ? 'supported' : 'blocked',
    roads: roads.networks,
    fences: fences.networks,
    modeBoundaryTouches: fences.modeBoundaryTouches,
    coverage: {
      catalogComplete: true,
      matchedNativeObjectCount: matchedObjectCount,
      roadNativeObjectCount: Object.values(roads.provenance)
        .reduce((sum, entry) => sum + entry.gridObjectIds.length, 0),
      fenceNativeObjectCount: Object.values(fences.provenance)
        .reduce((sum, entry) => sum + entry.gridObjectIds.length, 0)
    },
    issues,
    provenance: {
      gridId: normalizedGridId,
      roads: roads.provenance,
      fences: fences.provenance
    },
    normalization: {
      logicalNetworksExcludeSaveLocalGridObjectIdentity: true,
      modeBoundaryTouchesAreNonAuthoritativeConnectivity: true
    },
    persistentWriteAuthorized: PERSISTENT_WRITE_AUTHORIZED
  };
}


function normalizeCaptureRegion(region) {
  if (!plain(region)) throw new TypeError('capture region is required');
  const x = safeInteger(region.x, 'capture region x');
  const y = safeInteger(region.y, 'capture region y');
  const w = positiveInteger(region.w, 'capture region w');
  const h = positiveInteger(region.h, 'capture region h');
  return { x, y, w, h };
}

function logicalPointToReaderSave(point, coordinateSpace) {
  return {
    x: coordinateSpace.saveResidueX + point.x * coordinateSpace.savePitch,
    y: coordinateSpace.saveResidueY + point.y * coordinateSpace.savePitch
  };
}

function unitIntersectsRegion(point, coordinateSpace, region) {
  const save = logicalPointToReaderSave(point, coordinateSpace);
  const size = coordinateSpace.savePitch;
  return (
    save.x < region.x + region.w &&
    save.x + size > region.x &&
    save.y < region.y + region.h &&
    save.y + size > region.y
  );
}

function unitContainedByRegion(point, coordinateSpace, region) {
  const save = logicalPointToReaderSave(point, coordinateSpace);
  const size = coordinateSpace.savePitch;
  return (
    save.x >= region.x &&
    save.y >= region.y &&
    save.x + size <= region.x + region.w &&
    save.y + size <= region.y + region.h
  );
}

function networkLogicalPoints(network) {
  if (network.kind === 'road') return network.cells ?? [];
  if (network.kind === 'fence') return network.graph?.nodes ?? [];
  return [];
}

function networkSaveSortKey(network) {
  const points = networkLogicalPoints(network);
  if (!points.length) return [Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER, network.familyBaseItemID];
  const saves = points.map((point) =>
    logicalPointToReaderSave(point, network.coordinateSpace)
  );
  saves.sort(comparePoint);
  return [saves[0].y, saves[0].x, network.familyBaseItemID];
}

function compareNetworkSavePosition(a, b) {
  const ka = networkSaveSortKey(a);
  const kb = networkSaveSortKey(b);
  return ka[0] - kb[0] || ka[1] - kb[1] || ka[2] - kb[2] ||
    String(a.networkId).localeCompare(String(b.networkId));
}

function localizeRoadNetwork(network, region, artifactNetworkId) {
  const cells = [...(network.cells ?? [])]
    .map((cell) => {
      const save = logicalPointToReaderSave(cell, network.coordinateSpace);
      return {
        x: save.x - region.x,
        y: save.y - region.y,
        mode: cell.mode
      };
    })
    .sort(comparePoint);

  return {
    networkId: artifactNetworkId,
    familyBaseItemID: network.familyBaseItemID,
    ...(network.familyName ? { familyName: network.familyName } : {}),
    cells
  };
}

function localizeFenceNetwork(network, region, artifactNetworkId) {
  const orderedNodes = [...(network.graph?.nodes ?? [])]
    .map((node) => {
      const save = logicalPointToReaderSave(node, network.coordinateSpace);
      return {
        sourceId: node.id,
        x: save.x - region.x,
        y: save.y - region.y,
        mode: node.mode
      };
    })
    .sort(compareNode);

  const idMap = new Map(
    orderedNodes.map((node, index) => [node.sourceId, `n${index}`])
  );
  const nodes = orderedNodes.map((node, index) => ({
    id: `n${index}`,
    x: node.x,
    y: node.y,
    mode: node.mode
  }));
  const edges = [...(network.graph?.edges ?? [])]
    .map((edge) => ({
      a: idMap.get(edge.a),
      b: idMap.get(edge.b)
    }))
    .sort((a, b) => edgeKey(a.a, a.b).localeCompare(edgeKey(b.a, b.b)));

  if (edges.some((edge) => !edge.a || !edge.b)) {
    throw new Error('FENCE_CAPTURE_EDGE_NODE_UNRESOLVED');
  }

  return {
    networkId: artifactNetworkId,
    familyBaseItemID: network.familyBaseItemID,
    ...(network.familyName ? { familyName: network.familyName } : {}),
    mode: network.mode,
    graph: { nodes, edges }
  };
}

export function captureRoadFenceReaderRegionV125(
  readerResult,
  kind,
  regionInput
) {
  if (
    !plain(readerResult) ||
    readerResult.schema !== ROADFENCE_NATIVE_READER_V125_SCHEMA ||
    Number(readerResult.version) !== ROADFENCE_NATIVE_READER_V125_VERSION ||
    readerResult.gameVersion !== GAME_VERSION ||
    readerResult.status !== 'supported' ||
    readerResult.ok !== true
  ) {
    return {
      status: 'blocked',
      code: 'ROADFENCE_NATIVE_READER_NOT_SUPPORTED',
      issues: [block('ROADFENCE_NATIVE_READER_NOT_SUPPORTED')],
      persistentWriteAuthorized: PERSISTENT_WRITE_AUTHORIZED
    };
  }
  if (!['roads', 'fences'].includes(kind)) {
    throw new RangeError('kind must be roads or fences');
  }

  const region = normalizeCaptureRegion(regionInput);
  const source = kind === 'roads' ? readerResult.roads : readerResult.fences;
  if (!Array.isArray(source)) {
    return {
      status: 'blocked',
      code: 'ROADFENCE_NATIVE_READER_RESULT_INVALID',
      issues: [block('ROADFENCE_NATIVE_READER_RESULT_INVALID')],
      persistentWriteAuthorized: PERSISTENT_WRITE_AUTHORIZED
    };
  }

  const intersecting = [];
  const clipped = [];
  for (const network of source) {
    const points = networkLogicalPoints(network);
    if (!points.length) continue;
    const touches = points.some((point) =>
      unitIntersectsRegion(point, network.coordinateSpace, region)
    );
    if (!touches) continue;
    const contained = points.every((point) =>
      unitContainedByRegion(point, network.coordinateSpace, region)
    );
    if (!contained) clipped.push(network);
    else intersecting.push(network);
  }

  if (clipped.length) {
    return {
      status: 'blocked',
      code: 'TOPOLOGY_CLIPPED_UNSUPPORTED',
      issues: clipped.map((network) =>
        block('TOPOLOGY_CLIPPED_UNSUPPORTED', {
          kind,
          networkId: network.networkId,
          familyBaseItemID: network.familyBaseItemID
        })
      ),
      persistentWriteAuthorized: PERSISTENT_WRITE_AUTHORIZED
    };
  }

  intersecting.sort(compareNetworkSavePosition);
  const sourceToArtifact = new Map();
  const networks = intersecting.map((network, index) => {
    const artifactNetworkId = kind === 'roads' ? `r${index}` : `f${index}`;
    sourceToArtifact.set(network.networkId, artifactNetworkId);
    return kind === 'roads'
      ? localizeRoadNetwork(network, region, artifactNetworkId)
      : localizeFenceNetwork(network, region, artifactNetworkId);
  });

  const modeBoundaryTouches = kind === 'fences'
    ? (readerResult.modeBoundaryTouches ?? [])
      .filter((touch) =>
        sourceToArtifact.has(touch.a?.networkId) &&
        sourceToArtifact.has(touch.b?.networkId)
      )
      .map((touch) => {
        const aNetwork = source.find((network) => network.networkId === touch.a.networkId);
        const bNetwork = source.find((network) => network.networkId === touch.b.networkId);
        const aSave = logicalPointToReaderSave(touch.a, aNetwork.coordinateSpace);
        const bSave = logicalPointToReaderSave(touch.b, bNetwork.coordinateSpace);
        return {
          classification: touch.classification,
          authoritativeConnectedEdge: false,
          a: {
            networkId: sourceToArtifact.get(touch.a.networkId),
            x: aSave.x - region.x,
            y: aSave.y - region.y,
            mode: touch.a.mode
          },
          b: {
            networkId: sourceToArtifact.get(touch.b.networkId),
            x: bSave.x - region.x,
            y: bSave.y - region.y,
            mode: touch.b.mode
          }
        };
      })
    : [];

  return {
    status: 'supported',
    data: {
      schema: 'dreamwish-wand-wep-network-capture',
      version: 1,
      kind,
      originPolicy: 'capture-region-top-left',
      networks,
      ...(kind === 'fences' && modeBoundaryTouches.length
        ? { modeBoundaryTouches }
        : {}),
      normalization: {
        sourceGridObjectIdsRemoved: true,
        artifactNetworkIdsLocal: true,
        partialTopologyFailsClosed: true
      },
      persistentWriteAuthorized: PERSISTENT_WRITE_AUTHORIZED
    },
    persistentWriteAuthorized: PERSISTENT_WRITE_AUTHORIZED
  };
}
