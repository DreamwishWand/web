import type {
  EditorDocument,
  EditorObject
} from './editor-runtime.ts';
import {
  inspectSelection
} from './canvas-runtime.ts';

export const CORE_ATTACHED_STATE_CAPABILITY_CONTRACT =
  'ddv.core-attached-state-capabilities@1';

export const PRIMARY_JOB_COMMANDS = Object.freeze([
  'move',
  'rotate',
  'copy',
  'paste',
  'duplicate',
  'delete',
  'undo',
  'redo',
  'reviewSavePrep',
  'downloadOriginalBackup'
] as const);

export type PrimaryJobCommand =
  (typeof PRIMARY_JOB_COMMANDS)[number];

export interface CommandAvailability {
  enabled: boolean;
  reasonCode: string | null;
  reason: string | null;
}

export interface PrimaryJobAvailability {
  commands: Record<PrimaryJobCommand, CommandAvailability>;
  selectionCount: number;
  selectedReadonlyCount: number;
  selectedBlockedCount: number;
  selectedReasonCodes: string[];
}

export interface ShortcutInput {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  targetTagName?: string | null;
  targetContentEditable?: boolean;
}

export type PrimaryJobShortcut =
  | 'MOVE_UP'
  | 'MOVE_DOWN'
  | 'MOVE_LEFT'
  | 'MOVE_RIGHT'
  | 'ROTATE'
  | 'COPY'
  | 'PASTE'
  | 'DUPLICATE'
  | 'DELETE'
  | 'UNDO'
  | 'REDO'
  | 'SELECT_VISIBLE'
  | 'CLEAR_SELECTION';

type AnyRecord = Record<string, any>;

const CORE_REASON_TEXT: Record<string, string> = Object.freeze({
  MISSION_ITEM_READ_ONLY:
    'This object is protected by the current Core mission-item policy and is inspectable but not mutable.',
  GRID_EDIT_RESTRICTION_PRESENT:
    'This object has an explicit Core grid-edit restriction and is inspectable but not mutable.',
  BUILDING_READ_ONLY:
    'This Building is read-only until Core proves an ordinary editable Building classification for its ItemID.',
  UNKNOWN_BUILDING_SEMANTICS:
    'Core cannot prove a safe ordinary Building classification for this ItemID, so mutation remains disabled.',
  BUILDING_SPECIAL_SEMANTICS_UNRESOLVED:
    'This Building has special lifecycle semantics and is inspectable but not available to generic Canvas mutation.',
  CHARACTER_HOUSE_PRESENCE_SIDE_EFFECTS_REQUIRE_DEDICATED_LIFECYCLE:
    'This Character House is tied to character-presence lifecycle state, so generic mutation is disabled.',
  STALL_SHOP_LOCAL_GLOBAL_STATE_LIFECYCLE_UNRESOLVED:
    'This Stall carries linked shop state, so generic mutation is disabled until that lifecycle is closed.',
  WELL_FASTTRAVEL_GLOBAL_STATE_AND_IDENTITY_REQUIRE_DEDICATED_LIFECYCLE:
    'This Wishing Well is tied to fast-travel and shared world state, so generic mutation is disabled.',
  GARDEN_TYPED_STATE_LIFECYCLE_REQUIRES_DEDICATED_CONTRACT:
    'This Garden has dedicated persistent state and cannot use generic Building mutation.',
  OFFGRID_BUILDING_PROFILEWORLD_LIFECYCLE_REQUIRED:
    'This Off-Grid Building uses a separate ProfileWorld lifecycle and cannot use generic Grid commands.',
  BUILDING_SHARED_SYNCHRONIZER_LIFECYCLE_REQUIRED:
    'This Building participates in synchronized/shared state and cannot be mutated independently.',
  HOUSE_DATA_READ_ONLY:
    'This HouseData object is read-only until a dedicated Core lifecycle capability allows this operation.',
  ROAD_FENCE_DELEGATED_01C:
    'Road/Fence topology is handled by the dedicated Core Road/Fence model, not generic object commands.',
  GEOMETRY_UNRESOLVED:
    'Core geometry is unresolved for this object, so mutation stays disabled.',
  FURNITURE_POLICY_MISSING:
    'Core item-policy evidence is missing for this object, so mutation stays disabled.',
  NON_FURNITURE_WORLD_CLASS:
    'This world object class is not authorized for generic World Editor mutation.',
  WORLD_OBJECT_NOT_EDITABLE:
    'At least one selected object is read-only or blocked by the current Core projection.'
});

function unique(values: string[]) {
  return [...new Set(values)];
}

