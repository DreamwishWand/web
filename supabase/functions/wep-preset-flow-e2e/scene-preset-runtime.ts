export interface WepIssue {
  severity: 'BLOCK' | 'WARNING';
  code: string;
  path?: string;
  [key: string]: unknown;
}

type AnyRecord = Record<string, any>;

const FORBIDDEN = new Set([
  'editorid','gridid','gridobjectid','sourcegridid','sourcegridobjectid',
  'subgridid','nextgridid','nextgridobjectid','objectkey','sourcediagnostics'
]);

function plain(value: unknown): value is AnyRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function issue(code: string, path = '$'): WepIssue {
  return { severity: 'BLOCK', code, path };
}

function walkForbidden(value: unknown, path: string, issues: WepIssue[]): void {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => walkForbidden(entry, `${path}[${index}]`, issues));
    return;
  }
  if (!plain(value)) return;
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN.has(key.toLowerCase())) {
      issues.push(issue('SAVE_LOCAL_IDENTITY_FORBIDDEN', `${path}.${key}`));
    }
    walkForbidden(child, `${path}.${key}`, issues);
  }
}

function validateFootprint(value: unknown, path: string, issues: WepIssue[]): void {
  if (!Array.isArray(value) || value.length === 0) {
    issues.push(issue('FOOTPRINT_INVALID', path));
    return;
  }
  value.forEach((cell, index) => {
    if (
      !plain(cell) ||
      !Number.isSafeInteger(Number(cell.x)) ||
      !Number.isSafeInteger(Number(cell.y))
    ) {
      issues.push(issue('FOOTPRINT_INVALID', `${path}[${index}]`));
    }
  });
}

function validatePortableState(value: unknown, path: string, issues: WepIssue[]): void {
  if (value == null) return;
  if (!plain(value)) {
    issues.push(issue('PORTABLE_STATE_INVALID', path));
    return;
  }
  const codec = String(value.codec ?? '');
  if (codec === 'subgrid.itemdata-default-empty-child@1') return;
  if (codec !== 'subgrid.serialized-local-child@1') {
    issues.push(issue('PORTABLE_STATE_CODEC_UNSUPPORTED', path));
    return;
  }
  const child = value.child;
  if (
    !plain(child) ||
    !Number.isSafeInteger(Number(child.width)) ||
    Number(child.width) <= 0 ||
    !Number.isSafeInteger(Number(child.height)) ||
    Number(child.height) <= 0 ||
    !Number.isSafeInteger(Number(child.tessellationFactor)) ||
    Number(child.tessellationFactor) <= 0 ||
    !Array.isArray(child.objects)
  ) {
    issues.push(issue('SUBGRID_CHILD_INVALID', `${path}.child`));
    return;
  }
  const ids = new Set<string>();
  child.objects.forEach((object: unknown, index: number) => {
    const current = `${path}.child.objects[${index}]`;
    if (!plain(object)) {
      issues.push(issue('SUBGRID_OBJECT_INVALID', current));
      return;
    }
    const id = String(object.artifactObjectId ?? '');
    if (!/^c\d+$/.test(id) || ids.has(id)) {
      issues.push(issue('SUBGRID_OBJECT_ID_INVALID', `${current}.artifactObjectId`));
    } else {
      ids.add(id);
    }
    if (
      !Number.isSafeInteger(Number(object.itemId)) ||
      Number(object.itemId) <= 0 ||
      !Number.isSafeInteger(Number(object.localX)) ||
      !Number.isSafeInteger(Number(object.localY)) ||
      !Number.isSafeInteger(Number(object.orientation)) ||
      Number(object.orientation) < 0 ||
      Number(object.orientation) > 15
    ) {
      issues.push(issue('SUBGRID_OBJECT_INVALID', current));
    }
    validateFootprint(object.footprint, `${current}.footprint`, issues);
    validatePortableState(object.portableState, `${current}.portableState`, issues);
  });
}

