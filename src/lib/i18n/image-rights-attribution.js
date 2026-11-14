// Public copy only, from 07 DBK operator notice draft. No operator receipt,
// contact, licence evidence or publication authority is bundled here.
import {FALLBACK_LOCALE,normalizeLocale} from './registry.js';
export const IMAGE_RIGHTS_ATTRIBUTION=Object.freeze({
  "en": "Dreamwish Wand is an unofficial fan service, not affiliated with or endorsed by Disney or Gameloft. Disney Dreamlight Valley, its names, characters, item artwork and images belong to Disney, Gameloft and/or other respective rights holders. Images are shown to identify in-game items; attribution does not mean permission or endorsement.",
  "de": "Dreamwish Wand ist ein inoffizieller Fan-Dienst und weder mit Disney oder Gameloft verbunden noch von ihnen unterstützt. Disney Dreamlight Valley, Namen, Figuren, Gegenstandsgrafiken und Bilder gehören Disney, Gameloft beziehungsweise den jeweiligen Rechteinhabern. Die Bilder dienen der Identifikation von Spielgegenständen; die Nennung der Rechteinhaber bedeutet keine Genehmigung.",
  "es-ES": "Dreamwish Wand es un servicio no oficial creado por fans y no está afiliado ni respaldado por Disney o Gameloft. Disney Dreamlight Valley, sus nombres, personajes, ilustraciones de objetos e imágenes pertenecen a Disney, Gameloft o a sus respectivos titulares de derechos. Las imágenes sirven para identificar objetos del juego; esta atribución no implica autorización.",
  "fr": "Dreamwish Wand est un service de fans non officiel, sans affiliation ni approbation de Disney ou Gameloft. Disney Dreamlight Valley, ses noms, personnages, illustrations d'objets et images appartiennent à Disney, Gameloft ou aux titulaires des droits concernés. Les images servent à identifier des objets du jeu ; cette attribution ne constitue pas une autorisation.",
  "it": "Dreamwish Wand è un servizio non ufficiale creato dai fan, non affiliato né approvato da Disney o Gameloft. Disney Dreamlight Valley, i suoi nomi, personaggi, illustrazioni degli oggetti e immagini appartengono a Disney, Gameloft o ai rispettivi titolari dei diritti. Le immagini servono a identificare gli oggetti di gioco; l'attribuzione non costituisce un'autorizzazione.",
  "ja": "Dreamwish Wandは非公式のファンサービスであり、DisneyまたはGameloftと提携・協賛・公認の関係にはありません。Disney Dreamlight Valleyの名称・キャラクター・ゲーム内アイテム画像・アートワーク等の権利はDisney、Gameloft、その他の各権利者に帰属します。画像はゲーム内アイテムの識別を目的として表示します。権利表示は画像使用の許諾を意味しません。",
  "pt-BR": "Dreamwish Wand é um serviço não oficial de fãs, sem afiliação ou endosso da Disney ou da Gameloft. Disney Dreamlight Valley, seus nomes, personagens, artes de itens e imagens pertencem à Disney, à Gameloft ou aos respectivos titulares dos direitos. As imagens identificam itens do jogo; a atribuição não constitui autorização de uso.",
  "zh-CN": "Dreamwish Wand 是非官方粉丝服务，与 Disney 或 Gameloft 没有关联，也未获得其认可或赞助。Disney Dreamlight Valley 的名称、角色、游戏物品插画和图片归 Disney、Gameloft 或其他相应权利人所有。图片仅用于识别游戏内物品；署名不代表获得使用授权。"
});
export function imageRightsAttribution(locale){
 return IMAGE_RIGHTS_ATTRIBUTION[normalizeLocale(locale)??FALLBACK_LOCALE];
}
