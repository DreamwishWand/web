import test from 'node:test';
import assert from 'node:assert/strict';
import {
  boundsFor,
  createEditorSession,
  dependencyClosure,
  normalizeEditorDocument
} from '../src/lib/wep/editor-runtime.ts';

const base = {
  target: {
    gameVersion: '1.25.0',
    platform: 'logical-test',
    areaKey: 'meadow'
  },
  capabilities: {},
  objects: [
    {
      editorId: 'a',
      itemId: 40000001,
      layer: 'furniture',
      x: 10,
      y: 10,
      orientation: 0,
      footprint: [{ x: 0, y: 0 }, { x: 1, y: 0 }],
      dependencyIds: ['c']
    },
    {
      editorId: 'b',
      itemId: 40000002,
      layer: 'furniture',
      x: 15,
      y: 10,
      orientation: 4,
      footprint: [{ x: 0, y: 0 }],
      dependencyIds: []
    },
    {
      editorId: 'c',
      itemId: 40000003,
      layer: 'furniture',
      x: 10,
      y: 11,
      orientation: 0,
      footprint: [{ x: 0, y: 0 }],
      dependencyIds: []
    },
    {
      editorId: 's',
      itemId: 999,
      layer: 'static',
      x: 20,
      y: 20,
      orientation: 0,
      footprint: [{ x: 0, y: 0 }],
      dependencyIds: [],
      editability: 'readonly'
    }
  ]
};

test('normalizes document', () => {
  assert.equal(normalizeEditorDocument(base).objects.length, 4);
});

test('dependency closure includes child', () => {
  assert.deepEqual(
    new Set(
      dependencyClosure(normalizeEditorDocument(base), ['a'])
    ),
    new Set(['a', 'c'])
  );
});

test('bounds uses footprint', () => {
  assert.deepEqual(
    boundsFor(normalizeEditorDocument(base).objects.slice(0, 1)),
    { x: 10, y: 10, w: 2, h: 1 }
  );
});

test('selection rectangle ignores readonly', () => {
  const session = createEditorSession(base);
  assert.deepEqual(
    new Set(
      session.selectRect({
        x: 9,
        y: 9,
        w: 20,
        h: 20
      })
    ),
    new Set(['a', 'b', 'c'])
  );
});

test('move selection', () => {
  const session = createEditorSession(base);
  session.setSelection(['a', 'b']);
  assert.equal(session.move(null, 2, 3).applied, true);
  const document = session.getDocument();
  assert.equal(
    document.objects.find((object) => object.editorId === 'a').x,
    12
  );
  assert.equal(
    document.objects.find((object) => object.editorId === 'b').y,
    13
  );
});

test('undo redo', () => {
  const session = createEditorSession(base);
  session.setSelection(['b']);
  session.move(null, 1, 0);
  assert.equal(
    session.getDocument().objects.find((object) => object.editorId === 'b').x,
    16
  );
  session.undo();
  assert.equal(
    session.getDocument().objects.find((object) => object.editorId === 'b').x,
    15
  );
  session.redo();
  assert.equal(
    session.getDocument().objects.find((object) => object.editorId === 'b').x,
    16
  );
});

test('duplicate carries dependency closure', () => {
  const session = createEditorSession(base);
  const result = session.duplicate(['a']);
  assert.equal(result.applied, true);
  assert.equal(result.result.createdIds.length, 2);
  assert.equal(session.getDocument().objects.length, 6);
});

test('delete carries dependency closure', () => {
  const session = createEditorSession(base);
  session.remove(['a']);
  assert.deepEqual(
    new Set(session.getDocument().objects.map((object) => object.editorId)),
    new Set(['b', 's'])
  );
});

test('validator can reject edit', () => {
  const session = createEditorSession(base, {
    validator: (document) => ({
      ok: document.objects.every(
        (object) => object.x >= 0 && object.y >= 0
      ),
      issues: ['bounds']
    })
  });
  session.setSelection(['a']);
  const result = session.move(null, -20, 0);
  assert.equal(result.applied, false);
  assert.equal(
    session.getDocument().objects.find((object) => object.editorId === 'a').x,
    10
  );
});

test('preview never write ready', () => {
  const session = createEditorSession(base);
  assert.equal(
    session.previewPersistentCommit().writeReady,
    false
  );
});

test('real-target rotation requires Core geometry adapter', () => {
  const real = structuredClone(base);
  real.target = {
    gameVersion: '1.25.0',
    platform: 'Nintendo Switch',
    areaKey: 'meadow'
  };
  const session = createEditorSession(real);
  session.setSelection(['a']);
  const before = session.getDocument();
  const result = session.rotateCardinal(null, 1);
  assert.equal(result.applied, false);
  assert.equal(
    result.validation.issues[0].code,
    'GEOMETRY_ADAPTER_REQUIRED'
  );
  assert.deepEqual(session.getDocument(), before);
});

test('real-target rotation accepts injected Core geometry adapter', () => {
  const real = structuredClone(base);
  real.target = {
    gameVersion: '1.25.0',
    platform: 'Nintendo Switch',
    areaKey: 'meadow'
  };
  const session = createEditorSession(real, {
    geometryAdapter: {
      rotateCardinal: (object) => ({
        ...object,
        orientation: (object.orientation + 4) & 15
      })
    }
  });
  session.setSelection(['a']);
  const result = session.rotateCardinal(null, 1);
  assert.equal(result.applied, true);
  assert.equal(
    session.getDocument().objects.find((object) => object.editorId === 'a')
      .orientation,
    4
  );
});

test('multi-object real-target rotation requires selection geometry adapter', () => {
  const real = structuredClone(base);
  real.target = {
    gameVersion: '1.25.0',
    platform: 'Nintendo Switch',
    areaKey: 'meadow'
  };
  const session = createEditorSession(real, {
    geometryAdapter: {
      rotateCardinal: (object) => object
    }
  });
  session.setSelection(['a', 'b']);
  const result = session.rotateCardinal(null, 1);
  assert.equal(result.applied, false);
  assert.equal(
    result.validation.issues[0].code,
    'SELECTION_GEOMETRY_ADAPTER_REQUIRED'
  );
});

test('insertDraftGraph allocates draft-only identity', () => {
  const session = createEditorSession(base);
  const result = session.insertDraftGraph([
    {
      localId: 'x',
      itemId: 40009999,
      layer: 'furniture',
      localX: 0,
      localY: 0,
      dependencyLocalIds: []
    }
  ]);
  assert.equal(result.applied, true);
  assert.match(result.result.createdIds[0], /^draft-/);
  const created = session
    .getDocument()
    .objects.find((object) => object.editorId === result.result.createdIds[0]);
  assert.equal(created.source, null);
});

test('readonly object cannot be directly mutated', () => {
  const session = createEditorSession(base);
  assert.throws(
    () => session.move(['s'], 1, 0),
    /WEP_OBJECT_NOT_EDITABLE/
  );
});
