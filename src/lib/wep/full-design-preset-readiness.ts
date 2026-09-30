import { currentV125FloatingIslandIdentityAdapter } from './world-portable-contracts.ts';
export type FullDesignPresetType = 'biome' | 'floating_island';
export type CoverageStatus = 'complete' | 'not_applicable' | 'partial' | 'unknown' | 'blocked';

export interface CoverageRecord {
  status: CoverageStatus;
  evidenceStatus?: string;
  contract?: string;
  detail?: Record<string, unknown> | null;
}

export interface FullDesignReadinessInput {
  type: FullDesignPresetType;
  semanticIdentity?: unknown;
  coverage?: Partial<Record<'directGrids' | 'rootObjects' | 'roads' | 'fences' | 'buildings' | 'environment', CoverageRecord>>;
  includedUnrelatedState?: string[];
}

export type FloatingIslandIdentityAdapter = (
  type: 'floating_island',
  value: unknown
) => { status: 'supported'; identity: Record<string, unknown> } | { status: string };

const REQUIRED = ['rootObjects','roads','fences','buildings','environment'] as const;
const READY = new Set(['complete','not_applicable']);

function block(code: string, path = '$', detail: Record<string, unknown> = {}) {
  return { severity: 'BLOCK' as const, code, path, ...detail };
}

function record(
  value: CoverageRecord | undefined,
  name: string
): CoverageRecord & { name: string } {
  return {
    name,
    status: value?.status ?? 'unknown',
    evidenceStatus: value?.evidenceStatus ?? 'UNKNOWN',
    contract: value?.contract ?? '',
    detail: value?.detail ?? null
  };
}

export function assessFullDesignPresetReadiness(
  input: FullDesignReadinessInput,
  options: { identityAdapter?: FloatingIslandIdentityAdapter | null } = {}
) {
  const issues: ReturnType<typeof block>[] = [];
  let semanticIdentity: Record<string, unknown> | null = null;

  if (input.type === 'biome') {
    const identity =
      input.semanticIdentity && typeof input.semanticIdentity === 'object'
        ? (input.semanticIdentity as Record<string, unknown>)
        : null;
    if (!identity) {
      issues.push(block('BIOME_SEMANTIC_IDENTITY_REQUIRED', '$.semanticIdentity'));
    } else {
      const sceneItemId = Number(identity.villageSceneItemId);
      const areaType = identity.villageAreaType;
      if (!Number.isSafeInteger(sceneItemId) || sceneItemId <= 0) {
        issues.push(block('BIOME_SCENE_ITEM_ID_INVALID', '$.semanticIdentity.villageSceneItemId'));
      }
      if (areaType == null || String(areaType) === '') {
        issues.push(block('BIOME_AREA_TYPE_INVALID', '$.semanticIdentity.villageAreaType'));
      }
      semanticIdentity = {
        villageSceneItemId: sceneItemId,
        villageAreaType: areaType
      };
    }
  } else if (input.type === 'floating_island') {
    const result = options.identityAdapter?.('floating_island', input.semanticIdentity);
    if (!result) {
      issues.push(block('FLOATING_ISLAND_IDENTITY_CONTRACT_UNAVAILABLE', '$.semanticIdentity'));
    } else if (result.status !== 'supported' || !('identity' in result)) {
      issues.push(block('FLOATING_ISLAND_IDENTITY_NOT_PROVEN', '$.semanticIdentity'));
    } else {
      semanticIdentity = structuredClone(result.identity);
    }
  }

  const coverage = input.coverage ?? {};
  const categories: Record<string, ReturnType<typeof record>> = {};

  for (const name of REQUIRED) {
    const current = record(coverage[name], name);
    categories[name] = current;
    if (!READY.has(current.status)) {
      issues.push(block('FULL_DESIGN_CATEGORY_INCOMPLETE', `$.coverage.${name}`, {
        category: name,
        status: current.status,
        evidenceStatus: current.evidenceStatus
      }));
    }
    if (current.status === 'complete' && !current.contract) {
      issues.push(block('FULL_DESIGN_CATEGORY_CONTRACT_REQUIRED', `$.coverage.${name}.contract`, {
        category: name
      }));
    }
  }

  const directGrids = record(coverage.directGrids, 'directGrids');
  categories.directGrids = directGrids;
  if (directGrids.status !== 'complete') {
    issues.push(block('FULL_DESIGN_DIRECT_GRID_COVERAGE_INCOMPLETE', '$.coverage.directGrids', {
      status: directGrids.status,
      evidenceStatus: directGrids.evidenceStatus
    }));
  }
  if (directGrids.status === 'complete' && !directGrids.contract) {
    issues.push(block('FULL_DESIGN_CATEGORY_CONTRACT_REQUIRED', '$.coverage.directGrids.contract', {
      category: 'directGrids'
    }));
  }

  const unrelated = (input.includedUnrelatedState ?? []).filter(Boolean);
  if (unrelated.length) {
    issues.push(block('UNRELATED_GAMEPLAY_STATE_FORBIDDEN', '$.includedUnrelatedState', {
      fields: unrelated
    }));
  }

  return {
    ok: issues.length === 0,
    type: input.type,
    semanticIdentity,
    categories,
    issues,
    publicationReady: issues.length === 0,
    applyReady: false,
    applyReason: 'CORE_ATOMIC_PERSISTENT_COMMIT_NOT_AUTHORIZED'
  };
}

export function currentV125FullDesignBaseline(
  type: FullDesignPresetType,
  semanticIdentity?: unknown
) {
  return assessFullDesignPresetReadiness(
    {
      type,
      semanticIdentity,
      coverage: {
        directGrids: {
          status: 'partial',
          evidenceStatus: 'CONFIRMED_SEMANTIC_ROUTE_READ_ONLY',
          contract: '01B-v1.6-outdoor-location-direct-root-route'
        },
        rootObjects: {
          status: 'partial',
          evidenceStatus: 'CONFIRMED_READ_ONLY',
          contract: '01B-v1.6-world-loader'
        },
        roads: {
          status: 'partial',
          evidenceStatus: 'CONFIRMED_STATIC_RUNTIME_PARTIAL',
          contract: '01C-logical-road-network'
        },
        fences: {
          status: 'partial',
          evidenceStatus: 'CONFIRMED_STATIC_RUNTIME_PARTIAL',
          contract: '01C-logical-fence-network'
        },
        buildings: {
          status: 'partial',
          evidenceStatus: 'CONFIRMED_PORTABLE_CAPTURE_PREFLIGHT',
          contract: '01B-v1.5-building-playerhouse-restoration'
        },
        environment: {
          status: 'partial',
          evidenceStatus: 'CONFIRMED_PORTABLE_CAPTURE_PREFLIGHT',
          contract: '01B-v1.5-environment-restoration'
        }
      }
    },
    {
      identityAdapter: currentV125FloatingIslandIdentityAdapter
    }
  );
}
