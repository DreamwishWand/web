import {
  FENCE_REPRESENTATION_LAYOUT_SCHEMA,
  fenceLogicalTopologyFingerprint,
  validateFenceRepresentationLayoutModel
} from '../ddv/core/roadfence/representation-layout-v125.ts';

type AnyRecord = Record<string, any>;

function plain(value: unknown): value is AnyRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function safeInteger(value: unknown, code: string) {
  const n = Number(value);
  if (!Number.isSafeInteger(n)) throw new Error(code);
  return n;
}

function edgeKey(a: string, b: string) {
  return a < b ? `${a}::${b}` : `${b}::${a}`;
}

function localPoint(
  point: AnyRecord,
  coordinateSpace: AnyRecord,
  region: AnyRecord
) {
  const pitch = safeInteger(
    coordinateSpace?.savePitch,
    'WEP_FENCE_REPRESENTATION_COORDINATE_SPACE_INVALID'
  );
  const residueX = safeInteger(
    coordinateSpace?.saveResidueX,
    'WEP_FENCE_REPRESENTATION_COORDINATE_SPACE_INVALID'
  );
  const residueY = safeInteger(
    coordinateSpace?.saveResidueY,
    'WEP_FENCE_REPRESENTATION_COORDINATE_SPACE_INVALID'
  );
  return {
    x:
      residueX +
      safeInteger(
        point?.x,
        'WEP_FENCE_REPRESENTATION_POINT_INVALID'
      ) *
        pitch -
      safeInteger(
        region?.x,
        'WEP_FENCE_REPRESENTATION_REGION_INVALID'
      ),
    y:
      residueY +
      safeInteger(
        point?.y,
        'WEP_FENCE_REPRESENTATION_POINT_INVALID'
      ) *
        pitch -
      safeInteger(
        region?.y,
        'WEP_FENCE_REPRESENTATION_REGION_INVALID'
      )
  };
}

function bindNodeMap({
  sourceNetwork,
  artifactNetwork,
  region
}: {
  sourceNetwork: AnyRecord;
  artifactNetwork: AnyRecord;
  region: AnyRecord;
}) {
  if (
    !plain(sourceNetwork?.graph) ||
    !Array.isArray(sourceNetwork.graph.nodes) ||
    !Array.isArray(sourceNetwork.graph.edges) ||
    !plain(artifactNetwork?.graph) ||
    !Array.isArray(artifactNetwork.graph.nodes) ||
    !Array.isArray(artifactNetwork.graph.edges)
  ) {
    throw new Error('WEP_FENCE_REPRESENTATION_GRAPH_INVALID');
  }

  const artifactByCoordinate = new Map<string, AnyRecord[]>();
  for (const node of artifactNetwork.graph.nodes) {
    const key = [
      Number(node?.x),
      Number(node?.y),
      String(node?.mode ?? artifactNetwork.mode ?? '')
    ].join('|');
    const bucket = artifactByCoordinate.get(key) ?? [];
    bucket.push(node);
    artifactByCoordinate.set(key, bucket);
  }

  const idMap = new Map<string, string>();
  for (const sourceNode of sourceNetwork.graph.nodes) {
    const local = localPoint(
      sourceNode,
      sourceNetwork.coordinateSpace,
      region
    );
    const key = [
      local.x,
      local.y,
      String(sourceNode?.mode ?? sourceNetwork.mode ?? '')
    ].join('|');
    const matches = artifactByCoordinate.get(key) ?? [];
    if (matches.length !== 1) {
      throw new Error(
        'WEP_FENCE_REPRESENTATION_ARTIFACT_NODE_BINDING_AMBIGUOUS'
      );
    }
    idMap.set(
      String(sourceNode.id ?? ''),
      String(matches[0].id ?? '')
    );
  }

  if (
    idMap.size !== sourceNetwork.graph.nodes.length ||
    idMap.size !== artifactNetwork.graph.nodes.length
  ) {
    throw new Error(
      'WEP_FENCE_REPRESENTATION_ARTIFACT_NODE_COVERAGE_MISMATCH'
    );
  }

  const artifactEdges = new Set(
    artifactNetwork.graph.edges.map((edge: AnyRecord) =>
      edgeKey(String(edge.a ?? ''), String(edge.b ?? ''))
    )
  );
  for (const edge of sourceNetwork.graph.edges) {
    const a = idMap.get(String(edge.a ?? ''));
    const b = idMap.get(String(edge.b ?? ''));
    if (!a || !b || !artifactEdges.has(edgeKey(a, b))) {
      throw new Error(
        'WEP_FENCE_REPRESENTATION_ARTIFACT_EDGE_MISMATCH'
      );
    }
  }

  return idMap;
}