function selectedObjects(
  document: EditorDocument | null | undefined,
  selectionIds: string[]
): EditorObject[] {
  if (!document) return [];
  const selected = new Set((selectionIds ?? []).map(String));
  return document.objects.filter((object) =>
    selected.has(String(object.editorId))
  );
}

function coreReasonCodes(objects: EditorObject[]) {
  return unique(
    objects.flatMap((object) =>
      Array.isArray(object.metadata?.reasons)
        ? object.metadata.reasons.map(String)
        : []
    )
  );
}

export function explainCoreObjectReason(
  codeInput: unknown
): string {
  const code = String(codeInput ?? '');
  if (CORE_REASON_TEXT[code]) return CORE_REASON_TEXT[code];
  if (code.startsWith('NATIVE_REJECT_')) {
    return 'DDV native preset/edit policy rejects this object in the current Core scope.';
  }
  if (code.startsWith('STATE_') && code.endsWith('_UNSUPPORTED')) {
    return 'The object carries attached state whose mutation semantics are not promoted for generic editing.';
  }
  if (code.startsWith('ROOT_GRID_')) {
    return 'The selected root Grid is visible but not authorized for mutation by the current Core role contract.';
  }
  return code
    ? `Core keeps this object read-only: ${code}.`
    : 'The selected object is read-only under the current Core projection.';
}

function command(
  enabled: boolean,
  reasonCode: string | null = null,
  reason: string | null = null
): CommandAvailability {
  return {
    enabled,
    reasonCode: enabled ? null : reasonCode,
    reason: enabled ? null : reason
  };
}

export function buildPrimaryJobAvailability({
  document,
  selectionIds = [],
  mutationBound = false,
  clipboardObjectCount = 0,
  canUndo = false,
  canRedo = false,
  sessionAvailable = false,
  originalBackupAvailable = false
}: {
  document?: EditorDocument | null;
  selectionIds?: string[];
  mutationBound?: boolean;
  clipboardObjectCount?: number;
  canUndo?: boolean;
  canRedo?: boolean;
  sessionAvailable?: boolean;
  originalBackupAvailable?: boolean;
} = {}): PrimaryJobAvailability {
  const objects = selectedObjects(document, selectionIds);
  const readonly = objects.filter(
    (object) => object.editability === 'readonly'
  );
  const blocked = objects.filter(
    (object) => object.editability === 'blocked'
  );
  const nonEditable = objects.filter(
    (object) => object.editability !== 'editable'
  );
  const reasons = coreReasonCodes(nonEditable);
  const firstReasonCode =
    reasons[0] ??
    (nonEditable.length ? 'WORLD_OBJECT_NOT_EDITABLE' : null);
  const firstReason = firstReasonCode
    ? explainCoreObjectReason(firstReasonCode)
    : null;

  let selectionGate: CommandAvailability;
  if (!mutationBound) {
    selectionGate = command(
      false,
      'WEP_DRAFT_AUTHORING_NOT_BOUND',
      'No trusted local draft-authoring binding is available for this target.'
    );
  } else if (!objects.length) {
    selectionGate = command(
      false,
      'WEP_SELECTION_EMPTY',
      'Select at least one visible object first.'
    );
  } else if (nonEditable.length) {
    selectionGate = command(
      false,
      firstReasonCode,
      firstReason
    );
  } else {
    selectionGate = command(true);
  }

  const clipboardGate = !mutationBound
    ? command(
        false,
        'WEP_DRAFT_AUTHORING_NOT_BOUND',
        'No trusted local draft-authoring binding is available for this target.'
      )
    : Number(clipboardObjectCount) <= 0
      ? command(
          false,
          'WEP_CLIPBOARD_EMPTY',
          'Copy an editable object selection before using Paste.'
        )
      : command(true);

  return {
    selectionCount: objects.length,
    selectedReadonlyCount: readonly.length,
    selectedBlockedCount: blocked.length,
    selectedReasonCodes: reasons,
    commands: {
      move: selectionGate,
      rotate: selectionGate,
      copy: selectionGate,
      paste: clipboardGate,
      duplicate: selectionGate,
      delete: selectionGate,
      undo: mutationBound && canUndo
        ? command(true)
        : command(
            false,
            mutationBound
              ? 'WEP_UNDO_HISTORY_EMPTY'
              : 'WEP_DRAFT_AUTHORING_NOT_BOUND',
            mutationBound
              ? 'There is no local draft command to undo.'
              : 'No trusted local draft-authoring binding is available for this target.'
          ),
      redo: mutationBound && canRedo
        ? command(true)
        : command(
            false,
            mutationBound
              ? 'WEP_REDO_HISTORY_EMPTY'
              : 'WEP_DRAFT_AUTHORING_NOT_BOUND',
            mutationBound
              ? 'There is no local draft command to redo.'
              : 'No trusted local draft-authoring binding is available for this target.'
          ),
      reviewSavePrep: sessionAvailable
        ? command(true)
        : command(
            false,
            'WEP_EDITOR_SESSION_UNAVAILABLE',
            'Open an EditorDocument or a supported DDV root Grid before reviewing save preparation.'
          ),
      downloadOriginalBackup: originalBackupAvailable
        ? command(true)
        : command(
            false,
            'WEP_ORIGINAL_SAVE_BACKUP_UNAVAILABLE',
            'Load a raw DDV save first. Imported EditorDocuments do not create an Original Save Backup.'
          )
    }
  };
}

