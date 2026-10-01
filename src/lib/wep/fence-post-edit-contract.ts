import {
  FENCE_REPRESENTATION_INTENT,
  FENCE_REPRESENTATION_LAYOUT_ERROR,
  FENCE_REPRESENTATION_LAYOUT_SCHEMA,
  FENCE_REPRESENTATION_POLICY,
  applyFenceRepresentationLayoutOperation,
  captureFenceRepresentationLayoutModel,
  fenceRepresentationCatalogConstraints,
  validateFenceRepresentationLayoutModel
} from '../ddv/core/roadfence/representation-layout-v125.ts';

type AnyRecord = Record<string, any>;

export const FENCE_POST_LAYOUT_SCHEMA =
  'dreamwish-wand-wep-fence-representation-session';
export const FENCE_POST_LAYOUT_VERSION = 2;

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

function validateSessionShape(draft: AnyRecord) {
  if (
    !draft ||
    draft.schema !== FENCE_REPRESENTATION_LAYOUT_SCHEMA ||
    draft.persistentWriteAuthorized !== false ||
    !draft.logicalTopology ||
    !draft.representationLayout
  ) {
    throw new Error('WEP_FENCE_REPRESENTATION_SESSION_INVALID');
  }
}

export function fenceFamilyPostConstraints(
  familyBaseItemID: number,
  mode: string
) {
  const result = fenceRepresentationCatalogConstraints(
    familyBaseItemID,
    mode
  );
  return Object.freeze({
    ...clone(result),
    maxExtensionKey: result.exactExtensionKeys?.length
      ? Math.max(...result.exactExtensionKeys)
      : null,
    maxInterval: result.maximumPostInterval,
    source: '01C_CORE_PROMOTED_REPRESENTATION_LAYOUT',
    persistentWriteAuthorized: false
  });
}

export function validateFencePostLayoutDraft(draft: AnyRecord) {
  validateSessionShape(draft);
  return clone(validateFenceRepresentationLayoutModel(draft));
}

export function createFencePostLayoutDraft(
  readerResult: AnyRecord,
  networkId: string
) {
  const result = captureFenceRepresentationLayoutModel(
    readerResult,
    String(networkId)
  );
  return {
    draft: clone(result.model),
    validation: clone(result.validation),
    binding: {
      wepSessionSchema: FENCE_POST_LAYOUT_SCHEMA,
      wepSessionVersion: FENCE_POST_LAYOUT_VERSION,
      coreContract: FENCE_REPRESENTATION_LAYOUT_SCHEMA,
      persistentWriteAuthorized: false
    }
  };
}

function operationResult(result: AnyRecord) {
  return {
    accepted: result.accepted === true,
    draft: clone(result.model),
    validation: clone(result.validation),
    issues: clone(result.issues ?? []),
    candidate: result.candidate
      ? clone(result.candidate)
      : null,
    persistentWriteAuthorized: false
  };
}

export function insertFencePost(
  draft: AnyRecord,
  x: number,
  y: number,
  { pinned = true } = {}
) {
  validateSessionShape(draft);
  return operationResult(
    applyFenceRepresentationLayoutOperation(draft, {
      type: FENCE_POST_EDIT_OPERATION.INSERT,
      x,
      y,
      pinned
    })
  );
}

export function removeFencePost(
  draft: AnyRecord,
  nodeId: string
) {
  validateSessionShape(draft);
  return operationResult(
    applyFenceRepresentationLayoutOperation(draft, {
      type: FENCE_POST_EDIT_OPERATION.REMOVE,
      nodeId
    })
  );
}

export function moveFencePost(
  draft: AnyRecord,
  nodeId: string,
  x: number,
  y: number
) {
  validateSessionShape(draft);
  return operationResult(
    applyFenceRepresentationLayoutOperation(draft, {
      type: FENCE_POST_EDIT_OPERATION.MOVE,
      nodeId,
      x,
      y
    })
  );
}

export function setFencePostPinned(
  draft: AnyRecord,
  nodeId: string,
  pinned: boolean
) {
  validateSessionShape(draft);
  let found = false;
  const next = clone(draft);
  next.representationLayout.posts =
    next.representationLayout.posts.map((entry: AnyRecord) => {
      if (String(entry.nodeId) !== String(nodeId)) return entry;
      found = true;
      return { ...entry, pinned: pinned === true };
    });
  if (!found) throw new Error('FENCE_POST_NOT_FOUND');
  const validation =
    validateFenceRepresentationLayoutModel(next);
  return {
    accepted: validation.ok,
    draft: validation.ok ? next : clone(draft),
    validation: clone(validation),
    issues: clone(validation.issues ?? []),
    persistentWriteAuthorized: false
  };
}

function chooseBalancedPartition(
  total: number,
  allowedIntervals: number[]
) {
  const allowed = Array.from(
    new Set(
      allowedIntervals.filter(
        (value) => Number.isSafeInteger(value) && value > 0
      )
    )
  ).sort((a, b) => b - a);
  const dp: Array<number[] | null> =
    Array(total + 1).fill(null);
  dp[0] = [];

  const score = (parts: number[]) => {
    if (!parts.length) return [0, 0, 0];
    const max = Math.max(...parts);
    const min = Math.min(...parts);
    const mean =
      parts.reduce((sum, value) => sum + value, 0) /
      parts.length;
    const spread = max - min;
    const variance = parts.reduce(
      (sum, value) => sum + Math.abs(value - mean),
      0
    );
    return [parts.length, spread, variance];
  };

  const better = (a: number[], b: number[] | null) => {
    if (!b) return true;
    const sa = score(a);
    const sb = score(b);
    for (let i = 0; i < sa.length; i += 1) {
      if (sa[i] !== sb[i]) return sa[i] < sb[i];
    }
    return false;
  };

  for (let cursor = 1; cursor <= total; cursor += 1) {
    for (const interval of allowed) {
      const previous = cursor - interval;
      if (previous < 0 || !dp[previous]) continue;
      const candidate = [...dp[previous]!, interval];
      if (better(candidate, dp[cursor])) {
        dp[cursor] = candidate;
      }
    }
  }

  if (!dp[total]) return null;
  const sorted = [...dp[total]!].sort((a, b) => b - a);
  const output = Array(sorted.length).fill(0);
  const centerOrder = [...output.keys()].sort((a, b) => {
    const ca = Math.abs(a - (output.length - 1) / 2);
    const cb = Math.abs(b - (output.length - 1) / 2);
    return ca - cb || a - b;
  });
  sorted.forEach((value, index) => {
    output[centerOrder[index]] = value;
  });
  return output;
}

