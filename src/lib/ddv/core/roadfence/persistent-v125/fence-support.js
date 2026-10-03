import { FenceMode } from '../logical.js';
import {
  ITEM,
  REPRESENTATION_ONLY_FENCE_OPS,
  RoadFencePersistentOperation,
  RoadFenceWriterSupportStatus
} from './constants.js';
import { support, topologyFingerprintIgnoringFamily } from './common.js';

function graphDegrees(graph) {
  const degree = new Map((graph.nodes ?? []).map((node) => [String(node.id), 0]));
  for (const edge of graph.edges ?? []) {
    degree.set(String(edge.a), (degree.get(String(edge.a)) ?? 0) + 1);
    degree.set(String(edge.b), (degree.get(String(edge.b)) ?? 0) + 1);
  }
  return degree;
}

function straightComponent(component) {
  return component.spans?.length === 1;
}

function sameSignDiagonal(graph) {
  const nodes = [...(graph.nodes ?? [])].sort((a, b) => a.x - b.x || a.y - b.y);
  if (nodes.length < 2) return false;
  const dx = nodes.at(-1).x - nodes[0].x;
  const dy = nodes.at(-1).y - nodes[0].y;
  return dx !== 0 && dy !== 0 && Math.sign(dx) === Math.sign(dy);
}

