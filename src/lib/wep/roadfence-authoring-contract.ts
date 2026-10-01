import {
  FenceMode,
  buildFencePolyline,
  buildFenceRectangleOutline,
  eraseFenceLogicalUnits,
  previewFenceStyleReplacement,
  previewRoadStyleReplacement,
  rasterizeRoadPolyline,
  sampleFenceStyle,
  sampleRoadStyle,
  selectFenceBranch,
  selectFenceConnected,
  selectRoadConnected,
  transformFenceLogicalGraph,
  transformRoadCells
} from '../ddv/core/roadfence/logical.js';

type AnyRecord = Record<string, any>;

export const ROADFENCE_AUTHORING_CONTRACT =
  'dreamwish-wand-wep-roadfence-authoring@1';

export const ROADFENCE_AUTHORING_CAPABILITIES = Object.freeze({
  linePolyline: Object.freeze({
    road: 'CORE_MODEL_PREVIEW',
    fence: 'CORE_MODEL_PREVIEW',
    operationLayer: 'logicalTopology',
    persistentWriteAuthorized: false
  }),
  rectangleOutline: Object.freeze({
    road: 'WEP_COMPOSITION_OVER_CORE_RASTERIZER',
    fence: 'CORE_MODEL_PREVIEW',
    operationLayer: 'logicalTopology',
    persistentWriteAuthorized: false
  }),
  connectedSelection: Object.freeze({
    road: 'CORE_READ_MODEL',
    fence: 'CORE_READ_MODEL',
    operationLayer: 'selection',
    persistentWriteAuthorized: false
  }),
  styleReplacement: Object.freeze({
    road: 'CORE_PREVIEW',
    fence: 'CORE_PREVIEW',
    operationLayer: 'logicalTopology',
    persistentWriteAuthorized: false
  }),
  fenceRepresentationPosts: Object.freeze({
    fence: 'CORE_PROMOTED_REPRESENTATION_LAYOUT',
    operations: ['MOVE_POST', 'INSERT_POST', 'REMOVE_POST'],
    operationLayer: 'representationLayout',
    persistentWriteAuthorized: false
  }),
  topologySegmentDeleteSplit: Object.freeze({
    fence: 'CORE_MODEL_PREVIEW',
    operationLayer: 'logicalTopology',
    persistentWriteAuthorized: false
  }),
  eyedropper: Object.freeze({
    road: 'CORE_READ_MODEL',
    fence: 'CORE_READ_MODEL',
    operationLayer: 'selection',
    persistentWriteAuthorized: false
  }),
  explicitSpacing: Object.freeze({
    fence: 'WEP_EXPLICIT_TRANSFORM_OVER_CORE_CONSTRAINTS',
    operationLayer: 'representationLayout',
    silentNormalizationAllowed: false,
    persistentWriteAuthorized: false
  }),
  multiSelectTransforms: Object.freeze({
    road: 'CORE_MODEL_PREVIEW',
    fence: 'CORE_MODEL_PREVIEW',
    operationLayer: 'logicalTopology',
    persistentWriteAuthorized: false
  }),
  undoRedo: Object.freeze({
    scope: 'WEP_DRAFT_SESSION',
    persistentWriteAuthorized: false
  })
});

function clone<T>(value:T):T {
  return structuredClone(value);
}

function assertReadModel(result:AnyRecord) {
  if (!result || result.persistentWriteAuthorized !== false) {
    throw new Error('WEP_ROADFENCE_AUTHORING_WRITE_BOUNDARY_VIOLATION');
  }
  return clone(result);
}

export function previewRoadPolyline(controlPoints:AnyRecord[]) {
  return assertReadModel(rasterizeRoadPolyline(clone(controlPoints)));
}

export function previewFencePolyline(
  controlPoints:AnyRecord[],
  mode:string
) {
  return assertReadModel(
    buildFencePolyline(clone(controlPoints), mode)
  );
}

export function previewRoadRectangleOutline({
  minX,
  minY,
  maxX,
  maxY
}:{
  minX:number; minY:number; maxX:number; maxY:number;
}) {
  if (
    ![minX,minY,maxX,maxY].every(Number.isSafeInteger) ||
    maxX <= minX ||
    maxY <= minY
  ) {
    throw new Error('WEP_ROAD_RECTANGLE_OUTLINE_BOUNDS_INVALID');
  }
  return previewRoadPolyline([
    {x:minX,y:minY},
    {x:maxX,y:minY},
    {x:maxX,y:maxY},
    {x:minX,y:maxY},
    {x:minX,y:minY}
  ]);
}

export function previewFenceRectangleOutline(bounds:AnyRecord) {
  return assertReadModel(
    buildFenceRectangleOutline(clone(bounds))
  );
}

export function previewConnectedSelection({
  kind,
  source,
  seed
}:{
  kind:'road'|'fence';
  source:AnyRecord;
  seed:AnyRecord|string;
}) {
  return kind === 'road'
    ? assertReadModel(selectRoadConnected(clone(source.cells ?? []), clone(seed as AnyRecord)))
    : assertReadModel(selectFenceConnected(clone(source.graph ?? {}), String(seed)));
}

export function previewFenceBranchSelection({
  graph,
  seedNodeId,
  adjacentNodeId
}:{
  graph:AnyRecord;
  seedNodeId:string;
  adjacentNodeId:string;
}) {
  return assertReadModel(
    selectFenceBranch(
      clone(graph),
      String(seedNodeId),
      String(adjacentNodeId)
    )
  );
}

export function previewRoadStyleReplace(input:AnyRecord) {
  return assertReadModel(previewRoadStyleReplacement(clone(input)));
}

export function previewFenceStyleReplace(input:AnyRecord) {
  return assertReadModel(previewFenceStyleReplacement(clone(input)));
}

export function previewFenceSegmentDelete({
  graph,
  nodeIds
}:{
  graph:AnyRecord;
  nodeIds:string[];
}) {
  const result=eraseFenceLogicalUnits(
    clone(graph),
    [...nodeIds]
  );
  return assertReadModel({
    ...result,
    operationLayer:'logicalTopology',
    topologyChanged:result.ok === true,
    representationLayoutInvalidated:result.ok === true,
    persistentWriteAuthorized:false
  });
}

export function previewRoadTransform(
  cells:AnyRecord[],
  transform:AnyRecord
) {
  return assertReadModel(
    transformRoadCells(clone(cells), clone(transform))
  );
}

export function previewFenceTransform(
  graph:AnyRecord,
  transform:AnyRecord
) {
  return assertReadModel(
    transformFenceLogicalGraph(clone(graph), clone(transform))
  );
}

export function sampleRoadEyedropper(
  network:AnyRecord,
  coordinate:AnyRecord
) {
  return clone(sampleRoadStyle(clone(network), clone(coordinate)));
}

export function sampleFenceEyedropper(
  network:AnyRecord,
  nodeId:string
) {
  return clone(sampleFenceStyle(clone(network), String(nodeId)));
}

export const ROADFENCE_AUTHORING_DEFAULTS = Object.freeze({
  fenceMode: FenceMode.ORTHOGONAL,
  persistentWriteAuthorized: false,
  applyReady: false
});