export function describeDraftValidation(
  validation: AnyRecord | null | undefined
) {
  if (!validation) {
    return {
      status: 'NOT_RUN',
      label: 'Not run',
      groups: [] as Array<{
        id: string;
        label: string;
        codes: string[];
      }>
    };
  }

  const blockerCodes = unique(
    (validation.issues ?? [])
      .filter((issue: AnyRecord) => issue?.severity === 'BLOCK')
      .map((issue: AnyRecord) => String(issue.code ?? 'WEP_UNKNOWN_BLOCKER'))
  );

  if (validation.ok && blockerCodes.length === 0) {
    return {
      status: 'PASS',
      label: 'PASS',
      groups: [] as Array<{
        id: string;
        label: string;
        codes: string[];
      }>
    };
  }

  const definitions = [
    {
      id: 'INVALID',
      label: 'Native placement invalid',
      match: (code: string) =>
        code === 'NATIVE_PLACEMENT_INVALID'
    },
    {
      id: 'REPLACEMENT_POLICY',
      label: 'Replacement/removal policy blocked',
      match: (code: string) =>
        code === 'NATIVE_REPLACEMENT_OR_REMOVAL_POLICY_REQUIRED' ||
        code.includes('REPLACEMENT_POLICY_REQUIRED')
    },
    {
      id: 'UNKNOWN',
      label: 'Native placement unverified',
      match: (code: string) =>
        code === 'NATIVE_PLACEMENT_UNVERIFIED' ||
        code.includes('PLACEMENT_UNVERIFIED')
    },
    {
      id: 'EXACT_BUILD',
      label: 'Exact build unverified',
      match: (code: string) =>
        code === 'NATIVE_EXACT_BUILD_UNVERIFIED'
    }
  ];

  const matched = new Set<string>();
  const groups = definitions
    .map((definition) => {
      const codes = blockerCodes.filter((code) =>
        definition.match(code)
      );
      codes.forEach((code) => matched.add(code));
      return {
        id: definition.id,
        label: definition.label,
        codes
      };
    })
    .filter((group) => group.codes.length > 0);

  const other = blockerCodes.filter((code) => !matched.has(code));
  if (other.length) {
    groups.push({
      id: 'OTHER_BLOCKER',
      label: 'Other blocker',
      codes: other
    });
  }

  const status =
    groups.find((group) => group.id === 'INVALID')?.id ??
    groups.find((group) => group.id === 'REPLACEMENT_POLICY')?.id ??
    groups.find((group) => group.id === 'UNKNOWN')?.id ??
    groups.find((group) => group.id === 'EXACT_BUILD')?.id ??
    'BLOCKED';

  return {
    status,
    label:
      groups.find((group) => group.id === status)?.label ??
      'Blocked',
    groups
  };
}

function normalizeAttachedCapability(raw: AnyRecord) {
  const id = String(raw?.id ?? '').trim();
  const label = String(raw?.label ?? '').trim();
  const semanticStatus = String(raw?.status ?? '').trim();
  if (!id || !label) return null;
  if (
    !['available', 'readonly', 'blocked'].includes(
      semanticStatus
    )
  ) {
    return null;
  }
  return {
    id,
    label,
    semanticStatus,
    blockerCode:
      raw.blockerCode === undefined ||
      raw.blockerCode === null
        ? null
        : String(raw.blockerCode),
    detail:
      raw.detail === undefined || raw.detail === null
        ? null
        : String(raw.detail)
  };
}