export function classifyFenceWriterSupport(
  network,
  planned,
  { operation, sourceNetwork = null } = {}
) {
  const compiled = planned.compiled;

  if (REPRESENTATION_ONLY_FENCE_OPS.has(operation)) {
    if (!sourceNetwork || sourceNetwork.kind !== 'fence') {
      return support(
        RoadFenceWriterSupportStatus.UNSUPPORTED,
        'FENCE_REPRESENTATION_EDIT_SOURCE_TOPOLOGY_REQUIRED'
      );
    }
    if (
      topologyFingerprintIgnoringFamily(sourceNetwork) !==
      topologyFingerprintIgnoringFamily(network)
    ) {
      return support(
        RoadFenceWriterSupportStatus.UNSUPPORTED,
        'FENCE_POST_LAYOUT_TOPOLOGY_CHANGED'
      );
    }
    if (network.familyBaseItemID !== ITEM.BIOME2_FENCE) {
      return support(
        RoadFenceWriterSupportStatus.RUNTIME_REQUIRED,
        'FENCE_REPRESENTATION_EDIT_FAMILY_NOT_RUNTIME_PROMOTED'
      );
    }
  }

  if (operation === RoadFencePersistentOperation.FENCE_STYLE_REPLACE) {
    if (!sourceNetwork || sourceNetwork.kind !== 'fence') {
      return support(
        RoadFenceWriterSupportStatus.UNSUPPORTED,
        'FENCE_STYLE_REPLACE_SOURCE_TOPOLOGY_REQUIRED'
      );
    }
    if (
      topologyFingerprintIgnoringFamily(sourceNetwork) !==
      topologyFingerprintIgnoringFamily(network)
    ) {
      return support(
        RoadFenceWriterSupportStatus.UNSUPPORTED,
        'FENCE_STYLE_REPLACE_TOPOLOGY_CHANGED'
      );
    }
    if (
      sourceNetwork.familyBaseItemID === ITEM.BIOME2_FENCE &&
      network.familyBaseItemID === ITEM.FAIRY_LIGHT_FENCE &&
      network.graph.nodes.length === 3 &&
      compiled.components.length === 1 &&
      compiled.components[0].mode === FenceMode.ORTHOGONAL &&
      straightComponent(compiled.components[0])
    ) {
      return support(
        RoadFenceWriterSupportStatus.FENCE_CONFIRMED_WRITABLE,
        'FENCE_FRP01_STYLE_REPLACEMENT_CONFIRMED',
        ['DW-FRP01']
      );
    }
    return support(
      RoadFenceWriterSupportStatus.RUNTIME_REQUIRED,
      'FENCE_STYLE_REPLACEMENT_PAIR_NOT_RUNTIME_PROMOTED'
    );
  }

  if (network.familyBaseItemID !== ITEM.BIOME2_FENCE) {
    return support(
      RoadFenceWriterSupportStatus.RUNTIME_REQUIRED,
      'FENCE_FAMILY_STRUCTURAL_WRITE_NOT_RUNTIME_PROMOTED'
    );
  }

  if (
    compiled.components.every((component) => component.mode === FenceMode.ORTHOGONAL) &&
    [...graphDegrees(network.graph).values()].every((degree) => degree <= 4)
  ) {
    return support(
      RoadFenceWriterSupportStatus.FENCE_CONFIRMED_WRITABLE,
      'FENCE_ORTHOGONAL_GRAPH_CONFIRMED',
      [
        'DW-F01',
        'DW-F02A',
        'DW-F02B',
        'DW-FE01',
        'FENCE-COMP-01',
        'FENCE-COMP-02',
        'FENCE-COMP-03',
        'FENCE-Q33-AB'
      ]
    );
  }

  if (
    compiled.components.length === 1 &&
    compiled.components[0].mode === FenceMode.DIAGONAL
  ) {
    const component = compiled.components[0];
    if (network.graph.nodes.length === 1) {
      return support(
        RoadFenceWriterSupportStatus.FENCE_CONFIRMED_WRITABLE,
        'FENCE_DIAGONAL_SINGLE_BASE_CONFIRMED',
        ['DW-FM01']
      );
    }
    if (straightComponent(component) && network.graph.nodes.length === 3) {
      return support(
        RoadFenceWriterSupportStatus.FENCE_CONFIRMED_WRITABLE,
        'FENCE_DIAGONAL_N3_BOTH_SLOPES_CONFIRMED',
        ['DW-FD01', 'DW-FD02']
      );
    }
    if (
      straightComponent(component) &&
      network.graph.nodes.length === 6 &&
      sameSignDiagonal(network.graph)
    ) {
      return support(
        RoadFenceWriterSupportStatus.FENCE_CONFIRMED_WRITABLE,
        'FENCE_DIAGONAL_POSITIVE_N6_CONFIRMED',
        ['DW-FD03']
      );
    }
    if (
      component.spans.length === 2 &&
      network.graph.nodes.length === 5 &&
      component.spans.every((span) => span.nodeIds.length === 3) &&
      [...graphDegrees(network.graph).values()].every((degree) => degree <= 2)
    ) {
      return support(
        RoadFenceWriterSupportStatus.FENCE_CONFIRMED_WRITABLE,
        'FENCE_DIAGONAL_90_CORNER_Q5_CONFIRMED',
        ['DW-FC02']
      );
    }
    return support(
      RoadFenceWriterSupportStatus.RUNTIME_REQUIRED,
      'FENCE_DIAGONAL_CLASS_NOT_RUNTIME_PROMOTED'
    );
  }

  const orthogonal = compiled.components.filter(
    (component) => component.mode === FenceMode.ORTHOGONAL
  );
  const diagonal = compiled.components.filter(
    (component) => component.mode === FenceMode.DIAGONAL
  );
  if (
    orthogonal.length === 1 &&
    diagonal.length === 1 &&
    compiled.modeBoundaries?.length === 1 &&
    orthogonal[0].logicalQuantity === 3 &&
    diagonal[0].logicalQuantity === 1 &&
    network.graph.nodes.length === 4
  ) {
    return support(
      RoadFenceWriterSupportStatus.FENCE_CONFIRMED_WRITABLE,
      'FENCE_FM01_MODE_BOUNDARY_CONFIRMED',
      ['DW-FM01']
    );
  }

  return support(
    RoadFenceWriterSupportStatus.RUNTIME_REQUIRED,
    'FENCE_TOPOLOGY_MODE_CLASS_NOT_RUNTIME_PROMOTED'
  );
}
