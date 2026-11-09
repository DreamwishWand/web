// 08 WEB: an explicit, bounded, DEVICE-LOCAL selected Scene sender.
// The WEP receiver owns the one-shot schema. This adapter never trusts a
// selected UI row as authority and never transports an artifact or Native ID.
import { readLocalSceneById } from '../wep/local-scene-preset-store.mjs';
import { preflightScene } from '../wep/scene-preset-runtime.ts';
import { buildReadonlyLocalSceneReuseDraft } from '../wep/local-scene-reuse-readonly.ts';
import {
  stageLocalSceneRouteIntent, WEP_LOCAL_SCENE_ROUTE_INTENT_KEY
} from '../wep/local-scene-route-handoff.mjs';

const fail = () => { throw Error('WEB_MYLOCAL_SCENE_ROUTE_NOT_VERIFIED'); };
const SCENE_ID = /^scene_[0-9a-f-]{36}$/;
const safeRev = n => Number.isSafeInteger(n) && n > 0;
const safeText = s => typeof s === 'string' && s.length > 0;
const safeCount = n => Number.isSafeInteger(n) && n > 0 && n <= 4096;

/**
 * Call ONLY after a user explicitly selects a displayed local Scene and
 * clicks "Open in World Editor". No render/onMount/auto-upgrade trigger.
 * Sender verifies again; the receiver independently verifies the canonical
 * IDB snapshot after its own separate user confirmation.
 */
export async function stageVerifiedMyLocalSceneRoute({
  selected, expectedRevision, storage,
  readScene = readLocalSceneById,
  preflight = preflightScene,
  buildDraft = buildReadonlyLocalSceneReuseDraft,
  now = Date.now()
}) {
  // Invalidate a previous pending selection before attempting another click.
  // The private hint is not source/ownership authority.
  try { storage?.removeItem(WEP_LOCAL_SCENE_ROUTE_INTENT_KEY); } catch { fail(); }
  if (!selected || typeof selected !== 'object' ||
      typeof selected.id !== 'string' || !SCENE_ID.test(selected.id) ||
      !safeText(selected.title) || selected.title.length > 120 ||
      !safeText(selected.createdAt) || !Number.isFinite(Date.parse(selected.createdAt)) ||
      !safeCount(selected.objectCount) || !safeRev(expectedRevision) ||
      typeof readScene !== 'function' || typeof preflight !== 'function' ||
      typeof buildDraft !== 'function' || !storage) fail();

  // The canonical Scene row+primary+backup is validated by this accepted
  // readonly WEP reader (create:false). Never create a second Scene store.
  let latest;
  try { latest = await readScene(selected.id); } catch { fail(); }
  if (!latest || latest.revision !== expectedRevision ||
      latest.entry?.id !== selected.id ||
      latest.entry.title !== selected.title ||
      latest.entry.createdAt !== selected.createdAt ||
      !Array.isArray(latest.entry.artifact?.objects) ||
      latest.entry.artifact.objects.length !== selected.objectCount) fail();

  const readiness = preflight(latest.entry.artifact);
  if (readiness?.ok !== true || readiness.writeReady !== false) fail();

  // Fail closed on unsupported local topology, footprint or Native identity.
  const draft = buildDraft({
    sceneId: latest.entry.id,
    sourceRevision: latest.revision,
    artifact: latest.entry.artifact
  });
  if (draft?.localOnly !== true ||
      draft.detachedFromEditorSession !== true ||
      draft.inventoryVerified !== false ||
      draft.nativePlacementAuthorized !== false ||
      draft.editorMutationAuthorized !== false ||
      draft.writeReady !== false || draft.applyReady !== false) fail();

  // Exactly one short-lived same-tab hint. No Scene bytes, title, position,
  // Creator, Native identity, user Save, URL fragment or Cloud data.
  return stageLocalSceneRouteIntent(storage, {
    sceneId: latest.entry.id, expectedRevision: latest.revision
  }, now);
}
