import {
  sanitizePortableState,
  type EditorDocument,
  type EditorObject
} from './scene-capture-runtime.ts';

type AnyRecord = Record<string, any>;

export const FULL_DESIGN_ROOT_COMPOSITION_SCHEMA =
  'dreamwish-wand-full-design-root-object-composition';
export const FULL_DESIGN_ROOT_COMPOSITION_VERSION = 1;

function clone<T>(value: T): T {
  return structuredClone(value);
}

function plain(value: unknown): value is AnyRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function int(value: unknown, code: string): number {
  const number = Number(value);
  if (!Number.isSafeInteger(number)) throw new Error(code);
  return number;
}

function validateDocument(document: EditorDocument) {
  if (
    !plain(document) ||
    document.schema !== 'dreamwish-wand-wep-editor-document' ||
    Number(document.version) !== 1 ||
    !Array.isArray(document.objects)
  ) {
    throw new Error('WEP_FULL_DESIGN_ROOT_DOCUMENT_INVALID');
  }
  if (document.target?.gameVersion !== '1.25.0') {
    throw new Error('WEP_FULL_DESIGN_ROOT_DOCUMENT_VERSION_UNSUPPORTED');
  }
  if (document.target?.platform !== 'Nintendo Switch') {
    throw new Error('WEP_FULL_DESIGN_ROOT_DOCUMENT_PLATFORM_UNSUPPORTED');
  }
  if (document.target?.persistentWriteAuthorized !== false) {
    throw new Error('WEP_FULL_DESIGN_ROOT_DOCUMENT_WRITE_BOUNDARY_VIOLATION');
  }
  const gridDataPath = String(document.target?.gridDataPath ?? '');
  if (!gridDataPath) {
    throw new Error('WEP_FULL_DESIGN_ROOT_DOCUMENT_ROUTE_MISSING');
  }
  return gridDataPath;
}

function portableClassification(object: EditorObject) {
  const reasons: string[] = [];
  const geometryStatus = String(object.metadata?.geometryStatus ?? 'UNKNOWN');

  if (object.layer === 'building') {
    reasons.push('BUILDING_PLACEMENT_PORTABILITY_INCOMPLETE');
  } else if (!['furniture', 'landscaping'].includes(String(object.layer))) {
    reasons.push('ROOT_OBJECT_CLASS_NOT_PORTABLE');
  }

  if (geometryStatus !== 'RESOLVED') {
    reasons.push('ROOT_OBJECT_GEOMETRY_UNRESOLVED');
  }
  if (object.editability !== 'editable') {
    reasons.push('ROOT_OBJECT_EDITABILITY_NOT_PORTABLE');
  }

  return {
    portable: reasons.length === 0,
    reasons
  };
}

function portableEntry(
  gridDataPath: string,
  object: EditorObject,
  artifactObjectId: string
) {
  const orientation = int(
    object.orientation,
    'WEP_FULL_DESIGN_ROOT_ORIENTATION_INVALID'
  );
  if (orientation < 0 || orientation > 15) {
    throw new Error('WEP_FULL_DESIGN_ROOT_ORIENTATION_INVALID');
  }
  const footprint = Array.isArray(object.footprint)
    ? object.footprint.map((cell) => ({
        x: int(cell.x, 'WEP_FULL_DESIGN_ROOT_FOOTPRINT_INVALID'),
        y: int(cell.y, 'WEP_FULL_DESIGN_ROOT_FOOTPRINT_INVALID')
      }))
    : [];
  if (!footprint.length) {
    throw new Error('WEP_FULL_DESIGN_ROOT_FOOTPRINT_INVALID');
  }

  return {
    artifactObjectId,
    directRootRoute: {
      codec: 'ddv.direct-grid-route@1',
      gridDataPath
    },
    itemId: int(object.itemId, 'WEP_FULL_DESIGN_ROOT_ITEM_INVALID'),
    layer: object.layer,
    localX: int(object.x, 'WEP_FULL_DESIGN_ROOT_X_INVALID'),
    localY: int(object.y, 'WEP_FULL_DESIGN_ROOT_Y_INVALID'),
    orientation,
    footprint,
    portableState: sanitizePortableState(object.portableState ?? null)
  };
}

