// P0 local 2D controls, no game art, no Writer capability.
const copy = Object.freeze({
  en: { objectId:"EditorSession ObjectID",nativeId:"Native GridObject ID",rootGrid:"Root GridID",footprint:"Footprint",zoomIn:'Zoom in',zoomOut:'Zoom out',fit:'Fit Area',panHint:'Alt + drag or middle-drag to pan · wheel to zoom',unresolved:'Unverified coordinates',changes:'Local draft changes' },
  ja: { objectId:"エディター内のObjectID",nativeId:"Native GridObject ID",rootGrid:"ルートGridID",footprint:"占有マス",zoomIn:'拡大',zoomOut:'縮小',fit:'エリアに合わせる',panHint:'Alt＋ドラッグ／中ボタンドラッグで移動・ホイールで拡大縮小',unresolved:'座標未検証',changes:'ローカル下書きの差分' },
  de: { objectId:"EditorSession-Objekt-ID",nativeId:"Native GridObject-ID",rootGrid:"Root-Grid-ID",footprint:"Grundfläche",zoomIn:'Vergrößern',zoomOut:'Verkleinern',fit:'Bereich anpassen',panHint:'Alt+Ziehen oder Mitteltaste: verschieben · Rad: zoomen',unresolved:'Koordinaten nicht geprüft',changes:'Lokale Entwurfsänderungen' },
  fr: { objectId:"ID de l’objet EditorSession",nativeId:"ID GridObject natif",rootGrid:"ID de la grille racine",footprint:"Emprise",zoomIn:'Zoom avant',zoomOut:'Zoom arrière',fit:'Adapter à la zone',panHint:'Alt+glisser ou bouton central pour déplacer · molette pour zoomer',unresolved:'Coordonnées non vérifiées',changes:'Modifications locales' },
  it: { objectId:"ID oggetto EditorSession",nativeId:"ID GridObject nativo",rootGrid:"ID Grid radice",footprint:"Ingombro",zoomIn:'Ingrandisci',zoomOut:'Riduci',fit:'Adatta area',panHint:'Alt+trascina o pulsante centrale: sposta · rotella: zoom',unresolved:'Coordinate non verificate',changes:'Modifiche locali alla bozza' },
  'es-ES': { objectId:"ID de objeto EditorSession",nativeId:"ID GridObject nativo",rootGrid:"ID de cuadrícula raíz",footprint:"Huella",zoomIn:'Acercar',zoomOut:'Alejar',fit:'Ajustar área',panHint:'Alt+arrastrar o botón central: desplazar · rueda: zoom',unresolved:'Coordenadas sin verificar',changes:'Cambios del borrador local' },
  'pt-BR': { objectId:"ID de objeto EditorSession",nativeId:"ID GridObject nativo",rootGrid:"ID de Grid raiz",footprint:"Área ocupada",zoomIn:'Ampliar',zoomOut:'Reduzir',fit:'Ajustar à área',panHint:'Alt+arrastar ou botão do meio para mover · roda para zoom',unresolved:'Coordenadas não verificadas',changes:'Alterações locais do rascunho' },
  'zh-CN': { objectId:"EditorSession对象ID",nativeId:"原生GridObject ID",rootGrid:"根Grid ID",footprint:"占地格",zoomIn:'放大',zoomOut:'缩小',fit:'适应区域',panHint:'Alt+拖动或鼠标中键平移 · 滚轮缩放',unresolved:'坐标未验证',changes:'本地草稿变更' }
});
export function spatialSceneCopy(locale='en') {
  return copy[Object.hasOwn(copy, locale)?locale:'en'];
}
export const SPATIAL_SCENE_LOCALES = Object.freeze(Object.keys(copy));
