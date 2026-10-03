import type {
  EditorDocument,
  EditorObject,
  Rect,
  WepLayer
} from './editor-runtime.ts';
import {
  WEP_LAYERS,
  boundsFor,
  normalizeEditorDocument,
  occupiedCells
} from './editor-runtime.ts';

export const DEFAULT_LAYER_ORDER = Object.freeze([
  'road',
  'fence',
  'static',
  'landscaping',
  'building',
  'furniture'
] as const);

export interface LayerEntry {
  visible: boolean;
  locked: boolean;
}

export type LayerState = Record<WepLayer, LayerEntry>;

export interface Viewport {
  zoom: number;
  offsetX: number;
  offsetY: number;
  widthPx: number;
  heightPx: number;
  areaBounds: Rect;
}

type AnyRecord = Record<string, any>;

function clone<T>(value: T): T {
  return structuredClone(value);
}

function assert(condition: unknown, code: string): asserts condition {
  if (!condition) throw new Error(code);
}

function finite(value: unknown, code: string): number {
  const number = Number(value);
  assert(Number.isFinite(number), code);
  return number;
}

export function normalizeAreaBounds(bounds: Rect): Rect {
  assert(
    bounds !== null &&
      typeof bounds === 'object' &&
      !Array.isArray(bounds),
    'WEP_CANVAS_AREA_INVALID'
  );

  const x = finite(bounds.x, 'WEP_CANVAS_AREA_X_INVALID');
  const y = finite(bounds.y, 'WEP_CANVAS_AREA_Y_INVALID');
  const w = finite(bounds.w, 'WEP_CANVAS_AREA_W_INVALID');
  const h = finite(bounds.h, 'WEP_CANVAS_AREA_H_INVALID');
  assert(w > 0 && h > 0, 'WEP_CANVAS_AREA_SIZE_INVALID');
  return { x, y, w, h };
}

export function createLayerState({
  capabilities = {},
  overrides = {}
}: {
  capabilities?: Record<string, any>;
  overrides?: Partial<Record<WepLayer, Partial<LayerEntry>>>;
} = {}): LayerState {
  const output = {} as LayerState;

  for (const layer of WEP_LAYERS) {
    let locked = layer === 'static';
    if (
      layer === 'road' &&
      capabilities.roadTopologyEdit !== 'supported'
    ) {
      locked = true;
    }
    if (
      layer === 'fence' &&
      capabilities.fenceTopologyEdit !== 'supported'
    ) {
      locked = true;
    }

    output[layer] = {
      visible: true,
      locked
    };

    if (overrides[layer]) {
      output[layer] = {
        ...output[layer],
        ...clone(overrides[layer])
      };
    }
  }

  return output;
}

export function fitViewport(
  areaBounds: Rect,
  widthPx: number,
  heightPx: number,
  {
    paddingPx = 24,
    minZoom = 2,
    maxZoom = 128
  }: {
    paddingPx?: number;
    minZoom?: number;
    maxZoom?: number;
  } = {}
): Viewport {
  const area = normalizeAreaBounds(areaBounds);
  const width = finite(widthPx, 'WEP_CANVAS_WIDTH_INVALID');
  const height = finite(heightPx, 'WEP_CANVAS_HEIGHT_INVALID');
  const padding = Math.max(
    0,
    finite(paddingPx, 'WEP_CANVAS_PADDING_INVALID')
  );
  assert(width > 0 && height > 0, 'WEP_CANVAS_SIZE_INVALID');

  const zoomX = (width - padding * 2) / area.w;
  const zoomY = (height - padding * 2) / area.h;
  const zoom = Math.max(
    minZoom,
    Math.min(maxZoom, Math.min(zoomX, zoomY))
  );

  const contentWidth = area.w * zoom;
  const contentHeight = area.h * zoom;

  return {
    zoom,
    offsetX: (width - contentWidth) / 2 - area.x * zoom,
    offsetY: (height - contentHeight) / 2 - area.y * zoom,
    widthPx: width,
    heightPx: height,
    areaBounds: area
  };
}

