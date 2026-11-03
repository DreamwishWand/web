import test from 'node:test';
import assert from 'node:assert/strict';
import { createEditorSession } from '../src/lib/wep/editor-runtime.ts';

// Source-only adversarial fixtures. This intentionally reuses the existing
// EditorSession strict MOVE and validation APIs; no alternative move model.
// These are synthetic provenance claims, not decoded native Switch save data.
const ROOT = 42;
const AREA = Object.freeze({ x: 0, y: 0, w: 20, h: 12 });
const furniture = (editorId, x, metadata = {}, source = {}) => ({
  editorId, itemId: 40000001, layer: 'furniture',
  x, y: 2, orientation: 0, footprint: [{ x: 0, y: 0 }],
  source, portableState: null, dependencyIds: [],
  editability: 'editable',
  metadata: { displayName: editorId, reasons: [], ...metadata }
});
const fixture = ({
  targetPatch = {},
  unsafeMetadata = {},
  unsafeSource = {},
  safeMetadata = {},
  safeSource = {}
} = {}) => ({
  schema: 'dreamwish-wand-wep-editor-document',
  version: 1,
  target: {
    platform: 'switch', gameVersion: '1.25.0',
    areaKey: 'bounded-native-root-test', rootGridId: ROOT,
    ...targetPatch
  },
  objects: [
    furniture('valid-selected', 2, { rootGridId: ROOT, ...safeMetadata },
      { rootGridId: ROOT, ...safeSource }),
    furniture('unsafe-selected', 8, { rootGridId: ROOT, ...unsafeMetadata },
      { rootGridId: ROOT, ...unsafeSource }),
    furniture('untouched', 15, { rootGridId: ROOT }, { rootGridId: ROOT })
  ],
  networks: { roads: null, fences: null },
  roomFinish: null,
  capabilities: { worldPersistentWrite: 'unsupported' },
  metadata: { fixtureKind: 'LOCAL_GRID_PROVENANCE_NEGATIVE_ONLY' }
});