function validateNetwork(
  value: unknown,
  kind: 'roads' | 'fences',
  width: number,
  height: number,
  path: string,
  issues: WepIssue[]
): void {
  if (value == null) return;
  if (
    !plain(value) ||
    value.schema !== 'dreamwish-wand-wep-network-capture' ||
    Number(value.version) !== 1 ||
    value.kind !== kind ||
    value.originPolicy !== 'capture-region-top-left' ||
    !Array.isArray(value.networks)
  ) {
    issues.push(issue('NETWORK_CAPTURE_INVALID', path));
    return;
  }
  value.networks.forEach((network: unknown, index: number) => {
    const current = `${path}.networks[${index}]`;
    if (
      !plain(network) ||
      !String(network.networkId ?? '') ||
      !Number.isSafeInteger(Number(network.familyBaseItemID)) ||
      Number(network.familyBaseItemID) <= 0
    ) {
      issues.push(issue('NETWORK_INVALID', current));
      return;
    }
    if (kind === 'roads') {
      if (!Array.isArray(network.cells)) {
        issues.push(issue('ROAD_CELLS_INVALID', `${current}.cells`));
        return;
      }
      network.cells.forEach((cell: unknown, cellIndex: number) => {
        const x = Number((cell as AnyRecord)?.x);
        const y = Number((cell as AnyRecord)?.y);
        if (
          !plain(cell) ||
          !Number.isSafeInteger(x) ||
          !Number.isSafeInteger(y) ||
          x < 0 || y < 0 || x >= width || y >= height ||
          !String(cell.mode ?? '')
        ) {
          issues.push(issue('ROAD_CELL_INVALID', `${current}.cells[${cellIndex}]`));
        }
      });
      return;
    }

    const graph = network.graph;
    if (!plain(graph) || !Array.isArray(graph.nodes) || !Array.isArray(graph.edges)) {
      issues.push(issue('FENCE_GRAPH_INVALID', `${current}.graph`));
      return;
    }
    const nodeIds = new Set<string>();
    graph.nodes.forEach((node: unknown, nodeIndex: number) => {
      const id = String((node as AnyRecord)?.id ?? '');
      const x = Number((node as AnyRecord)?.x);
      const y = Number((node as AnyRecord)?.y);
      if (
        !plain(node) ||
        !/^n\d+$/.test(id) ||
        nodeIds.has(id) ||
        !Number.isSafeInteger(x) ||
        !Number.isSafeInteger(y) ||
        x < 0 || y < 0 || x >= width || y >= height ||
        !String(node.mode ?? '')
      ) {
        issues.push(issue('FENCE_NODE_INVALID', `${current}.graph.nodes[${nodeIndex}]`));
      } else {
        nodeIds.add(id);
      }
    });
    graph.edges.forEach((edge: unknown, edgeIndex: number) => {
      if (
        !plain(edge) ||
        !nodeIds.has(String(edge.a ?? '')) ||
        !nodeIds.has(String(edge.b ?? ''))
      ) {
        issues.push(issue('FENCE_EDGE_INVALID', `${current}.graph.edges[${edgeIndex}]`));
      }
    });
  });
}

export function validatePublishablePreset(artifact: unknown) {
  const issues: WepIssue[] = [];
  if (!plain(artifact)) {
    return {
      ok: false,
      presetType: null,
      schemaVersion: null,
      issues: [issue('PRESET_ARTIFACT_INVALID')]
    };
  }

  walkForbidden(artifact, '$', issues);
  if (artifact.schema !== 'dreamwish-wand-preset') {
    issues.push(issue('PRESET_SCHEMA_UNSUPPORTED', '$.schema'));
  }

  const schemaVersion = Number(artifact.artifactVersion ?? artifact.schemaVersion ?? 0);
  if (!Number.isSafeInteger(schemaVersion) || schemaVersion <= 0) {
    issues.push(issue('PRESET_SCHEMA_VERSION_INVALID'));
  }

  const presetType = String(artifact.type ?? artifact.artifactType ?? '').toLowerCase();
  if (presetType !== 'scene') {
    issues.push(issue(presetType ? 'PRESET_TYPE_VALIDATOR_NOT_AVAILABLE' : 'PRESET_TYPE_INVALID'));
  }

  if (presetType === 'scene') {
    const bounds = artifact.bounds;
    const width = Number(bounds?.w);
    const height = Number(bounds?.h);
    if (
      !plain(bounds) ||
      !Number.isSafeInteger(width) || width <= 0 ||
      !Number.isSafeInteger(height) || height <= 0
    ) {
      issues.push(issue('SCENE_BOUNDS_INVALID', '$.bounds'));
    }
    if (artifact.originPolicy !== 'capture-region-top-left') {
      issues.push(issue('SCENE_ORIGIN_POLICY_UNSUPPORTED', '$.originPolicy'));
    }
    if (!Array.isArray(artifact.objects) || artifact.objects.length === 0) {
      issues.push(issue('SCENE_OBJECTS_INVALID', '$.objects'));
    } else {
      const ids = new Set<string>();
      artifact.objects.forEach((object: unknown, index: number) => {
        const current = `$.objects[${index}]`;
        if (!plain(object)) {
          issues.push(issue('SCENE_OBJECT_INVALID', current));
          return;
        }
        const id = String(object.artifactObjectId ?? '');
        if (!/^o\d+$/.test(id) || ids.has(id)) {
          issues.push(issue('SCENE_OBJECT_ID_INVALID', `${current}.artifactObjectId`));
        } else {
          ids.add(id);
        }
        if (
          !Number.isSafeInteger(Number(object.itemId)) ||
          Number(object.itemId) <= 0 ||
          !Number.isSafeInteger(Number(object.localX)) ||
          !Number.isSafeInteger(Number(object.localY)) ||
          !Number.isSafeInteger(Number(object.orientation)) ||
          Number(object.orientation) < 0 ||
          Number(object.orientation) > 15
        ) {
          issues.push(issue('SCENE_OBJECT_INVALID', current));
        }
        validateFootprint(object.footprint, `${current}.footprint`, issues);
        validatePortableState(object.portableState, `${current}.portableState`, issues);
        if (!Array.isArray(object.dependencyIds)) {
          issues.push(issue('SCENE_DEPENDENCIES_INVALID', `${current}.dependencyIds`));
        }
      });
      artifact.objects.forEach((object: unknown, index: number) => {
        if (!plain(object) || !Array.isArray(object.dependencyIds)) return;
        object.dependencyIds.forEach((dependency: unknown, dependencyIndex: number) => {
          if (typeof dependency !== 'string' || !ids.has(dependency)) {
            issues.push(issue(
              'SCENE_DEPENDENCY_OUTSIDE_ARTIFACT',
              `$.objects[${index}].dependencyIds[${dependencyIndex}]`
            ));
          }
        });
      });
    }

    if (plain(artifact.networks)) {
      validateNetwork(artifact.networks.roads, 'roads', width, height, '$.networks.roads', issues);
      validateNetwork(artifact.networks.fences, 'fences', width, height, '$.networks.fences', issues);
    } else if (artifact.networks != null) {
      issues.push(issue('SCENE_NETWORK_ENVELOPE_INVALID', '$.networks'));
    }
  }

  return {
    ok: issues.length === 0,
    presetType: presetType || null,
    schemaVersion: Number.isSafeInteger(schemaVersion) && schemaVersion > 0 ? schemaVersion : null,
    issues
  };
}

