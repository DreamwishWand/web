import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  CORE_ATTACHED_STATE_CAPABILITY_CONTRACT,
  buildObjectInspectorModel,
  buildPrimaryJobAvailability,
  describeDraftValidation,
  resolvePrimaryJobShortcut
} from '../src/lib/wep/world-editor-primary-job.ts';
import {
  normalizeEditorDocument
} from '../src/lib/wep/editor-runtime.ts';

const document = normalizeEditorDocument({
  target: {
    gameVersion: '1.25.0',
    platform: 'Nintendo Switch'
  },
  objects: [
    {
      editorId: 'editable',
      itemId: 40000001,
      layer: 'furniture',
      x: 1,
      y: 2,
      orientation: 0,
      footprint: [{ x: 0, y: 0 }],
      dependencyIds: [],
      editability: 'editable',
      metadata: {
        displayName: 'Editable chair'
      }
    },
    {
      editorId: 'mission',
      itemId: 40000002,
      layer: 'furniture',
      x: 3,
      y: 4,
      orientation: 0,
      footprint: [{ x: 0, y: 0 }],
      dependencyIds: [],
      editability: 'readonly',
      metadata: {
        displayName: 'Mission object',
        reasons: ['MISSION_ITEM_READ_ONLY']
      }
    }
  ]
});

test('readonly Core-protected selection stays inspectable but common mutation commands are disabled with reason', () => {
  const state = buildPrimaryJobAvailability({
    document,
    selectionIds: ['mission'],
    mutationBound: true,
    sessionAvailable: true
  });

  assert.equal(state.selectionCount, 1);
  assert.equal(state.selectedReadonlyCount, 1);
  for (const command of [
    'move',
    'rotate',
    'copy',
    'duplicate',
    'delete'
  ]) {
    assert.equal(state.commands[command].enabled, false);
    assert.equal(
      state.commands[command].reasonCode,
      'MISSION_ITEM_READ_ONLY'
    );
    assert.match(
      state.commands[command].reason,
      /protected/
    );
  }

  const inspector = buildObjectInspectorModel(
    document,
    ['mission']
  );
  assert.equal(inspector.selection.kind, 'SINGLE');
  assert.equal(inspector.selection.object.editability, 'readonly');
  assert.deepEqual(
    inspector.selection.object.reasonCodes,
    ['MISSION_ITEM_READ_ONLY']
  );
});

test('editable selection enables local common actions while empty clipboard and history remain explained', () => {
  const state = buildPrimaryJobAvailability({
    document,
    selectionIds: ['editable'],
    mutationBound: true,
    clipboardObjectCount: 0,
    canUndo: false,
    canRedo: false,
    sessionAvailable: true,
    originalBackupAvailable: false
  });

  assert.equal(state.commands.move.enabled, true);
  assert.equal(state.commands.rotate.enabled, true);
  assert.equal(state.commands.copy.enabled, true);
  assert.equal(state.commands.duplicate.enabled, true);
  assert.equal(state.commands.delete.enabled, true);
  assert.equal(state.commands.paste.enabled, false);
  assert.equal(
    state.commands.paste.reasonCode,
    'WEP_CLIPBOARD_EMPTY'
  );
  assert.equal(state.commands.undo.enabled, false);
  assert.equal(
    state.commands.undo.reasonCode,
    'WEP_UNDO_HISTORY_EMPTY'
  );
  assert.equal(
    state.commands.downloadOriginalBackup.reasonCode,
    'WEP_ORIGINAL_SAVE_BACKUP_UNAVAILABLE'
  );
});

test('no trusted draft binding disables mutation without inventing semantic eligibility', () => {
  const state = buildPrimaryJobAvailability({
    document,
    selectionIds: ['editable'],
    mutationBound: false
  });
  assert.equal(state.commands.move.enabled, false);
  assert.equal(
    state.commands.move.reasonCode,
    'WEP_DRAFT_AUTHORING_NOT_BOUND'
  );
});

test('validation presentation separates invalid, replacement policy, unknown and exact-build blockers', () => {
  const described = describeDraftValidation({
    ok: false,
    issues: [
      {
        severity: 'BLOCK',
        code: 'NATIVE_EXACT_BUILD_UNVERIFIED'
      },
      {
        severity: 'BLOCK',
        code: 'NATIVE_PLACEMENT_UNVERIFIED'
      },
      {
        severity: 'BLOCK',
        code: 'NATIVE_REPLACEMENT_OR_REMOVAL_POLICY_REQUIRED'
      },
      {
        severity: 'BLOCK',
        code: 'NATIVE_PLACEMENT_INVALID'
      }
    ]
  });

  assert.equal(described.status, 'INVALID');
  assert.deepEqual(
    described.groups.map((group) => group.id),
    ['INVALID', 'REPLACEMENT_POLICY', 'UNKNOWN', 'EXACT_BUILD']
  );
});

