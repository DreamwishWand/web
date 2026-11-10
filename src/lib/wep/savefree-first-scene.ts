// 02 WEP / F-P04: Save-free FIRST NONEMPTY local Scene from a verified
// Switch 1.25.0 Catalog Item and SHA-pinned Geometry/Scope binding.
// No EditorSession, guessed seed object/footprint, account inventory, Native
// Apply, empty Scene, or second local store.
import { captureScenePreset } from './scene-capture-runtime.ts';
import { validatePublishablePreset, preflightScene } from './scene-preset-runtime.ts';
import {
  WORLD_READ_SWITCH_V125_SHA256,
  WORLD_GRIDDATA_DIMENSIONS_V125_SHA256
} from './world-browser-adapter.ts';
export const WEP_SAVEFREE_FIRST_SCENE_OPERATION =
  'WEP_SAVEFREE_FIRST_NONEMPTY_VERIFIED_CATALOG_SCENE@1';
const SOURCE = Object.freeze({
  platform:'Nintendo Switch',gameVersion:'1.25.0',buildID:'52BD625D9B4E0053'
});
const fail=(code:string):never=>{throw Error('WEP_SAVEFREE_SCENE_'+code);};
const safeInt=(x:unknown):x is number=>typeof x==='number'&&Number.isSafeInteger(x);

export function resolveVerifiedSaveFreeSceneItem(directory:any, binding:any, itemId:number) {
  if(!safeInt(itemId)||itemId<=0 ||
     directory?.status!=='READY' || !Array.isArray(directory.entries) ||
     directory.source?.platform!==SOURCE.platform ||
     directory.source?.gameVersion!==SOURCE.gameVersion ||
     directory.source?.buildID!==SOURCE.buildID ||
     binding?.source?.platform!==SOURCE.platform ||
     binding.source.gameVersion!==SOURCE.gameVersion ||
     binding.source.profileSchemaVersion!==624 ||
     binding.provenance?.readDataBuildID!==SOURCE.buildID ||
     binding.provenance.readDataSha256!==WORLD_READ_SWITCH_V125_SHA256 ||
     binding.provenance.gridDataDimensionsSha256!==WORLD_GRIDDATA_DIMENSIONS_V125_SHA256 ||
     typeof binding.resolveDraftPlacementSource!=='function') fail('SOURCE_UNVERIFIED');
  const matching=directory.entries.filter((row:any)=>row?.itemId===itemId);
  if(matching.length!==1 || matching[0].family!=='Furniture')
    fail('CATALOG_ITEM_NOT_ELIGIBLE');
  // Re-evaluate the authoritative geometry/scope at each user action, NOT a
  // cached/modified DOM Item or a manually specified 1x1 fallback.
  const cap=binding.resolveDraftPlacementSource(itemId,1);
  if(cap?.contract!=='dreamwish-wand-wep-draft-placement-source@1' ||
     cap.status!=='SUPPORTED' || cap.draftPlacementSupported!==true ||
     cap.canonicalIdentity?.kind!=='DDV_ITEM_ID' ||
     cap.canonicalIdentity.itemId!==itemId ||
     cap.itemId!==itemId || cap.layer!=='furniture' || cap.orientation!==0 ||
     cap.persistentWriteAuthorized!==false ||
     cap.productApplyAuthorized!==false ||
     cap.verifiedReplacementExportSupported!==false ||
     cap.directSourceReplacementAuthorized!==false ||
     !Array.isArray(cap.reasons)||cap.reasons.length!==0)
    fail('GEOMETRY_OR_POLICY_UNVERIFIED');
  const {w,h}=cap.footprintSize??{};
  if(!safeInt(w)||!safeInt(h)||w<1||h<1||w>64||h>64||w*h>4096 ||
     !Array.isArray(cap.footprint)||cap.footprint.length!==w*h)
    fail('FOOTPRINT_UNVERIFIED');
  const seen=new Set<string>();
  const footprint=cap.footprint.map((cell:any)=>{
    if(!safeInt(cell?.x)||!safeInt(cell?.y)||cell.x<0||cell.y<0||
       cell.x>=w||cell.y>=h) fail('FOOTPRINT_UNVERIFIED');
    const key=cell.x+','+cell.y;
    if(seen.has(key)) fail('FOOTPRINT_UNVERIFIED');
    seen.add(key);
    return {x:cell.x,y:cell.y};
  });
  if(!seen.has('0,0')||seen.size!==w*h) fail('FOOTPRINT_UNVERIFIED');
  return Object.freeze({itemId,label:matching[0].label,layer:'furniture',
    footprint:Object.freeze(footprint.map((cell:any)=>Object.freeze(cell))),
    bounds:Object.freeze({w,h}), source:'VERIFIED_SWITCH1250_CATALOG_GEOMETRY_SCOPE',
    inventoryVerified:false,applyReady:false,writeReady:false});
}

