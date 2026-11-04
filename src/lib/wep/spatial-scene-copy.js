// P0 local 2D controls, no game art, no Writer capability.
const copy = Object.freeze({
  en: { zoomIn:'Zoom in',zoomOut:'Zoom out',fit:'Fit Area',panHint:'Alt + drag or middle-drag to pan · wheel to zoom',unresolved:'Unverified coordinates',changes:'Local draft changes' },
  ja: { zoomIn:'拡大',zoomOut:'縮小',fit:'エリアに合わせる',panHint:'Alt＋ドラッグ／中ボタンドラッグで移動・ホイールで拡大縮小',unresolved:'座標未検証',changes:'ローカル下書きの差分' },
  de: { zoomIn:'Vergrößern',zoomOut:'Verkleinern',fit:'Bereich anpassen',panHint:'Alt+Ziehen oder Mitteltaste: verschieben · Rad: zoomen',unresolved:'Koordinaten nicht geprüft',changes:'Lokale Entwurfsänderungen' },
  fr: { zoomIn:'Zoom avant',zoomOut:'Zoom arrière',fit:'Adapter à la zone',panHint:'Alt+glisser ou bouton central pour déplacer · molette pour zoomer',unresolved:'Coordonnées non vérifiées',changes:'Modifications locales' },
  it: { zoomIn:'Ingrandisci',zoomOut:'Riduci',fit:'Adatta area',panHint:'Alt+trascina o pulsante centrale: sposta · rotella: zoom',unresolved:'Coordinate non verificate',changes:'Modifiche locali alla bozza' },
  'es-ES': { zoomIn:'Acercar',zoomOut:'Alejar',fit:'Ajustar área',panHint:'Alt+arrastrar o botón central: desplazar · rueda: zoom',unresolved:'Coordenadas sin verificar',changes:'Cambios del borrador local' },
  'pt-BR': { zoomIn:'Ampliar',zoomOut:'Reduzir',fit:'Ajustar à área',panHint:'Alt+arrastar ou botão do meio para mover · roda para zoom',unresolved:'Coordenadas não verificadas',changes:'Alterações locais do rascunho' },
  'zh-CN': { zoomIn:'放大',zoomOut:'缩小',fit:'适应区域',panHint:'Alt+拖动或鼠标中键平移 · 滚轮缩放',unresolved:'坐标未验证',changes:'本地草稿变更' }
});
export function spatialSceneCopy(locale='en') {
  return copy[Object.hasOwn(copy, locale)?locale:'en'];
}
export const SPATIAL_SCENE_LOCALES = Object.freeze(Object.keys(copy));
