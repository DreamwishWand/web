import test from 'node:test';
import assert from 'node:assert/strict';
import {
  GRIDDATA_DIMENSIONS_V125_SHA256
} from '../src/lib/wep/griddata-v17-contract.ts';
import {
  assessCurrentV125BrowserPlacementReadiness
} from '../src/lib/wep/placement-readiness.ts';

function boundDocument() {
  return {
    target: {
      gridDataPath: 'GridData/Villages/Test-GridData.json',
      tessellationFactor: 1,
      exactBuildKnown: false,
      persistentWriteAuthorized: false
    },
    metadata: {
      rootGridBounds: {
        x: 0,
        y: 0,
        w: 40,
        h: 30,
        status: 'AUTHORITATIVE_GRIDDATAPATH'
      },
      browserBinding: {
        gridDataDimensionsBound: true,
        gridDataDimensionsSha256: GRIDDATA_DIMENSIONS_V125_SHA256
      }
    }
  };
}

test('current browser placement readiness separates route, bounds, legality and apply', () => {
  const readiness =
    assessCurrentV125BrowserPlacementReadiness(boundDocument());

  assert.equal(readiness.overall, 'BOUNDS_ONLY');
  assert.equal(readiness.route.status, 'RESOLVED');
  assert.equal(readiness.bounds.status, 'AUTHORITATIVE');
  assert.deepEqual(readiness.bounds.bounds, {
    x: 0,
    y: 0,
    w: 40,
    h: 30
  });
  assert.equal(readiness.placement.validated, false);
  assert.equal(
    readiness.placement.blocker,
    'NATIVE_TERRAIN_OCCUPANCY_VALIDATION_REQUIRED'
  );
  assert.equal(readiness.apply.ready, false);
  assert.equal(
    readiness.apply.blocker,
    'CORE_ATOMIC_PERSISTENT_COMMIT_NOT_AUTHORIZED'
  );
});

test('spoofed authoritative status without pinned v1.7 browser evidence is rejected', () => {
  const document = boundDocument();
  delete document.metadata.browserBinding.gridDataDimensionsSha256;

  const readiness =
    assessCurrentV125BrowserPlacementReadiness(document);

  assert.equal(readiness.overall, 'ROUTE_ONLY');
  assert.equal(readiness.bounds.status, 'BLOCKED');
  assert.equal(
    readiness.bounds.blocker,
    'ROOT_GRID_BOUNDS_UNRESOLVED'
  );
  assert.equal(
    readiness.placement.blocker,
    'AUTHORITATIVE_BOUNDS_REQUIRED'
  );
});

test('unknown route remains fully blocked and no apply readiness is inferred', () => {
  const readiness =
    assessCurrentV125BrowserPlacementReadiness({
      target: {
        exactBuildKnown: true,
        persistentWriteAuthorized: true
      },
      metadata: {}
    });

  assert.equal(readiness.overall, 'BLOCKED');
  assert.equal(readiness.route.status, 'BLOCKED');
  assert.equal(readiness.bounds.status, 'BLOCKED');
  assert.equal(readiness.placement.validated, false);
  assert.equal(readiness.apply.ready, false);
});