export function buildSaveFreeFirstNonemptyScene({
  directory,binding,itemId,title
}:{directory:any;binding:any;itemId:number;title:string}) {
  if(typeof title!=='string'||title.trim().length<1||title.trim().length>120)
    fail('TITLE_INVALID');
  const item=resolveVerifiedSaveFreeSceneItem(directory,binding,itemId);
  const document:Parameters<typeof captureScenePreset>[0]={
    schema:'dreamwish-wand-wep-editor-document',version:1,
    // This is a local design, not a native Save, a trusted Grid identity or
    // evidence that the user owns/has discovered this catalog Item.
    target:{platform:'synthetic',gameVersion:null,areaKey:null},
    networks:{roads:null,fences:null},capabilities:{},metadata:{},
    objects:[{editorId:'savefree-local-item-selection',itemId:item.itemId,
      layer:'furniture',x:0,y:0,orientation:0,
      footprint:item.footprint.map((cell:{x:number;y:number})=>({...cell})),
      portableState:null,dependencyIds:[],editability:'editable',source:null}]
  };
  // Reuse original WEP capture and publication validation; never construct an
  // unvalidated or empty Preset Artifact by hand.
  const capture=captureScenePreset(document,{
    selectionIds:['savefree-local-item-selection'],
    title:title.trim(),includeRoads:false,includeFences:false
  },validatePublishablePreset);
  if(capture.publicationReady!==true||capture.artifact.objects.length!==1)
    fail('NONEMPTY_CAPTURE_DENIED');
  const check=preflightScene(capture.artifact);
  if(check.ok!==true||check.writeReady!==false||
     capture.artifact.bounds.w!==item.bounds.w||
     capture.artifact.bounds.h!==item.bounds.h ||
     capture.artifact.objects[0].itemId!==item.itemId)
    fail('SCENE_PREFLIGHT_DENIED');
  return Object.freeze({operation:WEP_SAVEFREE_FIRST_SCENE_OPERATION,
    title:title.trim(),item,artifact:capture.artifact,
    localOnly:true,editorSessionCreated:false,inventoryVerified:false,
    nativePlacementAuthorized:false,writeReady:false,applyReady:false});
}

