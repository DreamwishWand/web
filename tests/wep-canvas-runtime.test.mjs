import test from 'node:test';
import assert from 'node:assert/strict';
import { createEditorSession, normalizeEditorDocument } from '../src/lib/wep/editor-runtime.ts';
import {
  createCanvasController,
  createLayerState,
  fitViewport,
  hitTest,
  inspectSelection,
  projectObjects,
  reconcileSelectionToProjection,
  screenToWorld,
  worldRectFromScreenDrag,
  worldToScreen,
  zoomViewportAt
} from '../src/lib/wep/canvas-runtime.ts';

const seed = {
  target: {
    gameVersion: '1.25.0',
    platform: 'synthetic',
    areaKey: 'demo'
  },
  capabilities: {
    roadTopologyEdit: 'unsupported',
    fenceTopologyEdit: 'unsupported'
  },
  objects: [
    {
      editorId: 'road',
      itemId: 40100068,
      layer: 'road',
      x: 1,
      y: 1,
      orientation: 0,
      footprint: [{ x: 0, y: 0 }],
      dependencyIds: [],
      metadata: { displayName: 'Path' }
    },
    {
      editorId: 'tree',
      itemId: 50000001,
      layer: 'landscaping',
      x: 3,
      y: 2,
      orientation: 0,
      footprint: [{ x: 0, y: 0 }, { x: 0, y: 1 }],
      dependencyIds: [],
      metadata: {
        displayName: 'Dreamlight Tree',
        tags: ['green', 'tree']
      }
    },
    {
      editorId: 'table',
      itemId: 40003102,
      layer: 'furniture',
      x: 5,
      y: 4,
      orientation: 0,
      footprint: [{ x: 0, y: 0 }, { x: 1, y: 0 }],
      dependencyIds: ['cup'],
      metadata: {
        displayName: 'Bistro Table',
        internalName: 'Table_Bistro'
      }
    },
    {
      editorId: 'cup',
      itemId: 40009991,
      layer: 'furniture',
      x: 5,
      y: 5,
      orientation: 0,
      footprint: [{ x: 0, y: 0 }],
      dependencyIds: [],
      metadata: { displayName: 'Cup' }
    },
    {
      editorId: 'rock',
      itemId: 50000002,
      layer: 'static',
      x: 8,
      y: 6,
      orientation: 0,
      footprint: [{ x: 0, y: 0 }],
      dependencyIds: [],
      editability: 'readonly',
      metadata: { displayName: 'Rock' }
    }
  ]
};

test('layer defaults lock unresolved networks and static', () => {
  const state = createLayerState({
    capabilities: seed.capabilities
  });
  assert.equal(state.road.locked, true);
  assert.equal(state.fence.locked, true);
  assert.equal(state.static.locked, true);
  assert.equal(state.furniture.locked, false);
});

test('supported network capability unlocks layer', () => {
  const state = createLayerState({
    capabilities: {
      roadTopologyEdit: 'supported',
      fenceTopologyEdit: 'supported'
    }
  });
  assert.equal(state.road.locked, false);
  assert.equal(state.fence.locked, false);
});

test('fit viewport contains area', () => {
  const viewport = fitViewport(
    { x: 0, y: 0, w: 20, h: 10 },
    1000,
    600
  );
  const topLeft = worldToScreen(viewport, {
    x: 0,
    y: 0
  });
  const bottomRight = worldToScreen(viewport, {
    x: 20,
    y: 10
  });
  assert(topLeft.x >= 0 && topLeft.y >= 0);
  assert(bottomRight.x <= 1000 && bottomRight.y <= 600);
});

test('world screen roundtrip', () => {
  const viewport = fitViewport(
    { x: 0, y: 0, w: 20, h: 10 },
    1000,
    600
  );
  const point = { x: 7.25, y: 3.5 };
  const screen = worldToScreen(viewport, point);
  const world = screenToWorld(viewport, screen);
  assert(Math.abs(world.x - point.x) < 1e-9);
  assert(Math.abs(world.y - point.y) < 1e-9);
});

test('zoom keeps pointed world coordinate stable', () => {
  let viewport = fitViewport(
    { x: 0, y: 0, w: 20, h: 10 },
    1000,
    600
  );
  const point = { x: 400, y: 300 };
  const before = screenToWorld(viewport, point);
  viewport = zoomViewportAt(
    viewport,
    viewport.zoom * 1.5,
    point
  );
  const after = screenToWorld(viewport, point);
  assert(Math.abs(before.x - after.x) < 1e-9);
  assert(Math.abs(before.y - after.y) < 1e-9);
});

test('search matches metadata and item id', () => {
  const document = normalizeEditorDocument(seed);
  assert.equal(
    projectObjects(document, {
      query: 'bistro'
    }).some((object) => object.editorId === 'table'),
    true
  );
  assert.equal(
    projectObjects(document, {
      query: '40003102'
    }).length,
    1
  );
  assert.equal(
    projectObjects(document, {
      query: 'green tree'
    })
      .map((object) => object.editorId)
      .join(','),
    'tree'
  );
});

