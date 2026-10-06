<script lang="ts">
  import { onMount } from 'svelte';
  import { base } from '$app/paths';
  import { locale, t } from '$lib/i18n/runtime.js';
  import { CommunityLabClient } from '$lib/community/staging-http-client';
  import { readCommunityBrowserConfig } from '$lib/community/runtime-config';
  import { createPresetCommunityBridge } from '$lib/wep/preset-community-bridge';
  import {
    buildPublishEnvelope,
    preflightScene,
    validatePublishablePreset
  } from '$lib/wep/scene-preset-runtime';
  import { captureScenePreset } from '$lib/wep/scene-capture-runtime';
  import { createScenePresetWorkflow } from '$lib/wep/scene-preset-workflow';
  import {
    WEP_EDITOR_SCHEMA,
    WEP_LAYERS,
    boundsFor,
    createEditorSession,
    normalizeEditorDocument
  } from '$lib/wep/editor-runtime';
  import {
    createLayerState,
    projectObjects,
    reconcileSelectionToProjection
  } from '$lib/wep/canvas-runtime';
  import { openWorldSaveBytes } from '$lib/wep/world-save-source';
  import {
    createOriginalSaveBackup
  } from '$lib/wep/local-save-backup';
  import {
    createSwitchWorldReadAdapter,
    projectSwitchAreaGrid,
    projectSwitchFloatingIslandGrid
  } from '$lib/wep/world-browser-adapter';
  import { buildCurrentV125FullDesignCapturePlan } from '$lib/wep/full-design-preset-planning';
  import { preflightCurrentV125FullDesignManifest } from '$lib/wep/full-design-preset-preflight';
  import {
    createDraftAwareNetworkCaptureAdapter,
    createSwitchV125RoadFenceReaderBinding
  } from '$lib/wep/roadfence-reader-adapter';
  import { assessCurrentV125BrowserPlacementReadiness } from '$lib/wep/placement-readiness';
  import {
    localizeCommandLabel,
    localizeCommandReason,
    localizeCoreReason,
    localizeValidationGroup,
    localizeWepBlocker
  } from '$lib/wep/world-editor-i18n';
  import {
    NATIVE_PLACEMENT_CLASSES,
    createSwitchV125PlacementLegalityBinding
  } from '$lib/wep/placement-legality-v19';
  import {
    createSwitchV125BuildingBinding
  } from '$lib/wep/building-v110';
  import {
    createSwitchV125ScroogeStoreBinding
  } from '$lib/wep/scrooge-store-v112';
  import {
    createSwitchV125ProgressionIntegrationBinding
  } from '$lib/wep/progression-integration-v114';
  import {
    buildSwitchV125DestinationProgressionProjection
  } from '$lib/wep/progression-destination-projection-v115';
  import {
    commitMinimumVerifiedTransform,
    reviewMinimumVerifiedTransform
  } from '$lib/wep/min-verified-transform-export-v1';
  import {
    ORDINARY_FURNITURE_ADD_VERIFIED_EXPORT_CONTRACT,
    commitOrdinaryFurnitureAddVerifiedExport,
    reviewOrdinaryFurnitureAddVerifiedExport
  } from '$lib/wep/ordinary-furniture-add-verified-export-v125';
  import {
    ROADFENCE_VERIFIED_EXPORT_CONTRACT,
    commitRoadFenceVerifiedExport,
    reviewRoadFenceVerifiedExport
  } from '$lib/wep/roadfence-verified-export-v125';
  import {
    ROOM_FINISH_VERIFIED_EXPORT_CONTRACT,
    WALLPAPER_SCOPE,
    applyRoomFinishDraftMutationV125,
    commitRoomFinishVerifiedExportV125,
    compileRoomFinishFlooringDraftV125,
    compileRoomFinishWallpaperDraftV125,
    createRoomFinishEditorDocumentV125,
    listIndoorRoomFinishRoutesV125,
    listOwnedRoomFinishTrimmingV125,
    loadRoomFinishTrimmingPackV125,
    reviewRoomFinishVerifiedExportV125,
    roomFinishDraftReviewChange
  } from '$lib/wep/room-finish-verified-export-v125';
  import { roomFinishCopy } from '$lib/wep/room-finish-copy.js';
  import {
    decodeCollectionRecord,
    loadCollectionRuntime
  } from '$lib/collection/runtime.js';
  import {
    buildObjectInspectorModel,
    buildPrimaryJobAvailability,
    describeDraftValidation,
    resolvePrimaryJobShortcut,
    type PrimaryJobCommand
  } from '$lib/wep/world-editor-primary-job';
  import {
    FENCE_POST_AUTO_LAYOUT,
    applyFencePostAutoLayout,
    insertFencePost,
    moveFencePost,
    removeFencePost,
    setFencePostPinned,
    validateFencePostLayoutDraft
  } from '$lib/wep/fence-post-edit-contract';
  import WorldEditorStage1DecoratePanel from '$lib/wep/WorldEditorStage1DecoratePanel.svelte';
  import {
    createRecoveryRecord,
    getActiveWorldEditorMemory,
    listRecoveryRecords,
    recoveryCompatible,
    routeKeyForDocument,
    saveRecoveryRoute,
    setActiveWorldEditorDraftRecord,
    setActiveWorldEditorMemory,
    sha256Fingerprint
  } from '$lib/wep/world-editor-recovery';
  import { readWorldEditorHandoff } from '$lib/wep/world-editor-handoff';
  import { worldEditorStage1Copy } from '$lib/wep/world-editor-stage1-copy.js';
  import {
    previewConnectedSelection,
    previewFenceBranchSelection,
    previewFencePolyline,
    previewFenceRectangleOutline,
    previewFenceSegmentDelete,
    previewFenceStyleReplace,
    previewFenceTransform,
    previewRoadCellDelete,
    previewRoadPolyline,
    previewRoadRectangleOutline,
    previewRoadStyleReplace,
    previewRoadTransform,
    sampleFenceEyedropper,
    sampleRoadEyedropper
  } from '$lib/wep/roadfence-authoring-contract';

  let session: any = null;
  let editorDocument: any = null;
  let worldSource: any = null;
  let projected: any[] = [];
  let selection: string[] = [];
  let layerState: any = null;
  let areaBounds = { x: 0, y: 0, w: 24, h: 16 };
  let query = '';
  let selectedOnly = false;
  let canvasFocusEditorId = '';
  let fileName = '';
  let message = '';
  let capturePreview: any = null;
  let published: any = null;
  let loading = false;
  let sourcePlatform = 'unknown';
  let switchWorldBinding: any = null;
  let fullDesignPlan: any = null;
  let fullDesignPlanError = '';
  let fullDesignRootDocuments: any[] = [];
  let fullDesignSourceRootGridId: number | null = null;
  let fullDesignDestinationFileName = '';
  let fullDesignDestinationPreflight: any = null;
  let fullDesignDestinationError = '';
  let fullDesignDestinationLoading = false;
  let floatingIslandPlan: any = null;
  let floatingIslandPlanError = '';
  let roadFenceReaderBinding: any = null;
  let roadFenceSceneCaptureAdapter: any = null;
  let placementLegalityBinding: any = null;
  let buildingV110Binding: any = null;
  let scroogeStoreV112Binding: any = null;
  let progressionV114Binding: any = null;
  let scroogeStorePreview: any = null;
  let includeRoads = false;
  let includeFences = false;
  let fencePostNetworks: any[] = [];
  let fencePostSelectedNetworkId = '';
  let fencePostDraft: any = null;
  let fencePostValidation: any = null;
  let fencePostMoveNodeId = '';
  let fencePostEditX = 0;
  let fencePostEditY = 0;
  let fencePostMessage = '';
  let draftAuthoringBound = false;
  let draftValidation: any = null;
  let draftSavePreparation: any = null;
  let lastDraftCommand = '';
  let originalSaveBackup: any = null;
  let worldSourceBytes: Uint8Array | null = null;
  let worldSourceEpoch = 0;
  let sourceFingerprint = '';
  let recoveryRecords: any[] = [];
  let recoveryRequest: any = null;
  let recoveryStatus = '';
  let pendingWorldEditorHandoff: any = null;
  let inspectorCoordinateX = 0;
  let inspectorCoordinateY = 0;
  let inspectorCoordinateEditorId = '';
  let saveFileInput: HTMLInputElement;
  let verifiedExportBaselineDocument: any = null;
  let verifiedExportReview: any = null;
  let verifiedExportResult: any = null;
  let verifiedExportErrorCode = '';
  let verifiedExportErrorDetail = '';
  let verifiedExportLoading = false;
  let verifiedExportBuildConfirmed = false;
  let verifiedExportConfirmed = false;
  let copiedDraftClipboard: any = null;
  let clipboardPasteCount = 0;
  let roadFenceRootDraft: any = null;
  let rfKind: 'road' | 'fence' = 'road';
  let rfTool: 'polyline' | 'rectangle' = 'polyline';
  let rfNetworkId = '';
  let rfFamilyBaseItemID = 0;
  let rfMode = 'orthogonal';
  let rfPoints = '0,0; 4,0';
  let rfSeedX = 0;
  let rfSeedY = 0;
  let rfSeedNodeId = '';
  let rfAdjacentNodeId = '';
  let rfTargetFamilyBaseItemID = 0;
  let rfTranslateX = 0;
  let rfTranslateY = 0;
  let rfRotateQuarterTurns = 0;
  let rfPreview: any = null;
  let rfMessage = '';

  let roomFinishPack: any = null;
  let roomFinishCollectionRuntime: any = null;
  let roomFinishCollectionRowsById = new Map<number, any>();
  let roomFinishRoutes: any[] = [];
  let roomFinishDiagnostics: any[] = [];
  let activeRoomSurface: 'Floor' | 'Wall' | 'Ceiling' = 'Floor';
  let activeRoomWallPosition: number | null = null;
  let roomFinishOpen = false;
  let roomFinishMode: 'FLOORING' | 'WALLPAPER' = 'FLOORING';
  let roomFinishScope: 'CURRENT_WALL' | 'ALL_WALLS' = 'ALL_WALLS';
  let roomFinishFlooringItemId = 0;
  let roomFinishWallpaperItemId = 0;
  let roomFinishOwnedFlooring: any[] = [];
  let roomFinishOwnedWallpaper: any[] = [];
  let roomFinishPreview: any = null;
  let roomFinishStatus = '';

  let community: CommunityLabClient | null = null;
  let bridge: ReturnType<typeof createPresetCommunityBridge> | null = null;
  let workflow: ReturnType<typeof createScenePresetWorkflow> | null = null;
  let connected = false;
  let creatorProfileId = '';

  let presetTitle = '';
  let presetDescription = '';
  let visibility = 'unlisted';
  let publishKey = '';
  let captureRegionMode: 'selection' | 'custom' = 'selection';
  let captureRegionX = 0;
  let captureRegionY = 0;
  let captureRegionW = 1;
  let captureRegionH = 1;

  $: mutationBound =
    Boolean(session) &&
    (
      editorDocument?.target?.platform === 'synthetic' ||
      draftAuthoringBound
    );
  $: selectedCount = selection.length;
  $: objectCount = editorDocument?.objects?.length ?? 0;
  $: stage1Copy = worldEditorStage1Copy($locale);
  $: roomFinishUi = roomFinishCopy($locale);
  $: roomFinishContextActive =
    editorDocument?.target?.kind === 'PLAYER_HOUSE_ROOM';
  $: roomFinishCurrentState =
    roomFinishContextActive ? editorDocument?.roomFinish?.current ?? null : null;
  $: placementReadiness = editorDocument
    ? assessCurrentV125BrowserPlacementReadiness(editorDocument)
    : null;
  $: progressionProofStatus =
    editorDocument?.metadata?.progressionIntegration?.proofStatus ?? null;
  $: primaryJobAvailability = (() => {
    void lastDraftCommand;
    return buildPrimaryJobAvailability({
      document: editorDocument,
      selectionIds: selection,
      mutationBound,
      clipboardObjectCount:
        copiedDraftClipboard?.graph?.length ?? 0,
      canUndo: Boolean(session?.canUndo?.()),
      canRedo: Boolean(session?.canRedo?.()),
      sessionAvailable: Boolean(session),
      originalBackupAvailable: Boolean(originalSaveBackup)
    });
  })();
  $: validationPresentation =
    describeDraftValidation(draftValidation);
  $: objectInspector = buildObjectInspectorModel(
    editorDocument,
    selection
  );
  $: selectedInspectorObject =
    objectInspector.selection.kind === 'SINGLE'
      ? objectInspector.selection.object ?? null
      : null;
  $: if (
    selectedInspectorObject?.editorId !== inspectorCoordinateEditorId
  ) {
    inspectorCoordinateEditorId =
      selectedInspectorObject?.editorId ?? '';
    if (selectedInspectorObject) {
      inspectorCoordinateX = Number(selectedInspectorObject.x);
      inspectorCoordinateY = Number(selectedInspectorObject.y);
    }
  }
  $: scroogeStorePreview =
    worldSource &&
    selectedInspectorObject &&
    scroogeStoreV112Binding
      ? scroogeStoreV112Binding.resolveStoreForItem(
          worldSource.profile,
          selectedInspectorObject.itemId
        )
      : null;

  function roomFinishItemLabel(itemId: number) {
    const row = roomFinishCollectionRowsById.get(Number(itemId));
    if (!row || !roomFinishCollectionRuntime?.index) {
      return `Item ${Number(itemId)}`;
    }
    try {
      return decodeCollectionRecord(
        roomFinishCollectionRuntime.index,
        row,
        $locale
      ).label || `Item ${Number(itemId)}`;
    } catch {
      return `Item ${Number(itemId)}`;
    }
  }

  function resetRoomFinishUi() {
    activeRoomSurface = 'Floor';
    activeRoomWallPosition = null;
    roomFinishOpen = false;
    roomFinishMode = 'FLOORING';
    roomFinishScope = 'ALL_WALLS';
    roomFinishFlooringItemId = 0;
    roomFinishWallpaperItemId = 0;
    roomFinishOwnedFlooring = [];
    roomFinishOwnedWallpaper = [];
    roomFinishPreview = null;
    roomFinishStatus = '';
  }

  function refreshRoomFinishRoutes() {
    if (
      !worldSource ||
      worldSource.saveIdentity?.sourcePlatform !== 'switch' ||
      worldSource.compatibility?.gameVersion !== '1.25.0' ||
      Number(worldSource.profileSchemaVersion) !== 624
    ) {
      roomFinishRoutes = [];
      roomFinishDiagnostics = [];
      return;
    }
    const routes = listIndoorRoomFinishRoutesV125(worldSource.profile);
    roomFinishRoutes = [...routes.routes];
    roomFinishDiagnostics = [...routes.diagnostics];
  }

  async function ensureRoomFinishData() {
    if (!roomFinishPack) {
      roomFinishPack = await loadRoomFinishTrimmingPackV125({
        basePath: base
      });
    }
    if (!roomFinishCollectionRuntime) {
      const runtime = await loadCollectionRuntime(base);
      roomFinishCollectionRuntime = runtime;
      roomFinishCollectionRowsById = new Map(
        runtime.rows.map((row: any) => [Number(row?.[0]), row])
      );
    }
  }

  function refreshRoomFinishOwnedItems() {
    if (!worldSource || !roomFinishPack) {
      roomFinishOwnedFlooring = [];
      roomFinishOwnedWallpaper = [];
      return;
    }
    roomFinishOwnedFlooring = [
      ...listOwnedRoomFinishTrimmingV125({
        profile: worldSource.profile,
        pack: roomFinishPack,
        subtype: 1
      })
    ];
    roomFinishOwnedWallpaper = [
      ...listOwnedRoomFinishTrimmingV125({
        profile: worldSource.profile,
        pack: roomFinishPack,
        subtype: 0
      })
    ];
    if (
      !roomFinishOwnedFlooring.some(
        (entry: any) =>
          Number(entry.itemId) === Number(roomFinishFlooringItemId)
      )
    ) {
      roomFinishFlooringItemId =
        Number(roomFinishOwnedFlooring[0]?.itemId ?? 0);
    }
    if (
      !roomFinishOwnedWallpaper.some(
        (entry: any) =>
          Number(entry.itemId) === Number(roomFinishWallpaperItemId)
      )
    ) {
      roomFinishWallpaperItemId =
        Number(roomFinishOwnedWallpaper[0]?.itemId ?? 0);
    }
  }

  function setActiveRoomSurface(
    surface: 'Floor' | 'Wall' | 'Ceiling',
    wallPosition: number | null = null
  ) {
    activeRoomSurface = surface;
    activeRoomWallPosition =
      surface === 'Wall' && Number.isSafeInteger(Number(wallPosition))
        ? Number(wallPosition)
        : null;
    roomFinishPreview = null;
    roomFinishStatus = '';
    if (
      roomFinishScope === 'CURRENT_WALL' &&
      activeRoomWallPosition === null
    ) {
      roomFinishScope = 'ALL_WALLS';
    }
  }

  function toggleRoomFinish() {
    if (!roomFinishContextActive) return;
    roomFinishOpen = !roomFinishOpen;
    roomFinishPreview = null;
    roomFinishStatus = '';
  }

  function buildRoomFinishPreview(
    kind: 'FLOORING' | 'WALLPAPER'
  ) {
    if (
      !editorDocument ||
      !worldSource ||
      !roomFinishPack ||
      !roomFinishContextActive
    ) {
      throw new Error('WEP_ROOM_FINISH_CONTEXT_REQUIRED');
    }
    const compiled =
      kind === 'FLOORING'
        ? compileRoomFinishFlooringDraftV125({
            document: editorDocument,
            profile: worldSource.profile,
            pack: roomFinishPack,
            itemId: Number(roomFinishFlooringItemId)
          })
        : compileRoomFinishWallpaperDraftV125({
            document: editorDocument,
            profile: worldSource.profile,
            pack: roomFinishPack,
            itemId: Number(roomFinishWallpaperItemId),
            scope: roomFinishScope,
            wallPosition:
              roomFinishScope === WALLPAPER_SCOPE.CURRENT_WALL
                ? activeRoomWallPosition
                : null
          });
    const next = applyRoomFinishDraftMutationV125(
      editorDocument,
      compiled
    );
    const semantic = roomFinishDraftReviewChange(next);
    if (!semantic) {
      throw new Error('WEP_ROOM_FINISH_PREVIEW_SEMANTIC_MISSING');
    }
    return {
      kind,
      compiled,
      next,
      semantic
    };
  }

  function previewRoomFinish(
    kind: 'FLOORING' | 'WALLPAPER'
  ) {
    try {
      roomFinishMode = kind;
      roomFinishPreview = buildRoomFinishPreview(kind);
      roomFinishStatus = '';
    } catch (error) {
      roomFinishPreview = null;
      roomFinishStatus =
        error instanceof Error ? error.message : String(error);
    }
  }

  function cancelRoomFinishPreview() {
    roomFinishPreview = null;
    roomFinishStatus = '';
  }

  function commitRoomFinishPreview() {
    if (!session || !roomFinishPreview || !roomFinishContextActive) return;
    try {
      const result = session.commitRoomFinishDraft({
        roomFinish: roomFinishPreview.next.roomFinish,
        reviewChange: roomFinishPreview.semantic,
        mutationSet: roomFinishPreview.compiled.mutationSet
      });
      roomFinishPreview = null;
      roomFinishStatus = roomFinishUi.draftAdded;
      finishDraftMutation(result, 'ROOM_FINISH');
    } catch (error) {
      roomFinishStatus =
        error instanceof Error ? error.message : String(error);
    }
  }

  function editorBlockerText(code: string) {
    return localizeWepBlocker(code, $locale).message;
  }

  function coreReasonText(code: string) {
    return localizeCoreReason(code, $locale);
  }

  function commandReasonText(command: string, state: any) {
    return localizeCommandReason(
      state?.reasonCode,
      String(state?.reason ?? ''),
      $locale
    );
  }

  function commandLabelText(command: string) {
    return localizeCommandLabel(command, command, $locale);
  }

  function validationGroupText(group: any) {
    return localizeValidationGroup(
      String(group?.id ?? ''),
      String(group?.label ?? ''),
      $locale
    );
  }

  function firstDraftBlocker(validation: any) {
    return validation?.issues?.find(
      (issue: any) => issue?.severity === 'BLOCK'
    ) ?? null;
  }

  function refreshDraftState() {
    if (!session) {
      draftValidation = null;
      draftSavePreparation = null;
      return;
    }
    draftValidation = session.getLastValidation?.() ?? null;
    draftSavePreparation = session.previewPersistentCommit?.() ?? null;
    if (verifiedExportReview) {
      verifiedExportReview = null;
      verifiedExportConfirmed = false;
      verifiedExportErrorCode = 'WEP_EXPORT_REVIEW_STALE';
      verifiedExportErrorDetail = '';
    }
  }

  function coreDraftGeometryAdapter(binding: any) {
    const service = binding?.adapter?.geometryService;
    const translate =
      binding?.adapter?.geometryAdapterForWep?.translate;
    if (
      !service ||
      typeof translate !== 'function' ||
      typeof service.rotateObjectInPlace !== 'function' ||
      typeof service.rotateSelectionLikeScene !== 'function'
    ) {
      throw new Error('WEP_WORLD_DRAFT_GEOMETRY_BINDING_UNAVAILABLE');
    }
    return {
      translate,
      rotateCardinal: (object: any, turns: number) =>
        service.rotateObjectInPlace(object, turns),
      rotateSelectionCardinal: (
        objects: any[],
        turns: number
      ) => service.rotateSelectionLikeScene(objects, turns),
      supportsCustomSelectionPivot: false
    };
  }

  function createSwitchDraftSession(
    document: any,
    recoverySnapshot: any = null
  ) {
    if (!switchWorldBinding || !placementLegalityBinding) {
      throw new Error('WEP_WORLD_DRAFT_CORE_BINDING_UNAVAILABLE');
    }
    return createEditorSession(document, {
      geometryAdapter: coreDraftGeometryAdapter(switchWorldBinding),
      validator:
        placementLegalityBinding.createEditorDraftValidator(),
      allowInvalidDraft: true,
      recoverySnapshot
    });
  }

  function recoveryTargetForCurrentSource() {
    if (!worldSource) return null;
    return {
      platform: String(worldSource.saveIdentity?.sourcePlatform ?? ''),
      gameVersion: String(worldSource.compatibility?.gameVersion ?? ''),
      profileSchemaVersion: Number(worldSource.profileSchemaVersion)
    };
  }

  function refreshRecoveryRecords() {
    try {
      recoveryRecords = listRecoveryRecords(localStorage);
      recoveryStatus = '';
    } catch (error) {
      recoveryRecords = [];
      recoveryStatus =
        error instanceof Error ? error.message : String(error);
    }
  }

  function checkpointRecovery() {
    if (
      !session ||
      !worldSource ||
      !worldSourceBytes ||
      !sourceFingerprint ||
      typeof session.exportRecoverySnapshot !== 'function'
    ) {
      return;
    }
    const history = session.getHistoryState?.();
    if (!history || Number(history.undoDepth ?? 0) <= 0) return;
    const target = recoveryTargetForCurrentSource();
    if (!target) return;
    try {
      const record = saveRecoveryRoute(localStorage, {
        sourceFingerprint,
        sourceName: fileName || null,
        target,
        routeKey: routeKeyForDocument(session.getDocument()),
        sessionSnapshot: session.exportRecoverySnapshot()
      });
      setActiveWorldEditorDraftRecord(record);
      refreshRecoveryRecords();
    } catch (error) {
      recoveryStatus =
        error instanceof Error ? error.message : String(error);
    }
  }

  function rememberActiveDraftInMemory() {
    if (
      !session ||
      !worldSource ||
      !worldSourceBytes ||
      !sourceFingerprint ||
      typeof session.exportRecoverySnapshot !== 'function'
    ) {
      return;
    }
    const target = recoveryTargetForCurrentSource();
    if (!target) return;
    const snapshot = session.exportRecoverySnapshot();
    const routeKey = routeKeyForDocument(session.getDocument());
    const memory = getActiveWorldEditorMemory();
    const existing =
      memory?.activeDraftRecord &&
      memory.activeDraftRecord.sourceFingerprint === sourceFingerprint
        ? memory.activeDraftRecord
        : null;
    const record = createRecoveryRecord({
      sourceFingerprint,
      sourceName: fileName || null,
      target,
      routeKey,
      sessionSnapshot: snapshot,
      existing
    });
    setActiveWorldEditorDraftRecord(record);
  }

    async function ensureSwitchDraftBindings() {
    switchWorldBinding ??= await createSwitchWorldReadAdapter({
      basePath: base
    });
    placementLegalityBinding ??=
      await createSwitchV125PlacementLegalityBinding({
        basePath: base
      });
    buildingV110Binding ??=
      await createSwitchV125BuildingBinding({
        basePath: base
      });
    scroogeStoreV112Binding ??=
      await createSwitchV125ScroogeStoreBinding({
        basePath: base
      });
    progressionV114Binding ??=
      await createSwitchV125ProgressionIntegrationBinding({
        basePath: base
      });
  }

  async function restoreRecoveryRecord(
    record: any,
    memory = getActiveWorldEditorMemory()
  ) {
    if (!record || !memory) {
      recoveryRequest = record;
      saveFileInput?.click();
      return false;
    }
    const memoryWorldSource: any = memory.worldSource;
    const target = {
      platform: String(memoryWorldSource?.saveIdentity?.sourcePlatform ?? ''),
      gameVersion: String(memoryWorldSource?.compatibility?.gameVersion ?? ''),
      profileSchemaVersion: Number(memoryWorldSource?.profileSchemaVersion)
    };
    if (
      memory.sourceFingerprint !== record.sourceFingerprint ||
      !recoveryCompatible(record, memory.sourceFingerprint, target)
    ) {
      recoveryRequest = record;
      saveFileInput?.click();
      return false;
    }
    if (target.platform !== 'switch') {
      throw new Error('WEP_RECOVERY_SWITCH_DRAFT_REQUIRED');
    }

    await ensureSwitchDraftBindings();
    const route =
      record.routes?.[record.activeRouteKey] ?? null;
    if (!route?.session?.document) {
      throw new Error('WEP_RECOVERY_ACTIVE_ROUTE_MISSING');
    }

    worldSource = memory.worldSource;
    worldSourceBytes = memory.sourceBytes.slice();
    originalSaveBackup = memory.originalSaveBackup;
    sourceFingerprint = memory.sourceFingerprint;
    fileName = record.sourceName ?? fileName;
    sourcePlatform = target.platform;
    const recoveredDocument =
      normalizeEditorDocument(route.session.document);
    const firstHistory =
      route.session.undoStack?.[0] ?? null;
    verifiedExportBaselineDocument = normalizeEditorDocument(
      firstHistory?.before ?? recoveredDocument
    );
    session = createSwitchDraftSession(
      recoveredDocument,
      route.session
    );
    editorDocument = session.getDocument();
    draftAuthoringBound = true;
    layerState = createLayerState({
      capabilities: editorDocument.capabilities
    });
    areaBounds = deriveAreaBounds(editorDocument);
    query = '';
    selectedOnly = false;
    capturePreview = null;
    published = null;
    verifiedExportReview = null;
    verifiedExportResult = null;
    verifiedExportErrorCode = '';
    verifiedExportErrorDetail = '';
    verifiedExportConfirmed = false;
    fullDesignRootDocuments = [cloneLocal(verifiedExportBaselineDocument)];
    fullDesignSourceRootGridId =
      Number.isSafeInteger(Number(editorDocument.target?.rootGridId))
        ? Number(editorDocument.target.rootGridId)
        : null;
    refreshProjection();
    refreshDraftState();
    syncRoadFenceSelection();
    rememberActiveDraftInMemory();
    recoveryRequest = null;
    recoveryStatus = '';
    message = stage1Copy.recovered;
    return true;
  }

  async function resumeRecovery(record: any) {
    try {
      if (await restoreRecoveryRecord(record)) return;
      recoveryStatus = stage1Copy.sourceNeeded;
    } catch (error) {
      recoveryStatus =
        error instanceof Error ? error.message : String(error);
    }
  }

  function cloneLocal<T>(value: T): T {
    return structuredClone(value);
  }

  function currentFullDesignDocuments() {
    if (!fullDesignRootDocuments.length) return [];
    const currentPath = String(
      session?.getDocument?.()?.target?.gridDataPath ?? ''
    );
    const currentDocument =
      session && currentPath ? session.getDocument() : null;
    return fullDesignRootDocuments.map((document: any) =>
      currentDocument &&
      String(document?.target?.gridDataPath ?? '') === currentPath
        ? cloneLocal(currentDocument)
        : cloneLocal(document)
    );
  }

  function rebuildFullDesignPlan() {
    if (
      !worldSource ||
      fullDesignSourceRootGridId === null ||
      !fullDesignRootDocuments.length
    ) {
      return;
    }
    try {
      fullDesignPlan = buildCurrentV125FullDesignCapturePlan({
        profile: worldSource.profile,
        rootGridId: fullDesignSourceRootGridId,
        sourcePlatform: worldSource.saveIdentity.sourcePlatform,
        rootEditorDocuments: currentFullDesignDocuments(),
        buildingBinding: buildingV110Binding
      });
      fullDesignPlanError = '';
    } catch (error) {
      fullDesignPlan = null;
      fullDesignPlanError =
        error instanceof Error ? error.message : String(error);
    }
    resetFullDesignDestination();
  }

  function networkContainer(kind: 'road' | 'fence') {
    const key = kind === 'road' ? 'roads' : 'fences';
    const current = editorDocument?.networks?.[key];
    if (current) return cloneLocal(current);

    if (editorDocument?.target?.platform === 'Nintendo Switch') {
      return {
        schema: 'dreamwish-wand-wep-roadfence-logical-root-draft',
        version: 1,
        kind: key,
        originPolicy: 'native-logical-root',
        coordinatePolicy: 'per-network-reader-coordinate-space',
        networks: [],
        normalization: {
          sourceGridObjectIdsRemoved: true,
          sourceReaderProvenanceRemoved: true,
          logicalCoordinatesPreserved: true,
          coordinateSpacePreserved: true,
          partialTopologyFailsClosed: true
        },
        persistentWriteAuthorized: false
      };
    }

    return {
      schema: 'dreamwish-wand-wep-network-capture',
      version: 1,
      kind: key,
      originPolicy: 'root-grid-top-left',
      networks: [],
      normalization: {
        sourceGridObjectIdsRemoved: true,
        artifactNetworkIdsLocal: true,
        partialTopologyFailsClosed: true
      },
      persistentWriteAuthorized: false
    };
  }

  function roadFenceNetworks(kind: 'road' | 'fence' = rfKind) {
    const container = networkContainer(kind);
    return Array.isArray(container?.networks)
      ? container.networks
      : [];
  }

  function currentRoadFenceNetwork() {
    return roadFenceNetworks().find(
      (network: any) =>
        String(network.networkId) === String(rfNetworkId)
    ) ?? null;
  }

  function syncRoadFenceSelection({
    preferKind = rfKind
  }: {
    preferKind?: 'road' | 'fence';
  } = {}) {
    const preferred = roadFenceNetworks(preferKind);
    const otherKind = preferKind === 'road' ? 'fence' : 'road';
    const available = preferred.length
      ? { kind: preferKind, networks: preferred }
      : {
          kind: otherKind as 'road' | 'fence',
          networks: roadFenceNetworks(otherKind)
        };
    if (!available.networks.length) {
      rfNetworkId = '';
      rfFamilyBaseItemID = 0;
      rfTargetFamilyBaseItemID = 0;
      rfSeedNodeId = '';
      rfAdjacentNodeId = '';
      return;
    }
    rfKind = available.kind;
    const exists = available.networks.some(
      (network: any) =>
        String(network.networkId) === String(rfNetworkId)
    );
    const network = exists
      ? available.networks.find(
          (entry: any) =>
            String(entry.networkId) === String(rfNetworkId)
        )
      : available.networks[0];
    rfNetworkId = String(network.networkId);
    rfFamilyBaseItemID = Number(network.familyBaseItemID ?? 0);
    rfTargetFamilyBaseItemID = Number(
      network.familyBaseItemID ?? 0
    );
    if (rfKind === 'fence') {
      rfMode = String(network.mode ?? 'orthogonal');
      const nodes = network.graph?.nodes ?? [];
      rfSeedNodeId = String(nodes[0]?.id ?? '');
      rfAdjacentNodeId = String(
        network.graph?.edges?.find(
          (edge: any) =>
            edge.a === rfSeedNodeId ||
            edge.b === rfSeedNodeId
        )
          ? (() => {
              const edge = network.graph.edges.find(
                (entry: any) =>
                  entry.a === rfSeedNodeId ||
                  entry.b === rfSeedNodeId
              );
              return edge?.a === rfSeedNodeId
                ? edge?.b
                : edge?.a;
            })()
          : ''
      );
    } else {
      const cell = network.cells?.[0];
      rfMode = String(cell?.mode ?? 'orthogonal');
      rfSeedX = Number(cell?.x ?? 0);
      rfSeedY = Number(cell?.y ?? 0);
    }
  }

  function roadFenceCoordinateSpaceForDraw(
    kind: 'road' | 'fence',
    familyBaseItemID: number
  ) {
    const matching = roadFenceNetworks(kind).find(
      (network: any) =>
        Number(network.familyBaseItemID) === familyBaseItemID &&
        network.coordinateSpace
    );
    if (matching?.coordinateSpace) {
      return cloneLocal(matching.coordinateSpace);
    }

    if (editorDocument?.target?.platform === 'synthetic') {
      return {
        unit: kind === 'road' ? 'road-cell' : 'fence-logical-unit',
        savePitch: 1,
        saveResidueX: 0,
        saveResidueY: 0
      };
    }

    throw new Error('WEP_ROADFENCE_DRAFT_LATTICE_UNRESOLVED');
  }

  function parseRfPoints() {
    const points = rfPoints
      .split(';')
      .map((entry) => entry.trim())
      .filter(Boolean)
      .map((entry) => {
        const parts = entry.split(',').map((part) => Number(part.trim()));
        if (
          parts.length !== 2 ||
          !parts.every(Number.isSafeInteger)
        ) {
          throw new Error('WEP_ROADFENCE_POINT_LIST_INVALID');
        }
        return { x: parts[0], y: parts[1] };
      });
    if (points.length < 2) {
      throw new Error('WEP_ROADFENCE_POINT_LIST_TOO_SHORT');
    }
    return points;
  }

  function replaceRoadFenceNetwork(
    kind: 'road' | 'fence',
    network: any,
    command: string,
    validation: any
  ) {
    if (!session) return null;
    const key = kind === 'road' ? 'roads' : 'fences';
    const container = networkContainer(kind);
    const networks = [...(container.networks ?? [])];
    const index = networks.findIndex(
      (entry: any) =>
        String(entry.networkId) === String(network.networkId)
    );
    if (index >= 0) networks[index] = cloneLocal(network);
    else networks.push(cloneLocal(network));
    container.networks = networks;
    if (kind === 'fence') {
      delete container.modeBoundaryTouches;
      container.modeBoundaryTouchesInvalidated = true;
      if (container.representationLayouts) {
        const layouts = {
          ...container.representationLayouts
        };
        delete layouts[String(network.networkId)];
        container.representationLayouts = layouts;
      }
      if (container.representationLayoutModified) {
        const modified = {
          ...container.representationLayoutModified
        };
        delete modified[String(network.networkId)];
        container.representationLayoutModified = modified;
      }
      container.representationLayoutInvalidated = {
        ...(container.representationLayoutInvalidated ?? {}),
        [String(network.networkId)]: true
      };
    }
    container.persistentWriteAuthorized = false;

    const result = session.replaceNetworkDraft(
      key,
      container,
      {
        command,
        validation: {
          ...cloneLocal(validation),
          persistentWriteAuthorized: false
        }
      }
    );
    lastDraftCommand = command;
    refreshProjection();
    refreshDraftState();
    rebuildFullDesignPlan();
    syncRoadFenceSelection({ preferKind: kind });
    if (kind === 'fence') {
      syncFencePostDraftFromDocument();
    }
    if (result?.applied) checkpointRecovery();
    return result;
  }

  function nextRoadFenceDraftId(kind: 'road' | 'fence') {
    const prefix = kind === 'road' ? 'draft-r' : 'draft-f';
    const ids = new Set(
      roadFenceNetworks(kind).map((network: any) =>
        String(network.networkId)
      )
    );
    let index = 0;
    while (ids.has(`${prefix}${index}`)) index += 1;
    return `${prefix}${index}`;
  }

  function drawRoadFenceDraft() {
    if (!session || !mutationBound) return;
    try {
      const familyBaseItemID = Number(rfFamilyBaseItemID);
      if (!Number.isSafeInteger(familyBaseItemID) || familyBaseItemID <= 0) {
        throw new Error('WEP_ROADFENCE_FAMILY_REQUIRED');
      }
      const points = parseRfPoints();
      const networkId = nextRoadFenceDraftId(rfKind);
      let preview: any;
      if (rfTool === 'rectangle') {
        const xs = points.map((point) => point.x);
        const ys = points.map((point) => point.y);
        const bounds = {
          minX: Math.min(...xs),
          minY: Math.min(...ys),
          maxX: Math.max(...xs),
          maxY: Math.max(...ys)
        };
        preview =
          rfKind === 'road'
            ? previewRoadRectangleOutline(bounds)
            : previewFenceRectangleOutline(bounds);
      } else {
        preview =
          rfKind === 'road'
            ? previewRoadPolyline(points)
            : previewFencePolyline(points, rfMode);
      }

      const coordinateSpace =
        roadFenceCoordinateSpaceForDraw(
          rfKind,
          familyBaseItemID
        );
      const network =
        rfKind === 'road'
          ? {
              networkId,
              kind: 'road',
              familyBaseItemID,
              coordinateSpace,
              cells: cloneLocal(preview.cells ?? []),
              logicalQuantity: Number(
                preview.cells?.length ?? 0
              ),
              persistentWriteAuthorized: false
            }
          : {
              networkId,
              kind: 'fence',
              familyBaseItemID,
              mode: rfMode,
              coordinateSpace,
              graph: cloneLocal(preview.graph ?? {}),
              logicalQuantity: Number(
                preview.graph?.nodes?.length ?? 0
              ),
              persistentWriteAuthorized: false
            };
      const validation = {
        ok:
          rfKind === 'road'
            ? Array.isArray(network.cells) &&
              network.cells.length > 0
            : preview.compiled?.ok === true,
        issues: cloneLocal(preview.errors ?? []),
        status: 'MODEL_PREVIEW',
        persistentWriteAuthorized: false
      };
      const result = replaceRoadFenceNetwork(
        rfKind,
        network,
        rfKind === 'road'
          ? 'ROAD_TOPOLOGY_DRAW'
          : 'FENCE_TOPOLOGY_DRAW',
        validation
      );
      rfNetworkId = networkId;
      rfPreview = preview;
      rfMessage = result?.applied
        ? t('worldEditor.fence.networkCreated', {}, $locale)
        : t('worldEditor.fence.networkBlocked', {}, $locale);
    } catch (error) {
      rfMessage =
        error instanceof Error ? error.message : String(error);
    }
  }

  function previewRoadFenceConnected() {
    const network = currentRoadFenceNetwork();
    if (!network) return;
    try {
      rfPreview =
        rfKind === 'road'
          ? previewConnectedSelection({
              kind: 'road',
              source: { cells: network.cells ?? [] },
              seed: { x: Number(rfSeedX), y: Number(rfSeedY) }
            })
          : previewConnectedSelection({
              kind: 'fence',
              source: { graph: network.graph ?? {} },
              seed: rfSeedNodeId
            });
      rfMessage = rfPreview.ok
        ? t(
            'worldEditor.fence.connectedSelection',
            {
              count:
                rfPreview.logicalQuantity ??
                rfPreview.cells?.length ??
                0
            },
            $locale
          )
        : t('worldEditor.fence.connectedBlocked', {}, $locale);
    } catch (error) {
      rfMessage =
        error instanceof Error ? error.message : String(error);
    }
  }

  function previewFenceSegment() {
    if (rfKind !== 'fence') return;
    const network = currentRoadFenceNetwork();
    if (!network) return;
    try {
      rfPreview = previewFenceBranchSelection({
        graph: network.graph ?? {},
        seedNodeId: rfSeedNodeId,
        adjacentNodeId: rfAdjacentNodeId
      });
      rfMessage = rfPreview.ok
        ? t(
            'worldEditor.fence.segmentSelection',
            { count: rfPreview.logicalQuantity },
            $locale
          )
        : t('worldEditor.fence.segmentBlocked', {}, $locale);
    } catch (error) {
      rfMessage =
        error instanceof Error ? error.message : String(error);
    }
  }

  function eyedropRoadFence() {
    const network = currentRoadFenceNetwork();
    if (!network) return;
    try {
      const sample =
        rfKind === 'road'
          ? sampleRoadEyedropper(
              { ...network, kind: 'road' },
              { x: Number(rfSeedX), y: Number(rfSeedY) }
            )
          : sampleFenceEyedropper(
              { ...network, kind: 'fence' },
              rfSeedNodeId
            );
      rfPreview = sample;
      if (sample.ok) {
        rfFamilyBaseItemID = Number(sample.familyBaseItemID);
        rfTargetFamilyBaseItemID = Number(sample.familyBaseItemID);
        rfMode = String(sample.mode ?? rfMode);
      }
      rfMessage = sample.ok
        ? t('worldEditor.fence.eyedropperLoaded', {}, $locale)
        : t('worldEditor.fence.eyedropperBlocked', {}, $locale);
    } catch (error) {
      rfMessage =
        error instanceof Error ? error.message : String(error);
    }
  }

  function replaceRoadFenceStyle() {
    const network = currentRoadFenceNetwork();
    if (!network || !session) return;
    try {
      const targetFamilyBaseItemID = Number(
        rfTargetFamilyBaseItemID
      );
      if (
        !Number.isSafeInteger(targetFamilyBaseItemID) ||
        targetFamilyBaseItemID <= 0
      ) {
        throw new Error('WEP_ROADFENCE_TARGET_FAMILY_REQUIRED');
      }
      const preview =
        rfKind === 'road'
          ? previewRoadStyleReplace({
              cells: network.cells ?? [],
              seedCoordinate: {
                x: Number(rfSeedX),
                y: Number(rfSeedY)
              },
              sourceFamilyBaseItemID:
                Number(network.familyBaseItemID),
              targetFamilyBaseItemID
            })
          : previewFenceStyleReplace({
              graph: network.graph ?? {},
              seedNodeId: rfSeedNodeId,
              sourceFamilyBaseItemID:
                Number(network.familyBaseItemID),
              targetFamilyBaseItemID
            });
      rfPreview = preview;
      if (!preview.ok) {
        rfMessage = t('worldEditor.fence.stylePreviewBlocked', {}, $locale);
        return;
      }
      const next = {
        ...cloneLocal(network),
        familyBaseItemID: targetFamilyBaseItemID
      };
      const result = replaceRoadFenceNetwork(
        rfKind,
        next,
        rfKind === 'road'
          ? 'ROAD_STYLE_REPLACE'
          : 'FENCE_STYLE_REPLACE',
        {
          ok: true,
          issues: [],
          status: 'MODEL_PREVIEW',
          persistentWriteAuthorized: false
        }
      );
      rfFamilyBaseItemID = targetFamilyBaseItemID;
      rfMessage = result?.applied
        ? t('worldEditor.fence.styleStored', {}, $locale)
        : t('worldEditor.fence.styleBlocked', {}, $locale);
    } catch (error) {
      rfMessage =
        error instanceof Error ? error.message : String(error);
    }
  }

  function deleteRoadFenceUnit() {
    const network = currentRoadFenceNetwork();
    if (!network) return;
    try {
      const preview =
        rfKind === 'road'
          ? previewRoadCellDelete({
              cells: network.cells ?? [],
              coordinates: [
                { x: Number(rfSeedX), y: Number(rfSeedY) }
              ]
            })
          : previewFenceSegmentDelete({
              graph: network.graph ?? {},
              nodeIds: [rfSeedNodeId]
            });
      rfPreview = preview;
      if (!preview.ok) {
        rfMessage = t('worldEditor.fence.deletePreviewBlocked', {}, $locale);
        return;
      }
      const next =
        rfKind === 'road'
          ? {
              ...cloneLocal(network),
              cells: cloneLocal(preview.cells ?? [])
            }
          : {
              ...cloneLocal(network),
              graph: cloneLocal(preview.graph ?? {})
            };
      const result = replaceRoadFenceNetwork(
        rfKind,
        next,
        rfKind === 'road'
          ? 'ROAD_TOPOLOGY_DELETE'
          : 'FENCE_TOPOLOGY_DELETE_SPLIT',
        {
          ok: true,
          issues: cloneLocal(preview.errors ?? []),
          status: 'MODEL_PREVIEW',
          persistentWriteAuthorized: false
        }
      );
      rfMessage = result?.applied
        ? t('worldEditor.fence.deleteStored', {}, $locale)
        : t('worldEditor.fence.deleteBlocked', {}, $locale);
    } catch (error) {
      rfMessage =
        error instanceof Error ? error.message : String(error);
    }
  }

  function transformRoadFenceDraft() {
    const network = currentRoadFenceNetwork();
    if (!network) return;
    try {
      const options = {
        translateX: Number(rfTranslateX),
        translateY: Number(rfTranslateY),
        rotateQuarterTurns: Number(rfRotateQuarterTurns)
      };
      const preview =
        rfKind === 'road'
          ? previewRoadTransform(
              network.cells ?? [],
              options
            )
          : previewFenceTransform(
              network.graph ?? {},
              options
            );
      rfPreview = preview;
      if (!preview.ok) {
        rfMessage = t('worldEditor.fence.transformPreviewBlocked', {}, $locale);
        return;
      }
      const next =
        rfKind === 'road'
          ? {
              ...cloneLocal(network),
              cells: cloneLocal(preview.cells ?? [])
            }
          : {
              ...cloneLocal(network),
              graph: cloneLocal(preview.graph ?? {})
            };
      const result = replaceRoadFenceNetwork(
        rfKind,
        next,
        rfKind === 'road'
          ? 'ROAD_TOPOLOGY_TRANSFORM'
          : 'FENCE_TOPOLOGY_TRANSFORM',
        {
          ok: true,
          issues: cloneLocal(preview.errors ?? []),
          status: 'MODEL_PREVIEW',
          persistentWriteAuthorized: false
        }
      );
      rfMessage = result?.applied
        ? t('worldEditor.fence.transformStored', {}, $locale)
        : t('worldEditor.fence.transformBlocked', {}, $locale);
    } catch (error) {
      rfMessage =
        error instanceof Error ? error.message : String(error);
    }
  }

  function fullDesignCategoryLabel(key: string) {
    const messageKey = ({
      directGrids: 'worldEditor.fullDesign.category.directRoots',
      rootObjects: 'worldEditor.fullDesign.category.placedObjects',
      roads: 'worldEditor.fullDesign.category.roads',
      fences: 'worldEditor.fullDesign.category.fences',
      buildings: 'worldEditor.fullDesign.category.buildings',
      environment: 'worldEditor.fullDesign.category.environment'
    } as Record<string, string>)[key];
    return messageKey ? t(messageKey, {}, $locale) : key;
  }

  function fullDesignCategoryEntries(plan: any): Array<[string, any]> {
    return Object.entries(plan?.categories ?? {}) as Array<[string, any]>;
  }

  function fullDesignDispositionLabel(value: any) {
    if (value?.disposition === 'captured_partial') {
      return t('worldEditor.fullDesign.disposition.partial', {}, $locale);
    }
    if (value?.disposition === 'blocked') {
      return t('worldEditor.fullDesign.blocked', {}, $locale);
    }
    if (value?.disposition === 'excluded') {
      return t('worldEditor.fullDesign.disposition.excluded', {}, $locale);
    }
    return value?.disposition
      ? String(value.disposition)
      : t('worldEditor.fullDesign.disposition.unknown', {}, $locale);
  }

  function fullDesignBlockerText(code: string) {
    return localizeWepBlocker(code, $locale).message;
  }

  function fullDesignCategoryDetail(
    categoryKey: string,
    category: any
  ) {
    if (categoryKey === 'rootObjects') {
      const count = Number(category?.directRootObjectCount ?? 0);
      const portable = Number(
        category?.portableComposition?.entries?.length ?? 0
      );
      const unresolved = Number(
        category?.portableComposition?.unresolved?.length ?? 0
      );
      const missing = Number(
        category?.portableComposition?.missingRoutes?.length ?? 0
      );
      return category?.portableComposition
        ? t(
            'worldEditor.fullDesign.rootObjectsDetail',
            { count, portable, unresolved, missing },
            $locale
          )
        : t(
            'worldEditor.fullDesign.rootObjectsOnly',
            { count },
            $locale
          );
    }
    if (categoryKey === 'roads' || categoryKey === 'fences') {
      const coverage = Array.isArray(category?.readerCoverage)
        ? category.readerCoverage
        : [];
      if (!coverage.length) return '';
      const supported = coverage.filter(
        (entry: any) => entry?.status === 'supported'
      ).length;
      const networks = coverage.reduce(
        (sum: number, entry: any) =>
          sum +
          Number(
            categoryKey === 'roads'
              ? entry?.roadNetworkCount ?? 0
              : entry?.fenceNetworkCount ?? 0
          ),
        0
      );
      return t(
        'worldEditor.fullDesign.networkCoverage',
        { supported, total: coverage.length, networks },
        $locale
      );
    }
    if (categoryKey === 'buildings') {
      const ordinary = category?.ordinaryPlacement;
      const skins = Number(category?.buildingSkins?.entries?.length ?? 0);
      const houses = Number(category?.playerHouses?.entries?.length ?? 0);
      if (ordinary?.destinationPlacementStatus === 'NOT_APPLICABLE') {
        return t(
          'worldEditor.fullDesign.noBuilding',
          { skins, houses },
          $locale
        );
      }
      return t(
        'worldEditor.fullDesign.buildingDetail',
        {
          count: Number(ordinary?.recognizedCount ?? 0),
          status: String(
            ordinary?.destinationPlacementStatus ?? 'UNKNOWN'
          ).toLowerCase(),
          skins,
          houses
        },
        $locale
      );
    }
    if (categoryKey === 'environment' && category?.portableState) {
      return t(
        'worldEditor.fullDesign.codec',
        { codec: category.portableState.codec },
        $locale
      );
    }
    return '';
  }

  function resetRoadFenceCapture() {
    roadFenceReaderBinding = null;
    roadFenceSceneCaptureAdapter = null;
    roadFenceRootDraft = null;
    includeRoads = false;
    includeFences = false;
    captureRegionMode = 'selection';
    captureRegionX = 0;
    captureRegionY = 0;
    captureRegionW = 1;
    captureRegionH = 1;
    fencePostNetworks = [];
    fencePostSelectedNetworkId = '';
    fencePostDraft = null;
    fencePostValidation = null;
    fencePostMoveNodeId = '';
    fencePostEditX = 0;
    fencePostEditY = 0;
    fencePostMessage = '';
  }

  function fenceRepresentationModelFromDocument(
    networkId: string
  ) {
    const model =
      editorDocument?.networks?.fences
        ?.representationLayouts?.[String(networkId)];
    return model ? cloneLocal(model) : null;
  }

  function syncFencePostDraftFromDocument() {
    if (!fencePostSelectedNetworkId) return;
    const model = fenceRepresentationModelFromDocument(
      fencePostSelectedNetworkId
    );
    if (!model) {
      fencePostDraft = null;
      fencePostValidation = null;
      fencePostMoveNodeId = '';
      return;
    }
    fencePostDraft = model;
    fencePostValidation =
      validateFencePostLayoutDraft(model);
    const first =
      fencePostDraft.representationLayout?.posts?.[0];
    if (first) {
      fencePostMoveNodeId = String(first.nodeId);
      fencePostEditX = Number(first.x);
      fencePostEditY = Number(first.y);
    } else {
      fencePostMoveNodeId = '';
    }
  }

  function loadFencePostDraft(networkId: string) {
    fencePostSelectedNetworkId = networkId;
    fencePostDraft = null;
    fencePostValidation = null;
    fencePostMoveNodeId = '';
    fencePostMessage = '';
    try {
      const stored =
        fenceRepresentationModelFromDocument(networkId);
      const fenceContainer =
        editorDocument?.networks?.fences;
      if (stored) {
        fencePostDraft = stored;
        fencePostValidation =
          validateFencePostLayoutDraft(stored);
      } else if (
        fenceContainer?.schema ===
        'dreamwish-wand-wep-roadfence-logical-root-draft'
      ) {
        if (
          fenceContainer
            ?.representationLayoutInvalidated
            ?.[String(networkId)] === true
        ) {
          throw new Error(
            'WEP_FENCE_REPRESENTATION_LAYOUT_INVALIDATED'
          );
        }
        const unavailable =
          fenceContainer
            ?.representationLayoutUnavailable
            ?.[String(networkId)];
        throw new Error(
          String(
            unavailable ??
              'WEP_FENCE_POST_DRAFT_UNAVAILABLE'
          )
        );
      } else {
        const result =
          roadFenceReaderBinding?.fenceRepresentationLayout
            ?.captureModel(networkId);
        if (!result?.draft) {
          throw new Error(
            result?.code ??
              'WEP_FENCE_POST_DRAFT_UNAVAILABLE'
          );
        }
        fencePostDraft = result.draft;
        fencePostValidation = result.validation;
      }
      const first =
        fencePostDraft.representationLayout?.posts?.[0];
      if (first) {
        fencePostMoveNodeId = String(first.nodeId);
        fencePostEditX = Number(first.x);
        fencePostEditY = Number(first.y);
      }
    } catch (error) {
      fencePostMessage =
        error instanceof Error ? error.message : String(error);
    }
  }

  function commitFencePostDraft(result: any, label: string) {
    if (!result?.draft || !result?.validation) {
      fencePostMessage =
        'WEP_FENCE_POST_EDIT_RESULT_INVALID';
      return;
    }

    const firstIssue =
      result?.issues?.[0]?.code ??
      result?.validation?.issues?.[0]?.code ??
      null;
    if (
      result.accepted === false ||
      !result.validation.ok
    ) {
      fencePostValidation = result.validation;
      fencePostMessage = t(
        'worldEditor.fence.editBlocked',
        {
          operation: label,
          detail: firstIssue ?? 'representation validation'
        },
        $locale
      );
      return;
    }
    if (
      !session ||
      !fencePostSelectedNetworkId
    ) {
      fencePostMessage =
        'WEP_FENCE_POST_EDITOR_SESSION_REQUIRED';
      return;
    }

    const container = networkContainer('fence');
    container.representationLayouts = {
      ...(container.representationLayouts ?? {}),
      [fencePostSelectedNetworkId]:
        cloneLocal(result.draft)
    };
    container.representationLayoutModified = {
      ...(container.representationLayoutModified ?? {}),
      [fencePostSelectedNetworkId]: true
    };
    container.persistentWriteAuthorized = false;

    const transaction = session.replaceNetworkDraft(
      'fences',
      container,
      {
        command: 'FENCE_REPRESENTATION_LAYOUT_EDIT',
        validation: {
          ok: true,
          issues: [],
          status: 'REPRESENTATION_LAYOUT_PREVIEW',
          persistentWriteAuthorized: false
        }
      }
    );
    if (!transaction?.applied) {
      fencePostMessage =
        'WEP_FENCE_POST_EDIT_TRANSACTION_REJECTED';
      return;
    }

    lastDraftCommand =
      'FENCE_REPRESENTATION_LAYOUT_EDIT';
    capturePreview = null;
    published = null;
    refreshProjection();
    refreshDraftState();
    syncFencePostDraftFromDocument();
    rebuildFullDesignPlan();
    fencePostMessage = t(
      'worldEditor.fence.editPass',
      { operation: label },
      $locale
    );
  }

  function insertFencePostDraft() {
    if (!fencePostDraft) return;
    try {
      commitFencePostDraft(
        insertFencePost(
          fencePostDraft,
          Number(fencePostEditX),
          Number(fencePostEditY)
        ),
        t('worldEditor.fence.insertPost', {}, $locale)
      );
    } catch (error) {
      fencePostMessage =
        error instanceof Error ? error.message : String(error);
    }
  }

  function moveFencePostDraft() {
    if (!fencePostDraft || !fencePostMoveNodeId) return;
    try {
      commitFencePostDraft(
        moveFencePost(
          fencePostDraft,
          fencePostMoveNodeId,
          Number(fencePostEditX),
          Number(fencePostEditY)
        ),
        t('worldEditor.fence.movePost', {}, $locale)
      );
    } catch (error) {
      fencePostMessage =
        error instanceof Error ? error.message : String(error);
    }
  }

  function removeFencePostDraft(nodeId: string) {
    if (!fencePostDraft) return;
    try {
      commitFencePostDraft(
        removeFencePost(fencePostDraft, nodeId),
        t('worldEditor.fence.removePost', {}, $locale)
      );
    } catch (error) {
      fencePostMessage =
        error instanceof Error ? error.message : String(error);
    }
  }

  function toggleFencePostPinned(nodeId: string, pinned: boolean) {
    if (!fencePostDraft) return;
    try {
      commitFencePostDraft(
        setFencePostPinned(fencePostDraft, nodeId, pinned),
        pinned
          ? t('worldEditor.fence.pinPost', {}, $locale)
          : t('worldEditor.fence.unpinPost', {}, $locale)
      );
    } catch (error) {
      fencePostMessage =
        error instanceof Error ? error.message : String(error);
    }
  }

  function autoLayoutFencePosts() {
    if (!fencePostDraft) return;
    try {
      commitFencePostDraft(
        applyFencePostAutoLayout(
          fencePostDraft,
          FENCE_POST_AUTO_LAYOUT.CENTERED_BALANCED
        ),
        t('worldEditor.fence.centeredAutoLayout', {}, $locale)
      );
    } catch (error) {
      fencePostMessage =
        error instanceof Error ? error.message : String(error);
    }
  }

  function resetFullDesignDestination() {
    fullDesignDestinationFileName = '';
    fullDesignDestinationPreflight = null;
    fullDesignDestinationError = '';
    fullDesignDestinationLoading = false;
  }

  function resetFloatingIslandPlan() {
    floatingIslandPlan = null;
    floatingIslandPlanError = '';
  }

  function floatingIslandObjectCount(island: any) {
    return Array.isArray(island?.roots)
      ? island.roots.reduce(
          (sum: number, root: any) =>
            sum + Number(root?.objectCount ?? 0),
          0
        )
      : 0;
  }

  function previewFloatingIslandPlan(island: any) {
    resetFloatingIslandPlan();
    if (!worldSource) return;
    if (worldSource.saveIdentity.sourcePlatform !== 'switch') {
      floatingIslandPlanError =
        'FLOATING_ISLAND_SWITCH_SOURCE_CONTRACT_REQUIRED';
      return;
    }
    const firstRoot = island?.roots?.[0];
    if (!firstRoot) {
      floatingIslandPlanError =
        'FLOATING_ISLAND_DIRECT_ROOT_REQUIRED';
      return;
    }
    try {
      floatingIslandPlan = buildCurrentV125FullDesignCapturePlan({
        profile: worldSource.profile,
        rootGridId: Number(firstRoot.gridId),
        sourcePlatform: worldSource.saveIdentity.sourcePlatform,
        buildingBinding: buildingV110Binding
      });
    } catch (error) {
      floatingIslandPlanError =
        error instanceof Error ? error.message : String(error);
    }
  }

  function fullDesignDestinationStatus(preflight: any) {
    if (!preflight) {
      return t('worldEditor.fullDesign.notChecked', {}, $locale);
    }
    if (!preflight.manifestValid) {
      return t('worldEditor.fullDesign.manifestBlocked', {}, $locale);
    }
    if (!preflight.destinationPreflightReady) {
      return t('worldEditor.fullDesign.destinationBlocked', {}, $locale);
    }
    if (!preflight.categoryClosureReady) {
      return t(
        'worldEditor.fullDesign.destinationResolvedProductBlocked',
        {},
        $locale
      );
    }
    return t('worldEditor.fullDesign.futureApplyReady', {}, $locale);
  }

  function fullDesignNativePlacementSummary(preflight: any) {
    const bindings =
      preflight?.destination?.rootObjectRouteBindings ?? [];
    const counts = {
      clear: 0,
      replaces: 0,
      invalid: 0,
      unknown: 0
    };
    for (const entry of bindings) {
      if (
        entry?.nativePlacementClass ===
        NATIVE_PLACEMENT_CLASSES.VALID_CLEAR
      ) counts.clear += 1;
      else if (
        entry?.nativePlacementClass ===
        NATIVE_PLACEMENT_CLASSES
          .VALID_REPLACES_OR_REMOVES_EXISTING
      ) counts.replaces += 1;
      else if (
        entry?.nativePlacementClass ===
        NATIVE_PLACEMENT_CLASSES.INVALID
      ) counts.invalid += 1;
      else if (
        entry?.nativePlacementClass ===
        NATIVE_PLACEMENT_CLASSES.UNKNOWN
      ) counts.unknown += 1;
    }
    return t(
      'worldEditor.fullDesign.nativePlacementSummary',
      counts,
      $locale
    );
  }

  function fullDesignDestinationIssueText(issue: any) {
    const machineDetail =
      issue?.detail?.message ?? issue?.detail?.status ?? null;
    return machineDetail
      ? String(machineDetail)
      : localizeWepBlocker(
          issue?.code ?? 'WEP_UNKNOWN_BLOCKER',
          $locale
        ).message;
  }

  async function openFullDesignDestination(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file || !fullDesignPlan?.manifest) return;

    fullDesignDestinationLoading = true;
    fullDesignDestinationFileName = file.name;
    fullDesignDestinationPreflight = null;
    fullDesignDestinationError = '';

    try {
      const opened = await openWorldSaveBytes(
        new Uint8Array(await file.arrayBuffer()),
        { sourcePlatform: 'switch' }
      );
      if (opened.saveIdentity.sourcePlatform !== 'switch') {
        throw new Error('FULL_DESIGN_DESTINATION_SWITCH_SOURCE_REQUIRED');
      }

      placementLegalityBinding ??=
        await createSwitchV125PlacementLegalityBinding({
          basePath: base
        });
      buildingV110Binding ??=
        await createSwitchV125BuildingBinding({
          basePath: base
        });
      switchWorldBinding ??=
        await createSwitchWorldReadAdapter({
          basePath: base
        });
      const destinationProgression =
        await buildSwitchV125DestinationProgressionProjection({
          profile: opened.profile,
          progressionScopeIndex:
            switchWorldBinding.progressionScopeIndex,
          basePath: base
        });

      fullDesignDestinationPreflight =
        preflightCurrentV125FullDesignManifest({
          destinationProfile: opened.profile,
          destinationPlatform: opened.saveIdentity.sourcePlatform,
          manifest: fullDesignPlan.manifest,
          placementBinding: placementLegalityBinding,
          progressionDestinationProjection:
            destinationProgression.projection,
          buildingBinding: buildingV110Binding
        });
    } catch (error) {
      fullDesignDestinationPreflight = null;
      fullDesignDestinationError =
        error instanceof Error ? error.message : String(error);
    } finally {
      fullDesignDestinationLoading = false;
      input.value = '';
    }
  }

  function fullDesignIdentityLabel(plan: any) {
    const identity = plan?.semanticIdentity;
    if (identity?.kind === 'BIOME') {
      return t(
        'worldEditor.fullDesign.identityBiome',
        {
          sceneItemId: identity.villageSceneItemId,
          areaType: identity.villageAreaType
        },
        $locale
      );
    }
    if (identity?.kind === 'FLOATING_ISLAND') {
      return t(
        'worldEditor.fullDesign.identityFloating',
        { sceneItemId: identity.sceneItemId },
        $locale
      );
    }
    return t('worldEditor.fullDesign.identityUnresolved', {}, $locale);
  }

  onMount(async () => {
    refreshRecoveryRecords();
    try {
      const pendingHandoff = readWorldEditorHandoff(localStorage);
      pendingWorldEditorHandoff = pendingHandoff;
      if (pendingHandoff) {
        switchWorldBinding ??= await createSwitchWorldReadAdapter({
          basePath: base
        });
      }
      const memory = getActiveWorldEditorMemory();
      if (pendingHandoff && memory) {
        const compatible =
          recoveryRecords.find(
            (record: any) =>
              record.sourceFingerprint === memory.sourceFingerprint
          ) ??
          (
            memory.activeDraftRecord &&
            recoveryCompatible(
              memory.activeDraftRecord,
              memory.sourceFingerprint,
              memory.activeDraftRecord.target
            )
              ? memory.activeDraftRecord
              : null
          );
        if (compatible) {
          await restoreRecoveryRecord(compatible, memory);
        }
      }
    } catch (error) {
      recoveryStatus =
        error instanceof Error ? error.message : String(error);
    }

    try {
      const config = readCommunityBrowserConfig();
      if (!config) return;

      community = new CommunityLabClient({
        supabaseUrl: config.supabaseUrl,
        publishableKey: config.publishableKey
      });

      bridge = createPresetCommunityBridge({
        community,
        hooks: {
          buildPublishEnvelope,
          validatePublishablePreset,
          preflightScene
        }
      });

      workflow = createScenePresetWorkflow({
        publisher: bridge,
        captureScene: captureScenePreset as any,
        publicationValidator: validatePublishablePreset
      });

      connected = Boolean(community.session);
      if (!connected) return;

      const me: any = await community.query('me');
      creatorProfileId = String(me?.data?.creatorProfileId ?? '');
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }
  });

  function deriveAreaBounds(document: any) {
    const declared = document?.metadata?.rootGridBounds;
    if (
      declared &&
      Number.isFinite(Number(declared.x)) &&
      Number.isFinite(Number(declared.y)) &&
      Number.isFinite(Number(declared.w)) &&
      Number.isFinite(Number(declared.h)) &&
      Number(declared.w) > 0 &&
      Number(declared.h) > 0
    ) {
      return {
        x: Number(declared.x),
        y: Number(declared.y),
        w: Number(declared.w),
        h: Number(declared.h)
      };
    }

    if (document.objects.length) {
      const bounds = boundsFor(document.objects);
      return {
        x: bounds.x - 2,
        y: bounds.y - 2,
        w: Math.max(5, bounds.w + 4),
        h: Math.max(5, bounds.h + 4)
      };
    }

    return { x: 0, y: 0, w: 24, h: 16 };
  }

  function refreshProjection({
    reconcileHiddenSelection = false
  }: {
    reconcileHiddenSelection?: boolean;
  } = {}) {
    if (!session) {
      projected = [];
      return;
    }

    editorDocument = session.getDocument();
    selection = session.getSelection();
    const nextProjection = projectObjects(editorDocument, {
      layerState,
      query
    });

    if (reconcileHiddenSelection && selection.length) {
      const visibleSelection = reconcileSelectionToProjection(
        selection,
        nextProjection
      );
      if (visibleSelection.length !== selection.length) {
        selection = session.setSelection(visibleSelection);
      }
    }

    projected = selectedOnly
      ? nextProjection.filter((object) =>
          selection.includes(object.editorId)
        )
      : nextProjection;

    const focusStillVisible = projected.some(
      (object) => object.editorId === canvasFocusEditorId
    );
    if (!focusStillVisible) {
      const selectedVisible = projected.find((object) =>
        selection.includes(object.editorId)
      );
      const firstKeyboardTarget = projected.find(
        (object) => object.ui?.locked !== true
      );
      canvasFocusEditorId =
        selectedVisible?.editorId ??
        firstKeyboardTarget?.editorId ??
        projected[0]?.editorId ??
        '';
    }
  }

  function moveCanvasFocus(currentId: string, delta: number) {
    if (!projected.length) return;
    const currentIndex = projected.findIndex(
      (object) => object.editorId === currentId
    );
    const start = currentIndex >= 0 ? currentIndex : 0;
    const nextIndex =
      (start + delta + projected.length) % projected.length;
    canvasFocusEditorId = projected[nextIndex].editorId;
    queueMicrotask(() => {
      const nodes = Array.from(
        document.querySelectorAll<SVGGElement>(
          '[data-editor-object-id]'
        )
      );
      nodes.find(
        (node) =>
          node.dataset.editorObjectId === canvasFocusEditorId
      )?.focus();
    });
  }

  async function openEditorDocument(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    loading = true;
    worldSourceEpoch += 1;
    worldSourceBytes = null;
    sourceFingerprint = '';
    verifiedExportBaselineDocument = null;
    verifiedExportReview = null;
    verifiedExportResult = null;
    verifiedExportErrorCode = '';
    verifiedExportErrorDetail = '';
    verifiedExportBuildConfirmed = false;
    verifiedExportConfirmed = false;
    message = '';
    capturePreview = null;
    published = null;
    fullDesignPlan = null;
    fullDesignPlanError = '';
    fullDesignRootDocuments = [];
    fullDesignSourceRootGridId = null;
    resetFullDesignDestination();
    resetFloatingIslandPlan();
    resetRoadFenceCapture();
    draftAuthoringBound = false;
    draftValidation = null;
    draftSavePreparation = null;
    lastDraftCommand = '';
    originalSaveBackup = null;
    copiedDraftClipboard = null;
    clipboardPasteCount = 0;

    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const fingerprint = await sha256Fingerprint(bytes);
      let parsed: any = null;

      try {
        const text = new TextDecoder('utf-8', { fatal: true })
          .decode(bytes)
          .replace(/^\uFEFF/, '');
        parsed = JSON.parse(text);
      } catch {
        parsed = null;
      }

      if (Array.isArray(parsed?.objects)) {
        if (recoveryRequest) {
          throw new Error('WEP_RECOVERY_RAW_SOURCE_REQUIRED');
        }
        const normalized = normalizeEditorDocument(parsed);
        if (normalized.schema !== WEP_EDITOR_SCHEMA) {
          throw new Error(t('worldEditor.open.schemaMismatch', {}, $locale));
        }

        worldSource = null;
        worldSourceBytes = null;
        originalSaveBackup = null;
        session = createEditorSession(normalized);
        editorDocument = session.getDocument();
        layerState = createLayerState({
          capabilities: editorDocument.capabilities
        });
        areaBounds = deriveAreaBounds(editorDocument);
        fileName = file.name;
        query = '';
        selectedOnly = false;
        selection = [];
        canvasFocusEditorId = '';
        presetTitle = '';
        presetDescription = '';
        publishKey = '';
        refreshProjection();
        refreshDraftState();

        message =
          editorDocument.target?.platform === 'synthetic'
            ? t('worldEditor.open.editorDocumentSyntheticLoaded', {}, $locale)
            : t('worldEditor.open.editorDocumentRealLoaded', {}, $locale);
      } else {
        const opened = await openWorldSaveBytes(bytes, {
          sourcePlatform
        });
        originalSaveBackup = createOriginalSaveBackup({
          bytes,
          sourceName: file.name
        });
        if (opened.saveIdentity.sourcePlatform === 'switch') {
          buildingV110Binding ??=
            await createSwitchV125BuildingBinding({
              basePath: base
            });
          scroogeStoreV112Binding ??=
            await createSwitchV125ScroogeStoreBinding({
              basePath: base
            });
          progressionV114Binding ??=
            await createSwitchV125ProgressionIntegrationBinding({
              basePath: base
            });
        }

        session = null;
        editorDocument = null;
        projected = [];
        selection = [];
        canvasFocusEditorId = '';
        layerState = null;
        worldSource = opened;
        worldSourceBytes = bytes.slice();
        sourceFingerprint = fingerprint;
        fileName = file.name;
        query = '';
        selectedOnly = false;
        presetTitle = '';
        presetDescription = '';
        publishKey = '';
        draftAuthoringBound = false;
        draftValidation = null;
        draftSavePreparation = null;
        lastDraftCommand = '';
        copiedDraftClipboard = null;
        clipboardPasteCount = 0;

        setActiveWorldEditorMemory({
          sourceFingerprint: fingerprint,
          sourceBytes: bytes,
          worldSource: opened,
          originalSaveBackup
        });

        if (recoveryRequest) {
          if (fingerprint !== recoveryRequest.sourceFingerprint) {
            throw new Error('WEP_RECOVERY_SOURCE_FINGERPRINT_MISMATCH');
          }
          const target = {
            platform: String(opened.saveIdentity?.sourcePlatform ?? ''),
            gameVersion: String(opened.compatibility?.gameVersion ?? ''),
            profileSchemaVersion: Number(opened.profileSchemaVersion)
          };
          if (
            !recoveryCompatible(
              recoveryRequest,
              fingerprint,
              target
            )
          ) {
            throw new Error('WEP_RECOVERY_SOURCE_TARGET_MISMATCH');
          }
          await restoreRecoveryRecord(recoveryRequest, {
            sourceFingerprint: fingerprint,
            sourceBytes: bytes,
            worldSource: opened,
            originalSaveBackup,
            activeDraftRecord: null
          });
        } else {
          message = t(
            'worldEditor.open.saveLoaded',
            {
              schema: opened.profileSchemaVersion,
              areaCount: opened.areas.length
            },
            $locale
          );
        }
      }
    } catch (error) {
      session = null;
      editorDocument = null;
      worldSource = null;
      worldSourceBytes = null;
      sourceFingerprint = '';
      verifiedExportBaselineDocument = null;
      verifiedExportReview = null;
      verifiedExportResult = null;
      verifiedExportErrorCode = '';
      verifiedExportErrorDetail = '';
      verifiedExportConfirmed = false;
      projected = [];
      selection = [];
      canvasFocusEditorId = '';
      layerState = null;
      fileName = '';
      draftAuthoringBound = false;
      draftValidation = null;
      draftSavePreparation = null;
      lastDraftCommand = '';
    originalSaveBackup = null;
    copiedDraftClipboard = null;
    clipboardPasteCount = 0;
      message = error instanceof Error ? error.message : String(error);
    } finally {
      loading = false;
      input.value = '';
    }
  }

  async function openSaveGridInCanvas(area: any, rootGridId: number) {
    if (!worldSource) return;

    if (worldSource.saveIdentity.sourcePlatform !== 'switch') {
      message = t('worldEditor.open.switchOnlyProjection', {}, $locale);
      return;
    }

    loading = true;
    capturePreview = null;
    published = null;
    fullDesignPlan = null;
    fullDesignPlanError = '';
    resetFullDesignDestination();
    message = '';

    try {
      switchWorldBinding ??= await createSwitchWorldReadAdapter({
        basePath: base
      });
      placementLegalityBinding ??=
        await createSwitchV125PlacementLegalityBinding({
          basePath: base
        });
      buildingV110Binding ??=
        await createSwitchV125BuildingBinding({
          basePath: base
        });
      scroogeStoreV112Binding ??=
        await createSwitchV125ScroogeStoreBinding({
          basePath: base
        });
      progressionV114Binding ??=
        await createSwitchV125ProgressionIntegrationBinding({
          basePath: base
        });

      const projectedDocument = projectSwitchAreaGrid(
        worldSource,
        area,
        Number(rootGridId),
        switchWorldBinding
      );
      const classifiedDocument =
        buildingV110Binding.annotateEditorDocument(
          projectedDocument
        );
      const progressionAnnotatedDocument =
        progressionV114Binding.annotateEditorDocument(
          classifiedDocument
        );
      const normalized = normalizeEditorDocument(
        progressionAnnotatedDocument
      );

      roadFenceReaderBinding =
        createSwitchV125RoadFenceReaderBinding({
          profile: worldSource.profile,
          rootGridId: Number(rootGridId)
        });
      roadFenceSceneCaptureAdapter =
        createDraftAwareNetworkCaptureAdapter(
          roadFenceReaderBinding.networkAdapter
        );
      roadFenceRootDraft =
        roadFenceReaderBinding.captureRootDraft(normalized);
      if (roadFenceRootDraft?.status === 'supported') {
        normalized.networks = cloneLocal(
          roadFenceRootDraft.networks
        );
      }
      includeRoads = false;
      includeFences = false;
      fencePostNetworks =
        roadFenceReaderBinding.fenceRepresentationLayout?.listNetworks?.() ?? [];
      if (fencePostNetworks.length) {
        loadFencePostDraft(String(fencePostNetworks[0].networkId));
      } else {
        fencePostSelectedNetworkId = '';
        fencePostDraft = null;
        fencePostValidation = null;
      }

      verifiedExportBaselineDocument = cloneLocal(normalized);
      verifiedExportReview = null;
      verifiedExportResult = null;
      verifiedExportErrorCode = '';
      verifiedExportErrorDetail = '';
      verifiedExportConfirmed = false;
      fullDesignRootDocuments = [cloneLocal(normalized)];
      fullDesignSourceRootGridId = Number(rootGridId);
      for (const root of area.roots ?? []) {
        if (Number(root.gridId) === Number(rootGridId)) continue;
        try {
          fullDesignRootDocuments.push(
            normalizeEditorDocument(
              progressionV114Binding.annotateEditorDocument(
                buildingV110Binding.annotateEditorDocument(
                  projectSwitchAreaGrid(
                    worldSource,
                    area,
                    Number(root.gridId),
                    switchWorldBinding
                  )
                )
              )
            )
          );
        } catch {
          // Full-design planning records the missing route fail-closed.
        }
      }

      session = createSwitchDraftSession(normalized);
      draftAuthoringBound = true;
      editorDocument = session.getDocument();
      rememberActiveDraftInMemory();
      layerState = createLayerState({
        capabilities: editorDocument.capabilities
      });
      areaBounds = deriveAreaBounds(editorDocument);
      query = '';
      selectedOnly = false;
      selection = [];
      presetTitle = '';
      presetDescription = '';
      publishKey = '';
      refreshProjection();
      refreshDraftState();
      syncRoadFenceSelection();

      rebuildFullDesignPlan();

      const diagnostics = editorDocument.metadata?.diagnostics ?? [];
      const unresolvedBounds = diagnostics.some(
        (issue: any) => issue.code === 'ROOT_GRID_BOUNDS_UNRESOLVED'
      );

      message =
        t('worldEditor.open.canvasLoadedBase', {}, $locale) +
        ' ' +
        (unresolvedBounds
          ? t('worldEditor.open.canvasBoundsUnresolved', {}, $locale)
          : t('worldEditor.open.canvasValidationBound', {}, $locale)) +
        ' ' +
        t('worldEditor.open.canvasExactBuildBoundary', {}, $locale);
    } catch (error) {
      session = null;
      editorDocument = null;
      projected = [];
      selection = [];
      layerState = null;
      fullDesignPlan = null;
      fullDesignPlanError = '';
      fullDesignRootDocuments = [];
      fullDesignSourceRootGridId = null;
      resetRoadFenceCapture();
      draftAuthoringBound = false;
      draftValidation = null;
      draftSavePreparation = null;
      lastDraftCommand = '';
      message = error instanceof Error ? error.message : String(error);
    } finally {
      loading = false;
    }
  }

  async function openFloatingIslandRootInCanvas(
    island: any,
    root: any
  ) {
    verifiedExportBaselineDocument = null;
    verifiedExportReview = null;
    verifiedExportResult = null;
    verifiedExportErrorCode = '';
    verifiedExportErrorDetail = '';
    verifiedExportConfirmed = false;
    if (!worldSource) return;

    if (worldSource.saveIdentity.sourcePlatform !== 'switch') {
      message = t('worldEditor.open.switchOnlyProjection', {}, $locale);
      return;
    }

    loading = true;
    capturePreview = null;
    published = null;
    fullDesignPlan = null;
    fullDesignPlanError = '';
    resetFullDesignDestination();
    message = '';

    try {
      switchWorldBinding ??= await createSwitchWorldReadAdapter({
        basePath: base
      });
      buildingV110Binding ??=
        await createSwitchV125BuildingBinding({
          basePath: base
        });
      scroogeStoreV112Binding ??=
        await createSwitchV125ScroogeStoreBinding({
          basePath: base
        });
      progressionV114Binding ??=
        await createSwitchV125ProgressionIntegrationBinding({
          basePath: base
        });

      const projectedDocument = projectSwitchFloatingIslandGrid(
        worldSource,
        island,
        root,
        switchWorldBinding
      );
      const classifiedDocument =
        buildingV110Binding.annotateEditorDocument(
          projectedDocument
        );
      const progressionAnnotatedDocument =
        progressionV114Binding.annotateEditorDocument(
          classifiedDocument
        );
      const normalized = normalizeEditorDocument(
        progressionAnnotatedDocument
      );

      roadFenceReaderBinding =
        createSwitchV125RoadFenceReaderBinding({
          profile: worldSource.profile,
          rootGridId: Number(root.gridId)
        });
      roadFenceSceneCaptureAdapter =
        createDraftAwareNetworkCaptureAdapter(
          roadFenceReaderBinding.networkAdapter
        );
      roadFenceRootDraft =
        roadFenceReaderBinding.captureRootDraft(normalized);
      if (roadFenceRootDraft?.status === 'supported') {
        normalized.networks = cloneLocal(
          roadFenceRootDraft.networks
        );
      }
      includeRoads = false;
      includeFences = false;
      fencePostNetworks =
        roadFenceReaderBinding.fenceRepresentationLayout?.listNetworks?.() ?? [];
      if (fencePostNetworks.length) {
        loadFencePostDraft(String(fencePostNetworks[0].networkId));
      } else {
        fencePostSelectedNetworkId = '';
        fencePostDraft = null;
        fencePostValidation = null;
      }

      fullDesignRootDocuments = [];
      for (const directRoot of island.roots ?? []) {
        try {
          fullDesignRootDocuments.push(
            normalizeEditorDocument(
              progressionV114Binding.annotateEditorDocument(
                buildingV110Binding.annotateEditorDocument(
                  projectSwitchFloatingIslandGrid(
                    worldSource,
                    island,
                    directRoot,
                    switchWorldBinding
                  )
                )
              )
            )
          );
        } catch {
          // Full-design planning records missing direct roots fail-closed.
        }
      }
      fullDesignSourceRootGridId = Number(root.gridId);

      // v1.16 is a read/model/preflight projector. It grants no local
      // mutation capability merely because projection succeeded.
      session = createEditorSession(normalized);
      draftAuthoringBound = false;
      editorDocument = session.getDocument();
      layerState = createLayerState({
        capabilities: editorDocument.capabilities
      });
      areaBounds = deriveAreaBounds(editorDocument);
      query = '';
      selectedOnly = false;
      selection = [];
      canvasFocusEditorId = '';
      presetTitle = '';
      presetDescription = '';
      publishKey = '';
      refreshProjection();
      refreshDraftState();

      rebuildFullDesignPlan();

      message = t(
        'worldEditor.open.canvasLoadedBase',
        {},
        $locale
      ) + ' ' +
        t('worldEditor.open.canvasExactBuildBoundary', {}, $locale);
    } catch (error) {
      session = null;
      editorDocument = null;
      projected = [];
      selection = [];
      canvasFocusEditorId = '';
      layerState = null;
      fullDesignPlan = null;
      fullDesignPlanError = '';
      fullDesignRootDocuments = [];
      fullDesignSourceRootGridId = null;
      resetRoadFenceCapture();
      draftAuthoringBound = false;
      draftValidation = null;
      draftSavePreparation = null;
      lastDraftCommand = '';
      message = error instanceof Error ? error.message : String(error);
    } finally {
      loading = false;
    }
  }

  function returnToSaveRoutes() {
    if (!worldSource) return;
    session = null;
    editorDocument = null;
    projected = [];
    selection = [];
    canvasFocusEditorId = '';
    layerState = null;
    capturePreview = null;
    published = null;
    fullDesignPlan = null;
    fullDesignPlanError = '';
    fullDesignRootDocuments = [];
    fullDesignSourceRootGridId = null;
    resetFullDesignDestination();
    resetRoadFenceCapture();
    draftAuthoringBound = false;
    draftValidation = null;
    draftSavePreparation = null;
    lastDraftCommand = '';
    verifiedExportBaselineDocument = null;
    verifiedExportReview = null;
    verifiedExportResult = null;
    verifiedExportErrorCode = '';
    verifiedExportErrorDetail = '';
    verifiedExportConfirmed = false;
    copiedDraftClipboard = null;
    clipboardPasteCount = 0;
    query = '';
    selectedOnly = false;
    message = t('worldEditor.open.returnedToRoutes', {}, $locale);
  }

  function selectObject(id: string, toggle = false) {
    if (!session) return;
    canvasFocusEditorId = id;
    selection = toggle
      ? session.toggleSelection(id)
      : session.setSelection([id]);
    if (selectedOnly) refreshProjection();
    capturePreview = null;
    published = null;
  }

  function selectAllVisible() {
    if (!session) return;
    selection = session.setSelection(
      projected.map((object) => object.editorId)
    );
    if (selectedOnly) refreshProjection();
    capturePreview = null;
    published = null;
  }

  function clearSelection() {
    if (!session) return;
    session.clearSelection();
    selection = [];
    if (selectedOnly) refreshProjection();
    capturePreview = null;
    published = null;
  }

  function toggleLayer(layer: string) {
    if (!layerState) return;
    layerState = {
      ...layerState,
      [layer]: {
        ...layerState[layer],
        visible: !layerState[layer].visible
      }
    };
    refreshProjection({ reconcileHiddenSelection: true });
  }

  function setQuery(value: string) {
    query = value;
    refreshProjection({ reconcileHiddenSelection: true });
  }

  function toggleSelectedOnly() {
    selectedOnly = !selectedOnly;
    refreshProjection();
  }

  function primaryCommandReason(command: PrimaryJobCommand) {
    const state = primaryJobAvailability?.commands?.[command];
    return state
      ? commandReasonText(command, state)
      : '';
  }

  function primaryCommandAllowed(command: PrimaryJobCommand) {
    return primaryJobAvailability?.commands?.[command]?.enabled === true;
  }

  function rejectPrimaryCommand(command: PrimaryJobCommand) {
    const reason = primaryCommandReason(command);
    message =
      reason ||
      t(
        'worldEditor.command.unavailableFallback',
        { label: commandLabelText(command) },
        $locale
      );
  }

  function runPrimaryMutation(
    command: 'move' | 'rotate' | 'duplicate' | 'delete',
    operation: 'up' | 'down' | 'left' | 'right' | 'rotate' | 'duplicate' | 'delete'
  ) {
    if (!primaryCommandAllowed(command)) {
      rejectPrimaryCommand(command);
      return;
    }
    runMutation(operation);
  }

  function runPrimaryCopy() {
    if (!primaryCommandAllowed('copy')) {
      rejectPrimaryCommand('copy');
      return;
    }
    copySelectedDraft();
  }

  function runPrimaryPaste() {
    if (!primaryCommandAllowed('paste')) {
      rejectPrimaryCommand('paste');
      return;
    }
    pasteCopiedDraft();
  }

  function runPrimaryUndo() {
    if (!primaryCommandAllowed('undo')) {
      rejectPrimaryCommand('undo');
      return;
    }
    undo();
  }

  function runPrimaryRedo() {
    if (!primaryCommandAllowed('redo')) {
      rejectPrimaryCommand('redo');
      return;
    }
    redo();
  }

  function runPrimarySavePrep() {
    if (!primaryCommandAllowed('reviewSavePrep')) {
      rejectPrimaryCommand('reviewSavePrep');
      return;
    }
    reviewSavePreparation();
  }

  function runPrimaryOriginalBackup() {
    if (!primaryCommandAllowed('downloadOriginalBackup')) {
      rejectPrimaryCommand('downloadOriginalBackup');
      return;
    }
    downloadOriginalSaveBackup();
  }

  function handlePrimaryJobKeydown(event: KeyboardEvent) {
    if (!editorDocument || !session) return;
    const target = event.target as HTMLElement | null;
    const shortcut = resolvePrimaryJobShortcut({
      key: event.key,
      ctrlKey: event.ctrlKey,
      metaKey: event.metaKey,
      shiftKey: event.shiftKey,
      altKey: event.altKey,
      targetTagName: target?.tagName ?? null,
      targetContentEditable: target?.isContentEditable === true
    });
    if (!shortcut) return;

    event.preventDefault();
    if (shortcut === 'CLEAR_SELECTION') {
      clearSelection();
      message = t('worldEditor.selection.cleared', {}, $locale);
      return;
    }
    if (shortcut === 'SELECT_VISIBLE') {
      selectAllVisible();
      message = t(
        'worldEditor.selection.visibleSelected',
        { count: projected.length },
        $locale
      );
      return;
    }
    if (shortcut === 'MOVE_UP') return runPrimaryMutation('move', 'up');
    if (shortcut === 'MOVE_DOWN') return runPrimaryMutation('move', 'down');
    if (shortcut === 'MOVE_LEFT') return runPrimaryMutation('move', 'left');
    if (shortcut === 'MOVE_RIGHT') return runPrimaryMutation('move', 'right');
    if (shortcut === 'ROTATE') return runPrimaryMutation('rotate', 'rotate');
    if (shortcut === 'COPY') return runPrimaryCopy();
    if (shortcut === 'PASTE') return runPrimaryPaste();
    if (shortcut === 'DUPLICATE') return runPrimaryMutation('duplicate', 'duplicate');
    if (shortcut === 'DELETE') return runPrimaryMutation('delete', 'delete');
    if (shortcut === 'UNDO') return runPrimaryUndo();
    if (shortcut === 'REDO') return runPrimaryRedo();
  }

  function finishDraftMutation(result: any, fallbackLabel: string) {
    lastDraftCommand = String(
      result?.kind ?? fallbackLabel
    );
    if (result?.applied === false) {
      const blocker = firstDraftBlocker(result.validation);
      message = blocker
        ? editorBlockerText(String(blocker.code))
        : t('worldEditor.validation.commandRejected', {}, $locale);
    } else if (result?.draftBlocked) {
      const blocker = firstDraftBlocker(result.validation);
      message = t(
        'worldEditor.validation.draftUpdatedBlocked',
        {
          reason: editorBlockerText(
            String(
              blocker?.code ??
                'NATIVE_PLACEMENT_UNVERIFIED'
            )
          )
        },
        $locale
      );
    } else {
      message = t('worldEditor.validation.draftUpdatedPass', {}, $locale);
    }

    capturePreview = null;
    published = null;
    refreshProjection();
    refreshDraftState();
    rebuildFullDesignPlan();
    if (result?.applied) checkpointRecovery();
  }

  function applyInspectorCoordinates() {
    if (
      !session ||
      !mutationBound ||
      !selectedInspectorObject ||
      selectedInspectorObject.editability !== 'editable'
    ) {
      return;
    }
    try {
      const id = String(selectedInspectorObject.editorId);
      const result = session.setPositions(
        [id],
        {
          [id]: {
            x: Number(inspectorCoordinateX),
            y: Number(inspectorCoordinateY)
          }
        },
        'PRECISE_POSITION'
      );
      finishDraftMutation(result, 'PRECISE_POSITION');
    } catch (error) {
      message =
        error instanceof Error ? error.message : String(error);
    }
  }

  function copySelectedDraft() {
    if (!session || !selection.length) return;
    try {
      copiedDraftClipboard =
        session.copySelectionGraph(null);
      clipboardPasteCount = 0;
      message =
        `Copied ${copiedDraftClipboard.graph.length} draft object${copiedDraftClipboard.graph.length === 1 ? '' : 's'} with dependency closure. No DDV state changed.`;
    } catch (error) {
      copiedDraftClipboard = null;
      clipboardPasteCount = 0;
      message =
        error instanceof Error ? error.message : String(error);
    }
  }

  function pasteCopiedDraft() {
    if (
      !session ||
      !mutationBound ||
      !copiedDraftClipboard?.graph?.length
    ) return;
    try {
      const nextOffset = clipboardPasteCount + 1;
      const bounds = copiedDraftClipboard.sourceBounds;
      const result = session.insertDraftGraph(
        copiedDraftClipboard.graph,
        {
          anchorX: Number(bounds.x) + nextOffset,
          anchorY: Number(bounds.y) + nextOffset,
          selectCreated: true,
          kind: 'PASTE'
        }
      );
      if (result?.applied) {
        clipboardPasteCount = nextOffset;
      }
      finishDraftMutation(result, 'PASTE');
    } catch (error) {
      message =
        error instanceof Error ? error.message : String(error);
    }
  }

  function runMutation(
    operation: 'up' | 'down' | 'left' | 'right' | 'rotate' | 'duplicate' | 'delete'
  ) {
    if (!session || !selection.length || !mutationBound) return;

    try {
      let result: any;
      if (operation === 'up') result = session.move(null, 0, -1);
      if (operation === 'down') result = session.move(null, 0, 1);
      if (operation === 'left') result = session.move(null, -1, 0);
      if (operation === 'right') result = session.move(null, 1, 0);
      if (operation === 'rotate') result = session.rotateCardinal(null, 1);
      if (operation === 'duplicate') result = session.duplicate(null);
      if (operation === 'delete') result = session.remove(null);

      finishDraftMutation(result, operation);
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }
  }

  function undo() {
    if (!session || !mutationBound) return;
    const result = session.undo();
    if (!result?.applied) return;
    lastDraftCommand = `UNDO ${result.kind ?? ''}`.trim();
    capturePreview = null;
    published = null;
    refreshProjection();
    refreshDraftState();
    syncFencePostDraftFromDocument();
    rebuildFullDesignPlan();
    checkpointRecovery();
    message = t('worldEditor.selection.undoRestored', {}, $locale);
  }

  function redo() {
    if (!session || !mutationBound) return;
    const result = session.redo();
    if (!result?.applied) return;
    lastDraftCommand = `REDO ${result.kind ?? ''}`.trim();
    capturePreview = null;
    published = null;
    refreshProjection();
    refreshDraftState();
    syncFencePostDraftFromDocument();
    rebuildFullDesignPlan();
    checkpointRecovery();
    message = t('worldEditor.selection.redoRestored', {}, $locale);
  }

  function downloadOriginalSaveBackup() {
    if (!originalSaveBackup) return;
    const blob = new Blob(
      [originalSaveBackup.bytes],
      { type: originalSaveBackup.mimeType }
    );
    const href = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = href;
    anchor.download = originalSaveBackup.fileName;
    anchor.rel = 'noopener';
    anchor.click();
    URL.revokeObjectURL(href);
    message = t('worldEditor.backup.downloaded', {}, $locale);
  }

  function downloadVerifiedArtifact(artifact: any) {
    if (!artifact?.bytes || !artifact?.fileName) return;
    const blob = new Blob([artifact.bytes], {
      type: artifact.mimeType ?? 'application/octet-stream'
    });
    const href = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = href;
    anchor.download = artifact.fileName;
    anchor.rel = 'noopener';
    anchor.click();
    URL.revokeObjectURL(href);
  }

  function verifiedExportFailureText(code: string) {
    const key = ({
      WEP_EXPORT_UNSUPPORTED_VERSION_BUILD:
        'worldEditor.verifiedExport.failure.unsupportedBuild',
      WEP_EXPORT_EXACT_BUILD_CONFIRMATION_REQUIRED:
        'worldEditor.verifiedExport.failure.buildConfirmation',
      WEP_EXPORT_NO_ELIGIBLE_PENDING_CHANGE:
        'worldEditor.verifiedExport.failure.noEligibleChange',
      WEP_EXPORT_UNSUPPORTED_PENDING_CHANGE:
        'worldEditor.verifiedExport.failure.unsupportedChange',
      WEP_EXPORT_SOURCE_CHANGED_SINCE_PLAN:
        'worldEditor.verifiedExport.failure.sourceChanged',
      WEP_EXPORT_REVIEW_STALE:
        'worldEditor.verifiedExport.failure.reviewStale',
      WEP_EXPORT_TARGET_IDENTITY_MISMATCH:
        'worldEditor.verifiedExport.failure.identityMismatch',
      WEP_EXPORT_OBJECT_NO_LONGER_ADMISSIBLE:
        'worldEditor.verifiedExport.failure.notAdmissible',
      WEP_EXPORT_CHANGED_OBJECT_MUST_BE_SELECTED:
        'worldEditor.verifiedExport.failure.changedObjectSelected',
      WEP_EXPORT_PROGRESSION_VETO:
        'worldEditor.verifiedExport.failure.progressionVeto',
      WEP_EXPORT_INVALID_DESTINATION:
        'worldEditor.verifiedExport.failure.invalidDestination',
      WEP_EXPORT_CANDIDATE_GENERATION_FAILED:
        'worldEditor.verifiedExport.failure.candidateGeneration',
      WEP_EXPORT_CANDIDATE_VERIFICATION_FAILED:
        'worldEditor.verifiedExport.failure.candidateVerification',
      WEP_EXPORT_ASSEMBLY_FAILED:
        'worldEditor.verifiedExport.failure.exportAssembly',
      WEP_EXPORT_RELOAD_REPARSE_FAILED:
        'worldEditor.verifiedExport.failure.reload',
      WEP_EXPORT_RELOAD_IDENTITY_OR_TRANSFORM_MISMATCH:
        'worldEditor.verifiedExport.failure.reloadMismatch',
      WEP_ADD_UNSUPPORTED_VERSION_BUILD:
        'worldEditor.verifiedExport.failure.unsupportedBuild',
      WEP_ADD_EXACT_BUILD_CONFIRMATION_REQUIRED:
        'worldEditor.verifiedExport.failure.buildConfirmation',
      WEP_ADD_NO_ELIGIBLE_PENDING_CHANGE:
        'worldEditor.verifiedExport.failure.noEligibleChange',
      WEP_ADD_UNSUPPORTED_PENDING_CHANGE:
        'worldEditor.verifiedExport.failure.unsupportedChange',
      WEP_ADD_CROSS_GRID_UNSUPPORTED:
        'worldEditor.verifiedExport.failure.unsupportedChange',
      WEP_ADD_CREATED_OBJECT_TRANSFORM_INVALID:
        'worldEditor.verifiedExport.failure.unsupportedChange',
      WEP_ADD_CREATED_OBJECT_NOT_ORDINARY_ROOT_STATELESS_FURNITURE:
        'worldEditor.verifiedExport.failure.notAdmissible',
      WEP_ADD_OBJECT_NO_LONGER_ADMISSIBLE:
        'worldEditor.verifiedExport.failure.notAdmissible',
      WEP_ADD_INVALID_DESTINATION:
        'worldEditor.verifiedExport.failure.invalidDestination',
      WEP_ADD_SOURCE_CHANGED_SINCE_PLAN:
        'worldEditor.verifiedExport.failure.sourceChanged',
      WEP_ADD_REVIEW_STALE:
        'worldEditor.verifiedExport.failure.reviewStale',
      WEP_ADD_CANDIDATE_GENERATION_FAILED:
        'worldEditor.verifiedExport.failure.candidateGeneration',
      WEP_ADD_CANDIDATE_VERIFICATION_FAILED:
        'worldEditor.verifiedExport.failure.candidateVerification',
      WEP_ADD_ASSEMBLY_FAILED:
        'worldEditor.verifiedExport.failure.exportAssembly',
      WEP_ADD_RELOAD_REPARSE_FAILED:
        'worldEditor.verifiedExport.failure.reload',
      WEP_ADD_RELOAD_IDENTITY_OR_TRANSFORM_MISMATCH:
        'worldEditor.verifiedExport.failure.reloadMismatch',
      WEP_ADD_RUNTIME_ACCEPTANCE_PENDING:
        'worldEditor.verifiedExport.failure.addRuntimePending',
      WEP_ROADFENCE_UNSUPPORTED_VERSION_BUILD:
        'worldEditor.verifiedExport.failure.unsupportedBuild',
      WEP_ROADFENCE_EXACT_BUILD_CONFIRMATION_REQUIRED:
        'worldEditor.verifiedExport.failure.buildConfirmation',
      WEP_ROADFENCE_NO_ELIGIBLE_PENDING_CHANGE:
        'worldEditor.verifiedExport.failure.noEligibleChange',
      WEP_ROADFENCE_CONCURRENT_NON_NETWORK_CHANGE:
        'worldEditor.verifiedExport.failure.unsupportedChange',
      WEP_ROADFENCE_MULTI_NETWORK_CHANGE_UNSUPPORTED:
        'worldEditor.verifiedExport.failure.unsupportedChange',
      WEP_ROADFENCE_NETWORK_REMOVAL_UNSUPPORTED_V1:
        'worldEditor.verifiedExport.failure.unsupportedChange',
      WEP_ROADFENCE_CROSS_GRID_UNSUPPORTED:
        'worldEditor.verifiedExport.failure.unsupportedChange',
      WEP_ROADFENCE_COORDINATE_SPACE_REQUIRED:
        'worldEditor.verifiedExport.failure.invalidDestination',
      WEP_ROADFENCE_TARGET_SURFACE_BOUNDS_REQUIRED:
        'worldEditor.verifiedExport.failure.invalidDestination',
      WEP_ROADFENCE_TARGET_SURFACE_OUT_OF_BOUNDS:
        'worldEditor.verifiedExport.failure.invalidDestination',
      WEP_ROADFENCE_FENCE_LAYOUT_REQUIRED:
        'worldEditor.verifiedExport.failure.unsupportedChange',
      WEP_ROADFENCE_FENCE_LAYOUT_INVALIDATED:
        'worldEditor.verifiedExport.failure.unsupportedChange',
      WEP_ROADFENCE_COMPILER_BLOCKED:
        'worldEditor.verifiedExport.failure.notAdmissible',
      WEP_ROADFENCE_SOURCE_CHANGED_SINCE_PLAN:
        'worldEditor.verifiedExport.failure.sourceChanged',
      WEP_ROADFENCE_REVIEW_STALE:
        'worldEditor.verifiedExport.failure.reviewStale',
      WEP_ROADFENCE_CANDIDATE_GENERATION_FAILED:
        'worldEditor.verifiedExport.failure.candidateGeneration',
      WEP_ROADFENCE_CANDIDATE_VERIFICATION_FAILED:
        'worldEditor.verifiedExport.failure.candidateVerification',
      WEP_ROADFENCE_EXPORT_ASSEMBLY_FAILED:
        'worldEditor.verifiedExport.failure.exportAssembly',
      WEP_ROADFENCE_RELOAD_REPARSE_FAILED:
        'worldEditor.verifiedExport.failure.reload',
      WEP_ROADFENCE_RELOAD_NATIVE_READER_BLOCKED:
        'worldEditor.verifiedExport.failure.reloadMismatch',
      WEP_ROADFENCE_RELOAD_LOGICAL_NETWORK_MISMATCH:
        'worldEditor.verifiedExport.failure.reloadMismatch'
    } as Record<string, string>)[code];
    return t(
      key ?? 'worldEditor.verifiedExport.failure.generic',
      {},
      $locale
    );
  }

  async function reviewVerifiedExport() {
    if (
      !worldSource ||
      !worldSourceBytes ||
      !verifiedExportBaselineDocument ||
      !editorDocument ||
      !placementLegalityBinding ||
      !switchWorldBinding
    ) {
      verifiedExportErrorCode = 'WEP_EXPORT_NO_ELIGIBLE_PENDING_CHANGE';
      verifiedExportErrorDetail = '';
      verifiedExportReview = null;
      return;
    }
    verifiedExportLoading = true;
    verifiedExportReview = null;
    verifiedExportResult = null;
    verifiedExportErrorCode = '';
    verifiedExportErrorDetail = '';
    verifiedExportConfirmed = false;
    try {
      const roadFenceChanged =
        JSON.stringify(verifiedExportBaselineDocument.networks ?? null) !==
        JSON.stringify(editorDocument.networks ?? null);
      const ordinaryAddChanged =
        !roadFenceChanged &&
        editorDocument.objects.length ===
          verifiedExportBaselineDocument.objects.length + 1;
      const review = roadFenceChanged
        ? await reviewRoadFenceVerifiedExport({
            sourceBytes: worldSourceBytes,
            sourceName: fileName || 'profile',
            sourceEpoch: worldSourceEpoch,
            opened: worldSource,
            baselineDocument: verifiedExportBaselineDocument,
            draftDocument: editorDocument,
            exactBuildConfirmed: verifiedExportBuildConfirmed
          })
        : ordinaryAddChanged
          ? await reviewOrdinaryFurnitureAddVerifiedExport({
              sourceBytes: worldSourceBytes,
              sourceName: fileName || 'profile',
              sourceEpoch: worldSourceEpoch,
              opened: worldSource,
              baselineDocument: verifiedExportBaselineDocument,
              draftDocument: editorDocument,
              placementBinding: placementLegalityBinding,
              basePath: base,
              exactBuildConfirmed: verifiedExportBuildConfirmed
            })
          : await reviewMinimumVerifiedTransform({
              sourceBytes: worldSourceBytes,
              sourceName: fileName || 'profile',
              sourceEpoch: worldSourceEpoch,
              opened: worldSource,
              baselineDocument: verifiedExportBaselineDocument,
              draftDocument: editorDocument,
              placementBinding: placementLegalityBinding,
              worldBinding: switchWorldBinding,
              basePath: base,
              exactBuildConfirmed: verifiedExportBuildConfirmed
            });
      if (
        review.contract !== ROADFENCE_VERIFIED_EXPORT_CONTRACT &&
        (
          selection.length !== 1 ||
          selection[0] !== review.change.editorId
        )
      ) {
        throw Object.assign(
          new Error('WEP_EXPORT_CHANGED_OBJECT_MUST_BE_SELECTED'),
          { code: 'WEP_EXPORT_CHANGED_OBJECT_MUST_BE_SELECTED' }
        );
      }
      verifiedExportReview = review;
      message = t(
        'worldEditor.verifiedExport.reviewReady',
        {},
        $locale
      );
    } catch (error: any) {
      verifiedExportErrorCode = String(
        error?.code ?? error?.message ?? 'WEP_EXPORT_REVIEW_FAILED'
      );
      verifiedExportErrorDetail =
        error?.detail ? JSON.stringify(error.detail) : '';
      message = verifiedExportFailureText(verifiedExportErrorCode);
    } finally {
      verifiedExportLoading = false;
    }
  }

  async function applyVerifiedExport() {
    if (
      !verifiedExportReview ||
      !verifiedExportConfirmed ||
      !worldSourceBytes ||
      !verifiedExportBaselineDocument ||
      !editorDocument ||
      !switchWorldBinding
    ) return;
    verifiedExportLoading = true;
    verifiedExportResult = null;
    verifiedExportErrorCode = '';
    verifiedExportErrorDetail = '';
    try {
      verifiedExportResult =
        verifiedExportReview.contract === ROADFENCE_VERIFIED_EXPORT_CONTRACT
          ? await commitRoadFenceVerifiedExport({
              review: verifiedExportReview,
              currentSourceEpoch: worldSourceEpoch,
              sourceBytes: worldSourceBytes,
              opened: worldSource,
              baselineDocument: verifiedExportBaselineDocument,
              draftDocument: editorDocument
            })
          : verifiedExportReview.contract ===
              ORDINARY_FURNITURE_ADD_VERIFIED_EXPORT_CONTRACT
            ? await commitOrdinaryFurnitureAddVerifiedExport({
                review: verifiedExportReview,
                currentSourceEpoch: worldSourceEpoch,
                sourceBytes: worldSourceBytes,
                baselineDocument: verifiedExportBaselineDocument,
                draftDocument: editorDocument,
                worldBinding: switchWorldBinding
              })
            : await commitMinimumVerifiedTransform({
                review: verifiedExportReview,
                currentSourceEpoch: worldSourceEpoch,
                sourceBytes: worldSourceBytes,
                baselineDocument: verifiedExportBaselineDocument,
                draftDocument: editorDocument,
                worldBinding: switchWorldBinding
              });
      message = t(
        'worldEditor.verifiedExport.success',
        {},
        $locale
      );
    } catch (error: any) {
      verifiedExportErrorCode = String(
        error?.code ?? error?.message ?? 'WEP_EXPORT_COMMIT_FAILED'
      );
      verifiedExportErrorDetail =
        error?.detail ? JSON.stringify(error.detail) : '';
      message = verifiedExportFailureText(verifiedExportErrorCode);
    } finally {
      verifiedExportLoading = false;
    }
  }

  function reviewSavePreparation() {
    if (!session) return;
    draftSavePreparation = session.previewPersistentCommit();
    const code = String(
      draftSavePreparation?.reason ?? 'NO_PERSISTENT_WRITER_BOUND'
    );
    message = t(
      'worldEditor.savePrep.reviewed',
      { reason: editorBlockerText(code) },
      $locale
    );
  }

  function selectedSceneBounds() {
    if (!session || !selection.length) return null;
    const selected = new Set(selection);
    const objects = session
      .getDocument()
      .objects.filter((object: any) =>
        selected.has(String(object.editorId))
      );
    return objects.length ? boundsFor(objects) : null;
  }

  function useSelectedCaptureRegion() {
    const bounds = selectedSceneBounds();
    if (!bounds) {
      message = t('worldEditor.scene.selectForRegion', {}, $locale);
      return;
    }
    captureRegionX = Number(bounds.x);
    captureRegionY = Number(bounds.y);
    captureRegionW = Number(bounds.w);
    captureRegionH = Number(bounds.h);
    captureRegionMode = 'custom';
    capturePreview = null;
    published = null;
  }

  function sceneCaptureRegion() {
    if (captureRegionMode === 'selection') return null;
    const region = {
      x: Number(captureRegionX),
      y: Number(captureRegionY),
      w: Number(captureRegionW),
      h: Number(captureRegionH)
    };
    if (
      !Number.isSafeInteger(region.x) ||
      !Number.isSafeInteger(region.y) ||
      !Number.isSafeInteger(region.w) ||
      !Number.isSafeInteger(region.h) ||
      region.w <= 0 ||
      region.h <= 0
    ) {
      throw new Error('WEP_SCENE_REGION_INVALID');
    }
    return region;
  }

  function previewScene() {
    if (!session || !selection.length) {
      message = t('worldEditor.scene.selectForPreset', {}, $locale);
      return;
    }

    try {
      capturePreview = captureScenePreset(
        session.getDocument(),
        {
          selectionIds: selection,
          captureRegion: sceneCaptureRegion(),
          title: presetTitle.trim(),
          includeRoads,
          includeFences,
          networkAdapter:
            roadFenceSceneCaptureAdapter ??
            roadFenceReaderBinding?.networkAdapter ??
            null
        },
        validatePublishablePreset
      );
      published = null;
      publishKey = crypto.randomUUID();

      if (capturePreview.publicationReady) {
        message = t('worldEditor.scene.publicationReady', {}, $locale);
      } else {
        const code =
          capturePreview.issues?.find(
            (issue: any) => issue.severity === 'BLOCK'
          )?.code ?? 'WEP_SCENE_CAPTURE_BLOCKED';
        message = String(code);
      }
    } catch (error) {
      capturePreview = null;
      publishKey = '';
      const code = error instanceof Error ? error.message : String(error);
      if (code === 'WEP_SCENE_SELECTION_BLOCKED') {
        const selectedIds = new Set(selection.map(String));
        const blockedObject = session
          .getDocument()
          .objects.find((object: any) =>
            selectedIds.has(String(object.editorId)) &&
            (
              object.editability !== 'editable' ||
              object.layer === 'static' ||
              object.layer === 'road' ||
              object.layer === 'fence'
            )
          );
        const reasonCode = Array.isArray(blockedObject?.metadata?.reasons)
          ? blockedObject.metadata.reasons[0]
          : null;
        const reason = reasonCode
          ? coreReasonText(String(reasonCode))
          : t('worldEditor.scene.nonPortableSelection', {}, $locale);
        message = t(
          'worldEditor.scene.captureBlocked',
          { reason },
          $locale
        );
      } else {
        message = code;
      }
    }
  }

  async function publishScene() {
    if (
      !session ||
      !workflow ||
      !connected ||
      !creatorProfileId ||
      !presetTitle.trim()
    ) {
      message = t('worldEditor.scene.publishRequirements', {}, $locale);
      return;
    }

    loading = true;
    message = '';

    try {
      if (!publishKey) publishKey = crypto.randomUUID();

      const result: any = await workflow.publishCapturedScene({
        document: session.getDocument(),
        capture: {
          selectionIds: selection,
          captureRegion: sceneCaptureRegion(),
          includeRoads,
          includeFences,
          networkAdapter:
            roadFenceSceneCaptureAdapter ??
            roadFenceReaderBinding?.networkAdapter ??
            null
        },
        creatorProfileId,
        visibility,
        title: presetTitle.trim(),
        description: presetDescription.trim() || null,
        metadata: {
          sourceSurface: 'world-editor',
          artifactType: 'scene'
        },
        idempotencyKey: `world-editor-scene-${publishKey}`
      });

      capturePreview = result.captured;
      published = result.published;
      message = t('worldEditor.scene.publishedStatus', {}, $locale);
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    } finally {
      loading = false;
    }
  }
