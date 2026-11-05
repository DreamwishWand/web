// 06E Product Owner Stage1 Presets IA. No Native code, Community writer or entitlement authority.
export const PRESETS_STAGE1_ROOT_CONTRACT='wand.presets.stage1-root@1';
export const PRESETS_STAGE1_ROOT=Object.freeze(['wand','touchOfMagic','inGame','my']);
export const PRESETS_STAGE1_IN_GAME=Object.freeze(['decorations','shop']);
export const PRESETS_STAGE1_NATIVE_WRITER_ENABLED=false;
export const PRESETS_STAGE1_SHOP_PROVIDER_ENABLED=false;
export const PRESETS_STAGE1_TOM_WRITER_ENABLED=false;
const l=Object.freeze({
 en:['Wand Presets','Touch of Magic','In-Game Presets','My Presets','Decorations','Shop','Back to Presets','In-Game Presets','This surface is not yet available. Verified Native/Provider rights are required.','Browse'],
 fr:['Presets Wand','Touch of Magic','Presets du jeu','Mes Presets','Décorations','Boutique','Retour aux Presets','Presets du jeu','Cette section n’est pas encore disponible. Des droits Native/Provider vérifiés sont nécessaires.','Parcourir'],
 it:['Preset Wand','Touch of Magic','Preset di gioco','I miei Preset','Decorazioni','Negozio','Torna ai Preset','Preset di gioco','Questa sezione non è ancora disponibile. Sono necessari diritti Native/Provider verificati.','Esplora'],
 de:['Wand-Presets','Touch of Magic','In-Game-Presets','Meine Presets','Dekorationen','Shop','Zurück zu Presets','In-Game-Presets','Dieser Bereich ist noch nicht verfügbar. Verifizierte Native-/Provider-Rechte sind erforderlich.','Entdecken'],
 'es-ES':['Presets de Wand','Touch of Magic','Presets del juego','Mis Presets','Decoraciones','Tienda','Volver a Presets','Presets del juego','Esta sección aún no está disponible. Se requieren permisos Native/Provider verificados.','Explorar'],
 ja:['Wandプリセット','Touch of Magic','ゲーム内プリセット','マイプリセット','デコレーション','ショップ','プリセットに戻る','ゲーム内プリセット','この機能は現在利用できません。Native・Providerの検証済み権限が必要です。','閲覧'],
 'zh-CN':['Wand 预设','Touch of Magic','游戏内预设','我的预设','装饰','商店','返回预设','游戏内预设','该功能尚不可用。需要已验证的 Native/Provider 权限。','浏览'],
 'pt-BR':['Presets Wand','Touch of Magic','Presets do jogo','Meus Presets','Decorações','Loja','Voltar aos Presets','Presets do jogo','Esta área ainda não está disponível. Exige direitos Native/Provider verificados.','Explorar']
});
export function presetsStage1Copy(locale='en'){
 const [wand,tom,inGame,my,decorations,shop,back,ingameTitle,unavailable,browse]=l[locale]??l.en;
 return {wand,tom,inGame,my,decorations,shop,back,ingameTitle,unavailable,browse};
}
