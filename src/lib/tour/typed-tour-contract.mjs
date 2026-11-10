// First-party 06 PRODUCT typed tour Pilot. One page; manual launch ONLY.
// This has NO storage, provider, analytics, native or mutation interface.
export const TYPED_TOUR_SCHEMA = 'wand.typed-tour@1';
export const PRESETS_MY_WAND_TOUR = Object.freeze({
  schema: TYPED_TOUR_SCHEMA,
  tourId: 'presets.my-wand-local-scenes',
  version: 1,
  pageId: 'presets',
  requiredView: 'my/wand',
  firstVisitAuto: false,
  autoLaunchAllowlist: Object.freeze([]),
  completionPersistence: 'none',
  steps: Object.freeze([
    Object.freeze({id:'wand',target:'button[data-my-domain="wand"]'}),
    Object.freeze({id:'views',target:'nav[data-my-wand-views]'}),
    Object.freeze({id:'scenes',target:'section[data-my-local-scenes]'}),
    Object.freeze({id:'reopen',target:'button[data-device-scenes-reopen]'})
  ])
});
export function isPresetPilotPath(pathname) {
  const raw=String(pathname||'/').split(/[?#]/,1)[0].replace(/\/+$/,'')||'/';
  return raw==='/presets'||raw==='/web/presets';
}
// A target is an exact, visible, interactive DOM *anchor*, not instructions
// to click or mutate its data. Wrong view/duplicates/disabled/hidden = OFF.
export function findUniqueVisibleTourTarget(root,selector) {
  if (!root?.querySelectorAll || typeof selector!=='string') return null;
  const matches=root.querySelectorAll(selector);
  if (matches.length!==1) return null;
  const element=matches[0];
  if (!element?.isConnected || element.closest?.('[aria-hidden="true"],[hidden],[inert]')) return null;
  if (element.matches?.(':disabled,[disabled],[aria-disabled="true"]')) return null;
  if (!element.getClientRects?.().length) return null;
  const style=typeof getComputedStyle==='function'?getComputedStyle(element):null;
  if (style&&(style.visibility==='hidden'||style.visibility==='collapse'||style.display==='none')) return null;
  return element;
}
export function allPresetPilotTargetsVisible(root) {
  if(!root?.querySelector?.('[data-my-domain-view="wand"]'))return false;
  return PRESETS_MY_WAND_TOUR.steps.every(s=>!!findUniqueVisibleTourTarget(root,s.target));
}
