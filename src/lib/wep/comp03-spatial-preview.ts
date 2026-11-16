import { worldToScreen, type Viewport } from './canvas-runtime.ts';

// Presentation-only input from a future accepted Core spatial projection.
// This is NOT a wire/ABI contract, placement validator, EditorDocument,
// selectable SpatialObject, footprint, or permission to Stage.
export type Comp03PreviewPoint = Readonly<{
  objectId: number;
  x: number;
  y: number;
  role: 'retained' | 'proposed';
}>;

const uint = (v: unknown): v is number =>
  typeof v === 'number' && Number.isSafeInteger(v) && v >= 0 && v <= 0xffffffff;
const positive = (v: unknown): v is number => uint(v) && v > 0;
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const denied = () => new Error('WEP_COMP03_SPATIAL_PRESENTATION_INVALID');

/** Map supplied anchors only. No pitch/shape, occupancy or world-target inference.
 * All markers remain outside the ordinary SpatialScene and its hit-test.
 * Invalid or incomplete view input yields no partial overlay.
 */
export function projectComp03PreviewMarkers(
  gridId: number,
  points: readonly Comp03PreviewPoint[],
  viewport: Viewport
) {
  const area = viewport?.areaBounds;
  if (!positive(gridId) || !Array.isArray(points) || points.length !== 9 ||
      !area || !uint(area.x) || !uint(area.y) || !positive(area.w) || !positive(area.h) ||
      area.x + area.w > 0x100000000 || area.y + area.h > 0x100000000 ||
      !finite(viewport.zoom) || viewport.zoom <= 0 ||
      !finite(viewport.offsetX) || !finite(viewport.offsetY) ||
      !finite(viewport.widthPx) || viewport.widthPx <= 0 ||
      !finite(viewport.heightPx) || viewport.heightPx <= 0) throw denied();

  const ids = new Set<number>();
  const positions = new Set<string>();
  let retained = 0;
  const markers = [];
  for (const point of points) {
    if (!point || typeof point !== 'object' || Array.isArray(point) ||
        Object.keys(point).sort().join(',') !== 'objectId,role,x,y' ||
        !positive(point.objectId) || !uint(point.x) || !uint(point.y) ||
        (point.role !== 'retained' && point.role !== 'proposed') ||
        point.x < area.x || point.y < area.y ||
        point.x >= area.x + area.w || point.y >= area.y + area.h ||
        ids.has(point.objectId) || positions.has(point.x + ':' + point.y)) throw denied();
    ids.add(point.objectId);
    positions.add(point.x + ':' + point.y);
    if (point.role === 'retained') retained++;
    const screen = worldToScreen(viewport, { x: point.x, y: point.y });
    if (!finite(screen.x) || !finite(screen.y)) throw denied();
    markers.push(Object.freeze({
      objectId: point.objectId, x: point.x, y: point.y, role: point.role,
      screenX: screen.x, screenY: screen.y,
      selectable: false as const, hitTestEligible: false as const
    }));
  }
  if (retained !== 1) throw denied();
  return Object.freeze({
    gridId, markers: Object.freeze(markers),
    persistentWriteAuthorized: false as const,
    placementValidated: false as const
  });
}
