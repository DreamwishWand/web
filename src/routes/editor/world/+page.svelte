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
  import { createSwitchV125RoadFenceReaderBinding } from '$lib/wep/roadfence-reader-adapter';
  import { assessCurrentV125BrowserPlacementReadiness } from '$lib/wep/placement-readiness';

  let session: any = null;
  let editorDocument: any = null;
  let worldSource: any = null;
  let projected: any[] = [];
  let selection: string[] = [];
  let layerState: any = null;
  let areaBounds = { x: 0, y: 0, w: 24, h: 16 };
  let query = '';
  let fileName = '';
  let message = '';
  let capturePreview: any = null;
  let published: any = null;
  let loading = false;
  let sourcePlatform = 'unknown';
  let switchWorldBinding: any = null;
  let fullDesignPlan: any = null;
  let fullDesignPlanError = '';
  let fullDesignDestinationFileName = '';
  let fullDesignDestinationPreflight: any = null;
  let fullDesignDestinationError = '';
  let fullDesignDestinationLoading = false;
  let floatingIslandPlan: any = null;
  let floatingIslandPlanError = '';
  let roadFenceReaderBinding: any = null;
  let includeRoads = false;
  let includeFences = false;

  let community: CommunityLabClient | null = null;
  let bridge: ReturnType<typeof createPresetCommunityBridge> | null = null;
  let workflow: ReturnType<typeof createScenePresetWorkflow> | null = null;
  let connected = false;
  let creatorProfileId = '';

  let presetTitle = '';
  let presetDescription = '';
  let visibility = 'unlisted';
  let publishKey = '';

  $: mutationBound =
    editorDocument?.target?.platform === 'synthetic';
  $: selectedCount = selection.length;
  $: objectCount = editorDocument?.objects?.length ?? 0;
  $: placementReadiness = editorDocument
    ? assessCurrentV125BrowserPlacementReadiness(editorDocument)
    : null;

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
    return ({
      COMPREHENSIVE_GRIDDATA_DIMENSIONS_NOT_BOUND:
        'authoritative GridData dimensions are not yet bound',
      FULL_DESIGN_ALL_ROOT_OBJECT_COMPOSITION_INCOMPLETE:
        'all-root object composition is not yet complete',
      FULL_DESIGN_ROOT_OBJECT_COMPOSITION_UNRESOLVED:
        'some direct-root objects are not portable under the current 01B contract',
      FULL_DESIGN_ROOT_OBJECT_ROUTE_DOCUMENTS_MISSING:
        'one or more direct-root EditorDocuments could not be bound',
      NATIVE_ROADFENCE_LOGICAL_READER_NOT_BOUND:
        'Core native → logical Road/Fence reader is not yet bound',
      FULL_DESIGN_ROADFENCE_CAPTURE_REGION_BOUNDS_UNAVAILABLE:
        '01C logical reader is bound, but authoritative full-root Capture Region bounds are not yet available',
      FULL_DESIGN_BUILDING_COMPOSITION_INCOMPLETE:
        'portable Building/PlayerHouse semantics exist, but full-design composition is incomplete',
      FULL_DESIGN_BUILDING_RESTORATION_CAPTURE_UNRESOLVED:
        'one or more Building/PlayerHouse restoration states could not be captured safely',
      FULL_DESIGN_ENVIRONMENT_PREFLIGHT_PARTIAL:
        'portable Environment state is captured, but full destination preflight remains partial',
      FULL_DESIGN_REQUIRED_CATEGORY_EXCLUDED:
        'a required full-design category was excluded'
    } as Record<string, string>)[code] ?? code;
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
      const count = Number(category?.restorationCapture?.entries?.length ?? 0);
      const unresolved = Number(
        category?.restorationCapture?.unresolved?.length ?? 0
      );
      return unresolved
        ? `${count} portable restoration state${count === 1 ? '' : 's'} captured · ${unresolved} unresolved`
        : `${count} portable restoration state${count === 1 ? '' : 's'} captured`;
    }
    if (categoryKey === 'environment' && category?.portableState) {
      return `codec ${category.portableState.codec}`;
    }
    return '';
  }

  function resetRoadFenceCapture() {
    roadFenceReaderBinding = null;
    includeRoads = false;
    includeFences = false;
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
        sourcePlatform: worldSource.saveIdentity.sourcePlatform
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

  function fullDesignDestinationIssueText(issue: any) {
    return String(
      issue?.detail?.message ??
        issue?.detail?.status ??
        issue?.code ??
        'Unknown preflight blocker'
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

      fullDesignDestinationPreflight =
        preflightCurrentV125FullDesignManifest({
          destinationProfile: opened.profile,
          destinationPlatform: opened.saveIdentity.sourcePlatform,
          manifest: fullDesignPlan.manifest
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
    projected = projectObjects(editorDocument, {
      layerState,
      query
    });
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
    resetFullDesignDestination();
    resetFloatingIslandPlan();
    resetRoadFenceCapture();

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
        selection = [];
        presetTitle = '';
        presetDescription = '';
        publishKey = '';
        refreshProjection();

        message =
          editorDocument.target?.platform === 'synthetic'
            ? 'EditorDocument をローカルで読み込みました。synthetic target のdraft操作が利用できます。'
            : 'EditorDocument をローカルで読み込みました。実DDV targetはCore mutation binding未接続のためread-onlyです。';
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
        presetTitle = '';
        presetDescription = '';
        publishKey = '';

        message =
          `DDV saveをローカルで読み込みました。schema ${opened.profileSchemaVersion} / ${opened.areas.length} Areas。exact buildはsave単体から証明せず、persistent writeは無効です。`;
      }
    } catch (error) {
      session = null;
      editorDocument = null;
      worldSource = null;
      projected = [];
      selection = [];
      layerState = null;
      fileName = '';
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
      includeRoads = false;
      includeFences = false;

      const fullDesignRootDocuments: any[] = [normalized];
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

      session = createEditorSession(normalized);
      editorDocument = session.getDocument();
      layerState = createLayerState({
        capabilities: editorDocument.capabilities
      });
      areaBounds = deriveAreaBounds(editorDocument);
      query = '';
      selection = [];
      presetTitle = '';
      presetDescription = '';
      publishKey = '';
      refreshProjection();

      try {
        fullDesignPlan = buildCurrentV125FullDesignCapturePlan({
          profile: worldSource.profile,
          rootGridId: Number(rootGridId),
          sourcePlatform: worldSource.saveIdentity.sourcePlatform,
          rootEditorDocuments: fullDesignRootDocuments
        });
        resetFullDesignDestination();
      } catch (planningError) {
        fullDesignPlan = null;
        fullDesignPlanError =
          planningError instanceof Error
            ? planningError.message
            : String(planningError);
      }

      const diagnostics = editorDocument.metadata?.diagnostics ?? [];
      const unresolvedBounds = diagnostics.some(
        (issue: any) => issue.code === 'ROOT_GRID_BOUNDS_UNRESOLVED'
      );

      message =
        'Switch v1.25.0のcanonical 01B v1.7 GridData/bounds + approved portable contracts + 01D geometry/scopeでread-only Canvasを生成しました。' +
        (unresolvedBounds
          ? ' このGridDataPathはv1.7 authoritative bounds未解決のため該当機能はfail-closedです。'
          : ' Authoritative boundsは利用できますが、native terrain/FloorType/occupancy legalityは未検証です。') +
        ' exact buildは未証明でMOVE/ROTATE/persistent writeは無効です。';
    } catch (error) {
      session = null;
      editorDocument = null;
      projected = [];
      selection = [];
      layerState = null;
      fullDesignPlan = null;
      fullDesignPlanError = '';
      resetRoadFenceCapture();
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
    resetFullDesignDestination();
    resetRoadFenceCapture();
    query = '';
    message =
      'DDV saveのArea / direct Grid一覧へ戻りました。persistent writeは無効です。';
  }

  function selectObject(id: string, toggle = false) {
    if (!session) return;
    selection = toggle
      ? session.toggleSelection(id)
      : session.setSelection([id]);
    capturePreview = null;
    published = null;
  }

  function selectAllVisible() {
    if (!session) return;
    selection = session.setSelection(
      projected.map((object) => object.editorId)
    );
    capturePreview = null;
    published = null;
  }

  function clearSelection() {
    if (!session) return;
    session.clearSelection();
    selection = [];
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

      if (result?.applied === false) {
        message = String(
          result.validation?.issues?.[0]?.code ??
            'Edit was rejected by the WEP validator.'
        );
      } else {
        message = 'draftを更新しました。DDVセーブへの書き込みは行っていません。';
      }

      capturePreview = null;
      published = null;
      refreshProjection();
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }
  }

  function undo() {
    if (!session || !mutationBound) return;
    session.undo();
    capturePreview = null;
    published = null;
    refreshProjection();
  }

  function redo() {
    if (!session || !mutationBound) return;
    session.redo();
    capturePreview = null;
    published = null;
    refreshProjection();
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
          title: presetTitle.trim(),
          includeRoads,
          includeFences,
          networkAdapter: roadFenceReaderBinding?.networkAdapter ?? null
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
          includeRoads,
          includeFences,
          networkAdapter: roadFenceReaderBinding?.networkAdapter ?? null
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
              ? 'Synthetic draft mutation'
              : 'Real target: read-only; exact-build mutation is not bound'}
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
                <dd>Not validated</dd>
              </div>
              <div>
                <dt>Apply</dt>
                <dd>Disabled</dd>
              </div>
            </dl>
            <p class="placement-readiness-note">
              {placementReadiness.bounds.status === 'AUTHORITATIVE'
                ? 'Bounds-only: water / no-build / FloorType / occupancy rules are not inferred.'
                : placementReadiness.bounds.blocker}
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
          </div>
        </div>

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
      </main>
    </div>

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
            <span>Publication <strong>Blocked</strong></span>
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
            v1.7 authoritative full-root boundsを使うcontained-only captureで、clipped/unsupported topologyは
            fail-closedです。Destination preflightはportable routeをdestination-local GridIDへ再解決しますが、
            native placement legalityと実際のApplyは依然別Gateで無効です。
          </p>

          <div class="full-design-destination">
            <div class="full-design-destination-copy">
              <div>
                <span>Destination preflight</span>
                <strong>{fullDesignDestinationStatus(fullDesignDestinationPreflight)}</strong>
              </div>
              <p>
                別のNintendo Switch v1.25.0 saveをローカルで読み込み、semantic target、
                portable direct-root route、Building / PlayerHouse / Environmentをread-onlyで検証します。
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
                    Building / PlayerHouse
                    {fullDesignDestinationPreflight.buildingRestorationPreflightReady
                      ? 'PASS'
                      : 'BLOCKED'}
                  </strong>
                  <strong>
                    Environment
                    {fullDesignDestinationPreflight.environmentPreflightReady
                      ? 'PASS'
                      : 'BLOCKED'}
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
              このpreflightが成功してもApplyは有効になりません。現在のfull-design category closureと
              persistent commit authorizationは別Gateです。
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
  .world-page{padding-block:60px 96px;min-height:78vh}.world-heading{display:flex;justify-content:space-between;align-items:end;gap:28px}.world-heading h1{font-family:Georgia,serif;font-size:clamp(42px,6vw,66px);font-weight:500;letter-spacing:-.055em;margin:14px 0}.preset-link{flex:none;border:1px solid var(--border);background:var(--surface);padding:12px 16px;border-radius:999px;color:var(--gold);font-size:12px;font-weight:800}.load-panel{margin-top:30px;padding:20px 22px;border:1px solid var(--border);border-radius:18px;background:var(--surface);display:flex;align-items:center;justify-content:space-between;gap:24px}.load-panel h2,.capture-panel h2{font-family:Georgia,serif;font-size:26px;font-weight:500;margin:7px 0}.load-panel p,.capture-copy p{color:var(--ink-soft);font-size:12px;line-height:1.8;margin:0}.load-panel code{color:var(--gold)}.load-controls{display:flex;align-items:end;gap:9px;flex:none}.platform-select{display:grid;gap:5px}.platform-select span{font-size:8px;letter-spacing:.11em;text-transform:uppercase;color:var(--ink-muted)}.platform-select select{background:var(--surface-raised);color:var(--ink);border:1px solid var(--border);border-radius:10px;padding:10px 11px;font-size:11px}.file-button{flex:none;border:1px solid var(--border);background:var(--surface-raised);border-radius:12px;padding:11px 15px;font-size:12px;font-weight:800;color:var(--ink);cursor:pointer}.file-button input{position:absolute;opacity:0;pointer-events:none}.status{margin:14px 0 0;padding:12px 15px;border:1px solid var(--border);border-radius:12px;background:var(--surface);color:var(--ink-soft);font-size:12px;line-height:1.7}.save-source-browser{margin-top:18px;border:1px solid var(--border);border-radius:20px;background:var(--surface);padding:22px}.save-source-heading{display:grid;grid-template-columns:minmax(0,1fr) minmax(260px,.55fr);gap:24px;align-items:start}.save-source-heading h2{font-family:Georgia,serif;font-size:28px;font-weight:500;margin:7px 0}.save-source-heading p{color:var(--ink-soft);font-size:12px;line-height:1.8;margin:0}.save-source-heading dl{display:grid;gap:7px;margin:0}.save-source-heading dl>div{display:grid;grid-template-columns:78px minmax(0,1fr);gap:8px}.save-source-heading dt{font-size:9px;text-transform:uppercase;letter-spacing:.1em;color:var(--ink-muted)}.save-source-heading dd{margin:0;font-size:11px;color:var(--ink-soft);overflow-wrap:anywhere}.save-contract{margin-top:16px;border:1px solid var(--border);background:var(--page-2);border-radius:11px;padding:11px 13px;display:flex;justify-content:space-between;gap:12px;font-size:10px;color:var(--ink-muted)}.save-contract strong{color:var(--help-accent)}.area-route-list{display:grid;gap:10px;margin-top:14px}.area-route{border:1px solid var(--border);background:var(--surface-raised);border-radius:14px;padding:14px}.area-route>header{display:flex;justify-content:space-between;gap:12px;align-items:center}.area-route>header div{display:flex;gap:9px;align-items:baseline}.area-route>header span,.area-route>header small{font-size:9px;color:var(--ink-muted)}.area-route>header strong{font-size:13px}.root-grid-list{display:grid;gap:6px;margin-top:10px}.root-grid-row{display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:12px;align-items:center;border-top:1px solid var(--border);padding-top:8px}.root-grid-row>div:first-child{display:grid;gap:2px;min-width:0}.root-grid-row>div:first-child strong{font-size:11px}.root-grid-row>div:first-child span{font-size:9px;color:var(--ink-muted);overflow-wrap:anywhere}.root-grid-meta{display:flex;gap:8px;color:var(--ink-muted);font-size:9px}.root-grid-row button{border:1px solid var(--border);background:transparent;color:var(--ink-muted);border-radius:8px;padding:7px 9px;font-size:9px}.floating-route-section{margin-top:18px;border-top:1px solid var(--border);padding-top:16px}.floating-route-heading{display:flex;justify-content:space-between;gap:18px;align-items:end}.floating-route-heading>div{display:grid;gap:4px}.floating-route-heading>div>strong{font-size:13px}.floating-route-heading>small,.floating-route-empty{max-width:620px;color:var(--ink-muted);font-size:9px;line-height:1.6}.floating-route-roots{display:grid;gap:4px;margin-top:10px}.floating-route-roots code{font-size:9px;color:var(--ink-muted);overflow-wrap:anywhere}.floating-route-actions{display:flex;justify-content:space-between;gap:12px;align-items:center;margin-top:10px;font-size:9px;color:var(--ink-muted)}.floating-route-actions button{border:1px solid var(--border);background:transparent;color:var(--ink-muted);border-radius:8px;padding:7px 9px;font-size:9px}.floating-route-diagnostics{margin-top:10px;display:grid;gap:5px;padding:10px;border-radius:10px;background:var(--page-2);font-size:9px}.floating-route-diagnostics span{display:flex;gap:8px;color:var(--ink-muted)}.floating-plan-preview{margin-top:10px;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;padding:12px;border:1px solid var(--border);border-radius:12px;background:var(--page-2)}.floating-plan-preview>div{display:grid;gap:4px}.floating-plan-preview span{font-size:8px;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-muted)}.floating-plan-preview strong{font-size:10px}.floating-plan-preview p{grid-column:1/-1;margin:2px 0 0;color:var(--ink-muted);font-size:9px;line-height:1.6}.projection-boundary{margin:15px 0 0;color:var(--ink-muted);font-size:10px;line-height:1.7}.workspace{display:grid;grid-template-columns:245px minmax(0,1fr);gap:16px;margin-top:18px}.sidebar{display:grid;gap:12px;align-content:start}.side-card{border:1px solid var(--border);background:var(--surface);border-radius:17px;padding:16px}.side-card dl{display:grid;gap:8px;margin:13px 0 0}.side-card dl>div{display:grid;grid-template-columns:72px minmax(0,1fr);gap:8px}.side-card dt{font-size:9px;text-transform:uppercase;letter-spacing:.1em;color:var(--ink-muted)}.side-card dd{margin:0;font-size:11px;color:var(--ink-soft);overflow-wrap:anywhere}.binding-state{font-size:10px;line-height:1.5;margin:14px 0 0;color:var(--help-accent)}.binding-state.blocked{color:var(--decor-accent)}.placement-readiness-note{margin:12px 0 0;color:var(--ink-muted);font-size:9px;line-height:1.55}.back-to-routes{margin-top:10px;width:100%;border:1px solid var(--border);background:transparent;color:var(--ink-soft);border-radius:9px;padding:8px;font-size:10px}.layer-list{display:grid;gap:6px;margin-top:12px}.layer-list button{border:1px solid var(--border);background:var(--surface-raised);color:var(--ink);border-radius:10px;padding:8px 10px;display:flex;justify-content:space-between;align-items:center;font-size:11px}.layer-list button.off{opacity:.45}.layer-list small{font-size:9px;color:var(--ink-muted)}.side-card>input{width:100%;margin-top:12px;background:var(--surface-raised);color:var(--ink);border:1px solid var(--border);border-radius:10px;padding:10px}.selection-actions{display:flex;gap:7px;margin-top:8px}.selection-actions button{flex:1;background:transparent;color:var(--ink-soft);border:1px solid var(--border);border-radius:9px;padding:7px;font-size:10px}.editor-shell{min-width:0;border:1px solid var(--border);border-radius:20px;background:var(--surface);overflow:hidden}.editor-toolbar{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:13px 15px;border-bottom:1px solid var(--border)}.editor-toolbar>div:first-child{display:grid;gap:2px}.toolbar-label{font-size:8px;letter-spacing:.15em;color:var(--gold);font-weight:900}.editor-toolbar strong{font-size:11px}.toolbar-actions{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:5px}.toolbar-actions button,.capture-actions button{border:1px solid var(--border);background:var(--surface-raised);color:var(--ink);border-radius:9px;padding:7px 10px;font-size:10px;font-weight:800}.toolbar-actions button:disabled,.capture-actions button:disabled{opacity:.35;cursor:not-allowed}.canvas-wrap{height:min(62vh,650px);min-height:410px;background:var(--page-2);overflow:hidden}.world-canvas{width:100%;height:100%;display:block}.canvas-bg{fill:var(--page-2)}.grid-overlay{stroke:var(--border);stroke-width:.018;fill:none;opacity:.8}.object-cell{stroke:var(--page);stroke-width:.08;vector-effect:non-scaling-stroke;fill:var(--world-accent);opacity:.72}.layer-road{fill:var(--gold)}.layer-fence{fill:var(--ink-muted)}.layer-static{fill:var(--ink-muted)}.layer-landscaping{fill:var(--help-accent)}.layer-building{fill:var(--decor-accent)}.layer-furniture{fill:var(--world-accent)}g.locked .object-cell{opacity:.28}g.selected .object-cell{stroke:var(--gold-strong);stroke-width:.16;opacity:1}.canvas-footer{display:flex;justify-content:space-between;gap:12px;padding:10px 14px;border-top:1px solid var(--border);font-size:9px;color:var(--ink-muted)}.full-design-panel{margin-top:18px;border:1px solid var(--border);border-radius:20px;background:var(--surface);padding:22px;display:grid;gap:16px}.full-design-heading{display:flex;justify-content:space-between;align-items:flex-start;gap:22px}.full-design-heading h2{font-family:Georgia,serif;font-size:26px;font-weight:500;margin:7px 0}.full-design-heading p{max-width:720px;color:var(--ink-soft);font-size:12px;line-height:1.8;margin:0}.full-design-gates{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}.full-design-gates span{border:1px solid var(--border);border-radius:999px;padding:8px 11px;font-size:9px;color:var(--ink-muted);white-space:nowrap}.full-design-gates strong{color:var(--decor-accent)}.full-design-summary{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px}.full-design-summary>div,.full-design-categories article{background:var(--surface-raised);border-radius:11px;padding:11px}.full-design-summary span,.full-design-routes>span,.full-design-categories article span{display:block;font-size:8px;letter-spacing:.12em;text-transform:uppercase;color:var(--ink-muted)}.full-design-summary strong,.full-design-categories article strong{display:block;margin-top:5px;font-size:10px;line-height:1.45}.full-design-routes{display:grid;gap:6px}.full-design-routes code{display:block;padding:8px 10px;border:1px solid var(--border);border-radius:9px;background:var(--page-2);font-size:9px;overflow-wrap:anywhere}.full-design-categories{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.full-design-categories article{border:1px solid transparent}.full-design-categories article.blocked{border-color:var(--border)}.full-design-categories article small{display:block;margin-top:8px;color:var(--ink-muted);font-size:9px;line-height:1.55}.full-design-boundary{margin:0;color:var(--ink-muted);font-size:10px;line-height:1.7}.full-design-destination{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;align-items:start;border-top:1px solid var(--border);padding-top:14px}.full-design-destination-copy{display:grid;gap:6px}.full-design-destination-copy>div{display:flex;gap:10px;align-items:baseline}.full-design-destination-copy span,.full-design-destination-result>span{font-size:8px;letter-spacing:.12em;text-transform:uppercase;color:var(--ink-muted)}.full-design-destination-copy strong{font-size:11px}.full-design-destination-copy p,.full-design-destination>small{margin:0;color:var(--ink-muted);font-size:9px;line-height:1.6}.full-design-destination-button{align-self:center}.full-design-destination-result,.full-design-destination-issues{grid-column:1/-1;display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding:10px;border-radius:10px;background:var(--page-2);font-size:9px}.full-design-destination-result code{overflow-wrap:anywhere}.full-design-destination-result strong{font-size:9px}.full-design-destination-issues{display:grid}.full-design-destination-issues span{display:flex;gap:8px;align-items:baseline;color:var(--ink-muted)}.full-design-destination-issues code{color:var(--decor-accent);overflow-wrap:anywhere}.full-design-destination>.full-design-error,.full-design-destination>small{grid-column:1/-1}.full-design-error{display:grid;gap:6px;padding:13px;border:1px solid var(--border);border-radius:12px;background:var(--page-2);font-size:10px}.full-design-error strong{color:var(--decor-accent)}.full-design-error code{overflow-wrap:anywhere}.capture-panel{margin-top:18px;border:1px solid var(--border);border-radius:20px;background:var(--surface);padding:22px;display:grid;grid-template-columns:minmax(0,.8fr) minmax(320px,1.2fr);gap:20px}.capture-form{display:grid;gap:10px}.capture-form label{display:grid;gap:6px}.capture-form label>span{font-size:9px;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-muted)}.capture-form input,.capture-form textarea,.capture-form select{width:100%;background:var(--surface-raised);color:var(--ink);border:1px solid var(--border);border-radius:10px;padding:10px 11px}.capture-form textarea{resize:vertical}.network-capture-options{display:flex;gap:12px;align-items:center;flex-wrap:wrap;padding:10px 12px;border:1px solid var(--border);border-radius:10px;background:var(--page-2)}.network-capture-options>label{display:flex;gap:6px;align-items:center;font-size:10px}.network-capture-options>label input{margin:0}.network-capture-options>small{flex-basis:100%;color:var(--ink-muted);font-size:8px;line-height:1.5}.network-capture-options code{color:var(--decor-accent)}.capture-actions{display:flex;gap:8px}.capture-actions button{padding:10px 13px}.capture-actions button.publish{background:var(--gold-strong);color:var(--gold-ink)}.capture-status{grid-column:1/-1;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}.capture-status>div{background:var(--surface-raised);border-radius:11px;padding:11px}.capture-status span{display:block;font-size:8px;letter-spacing:.12em;text-transform:uppercase;color:var(--ink-muted)}.capture-status strong{display:block;margin-top:5px;font-size:10px;line-height:1.45}.artifact-summary,.published-card{grid-column:1/-1;border:1px solid var(--border);border-radius:12px;padding:12px 14px;background:var(--page-2);display:flex;gap:14px;align-items:center;flex-wrap:wrap;font-size:10px;color:var(--ink-soft)}.artifact-summary strong{color:var(--ink)}.published-card{display:grid;gap:6px}.published-card>strong{font-family:Georgia,serif;font-size:18px;color:var(--ink)}.published-card code{font-size:9px;overflow-wrap:anywhere}.published-card a{color:var(--gold);font-weight:800}.empty-world{margin-top:18px;min-height:350px;border:1px dashed var(--border);border-radius:20px;display:grid;place-items:center;align-content:center;text-align:center;color:var(--ink-muted);background:var(--surface)}.empty-world>span{font-size:48px;color:var(--gold)}.empty-world strong{color:var(--ink);margin-top:8px}.empty-world p{max-width:520px;font-size:12px;line-height:1.8}.safety-note{margin-top:18px;padding:14px 17px;border:1px solid var(--border);border-radius:14px;background:var(--surface);display:grid;gap:5px;font-size:10px;color:var(--ink-muted);line-height:1.6}.safety-note strong{color:var(--decor-accent)}@media(max-width:900px){.world-heading,.load-panel,.full-design-heading,.floating-route-heading{align-items:flex-start;flex-direction:column}.save-source-heading{grid-template-columns:1fr}.workspace{grid-template-columns:1fr}.sidebar{grid-template-columns:repeat(3,minmax(0,1fr))}.full-design-gates{justify-content:flex-start}.full-design-summary{grid-template-columns:repeat(2,minmax(0,1fr))}.full-design-categories{grid-template-columns:repeat(2,minmax(0,1fr))}.capture-panel{grid-template-columns:1fr}.capture-status{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:620px){.floating-plan-preview{grid-template-columns:1fr}.floating-route-actions{align-items:flex-start;flex-direction:column}.full-design-destination{grid-template-columns:1fr}.full-design-destination-button{width:100%;text-align:center}.load-controls{width:100%;align-items:stretch;flex-direction:column}.platform-select select{width:100%}.root-grid-row{grid-template-columns:1fr}.root-grid-meta{flex-wrap:wrap}.save-contract{flex-direction:column}.world-page{padding-block:44px 70px}.sidebar{grid-template-columns:1fr}.editor-toolbar{align-items:flex-start;flex-direction:column}.toolbar-actions{justify-content:flex-start}.canvas-wrap{min-height:340px;height:52vh}.canvas-footer{flex-direction:column}.full-design-summary,.full-design-categories{grid-template-columns:1fr}.capture-status{grid-template-columns:1fr}.capture-actions{flex-direction:column}.file-button{width:100%;text-align:center}}
</style>