const cases = [
  ['missing target rootGridId (undefined) even if objects claim root', {
    targetPatch: { rootGridId: undefined }
  }, 'WEP_MULTI_DRAG_ACTIVE_GRID_UNPROVEN'],
  ['missing target rootGridId (null)', {
    targetPatch: { rootGridId: null }
  }, 'WEP_MULTI_DRAG_ACTIVE_GRID_UNPROVEN'],
  ['target rootGridId disagrees with both selected object origins', {
    targetPatch: { rootGridId: 43 }
  }, 'WEP_MULTI_DRAG_CROSS_GRID_OR_SUBGRID'],
  ['metadata.rootGridId mismatches target, source.rootGridId appears valid', {
    unsafeMetadata: { rootGridId: 43 }
  }, 'WEP_MULTI_DRAG_CROSS_GRID_OR_SUBGRID'],
  ['metadata.rootGridId omitted; source.rootGridId mismatches', {
    unsafeMetadata: { rootGridId: undefined },
    unsafeSource: { rootGridId: 43 }
  }, 'WEP_MULTI_DRAG_CROSS_GRID_OR_SUBGRID'],
  ['source.rootGridId mismatches target, metadata.rootGridId appears valid', {
    unsafeSource: { rootGridId: 43 }
  }, 'WEP_MULTI_DRAG_CROSS_GRID_OR_SUBGRID'],
  ['metadata.gridId mismatches despite matching rootGridId', {
    unsafeMetadata: { gridId: 43 }
  }, 'WEP_MULTI_DRAG_CROSS_GRID_OR_SUBGRID'],
  ['metadata.gridID mismatches despite matching gridId', {
    unsafeMetadata: { gridId: ROOT, gridID: 43 }
  }, 'WEP_MULTI_DRAG_CROSS_GRID_OR_SUBGRID'],
  ['source.gridId mismatches despite matching rootGridId', {
    unsafeSource: { gridId: 43 }
  }, 'WEP_MULTI_DRAG_CROSS_GRID_OR_SUBGRID'],
  ['source.gridID mismatches despite matching source.gridId', {
    unsafeSource: { gridId: ROOT, gridID: 43 }
  }, 'WEP_MULTI_DRAG_CROSS_GRID_OR_SUBGRID'],
  ['metadata.rootGridId missing but metadata.gridId contradicts source root', {
    unsafeMetadata: { rootGridId: undefined, gridId: 43 }
  }, 'WEP_MULTI_DRAG_CROSS_GRID_OR_SUBGRID'],
  ['mixed selection where only safe object belongs to active root', {
    unsafeMetadata: { gridId: 43 },
    safeMetadata: { gridId: ROOT }
  }, 'WEP_MULTI_DRAG_CROSS_GRID_OR_SUBGRID'],
  ['parentGridId without subGridDataPath in metadata', {
    unsafeMetadata: { parentGridId: ROOT }
  }, 'WEP_MULTI_DRAG_SUBGRID_UNPROVEN'],
  ['parentGridId without subGridDataPath in source', {
    unsafeSource: { parentGridId: ROOT }
  }, 'WEP_MULTI_DRAG_SUBGRID_UNPROVEN'],
  ['source parentGridId zero does not become falsy/implicitly absent', {
    unsafeSource: { parentGridId: 0 }
  }, 'WEP_MULTI_DRAG_SUBGRID_UNPROVEN'],
  ['subGridDataPath without parentGridId in metadata', {
    unsafeMetadata: { subGridDataPath: 'SubGrids/unknown' }
  }, 'WEP_MULTI_DRAG_SUBGRID_UNPROVEN'],
  ['subGridDataPath without parentGridId in source', {
    unsafeSource: { subGridDataPath: 'SubGrids/unknown' }
  }, 'WEP_MULTI_DRAG_SUBGRID_UNPROVEN'],
  ['source subGridDataPath while metadata omits path and parent', {
    unsafeMetadata: { subGridDataPath: undefined, parentGridId: undefined },
    unsafeSource: { subGridDataPath: 'SubGrids/unknown' }
  }, 'WEP_MULTI_DRAG_SUBGRID_UNPROVEN'],
  ['metadata parentGridId while source explicitly lacks its parent', {
    unsafeMetadata: { parentGridId: ROOT },
    unsafeSource: { parentGridId: null, subGridDataPath: null }
  }, 'WEP_MULTI_DRAG_SUBGRID_UNPROVEN'],
  ['metadata empty path and source nonempty path mixed provenance', {
    unsafeMetadata: { subGridDataPath: '' },
    unsafeSource: { subGridDataPath: 'SubGrids/unknown' }
  }, 'WEP_MULTI_DRAG_SUBGRID_UNPROVEN'],
  ['metadata parentGridId and source subGridDataPath mixed provenance', {
    unsafeMetadata: { parentGridId: ROOT },
    unsafeSource: { subGridDataPath: 'SubGrids/unknown' }
  }, 'WEP_MULTI_DRAG_SUBGRID_UNPROVEN'],
  ['apparently matching root and parentGridId still signals subgrid ancestry', {
    unsafeMetadata: { rootGridId: ROOT, parentGridId: ROOT },
    unsafeSource: { gridId: ROOT }
  }, 'WEP_MULTI_DRAG_SUBGRID_UNPROVEN'],
  ['other grid with a SubGrid path does not acquire authority from safe object', {
    unsafeMetadata: { rootGridId: ROOT, subGridDataPath: 'SubGrids/unknown' },
    unsafeSource: { rootGridId: ROOT, gridID: ROOT }
  }, 'WEP_MULTI_DRAG_SUBGRID_UNPROVEN']
];

