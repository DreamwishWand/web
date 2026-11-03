import type { EditorObject, Rect } from './editor-runtime.ts';

export type MarqueeMode = 'replace' | 'add' | 'toggle' | 'subtract';

export interface MarqueePoint { x: number; y: number; }
export type MarqueeProjected = EditorObject & { ui?: { locked?: boolean; [key: string]: unknown } };

export function marqueeRect(a: MarqueePoint, b: MarqueePoint): Rect {
  if (![a.x, a.y, b.x, b.y].every(Number.isFinite)) {
    throw new Error('WEP_MARQUEE_NONFINITE_COORDINATE');
  }
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    w: Math.abs(b.x - a.x),
    h: Math.abs(b.y - a.y)
  };
}

export function marqueeObjectEligible(object: MarqueeProjected): boolean {
  return object.editability === 'editable' &&
    object.ui?.locked !== true &&
    object.layer !== 'static' &&
    object.layer !== 'road' &&
    object.layer !== 'fence' &&
    !((Array.isArray(object.metadata?.reasons)) && object.metadata.reasons.length);
}

/** Already projected and filtered by Area/Grid, search, visibility and selectedOnly. */
export function marqueeHitIds(projected: MarqueeProjected[], rect: Rect): string[] {
  if (!(rect.w > 0 && rect.h > 0)) return [];
  const ids: string[] = [];
  for (const object of projected) {
    if (!marqueeObjectEligible(object)) continue;
    if (object.footprint.some(cell => {
      const x = object.x + cell.x;
      const y = object.y + cell.y;
      return x < rect.x + rect.w && x + 1 > rect.x &&
        y < rect.y + rect.h && y + 1 > rect.y;
    })) ids.push(object.editorId);
  }
  return ids;
}

/** Only a selection transition. Never creates or executes a Draft command. */
export function mergeMarqueeSelection(
  previous: string[],
  hits: string[],
  mode: MarqueeMode
): string[] {
  const selected = new Set(mode === 'replace' ? [] : previous);
  if (mode === 'replace' || mode === 'add') hits.forEach(id => selected.add(id));
  else if (mode === 'subtract') hits.forEach(id => selected.delete(id));
  else hits.forEach(id => selected.has(id) ? selected.delete(id) : selected.add(id));
  return [...selected];
}

export function marqueeModifierMode(input: {
  shiftKey?: boolean; ctrlKey?: boolean; metaKey?: boolean; altKey?: boolean;
}): MarqueeMode {
  if (input.altKey) return 'subtract';
  if (input.ctrlKey || input.metaKey) return 'toggle';
  if (input.shiftKey) return 'add';
  return 'replace';
}
