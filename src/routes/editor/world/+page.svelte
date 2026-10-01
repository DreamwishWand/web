<script lang="ts">
  import { onMount } from 'svelte';
  import { base } from '$app/paths';
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
    projectObjects
  } from '$lib/wep/canvas-runtime';
  import { openWorldSaveBytes } from '$lib/wep/world-save-source';
  import {
    createSwitchWorldReadAdapter,
    projectSwitchAreaGrid
  } from '$lib/wep/world-browser-adapter';
  import { buildCurrentV125FullDesignCapturePlan } from '$lib/wep/full-design-preset-planning';
  import { preflightCurrentV125FullDesignManifest } from '$lib/wep/full-design-preset-preflight';
  import {
    createDraftAwareNetworkCaptureAdapter,
    createSwitchV125RoadFenceReaderBinding
  } from '$lib/wep/roadfence-reader-adapter';
  import { assessCurrentV125BrowserPlacementReadiness } from '$lib/wep/placement-readiness';
  import { explainWepBlocker } from '$lib/wep/blocker-messages';
  import {
    NATIVE_PLACEMENT_CLASSES,
    createSwitchV125PlacementLegalityBinding
  } from '$lib/wep/placement-legality-v19';
  import {
    createSwitchV125BuildingBinding
  } from '$lib/wep/building-v110';
  import {
    FENCE_POST_AUTO_LAYOUT,
    applyFencePostAutoLayout,
    insertFencePost,
    moveFencePost,
    removeFencePost,
    setFencePostPinned,
    validateFencePostLayoutDraft
  } from '$lib/wep/fence-post-edit-contract';
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
  $: placementReadiness = editorDocument
    ? assessCurrentV125BrowserPlacementReadiness(editorDocument)
    : null;

  function editorBlockerText(code: string) {
    return explainWepBlocker(code).message;
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

  function createSwitchDraftSession(document: any) {
    if (!switchWorldBinding || !placementLegalityBinding) {
      throw new Error('WEP_WORLD_DRAFT_CORE_BINDING_UNAVAILABLE');
    }
    return createEditorSession(document, {
      geometryAdapter: coreDraftGeometryAdapter(switchWorldBinding),
      validator:
        placementLegalityBinding.createEditorDraftValidator(),
      allowInvalidDraft: true
    });
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
        ? 'Logical network draft created. Persistent writer remains disabled.'
        : 'Logical network draft was blocked.';
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
        ? `Connected selection · ${rfPreview.logicalQuantity ?? rfPreview.cells?.length ?? 0} logical units`
        : 'Connected selection blocked.';
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
        ? `Fence segment · ${rfPreview.logicalQuantity} logical units`
        : 'Fence segment selection blocked.';
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
        ? 'Eyedropper loaded family and mode into the authoring controls.'
        : 'Eyedropper could not sample the selected logical unit.';
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
        rfMessage = 'Style replacement preview blocked.';
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
        ? 'Style replacement stored in the local logical draft.'
        : 'Style replacement blocked.';
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
        rfMessage = 'Topology delete/split preview blocked.';
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
        ? 'Topology delete/split stored in the local draft.'
        : 'Topology delete/split blocked.';
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
        rfMessage = 'Topology transform preview blocked.';
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
        ? 'Topology transform stored in the local draft.'
        : 'Topology transform blocked.';
    } catch (error) {
      rfMessage =
        error instanceof Error ? error.message : String(error);
    }
  }

  function fullDesignCategoryLabel(key: string) {
    return ({
      directGrids: 'Direct roots',
      rootObjects: 'Placed objects',
      roads: 'Roads',
      fences: 'Fences',
      buildings: 'Buildings / PlayerHouse',
      environment: 'Environment'
    } as Record<string, string>)[key] ?? key;
  }

  function fullDesignCategoryEntries(plan: any): Array<[string, any]> {
    return Object.entries(plan?.categories ?? {}) as Array<[string, any]>;
  }

  function fullDesignDispositionLabel(value: any) {
    if (value?.disposition === 'captured_partial') return 'Included · partial';
    if (value?.disposition === 'blocked') return 'Blocked';
    if (value?.disposition === 'excluded') return 'Excluded';
    return String(value?.disposition ?? 'Unknown');
  }

  function fullDesignBlockerText(code: string) {
    return explainWepBlocker(code).message;
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
        ? `${count} inventoried · ${portable} portable · ${unresolved} unresolved · ${missing} route missing`
        : `${count} direct-root object${count === 1 ? '' : 's'} inventoried`;
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
      return `${supported}/${coverage.length} roots reader-supported · ${networks} logical network${networks === 1 ? '' : 's'}`;
    }
    if (categoryKey === 'buildings') {
      const ordinary = category?.ordinaryPlacement;
      const skins = Number(category?.buildingSkins?.entries?.length ?? 0);
      const houses = Number(category?.playerHouses?.entries?.length ?? 0);
      if (ordinary?.destinationPlacementStatus === 'NOT_APPLICABLE') {
        return `No Building present · skins ${skins} · PlayerHouse ${houses}`;
      }
      return `ordinary Building ${Number(ordinary?.recognizedCount ?? 0)} · destination ${String(ordinary?.destinationPlacementStatus ?? 'UNKNOWN').toLowerCase()} · skins ${skins} · PlayerHouse ${houses}`;
    }
    if (categoryKey === 'environment' && category?.portableState) {
      return `codec ${category.portableState.codec}`;
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
      fencePostMessage =
        `${label}: BLOCKED · ${firstIssue ?? 'representation validation'}`;
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
    fencePostMessage =
      `${label}: Core preflight PASS · Undo/Redo enabled · portable representation will be revalidated during Scene/full-design capture`;
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
        'Insert Post'
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
        'Move Post'
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
        'Remove Post'
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
        pinned ? 'Pin Post' : 'Unpin Post'
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
        'Centered balanced auto-layout'
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
    if (!preflight) return 'Not checked';
    if (!preflight.manifestValid) return 'Manifest blocked';
    if (!preflight.destinationPreflightReady) return 'Destination blocked';
    if (!preflight.categoryClosureReady) return 'Destination resolved · product blocked';
    return 'Ready for future apply gate';
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
    return `clear ${counts.clear} · replace/remove ${counts.replaces} · invalid ${counts.invalid} · unknown ${counts.unknown}`;
  }

  function fullDesignDestinationIssueText(issue: any) {
    const explanation = explainWepBlocker(
      issue?.code ?? 'WEP_UNKNOWN_BLOCKER',
      issue?.detail ?? issue
    );
    return String(
      issue?.detail?.message ??
        issue?.detail?.status ??
        explanation.message
    );
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

      fullDesignDestinationPreflight =
        preflightCurrentV125FullDesignManifest({
          destinationProfile: opened.profile,
          destinationPlatform: opened.saveIdentity.sourcePlatform,
          manifest: fullDesignPlan.manifest,
          placementBinding: placementLegalityBinding,
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
      return `Village SceneItemId ${identity.villageSceneItemId} · AreaType ${identity.villageAreaType}`;
    }
    if (identity?.kind === 'FLOATING_ISLAND') {
      return `Floating Island SceneItemId ${identity.sceneItemId}`;
    }
    return 'Unresolved';
  }

  onMount(async () => {
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

  function refreshProjection() {
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
    projected = selectedOnly
      ? nextProjection.filter((object) =>
          selection.includes(object.editorId)
        )
      : nextProjection;
  }

  async function openEditorDocument(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    loading = true;
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
    copiedDraftClipboard = null;
    clipboardPasteCount = 0;

    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
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
        const normalized = normalizeEditorDocument(parsed);
        if (normalized.schema !== WEP_EDITOR_SCHEMA) {
          throw new Error('WEP EditorDocument schema が一致しません。');
        }

        worldSource = null;
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
        presetTitle = '';
        presetDescription = '';
        publishKey = '';
        refreshProjection();
        refreshDraftState();

        message =
          editorDocument.target?.platform === 'synthetic'
            ? 'EditorDocument をローカルで読み込みました。synthetic target のdraft操作が利用できます。'
            : 'EditorDocument をローカルで読み込みました。untrusted imported real-target documentにはCore authoring bindingを自動付与せずread-onlyにします。';
      } else {
        const opened = await openWorldSaveBytes(bytes, {
          sourcePlatform
        });

        session = null;
        editorDocument = null;
        projected = [];
        selection = [];
        layerState = null;
        worldSource = opened;
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

        message =
          `DDV saveをローカルで読み込みました。schema ${opened.profileSchemaVersion} / ${opened.areas.length} Areas。Canvasでroot Gridを開くとCore-bound local draft authoringを利用できます。exact buildはsave単体から証明せず、persistent writeは無効です。`;
      }
    } catch (error) {
      session = null;
      editorDocument = null;
      worldSource = null;
      projected = [];
      selection = [];
      layerState = null;
      fileName = '';
      draftAuthoringBound = false;
      draftValidation = null;
      draftSavePreparation = null;
      lastDraftCommand = '';
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
      message =
        '現在のbrowser World projectionはNintendo Switch v1.25.0の承認済みstatic-data scopeだけです。Steam/unknown sourceはArea/Grid列挙までread-onlyで停止します。';
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

      const projectedDocument = projectSwitchAreaGrid(
        worldSource,
        area,
        Number(rootGridId),
        switchWorldBinding
      );
      const normalized = normalizeEditorDocument(projectedDocument);

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

      fullDesignRootDocuments = [cloneLocal(normalized)];
      fullDesignSourceRootGridId = Number(rootGridId);
      for (const root of area.roots ?? []) {
        if (Number(root.gridId) === Number(rootGridId)) continue;
        try {
          fullDesignRootDocuments.push(
            normalizeEditorDocument(
              projectSwitchAreaGrid(
                worldSource,
                area,
                Number(root.gridId),
                switchWorldBinding
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

      rebuildFullDesignPlan();

      const diagnostics = editorDocument.metadata?.diagnostics ?? [];
      const unresolvedBounds = diagnostics.some(
        (issue: any) => issue.code === 'ROOT_GRID_BOUNDS_UNRESOLVED'
      );

      message =
        'Switch v1.25.0のCore-bound draft Canvasを生成しました。Move / Rotate / Duplicate / Delete / Undo / Redoはローカルdraftとして利用できます。' +
        (unresolvedBounds
          ? ' このGridDataPathはauthoritative bounds未解決のためvalidationはfail-closedです。'
          : ' v1.8 FloorType + v1.9 native placement classifierを各commandのvalidationに使用します。') +
        ' save単体ではexact Build IDを証明できないためnative validationはUNVERIFIEDのまま保持し、persistent DDV writeは無効です。';
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

  function returnToSaveRoutes() {
    if (!worldSource) return;
    session = null;
    editorDocument = null;
    projected = [];
    selection = [];
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
    copiedDraftClipboard = null;
    clipboardPasteCount = 0;
    query = '';
    selectedOnly = false;
    message =
      'DDV saveのArea / direct Grid一覧へ戻りました。persistent writeは無効です。';
  }

  function selectObject(id: string, toggle = false) {
    if (!session) return;
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
    refreshProjection();
  }

  function setQuery(value: string) {
    query = value;
    refreshProjection();
  }

  function toggleSelectedOnly() {
    selectedOnly = !selectedOnly;
    refreshProjection();
  }

  function finishDraftMutation(result: any, fallbackLabel: string) {
    lastDraftCommand = String(
      result?.kind ?? fallbackLabel
    );
    if (result?.applied === false) {
      const blocker = firstDraftBlocker(result.validation);
      message = blocker
        ? editorBlockerText(String(blocker.code))
        : 'The draft command was rejected by validation.';
    } else if (result?.draftBlocked) {
      const blocker = firstDraftBlocker(result.validation);
      message =
        'Draft updated locally, but validation is blocked. ' +
        editorBlockerText(
          String(
            blocker?.code ??
              'NATIVE_PLACEMENT_UNVERIFIED'
          )
        );
    } else {
      message =
        'Draft updated and current command preflight passed. Persistent DDV write remains disabled.';
    }

    capturePreview = null;
    published = null;
    refreshProjection();
    refreshDraftState();
    rebuildFullDesignPlan();
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
    message =
      'Undo restored the draft model, selection, validation and Fence representation state together.';
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
    message =
      'Redo restored the draft model, selection, validation and Fence representation state together.';
  }

  function reviewSavePreparation() {
    if (!session) return;
    draftSavePreparation = session.previewPersistentCommit();
    const code = String(
      draftSavePreparation?.reason ?? 'NO_PERSISTENT_WRITER_BOUND'
    );
    message =
      'Save preparation reviewed. ' + editorBlockerText(code);
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
      message = 'Capture Regionに使うobjectを選択してください。';
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
      message = 'Scene Presetに含めるobjectを選択してください。';
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
        message =
          'Scene captureはpublication-readyです。source Grid/GridObject identityはartifactから除去されています。';
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
      message = error instanceof Error ? error.message : String(error);
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
      message =
        'publishには認証済みWand Account、Creator Profile、Preset titleが必要です。';
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
      message =
        'Scene Presetを公開しました。DDVセーブへの書き込みは行っていません。';
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    } finally {
      loading = false;
    }
  }
</script>

<svelte:head>
  <title>World Editor | Dreamwish Wand</title>
  <meta
    name="description"
    content="Dreamwish Wand World Editor — inspect WEP EditorDocuments, capture portable Scene Presets and publish them without writing to DDV saves."
  />
</svelte:head>

<section class="world-page container">
  <div class="world-heading">
    <div>
      <p class="eyebrow">DECORATE / WORLD EDITOR</p>
      <h1>World Editor</h1>
      <p class="page-intro">
        WEP EditorDocumentをローカルで表示・選択し、portable Scene Presetへcaptureします。
        現在の製品surfaceからDDVセーブへpersistent writeは行いません。
      </p>
    </div>
    <a class="preset-link" href={`${base}/presets/`}>Presetsを見る →</a>
  </div>

  <section class="load-panel">
    <div>
      <p class="eyebrow">LOCAL INPUT</p>
      <h2>Open DDV Save / EditorDocument</h2>
      <p>
        暗号化された通常DDV profile、復号済み <code>profile.json</code>、
        または <code>dreamwish-wand-wep-editor-document</code> をブラウザ内で読み込みます。
        raw saveを開く場合だけ、ファイルを取得したstorage platformを指定してください。
        ファイル内容はPublishを実行するまでCommunityへ送信しません。
      </p>
    </div>
    <div class="load-controls">
      <label class="platform-select">
        <span>Source platform</span>
        <select bind:value={sourcePlatform} disabled={loading}>
          <option value="unknown">Unknown / choose later</option>
          <option value="switch">Nintendo Switch</option>
          <option value="steam-windows">Steam / Windows</option>
        </select>
      </label>
      <label class="file-button">
        <input
          type="file"
          accept=".save,.json,application/json,application/octet-stream"
          on:change={openEditorDocument}
          disabled={loading}
        />
        {fileName ? '別のファイルを開く' : 'DDV Save / EditorDocumentを開く'}
      </label>
    </div>
  </section>

  {#if message}
    <div class="status" aria-live="polite">{message}</div>
  {/if}

  {#if editorDocument}
    <div class="workspace">
      <aside class="sidebar">
        <section class="side-card">
          <p class="eyebrow">TARGET</p>
          <dl>
            <div><dt>File</dt><dd>{fileName || '—'}</dd></div>
            <div><dt>Game</dt><dd>{editorDocument.target?.gameVersion ?? '—'}</dd></div>
            <div><dt>Platform</dt><dd>{editorDocument.target?.platform ?? '—'}</dd></div>
            <div><dt>Area</dt><dd>{editorDocument.target?.areaKey ?? '—'}</dd></div>
            <div><dt>Objects</dt><dd>{objectCount}</dd></div>
            <div><dt>Selected</dt><dd>{selectedCount}</dd></div>
          </dl>
          <p class:blocked={!mutationBound} class="binding-state">
            {mutationBound
              ? editorDocument.target?.platform === 'synthetic'
                ? 'Synthetic draft authoring'
                : 'Core-bound local draft authoring · persistent write OFF'
              : 'Read-only target · no trusted draft authoring binding'}
          </p>
          {#if worldSource}
            <button class="back-to-routes" on:click={returnToSaveRoutes}>
              ← Area / Grid一覧へ戻る
            </button>
          {/if}
        </section>

        {#if placementReadiness}
          <section class="side-card placement-readiness-card">
            <p class="eyebrow">PLACEMENT READINESS</p>
            <dl>
              <div>
                <dt>Route</dt>
                <dd>{placementReadiness.route.status === 'RESOLVED' ? 'Resolved' : 'Blocked'}</dd>
              </div>
              <div>
                <dt>Bounds</dt>
                <dd>{placementReadiness.bounds.status === 'AUTHORITATIVE' ? 'Authoritative · 01B v1.7' : 'Blocked'}</dd>
              </div>
              <div>
                <dt>Legality</dt>
                <dd>
                  {draftValidation
                    ? draftValidation.ok
                      ? 'Current command PASS'
                      : 'Blocked / unverified'
                    : draftAuthoringBound
                      ? 'v1.9 bound · command-specific'
                      : 'Not bound'}
                </dd>
              </div>
              <div>
                <dt>DDV write</dt>
                <dd>Disabled</dd>
              </div>
            </dl>
            <p class="placement-readiness-note">
              {placementReadiness.bounds.status !== 'AUTHORITATIVE'
                ? placementReadiness.bounds.blocker
                : draftAuthoringBound
                  ? 'v1.8 FloorType and v1.9 native placement are evaluated after each draft command. exactBuildKnown=false remains an explicit blocker and is never promoted to VALID.'
                  : 'Authoritative bounds are available; native placement remains unavailable until a trusted Core draft binding is attached.'}
            </p>
          </section>
        {/if}

        <section class="side-card">
          <p class="eyebrow">LAYERS</p>
          <div class="layer-list">
            {#each WEP_LAYERS as layer}
              <button
                class:off={!layerState[layer].visible}
                on:click={() => toggleLayer(layer)}
              >
                <span>{layer}</span>
                <small>
                  {layerState[layer].locked ? 'locked' : 'selectable'}
                </small>
              </button>
            {/each}
          </div>
        </section>

        <section class="side-card">
          <p class="eyebrow">SEARCH</p>
          <input
            value={query}
            on:input={(event) =>
              setQuery((event.currentTarget as HTMLInputElement).value)}
            placeholder="Item ID / name / tag"
            aria-label="World object search"
          />
          <div class="selection-actions">
            <button on:click={selectAllVisible}>Visibleを選択</button>
            <button
              class:active={selectedOnly}
              disabled={!selection.length && !selectedOnly}
              on:click={toggleSelectedOnly}
            >選択のみ</button>
            <button on:click={clearSelection}>選択解除</button>
          </div>
        </section>
      </aside>

      <main class="editor-shell">
        <div class="editor-toolbar">
          <div>
            <span class="toolbar-label">DRAFT TOOLS</span>
            <strong>{selectedCount} selected</strong>
          </div>
          <div class="toolbar-actions">
            <button
              disabled={!mutationBound || !selectedCount}
              on:click={() => runMutation('left')}
              aria-label="Move left"
            >←</button>
            <button
              disabled={!mutationBound || !selectedCount}
              on:click={() => runMutation('up')}
              aria-label="Move up"
            >↑</button>
            <button
              disabled={!mutationBound || !selectedCount}
              on:click={() => runMutation('down')}
              aria-label="Move down"
            >↓</button>
            <button
              disabled={!mutationBound || !selectedCount}
              on:click={() => runMutation('right')}
              aria-label="Move right"
            >→</button>
            <button
              disabled={!mutationBound || !selectedCount}
              on:click={() => runMutation('rotate')}
            >Rotate</button>
            <button
              disabled={!mutationBound || !selectedCount}
              on:click={copySelectedDraft}
            >Copy</button>
            <button
              disabled={!mutationBound || !copiedDraftClipboard?.graph?.length}
              on:click={pasteCopiedDraft}
            >Paste</button>
            <button
              disabled={!mutationBound || !selectedCount}
              on:click={() => runMutation('duplicate')}
            >Duplicate</button>
            <button
              disabled={!mutationBound || !selectedCount}
              on:click={() => runMutation('delete')}
            >Delete</button>
            <button
              disabled={!mutationBound || !session.canUndo()}
              on:click={undo}
            >Undo</button>
            <button
              disabled={!mutationBound || !session.canRedo()}
              on:click={redo}
            >Redo</button>
            <button
              class="save-prep"
              disabled={!session}
              on:click={reviewSavePreparation}
            >Review Save Prep</button>
          </div>
        </div>

        <div class="draft-status" aria-live="polite">
          <span>
            Draft authoring
            <strong>{mutationBound ? 'Available' : 'Read-only'}</strong>
          </span>
          <span>
            Last command
            <strong>{lastDraftCommand || 'None'}</strong>
          </span>
          <span>
            Validation
            <strong>
              {draftValidation
                ? draftValidation.ok
                  ? 'PASS'
                  : 'BLOCKED / UNVERIFIED'
                : 'Not run'}
            </strong>
          </span>
          <span>
            Clipboard
            <strong>
              {copiedDraftClipboard?.graph?.length
                ? `${copiedDraftClipboard.graph.length} object graph`
                : 'Empty'}
            </strong>
          </span>
          <span>
            Persistent save
            <strong>Unavailable</strong>
          </span>
        </div>
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
            aria-label="World Editor top-down canvas"
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
                tabindex="0"
                aria-label={`${object.metadata?.displayName ?? object.itemId} at ${object.x}, ${object.y}`}
                on:click={(event) =>
                  selectObject(
                    object.editorId,
                    event.ctrlKey || event.metaKey || event.shiftKey
                  )}
                on:keydown={(event) => {
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
          <span>{projected.length} visible</span>
          <span>
            Road / Fenceはcapability未接続時にlocked表示されます。
          </span>
          <span>Persistent write: disabled</span>
        </div>
        {#if draftSavePreparation}
          <div class="save-preparation">
            <strong>Save preparation</strong>
            <span>
              {draftSavePreparation.writeReady
                ? 'Writer contract ready'
                : 'Blocked before persistent commit'}
            </span>
            <code>{draftSavePreparation.reason}</code>
            <small>
              {editorBlockerText(String(draftSavePreparation.reason))}
            </small>
          </div>
        {/if}
      </main>
    </div>

    {#if fencePostNetworks.length}
      <section class="fence-post-panel" aria-labelledby="fence-post-title">
        <div class="fence-post-heading">
          <div>
            <p class="eyebrow">FENCE REPRESENTATION / CORE-BOUND MODEL</p>
            <h2 id="fence-post-title">Post layout</h2>
            <p>
              Promoted 01C/Core contractのlogicalTopologyとrepresentationLayoutを分離したまま、
              degree-2 interior Base/postだけを編集します。interval可否はfamily+modeのexact extension vocabularyから判定し、
              captured/pinned postは明示操作なしに変更しません。
            </p>
          </div>
          <div class="full-design-gates">
            <span>Topology <strong>Separate operation</strong></span>
            <span>DDV write <strong>Disabled</strong></span>
            <span>Scene Preset <strong>Blocked after post-layout edit</strong></span>
          </div>
        </div>

        <div class="fence-post-controls">
          <label>
            <span>Fence network</span>
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
                Max interval
                <strong>{fencePostValidation.constraints?.maximumPostInterval ?? '—'}</strong>
                <small>catalog-derived</small>
              </span>
              <span>
                Semantic anchors
                <strong>{fencePostDraft.logicalTopology?.semanticAnchors?.length ?? 0}</strong>
              </span>
              <span>
                Representation posts
                <strong>{fencePostDraft.representationLayout?.posts?.length ?? 0}</strong>
              </span>
              <span>
                Representation mode
                <strong>
                  {fencePostDraft.representationLayout?.intent === 'EXACT_PRESERVATION'
                    ? 'Exact preservation'
                    : 'Generated design'}
                </strong>
                <small>{fencePostDraft.representationLayout?.policy}</small>
              </span>
              <span>
                Core preflight
                <strong>{fencePostValidation.ok ? 'PASS' : 'BLOCKED'}</strong>
              </span>
            </div>

            <div class="fence-post-editor-grid">
              <div class="fence-post-form">
                <label>
                  <span>Post</span>
                  <select bind:value={fencePostMoveNodeId}>
                    <option value="">Choose post</option>
                    {#each fencePostDraft.representationLayout?.posts ?? [] as post}
                      <option value={post.nodeId}>
                        ({post.x}, {post.y}) {post.pinned ? '· pinned' : ''}
                      </option>
                    {/each}
                  </select>
                </label>
                <label>
                  <span>X</span>
                  <input type="number" bind:value={fencePostEditX} />
                </label>
                <label>
                  <span>Y</span>
                  <input type="number" bind:value={fencePostEditY} />
                </label>
                <button on:click={insertFencePostDraft}>Insert Post</button>
                <button
                  disabled={!fencePostMoveNodeId}
                  on:click={moveFencePostDraft}
                >Move Post</button>
                <button on:click={autoLayoutFencePosts}>
                  Centered balanced auto-layout
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
                    >{post.pinned ? 'Unpin' : 'Pin'}</button>
                    <button on:click={() => removeFencePostDraft(post.nodeId)}>
                      Remove Post
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
                      ? `max ${issue.maximumPostInterval}`
                      : issue.distance
                        ? `interval ${issue.distance}`
                        : ''}
                  </span>
                {/each}
              </div>
            {/if}

            {#if fencePostMessage}
              <small>{fencePostMessage}</small>
            {/if}

            <div class="fence-topology-boundary">
              <strong>Topology edit</strong>
              <span>
                endpoint / corner / junction / mode-boundary変更、segment delete、split/joinは
                representationLayoutではなくlogicalTopologyの操作です。このpanelでは実行しません。
              </span>
              <button disabled>Topology mutation writer not authorized</button>
            </div>
          {/if}
        </div>
      </section>
    {/if}

    {#if worldSource && (fullDesignPlan || fullDesignPlanError)}
      <section class="full-design-panel" aria-labelledby="full-design-title">
        <div class="full-design-heading">
          <div>
            <p class="eyebrow">FULL-DESIGN PRESET READINESS</p>
            <h2 id="full-design-title">
              {fullDesignPlan?.presetType === 'floating_island'
                ? 'Floating Island Preset plan'
                : 'Biome Preset plan'}
            </h2>
            <p>
              current 01B portable identity/state契約とv1.7 authoritative GridData boundsから作る
              read-only capture manifestです。これは公開Preset artifactでもApply planでもありません。
            </p>
          </div>
          <div class="full-design-gates">
            <span>
              Source artifact
              <strong>{fullDesignPlan?.publicationCandidateReady ? 'Candidate ready' : 'Blocked'}</strong>
            </span>
            <span>Community publish <strong>Not bound</strong></span>
            <span>Apply <strong>Disabled</strong></span>
          </div>
        </div>

        {#if fullDesignPlan}
          <div class="full-design-summary">
            <div>
              <span>Semantic target</span>
              <strong>{fullDesignIdentityLabel(fullDesignPlan)}</strong>
            </div>
            <div>
              <span>Portable direct roots</span>
              <strong>{fullDesignPlan.directRootRoutes.length}</strong>
            </div>
            <div>
              <span>Manifest v1</span>
              <strong>{fullDesignPlan.manifestValidation?.ok ? 'Strict validation PASS' : 'Blocked'}</strong>
            </div>
            <div>
              <span>Source categories</span>
              <strong>{fullDesignPlan.sourceCategoryClosureReady ? 'Closed' : 'Blocked'}</strong>
            </div>
            <div>
              <span>Exact build</span>
              <strong>Unproven from save</strong>
            </div>
            <div>
              <span>Persistent write</span>
              <strong>Unauthorized</strong>
            </div>
          </div>

          <div class="full-design-routes">
            <span>Portable direct-root routes</span>
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
                      v1.10 classes
                      <strong>
                        ordinary {category.classificationSummary?.ordinary ?? 0} ·
                        special {category.classificationSummary?.special ?? 0} ·
                        off-grid {category.classificationSummary?.offGrid ?? 0} ·
                        unknown {category.classificationSummary?.unknown ?? 0}
                      </strong>
                    </span>
                    <span>
                      Ordinary placement
                      <strong>
                        {category.ordinaryPlacement.destinationPlacementStatus === 'NOT_APPLICABLE'
                          ? 'No Building'
                          : category.ordinaryPlacement.destinationPlacementStatus === 'PREFLIGHT_CONTRACT_AVAILABLE'
                            ? 'Typed preflight available'
                            : 'Blocked by typed class/evidence'}
                      </strong>
                    </span>
                    <span>
                      Building skin
                      <strong>
                        {category.buildingSkins?.entries?.length ?? 0} ·
                        {category.buildingSkins?.semanticStatus ?? 'UNKNOWN'}
                      </strong>
                    </span>
                    <span>
                      PlayerHouse
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
                    : 'No category blocker recorded'}
                </small>
              </article>
            {/each}
          </div>

          <p class="full-design-boundary">
            source GridID / GridObjectIDはmanifestから除去されます。Quest / NPC / progression /
            online entitlementはfull-design decoration stateに含めません。Road/Fenceは01C Core readerと
            promoted representation-layout contractを消費し、clipped/unsupported topologyはfail-closedです。
            Buildingはpromoted v1.10 typed contractをconsumeし、ordinary / special / off-grid / unknownを分離します。
            House/Otherをordinaryへ昇格するのは5つのauthoritative special signalがすべてfalseの場合だけです。
            Destination stock/ownership・multiplicity・typed initial-state validatorが無ければordinary placementもfail-closedです。
            Destination preflightとpersistent Applyは別Gateで、DDV write authorizationは無効です。
          </p>

          <div class="full-design-destination">
            <div class="full-design-destination-copy">
              <div>
                <span>Destination preflight</span>
                <strong>{fullDesignDestinationStatus(fullDesignDestinationPreflight)}</strong>
              </div>
              <p>
                別のNintendo Switch v1.25.0 saveをローカルで読み込み、semantic target、
                portable direct-root route、v1.8 FloorType map、v1.9 native placement legality、
                Building / PlayerHouse / Environmentをread-onlyで検証します。
                ファイルはこの操作ではアップロードされません。
              </p>
            </div>

            <label class="file-button full-design-destination-button">
              {fullDesignDestinationLoading ? 'Checking…' : 'Check destination save'}
              <input
                type="file"
                accept=".json,.save,application/json,application/octet-stream"
                disabled={fullDesignDestinationLoading}
                on:change={openFullDesignDestination}
              />
            </label>

            {#if fullDesignDestinationFileName}
              <div class="full-design-destination-result">
                <span>Destination</span>
                <code>{fullDesignDestinationFileName}</code>
                {#if fullDesignDestinationPreflight}
                  <strong>
                    Routes {fullDesignDestinationPreflight.destination?.directRootResolutions?.length ?? 0}
                    / {fullDesignPlan.directRootRoutes.length}
                  </strong>
                  <strong>
                    Road / Fence model preflight
                    {fullDesignDestinationPreflight.roadFenceModelPreflightReady
                      ? `PASS · ${fullDesignDestinationPreflight.destination?.roadFencePreflight?.bindings?.length ?? 0} root-category bindings · writer OFF`
                      : 'BLOCKED'}
                  </strong>
                  <strong>
                    Building v1.10 contract
                    {fullDesignDestinationPreflight.buildingV110ContractBound
                      ? 'BOUND'
                      : 'NOT BOUND'}
                  </strong>
                  <strong>
                    Building typed preflight
                    {fullDesignDestinationPreflight.buildingV110TypedPreflightReady
                      ? 'PASS / N/A'
                      : 'BLOCKED'}
                  </strong>
                  <strong>
                    Ordinary Building placement
                    {fullDesignDestinationPreflight.ordinaryBuildingPlacementReady
                      ? 'PASS / N/A'
                      : 'BLOCKED'}
                  </strong>
                  <strong>
                    Building skin diagnostic
                    {fullDesignDestinationPreflight.buildingSkinPreflightReady
                      ? 'PASS / N/A'
                      : 'BLOCKED'}
                  </strong>
                  <strong>
                    PlayerHouse binding diagnostic
                    {fullDesignDestinationPreflight.playerHouseBindingPreflightReady
                      ? 'PASS / N/A'
                      : 'BLOCKED · lifecycle still separate'}
                  </strong>
                  <strong>
                    Environment
                    {fullDesignDestinationPreflight.environmentPreflightReady
                      ? 'PASS'
                      : 'BLOCKED'}
                  </strong>
                  <strong>
                    Route resolved
                    {fullDesignDestinationPreflight.routeResolutionReady
                      ? 'PASS'
                      : 'BLOCKED'}
                  </strong>
                  <strong>
                    Bounds validated
                    {fullDesignDestinationPreflight.destination?.rootObjectRouteBindings?.length
                      ? `${fullDesignDestinationPreflight.destination.rootObjectRouteBindings.filter((entry: any) => entry.boundsValidated).length} / ${fullDesignDestinationPreflight.destination.rootObjectRouteBindings.length}`
                      : 'No portable ordinary objects'}
                  </strong>
                  <strong>
                    Placement validated
                    {fullDesignDestinationPreflight.nativePlacementContractBound
                      ? fullDesignNativePlacementSummary(fullDesignDestinationPreflight)
                      : 'Contract not bound'}
                  </strong>
                  <strong>
                    DDV write authorization
                    {fullDesignDestinationPreflight.ddvWriteAuthorized
                      ? 'AUTHORIZED'
                      : 'UNAUTHORIZED'}
                  </strong>
                  <strong>
                    Category closure
                    {fullDesignDestinationPreflight.categoryClosureReady
                      ? 'PASS'
                      : 'BLOCKED'}
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
                <strong>Destination preflight blocked</strong>
                <code>{fullDesignDestinationError}</code>
              </div>
            {/if}

            <small>
              native placementは CLEAR / REPLACES_OR_REMOVES_EXISTING / INVALID /
              UNKNOWN_UNVERIFIED を別Gateで保持します。UNKNOWNはVALIDへ昇格しません。
              Road/Fenceはdestination root・bounds/tessellation・portable model整合までをpreflightし、
              persistence serializer / inventory cost / commit authorizationとは分離します。
              このpreflightが成功してもApplyは有効になりません。
            </small>
          </div>
        {:else}
          <div class="full-design-error">
            <strong>Full-design planning blocked</strong>
            <code>{fullDesignPlanError}</code>
            <span>World Canvas自体はread-onlyのまま利用できます。</span>
          </div>
        {/if}
      </section>
    {/if}

    <section class="capture-panel">
      <div class="capture-copy">
        <p class="eyebrow">SCENE PRESET</p>
        <h2>Capture &amp; Publish</h2>
        <p>
          選択objectとSubGrid dependency closureをportable artifactへ変換します。
          source Grid / GridObject identityは公開artifactへ持ち出しません。
        </p>
      </div>

      <div class="capture-form">
        <label>
          <span>Title</span>
          <input bind:value={presetTitle} placeholder="My Scene Preset" />
        </label>
        <label>
          <span>Description</span>
          <textarea
            bind:value={presetDescription}
            rows="3"
            placeholder="この飾り付けについて"
          ></textarea>
        </label>
        <label>
          <span>Visibility</span>
          <select bind:value={visibility}>
            <option value="unlisted">Unlisted</option>
            <option value="public">Public</option>
            <option value="private">Private</option>
          </select>
        </label>

        <div class="capture-region-options">
          <label>
            <span>Capture Region</span>
            <select
              bind:value={captureRegionMode}
              on:change={() => {
                capturePreview = null;
                published = null;
              }}
            >
              <option value="selection">Selected object bounds</option>
              <option value="custom">Custom region</option>
            </select>
          </label>
          <button
            type="button"
            disabled={!selectedCount}
            on:click={useSelectedCaptureRegion}
          >Use selected bounds</button>
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
                <span>Width</span>
                <input type="number" min="1" step="1" bind:value={captureRegionW} />
              </label>
              <label>
                <span>Height</span>
                <input type="number" min="1" step="1" bind:value={captureRegionH} />
              </label>
            </div>
          {/if}
          <small>
            Selection boundsは選択objectのoccupied boundsを使用します。Custom regionはRoad/Fenceを含む範囲を明示できます。authoritative root bounds外やtopology clippingはfail-closedです。
          </small>
        </div>

        <div class="network-capture-options">
          <label>
            <input
              type="checkbox"
              bind:checked={includeRoads}
              disabled={roadFenceReaderBinding?.summary?.status !== 'supported'}
            />
            <span>Include Roads</span>
          </label>
          <label>
            <input
              type="checkbox"
              bind:checked={includeFences}
              disabled={roadFenceReaderBinding?.summary?.status !== 'supported'}
            />
            <span>Include Fences</span>
          </label>
          <small>
            01C contained-only Capture Region。境界でtopologyが切れる場合は
            <code>TOPOLOGY_CLIPPED_UNSUPPORTED</code>で停止します。
          </small>
        </div>

        <div class="capture-actions">
          <button
            disabled={!selectedCount || loading}
            on:click={previewScene}
          >Capture Preview</button>
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
          >Publish Scene Preset</button>
        </div>
      </div>

      <div class="capture-status">
        <div>
          <span>Capture</span>
          <strong>
            {capturePreview
              ? capturePreview.publicationReady
                ? 'Ready'
                : 'Blocked'
              : 'Not run'}
          </strong>
        </div>
        <div>
          <span>Community</span>
          <strong>{connected && creatorProfileId ? 'Connected' : 'Sign-in required'}</strong>
        </div>
        <div>
          <span>Roads / Fences</span>
          <strong>
            {roadFenceReaderBinding?.summary?.status === 'supported'
              ? `Core reader bound · ${roadFenceReaderBinding.summary.roadNetworkCount} road / ${roadFenceReaderBinding.summary.fenceNetworkCount} fence`
              : 'Raw Switch root Grid required'}
          </strong>
        </div>
        <div>
          <span>DDV Write</span>
          <strong>Disabled</strong>
        </div>
      </div>

      {#if capturePreview}
        <div class="artifact-summary">
          <strong>Portable artifact preview</strong>
          <span>{capturePreview.artifact.objects.length} objects</span>
          <span>
            {Object.keys(capturePreview.artifact.requirements.itemQuantities).length}
            item types
          </span>
          <span>
            bounds {capturePreview.artifact.bounds.w} × {capturePreview.artifact.bounds.h}
          </span>
          {#if capturePreview.artifact.networks?.roads}
            <span>{capturePreview.artifact.networks.roads.networks.length} Road networks</span>
          {/if}
          {#if capturePreview.artifact.networks?.fences}
            <span>{capturePreview.artifact.networks.fences.networks.length} Fence networks</span>
          {/if}
        </div>
      {/if}

      {#if published}
        <div class="published-card">
          <p class="eyebrow">PUBLISHED</p>
          <strong>{presetTitle}</strong>
          <code>{published.presetArtifactId}</code>
          <a href={`${base}/presets/`}>Presetsで確認する →</a>
        </div>
      {/if}
    </section>
  {:else if worldSource}
    <section class="save-source-browser">
      <div class="save-source-heading">
        <div>
          <p class="eyebrow">SAVE ROUTES / READ-ONLY</p>
          <h2>Area &amp; Direct Grid</h2>
          <p>
            save intakeは完了しています。Nintendo Switch sourceでは、
            Integrator-approved 01B v1.7 GridData bindingとSwitch v1.25 canonical geometry/scopeを使って
            選択したroot Gridをread-only EditorDocument / Canvasへ変換できます。
          </p>
        </div>
        <dl>
          <div><dt>File</dt><dd>{fileName}</dd></div>
          <div><dt>Input</dt><dd>{worldSource.inputFormat}</dd></div>
          <div><dt>Schema</dt><dd>{worldSource.profileSchemaVersion}</dd></div>
          <div><dt>Source</dt><dd>{worldSource.saveIdentity.sourcePlatform}</dd></div>
          <div><dt>Last save</dt><dd>{worldSource.saveIdentity.lastSavePlatform}</dd></div>
          <div><dt>Areas</dt><dd>{worldSource.areas.length}</dd></div>
          <div><dt>Floating</dt><dd>{worldSource.floatingIslands?.length ?? 0}</dd></div>
        </dl>
      </div>

      <div class="save-contract">
        <strong>Read contract only</strong>
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
                <span>Village {area.villageIndex}</span>
                <strong>Area {area.areaId}</strong>
              </div>
              <small>{area.unlocked === false ? 'locked in save' : 'save route'}</small>
            </header>

            <div class="root-grid-list">
              {#each area.roots as root}
                <div class="root-grid-row">
                  <div>
                    <strong>Grid {root.gridId}</strong>
                    <span>{root.gridDataPath ?? 'GridDataPath unavailable'}</span>
                  </div>
                  <div class="root-grid-meta">
                    <span>{root.objectCount} objects</span>
                    <span>tess ×{root.tessellationFactor}</span>
                  </div>
                  <button
                    disabled={
                      loading ||
                      worldSource.saveIdentity.sourcePlatform !== 'switch'
                    }
                    title={
                      worldSource.saveIdentity.sourcePlatform === 'switch'
                        ? 'Open with canonical 01B v1.7 read projection'
                        : 'Switch v1.25 browser read data is required for Canvas projection'
                    }
                    on:click={() => openSaveGridInCanvas(area, root.gridId)}
                  >
                    Open in Canvas
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
            <p class="eyebrow">FLOATING ISLANDS / READ-ONLY PLANNING</p>
            <strong>Semantic routes</strong>
          </div>
          <small>
            Canvas loader未接続のため、ここではcurrent 01B portable identity / direct-root contractと
            v1.7 GridData authorityによるfull-design planningだけを行います。
          </small>
        </div>

        {#if worldSource.floatingIslands?.length}
          <div class="area-route-list">
            {#each worldSource.floatingIslands as island}
              <article class="area-route">
                <header>
                  <div>
                    <span>Floating Island</span>
                    <strong>SceneItemId {island.sceneItemId}</strong>
                  </div>
                  <small>{island.unlocked === false ? 'locked in save' : 'semantic route'}</small>
                </header>

                <div class="floating-route-roots">
                  {#each island.roots as root}
                    <code>{root.gridDataPath ?? 'GridDataPath unavailable'}</code>
                  {/each}
                </div>

                <div class="floating-route-actions">
                  <span>
                    {island.roots.length} direct root{island.roots.length === 1 ? '' : 's'} ·
                    {floatingIslandObjectCount(island)} objects
                  </span>
                  <button
                    disabled={
                      loading ||
                      worldSource.saveIdentity.sourcePlatform !== 'switch'
                    }
                    on:click={() => previewFloatingIslandPlan(island)}
                  >
                    Preview full-design plan
                  </button>
                </div>
              </article>
            {/each}
          </div>
        {:else}
          <p class="floating-route-empty">Core-resolved Floating Island routeはこのsaveではありません。</p>
        {/if}

        {#if worldSource.floatingIslandDiagnostics?.length}
          <div class="floating-route-diagnostics">
            <strong>Unresolved identities</strong>
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
              <span>Target</span>
              <strong>{fullDesignIdentityLabel(floatingIslandPlan)}</strong>
            </div>
            <div>
              <span>Manifest</span>
              <strong>{floatingIslandPlan.manifestValidation?.ok ? 'Strict validation PASS' : 'Blocked'}</strong>
            </div>
            <div>
              <span>Direct roots</span>
              <strong>{floatingIslandPlan.directRootRoutes.length}</strong>
            </div>
            <div>
              <span>Publication / Apply</span>
              <strong>Blocked / Disabled</strong>
            </div>
            <p>
              Building / PlayerHouse / Environment portable stateは現在の01B contractでcaptureされます。
              Floating IslandのEditorDocument composition / Canvas / placement validationは未bindingです。
            </p>
          </div>
        {/if}

        {#if floatingIslandPlanError}
          <div class="full-design-error">
            <strong>Floating Island planning blocked</strong>
            <code>{floatingIslandPlanError}</code>
          </div>
        {/if}
      </div>

      <p class="projection-boundary">
        Switch Canvasは01B v1.7 pinned GridData contract + checksum検証済み01D-derived geometry/scopeを使用します。
        Steam / unknown sourceは対応dataが承認されるまでArea/Grid列挙でfail-closedです。
        Authoritative Root Grid bounds / reachable SubGrid dimensionsとsupported Road/Fence logical read/captureはbinding済みです。
        native terrain/FloorType/occupancy legality、topology edit、real-target mutationは未bindingです。
      </p>
    </section>
  {:else}
    <div class="empty-world">
      <span aria-hidden="true">◇</span>
      <strong>DDV Save または EditorDocument を開いてください</strong>
      <p>
        ファイルはブラウザ内で処理されます。Publishを実行するまでCommunityへ送信しません。
      </p>
    </div>
  {/if}

  <div class="safety-note">
    <strong>Current safety boundary</strong>
    <span>
      Nintendo Switch / Steamの実DDV targetに対するpersistent ADD / DELETE / MOVE / ROTATE、
      native GridObject ID allocation、inventory消費、Road/Fence mutation、save replacementは未許可です。
    </span>
  </div>
</section>

<style>
  .world-page{padding-block:60px 96px;min-height:78vh}.world-heading{display:flex;justify-content:space-between;align-items:end;gap:28px}.world-heading h1{font-family:Georgia,serif;font-size:clamp(42px,6vw,66px);font-weight:500;letter-spacing:-.055em;margin:14px 0}.preset-link{flex:none;border:1px solid var(--border);background:var(--surface);padding:12px 16px;border-radius:999px;color:var(--gold);font-size:12px;font-weight:800}.load-panel{margin-top:30px;padding:20px 22px;border:1px solid var(--border);border-radius:18px;background:var(--surface);display:flex;align-items:center;justify-content:space-between;gap:24px}.load-panel h2,.capture-panel h2{font-family:Georgia,serif;font-size:26px;font-weight:500;margin:7px 0}.load-panel p,.capture-copy p{color:var(--ink-soft);font-size:12px;line-height:1.8;margin:0}.load-panel code{color:var(--gold)}.load-controls{display:flex;align-items:end;gap:9px;flex:none}.platform-select{display:grid;gap:5px}.platform-select span{font-size:8px;letter-spacing:.11em;text-transform:uppercase;color:var(--ink-muted)}.platform-select select{background:var(--surface-raised);color:var(--ink);border:1px solid var(--border);border-radius:10px;padding:10px 11px;font-size:11px}.file-button{flex:none;border:1px solid var(--border);background:var(--surface-raised);border-radius:12px;padding:11px 15px;font-size:12px;font-weight:800;color:var(--ink);cursor:pointer}.file-button input{position:absolute;opacity:0;pointer-events:none}.status{margin:14px 0 0;padding:12px 15px;border:1px solid var(--border);border-radius:12px;background:var(--surface);color:var(--ink-soft);font-size:12px;line-height:1.7}.save-source-browser{margin-top:18px;border:1px solid var(--border);border-radius:20px;background:var(--surface);padding:22px}.save-source-heading{display:grid;grid-template-columns:minmax(0,1fr) minmax(260px,.55fr);gap:24px;align-items:start}.save-source-heading h2{font-family:Georgia,serif;font-size:28px;font-weight:500;margin:7px 0}.save-source-heading p{color:var(--ink-soft);font-size:12px;line-height:1.8;margin:0}.save-source-heading dl{display:grid;gap:7px;margin:0}.save-source-heading dl>div{display:grid;grid-template-columns:78px minmax(0,1fr);gap:8px}.save-source-heading dt{font-size:9px;text-transform:uppercase;letter-spacing:.1em;color:var(--ink-muted)}.save-source-heading dd{margin:0;font-size:11px;color:var(--ink-soft);overflow-wrap:anywhere}.save-contract{margin-top:16px;border:1px solid var(--border);background:var(--page-2);border-radius:11px;padding:11px 13px;display:flex;justify-content:space-between;gap:12px;font-size:10px;color:var(--ink-muted)}.save-contract strong{color:var(--help-accent)}.area-route-list{display:grid;gap:10px;margin-top:14px}.area-route{border:1px solid var(--border);background:var(--surface-raised);border-radius:14px;padding:14px}.area-route>header{display:flex;justify-content:space-between;gap:12px;align-items:center}.area-route>header div{display:flex;gap:9px;align-items:baseline}.area-route>header span,.area-route>header small{font-size:9px;color:var(--ink-muted)}.area-route>header strong{font-size:13px}.root-grid-list{display:grid;gap:6px;margin-top:10px}.root-grid-row{display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:12px;align-items:center;border-top:1px solid var(--border);padding-top:8px}.root-grid-row>div:first-child{display:grid;gap:2px;min-width:0}.root-grid-row>div:first-child strong{font-size:11px}.root-grid-row>div:first-child span{font-size:9px;color:var(--ink-muted);overflow-wrap:anywhere}.root-grid-meta{display:flex;gap:8px;color:var(--ink-muted);font-size:9px}.root-grid-row button{border:1px solid var(--border);background:transparent;color:var(--ink-muted);border-radius:8px;padding:7px 9px;font-size:9px}.floating-route-section{margin-top:18px;border-top:1px solid var(--border);padding-top:16px}.floating-route-heading{display:flex;justify-content:space-between;gap:18px;align-items:end}.floating-route-heading>div{display:grid;gap:4px}.floating-route-heading>div>strong{font-size:13px}.floating-route-heading>small,.floating-route-empty{max-width:620px;color:var(--ink-muted);font-size:9px;line-height:1.6}.floating-route-roots{display:grid;gap:4px;margin-top:10px}.floating-route-roots code{font-size:9px;color:var(--ink-muted);overflow-wrap:anywhere}.floating-route-actions{display:flex;justify-content:space-between;gap:12px;align-items:center;margin-top:10px;font-size:9px;color:var(--ink-muted)}.floating-route-actions button{border:1px solid var(--border);background:transparent;color:var(--ink-muted);border-radius:8px;padding:7px 9px;font-size:9px}.floating-route-diagnostics{margin-top:10px;display:grid;gap:5px;padding:10px;border-radius:10px;background:var(--page-2);font-size:9px}.floating-route-diagnostics span{display:flex;gap:8px;color:var(--ink-muted)}.floating-plan-preview{margin-top:10px;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;padding:12px;border:1px solid var(--border);border-radius:12px;background:var(--page-2)}.floating-plan-preview>div{display:grid;gap:4px}.floating-plan-preview span{font-size:8px;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-muted)}.floating-plan-preview strong{font-size:10px}.floating-plan-preview p{grid-column:1/-1;margin:2px 0 0;color:var(--ink-muted);font-size:9px;line-height:1.6}.projection-boundary{margin:15px 0 0;color:var(--ink-muted);font-size:10px;line-height:1.7}.workspace{display:grid;grid-template-columns:245px minmax(0,1fr);gap:16px;margin-top:18px}.sidebar{display:grid;gap:12px;align-content:start}.side-card{border:1px solid var(--border);background:var(--surface);border-radius:17px;padding:16px}.side-card dl{display:grid;gap:8px;margin:13px 0 0}.side-card dl>div{display:grid;grid-template-columns:72px minmax(0,1fr);gap:8px}.side-card dt{font-size:9px;text-transform:uppercase;letter-spacing:.1em;color:var(--ink-muted)}.side-card dd{margin:0;font-size:11px;color:var(--ink-soft);overflow-wrap:anywhere}.binding-state{font-size:10px;line-height:1.5;margin:14px 0 0;color:var(--help-accent)}.binding-state.blocked{color:var(--decor-accent)}.placement-readiness-note{margin:12px 0 0;color:var(--ink-muted);font-size:9px;line-height:1.55}.back-to-routes{margin-top:10px;width:100%;border:1px solid var(--border);background:transparent;color:var(--ink-soft);border-radius:9px;padding:8px;font-size:10px}.layer-list{display:grid;gap:6px;margin-top:12px}.layer-list button{border:1px solid var(--border);background:var(--surface-raised);color:var(--ink);border-radius:10px;padding:8px 10px;display:flex;justify-content:space-between;align-items:center;font-size:11px}.layer-list button.off{opacity:.45}.layer-list small{font-size:9px;color:var(--ink-muted)}.side-card>input{width:100%;margin-top:12px;background:var(--surface-raised);color:var(--ink);border:1px solid var(--border);border-radius:10px;padding:10px}.selection-actions{display:flex;gap:7px;margin-top:8px;flex-wrap:wrap}.selection-actions button{flex:1;background:transparent;color:var(--ink-soft);border:1px solid var(--border);border-radius:9px;padding:7px;font-size:10px}.selection-actions button.active{color:var(--gold);border-color:var(--gold)}.editor-shell{min-width:0;border:1px solid var(--border);border-radius:20px;background:var(--surface);overflow:hidden}.editor-toolbar{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:13px 15px;border-bottom:1px solid var(--border)}.editor-toolbar>div:first-child{display:grid;gap:2px}.toolbar-label{font-size:8px;letter-spacing:.15em;color:var(--gold);font-weight:900}.editor-toolbar strong{font-size:11px}.toolbar-actions{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:5px}.toolbar-actions button,.capture-actions button{border:1px solid var(--border);background:var(--surface-raised);color:var(--ink);border-radius:9px;padding:7px 10px;font-size:10px;font-weight:800}.toolbar-actions button:disabled,.capture-actions button:disabled{opacity:.35;cursor:not-allowed}.canvas-wrap{height:min(62vh,650px);min-height:410px;background:var(--page-2);overflow:hidden}.world-canvas{width:100%;height:100%;display:block}.canvas-bg{fill:var(--page-2)}.grid-overlay{stroke:var(--border);stroke-width:.018;fill:none;opacity:.8}.object-cell{stroke:var(--page);stroke-width:.08;vector-effect:non-scaling-stroke;fill:var(--world-accent);opacity:.72}.layer-road{fill:var(--gold)}.layer-fence{fill:var(--ink-muted)}.layer-static{fill:var(--ink-muted)}.layer-landscaping{fill:var(--help-accent)}.layer-building{fill:var(--decor-accent)}.layer-furniture{fill:var(--world-accent)}g.locked .object-cell{opacity:.28}g.selected .object-cell{stroke:var(--gold-strong);stroke-width:.16;opacity:1}.canvas-footer{display:flex;justify-content:space-between;gap:12px;padding:10px 14px;border-top:1px solid var(--border);font-size:9px;color:var(--ink-muted)}.draft-status{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin:10px 0}.draft-status>span{display:grid;gap:4px;padding:9px 11px;border:1px solid var(--border);border-radius:10px;background:var(--surface-raised);font-size:8px;color:var(--ink-muted);text-transform:uppercase;letter-spacing:.08em}.draft-status strong{color:var(--ink);font-size:9px;letter-spacing:0;text-transform:none}.draft-blockers,.save-preparation{display:grid;gap:6px;margin:0 0 10px;padding:10px 12px;border:1px solid var(--border);border-radius:10px;background:var(--page-2);font-size:9px;color:var(--ink-muted)}.draft-blockers span{display:grid;grid-template-columns:minmax(160px,auto) 1fr;gap:9px}.draft-blockers code,.save-preparation code{color:var(--decor-accent);overflow-wrap:anywhere}.save-preparation{grid-template-columns:auto auto minmax(160px,1fr);align-items:baseline}.save-preparation small{grid-column:1/-1}.toolbar-actions .save-prep{margin-left:4px}.full-design-panel{margin-top:18px;border:1px solid var(--border);border-radius:20px;background:var(--surface);padding:22px;display:grid;gap:16px}.full-design-heading{display:flex;justify-content:space-between;align-items:flex-start;gap:22px}.full-design-heading h2{font-family:Georgia,serif;font-size:26px;font-weight:500;margin:7px 0}.full-design-heading p{max-width:720px;color:var(--ink-soft);font-size:12px;line-height:1.8;margin:0}.full-design-gates{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}.full-design-gates span{border:1px solid var(--border);border-radius:999px;padding:8px 11px;font-size:9px;color:var(--ink-muted);white-space:nowrap}.full-design-gates strong{color:var(--decor-accent)}.full-design-summary{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px}.full-design-summary>div,.full-design-categories article{background:var(--surface-raised);border-radius:11px;padding:11px}.full-design-summary span,.full-design-routes>span,.full-design-categories article span{display:block;font-size:8px;letter-spacing:.12em;text-transform:uppercase;color:var(--ink-muted)}.full-design-summary strong,.full-design-categories article strong{display:block;margin-top:5px;font-size:10px;line-height:1.45}.full-design-routes{display:grid;gap:6px}.full-design-routes code{display:block;padding:8px 10px;border:1px solid var(--border);border-radius:9px;background:var(--page-2);font-size:9px;overflow-wrap:anywhere}.full-design-categories{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.full-design-categories article{border:1px solid transparent}.full-design-categories article.blocked{border-color:var(--border)}.full-design-categories article small{display:block;margin-top:8px;color:var(--ink-muted);font-size:9px;line-height:1.55}.full-design-boundary{margin:0;color:var(--ink-muted);font-size:10px;line-height:1.7}.full-design-destination{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;align-items:start;border-top:1px solid var(--border);padding-top:14px}.full-design-destination-copy{display:grid;gap:6px}.full-design-destination-copy>div{display:flex;gap:10px;align-items:baseline}.full-design-destination-copy span,.full-design-destination-result>span{font-size:8px;letter-spacing:.12em;text-transform:uppercase;color:var(--ink-muted)}.full-design-destination-copy strong{font-size:11px}.full-design-destination-copy p,.full-design-destination>small{margin:0;color:var(--ink-muted);font-size:9px;line-height:1.6}.full-design-destination-button{align-self:center}.full-design-destination-result,.full-design-destination-issues{grid-column:1/-1;display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding:10px;border-radius:10px;background:var(--page-2);font-size:9px}.full-design-destination-result code{overflow-wrap:anywhere}.full-design-destination-result strong{font-size:9px}.full-design-destination-issues{display:grid}.full-design-destination-issues span{display:flex;gap:8px;align-items:baseline;color:var(--ink-muted)}.full-design-destination-issues code{color:var(--decor-accent);overflow-wrap:anywhere}.full-design-destination>.full-design-error,.full-design-destination>small{grid-column:1/-1}.full-design-error{display:grid;gap:6px;padding:13px;border:1px solid var(--border);border-radius:12px;background:var(--page-2);font-size:10px}.full-design-error strong{color:var(--decor-accent)}.full-design-error code{overflow-wrap:anywhere}.capture-panel{margin-top:18px;border:1px solid var(--border);border-radius:20px;background:var(--surface);padding:22px;display:grid;grid-template-columns:minmax(0,.8fr) minmax(320px,1.2fr);gap:20px}.capture-form{display:grid;gap:10px}.capture-form label{display:grid;gap:6px}.capture-form label>span{font-size:9px;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-muted)}.capture-form input,.capture-form textarea,.capture-form select{width:100%;background:var(--surface-raised);color:var(--ink);border:1px solid var(--border);border-radius:10px;padding:10px 11px}.capture-form textarea{resize:vertical}.capture-region-options{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:end;padding:10px 12px;border:1px solid var(--border);border-radius:10px;background:var(--page-2)}.capture-region-options>label{display:grid;gap:6px}.capture-region-options>label>span,.capture-region-grid span{font-size:8px;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-muted)}.capture-region-options>button{padding:10px 12px}.capture-region-grid{grid-column:1/-1;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}.capture-region-grid label{display:grid;gap:4px}.capture-region-options>small{grid-column:1/-1;color:var(--ink-muted);font-size:8px;line-height:1.5}.network-capture-options{display:flex;gap:12px;align-items:center;flex-wrap:wrap;padding:10px 12px;border:1px solid var(--border);border-radius:10px;background:var(--page-2)}.network-capture-options>label{display:flex;gap:6px;align-items:center;font-size:10px}.network-capture-options>label input{margin:0}.network-capture-options>small{flex-basis:100%;color:var(--ink-muted);font-size:8px;line-height:1.5}.network-capture-options code{color:var(--decor-accent)}.capture-actions{display:flex;gap:8px}.capture-actions button{padding:10px 13px}.capture-actions button.publish{background:var(--gold-strong);color:var(--gold-ink)}.capture-status{grid-column:1/-1;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}.capture-status>div{background:var(--surface-raised);border-radius:11px;padding:11px}.capture-status span{display:block;font-size:8px;letter-spacing:.12em;text-transform:uppercase;color:var(--ink-muted)}.capture-status strong{display:block;margin-top:5px;font-size:10px;line-height:1.45}.artifact-summary,.published-card{grid-column:1/-1;border:1px solid var(--border);border-radius:12px;padding:12px 14px;background:var(--page-2);display:flex;gap:14px;align-items:center;flex-wrap:wrap;font-size:10px;color:var(--ink-soft)}.artifact-summary strong{color:var(--ink)}.published-card{display:grid;gap:6px}.published-card>strong{font-family:Georgia,serif;font-size:18px;color:var(--ink)}.published-card code{font-size:9px;overflow-wrap:anywhere}.published-card a{color:var(--gold);font-weight:800}.empty-world{margin-top:18px;min-height:350px;border:1px dashed var(--border);border-radius:20px;display:grid;place-items:center;align-content:center;text-align:center;color:var(--ink-muted);background:var(--surface)}.empty-world>span{font-size:48px;color:var(--gold)}.empty-world strong{color:var(--ink);margin-top:8px}.empty-world p{max-width:520px;font-size:12px;line-height:1.8}.safety-note{margin-top:18px;padding:14px 17px;border:1px solid var(--border);border-radius:14px;background:var(--surface);display:grid;gap:5px;font-size:10px;color:var(--ink-muted);line-height:1.6}.safety-note strong{color:var(--decor-accent)}@media(max-width:900px){.world-heading,.load-panel,.full-design-heading,.floating-route-heading{align-items:flex-start;flex-direction:column}.save-source-heading{grid-template-columns:1fr}.workspace{grid-template-columns:1fr}.sidebar{grid-template-columns:repeat(3,minmax(0,1fr))}.full-design-gates{justify-content:flex-start}.full-design-summary{grid-template-columns:repeat(2,minmax(0,1fr))}.full-design-categories{grid-template-columns:repeat(2,minmax(0,1fr))}.capture-panel{grid-template-columns:1fr}.capture-status{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:620px){.floating-plan-preview{grid-template-columns:1fr}.floating-route-actions{align-items:flex-start;flex-direction:column}.full-design-destination{grid-template-columns:1fr}.full-design-destination-button{width:100%;text-align:center}.load-controls{width:100%;align-items:stretch;flex-direction:column}.platform-select select{width:100%}.root-grid-row{grid-template-columns:1fr}.root-grid-meta{flex-wrap:wrap}.save-contract{flex-direction:column}.world-page{padding-block:44px 70px}.sidebar{grid-template-columns:1fr}.editor-toolbar{align-items:flex-start;flex-direction:column}.toolbar-actions{justify-content:flex-start}.canvas-wrap{min-height:340px;height:52vh}.canvas-footer{flex-direction:column}.draft-status{grid-template-columns:repeat(2,minmax(0,1fr))}.save-preparation{grid-template-columns:1fr}.full-design-summary,.full-design-categories{grid-template-columns:1fr}.capture-status{grid-template-columns:1fr}.capture-region-options{grid-template-columns:1fr}.capture-region-options>button{width:100%}.capture-region-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.capture-actions{flex-direction:column}.file-button{width:100%;text-align:center}}

  .building-readiness-lines{display:grid;gap:5px;margin-top:6px}.building-readiness-lines span{display:flex;justify-content:space-between;gap:10px;font-size:10px;color:var(--ink-muted)}.building-readiness-lines strong{color:var(--ink-soft);text-align:right}.fence-post-panel{margin-top:22px;border:1px solid var(--border);border-radius:22px;background:var(--surface);padding:24px;box-shadow:var(--shadow)}.fence-post-heading{display:flex;justify-content:space-between;gap:24px;align-items:flex-start}.fence-post-heading h2{font-family:Georgia,serif;font-size:30px;font-weight:500;margin:8px 0}.fence-post-heading p:not(.eyebrow){max-width:760px;color:var(--ink-soft);font-size:12px;line-height:1.8}.fence-post-controls{display:grid;gap:14px;margin-top:18px}.fence-post-controls label{display:grid;gap:6px;font-size:10px;color:var(--ink-muted)}.fence-post-controls select,.fence-post-controls input{background:var(--surface-raised);color:var(--ink);border:1px solid var(--border);border-radius:10px;padding:9px 11px}.fence-post-summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}.fence-post-summary>span{display:grid;gap:4px;padding:11px;border-radius:12px;background:var(--surface-raised);font-size:9px;color:var(--ink-muted)}.fence-post-summary strong{font-size:13px;color:var(--ink)}.fence-post-editor-grid{display:grid;grid-template-columns:minmax(280px,.8fr) 1.2fr;gap:12px}.fence-post-form,.fence-post-list,.fence-topology-boundary{border:1px solid var(--border);border-radius:14px;padding:14px;background:var(--page-2)}.fence-post-form{display:grid;grid-template-columns:2fr 1fr 1fr;gap:8px}.fence-post-form button,.fence-post-list button,.fence-topology-boundary button{border:1px solid var(--border);background:var(--surface-raised);color:var(--ink-soft);border-radius:9px;padding:8px 10px;font-weight:800}.fence-post-list{display:grid;gap:7px;align-content:start}.fence-post-list>div{display:grid;grid-template-columns:auto 1fr auto auto;align-items:center;gap:8px;font-size:10px}.fence-topology-boundary{display:flex;align-items:center;gap:12px;flex-wrap:wrap}.fence-topology-boundary span{flex:1;min-width:260px;font-size:10px;line-height:1.6;color:var(--ink-muted)}@media(max-width:800px){.fence-post-heading{flex-direction:column}.fence-post-summary{grid-template-columns:repeat(2,minmax(0,1fr))}.fence-post-editor-grid{grid-template-columns:1fr}.fence-post-form{grid-template-columns:1fr 1fr}.fence-post-list>div{grid-template-columns:1fr 1fr}}
</style>
