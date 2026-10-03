import {
  FenceMode,
  compileFenceLogicalGraph,
  createFenceNetwork,
  resolveFenceExtensionNativePlacement
} from '../logical.js';
import { FenceRepresentationPolicy, persistentModeState } from './constants.js';
import {
  clone,
  descriptorOrder,
  fail,
  logicalToSave,
  positiveInteger
} from './common.js';

export function normalizeFenceNetwork(input) {
  const created = createFenceNetwork(input ?? {});
  if (!created.ok) fail('FENCE_LOGICAL_GRAPH_UNSUPPORTED', 'Fence network invalid', { errors: created.errors });
  return created.network;
}

function spanKey(a, b) {
  a = String(a);
  b = String(b);
  return a < b ? a + '::' + b : b + '::' + a;
}

export function familySpanRules(family, mode) {
  const variations = mode === FenceMode.DIAGONAL ? family.diagExt : family.ext;
  const keys = [...variations.keys()].sort((a, b) => a - b);
  if (!keys.length) {
    fail('FENCE_EXTENSION_KEY_UNSUPPORTED', 'family has no exact extension vocabulary for mode');
  }
  const maxPostInterval = 1 + Math.max(...keys);
  return {
    exactExtensionKeys: keys,
    maxPostInterval,
    variationForInterval(interval) {
      if (interval === 1) return null;
      const key = interval - 1;
      const variation = variations.get(key);
      if (!variation) {
        fail('FENCE_POST_INTERVAL_UNSUPPORTED', 'required exact extension key is absent', {
          interval,
          key,
          mode
        });
      }
      return variation;
    }
  };
}

function generatedGreedyLayout(network, compiled, family) {
  const runs = [];
  for (const component of compiled.components) {
    const rules = familySpanRules(family, component.mode);
    for (const span of component.spans) {
      let pathIndex = 0;
      let remainingIntervals = span.nodeIds.length - 1;
      const postNodeIds = [];
      while (remainingIntervals > rules.maxPostInterval) {
        pathIndex += rules.maxPostInterval;
        postNodeIds.push(String(span.nodeIds[pathIndex]));
        remainingIntervals -= rules.maxPostInterval;
      }
      runs.push({
        mode: component.mode,
        fromNodeId: String(span.nodeIds[0]),
        toNodeId: String(span.nodeIds.at(-1)),
        postNodeIds
      });
    }
  }
  return {
    contract: 'ddv.fence-representation-layout@1',
    policy: FenceRepresentationPolicy.GENERATED_NATIVE_GREEDY,
    runs
  };
}