export function buildPublishEnvelope(artifact: unknown) {
  const validation = validatePublishablePreset(artifact);
  if (!validation.ok) return { ...validation, envelope: null };
  const json = JSON.stringify(artifact);
  return {
    ...validation,
    envelope: {
      contentType: 'application/json',
      byteSize: new TextEncoder().encode(json).length,
      presetType: validation.presetType,
      schemaVersion: validation.schemaVersion,
      json
    }
  };
}

export function preflightScene(
  artifact: any,
  options: {
    inventory?: Record<string, number> | null;
    capabilities?: Record<string, string>;
    destination?: { x?: number; y?: number } | null;
  } = {}
) {
  const validation = validatePublishablePreset(artifact);
  const issues: WepIssue[] = [...validation.issues];
  if (!validation.ok || validation.presetType !== 'scene') {
    return {
      ok: false,
      issues,
      placements: [],
      writeReady: false,
      reason: 'PRESET_ARTIFACT_INVALID'
    };
  }

  const capabilities = options.capabilities ?? {};
  if (artifact.networks?.roads && capabilities.roadTopologyApply !== 'supported') {
    issues.push({ severity: 'BLOCK', code: 'ROAD_TOPOLOGY_APPLY_UNAVAILABLE' });
  }
  if (artifact.networks?.fences && capabilities.fenceTopologyApply !== 'supported') {
    issues.push({ severity: 'BLOCK', code: 'FENCE_TOPOLOGY_APPLY_UNAVAILABLE' });
  }

  const stock = new Map<number, number>(
    Object.entries(options.inventory ?? {}).map(([key, value]) => [Number(key), Number(value)])
  );
  const used = new Map<number, number>();
  const placements = artifact.objects.map((object: AnyRecord) => {
    const itemId = Number(object.itemId);
    const required = (used.get(itemId) ?? 0) + 1;
    used.set(itemId, required);
    const available = stock.has(itemId) ? stock.get(itemId)! : null;
    let mode = 'NORMAL';

    if (available !== null && required > available) {
      mode =
        capabilities.miragePlacement === 'supported'
          ? 'MIRAGE_REQUIRED'
          : 'BLOCKED_SHORTAGE';
      if (mode === 'BLOCKED_SHORTAGE') {
        issues.push({
          severity: 'BLOCK',
          code: 'ITEM_SHORTAGE',
          itemId,
          required,
          available
        });
      }
    }

    return {
      artifactObjectId: object.artifactObjectId,
      itemId,
      mode,
      x: Number(options.destination?.x ?? 0) + Number(object.localX),
      y: Number(options.destination?.y ?? 0) + Number(object.localY),
      orientation: Number(object.orientation)
    };
  });

  return {
    ok: !issues.some((entry) => entry.severity === 'BLOCK'),
    issues,
    placements,
    summary: {
      objectCount: artifact.objects.length,
      normal: placements.filter((entry: AnyRecord) => entry.mode === 'NORMAL').length,
      mirage: placements.filter((entry: AnyRecord) => entry.mode === 'MIRAGE_REQUIRED').length,
      blocked: placements.filter((entry: AnyRecord) => String(entry.mode).startsWith('BLOCKED')).length
    },
    writeReady: false,
    reason: 'CORE_COMMIT_ADAPTER_NOT_BOUND'
  };
}