function artifactNodeIndex(artifactNetwork: AnyRecord) {
  return new Map(
    (artifactNetwork?.graph?.nodes ?? []).map((node: AnyRecord) => [
      String(node.id ?? ''),
      node
    ])
  );
}

function mapNodeId(
  idMap: Map<string, string>,
  value: unknown,
  code: string
) {
  const mapped = idMap.get(String(value ?? ''));
  if (!mapped) throw new Error(code);
  return mapped;
}

export function rebaseFenceRepresentationForArtifact({
  sourceNetwork,
  artifactNetwork,
  sourceModel,
  region
}: {
  sourceNetwork: AnyRecord;
  artifactNetwork: AnyRecord;
  sourceModel: AnyRecord;
  region: AnyRecord;
}) {
  if (
    !plain(sourceModel) ||
    sourceModel.schema !== FENCE_REPRESENTATION_LAYOUT_SCHEMA ||
    sourceModel.persistentWriteAuthorized !== false
  ) {
    throw new Error(
      'WEP_FENCE_REPRESENTATION_SOURCE_MODEL_INVALID'
    );
  }

  const sourceValidation =
    validateFenceRepresentationLayoutModel(sourceModel);
  if (!sourceValidation.ok) {
    throw new Error(
      String(
        sourceValidation.issues?.[0]?.code ??
          'WEP_FENCE_REPRESENTATION_SOURCE_MODEL_INVALID'
      )
    );
  }

  if (
    Number(sourceNetwork?.familyBaseItemID) !==
      Number(artifactNetwork?.familyBaseItemID) ||
    String(sourceNetwork?.mode ?? '') !==
      String(artifactNetwork?.mode ?? '')
  ) {
    throw new Error(
      'WEP_FENCE_REPRESENTATION_ARTIFACT_NETWORK_MISMATCH'
    );
  }

  const idMap = bindNodeMap({
    sourceNetwork,
    artifactNetwork,
    region
  });
  const artifactNodes = artifactNodeIndex(artifactNetwork);

  const localizedTopology = {
    familyBaseItemID: Number(artifactNetwork.familyBaseItemID),
    ...(artifactNetwork.familyName
      ? { familyName: String(artifactNetwork.familyName) }
      : {}),
    mode: String(artifactNetwork.mode ?? ''),
    logicalQuantity: Number(
      sourceModel.logicalTopology?.logicalQuantity
    ),
    graph: clone(artifactNetwork.graph),
    modeBoundaryNodeIds: (
      sourceModel.logicalTopology?.modeBoundaryNodeIds ?? []
    ).map((nodeId: unknown) =>
      mapNodeId(
        idMap,
        nodeId,
        'WEP_FENCE_REPRESENTATION_MODE_BOUNDARY_BINDING_FAILED'
      )
    ),
    semanticAnchors: (
      sourceModel.logicalTopology?.semanticAnchors ?? []
    ).map((anchor: AnyRecord) => {
      const nodeId = mapNodeId(
        idMap,
        anchor?.nodeId,
        'WEP_FENCE_REPRESENTATION_ANCHOR_BINDING_FAILED'
      );
      const node = artifactNodes.get(nodeId);
      if (!node) {
        throw new Error(
          'WEP_FENCE_REPRESENTATION_ANCHOR_NODE_MISSING'
        );
      }
      return {
        nodeId,
        x: Number(node.x),
        y: Number(node.y),
        reason: String(anchor?.reason ?? '')
      };
    }),
    runs: (sourceModel.logicalTopology?.runs ?? []).map(
      (run: AnyRecord) => ({
        runId: String(run?.runId ?? ''),
        mode: String(run?.mode ?? artifactNetwork.mode ?? ''),
        nodeIds: (run?.nodeIds ?? []).map((nodeId: unknown) =>
          mapNodeId(
            idMap,
            nodeId,
            'WEP_FENCE_REPRESENTATION_RUN_BINDING_FAILED'
          )
        ),
        startAnchorNodeId: mapNodeId(
          idMap,
          run?.startAnchorNodeId,
          'WEP_FENCE_REPRESENTATION_RUN_BINDING_FAILED'
        ),
        endAnchorNodeId: mapNodeId(
          idMap,
          run?.endAnchorNodeId,
          'WEP_FENCE_REPRESENTATION_RUN_BINDING_FAILED'
        ),
        intervalLength: Number(run?.intervalLength)
      })
    )
  };

  const localizedRepresentation = {
    intent: String(
      sourceModel.representationLayout?.intent ?? ''
    ),
    policy: String(
      sourceModel.representationLayout?.policy ?? ''
    ),
    posts: (sourceModel.representationLayout?.posts ?? []).map(
      (post: AnyRecord) => {
        const nodeId = mapNodeId(
          idMap,
          post?.nodeId,
          'WEP_FENCE_REPRESENTATION_POST_BINDING_FAILED'
        );
        const node = artifactNodes.get(nodeId);
        if (!node) {
          throw new Error(
            'WEP_FENCE_REPRESENTATION_POST_NODE_MISSING'
          );
        }
        return {
          kind: String(post?.kind ?? ''),
          nodeId,
          runId: String(post?.runId ?? ''),
          x: Number(node.x),
          y: Number(node.y),
          pinned: post?.pinned === true,
          source: String(post?.source ?? '')
        };
      }
    )
  };

  const model = {
    schema: FENCE_REPRESENTATION_LAYOUT_SCHEMA,
    contractSource: clone(sourceModel.contractSource ?? {}),
    networkId: String(artifactNetwork.networkId ?? ''),
    logicalTopology: localizedTopology,
    representationLayout: localizedRepresentation,
    invariants: {
      sourceTopologyFingerprint:
        fenceLogicalTopologyFingerprint(localizedTopology),
      sourceLogicalQuantity: Number(
        localizedTopology.logicalQuantity
      )
    },
    provenance: {
      portableProjection: true,
      sourceGridObjectIdentityExcluded: true
    },
    persistentWriteAuthorized: false
  };

  const validation =
    validateFenceRepresentationLayoutModel(model);
  if (!validation.ok) {
    throw new Error(
      String(
        validation.issues?.[0]?.code ??
          'WEP_FENCE_REPRESENTATION_ARTIFACT_INVALID'
      )
    );
  }

  return model;
}