export function planFenceNativeV125({
  network,
  representationLayout,
  family,
  transform,
  tessellationFactor
}) {
  const compiled = compileFenceLogicalGraph(network.graph);
  if (!compiled.ok) {
    fail('FENCE_LOGICAL_GRAPH_UNSUPPORTED', 'Fence graph compile failed', {
      errors: compiled.errors
    });
  }

  const layout =
    !representationLayout ||
    representationLayout.policy === FenceRepresentationPolicy.GENERATED_NATIVE_GREEDY
      ? generatedGreedyLayout(network, compiled, family)
      : clone(representationLayout);

  if (
    layout.contract !== 'ddv.fence-representation-layout@1' ||
    !Array.isArray(layout.runs)
  ) {
    fail('FENCE_REPRESENTATION_LAYOUT_CONTRACT_MISMATCH');
  }

  const supportedPolicies = new Set(Object.values(FenceRepresentationPolicy));
  if (!supportedPolicies.has(layout.policy)) {
    fail('FENCE_REPRESENTATION_LAYOUT_POLICY_UNSUPPORTED');
  }

  const nodeById = new Map(
    network.graph.nodes.map((node) => [String(node.id), node])
  );
  const runBySpan = new Map();
  for (const run of layout.runs) {
    const key = spanKey(run.fromNodeId, run.toNodeId);
    if (runBySpan.has(key)) fail('FENCE_REPRESENTATION_LAYOUT_DUPLICATE_RUN', key);
    runBySpan.set(key, run);
  }

  const bases = new Map();
  const extensions = [];
  const usedRuns = new Set();

  function addBase(nodeId, mode, semanticAnchor, representationPost) {
    const id = String(nodeId);
    const node = nodeById.get(id);
    if (!node) fail('FENCE_REPRESENTATION_NODE_MISSING', id);
    const save = logicalToSave(node, transform);
    const previous = bases.get(id);
    bases.set(id, {
      role: 'base',
      logicalNodeId: id,
      itemID: network.familyBaseItemID,
      mode,
      x: save.x,
      y: save.y,
      orientation: 'GridOrientation_Down',
      state: persistentModeState(mode),
      semanticAnchor: Boolean(semanticAnchor || previous?.semanticAnchor),
      representationPost: Boolean(representationPost || previous?.representationPost)
    });
  }

  for (const component of compiled.components) {
    const rules = familySpanRules(family, component.mode);
    const semanticAnchors = new Set(
      component.bases
        .filter((base) => base.semanticVertex)
        .map((base) => String(base.nodeId))
    );

    for (const semanticNodeId of semanticAnchors) {
      addBase(
        semanticNodeId,
        component.mode,
        true,
        false
      );
    }

    for (const span of component.spans) {
      const path = span.nodeIds.map(String);
      const from = path[0];
      const to = path.at(-1);
      const key = spanKey(from, to);
      const run = runBySpan.get(key);
      if (!run) fail('FENCE_REPRESENTATION_LAYOUT_SPAN_MISSING', key);
      usedRuns.add(key);

      if (run.mode != null && run.mode !== component.mode) {
        fail('FENCE_MODE_MISMATCH', key);
      }

      const indexById = new Map(path.map((id, index) => [id, index]));
      const posts = (run.postNodeIds ?? []).map(String);
      const seenPosts = new Set();

      for (const postId of posts) {
        const index = indexById.get(postId);
        if (index == null) fail('FENCE_POST_OFF_RUN', postId);
        if (
          index === 0 ||
          index === path.length - 1 ||
          semanticAnchors.has(postId)
        ) {
          fail('FENCE_POST_SEMANTIC_ANCHOR_IMMUTABLE', postId);
        }
        if (seenPosts.has(postId)) {
          fail('FENCE_REPRESENTATION_LAYOUT_DUPLICATE_POST', postId);
        }
        seenPosts.add(postId);
      }

      posts.sort((a, b) => indexById.get(a) - indexById.get(b));
      const anchors = [from, ...posts, to];
      addBase(from, component.mode, true, false);
      addBase(to, component.mode, true, false);
      for (const postId of posts) addBase(postId, component.mode, false, true);

      for (let index = 1; index < anchors.length; index += 1) {
        const a = anchors[index - 1];
        const b = anchors[index];
        const interval = indexById.get(b) - indexById.get(a);
        if (interval < 1) fail('FENCE_POST_INTERVAL_UNSUPPORTED');
        if (interval > rules.maxPostInterval) {
          fail('FENCE_POST_INTERVAL_OVER_MAX', 'Fence post interval exceeds family/mode maximum', {
            familyBaseItemID: family.familyBaseItemID,
            mode: component.mode,
            interval,
            maximumPostInterval: rules.maxPostInterval
          });
        }

        const variation = rules.variationForInterval(interval);
        if (!variation) continue;

        const fromSave = logicalToSave(nodeById.get(a), transform);
        const toSave = logicalToSave(nodeById.get(b), transform);
        const placement = resolveFenceExtensionNativePlacement({
          fromSave,
          toSave,
          key: interval - 1,
          variation,
          tessellationFactor,
          baseSpanX: family.base.gridSizeX * tessellationFactor,
          baseSpanY: family.base.gridSizeY * tessellationFactor
        });

        extensions.push({
          role: component.mode === FenceMode.DIAGONAL ? 'diagExt' : 'ext',
          key: interval - 1,
          fromNodeId: a,
          toNodeId: b,
          itemID: variation.itemID,
          mode: component.mode,
          x: placement.x,
          y: placement.y,
          orientation: placement.orientation,
          state: persistentModeState(component.mode)
        });
      }
    }
  }

  if (usedRuns.size !== runBySpan.size) {
    fail('FENCE_REPRESENTATION_LAYOUT_UNKNOWN_RUN');
  }

  const objects = [...bases.values(), ...extensions].sort(descriptorOrder);
  return {
    kind: 'fence',
    familyBaseItemID: network.familyBaseItemID,
    logicalQuantity: network.graph.nodes.length,
    nativeObjectCount: objects.length,
    objects,
    representationLayout: layout,
    compiled
  };
}

export function requireFenceTessellationFactor(sourceGrid) {
  return positiveInteger(sourceGrid.TessellationFactor, 'TessellationFactor');
}