function nodeById(draft: AnyRecord) {
  return new Map(
    (draft.logicalTopology.graph.nodes ?? []).map(
      (node: AnyRecord) => [String(node.id), node]
    )
  );
}

export function applyFencePostAutoLayout(
  draft: AnyRecord,
  policy: string
) {
  validateSessionShape(draft);

  if (policy === FENCE_POST_AUTO_LAYOUT.PRESERVE_EXISTING) {
    return {
      accepted: true,
      draft: clone(draft),
      validation: validateFenceRepresentationLayoutModel(draft),
      issues: [],
      persistentWriteAuthorized: false
    };
  }
  if (policy !== FENCE_POST_AUTO_LAYOUT.CENTERED_BALANCED) {
    throw new Error('FENCE_POST_AUTO_LAYOUT_POLICY_UNSUPPORTED');
  }

  const sourceValidation =
    validateFenceRepresentationLayoutModel(draft);
  const structuralBlocks = (sourceValidation.issues ?? []).filter(
    (entry: AnyRecord) =>
      ![
        FENCE_REPRESENTATION_LAYOUT_ERROR.INTERVAL_OVER_MAX,
        FENCE_REPRESENTATION_LAYOUT_ERROR.INTERVAL_UNSUPPORTED
      ].includes(String(entry.code) as any)
  );
  if (structuralBlocks.length) {
    return {
      accepted: false,
      draft: clone(draft),
      validation: clone(sourceValidation),
      issues: clone(structuralBlocks),
      persistentWriteAuthorized: false
    };
  }

  const constraints =
    sourceValidation.constraints ??
    fenceRepresentationCatalogConstraints(
      draft.logicalTopology.familyBaseItemID,
      draft.logicalTopology.mode
    );
  if (!constraints?.ok) {
    return {
      accepted: false,
      draft: clone(draft),
      validation: clone(sourceValidation),
      issues: clone(constraints?.issues ?? []),
      persistentWriteAuthorized: false
    };
  }

  const nodes = nodeById(draft);
  const pinned = (draft.representationLayout.posts ?? [])
    .filter((entry: AnyRecord) => entry.pinned === true)
    .map((entry: AnyRecord) => clone(entry));
  const generated: AnyRecord[] = [];

  for (const run of sourceValidation.runs ?? []) {
    const ids = run.nodeIds.map(String);
    const fixed = [
      { index: 0, post: null },
      ...pinned
        .filter(
          (post: AnyRecord) =>
            String(post.runId) === String(run.runId)
        )
        .map((post: AnyRecord) => ({
          index: ids.indexOf(String(post.nodeId)),
          post
        }))
        .filter((entry: AnyRecord) => entry.index > 0),
      { index: ids.length - 1, post: null }
    ].sort((a: AnyRecord, b: AnyRecord) => a.index - b.index);

    for (let section = 1; section < fixed.length; section += 1) {
      const start = fixed[section - 1].index;
      const end = fixed[section].index;
      const distance = end - start;
      const partition = chooseBalancedPartition(
        distance,
        constraints.supportedIntervals
      );
      if (!partition) {
        return {
          accepted: false,
          draft: clone(draft),
          validation: clone(sourceValidation),
          issues: [
            {
              severity: 'BLOCK',
              code:
                FENCE_REPRESENTATION_LAYOUT_ERROR.INTERVAL_UNSUPPORTED,
              runId: String(run.runId),
              distance,
              exactExtensionKeys: clone(
                constraints.exactExtensionKeys
              )
            }
          ],
          persistentWriteAuthorized: false
        };
      }

      let cursor = start;
      for (
        let part = 0;
        part < partition.length - 1;
        part += 1
      ) {
        cursor += partition[part];
        const nodeId = ids[cursor];
        const node = nodes.get(nodeId);
        if (!node) {
          throw new Error('WEP_FENCE_AUTO_LAYOUT_NODE_UNRESOLVED');
        }
        generated.push({
          kind: 'DEGREE2_INTERIOR_POST',
          nodeId,
          runId: String(run.runId),
          x: Number((node as AnyRecord).x),
          y: Number((node as AnyRecord).y),
          pinned: false,
          source: 'AUTO_CENTERED_BALANCED'
        });
      }
    }
  }

  const candidate = clone(draft);
  candidate.representationLayout = {
    intent: FENCE_REPRESENTATION_INTENT.GENERATED_DESIGN,
    policy: FENCE_REPRESENTATION_POLICY.CENTERED_BALANCED,
    posts: [...pinned, ...generated]
  };
  candidate.persistentWriteAuthorized = false;

  const validation =
    validateFenceRepresentationLayoutModel(candidate);
  return {
    accepted: validation.ok,
    draft: validation.ok ? candidate : clone(draft),
    candidate: validation.ok ? null : clone(candidate),
    validation: clone(validation),
    issues: clone(validation.issues ?? []),
    persistentWriteAuthorized: false
  };
}