export function buildObjectInspectorModel(
  documentInput: EditorDocument | null | undefined,
  selectionIds: string[],
  {
    boundAttachedActionIds = []
  }: {
    boundAttachedActionIds?: string[];
  } = {}
) {
  if (!documentInput) {
    return {
      selection: {
        count: 0,
        kind: 'NONE',
        details: null
      },
      commonActions: {
        supportedBySelection: false
      },
      attachedState: {
        contractBound: false,
        status: 'NO_SELECTION',
        actions: [] as AnyRecord[]
      }
    };
  }

  const details = inspectSelection(
    documentInput,
    selectionIds ?? []
  );

  if (details.count !== 1) {
    return {
      selection: {
        count: details.count,
        kind: details.count > 1 ? 'MULTI' : 'NONE',
        details
      },
      commonActions: {
        supportedBySelection: details.count > 0
      },
      attachedState: {
        contractBound: false,
        status:
          details.count > 1
            ? 'SINGLE_OBJECT_REQUIRED'
            : 'NO_SELECTION',
        actions: [] as AnyRecord[]
      }
    };
  }

  const selectedId = details.objects[0].editorId;
  const object = documentInput.objects.find(
    (candidate) => candidate.editorId === selectedId
  )!;
  const metadata = object.metadata ?? {};
  const contract =
    String(metadata.attachedStateCapabilityContract ?? '');
  const trusted =
    contract === CORE_ATTACHED_STATE_CAPABILITY_CONTRACT;
  const bound = new Set(
    (boundAttachedActionIds ?? []).map(String)
  );

  const actions = trusted
    ? (Array.isArray(metadata.attachedStateCapabilities)
        ? metadata.attachedStateCapabilities
        : [])
        .map(normalizeAttachedCapability)
        .filter(Boolean)
        .map((capability: any) => {
          const handlerBound = bound.has(capability.id);
          const coreAvailable =
            capability.semanticStatus === 'available';
          return {
            ...capability,
            handlerBound,
            uiEnabled: coreAvailable && handlerBound,
            uiReasonCode: !coreAvailable
              ? capability.blockerCode ??
                'CORE_ATTACHED_STATE_ACTION_NOT_AVAILABLE'
              : !handlerBound
                ? 'WEP_ATTACHED_STATE_HANDLER_NOT_BOUND'
                : null
          };
        })
    : [];

  return {
    selection: {
      count: 1,
      kind: 'SINGLE',
      details,
      object: {
        editorId: object.editorId,
        itemId: object.itemId,
        layer: object.layer,
        editability: object.editability,
        x: object.x,
        y: object.y,
        orientation: object.orientation,
        reasonCodes: Array.isArray(metadata.reasons)
          ? metadata.reasons.map(String)
          : [],
        stateKind: metadata.stateKind ?? null,
        worldClass: metadata.worldClass ?? null
      }
    },
    commonActions: {
      supportedBySelection: true
    },
    attachedState: {
      contractBound: trusted,
      status: trusted
        ? actions.length
          ? 'CORE_CAPABILITIES_PRESENT'
          : 'NO_CORE_ATTACHED_ACTIONS'
        : 'CORE_CAPABILITY_NOT_BOUND',
      actions
    }
  };
}

function textEntryTarget(input: ShortcutInput) {
  const tag = String(input.targetTagName ?? '')
    .toUpperCase();
  return (
    input.targetContentEditable === true ||
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT' ||
    tag === 'BUTTON' ||
    tag === 'A'
  );
}

export function resolvePrimaryJobShortcut(
  input: ShortcutInput
): PrimaryJobShortcut | null {
  if (!input || textEntryTarget(input)) return null;
  const key = String(input.key ?? '');
  const lower = key.toLocaleLowerCase();
  const mod = Boolean(input.ctrlKey || input.metaKey);

  if (key === 'Escape') return 'CLEAR_SELECTION';
  if (mod && lower === 'a') return 'SELECT_VISIBLE';
  if (mod && lower === 'c') return 'COPY';
  if (mod && lower === 'v') return 'PASTE';
  if (mod && lower === 'd') return 'DUPLICATE';
  if (
    mod &&
    lower === 'z' &&
    input.shiftKey
  ) {
    return 'REDO';
  }
  if (mod && lower === 'z') return 'UNDO';
  if (mod && lower === 'y') return 'REDO';
  if (key === 'Delete' || key === 'Backspace') {
    return 'DELETE';
  }
  if (!mod && !input.altKey && lower === 'r') {
    return 'ROTATE';
  }
  if (!mod && !input.altKey && key === 'ArrowUp') {
    return 'MOVE_UP';
  }
  if (!mod && !input.altKey && key === 'ArrowDown') {
    return 'MOVE_DOWN';
  }
  if (!mod && !input.altKey && key === 'ArrowLeft') {
    return 'MOVE_LEFT';
  }
  if (!mod && !input.altKey && key === 'ArrowRight') {
    return 'MOVE_RIGHT';
  }
  return null;
}