test('hidden layer disappears from projection', () => {
  const document = normalizeEditorDocument(seed);
  const layers = createLayerState({
    capabilities: seed.capabilities
  });
  layers.furniture.visible = false;
  assert.equal(
    projectObjects(document, {
      layerState: layers
    }).some((object) => object.layer === 'furniture'),
    false
  );
});

test('selection reconciliation removes objects hidden by current projection', () => {
  const document = normalizeEditorDocument(seed);
  const layers = createLayerState({
    capabilities: seed.capabilities
  });
  layers.furniture.visible = false;
  const projected = projectObjects(document, {
    layerState: layers,
    query: 'tree'
  });

  assert.deepEqual(
    reconcileSelectionToProjection(
      ['table', 'tree', 'rock', 'tree'],
      projected
    ),
    ['tree']
  );
});

test('hit test skips locked road by default', () => {
  const document = normalizeEditorDocument(seed);
  const layers = createLayerState({
    capabilities: seed.capabilities
  });
  assert.equal(
    hitTest(document, { x: 1, y: 1 }, {
      layerState: layers
    }),
    null
  );
  assert.equal(
    hitTest(document, { x: 1, y: 1 }, {
      layerState: layers,
      includeLocked: true
    }).editorId,
    'road'
  );
});

test('world rect from screen drag normalizes direction', () => {
  const viewport = {
    zoom: 10,
    offsetX: 0,
    offsetY: 0,
    widthPx: 100,
    heightPx: 100,
    areaBounds: {
      x: 0,
      y: 0,
      w: 10,
      h: 10
    }
  };
  assert.deepEqual(
    worldRectFromScreenDrag(
      viewport,
      { x: 58, y: 49 },
      { x: 21, y: 15 }
    ),
    { x: 2, y: 1, w: 4, h: 4 }
  );
});

test('controller marquee respects locked and query', () => {
  const session = createEditorSession(seed);
  const controller = createCanvasController(session, {
    areaBounds: { x: 0, y: 0, w: 12, h: 10 },
    widthPx: 120,
    heightPx: 100
  });
  controller.setQuery('table');
  const viewport = controller.getViewport();
  const from = worldToScreen(viewport, { x: 0, y: 0 });
  const to = worldToScreen(viewport, { x: 11, y: 9 });
  const result = controller.marqueeScreen(from, to);
  assert.deepEqual(result.selection, ['table']);
});

test('controller click selects top selectable object', () => {
  const session = createEditorSession(seed);
  const controller = createCanvasController(session, {
    areaBounds: { x: 0, y: 0, w: 12, h: 10 },
    widthPx: 120,
    heightPx: 100
  });
  const point = worldToScreen(
    controller.getViewport(),
    { x: 5.2, y: 4.2 }
  );
  assert.deepEqual(
    controller.selectAtScreen(point),
    ['table']
  );
});

test('layer lock prevents click selection', () => {
  const session = createEditorSession(seed);
  const controller = createCanvasController(session, {
    areaBounds: { x: 0, y: 0, w: 12, h: 10 },
    widthPx: 120,
    heightPx: 100
  });
  controller.setLayer('furniture', {
    locked: true
  });
  const point = worldToScreen(
    controller.getViewport(),
    { x: 5.2, y: 4.2 }
  );
  assert.deepEqual(
    controller.selectAtScreen(point),
    []
  );
});

test('selected bounds derives occupied geometry', () => {
  const session = createEditorSession(seed);
  const controller = createCanvasController(session, {
    areaBounds: { x: 0, y: 0, w: 12, h: 10 },
    widthPx: 120,
    heightPx: 100
  });
  session.setSelection(['table', 'cup']);
  assert.deepEqual(
    controller.selectedBounds(),
    { x: 5, y: 4, w: 2, h: 2 }
  );
});


test('selection inspection exposes single and multi-object product details without source identity', () => {
  const document = normalizeEditorDocument(seed);
  const single = inspectSelection(document, ['table']);
  assert.equal(single.count, 1);
  assert.deepEqual(single.bounds, {
    x: 5,
    y: 4,
    w: 2,
    h: 1
  });
  assert.deepEqual(single.objects[0], {
    editorId: 'table',
    itemId: 40003102,
    displayName: 'Bistro Table',
    layer: 'furniture',
    x: 5,
    y: 4,
    orientation: 0,
    editability: 'editable',
    dependencyCount: 1,
    dependencyIds: ['cup'],
    footprintCellCount: 2
  });
  assert.equal('source' in single.objects[0], false);

  const multi = inspectSelection(
    document,
    ['table', 'cup', 'tree']
  );
  assert.equal(multi.count, 3);
  assert.deepEqual(multi.bounds, {
    x: 3,
    y: 2,
    w: 4,
    h: 4
  });
  assert.equal(multi.layerCounts.furniture, 2);
  assert.equal(multi.layerCounts.landscaping, 1);
});
