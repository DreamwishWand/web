// F-P04: untrusted, ephemeral SAME-TAB navigation HINT only.
// This is neither a Saved/Created ownership receipt nor Native/Editor authority.
// Sender (08 WEB) MUST call stage only on an explicit click, after its own
// accepted local Scene readonly selection/revision verification.
// Receiver (02 WEP) MUST NOT fetch local IDB or create a Draft until another
// explicit user click, then take the hint and independently readLocalSceneById.
export const WEP_LOCAL_SCENE_ROUTE_INTENT_KEY =
  'dreamwishwand:wep:scene-preset:selected-route:v1';
export const WEP_LOCAL_SCENE_ROUTE_INTENT_SCHEMA =
  'wand.wep.local-scene-route-intent@1';
export const WEP_LOCAL_SCENE_ROUTE_INTENT_MAX_AGE_MS = 3 * 60 * 1000;
const SCENE_ID = /^scene_[0-9a-f-]{36}$/;
const keys = ['schema', 'sceneId', 'expectedRevision', 'issuedAt'];
const own = (value) => value !== null && typeof value === 'object' &&
  !Array.isArray(value) && Object.keys(value).length === keys.length &&
  keys.every(key => Object.prototype.hasOwnProperty.call(value, key));
const valid = (value, now) => own(value) &&
  value.schema === WEP_LOCAL_SCENE_ROUTE_INTENT_SCHEMA &&
  typeof value.sceneId === 'string' && SCENE_ID.test(value.sceneId) &&
  Number.isSafeInteger(value.expectedRevision) && value.expectedRevision > 0 &&
  Number.isSafeInteger(value.issuedAt) && value.issuedAt > 0 &&
  Number.isSafeInteger(now) && now >= value.issuedAt &&
  now - value.issuedAt <= WEP_LOCAL_SCENE_ROUTE_INTENT_MAX_AGE_MS;

function parse(raw, now) {
  if (typeof raw !== 'string' || raw.length > 256 || raw.length < 1) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!valid(parsed, now)) return null;
    return {schema: parsed.schema, sceneId: parsed.sceneId,
      expectedRevision: parsed.expectedRevision, issuedAt: parsed.issuedAt};
  } catch { return null; }
}

// Sender contract: no Scene artifact, title, Native ID, Save bytes, URL query,
// account identity, or authorization bit. Non-persistent sessionStorage only.
export function stageLocalSceneRouteIntent(storage, {sceneId, expectedRevision}, now = Date.now()) {
  const value = {schema: WEP_LOCAL_SCENE_ROUTE_INTENT_SCHEMA,
    sceneId, expectedRevision, issuedAt: now};
  if (!valid(value, now) || !storage || typeof storage.setItem !== 'function')
    throw Error('WEP_SCENE_ROUTE_INTENT_INVALID');
  storage.setItem(WEP_LOCAL_SCENE_ROUTE_INTENT_KEY, JSON.stringify(value));
  return {sceneId, expectedRevision, issuedAt: now};
}

// Read for display of a hint only; do NOT open IndexedDB or make a Draft.
export function peekLocalSceneRouteIntent(storage, now = Date.now()) {
  try { return parse(storage?.getItem(WEP_LOCAL_SCENE_ROUTE_INTENT_KEY), now); }
  catch { return null; }
}

// User click only: one-shot, TOCTOU-checked against the hint shown to user.
// On failure, no retry or read; receiver must still re-read original IndexedDB,
// check current revision against expectedRevision, and run typed geometry guard.
export function takeLocalSceneRouteIntent(storage, shown, now = Date.now()) {
  try {
    const latest = storage?.getItem(WEP_LOCAL_SCENE_ROUTE_INTENT_KEY);
    storage?.removeItem(WEP_LOCAL_SCENE_ROUTE_INTENT_KEY);
    const current = parse(latest, now);
    if (!current || !shown || !valid(shown, now) ||
        current.sceneId !== shown.sceneId ||
        current.expectedRevision !== shown.expectedRevision ||
        current.issuedAt !== shown.issuedAt) return null;
    return current;
  } catch { return null; }
}

