// 06F Owner-closed Stage1 Gallery root. This is UI routing and public RPC filtering ONLY.
// No DreamSnaps Gallery child, no inferred media rights/creator eligibility/Community Writer.
export const STAGE1_GALLERY_CONTRACT='wand.gallery.stage1-root@1';
export const STAGE1_GALLERY_PRODUCTS=Object.freeze([
 Object.freeze({id:'decorations',kinds:Object.freeze(['outdoor','indoor'])}),
 Object.freeze({id:'touchOfMagic',kinds:Object.freeze(['tom_furniture','tom_clothing'])}),
 Object.freeze({id:'myGallery',href:'/gallery/my/'})
]);
export const STAGE1_GALLERY_PUBLIC_WRITER_ENABLED=false;
export const STAGE1_GALLERY_MEDIA_RIGHTS_VERIFIED=false;
const messages=Object.freeze({
 en:['Decorations','Touch of Magic','My Gallery','Outdoor','Indoor','Furniture','Clothing','All','Browse','Back to Gallery','No eligible public Works','Preview unavailable','Public gallery works','My Works & Saved'],
 fr:['Décorations','Touch of Magic','Ma Galerie','Extérieur','Intérieur','Meubles','Vêtements','Tout','Parcourir','Retour à la Galerie','Aucune œuvre publique admissible','Aperçu indisponible','Œuvres publiques','Mes œuvres et favoris'],
 it:['Decorazioni','Touch of Magic','La mia Galleria','Esterni','Interni','Mobili','Abiti','Tutti','Esplora','Torna alla Galleria','Nessuna opera pubblica idonea','Anteprima non disponibile','Opere pubbliche','Le mie opere e salvati'],
 de:['Dekorationen','Touch of Magic','Meine Galerie','Draußen','Drinnen','Möbel','Kleidung','Alle','Entdecken','Zurück zur Galerie','Keine geeigneten öffentlichen Werke','Vorschau nicht verfügbar','Öffentliche Werke','Meine Werke und Gespeicherte'],
 'es-ES':['Decoraciones','Touch of Magic','Mi Galería','Exterior','Interior','Muebles','Ropa','Todo','Explorar','Volver a Galería','No hay obras públicas aptas','Vista previa no disponible','Obras públicas','Mis obras y guardadas'],
 ja:['デコレーション','Touch of Magic','マイギャラリー','屋外','屋内','家具','衣装','すべて','作品を見る','ギャラリーへ戻る','閲覧可能な公開作品はありません','プレビューできません','公開ギャラリー作品','自分の作品と保存済み'],
 'zh-CN':['装饰','Touch of Magic','我的画廊','室外','室内','家具','服装','全部','浏览','返回画廊','暂无符合条件的公开作品','无法预览','公开作品','我的作品与收藏'],
 'pt-BR':['Decorações','Touch of Magic','Minha Galeria','Exterior','Interior','Móveis','Roupas','Todos','Explorar','Voltar à Galeria','Nenhuma obra pública elegível','Prévia indisponível','Obras públicas','Minhas obras e salvos']
});
export function stage1GalleryCopy(locale='en'){
 const [decorations,tom,mine,outdoor,indoor,furniture,clothing,all,browse,back,empty,unavailable,publicWorks,personalWorks]=messages[locale]??messages.en;
 return Object.freeze({decorations,tom,mine,outdoor,indoor,furniture,clothing,all,browse,back,empty,unavailable,publicWorks,personalWorks});
}
export function stage1GalleryKindAllowed(category,kind){
 const row=STAGE1_GALLERY_PRODUCTS.find(item=>item.id===category);
 return Boolean(row?.kinds?.includes(kind));
}
export function stage1GalleryPublicResults(category,works,filter='all'){
 if(!['decorations','touchOfMagic'].includes(category)||!Array.isArray(works))return [];
 return works.filter(work=>{
  if(!work||typeof work!=='object')return false;
  // Only provider-returned SOURCE-DEFINED Gallery subtype. Unknown/missing facets never relabelled.
  const kind=work.facets?.galleryKind;
  return typeof kind==='string'&&stage1GalleryKindAllowed(category,kind)&&
    (filter==='all'||filter===kind);
 });
}
