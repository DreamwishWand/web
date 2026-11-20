// 08 WEB: bounded DISPLAY projection from the accepted 02 WEP detached
// read-only Scene draft. A caller cannot use this for placement or Save edits.
// This module never opens the Scene DB, reads raw Save, writes storage or mints
// editor/native coordinates, ownership, or an Operation.
export const LOCAL_SCENE_MAP_MAX_CELLS = 512;
const integer = n => typeof n === 'number' && Number.isSafeInteger(n);
const RECORD = 'WEP_LOCAL_SCENE_REUSE_DETACHED_READONLY_DRAFT@1';
export function localSceneReadonlyMapFromDraft(draft){
 if(!draft || typeof draft!=='object' || draft.operation!==RECORD ||
   draft.localOnly!==true || draft.detachedFromEditorSession!==true ||
   draft.inventoryVerified!==false || draft.nativePlacementAuthorized!==false ||
   draft.editorMutationAuthorized!==false || draft.writeReady!==false ||
   draft.applyReady!==false || !draft.bounds ||
   !integer(draft.bounds.w) || !integer(draft.bounds.h) ||
   draft.bounds.w<1 || draft.bounds.h<1 ||
   draft.bounds.w>4096 || draft.bounds.h>4096 ||
   !Array.isArray(draft.objects) || draft.objects.length<1 ||
   draft.objects.length>LOCAL_SCENE_MAP_MAX_CELLS)return null;
 const cells=[],seen=new Set(),itemIds=[];
 for(const object of draft.objects){
  if(!object || !integer(object.itemId) || object.itemId<=0 ||
    typeof object.artifactObjectId!=='string' || seen.has(object.artifactObjectId) ||
    object.editability!=='readonly' || object.nativeGridObjectId!==null ||
    object.source!==null || !['furniture','building','landscaping'].includes(object.layer) ||
    !integer(object.x) || !integer(object.y) ||
    !Array.isArray(object.footprint) || object.footprint.length<1 ||
    object.footprint.length>LOCAL_SCENE_MAP_MAX_CELLS)return null;
  seen.add(object.artifactObjectId);
  itemIds.push(object.itemId);
  for(const offset of object.footprint){
   if(!offset || !integer(offset.x) || !integer(offset.y))return null;
   const x=object.x+offset.x,y=object.y+offset.y;
   if(!integer(x)||!integer(y)||x<0||y<0||
      x>=draft.bounds.w||y>=draft.bounds.h||
      cells.length>=LOCAL_SCENE_MAP_MAX_CELLS)return null;
   cells.push(Object.freeze({x,y,itemId:object.itemId}));
  }
 }
 return Object.freeze({
  width:draft.bounds.w,height:draft.bounds.h,
  objectCount:draft.objects.length,
  cells:Object.freeze(cells),itemIds:Object.freeze(itemIds),
  nativeApplyAuthorized:false,readOnly:true
 });
}
const labels=Object.freeze({
 en:['Local Scene layout (read only)','Local coordinates only; not a game placement or ownership check.','Furniture item ID','Grid cells'],
 ja:['ローカルSceneの配置図（読み取り専用）','端末内の相対座標のみ。ゲーム内配置・所有権は未確認です。','家具アイテムID','配置マス'],
 fr:['Plan de la scène locale (lecture seule)','Coordonnées locales uniquement, sans vérification de placement ni de propriété.','ID objet de mobilier','Cases'],
 it:['Mappa della scena locale (sola lettura)','Solo coordinate locali, senza conferma di posa o proprietà nel gioco.','ID oggetto arredo','Celle'],
 de:['Lokaler Szenenplan (nur lesend)','Nur lokale Koordinaten, keine Prüfung von Platzierung oder Besitz im Spiel.','Möbel-Item-ID','Zellen'],
 'es-ES':['Plano de escena local (solo lectura)','Solo coordenadas locales; sin verificar ubicación ni propiedad en el juego.','ID de mueble','Celdas'],
 'zh-CN':['本地场景布局（只读）','仅显示本地坐标，不验证游戏内摆放或物品所有权。','家具物品 ID','网格单元'],
 'pt-BR':['Mapa da cena local (somente leitura)','Somente coordenadas locais, sem validar posicionamento nem posse no jogo.','ID de móvel','Células']
});
export const LOCAL_SCENE_MAP_LOCALES=Object.freeze(Object.keys(labels));
export function localSceneReadonlyMapCopy(locale='en'){
 const value=labels[locale]??labels.en;
 return Object.freeze({title:value[0],notice:value[1],itemId:value[2],cells:value[3]});
}