test('attached-state inspector consumes only explicit Core capability contract and never enables an unbound handler', () => {
  const source = structuredClone(document);
  source.objects[0].metadata = {
    ...source.objects[0].metadata,
    attachedStateCapabilityContract:
      CORE_ATTACHED_STATE_CAPABILITY_CONTRACT,
    attachedStateCapabilities: [
      {
        id: 'chest.contents',
        label: 'Edit Contents',
        status: 'available'
      },
      {
        id: 'building.skin',
        label: 'Edit Skin',
        status: 'blocked',
        blockerCode: 'CORE_SKIN_POLICY_BLOCKED'
      }
    ]
  };

  const trusted = buildObjectInspectorModel(
    source,
    ['editable']
  );
  assert.equal(trusted.attachedState.contractBound, true);
  assert.equal(trusted.attachedState.actions.length, 2);
  assert.equal(
    trusted.attachedState.actions[0].uiEnabled,
    false
  );
  assert.equal(
    trusted.attachedState.actions[0].uiReasonCode,
    'WEP_ATTACHED_STATE_HANDLER_NOT_BOUND'
  );

  const handlerBound = buildObjectInspectorModel(
    source,
    ['editable'],
    {
      boundAttachedActionIds: ['chest.contents']
    }
  );
  assert.equal(
    handlerBound.attachedState.actions[0].uiEnabled,
    true
  );
  assert.equal(
    handlerBound.attachedState.actions[1].uiEnabled,
    false
  );

  const untrusted = structuredClone(source);
  delete untrusted.objects[0].metadata
    .attachedStateCapabilityContract;
  const ignored = buildObjectInspectorModel(
    untrusted,
    ['editable'],
    {
      boundAttachedActionIds: ['chest.contents']
    }
  );
  assert.equal(ignored.attachedState.contractBound, false);
  assert.deepEqual(ignored.attachedState.actions, []);
});

test('keyboard shortcuts cover primary draft commands and ignore text-entry surfaces', () => {
  assert.equal(
    resolvePrimaryJobShortcut({ key: 'ArrowUp' }),
    'MOVE_UP'
  );
  assert.equal(
    resolvePrimaryJobShortcut({ key: 'r' }),
    'ROTATE'
  );
  assert.equal(
    resolvePrimaryJobShortcut({
      key: 'c',
      ctrlKey: true
    }),
    'COPY'
  );
  assert.equal(
    resolvePrimaryJobShortcut({
      key: 'z',
      metaKey: true,
      shiftKey: true
    }),
    'REDO'
  );
  assert.equal(
    resolvePrimaryJobShortcut({ key: 'Delete' }),
    'DELETE'
  );
  assert.equal(
    resolvePrimaryJobShortcut({
      key: 'ArrowLeft',
      targetTagName: 'input'
    }),
    null
  );
  assert.equal(
    resolvePrimaryJobShortcut({
      key: 'a',
      ctrlKey: true,
      targetContentEditable: true
    }),
    null
  );
  assert.equal(
    resolvePrimaryJobShortcut({
      key: 'Delete',
      targetTagName: 'button'
    }),
    null
  );
});

const worldEditorRouteSource = readFileSync(
  new URL('../src/routes/editor/world/+page.svelte', import.meta.url),
  'utf8'
);

test('World Editor route binds keyboard, mouse multi-select, blocker UI, inspector and backup controls to the primary-job contract', () => {
  assert.match(
    worldEditorRouteSource,
    /<svelte:window on:keydown=\{handlePrimaryJobKeydown\}/
  );
  assert.match(worldEditorRouteSource, /event\.ctrlKey \|\| event\.metaKey \|\| event\.shiftKey/);
  assert.match(worldEditorRouteSource, /on:click\|stopPropagation/);
  assert.match(worldEditorRouteSource, /worldEditor\.inspector\.eyebrow/);
  assert.match(worldEditorRouteSource, /worldEditor\.inspector\.commonActions/);
  assert.match(worldEditorRouteSource, /worldEditor\.inspector\.attachedActions/);
  assert.match(worldEditorRouteSource, /worldEditor\.status\.unavailableActions/);
  assert.match(worldEditorRouteSource, /validationPresentation\.groups/);
  assert.match(worldEditorRouteSource, /runPrimaryOriginalBackup/);
  assert.match(worldEditorRouteSource, /primaryJobAvailability\.commands\.delete\.enabled/);
  assert.match(
    worldEditorRouteSource,
    /aria-describedby=\{!primaryJobAvailability\.commands\.move\.enabled \? 'wep-reason-move' : undefined\}/
  );
  assert.match(
    worldEditorRouteSource,
    /tabindex=\{object\.editorId === canvasFocusEditorId \? 0 : -1\}/
  );
  assert.match(worldEditorRouteSource, /event\.key === '\[' \|\| event\.key === '\]'/);
  assert.match(worldEditorRouteSource, /data-editor-object-id=\{object\.editorId\}/);
  assert.doesNotMatch(
    worldEditorRouteSource,
    /(^|\s)disabled=\{!primaryJobAvailability\.commands\.move\.enabled\}/m
  );
});