</script>

<svelte:window on:keydown={handlePrimaryJobKeydown} />

<svelte:head>
  <title>{t('worldEditor.meta.title', {}, $locale)}</title>
  <meta
    name="description"
    content={t('worldEditor.meta.description', {}, $locale)}
  />
</svelte:head>

<section class="world-page container">
  <div class="world-heading">
    <div>
      <p class="eyebrow">{t('worldEditor.nav.eyebrow', {}, $locale)}</p>
      <h1>{t('worldEditor.nav.title', {}, $locale)}</h1>
      <p class="page-intro">{t('worldEditor.nav.intro', {}, $locale)}</p>
    </div>
    <a class="preset-link" href={`${base}/presets/`}>{t('worldEditor.nav.presets', {}, $locale)}</a>
  </div>

  <section class="load-panel">
    <div>
      <p class="eyebrow">{t('worldEditor.open.eyebrow', {}, $locale)}</p>
      <h2>{t('worldEditor.open.title', {}, $locale)}</h2>
      <p>{t('worldEditor.open.description', {}, $locale)}</p>
    </div>
    <div class="load-controls">
      <label class="platform-select">
        <span>{t('worldEditor.open.sourcePlatform', {}, $locale)}</span>
        <select bind:value={sourcePlatform} disabled={loading}>
          <option value="unknown">{t('worldEditor.open.unknownPlatform', {}, $locale)}</option>
          <option value="switch">{t('worldEditor.open.switch', {}, $locale)}</option>
          <option value="steam-windows">{t('worldEditor.open.steamWindows', {}, $locale)}</option>
        </select>
      </label>
      <label class="file-button">
        <input
          bind:this={saveFileInput}
          type="file"
          accept=".save,.json,application/json,application/octet-stream"
          on:change={openEditorDocument}
          disabled={loading}
        />
        {fileName
          ? t('worldEditor.open.openAnotherFile', {}, $locale)
          : t('worldEditor.open.openFile', {}, $locale)}
      </label>
    </div>
  </section>

  {#if recoveryRecords.length || recoveryStatus}
    <section class="recovery-panel" data-wep-recovery aria-labelledby="wep-recovery-title">
      <div>
        <p class="eyebrow">{stage1Copy.recoveryEyebrow}</p>
        <h2 id="wep-recovery-title">{stage1Copy.recoveryTitle}</h2>
        <p>{stage1Copy.recoveryDescription}</p>
      </div>
      {#if recoveryRecords.length}
        <div class="recovery-list">
          {#each recoveryRecords.slice(0, 5) as record}
            <button type="button" on:click={() => resumeRecovery(record)} disabled={loading}>
              <strong>{record.sourceName ?? 'DDV save'}</strong>
              <span>{record.savedAt} · {record.target.platform} · {record.target.gameVersion}</span>
            </button>
          {/each}
        </div>
      {/if}
      {#if recoveryStatus}
        <p class="recovery-status" role="status" aria-live="polite">{recoveryStatus}</p>
      {/if}
    </section>
  {/if}

  {#if message}
    <div class="status" aria-live="polite">{message}</div>
  {/if}

  {#if pendingWorldEditorHandoff && !editorDocument}
    <section class="pre-source-stage1" data-wep-pre-source-stage1>
      <WorldEditorStage1DecoratePanel
        {session}
        {editorDocument}
        {switchWorldBinding}
        {mutationBound}
        {selection}
        presetBridge={bridge}
        onMutation={finishDraftMutation}
      />
    </section>
  {/if}

  {#if editorDocument}
    <div class="workspace">
      <aside class="sidebar">
        <section class="side-card">
          <p class="eyebrow">{t('worldEditor.target.eyebrow', {}, $locale)}</p>
          <dl>
            <div><dt>{t('worldEditor.target.file', {}, $locale)}</dt><dd>{fileName || '—'}</dd></div>
            <div><dt>{t('worldEditor.target.game', {}, $locale)}</dt><dd>{editorDocument.target?.gameVersion ?? '—'}</dd></div>
            <div><dt>{t('worldEditor.target.platform', {}, $locale)}</dt><dd>{editorDocument.target?.platform ?? '—'}</dd></div>
            <div><dt>{t('worldEditor.target.area', {}, $locale)}</dt><dd>{editorDocument.target?.areaKey ?? '—'}</dd></div>
            <div><dt>{t('worldEditor.target.objects', {}, $locale)}</dt><dd>{objectCount}</dd></div>
            <div><dt>{t('worldEditor.target.selected', {}, $locale)}</dt><dd>{selectedCount}</dd></div>
          </dl>
          <p class:blocked={!mutationBound} class="binding-state">
            {mutationBound
              ? editorDocument.target?.platform === 'synthetic'
                ? t('worldEditor.target.syntheticDraft', {}, $locale)
                : t('worldEditor.target.coreBoundDraft', {}, $locale)
              : t('worldEditor.target.readOnly', {}, $locale)}
          </p>
          {#if worldSource}
            <button class="back-to-routes" on:click={returnToSaveRoutes}>
              {t('worldEditor.nav.backToRoutes', {}, $locale)}
            </button>
          {/if}
        </section>

        <section class="side-card">
          <WorldEditorStage1DecoratePanel
            {session}
            {editorDocument}
            {selection}
            {switchWorldBinding}
            {mutationBound}
            presetBridge={bridge}
            onMutation={finishDraftMutation}
          />
        </section>

        {#if placementReadiness}
          <section class="side-card placement-readiness-card">
            <p class="eyebrow">{t('worldEditor.placement.eyebrow', {}, $locale)}</p>
            <dl>
              <div>
                <dt>{t('worldEditor.placement.route', {}, $locale)}</dt>
                <dd>{placementReadiness.route.status === 'RESOLVED'
                  ? t('worldEditor.placement.resolved', {}, $locale)
                  : t('worldEditor.placement.blocked', {}, $locale)}</dd>
              </div>
              <div>
                <dt>{t('worldEditor.placement.bounds', {}, $locale)}</dt>
                <dd>{placementReadiness.bounds.status === 'AUTHORITATIVE'
                  ? t('worldEditor.placement.authoritativeBounds', {}, $locale)
                  : t('worldEditor.placement.blocked', {}, $locale)}</dd>
              </div>
              <div>
                <dt>{t('worldEditor.placement.legality', {}, $locale)}</dt>
                <dd>
                  {draftValidation
                    ? draftValidation.ok
                      ? t('worldEditor.placement.currentCommandPass', {}, $locale)
                      : t('worldEditor.placement.blockedUnverified', {}, $locale)
                    : draftAuthoringBound
                      ? t('worldEditor.placement.commandSpecific', {}, $locale)
                      : t('worldEditor.placement.notBound', {}, $locale)}
                </dd>
              </div>
              <div>
                <dt>{t('worldEditor.placement.ddvWrite', {}, $locale)}</dt>
                <dd>{t('worldEditor.placement.disabled', {}, $locale)}</dd>
              </div>
            </dl>
            <p class="placement-readiness-note">
              {placementReadiness.bounds.status !== 'AUTHORITATIVE'
                ? placementReadiness.bounds.blocker
                : draftAuthoringBound
                  ? t('worldEditor.placement.boundNote', {}, $locale)
                  : t('worldEditor.placement.unboundNote', {}, $locale)}
            </p>
          </section>
        {/if}

        {#if progressionProofStatus}
          <section
            class="side-card progression-safety-card"
            aria-labelledby="progression-safety-title"
          >
            <p class="eyebrow">{t('worldEditor.progression.eyebrow', {}, $locale)}</p>
            <h3 id="progression-safety-title">{t('worldEditor.progression.title', {}, $locale)}</h3>
            <dl>
              <div>
                <dt>{t('worldEditor.progression.questGraph', {}, $locale)}</dt>
                <dd>{progressionProofStatus.questDefinitionGraph}</dd>
              </div>
              <div>
                <dt>{t('worldEditor.progression.saveRefs', {}, $locale)}</dt>
                <dd>{progressionProofStatus.saveProgressionReferenceIndex}</dd>
              </div>
              <div>
                <dt>{t('worldEditor.progression.terminalEdit', {}, $locale)}</dt>
                <dd>{progressionProofStatus.terminalEditableMutationAuthorized
                  ? t('worldEditor.progression.authorized', {}, $locale)
                  : t('worldEditor.progression.notAuthorized', {}, $locale)}</dd>
              </div>
              <div>
                <dt>{t('worldEditor.progression.positivePermission', {}, $locale)}</dt>
                <dd>{progressionProofStatus.positivePermissionGranted
                  ? t('worldEditor.progression.granted', {}, $locale)
                  : t('worldEditor.progression.notGranted', {}, $locale)}</dd>
              </div>
              <div>
                <dt>{t('worldEditor.progression.persistentWrite', {}, $locale)}</dt>
                <dd>{progressionProofStatus.persistentWriteAuthorized
                  ? t('worldEditor.progression.authorized', {}, $locale)
                  : t('worldEditor.progression.disabled', {}, $locale)}</dd>
              </div>
            </dl>
            <div
              class="progression-proof-gates"
              aria-label={t('worldEditor.progression.remainingGates', {}, $locale)}
            >
              <span>
                {t('worldEditor.progression.spawnRemoveProof', {}, $locale)}
                <strong>{progressionProofStatus.conditionalSpawnRemoveWhenDone}</strong>
              </span>
              <span>
                {t('worldEditor.progression.nativeConsumerExclusion', {}, $locale)}
                <strong>{progressionProofStatus.dynamicNativeConsumerExclusion}</strong>
              </span>
              <span>
                {t('worldEditor.progression.serializedStateCompatibility', {}, $locale)}
                <strong>{progressionProofStatus.objectSerializedStateCompatibility}</strong>
              </span>
            </div>
            <p class="progression-safety-note">
              {t('worldEditor.progression.explanation', {}, $locale)}
            </p>
          </section>
        {/if}

        <section class="side-card">
          <p class="eyebrow">{t('worldEditor.layers.eyebrow', {}, $locale)}</p>
          <div class="layer-list">
            {#each WEP_LAYERS as layer}
              <button
                class:off={!layerState[layer].visible}
                on:click={() => toggleLayer(layer)}
              >
                <span>{layer}</span>
                <small>
                  {layerState[layer].locked
                    ? t('worldEditor.layers.locked', {}, $locale)
                    : t('worldEditor.layers.selectable', {}, $locale)}
                </small>
              </button>
            {/each}
          </div>
        </section>

        <section class="side-card">
          <p class="eyebrow">{t('worldEditor.search.eyebrow', {}, $locale)}</p>
          <input
            data-wep-search-input
            bind:value={query}
            on:input={() =>
              refreshProjection({ reconcileHiddenSelection: true })}
            placeholder={t('worldEditor.search.placeholder', {}, $locale)}
            aria-label={t('worldEditor.search.ariaLabel', {}, $locale)}
          />
          <div class="selection-actions">
            <button on:click={selectAllVisible}>{t('worldEditor.search.selectVisible', {}, $locale)}</button>
            <button
              class:active={selectedOnly}
              disabled={!selection.length && !selectedOnly}
              on:click={toggleSelectedOnly}
            >{t('worldEditor.search.selectedOnly', {}, $locale)}</button>
            <button on:click={clearSelection}>{t('worldEditor.search.clearSelection', {}, $locale)}</button>
          </div>
          <small class="selection-scope-note">
            {t('worldEditor.search.scopeNote', {}, $locale)}
          </small>
        </section>

        <section class="side-card object-inspector">
          <p class="eyebrow">{t('worldEditor.inspector.eyebrow', {}, $locale)}</p>
          <h3>{t('worldEditor.inspector.title', {}, $locale)}</h3>
          {#if objectInspector.selection.kind === 'NONE'}
            <p class="inspector-note">{t('worldEditor.inspector.none', {}, $locale)}</p>
          {:else if objectInspector.selection.kind === 'MULTI'}
            <p class="inspector-note">
              {t(
                'worldEditor.inspector.multi',
                { count: objectInspector.selection.count },
                $locale
              )}
            </p>
          {:else if selectedInspectorObject}
            <dl class="inspector-details">
              <div><dt>{t('worldEditor.inspector.itemId', {}, $locale)}</dt><dd>{selectedInspectorObject.itemId}</dd></div>
              <div><dt>{t('worldEditor.inspector.layer', {}, $locale)}</dt><dd>{selectedInspectorObject.layer}</dd></div>
              <div><dt>{t('worldEditor.inspector.editability', {}, $locale)}</dt><dd>{selectedInspectorObject.editability}</dd></div>
              <div><dt>{t('worldEditor.inspector.position', {}, $locale)}</dt><dd>{selectedInspectorObject.x}, {selectedInspectorObject.y}</dd></div>
              <div><dt>{t('worldEditor.inspector.orientation', {}, $locale)}</dt><dd>{selectedInspectorObject.orientation}</dd></div>
              <div><dt>{t('worldEditor.inspector.state', {}, $locale)}</dt><dd>{selectedInspectorObject.stateKind ?? 'none'}</dd></div>
            </dl>
            <div class="inspector-precise" data-wep-inspector-coordinates>
              <h4>{stage1Copy.precise}</h4>
              <div>
                <label>
                  <span>{stage1Copy.x}</span>
                  <input
                    type="number"
                    step="1"
                    bind:value={inspectorCoordinateX}
                    disabled={
                      !mutationBound ||
                      selectedInspectorObject.editability !== 'editable' ||
                      selectedInspectorObject.layer === 'road' ||
                      selectedInspectorObject.layer === 'fence' ||
                      selectedInspectorObject.worldClass === 'FenceAndRoadItemData'
                    }
                  />
                </label>
                <label>
                  <span>{stage1Copy.y}</span>
                  <input
                    type="number"
                    step="1"
                    bind:value={inspectorCoordinateY}
                    disabled={
                      !mutationBound ||
                      selectedInspectorObject.editability !== 'editable' ||
                      selectedInspectorObject.layer === 'road' ||
                      selectedInspectorObject.layer === 'fence' ||
                      selectedInspectorObject.worldClass === 'FenceAndRoadItemData'
                    }
                  />
                </label>
              </div>
              <button
                type="button"
                on:click={applyInspectorCoordinates}
                disabled={
                  !mutationBound ||
                  selectedInspectorObject.editability !== 'editable' ||
                  selectedInspectorObject.layer === 'road' ||
                  selectedInspectorObject.layer === 'fence' ||
                  selectedInspectorObject.worldClass === 'FenceAndRoadItemData'
                }
              >
                {stage1Copy.applyCoords}
              </button>
            </div>
            {#if selectedInspectorObject.reasonCodes.length}
              <div class="inspector-reasons">
                {#each selectedInspectorObject.reasonCodes as code}
                  <span><code>{code}</code>{coreReasonText(code)}</span>
                {/each}
              </div>
            {/if}
          {/if}

          <h4>{t('worldEditor.inspector.commonActions', {}, $locale)}</h4>
          <div class="inspector-common-actions">
            <button aria-disabled={!primaryJobAvailability.commands.move.enabled} aria-describedby={!primaryJobAvailability.commands.move.enabled ? 'wep-reason-move' : undefined} on:click={() => runPrimaryMutation('move', 'right')}>{t('worldEditor.command.moveRight', {}, $locale)}</button>
            <button aria-disabled={!primaryJobAvailability.commands.rotate.enabled} aria-describedby={!primaryJobAvailability.commands.rotate.enabled ? 'wep-reason-rotate' : undefined} on:click={() => runPrimaryMutation('rotate', 'rotate')}>{t('worldEditor.command.rotate', {}, $locale)}</button>
            <button aria-disabled={!primaryJobAvailability.commands.copy.enabled} aria-describedby={!primaryJobAvailability.commands.copy.enabled ? 'wep-reason-copy' : undefined} on:click={runPrimaryCopy}>{t('worldEditor.command.copy', {}, $locale)}</button>
            <button aria-disabled={!primaryJobAvailability.commands.duplicate.enabled} aria-describedby={!primaryJobAvailability.commands.duplicate.enabled ? 'wep-reason-duplicate' : undefined} on:click={() => runPrimaryMutation('duplicate', 'duplicate')}>{t('worldEditor.command.duplicate', {}, $locale)}</button>
            <button aria-disabled={!primaryJobAvailability.commands.delete.enabled} aria-describedby={!primaryJobAvailability.commands.delete.enabled ? 'wep-reason-delete' : undefined} on:click={() => runPrimaryMutation('delete', 'delete')}>{t('worldEditor.command.deleteDraft', {}, $locale)}</button>
          </div>

          <h4>{t('worldEditor.inspector.attachedActions', {}, $locale)}</h4>
          {#if objectInspector.attachedState.status === 'CORE_CAPABILITY_NOT_BOUND'}
            <p class="inspector-note">
              {t('worldEditor.inspector.noCapabilityContract', {}, $locale)}
            </p>
          {:else if objectInspector.attachedState.status === 'SINGLE_OBJECT_REQUIRED'}
            <p class="inspector-note">{t('worldEditor.inspector.singleRequired', {}, $locale)}</p>
          {:else if objectInspector.attachedState.actions.length === 0}
            <p class="inspector-note">{t('worldEditor.inspector.noAttachedActions', {}, $locale)}</p>
          {:else}
            <div class="attached-actions">
              {#each objectInspector.attachedState.actions as action}
                <button disabled={!action.uiEnabled}>
                  {action.label}
                  <small>{action.uiReasonCode ?? t('worldEditor.inspector.handlerReady', {}, $locale)}</small>
                </button>
              {/each}
            </div>
          {/if}

          {#if scroogeStorePreview?.status === 'resolved'}
            <h4 data-wep-surface="store-inspector">{t('worldEditor.store.title', {}, $locale)}</h4>
            <p class="inspector-note">{t('worldEditor.store.description', {}, $locale)}</p>
            <dl class="inspector-details">
              <div><dt>{t('worldEditor.store.building', {}, $locale)}</dt><dd>{scroogeStorePreview.store.buildingItemId}</dd></div>
              <div><dt>{t('worldEditor.store.displays', {}, $locale)}</dt><dd>{scroogeStorePreview.store.displayCount}</dd></div>
              <div><dt>{t('worldEditor.store.slots', {}, $locale)}</dt><dd>{scroogeStorePreview.store.totalSlotCount}</dd></div>
              <div><dt>{t('worldEditor.store.available', {}, $locale)}</dt><dd>{scroogeStorePreview.store.availableSlotCount}</dd></div>
              <div><dt>{t('worldEditor.store.lastRefresh', {}, $locale)}</dt><dd>{scroogeStorePreview.store.lastRefresh ?? t('worldEditor.store.unknown', {}, $locale)}</dd></div>
              <div><dt>{t('worldEditor.store.weightedItems', {}, $locale)}</dt><dd>{scroogeStorePreview.store.weightedItemCount}</dd></div>
            </dl>
            <div class="attached-actions">
              {#each scroogeStorePreview.store.displays as display}
                <div class="inspector-note">
                  <strong>{t(
                    'worldEditor.store.display',
                    { displayIndex: display.displayIndex },
                    $locale
                  )}</strong>
                  <span>{t(
                    'worldEditor.store.displaySummary',
                    {
                      itemId: display.displayItemId ?? t('worldEditor.store.unknown', {}, $locale),
                      layoutType: display.layoutType ?? t('worldEditor.store.layoutUnknown', {}, $locale),
                      count: display.slots.length
                    },
                    $locale
                  )}</span>
                  {#each display.slots as slot}
                    <small>
                      [{display.displayIndex}:{slot.slotIndex}]
                      {slot.item?.status === 'resolved'
                        ? t(
                            'worldEditor.store.itemAmount',
                            { itemId: slot.item.id, amount: slot.item.amount },
                            $locale
                          )
                        : slot.item === null
                          ? t('worldEditor.store.empty', {}, $locale)
                          : t('worldEditor.store.itemUnreadable', {}, $locale)}
                      · {slot.isAvailable === true
                        ? t('worldEditor.store.available', {}, $locale)
                        : slot.isAvailable === false
                          ? t('worldEditor.store.unavailable', {}, $locale)
                          : t('worldEditor.store.availabilityUnknown', {}, $locale)}
                      · {t(
                        'worldEditor.store.currency',
                        {
                          currencyId:
                            slot.currencyId ??
                            t('worldEditor.store.unknown', {}, $locale)
                        },
                        $locale
                      )}
                    </small>
                  {/each}
                </div>
              {/each}
            </div>
          {/if}
        </section>
      </aside>

      <main class="editor-shell">
        <div class="editor-toolbar">
          <div>
            <span class="toolbar-label">{t('worldEditor.toolbar.eyebrow', {}, $locale)}</span>
            <strong>{t('worldEditor.toolbar.selectedCount', { count: selectedCount }, $locale)}</strong>
          </div>
          <div class="toolbar-actions">
            <button
              aria-disabled={!primaryJobAvailability.commands.move.enabled}
              aria-describedby={!primaryJobAvailability.commands.move.enabled ? 'wep-reason-move' : undefined}
              on:click={() => runPrimaryMutation('move', 'left')}
              aria-label={t('worldEditor.command.moveLeftAria', {}, $locale)}
            >←</button>
            <button
              aria-disabled={!primaryJobAvailability.commands.move.enabled}
              aria-describedby={!primaryJobAvailability.commands.move.enabled ? 'wep-reason-move' : undefined}
              on:click={() => runPrimaryMutation('move', 'up')}
              aria-label={t('worldEditor.command.moveUpAria', {}, $locale)}
            >↑</button>
            <button
              aria-disabled={!primaryJobAvailability.commands.move.enabled}
              aria-describedby={!primaryJobAvailability.commands.move.enabled ? 'wep-reason-move' : undefined}
              on:click={() => runPrimaryMutation('move', 'down')}
              aria-label={t('worldEditor.command.moveDownAria', {}, $locale)}
            >↓</button>
            <button
              aria-disabled={!primaryJobAvailability.commands.move.enabled}
              aria-describedby={!primaryJobAvailability.commands.move.enabled ? 'wep-reason-move' : undefined}
              on:click={() => runPrimaryMutation('move', 'right')}
              aria-label={t('worldEditor.command.moveRightAria', {}, $locale)}
            >→</button>
            <button
              aria-disabled={!primaryJobAvailability.commands.rotate.enabled}
              aria-describedby={!primaryJobAvailability.commands.rotate.enabled ? 'wep-reason-rotate' : undefined}
              on:click={() => runPrimaryMutation('rotate', 'rotate')}
            >{t('worldEditor.command.rotate', {}, $locale)}</button>
            <button
              aria-disabled={!primaryJobAvailability.commands.copy.enabled}
              aria-describedby={!primaryJobAvailability.commands.copy.enabled ? 'wep-reason-copy' : undefined}
              on:click={runPrimaryCopy}
            >{t('worldEditor.command.copy', {}, $locale)}</button>
            <button
              aria-disabled={!primaryJobAvailability.commands.paste.enabled}
              aria-describedby={!primaryJobAvailability.commands.paste.enabled ? 'wep-reason-paste' : undefined}
              on:click={runPrimaryPaste}
            >{t('worldEditor.command.paste', {}, $locale)}</button>
            <button
              aria-disabled={!primaryJobAvailability.commands.duplicate.enabled}
              aria-describedby={!primaryJobAvailability.commands.duplicate.enabled ? 'wep-reason-duplicate' : undefined}
              on:click={() => runPrimaryMutation('duplicate', 'duplicate')}
            >{t('worldEditor.command.duplicate', {}, $locale)}</button>
            <button
              aria-disabled={!primaryJobAvailability.commands.delete.enabled}
              aria-describedby={!primaryJobAvailability.commands.delete.enabled ? 'wep-reason-delete' : undefined}
              on:click={() => runPrimaryMutation('delete', 'delete')}
            >{t('worldEditor.command.delete', {}, $locale)}</button>
            <button
              aria-disabled={!primaryJobAvailability.commands.undo.enabled}
              aria-describedby={!primaryJobAvailability.commands.undo.enabled ? 'wep-reason-undo' : undefined}
              on:click={runPrimaryUndo}
            >{t('worldEditor.command.undo', {}, $locale)}</button>
            <button
              aria-disabled={!primaryJobAvailability.commands.redo.enabled}
              aria-describedby={!primaryJobAvailability.commands.redo.enabled ? 'wep-reason-redo' : undefined}
              on:click={runPrimaryRedo}
            >{t('worldEditor.command.redo', {}, $locale)}</button>
            <button
              class="save-prep"
              aria-disabled={!primaryJobAvailability.commands.reviewSavePrep.enabled}
              aria-describedby={!primaryJobAvailability.commands.reviewSavePrep.enabled ? 'wep-reason-reviewSavePrep' : undefined}
              on:click={runPrimarySavePrep}
            >{t('worldEditor.command.reviewSavePrep', {}, $locale)}</button>
            <button
              class="save-prep"
              aria-disabled={!primaryJobAvailability.commands.downloadOriginalBackup.enabled}
              aria-describedby={!primaryJobAvailability.commands.downloadOriginalBackup.enabled ? 'wep-reason-downloadOriginalBackup' : undefined}
              on:click={runPrimaryOriginalBackup}
            >{t('worldEditor.command.downloadOriginalBackup', {}, $locale)}</button>
          </div>
        </div>

        <div class="draft-status" aria-live="polite">
          <span>
            {t('worldEditor.status.draftAuthoring', {}, $locale)}
            <strong>{mutationBound
              ? t('worldEditor.status.available', {}, $locale)
              : t('worldEditor.status.readOnly', {}, $locale)}</strong>
          </span>
          <span>
            {t('worldEditor.status.lastCommand', {}, $locale)}
            <strong>{lastDraftCommand || t('worldEditor.status.none', {}, $locale)}</strong>
          </span>
          <span>
            {t('worldEditor.status.validation', {}, $locale)}
            <strong>{validationPresentation.status === 'VALID'
              ? t('worldEditor.validation.pass', {}, $locale)
              : validationPresentation.status === 'NOT_RUN'
                ? t('worldEditor.validation.notRun', {}, $locale)
                : t('worldEditor.validation.blocked', {}, $locale)}</strong>
          </span>
          <span>
            {t('worldEditor.status.clipboard', {}, $locale)}
            <strong>
              {copiedDraftClipboard?.graph?.length
                ? t(
                    'worldEditor.status.objectGraph',
                    { count: copiedDraftClipboard.graph.length },
                    $locale
                  )
                : t('worldEditor.status.empty', {}, $locale)}
            </strong>
          </span>
          <span>
            {t('worldEditor.status.originalBackup', {}, $locale)}
            <strong>
              {originalSaveBackup
                ? t(
                    'worldEditor.status.bytesReady',
                    { byteLength: originalSaveBackup.byteLength },
                    $locale
                  )
                : t('worldEditor.status.unavailable', {}, $locale)}
            </strong>
          </span>
          <span>
            {t('worldEditor.status.persistentSave', {}, $locale)}
            <strong>{t('worldEditor.status.unavailable', {}, $locale)}</strong>
          </span>
        </div>
        <div class="command-availability" aria-live="polite">
          <strong>{t('worldEditor.status.unavailableActions', {}, $locale)}</strong>
          {#each Object.entries(primaryJobAvailability.commands) as [command, state]}
            {#if !state.enabled}
              <span id={`wep-reason-${command}`}>
                <b>{commandLabelText(command)}</b>
                {commandReasonText(command, state)}
              </span>
            {/if}
          {/each}
        </div>
        {#if validationPresentation.groups.length}
          <div
            class="validation-groups"
            aria-label={t('worldEditor.validation.categoriesAria', {}, $locale)}
          >
            {#each validationPresentation.groups as group}
              <span>
                <strong>{validationGroupText(group)}</strong>
                <code>{group.codes.join(' · ')}</code>
              </span>
            {/each}
          </div>
        {/if}
        {#if draftValidation && !draftValidation.ok}
          <div class="draft-blockers">
            {#each draftValidation.issues?.filter((issue: any) => issue?.severity === 'BLOCK').slice(0, 4) ?? [] as issue}
              <span>
                <code>{issue.code}</code>
                {editorBlockerText(String(issue.code))}
              </span>
            {/each}
          </div>
        {/if}

        <div class="canvas-wrap">
          <svg
            class="world-canvas"
            viewBox={`${areaBounds.x} ${areaBounds.y} ${areaBounds.w} ${areaBounds.h}`}
            preserveAspectRatio="xMidYMid meet"
            aria-label={t('worldEditor.canvas.ariaLabel', {}, $locale)}
          >
            <defs>
              <pattern
                id="world-grid"
                width="1"
                height="1"
                patternUnits="userSpaceOnUse"
              >
                <path d="M 1 0 L 0 0 0 1" />
              </pattern>
            </defs>
            <rect
              x={areaBounds.x}
              y={areaBounds.y}
              width={areaBounds.w}
              height={areaBounds.h}
              class="canvas-bg"
            />
            <rect
              x={areaBounds.x}
              y={areaBounds.y}
              width={areaBounds.w}
              height={areaBounds.h}
              fill="url(#world-grid)"
              class="grid-overlay"
            />

            {#each projected as object}
              <g
                class:selected={selection.includes(object.editorId)}
                class:locked={object.ui.locked}
                role="button"
                tabindex={object.editorId === canvasFocusEditorId ? 0 : -1}
                aria-label={t(
                  'worldEditor.canvas.objectAria',
                  {
                    name: object.metadata?.displayName ?? object.itemId,
                    x: object.x,
                    y: object.y
                  },
                  $locale
                )}
                data-editor-object="true"
                data-editor-object-id={object.editorId}
                on:focus={() => {
                  canvasFocusEditorId = object.editorId;
                }}
                on:click|stopPropagation={(event) =>
                  selectObject(
                    object.editorId,
                    event.ctrlKey || event.metaKey || event.shiftKey
                  )}
                on:keydown={(event) => {
                  if (event.key === '[' || event.key === ']') {
                    event.preventDefault();
                    event.stopPropagation();
                    moveCanvasFocus(
                      object.editorId,
                      event.key === ']' ? 1 : -1
                    );
                    return;
                  }
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    selectObject(
                      object.editorId,
                      event.ctrlKey || event.metaKey || event.shiftKey
                    );
                  }
                }}
              >
                {#each object.footprint as cell}
                  <rect
                    x={object.x + cell.x}
                    y={object.y + cell.y}
                    width="1"
                    height="1"
                    class={`object-cell layer-${object.layer}`}
                  />
                {/each}
              </g>
            {/each}
          </svg>
        </div>

        <div class="canvas-footer">
          <span>{t('worldEditor.canvas.visibleCount', { count: projected.length }, $locale)}</span>
          <span>{t('worldEditor.canvas.mouseHelp', {}, $locale)}</span>
          <span>{t('worldEditor.canvas.keyboardHelp', {}, $locale)}</span>
          <span data-wep-surface="road-fence-labels">{t('worldEditor.canvas.roadFenceLocked', {}, $locale)}</span>
          <span>
            {originalSaveBackup
              ? t('worldEditor.canvas.backupReady', {}, $locale)
              : t('worldEditor.canvas.backupNotLoaded', {}, $locale)}
          </span>
          <span>{t('worldEditor.canvas.persistentWriteDisabled', {}, $locale)}</span>
        </div>
        {#if draftSavePreparation}
          <div class="save-preparation">
            <strong>{t('worldEditor.savePrep.title', {}, $locale)}</strong>
            <span>
              {draftSavePreparation.writeReady
                ? t('worldEditor.savePrep.writerReady', {}, $locale)
                : t('worldEditor.savePrep.blocked', {}, $locale)}
            </span>
            <code>{draftSavePreparation.reason}</code>
            <small>
              {editorBlockerText(String(draftSavePreparation.reason))}
            </small>
          </div>
        {/if}

        <section
          class="verified-export-panel"
          data-wep-verified-export
          aria-labelledby="wep-verified-export-title"
        >
          <div class="verified-export-heading">
            <div>
              <span class="toolbar-label">{t('worldEditor.verifiedExport.eyebrow', {}, $locale)}</span>
              <h3 id="wep-verified-export-title">{t('worldEditor.verifiedExport.title', {}, $locale)}</h3>
              <p>{t('worldEditor.verifiedExport.description', {}, $locale)}</p>
            </div>
            <button
              type="button"
              disabled={
                verifiedExportLoading ||
                !verifiedExportBaselineDocument ||
                !worldSourceBytes ||
                !verifiedExportBuildConfirmed
              }
              aria-describedby="wep-verified-export-review-reason"
              on:click={reviewVerifiedExport}
            >
              {verifiedExportLoading
                ? t('worldEditor.verifiedExport.working', {}, $locale)
                : t('worldEditor.verifiedExport.reviewChanges', {}, $locale)}
            </button>
          </div>

          {#if !verifiedExportBaselineDocument || !worldSourceBytes}
            <p id="wep-verified-export-review-reason" class="verified-export-note">
              {t('worldEditor.verifiedExport.areaOnly', {}, $locale)}
            </p>
          {:else}
            <p id="wep-verified-export-review-reason" class="verified-export-note">
              {t('worldEditor.verifiedExport.sourceImmutable', {}, $locale)}
            </p>
          {/if}

          {#if verifiedExportBaselineDocument && worldSourceBytes}
            <label class="verified-export-build-confirm">
              <input
                type="checkbox"
                bind:checked={verifiedExportBuildConfirmed}
                disabled={verifiedExportLoading}
              />
              <span>{t('worldEditor.verifiedExport.buildConfirm', {}, $locale)}</span>
            </label>
            {#if !verifiedExportBuildConfirmed}
              <p class="verified-export-note">
                {t('worldEditor.verifiedExport.buildConfirmRequired', {}, $locale)}
              </p>
            {/if}
          {/if}

          {#if verifiedExportErrorCode}
            <div class="verified-export-error" role="alert">
              <strong>{verifiedExportFailureText(verifiedExportErrorCode)}</strong>
              <code>{verifiedExportErrorCode}</code>
              {#if verifiedExportErrorDetail}
                <details>
                  <summary>{t('worldEditor.verifiedExport.diagnostics', {}, $locale)}</summary>
                  <code>{verifiedExportErrorDetail}</code>
                </details>
              {/if}
            </div>
          {/if}

          {#if verifiedExportReview}
            <div class="verified-export-review" aria-live="polite">
              {#if verifiedExportReview.contract === ROADFENCE_VERIFIED_EXPORT_CONTRACT}
                <div>
                  <span>{t('worldEditor.verifiedExport.operation', {}, $locale)}</span>
                  <strong>{verifiedExportReview.analysis.operation}</strong>
                </div>
                <div>
                  <span>{t('worldEditor.roadFence.kind', {}, $locale)}</span>
                  <strong>{verifiedExportReview.analysis.kind}</strong>
                </div>
                <div>
                  <span>{t('worldEditor.roadFence.network', {}, $locale)}</span>
                  <strong>{verifiedExportReview.analysis.networkId}</strong>
                </div>
                <div>
                  <span>{t('worldEditor.verifiedExport.validation', {}, $locale)}</span>
                  <strong>{t('worldEditor.verifiedExport.pass', {}, $locale)}</strong>
                </div>
              {:else}
                <div>
                  <span>{t('worldEditor.verifiedExport.operation', {}, $locale)}</span>
                  <strong>{verifiedExportReview.change.operation}</strong>
                </div>
                <div>
                  <span>{t('worldEditor.verifiedExport.object', {}, $locale)}</span>
                  <strong>{verifiedExportReview.change.editorId} · Item {verifiedExportReview.change.itemId}</strong>
                </div>
                <div>
                  <span>{t('worldEditor.verifiedExport.context', {}, $locale)}</span>
                  <strong>
                    Area {verifiedExportReview.baselineTarget.areaId} ·
                    Grid {verifiedExportReview.change.gridId}
                  </strong>
                </div>
                <div>
                  <span>{t('worldEditor.verifiedExport.validation', {}, $locale)}</span>
                  <strong>{t('worldEditor.verifiedExport.pass', {}, $locale)}</strong>
                </div>
                {#if verifiedExportReview.change.operation === 'MOVE'}
                  <div class="verified-export-delta">
                    <span>{t('worldEditor.verifiedExport.previousPosition', {}, $locale)}</span>
                    <strong>X {verifiedExportReview.change.before.x} · Y {verifiedExportReview.change.before.y}</strong>
                    <span>{t('worldEditor.verifiedExport.newPosition', {}, $locale)}</span>
                    <strong>X {verifiedExportReview.change.after.x} · Y {verifiedExportReview.change.after.y}</strong>
                  </div>
                {:else if verifiedExportReview.change.operation === 'ADD'}
                  <div class="verified-export-delta" data-wep-verified-add-review>
                    <span>{t('worldEditor.verifiedExport.newPosition', {}, $locale)}</span>
                    <strong>X {verifiedExportReview.change.after.x} · Y {verifiedExportReview.change.after.y}</strong>
                    <span>{t('worldEditor.verifiedExport.newOrientation', {}, $locale)}</span>
                    <strong>{verifiedExportReview.change.after.orientation}</strong>
                    <span>ID</span>
                    <strong>{verifiedExportReview.admissibility.target.createdGridObjectId}</strong>
                  </div>
                {:else}
                  <div class="verified-export-delta">
                    <span>{t('worldEditor.verifiedExport.previousOrientation', {}, $locale)}</span>
                    <strong>{verifiedExportReview.change.before.orientation}</strong>
                    <span>{t('worldEditor.verifiedExport.newOrientation', {}, $locale)}</span>
                    <strong>{verifiedExportReview.change.after.orientation}</strong>
                  </div>
                {/if}
              {/if}
              <label class="verified-export-confirm">
                <input
                  type="checkbox"
                  bind:checked={verifiedExportConfirmed}
                  disabled={verifiedExportLoading}
                />
                <span>{t('worldEditor.verifiedExport.confirm', {}, $locale)}</span>
              </label>
              <button
                type="button"
                class="verified-export-apply"
                disabled={!verifiedExportConfirmed || verifiedExportLoading}
                aria-describedby={!verifiedExportConfirmed ? 'wep-verified-export-confirm-reason' : undefined}
                on:click={applyVerifiedExport}
              >
                {t('worldEditor.verifiedExport.applyExport', {}, $locale)}
              </button>
              {#if !verifiedExportConfirmed}
                <small id="wep-verified-export-confirm-reason">
                  {t('worldEditor.verifiedExport.confirmRequired', {}, $locale)}
                </small>
              {/if}
            </div>
          {/if}

          {#if verifiedExportResult}
            <div class="verified-export-success" aria-live="polite">
              <strong>{t('worldEditor.verifiedExport.success', {}, $locale)}</strong>
              <p>{t('worldEditor.verifiedExport.successDetail', {}, $locale)}</p>
              <dl>
                <div>
                  <dt>{t('worldEditor.verifiedExport.editedHash', {}, $locale)}</dt>
                  <dd><code>{verifiedExportResult.artifacts.edited.sha256}</code></dd>
                </div>
                <div>
                  <dt>{t('worldEditor.verifiedExport.backupHash', {}, $locale)}</dt>
                  <dd><code>{verifiedExportResult.artifacts.backup.sha256}</code></dd>
                </div>
                <div>
                  <dt>{t('worldEditor.verifiedExport.reload', {}, $locale)}</dt>
                  <dd>
                    {#if verifiedExportResult.contract === ROADFENCE_VERIFIED_EXPORT_CONTRACT}
                      {verifiedExportResult.reload.status} ·
                      {verifiedExportResult.reload.kind} ·
                      {verifiedExportResult.reload.operation}
                    {:else}
                      {verifiedExportResult.reload.status} · Grid {verifiedExportResult.reload.gridId} · Object {verifiedExportResult.reload.gridObjectId}
                    {/if}
                  </dd>
                </div>
              </dl>
              <div class="verified-export-downloads">
                <button type="button" on:click={() => downloadVerifiedArtifact(verifiedExportResult.artifacts.edited)}>
                  {t('worldEditor.verifiedExport.downloadEdited', {}, $locale)}
                </button>
                <button type="button" on:click={() => downloadVerifiedArtifact(verifiedExportResult.artifacts.backup)}>
                  {t('worldEditor.verifiedExport.downloadBackup', {}, $locale)}
                </button>
                <button type="button" on:click={() => downloadVerifiedArtifact(verifiedExportResult.artifacts.bundle)}>
                  {t('worldEditor.verifiedExport.downloadBundle', {}, $locale)}
                </button>
                <button type="button" on:click={() => downloadVerifiedArtifact(verifiedExportResult.artifacts.integrity)}>
                  {t('worldEditor.verifiedExport.downloadManifest', {}, $locale)}
                </button>
              </div>
              <p class="verified-export-recovery">
                {t('worldEditor.verifiedExport.recovery', {}, $locale)}
              </p>
            </div>
          {/if}
        </section>
      </main>
    </div>

    {#if editorDocument && mutationBound && roadFenceReaderBinding?.summary?.status === 'supported'}
      <section
        class="road-fence-authoring-panel"
        data-wep-roadfence-authoring
        aria-labelledby="road-fence-authoring-title"
      >
        <div class="road-fence-authoring-heading">
          <div>
            <p class="eyebrow">{t('worldEditor.roadFence.eyebrow', {}, $locale)}</p>
            <h2 id="road-fence-authoring-title">{t('worldEditor.roadFence.title', {}, $locale)}</h2>
            <p>{t('worldEditor.roadFence.description', {}, $locale)}</p>
          </div>
          <div class="full-design-gates">
            <span>{t('worldEditor.fence.topology', {}, $locale)} <strong>{t('worldEditor.fence.separateOperation', {}, $locale)}</strong></span>
            <span>{t('worldEditor.fence.ddvWrite', {}, $locale)} <strong>{t('worldEditor.fence.disabled', {}, $locale)}</strong></span>
          </div>
        </div>

        <div class="road-fence-authoring-grid">
          <div class="road-fence-authoring-form">
            <label>
              <span>{t('worldEditor.roadFence.kind', {}, $locale)}</span>
              <select
                value={rfKind}
                on:change={(event) => {
                  rfKind = (event.currentTarget as HTMLSelectElement).value as 'road' | 'fence';
                  rfNetworkId = '';
                  syncRoadFenceSelection({ preferKind: rfKind });
                }}
              >
                <option value="road">{t('worldEditor.fullDesign.category.roads', {}, $locale)}</option>
                <option value="fence">{t('worldEditor.fullDesign.category.fences', {}, $locale)}</option>
              </select>
            </label>

            <label>
              <span>{t('worldEditor.roadFence.network', {}, $locale)}</span>
              <select
                value={rfNetworkId}
                on:change={(event) => {
                  rfNetworkId = (event.currentTarget as HTMLSelectElement).value;
                  syncRoadFenceSelection({ preferKind: rfKind });
                }}
              >
                <option value="">—</option>
                {#each roadFenceNetworks(rfKind) as network}
                  <option value={network.networkId}>
                    {network.networkId} · {network.familyBaseItemID}
                  </option>
                {/each}
              </select>
            </label>

            <label>
              <span>{t('worldEditor.roadFence.family', {}, $locale)}</span>
              <input type="number" min="1" bind:value={rfFamilyBaseItemID} />
            </label>

            {#if rfKind === 'fence'}
              <label>
                <span>{t('worldEditor.roadFence.mode', {}, $locale)}</span>
                <select bind:value={rfMode}>
                  <option value="orthogonal">{t('worldEditor.roadFence.orthogonal', {}, $locale)}</option>
                  <option value="diagonal">{t('worldEditor.roadFence.diagonal', {}, $locale)}</option>
                </select>
              </label>
            {/if}

            <label class="road-fence-points">
              <span>{t('worldEditor.roadFence.points', {}, $locale)}</span>
              <textarea rows="2" bind:value={rfPoints}></textarea>
            </label>

            <label>
              <span>{t('worldEditor.roadFence.targetFamily', {}, $locale)}</span>
              <input type="number" min="1" bind:value={rfTargetFamilyBaseItemID} />
            </label>

            {#if rfKind === 'road'}
              <label>
                <span>{t('worldEditor.scene.x', {}, $locale)}</span>
                <input type="number" bind:value={rfSeedX} />
              </label>
              <label>
                <span>{t('worldEditor.scene.y', {}, $locale)}</span>
                <input type="number" bind:value={rfSeedY} />
              </label>
            {:else}
              <label>
                <span>{t('worldEditor.roadFence.seedNode', {}, $locale)}</span>
                <input bind:value={rfSeedNodeId} />
              </label>
              <label>
                <span>{t('worldEditor.roadFence.adjacentNode', {}, $locale)}</span>
                <input bind:value={rfAdjacentNodeId} />
              </label>
            {/if}

            <label>
              <span>{t('worldEditor.roadFence.translateX', {}, $locale)}</span>
              <input type="number" bind:value={rfTranslateX} />
            </label>
            <label>
              <span>{t('worldEditor.roadFence.translateY', {}, $locale)}</span>
              <input type="number" bind:value={rfTranslateY} />
            </label>
            <label>
              <span>{t('worldEditor.roadFence.quarterTurns', {}, $locale)}</span>
              <input type="number" min="-3" max="3" bind:value={rfRotateQuarterTurns} />
            </label>
          </div>

          <div class="road-fence-authoring-actions">
            <button
              on:click={() => {
                rfTool = 'polyline';
                drawRoadFenceDraft();
              }}
            >{t('worldEditor.roadFence.polyline', {}, $locale)}</button>
            <button
              on:click={() => {
                rfTool = 'rectangle';
                drawRoadFenceDraft();
              }}
            >{t('worldEditor.roadFence.rectangle', {}, $locale)}</button>
            <button disabled={!rfNetworkId} on:click={previewRoadFenceConnected}>
              {t('worldEditor.roadFence.connected', {}, $locale)}
            </button>
            <button
              disabled={rfKind !== 'fence' || !rfNetworkId || !rfSeedNodeId || !rfAdjacentNodeId}
              on:click={previewFenceSegment}
            >{t('worldEditor.roadFence.segment', {}, $locale)}</button>
            <button disabled={!rfNetworkId} on:click={eyedropRoadFence}>
              {t('worldEditor.roadFence.eyedropper', {}, $locale)}
            </button>
            <button disabled={!rfNetworkId} on:click={replaceRoadFenceStyle}>
              {t('worldEditor.roadFence.replaceStyle', {}, $locale)}
            </button>
            <button disabled={!rfNetworkId} on:click={deleteRoadFenceUnit}>
              {t('worldEditor.roadFence.erase', {}, $locale)}
            </button>
            <button disabled={!rfNetworkId} on:click={transformRoadFenceDraft}>
              {t('worldEditor.roadFence.transform', {}, $locale)}
            </button>
          </div>

          <div class="road-fence-authoring-status" aria-live="polite">
            <strong>{t('worldEditor.roadFence.previewOnly', {}, $locale)}</strong>
            <span>{rfMessage || t('worldEditor.fence.writerUnauthorized', {}, $locale)}</span>
            {#if rfPreview}
              <code>persistentWriteAuthorized={String(rfPreview.persistentWriteAuthorized === true)}</code>
            {/if}
          </div>
        </div>
      </section>
    {/if}

    {#if fencePostNetworks.length}
      <section class="fence-post-panel" aria-labelledby="fence-post-title">
        <div class="fence-post-heading">
          <div>
            <p class="eyebrow">{t('worldEditor.fence.eyebrow', {}, $locale)}</p>
            <h2 id="fence-post-title">{t('worldEditor.fence.title', {}, $locale)}</h2>
            <p>{t('worldEditor.fence.description', {}, $locale)}</p>
          </div>
          <div class="full-design-gates">
            <span>{t('worldEditor.fence.topology', {}, $locale)} <strong>{t('worldEditor.fence.separateOperation', {}, $locale)}</strong></span>
            <span>{t('worldEditor.fence.ddvWrite', {}, $locale)} <strong>{t('worldEditor.fence.disabled', {}, $locale)}</strong></span>
            <span>{t('worldEditor.fence.scenePreset', {}, $locale)} <strong>{t('worldEditor.fence.blockedAfterEdit', {}, $locale)}</strong></span>
          </div>
        </div>

        <div class="fence-post-controls">
          <label>
            <span>{t('worldEditor.fence.network', {}, $locale)}</span>
            <select
              value={fencePostSelectedNetworkId}
              on:change={(event) =>
                loadFencePostDraft(
                  (event.currentTarget as HTMLSelectElement).value
                )}
            >
              {#each fencePostNetworks as network}
                <option value={network.networkId}>
                  {network.familyName || network.familyBaseItemID} · {network.mode} · q{network.logicalQuantity}
                </option>
              {/each}
            </select>
          </label>

          {#if fencePostDraft && fencePostValidation}
            <div class="fence-post-summary">
              <span>
                {t('worldEditor.fence.maxInterval', {}, $locale)}
                <strong>{fencePostValidation.constraints?.maximumPostInterval ?? '—'}</strong>
                <small>{t('worldEditor.fence.catalogDerived', {}, $locale)}</small>
              </span>
              <span>
                {t('worldEditor.fence.semanticAnchors', {}, $locale)}
                <strong>{fencePostDraft.logicalTopology?.semanticAnchors?.length ?? 0}</strong>
              </span>
              <span>
                {t('worldEditor.fence.representationPosts', {}, $locale)}
                <strong>{fencePostDraft.representationLayout?.posts?.length ?? 0}</strong>
              </span>
              <span>
                {t('worldEditor.fence.representationMode', {}, $locale)}
                <strong>
                  {fencePostDraft.representationLayout?.intent === 'EXACT_PRESERVATION'
                    ? t('worldEditor.fence.exactPreservation', {}, $locale)
                    : t('worldEditor.fence.generatedDesign', {}, $locale)}
                </strong>
                <small>{fencePostDraft.representationLayout?.policy}</small>
              </span>
              <span>
                {t('worldEditor.fence.corePreflight', {}, $locale)}
                <strong>{fencePostValidation.ok
                  ? t('worldEditor.validation.pass', {}, $locale)
                  : t('worldEditor.fullDesign.blockedCaps', {}, $locale)}</strong>
              </span>
            </div>

            <div class="fence-post-editor-grid">
              <div class="fence-post-form">
                <label>
                  <span>{t('worldEditor.fence.post', {}, $locale)}</span>
                  <select bind:value={fencePostMoveNodeId}>
                    <option value="">{t('worldEditor.fence.choosePost', {}, $locale)}</option>
                    {#each fencePostDraft.representationLayout?.posts ?? [] as post}
                      <option value={post.nodeId}>
                        ({post.x}, {post.y}) {post.pinned
                          ? t('worldEditor.fence.pinnedSuffix', {}, $locale)
                          : ''}
                      </option>
                    {/each}
                  </select>
                </label>
                <label>
                  <span>{t('worldEditor.scene.x', {}, $locale)}</span>
                  <input type="number" bind:value={fencePostEditX} />
                </label>
                <label>
                  <span>{t('worldEditor.scene.y', {}, $locale)}</span>
                  <input type="number" bind:value={fencePostEditY} />
                </label>
                <button on:click={insertFencePostDraft}>{t('worldEditor.fence.insertPost', {}, $locale)}</button>
                <button
                  disabled={!fencePostMoveNodeId}
                  on:click={moveFencePostDraft}
                >{t('worldEditor.fence.movePost', {}, $locale)}</button>
                <button on:click={autoLayoutFencePosts}>
                  {t('worldEditor.fence.centeredAutoLayout', {}, $locale)}
                </button>
              </div>

              <div class="fence-post-list">
                {#each fencePostDraft.representationLayout?.posts ?? [] as post}
                  <div>
                    <code>{post.x}, {post.y}</code>
                    <span>{post.source}</span>
                    <button
                      on:click={() =>
                        toggleFencePostPinned(post.nodeId, !post.pinned)}
                    >{post.pinned
                      ? t('worldEditor.fence.unpin', {}, $locale)
                      : t('worldEditor.fence.pin', {}, $locale)}</button>
                    <button on:click={() => removeFencePostDraft(post.nodeId)}>
                      {t('worldEditor.fence.removePost', {}, $locale)}
                    </button>
                  </div>
                {/each}
              </div>
            </div>

            {#if !fencePostValidation.ok}
              <div class="full-design-destination-issues">
                {#each fencePostValidation.issues as issue}
                  <span>
                    <code>{issue.code}</code>
                    {issue.maximumPostInterval
                      ? t(
                          'worldEditor.fence.maximum',
                          { value: issue.maximumPostInterval },
                          $locale
                        )
                      : issue.distance
                        ? t(
                            'worldEditor.fence.interval',
                            { value: issue.distance },
                            $locale
                          )
                        : ''}
                  </span>
                {/each}
              </div>
            {/if}

            {#if fencePostMessage}
              <small>{fencePostMessage}</small>
            {/if}

            <div class="fence-topology-boundary">
              <strong>{t('worldEditor.fence.topologyEdit', {}, $locale)}</strong>
              <span>{t('worldEditor.fence.topologyBoundary', {}, $locale)}</span>
              <button disabled>{t('worldEditor.fence.writerUnauthorized', {}, $locale)}</button>
            </div>
          {/if}
        </div>
      </section>
    {/if}

    {#if worldSource && (fullDesignPlan || fullDesignPlanError)}
      <section class="full-design-panel" aria-labelledby="full-design-title">
        <div class="full-design-heading">
          <div>
            <p class="eyebrow">{t('worldEditor.fullDesign.eyebrow', {}, $locale)}</p>
            <h2 id="full-design-title">
              {fullDesignPlan?.presetType === 'floating_island'
                ? t('worldEditor.fullDesign.floatingPlan', {}, $locale)
                : t('worldEditor.fullDesign.biomePlan', {}, $locale)}
            </h2>
            <p>{t('worldEditor.fullDesign.description', {}, $locale)}</p>
          </div>
          <div class="full-design-gates">
            <span>
              {t('worldEditor.fullDesign.sourceArtifact', {}, $locale)}
              <strong>{fullDesignPlan?.publicationCandidateReady
                ? t('worldEditor.fullDesign.candidateReady', {}, $locale)
                : t('worldEditor.fullDesign.blocked', {}, $locale)}</strong>
            </span>
            <span>{t('worldEditor.fullDesign.communityPublish', {}, $locale)} <strong>{t('worldEditor.fullDesign.notBound', {}, $locale)}</strong></span>
            <span>{t('worldEditor.fullDesign.apply', {}, $locale)} <strong>{t('worldEditor.fullDesign.disabled', {}, $locale)}</strong></span>
          </div>
        </div>

        {#if fullDesignPlan}
          <div class="full-design-summary">
            <div>
              <span>{t('worldEditor.fullDesign.semanticTarget', {}, $locale)}</span>
              <strong>{fullDesignIdentityLabel(fullDesignPlan)}</strong>
            </div>
            <div>
              <span>{t('worldEditor.fullDesign.portableDirectRoots', {}, $locale)}</span>
              <strong>{fullDesignPlan.directRootRoutes.length}</strong>
            </div>
            <div>
              <span>{t('worldEditor.fullDesign.manifestV1', {}, $locale)}</span>
              <strong>{fullDesignPlan.manifestValidation?.ok
                ? t('worldEditor.fullDesign.strictPass', {}, $locale)
                : t('worldEditor.fullDesign.blocked', {}, $locale)}</strong>
            </div>
            <div>
              <span>{t('worldEditor.fullDesign.sourceCategories', {}, $locale)}</span>
              <strong>{fullDesignPlan.sourceCategoryClosureReady
                ? t('worldEditor.fullDesign.closed', {}, $locale)
                : t('worldEditor.fullDesign.blocked', {}, $locale)}</strong>
            </div>
            <div>
              <span>{t('worldEditor.fullDesign.exactBuild', {}, $locale)}</span>
              <strong>{t('worldEditor.fullDesign.unprovenFromSave', {}, $locale)}</strong>
            </div>
            <div>
              <span>{t('worldEditor.fullDesign.persistentWrite', {}, $locale)}</span>
              <strong>{t('worldEditor.fullDesign.unauthorized', {}, $locale)}</strong>
            </div>
          </div>

          <div class="full-design-routes">
            <span>{t('worldEditor.fullDesign.routes', {}, $locale)}</span>
            {#each fullDesignPlan.directRootRoutes as route}
              <code>{route.gridDataPath}</code>
            {/each}
          </div>

          <div class="full-design-categories">
            {#each fullDesignCategoryEntries(fullDesignPlan) as [categoryKey, category]}
              <article class:blocked={category.disposition === 'blocked' || category.disposition === 'excluded'}>
                <div>
                  <span>{fullDesignCategoryLabel(categoryKey)}</span>
                  <strong>{fullDesignDispositionLabel(category)}</strong>
                </div>
                {#if fullDesignCategoryDetail(categoryKey, category)}
                  <small>{fullDesignCategoryDetail(categoryKey, category)}</small>
                {/if}
                {#if categoryKey === 'buildings' && category?.ordinaryPlacement}
                  <div class="building-readiness-lines">
                    <span>
                      {t('worldEditor.fullDesign.v110Classes', {}, $locale)}
                      <strong>{t(
                        'worldEditor.fullDesign.classCounts',
                        {
                          ordinary: category.classificationSummary?.ordinary ?? 0,
                          special: category.classificationSummary?.special ?? 0,
                          offGrid: category.classificationSummary?.offGrid ?? 0,
                          unknown: category.classificationSummary?.unknown ?? 0
                        },
                        $locale
                      )}</strong>
                    </span>
                    <span>
                      {t('worldEditor.fullDesign.ordinaryPlacement', {}, $locale)}
                      <strong>
                        {category.ordinaryPlacement.destinationPlacementStatus === 'NOT_APPLICABLE'
                          ? t('worldEditor.fullDesign.noBuildingShort', {}, $locale)
                          : category.ordinaryPlacement.destinationPlacementStatus === 'PREFLIGHT_CONTRACT_AVAILABLE'
                            ? t('worldEditor.fullDesign.typedPreflightAvailable', {}, $locale)
                            : t('worldEditor.fullDesign.blockedTypedEvidence', {}, $locale)}
                      </strong>
                    </span>
                    <span>
                      {t('worldEditor.fullDesign.buildingSkin', {}, $locale)}
                      <strong>
                        {category.buildingSkins?.entries?.length ?? 0} ·
                        {category.buildingSkins?.semanticStatus ?? 'UNKNOWN'}
                      </strong>
                    </span>
                    <span>
                      {t('worldEditor.fullDesign.playerHouse', {}, $locale)}
                      <strong>
                        {category.playerHouses?.entries?.length ?? 0} ·
                        {category.playerHouses?.semanticStatus ?? 'UNKNOWN'}
                      </strong>
                    </span>
                  </div>
                {/if}
                <small>
                  {category.blockers?.length
                    ? fullDesignBlockerText(category.blockers[0])
                    : t('worldEditor.fullDesign.noCategoryBlocker', {}, $locale)}
                </small>
              </article>
            {/each}
          </div>

          <p class="full-design-boundary">
            {t('worldEditor.fullDesign.boundary', {}, $locale)}
          </p>

          <div class="full-design-destination">
            <div class="full-design-destination-copy">
              <div>
                <span>{t('worldEditor.fullDesign.destinationPreflight', {}, $locale)}</span>
                <strong>{fullDesignDestinationStatus(fullDesignDestinationPreflight)}</strong>
              </div>
              <p>{t('worldEditor.fullDesign.destinationDescription', {}, $locale)}</p>
            </div>

            <label class="file-button full-design-destination-button">
              {fullDesignDestinationLoading
                ? t('worldEditor.fullDesign.checking', {}, $locale)
                : t('worldEditor.fullDesign.checkDestination', {}, $locale)}
              <input
                type="file"
                accept=".json,.save,application/json,application/octet-stream"
                disabled={fullDesignDestinationLoading}
                on:change={openFullDesignDestination}
              />
            </label>

            {#if fullDesignDestinationFileName}
              <div class="full-design-destination-result">
                <span>{t('worldEditor.fullDesign.destination', {}, $locale)}</span>
                <code>{fullDesignDestinationFileName}</code>
                {#if fullDesignDestinationPreflight}
                  <strong>
                    {t(
                      'worldEditor.fullDesign.routesCount',
                      {
                        resolved: fullDesignDestinationPreflight.destination?.directRootResolutions?.length ?? 0,
                        total: fullDesignPlan.directRootRoutes.length
                      },
                      $locale
                    )}
                  </strong>
                  <strong>
                    {t('worldEditor.fullDesign.roadFencePreflight', {}, $locale)}
                    {fullDesignDestinationPreflight.roadFenceModelPreflightReady
                      ? t(
                          'worldEditor.fullDesign.roadFencePass',
                          {
                            count:
                              fullDesignDestinationPreflight.destination?.roadFencePreflight?.bindings?.length ?? 0
                          },
                          $locale
                        )
                      : t('worldEditor.fullDesign.blockedCaps', {}, $locale)}
                  </strong>
                  <strong>
                    {t('worldEditor.fullDesign.buildingContract', {}, $locale)}
                    {fullDesignDestinationPreflight.buildingV110ContractBound
                      ? t('worldEditor.fullDesign.bound', {}, $locale)
                      : t('worldEditor.fullDesign.notBoundCaps', {}, $locale)}
                  </strong>
                  <strong>
                    {t('worldEditor.fullDesign.buildingTypedPreflight', {}, $locale)}
                    {fullDesignDestinationPreflight.buildingV110TypedPreflightReady
                      ? t('worldEditor.fullDesign.passNA', {}, $locale)
                      : t('worldEditor.fullDesign.blockedCaps', {}, $locale)}
                  </strong>
                  <strong>
                    {t('worldEditor.fullDesign.ordinaryBuildingPlacement', {}, $locale)}
                    {fullDesignDestinationPreflight.ordinaryBuildingPlacementReady
                      ? t('worldEditor.fullDesign.passNA', {}, $locale)
                      : t('worldEditor.fullDesign.blockedCaps', {}, $locale)}
                  </strong>
                  <strong>
                    {t('worldEditor.fullDesign.buildingSkinDiagnostic', {}, $locale)}
                    {fullDesignDestinationPreflight.buildingSkinPreflightReady
                      ? t('worldEditor.fullDesign.passNA', {}, $locale)
                      : t('worldEditor.fullDesign.blockedCaps', {}, $locale)}
                  </strong>
                  <strong>
                    {t('worldEditor.fullDesign.playerHouseDiagnostic', {}, $locale)}
                    {fullDesignDestinationPreflight.playerHouseBindingPreflightReady
                      ? t('worldEditor.fullDesign.passNA', {}, $locale)
                      : t('worldEditor.fullDesign.lifecycleBlocked', {}, $locale)}
                  </strong>
                  <strong>
                    {t('worldEditor.fullDesign.environment', {}, $locale)}
                    {fullDesignDestinationPreflight.environmentPreflightReady
                      ? t('worldEditor.validation.pass', {}, $locale)
                      : t('worldEditor.fullDesign.blockedCaps', {}, $locale)}
                  </strong>
                  <strong>
                    {t('worldEditor.fullDesign.routeResolved', {}, $locale)}
                    {fullDesignDestinationPreflight.routeResolutionReady
                      ? t('worldEditor.validation.pass', {}, $locale)
                      : t('worldEditor.fullDesign.blockedCaps', {}, $locale)}
                  </strong>
                  <strong>
                    {t('worldEditor.fullDesign.boundsValidated', {}, $locale)}
                    {fullDesignDestinationPreflight.destination?.rootObjectRouteBindings?.length
                      ? t(
                          'worldEditor.fullDesign.ratio',
                          {
                            valid:
                              fullDesignDestinationPreflight.destination.rootObjectRouteBindings.filter(
                                (entry: any) => entry.boundsValidated
                              ).length,
                            total:
                              fullDesignDestinationPreflight.destination.rootObjectRouteBindings.length
                          },
                          $locale
                        )
                      : t('worldEditor.fullDesign.noPortableObjects', {}, $locale)}
                  </strong>
                  <strong>
                    {t('worldEditor.fullDesign.placementValidated', {}, $locale)}
                    {fullDesignDestinationPreflight.nativePlacementContractBound
                      ? fullDesignNativePlacementSummary(fullDesignDestinationPreflight)
                      : t('worldEditor.fullDesign.contractNotBound', {}, $locale)}
                  </strong>
                  <strong>
                    {t('worldEditor.fullDesign.ddvWriteAuthorization', {}, $locale)}
                    {fullDesignDestinationPreflight.ddvWriteAuthorized
                      ? t('worldEditor.fullDesign.authorizedCaps', {}, $locale)
                      : t('worldEditor.fullDesign.unauthorizedCaps', {}, $locale)}
                  </strong>
                  <strong>
                    {t('worldEditor.fullDesign.categoryClosure', {}, $locale)}
                    {fullDesignDestinationPreflight.categoryClosureReady
                      ? t('worldEditor.validation.pass', {}, $locale)
                      : t('worldEditor.fullDesign.blockedCaps', {}, $locale)}
                  </strong>
                {/if}
              </div>
            {/if}

            {#if fullDesignDestinationPreflight?.issues?.length}
              <div class="full-design-destination-issues">
                {#each fullDesignDestinationPreflight.issues.slice(0, 5) as issue}
                  <span>
                    <code>{issue.code}</code>
                    {fullDesignDestinationIssueText(issue)}
                  </span>
                {/each}
              </div>
            {/if}

            {#if fullDesignDestinationError}
              <div class="full-design-error">
                <strong>{t('worldEditor.fullDesign.destinationBlockedTitle', {}, $locale)}</strong>
                <code>{fullDesignDestinationError}</code>
              </div>
            {/if}

            <small>{t('worldEditor.fullDesign.preflightBoundary', {}, $locale)}</small>
          </div>
        {:else}
          <div class="full-design-error">
            <strong>{t('worldEditor.fullDesign.planningBlockedTitle', {}, $locale)}</strong>
            <code>{fullDesignPlanError}</code>
            <span>{t('worldEditor.fullDesign.canvasReadOnly', {}, $locale)}</span>
          </div>
        {/if}
      </section>
    {/if}

    <section class="capture-panel">
      <div class="capture-copy">
        <p class="eyebrow">{t('worldEditor.scene.eyebrow', {}, $locale)}</p>
        <h2>{t('worldEditor.scene.title', {}, $locale)}</h2>
        <p>{t('worldEditor.scene.description', {}, $locale)}</p>
      </div>

      <div class="capture-form">
        <label>
          <span>{t('worldEditor.scene.fieldTitle', {}, $locale)}</span>
          <input bind:value={presetTitle} placeholder={t('worldEditor.scene.titlePlaceholder', {}, $locale)} />
        </label>
        <label>
          <span>{t('worldEditor.scene.fieldDescription', {}, $locale)}</span>
          <textarea
            bind:value={presetDescription}
            rows="3"
            placeholder={t('worldEditor.scene.descriptionPlaceholder', {}, $locale)}
          ></textarea>
        </label>
        <label>
          <span>{t('worldEditor.scene.visibility', {}, $locale)}</span>
          <select bind:value={visibility}>
            <option value="unlisted">{t('worldEditor.scene.unlisted', {}, $locale)}</option>
            <option value="public">{t('worldEditor.scene.public', {}, $locale)}</option>
            <option value="private">{t('worldEditor.scene.private', {}, $locale)}</option>
          </select>
        </label>

        <div class="capture-region-options">
          <label>
            <span>{t('worldEditor.scene.captureRegion', {}, $locale)}</span>
            <select
              bind:value={captureRegionMode}
              on:change={() => {
                capturePreview = null;
                published = null;
              }}
            >
              <option value="selection">{t('worldEditor.scene.selectedBounds', {}, $locale)}</option>
              <option value="custom">{t('worldEditor.scene.customRegion', {}, $locale)}</option>
            </select>
          </label>
          <button
            type="button"
            disabled={!selectedCount}
            on:click={useSelectedCaptureRegion}
          >{t('worldEditor.scene.useSelectedBounds', {}, $locale)}</button>
          {#if captureRegionMode === 'custom'}
            <div class="capture-region-grid">
              <label>
                <span>X</span>
                <input type="number" step="1" bind:value={captureRegionX} />
              </label>
              <label>
                <span>Y</span>
                <input type="number" step="1" bind:value={captureRegionY} />
              </label>
              <label>
                <span>{t('worldEditor.scene.width', {}, $locale)}</span>
                <input type="number" min="1" step="1" bind:value={captureRegionW} />
              </label>
              <label>
                <span>{t('worldEditor.scene.height', {}, $locale)}</span>
                <input type="number" min="1" step="1" bind:value={captureRegionH} />
              </label>
            </div>
          {/if}
          <small>{t('worldEditor.scene.regionNote', {}, $locale)}</small>
        </div>

        <div class="network-capture-options">
          <label>
            <input
              type="checkbox"
              bind:checked={includeRoads}
              disabled={roadFenceReaderBinding?.summary?.status !== 'supported'}
            />
            <span>{t('worldEditor.scene.includeRoads', {}, $locale)}</span>
          </label>
          <label>
            <input
              type="checkbox"
              bind:checked={includeFences}
              disabled={roadFenceReaderBinding?.summary?.status !== 'supported'}
            />
            <span>{t('worldEditor.scene.includeFences', {}, $locale)}</span>
          </label>
          <small>
            {t('worldEditor.scene.networkNote', {}, $locale)}
            <code>TOPOLOGY_CLIPPED_UNSUPPORTED</code>
          </small>
        </div>

        <div class="capture-actions">
          <button
            disabled={!selectedCount || loading}
            on:click={previewScene}
          >{t('worldEditor.scene.capturePreview', {}, $locale)}</button>
          <button
            class="publish"
            disabled={
              !capturePreview?.publicationReady ||
              !connected ||
              !creatorProfileId ||
              !presetTitle.trim() ||
              loading
            }
            on:click={publishScene}
          >{t('worldEditor.scene.publish', {}, $locale)}</button>
        </div>
      </div>

      <div class="capture-status">
        <div>
          <span>{t('worldEditor.scene.capture', {}, $locale)}</span>
          <strong>
            {capturePreview
              ? capturePreview.publicationReady
                ? t('worldEditor.scene.ready', {}, $locale)
                : t('worldEditor.scene.blocked', {}, $locale)
              : t('worldEditor.scene.notRun', {}, $locale)}
          </strong>
        </div>
        <div>
          <span>{t('worldEditor.scene.community', {}, $locale)}</span>
          <strong>{connected && creatorProfileId
            ? t('worldEditor.scene.connected', {}, $locale)
            : t('worldEditor.scene.signInRequired', {}, $locale)}</strong>
        </div>
        <div>
          <span>{t('worldEditor.scene.roadsFences', {}, $locale)}</span>
          <strong>
            {roadFenceReaderBinding?.summary?.status === 'supported'
              ? t(
                  'worldEditor.scene.readerBound',
                  {
                    roadCount: roadFenceReaderBinding.summary.roadNetworkCount,
                    fenceCount: roadFenceReaderBinding.summary.fenceNetworkCount
                  },
                  $locale
                )
              : t('worldEditor.scene.rawSwitchRequired', {}, $locale)}
          </strong>
        </div>
        <div>
          <span>{t('worldEditor.scene.ddvWrite', {}, $locale)}</span>
          <strong>{t('worldEditor.scene.disabled', {}, $locale)}</strong>
        </div>
      </div>

      {#if capturePreview}
        <div class="artifact-summary">
          <strong>{t('worldEditor.scene.artifactPreview', {}, $locale)}</strong>
          <span>{t('worldEditor.scene.objectsCount', { count: capturePreview.artifact.objects.length }, $locale)}</span>
          <span>{t(
            'worldEditor.scene.itemTypesCount',
            { count: Object.keys(capturePreview.artifact.requirements.itemQuantities).length },
            $locale
          )}</span>
          <span>{t(
            'worldEditor.scene.bounds',
            {
              width: capturePreview.artifact.bounds.w,
              height: capturePreview.artifact.bounds.h
            },
            $locale
          )}</span>
          {#if capturePreview.artifact.networks?.roads}
            <span>{t('worldEditor.scene.roadNetworksCount', { count: capturePreview.artifact.networks.roads.networks.length }, $locale)}</span>
          {/if}
          {#if capturePreview.artifact.networks?.fences}
            <span>{t('worldEditor.scene.fenceNetworksCount', { count: capturePreview.artifact.networks.fences.networks.length }, $locale)}</span>
          {/if}
        </div>
      {/if}

      {#if published}
        <div class="published-card">
          <p class="eyebrow">{t('worldEditor.scene.published', {}, $locale)}</p>
          <strong>{presetTitle}</strong>
          <code>{published.presetArtifactId}</code>
          <a href={`${base}/presets/`}>{t('worldEditor.nav.viewPublishedPreset', {}, $locale)}</a>
        </div>
      {/if}
    </section>
  {:else if worldSource}
    <section class="save-source-browser">
      <div class="save-source-heading">
        <div>
          <p class="eyebrow">{t('worldEditor.routes.eyebrow', {}, $locale)}</p>
          <h2>{t('worldEditor.routes.title', {}, $locale)}</h2>
          <p>{t('worldEditor.routes.description', {}, $locale)}</p>
        </div>
        <dl>
          <div><dt>{t('worldEditor.target.file', {}, $locale)}</dt><dd>{fileName}</dd></div>
          <div><dt>{t('worldEditor.routes.input', {}, $locale)}</dt><dd>{worldSource.inputFormat}</dd></div>
          <div><dt>{t('worldEditor.routes.schema', {}, $locale)}</dt><dd>{worldSource.profileSchemaVersion}</dd></div>
          <div><dt>{t('worldEditor.routes.source', {}, $locale)}</dt><dd>{worldSource.saveIdentity.sourcePlatform}</dd></div>
          <div><dt>{t('worldEditor.routes.lastSave', {}, $locale)}</dt><dd>{worldSource.saveIdentity.lastSavePlatform}</dd></div>
          <div><dt>{t('worldEditor.routes.areas', {}, $locale)}</dt><dd>{worldSource.areas.length}</dd></div>
          <div><dt>{t('worldEditor.routes.floating', {}, $locale)}</dt><dd>{worldSource.floatingIslands?.length ?? 0}</dd></div>
        </dl>
      </div>

      <div class="save-contract">
        <strong>{t('worldEditor.routes.readContractOnly', {}, $locale)}</strong>
        <span>
          current-v1.25 schema 624 / exactBuildKnown=false /
          persistentWriteAuthorized=false
        </span>
      </div>

      <div class="area-route-list">
        {#each worldSource.areas as area}
          <article class="area-route">
            <header>
              <div>
                <span>{t('worldEditor.routes.village', { index: area.villageIndex }, $locale)}</span>
                <strong>{t('worldEditor.routes.area', { areaId: area.areaId }, $locale)}</strong>
              </div>
              <small>{area.unlocked === false
                ? t('worldEditor.routes.lockedInSave', {}, $locale)
                : t('worldEditor.routes.saveRoute', {}, $locale)}</small>
            </header>

            <div class="root-grid-list">
              {#each area.roots as root}
                <div class="root-grid-row">
                  <div>
                    <strong>{t('worldEditor.routes.grid', { gridId: root.gridId }, $locale)}</strong>
                    <span>{root.gridDataPath ?? t('worldEditor.routes.gridPathUnavailable', {}, $locale)}</span>
                  </div>
                  <div class="root-grid-meta">
                    <span>{t('worldEditor.routes.objectCount', { count: root.objectCount }, $locale)}</span>
                    <span>{t('worldEditor.routes.tessellation', { factor: root.tessellationFactor }, $locale)}</span>
                  </div>
                  <button
                    disabled={
                      loading ||
                      worldSource.saveIdentity.sourcePlatform !== 'switch'
                    }
                    title={
                      worldSource.saveIdentity.sourcePlatform === 'switch'
                        ? t('worldEditor.routes.openCanvasTitle', {}, $locale)
                        : t('worldEditor.routes.switchRequiredTitle', {}, $locale)
                    }
                    on:click={() => openSaveGridInCanvas(area, root.gridId)}
                  >
                    {t('worldEditor.routes.openCanvas', {}, $locale)}
                  </button>
                </div>
              {/each}
            </div>
          </article>
        {/each}
      </div>

      <div class="floating-route-section">
        <div class="floating-route-heading">
          <div>
            <p class="eyebrow">{t('worldEditor.floating.eyebrow', {}, $locale)}</p>
            <strong>{t('worldEditor.floating.semanticRoutes', {}, $locale)}</strong>
          </div>
          <small>{t('worldEditor.floating.description', {}, $locale)}</small>
        </div>

        {#if worldSource.floatingIslands?.length}
          <div class="area-route-list">
            {#each worldSource.floatingIslands as island}
              <article class="area-route">
                <header>
                  <div>
                    <span>{t('worldEditor.floating.island', {}, $locale)}</span>
                    <strong>{t('worldEditor.floating.sceneItemId', { sceneItemId: island.sceneItemId }, $locale)}</strong>
                  </div>
                  <small>{island.unlocked === false
                    ? t('worldEditor.floating.lockedInSave', {}, $locale)
                    : t('worldEditor.floating.semanticRoute', {}, $locale)}</small>
                </header>

                <div class="floating-route-roots">
                  {#each island.roots as root}
                    <div class="floating-route-root">
                      <code>{root.gridDataPath ?? t('worldEditor.routes.gridPathUnavailable', {}, $locale)}</code>
                      <button
                        disabled={
                          loading ||
                          worldSource.saveIdentity.sourcePlatform !== 'switch' ||
                          !root.gridDataPath
                        }
                        on:click={() =>
                          openFloatingIslandRootInCanvas(island, root)}
                      >
                        {t('worldEditor.routes.openCanvas', {}, $locale)}
                      </button>
                    </div>
                  {/each}
                </div>

                <div class="floating-route-actions">
                  <span>{t(
                    'worldEditor.floating.summary',
                    {
                      rootCount: island.roots.length,
                      objectCount: floatingIslandObjectCount(island)
                    },
                    $locale
                  )}</span>
                  <button
                    disabled={
                      loading ||
                      worldSource.saveIdentity.sourcePlatform !== 'switch'
                    }
                    on:click={() => previewFloatingIslandPlan(island)}
                  >
                    {t('worldEditor.floating.previewPlan', {}, $locale)}
                  </button>
                </div>
              </article>
            {/each}
          </div>
        {:else}
          <p class="floating-route-empty">{t('worldEditor.floating.none', {}, $locale)}</p>
        {/if}

        {#if worldSource.floatingIslandDiagnostics?.length}
          <div class="floating-route-diagnostics">
            <strong>{t('worldEditor.floating.unresolvedIdentities', {}, $locale)}</strong>
            {#each worldSource.floatingIslandDiagnostics.slice(0, 5) as diagnostic}
              <span>
                <code>{diagnostic.mapKey}</code>
                {diagnostic.code}
              </span>
            {/each}
          </div>
        {/if}

        {#if floatingIslandPlan}
          <div class="floating-plan-preview">
            <div>
              <span>{t('worldEditor.floating.target', {}, $locale)}</span>
              <strong>{fullDesignIdentityLabel(floatingIslandPlan)}</strong>
            </div>
            <div>
              <span>{t('worldEditor.floating.manifest', {}, $locale)}</span>
              <strong>{floatingIslandPlan.manifestValidation?.ok
                ? t('worldEditor.fullDesign.strictPass', {}, $locale)
                : t('worldEditor.fullDesign.blocked', {}, $locale)}</strong>
            </div>
            <div>
              <span>{t('worldEditor.floating.directRoots', {}, $locale)}</span>
              <strong>{floatingIslandPlan.directRootRoutes.length}</strong>
            </div>
            <div>
              <span>{t('worldEditor.floating.publicationApply', {}, $locale)}</span>
              <strong>{t('worldEditor.floating.blockedDisabled', {}, $locale)}</strong>
            </div>
            <p>{t('worldEditor.floating.planNote', {}, $locale)}</p>
          </div>
        {/if}

        {#if floatingIslandPlanError}
          <div class="full-design-error">
            <strong>{t('worldEditor.floating.planningBlocked', {}, $locale)}</strong>
            <code>{floatingIslandPlanError}</code>
          </div>
        {/if}
      </div>

      <p class="projection-boundary">{t('worldEditor.floating.projectionBoundary', {}, $locale)}</p>
    </section>
  {:else}
    <div class="empty-world">
      <span aria-hidden="true">◇</span>
      <strong>{t('worldEditor.open.emptyTitle', {}, $locale)}</strong>
      <p>{t('worldEditor.open.emptyDescription', {}, $locale)}</p>
    </div>
  {/if}

  <div class="safety-note">
    <strong>{t('worldEditor.safety.title', {}, $locale)}</strong>
    <span>{t('worldEditor.safety.description', {}, $locale)}</span>
  </div>
</section>

<style>
  .world-page{padding-block:60px 96px;min-height:78vh}.world-heading{display:flex;justify-content:space-between;align-items:end;gap:28px}.world-heading h1{font-family:Georgia,serif;font-size:clamp(42px,6vw,66px);font-weight:500;letter-spacing:-.055em;margin:14px 0}.preset-link{flex:none;border:1px solid var(--border);background:var(--surface);padding:12px 16px;border-radius:999px;color:var(--gold);font-size:12px;font-weight:800}.load-panel{margin-top:30px;padding:20px 22px;border:1px solid var(--border);border-radius:18px;background:var(--surface);display:flex;align-items:center;justify-content:space-between;gap:24px}.load-panel h2,.capture-panel h2{font-family:Georgia,serif;font-size:26px;font-weight:500;margin:7px 0}.load-panel p,.capture-copy p{color:var(--ink-soft);font-size:12px;line-height:1.8;margin:0}.load-panel code{color:var(--gold)}.load-controls{display:flex;align-items:end;gap:9px;flex:none}.platform-select{display:grid;gap:5px}.platform-select span{font-size:8px;letter-spacing:.11em;text-transform:uppercase;color:var(--ink-muted)}.platform-select select{background:var(--surface-raised);color:var(--ink);border:1px solid var(--border);border-radius:10px;padding:10px 11px;font-size:11px}.file-button{position:relative;overflow:hidden;flex:none;border:1px solid var(--border);background:var(--surface-raised);border-radius:12px;padding:11px 15px;font-size:12px;font-weight:800;color:var(--ink);cursor:pointer}.file-button input{position:absolute;inset:0;width:100%;height:100%;opacity:0;cursor:pointer}.file-button:focus-within{outline:3px solid var(--focus-ring);outline-offset:4px}.status{margin:14px 0 0;padding:12px 15px;border:1px solid var(--border);border-radius:12px;background:var(--surface);color:var(--ink-soft);font-size:12px;line-height:1.7}.save-source-browser{margin-top:18px;border:1px solid var(--border);border-radius:20px;background:var(--surface);padding:22px}.save-source-heading{display:grid;grid-template-columns:minmax(0,1fr) minmax(260px,.55fr);gap:24px;align-items:start}.save-source-heading h2{font-family:Georgia,serif;font-size:28px;font-weight:500;margin:7px 0}.save-source-heading p{color:var(--ink-soft);font-size:12px;line-height:1.8;margin:0}.save-source-heading dl{display:grid;gap:7px;margin:0}.save-source-heading dl>div{display:grid;grid-template-columns:78px minmax(0,1fr);gap:8px}.save-source-heading dt{font-size:9px;text-transform:uppercase;letter-spacing:.1em;color:var(--ink-muted)}.save-source-heading dd{margin:0;font-size:11px;color:var(--ink-soft);overflow-wrap:anywhere}.save-contract{margin-top:16px;border:1px solid var(--border);background:var(--page-2);border-radius:11px;padding:11px 13px;display:flex;justify-content:space-between;gap:12px;font-size:10px;color:var(--ink-muted)}.save-contract strong{color:var(--help-accent)}.area-route-list{display:grid;gap:10px;margin-top:14px}.area-route{border:1px solid var(--border);background:var(--surface-raised);border-radius:14px;padding:14px}.area-route>header{display:flex;justify-content:space-between;gap:12px;align-items:center}.area-route>header div{display:flex;gap:9px;align-items:baseline}.area-route>header span,.area-route>header small{font-size:9px;color:var(--ink-muted)}.area-route>header strong{font-size:13px}.root-grid-list{display:grid;gap:6px;margin-top:10px}.root-grid-row{display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:12px;align-items:center;border-top:1px solid var(--border);padding-top:8px}.root-grid-row>div:first-child{display:grid;gap:2px;min-width:0}.root-grid-row>div:first-child strong{font-size:11px}.root-grid-row>div:first-child span{font-size:9px;color:var(--ink-muted);overflow-wrap:anywhere}.root-grid-meta{display:flex;gap:8px;color:var(--ink-muted);font-size:9px}.root-grid-row button{border:1px solid var(--border);background:transparent;color:var(--ink-muted);border-radius:8px;padding:7px 9px;font-size:9px}.floating-route-section{margin-top:18px;border-top:1px solid var(--border);padding-top:16px}.floating-route-heading{display:flex;justify-content:space-between;gap:18px;align-items:end}.floating-route-heading>div{display:grid;gap:4px}.floating-route-heading>div>strong{font-size:13px}.floating-route-heading>small,.floating-route-empty{max-width:620px;color:var(--ink-muted);font-size:9px;line-height:1.6}.floating-route-roots{display:grid;gap:6px;margin-top:10px}.floating-route-root{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:center}.floating-route-roots code{font-size:9px;color:var(--ink-muted);overflow-wrap:anywhere}.floating-route-root button{border:1px solid var(--border);background:transparent;color:var(--ink-muted);border-radius:8px;padding:7px 9px;font-size:9px}.floating-route-actions{display:flex;justify-content:space-between;gap:12px;align-items:center;margin-top:10px;font-size:9px;color:var(--ink-muted)}.floating-route-actions button{border:1px solid var(--border);background:transparent;color:var(--ink-muted);border-radius:8px;padding:7px 9px;font-size:9px}.floating-route-diagnostics{margin-top:10px;display:grid;gap:5px;padding:10px;border-radius:10px;background:var(--page-2);font-size:9px}.floating-route-diagnostics span{display:flex;gap:8px;color:var(--ink-muted)}.floating-plan-preview{margin-top:10px;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;padding:12px;border:1px solid var(--border);border-radius:12px;background:var(--page-2)}.floating-plan-preview>div{display:grid;gap:4px}.floating-plan-preview span{font-size:8px;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-muted)}.floating-plan-preview strong{font-size:10px}.floating-plan-preview p{grid-column:1/-1;margin:2px 0 0;color:var(--ink-muted);font-size:9px;line-height:1.6}.projection-boundary{margin:15px 0 0;color:var(--ink-muted);font-size:10px;line-height:1.7}.workspace{display:grid;grid-template-columns:245px minmax(0,1fr);gap:16px;margin-top:18px}.sidebar{display:grid;gap:12px;align-content:start}.side-card{border:1px solid var(--border);background:var(--surface);border-radius:17px;padding:16px}.side-card dl{display:grid;gap:8px;margin:13px 0 0}.side-card dl>div{display:grid;grid-template-columns:72px minmax(0,1fr);gap:8px}.side-card dt{font-size:9px;text-transform:uppercase;letter-spacing:.1em;color:var(--ink-muted)}.side-card dd{margin:0;font-size:11px;color:var(--ink-soft);overflow-wrap:anywhere}.binding-state{font-size:10px;line-height:1.5;margin:14px 0 0;color:var(--help-accent)}.binding-state.blocked{color:var(--decor-accent)}.placement-readiness-note{margin:12px 0 0;color:var(--ink-muted);font-size:9px;line-height:1.55}.progression-safety-card h3{margin:9px 0 4px;font-size:13px}.progression-proof-gates{display:grid;gap:5px;margin-top:11px}.progression-proof-gates span{display:flex;justify-content:space-between;gap:8px;font-size:8px;color:var(--ink-muted)}.progression-proof-gates strong{color:var(--decor-accent)}.progression-safety-note{margin:11px 0 0;font-size:8px;line-height:1.6;color:var(--ink-muted)}.back-to-routes{margin-top:10px;width:100%;border:1px solid var(--border);background:transparent;color:var(--ink-soft);border-radius:9px;padding:8px;font-size:10px}.layer-list{display:grid;gap:6px;margin-top:12px}.layer-list button{border:1px solid var(--border);background:var(--surface-raised);color:var(--ink);border-radius:10px;padding:8px 10px;display:flex;justify-content:space-between;align-items:center;font-size:11px}.layer-list button.off{opacity:.45}.layer-list small{font-size:9px;color:var(--ink-muted)}.side-card>input{width:100%;margin-top:12px;background:var(--surface-raised);color:var(--ink);border:1px solid var(--border);border-radius:10px;padding:10px}.selection-actions{display:flex;gap:7px;margin-top:8px;flex-wrap:wrap}.selection-actions button{flex:1;background:transparent;color:var(--ink-soft);border:1px solid var(--border);border-radius:9px;padding:7px;font-size:10px}.selection-actions button.active{color:var(--gold);border-color:var(--gold)}.selection-scope-note{display:block;margin-top:9px;color:var(--ink-muted);font-size:8px;line-height:1.55}.object-inspector h3{margin:9px 0 5px;font-size:15px}.object-inspector h4{margin:14px 0 7px;font-size:9px;letter-spacing:.11em;text-transform:uppercase;color:var(--ink-muted)}.inspector-note{margin:0;color:var(--ink-muted);font-size:9px;line-height:1.55}.inspector-details{display:grid;gap:5px;margin:8px 0 0}.inspector-details>div{display:grid;grid-template-columns:68px minmax(0,1fr);gap:7px}.inspector-details dt{font-size:8px;color:var(--ink-muted);text-transform:uppercase}.inspector-details dd{margin:0;font-size:9px;overflow-wrap:anywhere}.inspector-reasons{display:grid;gap:6px;margin-top:9px}.inspector-reasons span{display:grid;gap:3px;font-size:8px;line-height:1.5;color:var(--ink-muted)}.inspector-reasons code{color:var(--decor-accent)}.inspector-common-actions,.attached-actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:5px}.inspector-common-actions button,.attached-actions button{border:1px solid var(--border);background:var(--surface-raised);color:var(--ink);border-radius:8px;padding:7px;font-size:9px}.inspector-common-actions button:disabled,.attached-actions button:disabled{opacity:.4}.inspector-common-actions button[aria-disabled="true"]{opacity:.4;cursor:not-allowed}.attached-actions button{display:grid;gap:3px;text-align:left}.attached-actions small{font-size:7px;color:var(--ink-muted)}.command-availability,.validation-groups{display:grid;gap:5px;margin:0 0 10px;padding:10px 12px;border:1px solid var(--border);border-radius:10px;background:var(--page-2);font-size:9px}.command-availability>strong{font-size:9px}.command-availability span{display:grid;grid-template-columns:110px minmax(0,1fr);gap:8px;color:var(--ink-muted)}.command-availability b{color:var(--ink-soft)}.validation-groups{grid-template-columns:repeat(2,minmax(0,1fr))}.validation-groups span{display:grid;gap:3px}.validation-groups strong{font-size:8px;color:var(--ink-soft)}.validation-groups code{font-size:7px;color:var(--decor-accent);overflow-wrap:anywhere}.editor-shell{min-width:0;border:1px solid var(--border);border-radius:20px;background:var(--surface);overflow:hidden}.editor-toolbar{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:13px 15px;border-bottom:1px solid var(--border)}.editor-toolbar>div:first-child{display:grid;gap:2px}.toolbar-label{font-size:8px;letter-spacing:.15em;color:var(--gold);font-weight:900}.editor-toolbar strong{font-size:11px}.toolbar-actions{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:5px}.toolbar-actions button,.capture-actions button{border:1px solid var(--border);background:var(--surface-raised);color:var(--ink);border-radius:9px;padding:7px 10px;font-size:10px;font-weight:800}.toolbar-actions button:disabled,.capture-actions button:disabled{opacity:.35;cursor:not-allowed}.toolbar-actions button[aria-disabled="true"]{opacity:.35;cursor:not-allowed}.canvas-wrap{height:min(62vh,650px);min-height:410px;background:var(--page-2);overflow:hidden}.world-canvas{width:100%;height:100%;display:block}.canvas-bg{fill:var(--page-2)}.grid-overlay{stroke:var(--border);stroke-width:.018;fill:none;opacity:.8}.object-cell{stroke:var(--page);stroke-width:.08;vector-effect:non-scaling-stroke;fill:var(--world-accent);opacity:.72}.layer-road{fill:var(--gold)}.layer-fence{fill:var(--ink-muted)}.layer-static{fill:var(--ink-muted)}.layer-landscaping{fill:var(--help-accent)}.layer-building{fill:var(--decor-accent)}.layer-furniture{fill:var(--world-accent)}g.locked .object-cell{opacity:.28}g.selected .object-cell{stroke:var(--gold-strong);stroke-width:.16;opacity:1}.world-canvas g[data-editor-object]:focus-visible .object-cell{stroke:var(--gold-strong);stroke-width:.2;opacity:1}.canvas-footer{display:flex;justify-content:space-between;gap:12px;padding:10px 14px;border-top:1px solid var(--border);font-size:9px;color:var(--ink-muted)}.draft-status{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin:10px 0}.draft-status>span{display:grid;gap:4px;padding:9px 11px;border:1px solid var(--border);border-radius:10px;background:var(--surface-raised);font-size:8px;color:var(--ink-muted);text-transform:uppercase;letter-spacing:.08em}.draft-status strong{color:var(--ink);font-size:9px;letter-spacing:0;text-transform:none}.draft-blockers,.save-preparation{display:grid;gap:6px;margin:0 0 10px;padding:10px 12px;border:1px solid var(--border);border-radius:10px;background:var(--page-2);font-size:9px;color:var(--ink-muted)}.draft-blockers span{display:grid;grid-template-columns:minmax(160px,auto) 1fr;gap:9px}.draft-blockers code,.save-preparation code{color:var(--decor-accent);overflow-wrap:anywhere}.save-preparation{grid-template-columns:auto auto minmax(160px,1fr);align-items:baseline}.save-preparation small{grid-column:1/-1}.toolbar-actions .save-prep{margin-left:4px}.full-design-panel{margin-top:18px;border:1px solid var(--border);border-radius:20px;background:var(--surface);padding:22px;display:grid;gap:16px}.full-design-heading{display:flex;justify-content:space-between;align-items:flex-start;gap:22px}.full-design-heading h2{font-family:Georgia,serif;font-size:26px;font-weight:500;margin:7px 0}.full-design-heading p{max-width:720px;color:var(--ink-soft);font-size:12px;line-height:1.8;margin:0}.full-design-gates{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}.full-design-gates span{border:1px solid var(--border);border-radius:999px;padding:8px 11px;font-size:9px;color:var(--ink-muted);white-space:nowrap}.full-design-gates strong{color:var(--decor-accent)}.full-design-summary{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px}.full-design-summary>div,.full-design-categories article{background:var(--surface-raised);border-radius:11px;padding:11px}.full-design-summary span,.full-design-routes>span,.full-design-categories article span{display:block;font-size:8px;letter-spacing:.12em;text-transform:uppercase;color:var(--ink-muted)}.full-design-summary strong,.full-design-categories article strong{display:block;margin-top:5px;font-size:10px;line-height:1.45}.full-design-routes{display:grid;gap:6px}.full-design-routes code{display:block;padding:8px 10px;border:1px solid var(--border);border-radius:9px;background:var(--page-2);font-size:9px;overflow-wrap:anywhere}.full-design-categories{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.full-design-categories article{border:1px solid transparent}.full-design-categories article.blocked{border-color:var(--border)}.full-design-categories article small{display:block;margin-top:8px;color:var(--ink-muted);font-size:9px;line-height:1.55}.full-design-boundary{margin:0;color:var(--ink-muted);font-size:10px;line-height:1.7}.full-design-destination{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;align-items:start;border-top:1px solid var(--border);padding-top:14px}.full-design-destination-copy{display:grid;gap:6px}.full-design-destination-copy>div{display:flex;gap:10px;align-items:baseline}.full-design-destination-copy span,.full-design-destination-result>span{font-size:8px;letter-spacing:.12em;text-transform:uppercase;color:var(--ink-muted)}.full-design-destination-copy strong{font-size:11px}.full-design-destination-copy p,.full-design-destination>small{margin:0;color:var(--ink-muted);font-size:9px;line-height:1.6}.full-design-destination-button{align-self:center}.full-design-destination-result,.full-design-destination-issues{grid-column:1/-1;display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding:10px;border-radius:10px;background:var(--page-2);font-size:9px}.full-design-destination-result code{overflow-wrap:anywhere}.full-design-destination-result strong{font-size:9px}.full-design-destination-issues{display:grid}.full-design-destination-issues span{display:flex;gap:8px;align-items:baseline;color:var(--ink-muted)}.full-design-destination-issues code{color:var(--decor-accent);overflow-wrap:anywhere}.full-design-destination>.full-design-error,.full-design-destination>small{grid-column:1/-1}.full-design-error{display:grid;gap:6px;padding:13px;border:1px solid var(--border);border-radius:12px;background:var(--page-2);font-size:10px}.full-design-error strong{color:var(--decor-accent)}.full-design-error code{overflow-wrap:anywhere}.capture-panel{margin-top:18px;border:1px solid var(--border);border-radius:20px;background:var(--surface);padding:22px;display:grid;grid-template-columns:minmax(0,.8fr) minmax(320px,1.2fr);gap:20px}.capture-form{display:grid;gap:10px}.capture-form label{display:grid;gap:6px}.capture-form label>span{font-size:9px;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-muted)}.capture-form input,.capture-form textarea,.capture-form select{width:100%;background:var(--surface-raised);color:var(--ink);border:1px solid var(--border);border-radius:10px;padding:10px 11px}.capture-form textarea{resize:vertical}.capture-region-options{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:end;padding:10px 12px;border:1px solid var(--border);border-radius:10px;background:var(--page-2)}.capture-region-options>label{display:grid;gap:6px}.capture-region-options>label>span,.capture-region-grid span{font-size:8px;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-muted)}.capture-region-options>button{padding:10px 12px}.capture-region-grid{grid-column:1/-1;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}.capture-region-grid label{display:grid;gap:4px}.capture-region-options>small{grid-column:1/-1;color:var(--ink-muted);font-size:8px;line-height:1.5}.network-capture-options{display:flex;gap:12px;align-items:center;flex-wrap:wrap;padding:10px 12px;border:1px solid var(--border);border-radius:10px;background:var(--page-2)}.network-capture-options>label{display:flex;gap:6px;align-items:center;font-size:10px}.network-capture-options>label input{margin:0}.network-capture-options>small{flex-basis:100%;color:var(--ink-muted);font-size:8px;line-height:1.5}.network-capture-options code{color:var(--decor-accent)}.capture-actions{display:flex;gap:8px}.capture-actions button{padding:10px 13px}.capture-actions button.publish{background:var(--gold-strong);color:var(--gold-ink)}.capture-status{grid-column:1/-1;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}.capture-status>div{background:var(--surface-raised);border-radius:11px;padding:11px}.capture-status span{display:block;font-size:8px;letter-spacing:.12em;text-transform:uppercase;color:var(--ink-muted)}.capture-status strong{display:block;margin-top:5px;font-size:10px;line-height:1.45}.artifact-summary,.published-card{grid-column:1/-1;border:1px solid var(--border);border-radius:12px;padding:12px 14px;background:var(--page-2);display:flex;gap:14px;align-items:center;flex-wrap:wrap;font-size:10px;color:var(--ink-soft)}.artifact-summary strong{color:var(--ink)}.published-card{display:grid;gap:6px}.published-card>strong{font-family:Georgia,serif;font-size:18px;color:var(--ink)}.published-card code{font-size:9px;overflow-wrap:anywhere}.published-card a{color:var(--gold);font-weight:800}.empty-world{margin-top:18px;min-height:350px;border:1px dashed var(--border);border-radius:20px;display:grid;place-items:center;align-content:center;text-align:center;color:var(--ink-muted);background:var(--surface)}.empty-world>span{font-size:48px;color:var(--gold)}.empty-world strong{color:var(--ink);margin-top:8px}.empty-world p{max-width:520px;font-size:12px;line-height:1.8}.safety-note{margin-top:18px;padding:14px 17px;border:1px solid var(--border);border-radius:14px;background:var(--surface);display:grid;gap:5px;font-size:10px;color:var(--ink-muted);line-height:1.6}.safety-note strong{color:var(--decor-accent)}@media(max-width:900px){.world-heading,.load-panel,.full-design-heading,.floating-route-heading{align-items:flex-start;flex-direction:column}.save-source-heading{grid-template-columns:1fr}.workspace{grid-template-columns:1fr}.sidebar{grid-template-columns:repeat(3,minmax(0,1fr))}.full-design-gates{justify-content:flex-start}.full-design-summary{grid-template-columns:repeat(2,minmax(0,1fr))}.full-design-categories{grid-template-columns:repeat(2,minmax(0,1fr))}.capture-panel{grid-template-columns:1fr}.capture-status{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:620px){.floating-plan-preview{grid-template-columns:1fr}.floating-route-actions{align-items:flex-start;flex-direction:column}.full-design-destination{grid-template-columns:1fr}.full-design-destination-button{width:100%;text-align:center}.load-controls{width:100%;align-items:stretch;flex-direction:column}.platform-select select{width:100%}.root-grid-row{grid-template-columns:1fr}.root-grid-meta{flex-wrap:wrap}.save-contract{flex-direction:column}.world-page{padding-block:44px 70px}.sidebar{grid-template-columns:1fr}.editor-toolbar{align-items:flex-start;flex-direction:column}.toolbar-actions{justify-content:flex-start}.canvas-wrap{min-height:340px;height:52vh}.canvas-footer{flex-direction:column}.draft-status{grid-template-columns:repeat(2,minmax(0,1fr))}.save-preparation{grid-template-columns:1fr}.full-design-summary,.full-design-categories{grid-template-columns:1fr}.capture-status{grid-template-columns:1fr}.capture-region-options{grid-template-columns:1fr}.capture-region-options>button{width:100%}.capture-region-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.capture-actions{flex-direction:column}.file-button{width:100%;text-align:center}}

  .road-fence-authoring-panel{margin-top:22px;border:1px solid var(--border);border-radius:22px;background:var(--surface);padding:24px;box-shadow:var(--shadow)}.road-fence-authoring-heading{display:flex;justify-content:space-between;gap:24px;align-items:flex-start}.road-fence-authoring-heading h2{font-family:Georgia,serif;font-size:30px;font-weight:500;margin:8px 0}.road-fence-authoring-heading p:not(.eyebrow){max-width:760px;color:var(--ink-soft);font-size:12px;line-height:1.8}.road-fence-authoring-grid{display:grid;gap:14px;margin-top:18px}.road-fence-authoring-form{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px}.road-fence-authoring-form label{display:grid;gap:6px;font-size:9px;color:var(--ink-muted)}.road-fence-authoring-form label>span{letter-spacing:.08em;text-transform:uppercase}.road-fence-authoring-form input,.road-fence-authoring-form select,.road-fence-authoring-form textarea{width:100%;min-width:0;background:var(--surface-raised);color:var(--ink);border:1px solid var(--border);border-radius:10px;padding:9px 11px}.road-fence-authoring-form textarea{resize:vertical}.road-fence-authoring-form .road-fence-points{grid-column:span 2}.road-fence-authoring-actions{display:flex;gap:7px;flex-wrap:wrap}.road-fence-authoring-actions button{border:1px solid var(--border);background:var(--surface-raised);color:var(--ink-soft);border-radius:9px;padding:8px 10px;font-size:10px;font-weight:800}.road-fence-authoring-actions button:disabled{opacity:.35;cursor:not-allowed}.road-fence-authoring-status{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:10px;align-items:baseline;padding:10px 12px;border:1px solid var(--border);border-radius:11px;background:var(--page-2);font-size:9px;color:var(--ink-muted)}.road-fence-authoring-status strong{color:var(--ink-soft)}.road-fence-authoring-status code{overflow-wrap:anywhere}@media(max-width:900px){.road-fence-authoring-heading{flex-direction:column}.road-fence-authoring-form{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:620px){.road-fence-authoring-form{grid-template-columns:1fr}.road-fence-authoring-form .road-fence-points{grid-column:auto}.road-fence-authoring-status{grid-template-columns:1fr}}

  .building-readiness-lines{display:grid;gap:5px;margin-top:6px}.building-readiness-lines span{display:flex;justify-content:space-between;gap:10px;font-size:10px;color:var(--ink-muted)}.building-readiness-lines strong{color:var(--ink-soft);text-align:right}.fence-post-panel{margin-top:22px;border:1px solid var(--border);border-radius:22px;background:var(--surface);padding:24px;box-shadow:var(--shadow)}.fence-post-heading{display:flex;justify-content:space-between;gap:24px;align-items:flex-start}.fence-post-heading h2{font-family:Georgia,serif;font-size:30px;font-weight:500;margin:8px 0}.fence-post-heading p:not(.eyebrow){max-width:760px;color:var(--ink-soft);font-size:12px;line-height:1.8}.fence-post-controls{display:grid;gap:14px;margin-top:18px}.fence-post-controls label{display:grid;gap:6px;font-size:10px;color:var(--ink-muted)}.fence-post-controls select,.fence-post-controls input{background:var(--surface-raised);color:var(--ink);border:1px solid var(--border);border-radius:10px;padding:9px 11px}.fence-post-summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}.fence-post-summary>span{display:grid;gap:4px;padding:11px;border-radius:12px;background:var(--surface-raised);font-size:9px;color:var(--ink-muted)}.fence-post-summary strong{font-size:13px;color:var(--ink)}.fence-post-editor-grid{display:grid;grid-template-columns:minmax(280px,.8fr) 1.2fr;gap:12px}.fence-post-form,.fence-post-list,.fence-topology-boundary{border:1px solid var(--border);border-radius:14px;padding:14px;background:var(--page-2)}.fence-post-form{display:grid;grid-template-columns:2fr 1fr 1fr;gap:8px}.fence-post-form button,.fence-post-list button,.fence-topology-boundary button{border:1px solid var(--border);background:var(--surface-raised);color:var(--ink-soft);border-radius:9px;padding:8px 10px;font-weight:800}.fence-post-list{display:grid;gap:7px;align-content:start}.fence-post-list>div{display:grid;grid-template-columns:auto 1fr auto auto;align-items:center;gap:8px;font-size:10px}.fence-topology-boundary{display:flex;align-items:center;gap:12px;flex-wrap:wrap}.fence-topology-boundary span{flex:1;min-width:260px;font-size:10px;line-height:1.6;color:var(--ink-muted)}@media(max-width:800px){.fence-post-heading{flex-direction:column}.fence-post-summary{grid-template-columns:repeat(2,minmax(0,1fr))}.fence-post-editor-grid{grid-template-columns:1fr}.fence-post-form{grid-template-columns:1fr 1fr}.fence-post-list>div{grid-template-columns:1fr 1fr}}
  .verified-export-panel{margin:12px 14px 14px;padding:16px;border:1px solid var(--border);border-radius:14px;background:var(--page-2);display:grid;gap:12px}.verified-export-heading{display:flex;justify-content:space-between;gap:18px;align-items:flex-start}.verified-export-heading h3{margin:4px 0;font-size:15px}.verified-export-heading p,.verified-export-note,.verified-export-success p,.verified-export-recovery{margin:0;color:var(--ink-muted);font-size:9px;line-height:1.65}.verified-export-heading button,.verified-export-review button,.verified-export-downloads button{border:1px solid var(--border);background:var(--surface-raised);color:var(--ink);border-radius:9px;padding:8px 11px;font-size:10px;font-weight:800}.verified-export-heading button:disabled,.verified-export-review button:disabled{opacity:.4;cursor:not-allowed}.verified-export-error{display:grid;gap:5px;padding:11px;border:1px solid var(--border);border-radius:10px;background:var(--surface);font-size:9px}.verified-export-error strong{color:var(--decor-accent)}.verified-export-error code{overflow-wrap:anywhere;color:var(--ink-muted)}.verified-export-review{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}.verified-export-review>div{display:grid;gap:4px;padding:10px;border-radius:10px;background:var(--surface-raised)}.verified-export-review>div>span,.verified-export-success dt{font-size:8px;letter-spacing:.09em;text-transform:uppercase;color:var(--ink-muted)}.verified-export-review>div>strong{font-size:10px;overflow-wrap:anywhere}.verified-export-review .verified-export-delta{grid-column:span 2;grid-template-columns:auto 1fr;align-items:baseline}.verified-export-build-confirm{display:flex;gap:8px;align-items:flex-start;padding:10px;border:1px solid var(--border);border-radius:10px;background:var(--surface);font-size:9px;color:var(--ink-soft)}.verified-export-build-confirm input{margin-top:2px}.verified-export-confirm{grid-column:1/-1;display:flex;gap:8px;align-items:flex-start;font-size:9px;color:var(--ink-soft)}.verified-export-confirm input{margin-top:2px}.verified-export-apply{grid-column:1/-1;justify-self:start}.verified-export-review>small{grid-column:1/-1;color:var(--ink-muted);font-size:8px}.verified-export-success{display:grid;gap:9px;padding:12px;border:1px solid var(--border);border-radius:11px;background:var(--surface)}.verified-export-success>strong{color:var(--help-accent)}.verified-export-success dl{display:grid;gap:6px;margin:0}.verified-export-success dl>div{display:grid;grid-template-columns:100px minmax(0,1fr);gap:8px}.verified-export-success dd{margin:0;font-size:9px;overflow-wrap:anywhere}.verified-export-downloads{display:flex;gap:7px;flex-wrap:wrap}@media(max-width:700px){.verified-export-heading{flex-direction:column}.verified-export-review{grid-template-columns:1fr}.verified-export-review .verified-export-delta{grid-column:auto}.verified-export-success dl>div{grid-template-columns:1fr}}

  .recovery-panel {
    margin-top: 14px;
    display: grid;
    grid-template-columns: minmax(220px, .8fr) minmax(280px, 1.2fr);
    gap: 14px;
    border: 1px solid var(--border);
    border-radius: 16px;
    background: var(--surface);
    padding: 14px;
  }
  .recovery-panel h2 { margin: 4px 0 7px; font-family: Georgia, serif; font-weight: 500; }
  .recovery-panel p { margin: 0; color: var(--ink-muted); font-size: 10px; line-height: 1.6; }
  .recovery-list { display: grid; gap: 6px; }
  .recovery-list button {
    display: grid;
    gap: 3px;
    width: 100%;
    text-align: left;
    border: 1px solid var(--border);
    border-radius: 10px;
    background: var(--surface-raised);
    color: var(--ink);
    padding: 9px 11px;
  }
  .recovery-list button span { color: var(--ink-muted); font-size: 8px; }
  .recovery-list button:focus-visible { outline: 2px solid var(--gold); outline-offset: 2px; }
  .recovery-status { grid-column: 1 / -1; }
  @media (max-width: 760px) {
    .recovery-panel { grid-template-columns: 1fr; }
  }

  .pre-source-stage1{
    margin-top:14px;
    border:1px solid var(--border);
    border-radius:17px;
    background:var(--surface);
    padding:16px;
  }

  .inspector-precise{display:grid;gap:7px;margin-top:12px;padding-top:10px;border-top:1px solid var(--border)}
  .inspector-precise h4{margin:0}
  .inspector-precise>div{display:grid;grid-template-columns:1fr 1fr;gap:6px}
  .inspector-precise label{display:grid;gap:3px;font-size:8px;color:var(--ink-muted)}
  .inspector-precise input{width:100%;box-sizing:border-box;border:1px solid var(--border);border-radius:8px;background:var(--surface-raised);color:var(--ink);padding:7px}
  .inspector-precise button{border:1px solid var(--border);background:var(--surface-raised);color:var(--ink);border-radius:8px;padding:7px;font-size:9px}
  .inspector-precise button:focus-visible,.inspector-precise input:focus-visible{outline:2px solid var(--gold);outline-offset:2px}
</style>