// New receiver labels only, no changes to accepted Scene Save or Presets UI.
// Match the eight existing product locales; never imply Apply is available.
const COPY = {
  en: {title:'Selected local Scene',notice:'From My Presets: only a temporary selection hint. Confirm to re-open the current on-device Scene; nothing is placed or applied.',
    action:'Reopen selected Scene as read-only draft',ready:'Detached read-only Scene ready. Editor and DDV Save were not changed.',
    blocked:'Selection expired, changed or invalid. Reopen My Presets and select again.'},
  fr: {title:'Scene locale sélectionnée',notice:'Sélection temporaire de Mes Presets. Confirmez pour rouvrir la Scene locale ; aucune application ni placement.',
    action:'Rouvrir la Scene en brouillon de lecture seule',ready:'Brouillon séparé prêt. Aucun changement dans l’éditeur ni la sauvegarde DDV.',
    blocked:'Sélection expirée, modifiée ou invalide. Sélectionnez à nouveau dans Mes Presets.'},
  it: {title:'Scene locale selezionata',notice:'Solo indicazione temporanea da I miei Preset. Conferma per riaprire la Scene locale; nessun posizionamento o Apply.',
    action:'Riapri come bozza separata in sola lettura',ready:'Bozza in sola lettura pronta. Editor e salvataggio DDV invariati.',
    blocked:'Selezione scaduta, cambiata o non valida. Riseleziona dai miei Preset.'},
  de: {title:'Ausgewählte lokale Scene',notice:'Nur ein temporärer Hinweis aus Meine Presets. Bestätigen Sie zum erneuten Öffnen; kein Platzieren oder Anwenden.',
    action:'Scene als schreibgeschützten Entwurf öffnen',ready:'Getrennter Entwurf bereit. Editor und DDV-Speicherstand unverändert.',
    blocked:'Auswahl veraltet, geändert oder ungültig. In Meine Presets erneut auswählen.'},
  'es-ES': {title:'Scene local seleccionada',notice:'Solo una selección temporal de Mis Presets. Confirma para reabrir la Scene local; nada se coloca ni aplica.',
    action:'Reabrir como borrador separado de solo lectura',ready:'Borrador de solo lectura listo. Editor y guardado DDV sin cambios.',
    blocked:'Selección caducada, modificada o inválida. Vuelve a seleccionarla en Mis Presets.'},
  ja: {title:'選択したローカルScene',notice:'My Presetsからの一時的な選択情報です。押すと端末内原本を再検証します。配置・Applyはしません。',
    action:'選択したSceneを読み取り専用Draftとして再Open',ready:'分離した読み取り専用Draftを作成しました。EditorやDDV Saveは変更していません。',
    blocked:'選択情報が期限切れ・更新済み・不正です。My Presetsで選び直してください。'},
  'zh-CN': {title:'已选本地 Scene',notice:'仅来自我的 Presets 的临时选择提示。确认后重新验证设备内 Scene，不会放置或应用。',
    action:'只读重新打开所选 Scene 草稿',ready:'独立只读草稿已准备好。编辑器和 DDV 存档均未更改。',
    blocked:'选择已过期、改变或无效。请在我的 Presets 中重新选择。'},
  'pt-BR': {title:'Scene local selecionada',notice:'Apenas uma indicação temporária de Meus Presets. Confirme para reabrir a Scene local; nada é posicionado ou aplicado.',
    action:'Reabrir Scene como rascunho isolado de leitura',ready:'Rascunho isolado pronto. Editor e Save DDV não foram alterados.',
    blocked:'Seleção expirada, alterada ou inválida. Selecione novamente em Meus Presets.'}
};
export const WEP_LOCAL_SCENE_ROUTE_LOCALES = Object.freeze(Object.keys(COPY));
export function localSceneRouteCopy(locale = 'en') { return COPY[locale] ?? COPY.en; }