export function normalizeViewport(viewport: Viewport): Viewport {
  assert(
    viewport !== null &&
      typeof viewport === 'object' &&
      !Array.isArray(viewport),
    'WEP_VIEWPORT_INVALID'
  );

  return {
    zoom: finite(viewport.zoom, 'WEP_ZOOM_INVALID'),
    offsetX: finite(viewport.offsetX, 'WEP_OFFSET_X_INVALID'),
    offsetY: finite(viewport.offsetY, 'WEP_OFFSET_Y_INVALID'),
    widthPx: finite(viewport.widthPx, 'WEP_CANVAS_WIDTH_INVALID'),
    heightPx: finite(viewport.heightPx, 'WEP_CANVAS_HEIGHT_INVALID'),
    areaBounds: normalizeAreaBounds(viewport.areaBounds)
  };
}

export function worldToScreen(
  viewport: Viewport,
  point: { x: number; y: number }
) {
  const normalized = normalizeViewport(viewport);
  return {
    x: point.x * normalized.zoom + normalized.offsetX,
    y: point.y * normalized.zoom + normalized.offsetY
  };
}

export function screenToWorld(
  viewport: Viewport,
  point: { x: number; y: number }
) {
  const normalized = normalizeViewport(viewport);
  return {
    x: (point.x - normalized.offsetX) / normalized.zoom,
    y: (point.y - normalized.offsetY) / normalized.zoom
  };
}

export function panViewport(
  viewport: Viewport,
  dxPx: number,
  dyPx: number
): Viewport {
  const normalized = normalizeViewport(viewport);
  normalized.offsetX += finite(dxPx, 'WEP_PAN_X_INVALID');
  normalized.offsetY += finite(dyPx, 'WEP_PAN_Y_INVALID');
  return normalized;
}

export function zoomViewportAt(
  viewport: Viewport,
  nextZoom: number,
  screenPoint: { x: number; y: number },
  {
    minZoom = 2,
    maxZoom = 128
  }: {
    minZoom?: number;
    maxZoom?: number;
  } = {}
): Viewport {
  const normalized = normalizeViewport(viewport);
  const zoom = Math.max(
    minZoom,
    Math.min(
      maxZoom,
      finite(nextZoom, 'WEP_ZOOM_INVALID')
    )
  );
  const point = {
    x: finite(
      screenPoint.x,
      'WEP_ZOOM_POINT_X_INVALID'
    ),
    y: finite(
      screenPoint.y,
      'WEP_ZOOM_POINT_Y_INVALID'
    )
  };
  const world = screenToWorld(normalized, point);

  normalized.zoom = zoom;
  normalized.offsetX = point.x - world.x * zoom;
  normalized.offsetY = point.y - world.y * zoom;
  return normalized;
}

export function searchText(object: EditorObject): string {
  const metadata = object.metadata ?? {};
  const parts = [
    object.editorId,
    String(object.itemId),
    object.layer,
    metadata.displayName,
    metadata.internalName,
    metadata.category,
    metadata.universe,
    metadata.style,
    metadata.color,
    ...(Array.isArray(metadata.tags) ? metadata.tags : [])
  ];

  return parts
    .filter((value) => value !== undefined && value !== null)
    .join(' ')
    .toLocaleLowerCase();
}

export function matchesQuery(
  object: EditorObject,
  query: string
): boolean {
  const normalized = String(query ?? '')
    .trim()
    .toLocaleLowerCase();

  if (!normalized) return true;

  const tokens = normalized.split(/\s+/).filter(Boolean);
  const haystack = searchText(object);
  return tokens.every((token) => haystack.includes(token));
}

export function objectWorldBounds(
  object: EditorObject
): Rect {
  const cells = occupiedCells(object);
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const cell of cells) {
    minX = Math.min(minX, cell.x);
    minY = Math.min(minY, cell.y);
    maxX = Math.max(maxX, cell.x);
    maxY = Math.max(maxY, cell.y);
  }

  return {
    x: minX,
    y: minY,
    w: maxX - minX + 1,
    h: maxY - minY + 1
  };
}

export function objectScreenBounds(
  object: EditorObject,
  viewport: Viewport
): Rect {
  const bounds = objectWorldBounds(object);
  const point = worldToScreen(viewport, {
    x: bounds.x,
    y: bounds.y
  });
  const normalized = normalizeViewport(viewport);

  return {
    x: point.x,
    y: point.y,
    w: bounds.w * normalized.zoom,
    h: bounds.h * normalized.zoom
  };
}