function unresolvedEntry(
  gridDataPath: string,
  object: EditorObject,
  reasons: string[]
) {
  return {
    directRootRoute: {
      codec: 'ddv.direct-grid-route@1',
      gridDataPath
    },
    itemId: int(object.itemId, 'WEP_FULL_DESIGN_ROOT_ITEM_INVALID'),
    layer: String(object.layer),
    localX: int(object.x, 'WEP_FULL_DESIGN_ROOT_X_INVALID'),
    localY: int(object.y, 'WEP_FULL_DESIGN_ROOT_Y_INVALID'),
    reasons: [...reasons]
  };
}

export function captureCurrentV125RootObjectComposition({
  documents,
  expectedGridDataPaths
}: {
  documents: EditorDocument[];
  expectedGridDataPaths: string[];
}) {
  if (!Array.isArray(documents) || !documents.length) {
    throw new Error('WEP_FULL_DESIGN_ROOT_DOCUMENTS_REQUIRED');
  }
  if (
    !Array.isArray(expectedGridDataPaths) ||
    !expectedGridDataPaths.length ||
    expectedGridDataPaths.some(
      (path) => typeof path !== 'string' || path.length === 0
    )
  ) {
    throw new Error('WEP_FULL_DESIGN_ROOT_EXPECTED_ROUTES_INVALID');
  }

  const expected = new Set(expectedGridDataPaths);
  if (expected.size !== expectedGridDataPaths.length) {
    throw new Error('WEP_FULL_DESIGN_ROOT_EXPECTED_ROUTES_DUPLICATE');
  }

  const byPath = new Map<string, EditorDocument>();
  for (const document of documents) {
    const path = validateDocument(document);
    if (!expected.has(path)) {
      throw new Error('WEP_FULL_DESIGN_ROOT_DOCUMENT_OUTSIDE_LOCATION');
    }
    if (byPath.has(path)) {
      throw new Error('WEP_FULL_DESIGN_ROOT_DOCUMENT_ROUTE_DUPLICATE');
    }
    byPath.set(path, document);
  }

  const missingRoutes = expectedGridDataPaths.filter(
    (path) => !byPath.has(path)
  );
  const entries: AnyRecord[] = [];
  const unresolved: AnyRecord[] = [];
  const routeSummaries: AnyRecord[] = [];

  for (const gridDataPath of expectedGridDataPaths) {
    const document = byPath.get(gridDataPath);
    if (!document) {
      routeSummaries.push({
        directRootRoute: {
          codec: 'ddv.direct-grid-route@1',
          gridDataPath
        },
        documentBound: false,
        objectCount: null,
        portableCount: 0,
        unresolvedCount: 0,
        delegatedNetworkCount: 0
      });
      continue;
    }

    let portableCount = 0;
    let unresolvedCount = 0;
    let delegatedNetworkCount = 0;

    for (const object of document.objects) {
      if (object.layer === 'road' || object.layer === 'fence') {
        delegatedNetworkCount += 1;
        continue;
      }

      const classification = portableClassification(object);
      if (!classification.portable) {
        unresolved.push(
          unresolvedEntry(gridDataPath, object, classification.reasons)
        );
        unresolvedCount += 1;
        continue;
      }

      const entry = portableEntry(
        gridDataPath,
        object,
        `o${entries.length}`
      );
      entries.push(entry);
      portableCount += 1;
    }

    routeSummaries.push({
      directRootRoute: {
        codec: 'ddv.direct-grid-route@1',
        gridDataPath
      },
      documentBound: true,
      objectCount: document.objects.length,
      portableCount,
      unresolvedCount,
      delegatedNetworkCount
    });
  }

  return {
    schema: FULL_DESIGN_ROOT_COMPOSITION_SCHEMA,
    version: FULL_DESIGN_ROOT_COMPOSITION_VERSION,
    evidenceStatus: 'CONFIRMED_01B_V1_6_EDITOR_DOCUMENT',
    status:
      missingRoutes.length === 0 && unresolved.length === 0
        ? 'CAPTURED_COMPLETE_FOR_BOUND_DOCUMENTS'
        : 'CAPTURED_PARTIAL',
    routeSummaries,
    entries: clone(entries),
    unresolved: clone(unresolved),
    missingRoutes: [...missingRoutes],
    delegatedNetworkObjectCount: routeSummaries.reduce(
      (sum, entry) => sum + Number(entry.delegatedNetworkCount ?? 0),
      0
    ),
    normalization: {
      sourceGridIdsRemoved: true,
      sourceGridObjectIdsRemoved: true,
      artifactLocalObjectIds: true
    },
    persistentWriteAuthorized: false
  };
}
