type AnyRecord = Record<string, any>;

export const GRIDDATA_DIMENSIONS_V125_SHA256 =
  '75f33dc20d521d579070aa7919a96c23ce5dd329dbc6f58392f267c9dd0b1aaa';
export const GRIDDATA_DIMENSIONS_V125_RECORD_COUNT = 152;
export const GRIDDATA_DIMENSIONS_V125_STATIC_PATH =
  '/ddv/core/world/v1.25/griddata-dimensions-v125.json';

function plain(value: unknown): value is AnyRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function safeInteger(value: unknown) {
  const number = Number(value);
  return Number.isSafeInteger(number) ? number : null;
}

export function authoritativeRootBoundsFromEditorDocument(
  document: AnyRecord
) {
  const browser = document?.metadata?.browserBinding;
  const bounds = document?.metadata?.rootGridBounds;
  if (
    !plain(browser) ||
    browser.gridDataDimensionsBound !== true ||
    browser.gridDataDimensionsSha256 !==
      GRIDDATA_DIMENSIONS_V125_SHA256 ||
    !plain(bounds) ||
    bounds.status !== 'AUTHORITATIVE_GRIDDATAPATH'
  ) {
    return null;
  }

  const x = safeInteger(bounds.x);
  const y = safeInteger(bounds.y);
  const w = safeInteger(bounds.w);
  const h = safeInteger(bounds.h);
  const tessellationFactor = safeInteger(
    document?.target?.tessellationFactor
  );
  const gridDataPath = String(
    document?.target?.gridDataPath ?? ''
  );

  if (
    x === null ||
    y === null ||
    w === null ||
    h === null ||
    w <= 0 ||
    h <= 0 ||
    tessellationFactor === null ||
    tessellationFactor <= 0 ||
    !gridDataPath
  ) {
    return null;
  }

  return Object.freeze({
    gridDataPath,
    bounds: Object.freeze({
      x,
      y,
      w,
      h,
      status: 'AUTHORITATIVE_GRIDDATAPATH'
    }),
    tessellationFactor,
    evidenceStatus: 'CONFIRMED_01B_V1_7_GRIDDATAPATH_DIMENSIONS',
    gridDataDimensionsSha256:
      GRIDDATA_DIMENSIONS_V125_SHA256
  });
}

export function captureAuthoritativeDirectRootBounds({
  documents,
  expectedGridDataPaths
}: {
  documents: AnyRecord[];
  expectedGridDataPaths: string[];
}) {
  const expected = new Set(expectedGridDataPaths);
  const byPath = new Map<string, ReturnType<
    typeof authoritativeRootBoundsFromEditorDocument
  >>();

  for (const document of documents ?? []) {
    const resolved =
      authoritativeRootBoundsFromEditorDocument(document);
    if (!resolved || !expected.has(resolved.gridDataPath)) continue;
    if (byPath.has(resolved.gridDataPath)) {
      throw new Error(
        'WEP_GRIDDATA_V17_DIRECT_ROOT_DOCUMENT_DUPLICATE'
      );
    }
    byPath.set(resolved.gridDataPath, resolved);
  }

  const entries = expectedGridDataPaths.flatMap((gridDataPath) => {
    const value = byPath.get(gridDataPath);
    return value
      ? [{
          directRootRoute: {
            codec: 'ddv.direct-grid-route@1',
            gridDataPath
          },
          bounds: { ...value.bounds },
          tessellationFactor: value.tessellationFactor,
          evidenceStatus: value.evidenceStatus,
          gridDataDimensionsSha256:
            value.gridDataDimensionsSha256
        }]
      : [];
  });
  const missingRoutes = expectedGridDataPaths.filter(
    (gridDataPath) => !byPath.has(gridDataPath)
  );

  return Object.freeze({
    status:
      missingRoutes.length === 0
        ? 'AUTHORITATIVE_COMPLETE'
        : 'AUTHORITATIVE_PARTIAL',
    entries,
    missingRoutes,
    persistentWriteAuthorized: false
  });
}

export function regionWithinAuthoritativeBounds(
  region: { x: number; y: number; w: number; h: number },
  bounds: { x: number; y: number; w: number; h: number }
) {
  return (
    Number.isSafeInteger(region.x) &&
    Number.isSafeInteger(region.y) &&
    Number.isSafeInteger(region.w) &&
    Number.isSafeInteger(region.h) &&
    region.w > 0 &&
    region.h > 0 &&
    region.x >= bounds.x &&
    region.y >= bounds.y &&
    region.x + region.w <= bounds.x + bounds.w &&
    region.y + region.h <= bounds.y + bounds.h
  );
}

export function footprintWithinAuthoritativeBounds(
  placement: {
    x: number;
    y: number;
    footprint: Array<{ x: number; y: number }>;
  },
  bounds: { x: number; y: number; w: number; h: number }
) {
  if (!Array.isArray(placement.footprint) || !placement.footprint.length) {
    return false;
  }
  return placement.footprint.every((cell) => {
    const x = placement.x + Number(cell.x);
    const y = placement.y + Number(cell.y);
    return (
      Number.isSafeInteger(x) &&
      Number.isSafeInteger(y) &&
      x >= bounds.x &&
      y >= bounds.y &&
      x < bounds.x + bounds.w &&
      y < bounds.y + bounds.h
    );
  });
}