const COPY={
 en:{title:'Create a first local Scene without a game Save',notice:'Choose a verified furniture Item and its source-pinned footprint. Local design only: no ownership, Editor placement or DDV Apply.',load:'Load verified furniture Catalog',search:'Search Item name or ID',choose:'Select this verified Item',unavailable:'Unsupported footprint or policy',name:'Scene title',save:'Save nonempty Scene on this device',waiting:'Loading verified sources…',empty:'No matching furniture Items',prepare:'Preview verified nonempty Scene',ready:'Verified local Scene preview · ready for explicit save',saved:'Saved and independently reopened. Local readonly Scene; DDV writer and Apply remain OFF.',blocked:'Scene could not be verified or saved. Existing library was not overwritten.',footprint:'Verified footprint',off:'Writer / Apply / Cloud OFF',next:'View device-only Scenes in My Presets'},
 ja:{title:'ゲームSaveなしで最初のローカルSceneを作成',notice:'検証済み家具Itemと正規Footprintを選択します。端末内の設計のみで所持・Editor配置・DDV Applyは認めません。',load:'検証済み家具Catalogを読み込む',search:'Item名またはIDで検索',choose:'この検証済みItemを選択',unavailable:'Footprintまたは利用条件が未検証',name:'Sceneタイトル',save:'非空Sceneをこの端末に保存',waiting:'検証済みデータを読込中…',empty:'一致する家具Itemがありません',prepare:'非空Sceneを検証・プレビュー',ready:'非空ローカルSceneを検証しました。明示的な保存を選択できます。',saved:'保存後に独立再Openで検証しました。読み取り専用、DDV Writer・ApplyはOFFです。',blocked:'Scene検証・保存を拒否しました。既存ライブラリは上書きしていません。',footprint:'検証済みFootprint',off:'Writer／Apply／Cloud OFF',next:'My Presetsで端末内Sceneを見る'},
 fr:{title:'Créer une première Scene locale sans sauvegarde du jeu',notice:'Choisissez un meuble vérifié et son empreinte confirmée. Conception locale uniquement, sans possession ni Apply DDV.',load:'Charger le catalogue de meubles vérifiés',search:'Chercher un nom ou ID',choose:'Sélectionner cet objet vérifié',unavailable:'Empreinte ou règle non vérifiée',name:'Titre de la Scene',save:'Enregistrer la Scene non vide sur cet appareil',waiting:'Chargement des sources vérifiées…',empty:'Aucun meuble correspondant',prepare:'Vérifier et prévisualiser la Scene non vide',ready:'Aperçu local vérifié, prêt pour votre confirmation',saved:'Enregistrée et rouverte indépendamment. DDV Writer et Apply désactivés.',blocked:'Scene refusée ou indisponible. Bibliothèque existante inchangée.',footprint:'Empreinte vérifiée',off:'Writer / Apply / Cloud désactivés',next:'Voir les Scenes locales dans Mes Presets'},
 it:{title:'Crea la prima Scene locale senza salvataggio',notice:'Scegli un mobile verificato e la sua impronta. Solo progetto locale, senza proprietà o Apply DDV.',load:'Carica Catalog mobili verificati',search:'Cerca nome o ID',choose:'Seleziona questo Item verificato',unavailable:'Impronta o regole non verificate',name:'Titolo Scene',save:'Salva Scene non vuota sul dispositivo',waiting:'Caricamento dati verificati…',empty:'Nessun mobile corrispondente',prepare:'Verifica e mostra anteprima della Scene',ready:'Anteprima verificata pronta per il salvataggio esplicito',saved:'Salvata e riaperta indipendentemente. Writer e Apply DDV disattivati.',blocked:'Scene non verificata o non salvata. Libreria invariata.',footprint:'Impronta verificata',off:'Writer / Apply / Cloud OFF',next:'Visualizza Scenes locali in I miei Preset'},
 de:{title:'Erste lokale Scene ohne Spielstand erstellen',notice:'Wählen Sie ein geprüftes Möbelstück mit belegter Grundfläche. Nur lokal; kein Besitz oder DDV Apply.',load:'Geprüften Möbelkatalog laden',search:'Name oder ID suchen',choose:'Dieses geprüfte Item auswählen',unavailable:'Grundfläche oder Richtlinie ungeprüft',name:'Scene-Titel',save:'Nichtleere Scene auf diesem Gerät speichern',waiting:'Geprüfte Daten laden…',empty:'Keine passenden Möbel',prepare:'Nichtleere Scene prüfen und ansehen',ready:'Lokale Vorschau geprüft, explizites Speichern möglich',saved:'Gespeichert und unabhängig erneut geöffnet. DDV Writer/Apply bleiben aus.',blocked:'Scene gesperrt. Bestehende Bibliothek nicht überschrieben.',footprint:'Geprüfte Grundfläche',off:'Writer / Apply / Cloud AUS',next:'Lokale Scenes in Meine Presets anzeigen'},
 'es-ES':{title:'Crear la primera Scene local sin partida guardada',notice:'Elige un mueble verificado y su huella confirmada. Diseño local, sin posesión ni Apply DDV.',load:'Cargar catálogo verificado',search:'Buscar nombre o ID',choose:'Elegir este Item verificado',unavailable:'Huella o política no verificadas',name:'Título de Scene',save:'Guardar Scene no vacía en este dispositivo',waiting:'Cargando fuentes verificadas…',empty:'No hay muebles coincidentes',prepare:'Validar y previsualizar Scene no vacía',ready:'Vista previa verificada, guarda solo si lo confirmas',saved:'Guardada y reabierta por separado. Writer y Apply DDV desactivados.',blocked:'Scene rechazada. Biblioteca existente intacta.',footprint:'Huella verificada',off:'Writer / Apply / Cloud OFF',next:'Ver Scenes locales en Mis Presets'},
 'zh-CN':{title:'无需游戏存档创建首个本地 Scene',notice:'选择已验证家具与真实占地范围。仅本地设计，不代表拥有或可应用到 DDV。',load:'加载已验证家具目录',search:'搜索物品名称或 ID',choose:'选择此已验证物品',unavailable:'占地或规则未验证',name:'Scene 标题',save:'在本设备保存非空 Scene',waiting:'加载已验证来源…',empty:'没有匹配的家具',prepare:'验证并预览非空 Scene',ready:'本地预览验证完成，请明确确认保存',saved:'已保存并独立重新打开。DDV Writer 与 Apply 关闭。',blocked:'Scene 验证或保存被拒绝，原有资料库未覆盖。',footprint:'已验证占地',off:'Writer / Apply / Cloud 关闭',next:'在我的 Presets 查看本地 Scenes'},
 'pt-BR':{title:'Criar primeira Scene local sem Save do jogo',notice:'Escolha um móvel verificado e sua área validada. Apenas design local, sem posse nem Apply DDV.',load:'Carregar catálogo verificado',search:'Buscar nome ou ID',choose:'Selecionar Item verificado',unavailable:'Área ou regras não verificadas',name:'Título da Scene',save:'Salvar Scene não vazia neste dispositivo',waiting:'Carregando fontes verificadas…',empty:'Nenhum móvel encontrado',prepare:'Validar e visualizar Scene não vazia',ready:'Prévia validada, confirme para salvar',saved:'Salva e reaberta independentemente. Writer e Apply DDV desligados.',blocked:'Scene negada, biblioteca anterior preservada.',footprint:'Área verificada',off:'Writer / Apply / Cloud OFF',next:'Ver Scenes locais em Meus Presets'}
};
export const SAVEFREE_SCENE_LOCALES=Object.freeze(Object.keys(COPY));
export function saveFreeSceneCopy(locale='en') {return COPY[locale as keyof typeof COPY]??COPY.en;}