export function validateFenceRepresentationArtifactNetwork(
  network: AnyRecord
) {
  const issues: AnyRecord[] = [];
  const model = network?.representationLayout;
  if (model == null) {
    return {
      ok: true,
      issues,
      representationLayoutPresent: false
    };
  }

  if (
    !plain(model) ||
    model.schema !== FENCE_REPRESENTATION_LAYOUT_SCHEMA ||
    model.persistentWriteAuthorized !== false
  ) {
    return {
      ok: false,
      issues: [
        {
          severity: 'BLOCK',
          code: 'FENCE_REPRESENTATION_LAYOUT_INVALID'
        }
      ],
      representationLayoutPresent: true
    };
  }

  if (
    String(model.networkId ?? '') !==
      String(network?.networkId ?? '') ||
    Number(model.logicalTopology?.familyBaseItemID) !==
      Number(network?.familyBaseItemID) ||
    String(model.logicalTopology?.mode ?? '') !==
      String(network?.mode ?? '') ||
    JSON.stringify(model.logicalTopology?.graph ?? null) !==
      JSON.stringify(network?.graph ?? null)
  ) {
    issues.push({
      severity: 'BLOCK',
      code: 'FENCE_REPRESENTATION_LAYOUT_NETWORK_MISMATCH'
    });
  }

  const validation =
    validateFenceRepresentationLayoutModel(model);
  for (const entry of validation.issues ?? []) {
    issues.push(clone(entry));
  }

  return {
    ok: issues.length === 0,
    issues,
    representationLayoutPresent: true,
    validation
  };
}