test('negative Root/Parent/SubGrid provenance is entirely transactional: preview, strict MOVE, Document, Selection and both Undo/Redo stacks', async (t) => {
  for (const [label, input, expectedCode] of cases) {
    await t.test(label, () => {
      const session = createEditorSession(fixture(input), {
        allowInvalidDraft: true,
        validator: () => ({ ok: true, issues: [], persistentWriteAuthorized: false })
      });
      // Seed a real Undo+Redo branch with the PREEXISTING non-strict command
      // so refusal cannot silently truncate or overwrite the redo stack.
      session.setSelection(['valid-selected']);
      const seed = session.move(['valid-selected'], 0, 1);
      assert.equal(seed.applied, true);
      assert.equal(session.undo().applied, true);
      session.setSelection(['valid-selected', 'unsafe-selected']);
      assert.equal(session.getHistoryState().undoDepth, 0);
      assert.equal(session.getHistoryState().redoDepth, 1);
      const snapshot = session.exportRecoverySnapshot();
      const documentBefore = session.getDocument();
      const selectedBefore = session.getSelection();
      const historyBefore = session.getHistoryState();
      const reviewBefore = session.reviewChanges();
      const validationBefore = session.getLastValidation();

      const preview = session.previewStrictMove(null, 1, 0, AREA);
      assert.equal(preview.ok, false, 'adversarial preflight must fail');
      assert.equal(preview.code, expectedCode, 'specific Root/Parent/SubGrid blocker');
      assert.deepEqual(session.exportRecoverySnapshot(), snapshot, 'preview cannot mutate recovery snapshot');

      const result = session.move(null, 1, 0, { strict: true, areaBounds: AREA });
      assert.equal(result.applied, false);
      assert.equal(result.draftBlocked, true);
      assert.equal(result.validation.ok, false);
      assert.equal(result.validation.issues?.[0]?.code, expectedCode);
      assert.deepEqual(session.getDocument(), documentBefore, 'all object positions and unrelated state unchanged');
      assert.deepEqual(session.getSelection(), selectedBefore, 'selected IDs/order unchanged');
      assert.deepEqual(session.getHistoryState(), historyBefore, 'Undo/Redo depths and last kind unchanged');
      assert.deepEqual(session.getLastValidation(), validationBefore, 'last validator result unchanged');
      assert.deepEqual(session.reviewChanges(), reviewBefore, 'Draft review unchanged');
      assert.deepEqual(session.exportRecoverySnapshot(), snapshot,
        'full persisted local recovery/history including REDO branch unchanged');
      assert.equal(session.canUndo(), false);
      assert.equal(session.canRedo(), true);
    });
  }
});

test('positive control: same-root identifiers with absent optional Parent/SubGrid fields remain valid', () => {
  const session = createEditorSession(fixture({
    unsafeMetadata: { gridId: ROOT, gridID: ROOT, parentGridId: undefined, subGridDataPath: '' },
    unsafeSource: { gridId: ROOT, gridID: ROOT, parentGridId: null, subGridDataPath: null }
  }), {
    allowInvalidDraft: true,
    validator: () => ({ ok: true, issues: [], persistentWriteAuthorized: false })
  });
  session.setSelection(['valid-selected', 'unsafe-selected']);
  const before = session.getDocument();
  const preview = session.previewStrictMove(null, 1, 0, AREA);
  assert.equal(preview.ok, true);
  assert.deepEqual(session.getDocument(), before);
  const moved = session.move(null, 1, 0, { strict: true, areaBounds: AREA });
  assert.equal(moved.applied, true);
  assert.equal(session.getHistoryState().undoDepth, 1);
  assert.deepEqual(session.getSelection(), ['valid-selected', 'unsafe-selected']);
  assert.equal(session.undo().applied, true);
  assert.deepEqual(session.getDocument(), before);
  assert.equal(session.redo().applied, true);
  assert.equal(session.getHistoryState().undoDepth, 1);
  assert.equal(session.getDocument().objects[2].x, 15, 'stationary furniture not modified');
});