export function projectObjects(
  documentInput: EditorDocument,
  {
    layerState = null,
    query = '',
    layerOrder = DEFAULT_LAYER_ORDER
  }: {
    layerState?: LayerState | null;
    query?: string;
    layerOrder?: readonly string[];
  } = {}
) {
  const document = normalizeEditorDocument(documentInput);
  const state =
    layerState ??
    createLayerState({
      capabilities: document.capabilities
    });
  const order = new Map(
    [...layerOrder].map((layer, index) => [layer, index])
  );

  return document.objects
    .filter(
      (object) =>
        state[object.layer]?.visible !== false &&
        matchesQuery(object, query)
    )
    .map((object) => ({
      ...clone(object),
      ui: {
        locked: Boolean(state[object.layer]?.locked),
        searchMatched: true,
        zIndex: order.get(object.layer) ?? 0
      }
    }))
    .sort(
      (left, right) =>
        left.ui.zIndex - right.ui.zIndex ||
        left.y - right.y ||
        left.x - right.x ||
        left.editorId.localeCompare(right.editorId)
    );
}

export function reconcileSelectionToProjection(
  selectedIds: string[],
  projectedObjects: Array<{ editorId: string }>
): string[] {
  const visibleIds = new Set(
    (projectedObjects ?? []).map((object) => String(object.editorId))
  );
  return [...new Set((selectedIds ?? []).map(String))].filter((id) =>
    visibleIds.has(id)
  );
}

export function inspectSelection(
  documentInput: EditorDocument,
  selectedIds: string[]
) {
  const document = normalizeEditorDocument(documentInput);
  const ids = new Set((selectedIds ?? []).map(String));
  const objects = document.objects.filter((object) =>
    ids.has(object.editorId)
  );
  const layerCounts = Object.fromEntries(
    WEP_LAYERS.map((layer) => [
      layer,
      objects.filter((object) => object.layer === layer).length
    ])
  ) as Record<WepLayer, number>;

  return {
    count: objects.length,
    bounds: objects.length ? boundsFor(objects) : null,
    layerCounts,
    objects: objects.map((object) => ({
      editorId: object.editorId,
      itemId: object.itemId,
      displayName:
        String(
          object.metadata?.displayName ??
            object.metadata?.internalName ??
            ''
        ) || null,
      layer: object.layer,
      x: object.x,
      y: object.y,
      orientation: object.orientation,
      editability: object.editability,
      dependencyCount: object.dependencyIds.length,
      dependencyIds: clone(object.dependencyIds),
      footprintCellCount: object.footprint.length
    }))
  };
}

export function worldRectFromScreenDrag(
  viewport: Viewport,
  from: { x: number; y: number },
  to: { x: number; y: number }
): Rect {
  const first = screenToWorld(viewport, from);
  const second = screenToWorld(viewport, to);
  const minX = Math.floor(Math.min(first.x, second.x));
  const minY = Math.floor(Math.min(first.y, second.y));
  const maxX = Math.floor(Math.max(first.x, second.x));
  const maxY = Math.floor(Math.max(first.y, second.y));

  return {
    x: minX,
    y: minY,
    w: maxX - minX + 1,
    h: maxY - minY + 1
  };
}

export function hitTest(
  documentInput: EditorDocument,
  worldPoint: { x: number; y: number },
  {
    layerState = null,
    query = '',
    includeLocked = false,
    layerOrder = DEFAULT_LAYER_ORDER
  }: {
    layerState?: LayerState | null;
    query?: string;
    includeLocked?: boolean;
    layerOrder?: readonly string[];
  } = {}
) {
  const x = Math.floor(
    finite(worldPoint.x, 'WEP_HIT_X_INVALID')
  );
  const y = Math.floor(
    finite(worldPoint.y, 'WEP_HIT_Y_INVALID')
  );
  const projected = projectObjects(documentInput, {
    layerState,
    query,
    layerOrder
  });

  for (let index = projected.length - 1; index >= 0; index -= 1) {
    const object = projected[index];
    if (!includeLocked && object.ui.locked) continue;
    if (
      occupiedCells(object).some(
        (cell) => cell.x === x && cell.y === y
      )
    ) {
      return clone(object);
    }
  }

  return null;
}

