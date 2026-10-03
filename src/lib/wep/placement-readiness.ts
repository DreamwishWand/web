import {
  authoritativeRootBoundsFromEditorDocument
} from './griddata-v17-contract.ts';

type AnyRecord = Record<string, any>;

export type CurrentV125PlacementReadiness = {
  contract: 'dreamwish-wand-wep-v125-placement-readiness@1';
  overall: 'BLOCKED' | 'ROUTE_ONLY' | 'BOUNDS_ONLY';
  route: {
    status: 'RESOLVED' | 'BLOCKED';
    gridDataPath: string | null;
    blocker: string | null;
  };
  bounds: {
    status: 'AUTHORITATIVE' | 'BLOCKED';
    bounds: { x: number; y: number; w: number; h: number } | null;
    evidenceStatus: string | null;
    blocker: string | null;
  };
  placement: {
    status: 'BLOCKED';
    validated: false;
    blocker:
      | 'AUTHORITATIVE_BOUNDS_REQUIRED'
      | 'NATIVE_TERRAIN_OCCUPANCY_VALIDATION_REQUIRED';
  };
  apply: {
    status: 'DISABLED';
    ready: false;
    blocker: 'CORE_ATOMIC_PERSISTENT_COMMIT_NOT_AUTHORIZED';
  };
};

export function assessCurrentV125BrowserPlacementReadiness(
  document: AnyRecord
): CurrentV125PlacementReadiness {
  const gridDataPath =
    typeof document?.target?.gridDataPath === 'string' &&
    document.target.gridDataPath.length > 0
      ? document.target.gridDataPath
      : null;

  const authority = authoritativeRootBoundsFromEditorDocument(document);
  const routeResolved = gridDataPath !== null;
  const boundsAuthoritative = authority !== null;

  return Object.freeze({
    contract: 'dreamwish-wand-wep-v125-placement-readiness@1',
    overall: boundsAuthoritative
      ? 'BOUNDS_ONLY'
      : routeResolved
        ? 'ROUTE_ONLY'
        : 'BLOCKED',
    route: Object.freeze({
      status: routeResolved ? 'RESOLVED' : 'BLOCKED',
      gridDataPath,
      blocker: routeResolved ? null : 'DIRECT_GRID_ROUTE_UNRESOLVED'
    }),
    bounds: Object.freeze({
      status: boundsAuthoritative ? 'AUTHORITATIVE' : 'BLOCKED',
      bounds: boundsAuthoritative
        ? Object.freeze({
            x: authority.bounds.x,
            y: authority.bounds.y,
            w: authority.bounds.w,
            h: authority.bounds.h
          })
        : null,
      evidenceStatus: boundsAuthoritative
        ? authority.evidenceStatus
        : null,
      blocker: boundsAuthoritative
        ? null
        : 'ROOT_GRID_BOUNDS_UNRESOLVED'
    }),
    placement: Object.freeze({
      status: 'BLOCKED',
      validated: false,
      blocker: boundsAuthoritative
        ? 'NATIVE_TERRAIN_OCCUPANCY_VALIDATION_REQUIRED'
        : 'AUTHORITATIVE_BOUNDS_REQUIRED'
    }),
    apply: Object.freeze({
      status: 'DISABLED',
      ready: false,
      blocker: 'CORE_ATOMIC_PERSISTENT_COMMIT_NOT_AUTHORIZED'
    })
  });
}