export function createCanvasController(
  session: {
    getDocument(): EditorDocument;
    getSelection(): string[];
    setSelection(ids: string[]): string[];
    toggleSelection(id: string): string[];
    clearSelection(): void;
  },
  {
    areaBounds,
    viewport = null,
    widthPx = 900,
    heightPx = 600,
    layerState = null,
    layerOrder = DEFAULT_LAYER_ORDER
  }: {
    areaBounds: Rect;
    viewport?: Viewport | null;
    widthPx?: number;
    heightPx?: number;
    layerState?: LayerState | null;
    layerOrder?: readonly string[];
  }
) {
  assert(
    session && typeof session.getDocument === 'function',
    'WEP_SESSION_REQUIRED'
  );

  let layers =
    layerState
      ? clone(layerState)
      : createLayerState({
          capabilities: session.getDocument().capabilities
        });
  let query = '';
  let currentViewport = viewport
    ? normalizeViewport(viewport)
    : fitViewport(areaBounds, widthPx, heightPx);
  const order = [...layerOrder];

  const projection = () =>
    projectObjects(session.getDocument(), {
      layerState: layers,
      query,
      layerOrder: order
    });

  return Object.freeze({
    getViewport: () => clone(currentViewport),
    getLayerState: () => clone(layers),
    getQuery: () => query,
    getProjection: () => projection(),

    setQuery(value: string) {
      query = String(value ?? '');
      return projection();
    },

    setLayer(
      layer: WepLayer,
      patch: Partial<LayerEntry>
    ) {
      assert(WEP_LAYERS.includes(layer), 'WEP_LAYER_INVALID');
      layers[layer] = {
        ...layers[layer],
        ...clone(patch ?? {})
      };
      return clone(layers[layer]);
    },

    fit() {
      currentViewport = fitViewport(
        areaBounds,
        widthPx,
        heightPx
      );
      return clone(currentViewport);
    },

    pan(dx: number, dy: number) {
      currentViewport = panViewport(
        currentViewport,
        dx,
        dy
      );
      return clone(currentViewport);
    },

    zoomAt(
      nextZoom: number,
      screenPoint: { x: number; y: number }
    ) {
      currentViewport = zoomViewportAt(
        currentViewport,
        nextZoom,
        screenPoint
      );
      return clone(currentViewport);
    },

    hitScreen(
      screenPoint: { x: number; y: number },
      { includeLocked = false } = {}
    ) {
      return hitTest(
        session.getDocument(),
        screenToWorld(currentViewport, screenPoint),
        {
          layerState: layers,
          query,
          includeLocked,
          layerOrder: order
        }
      );
    },

    selectAtScreen(
      screenPoint: { x: number; y: number },
      { toggle = false } = {}
    ) {
      const object = this.hitScreen(screenPoint);
      if (!object) {
        if (!toggle) session.clearSelection();
        return session.getSelection();
      }

      if (toggle) session.toggleSelection(object.editorId);
      else session.setSelection([object.editorId]);
      return session.getSelection();
    },

    marqueeScreen(
      from: { x: number; y: number },
      to: { x: number; y: number },
      { add = false } = {}
    ) {
      const rect = worldRectFromScreenDrag(
        currentViewport,
        from,
        to
      );
      const allowed = WEP_LAYERS.filter(
        (layer) =>
          layers[layer]?.visible !== false &&
          !layers[layer]?.locked
      );
      const ids = session
        .getDocument()
        .objects.filter(
          (object) =>
            allowed.includes(object.layer) &&
            matchesQuery(object, query) &&
            occupiedCells(object).some(
              (cell) =>
                cell.x >= rect.x &&
                cell.y >= rect.y &&
                cell.x < rect.x + rect.w &&
                cell.y < rect.y + rect.h
            )
        )
        .map((object) => object.editorId);

      if (add) {
        session.setSelection([
          ...session.getSelection(),
          ...ids
        ]);
      } else {
        session.setSelection(ids);
      }

      return {
        rect,
        selection: session.getSelection()
      };
    },

    selectedBounds() {
      const selected = new Set(session.getSelection());
      const objects = session
        .getDocument()
        .objects.filter((object) =>
          selected.has(object.editorId)
        );
      return objects.length ? boundsFor(objects) : null;
    }
  });
}
