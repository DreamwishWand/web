// Owner-closed DreamSnaps Stage1 1–3–1 navigation. Public Community runtime stays OFF.
// No linkage to legacy /gallery/dreamsnaps/, and no user media or private result projection.
export const DREAMSNAPS_STAGE1_ROOT_CONTRACT = 'wand.dreamsnaps.stage1-root@1';
export const DREAMSNAPS_STAGE1_DESTINATIONS = Object.freeze([
  Object.freeze({id:'community',href:'/dreamsnaps/community/',layout:'wide',availability:'gated'}),
  Object.freeze({id:'submit',href:'/dreamsnaps/submit/',layout:'peer'}),
  Object.freeze({id:'judge',href:'/dreamsnaps/judge/',layout:'peer'}),
  Object.freeze({id:'results',href:'/dreamsnaps/results/',layout:'peer'}),
  Object.freeze({id:'my',href:'/dreamsnaps/my/',layout:'wide'})
]);
export const DREAMSNAPS_STAGE1_PUBLIC_PROVIDER_ENABLED = false;
export const DREAMSNAPS_STAGE1_MEDIA_ACCEPTED = false;
export const DREAMSNAPS_STAGE1_WRITER_ENABLED = false;
const labels = Object.freeze({
 en:['Community DreamSnaps','Submit','Judge','Results','My DreamSnaps','Community DreamSnaps browsing is not enabled yet. No public Works or images are loaded here.','All Works','By Challenge','Not available','Return to DreamSnaps'],
 fr:['DreamSnaps de la communauté','Participer','Juger','Résultats','Mes DreamSnaps','La navigation communautaire DreamSnaps n’est pas encore activée. Aucune œuvre ni image publique n’est chargée ici.','Toutes les œuvres','Par défi','Indisponible','Retour à DreamSnaps'],
 it:['DreamSnaps della community','Invia','Giudica','Risultati','I miei DreamSnaps','La consultazione dei DreamSnaps della community non è ancora attiva. Qui non vengono caricati lavori o immagini pubblici.','Tutte le opere','Per sfida','Non disponibile','Torna a DreamSnaps'],
 de:['Community-DreamSnaps','Einreichen','Bewerten','Ergebnisse','Meine DreamSnaps','Das Durchsuchen von Community-DreamSnaps ist noch nicht freigeschaltet. Hier werden keine öffentlichen Werke oder Bilder geladen.','Alle Werke','Nach Herausforderung','Nicht verfügbar','Zurück zu DreamSnaps'],
 'es-ES':['DreamSnaps de la comunidad','Enviar','Juzgar','Resultados','Mis DreamSnaps','La exploración de DreamSnaps de la comunidad aún no está habilitada. Aquí no se cargan obras ni imágenes públicas.','Todas las obras','Por desafío','No disponible','Volver a DreamSnaps'],
 ja:['コミュニティDreamSnaps','応募する','審査する','結果','マイDreamSnaps','コミュニティDreamSnapsの閲覧機能は現在無効です。公開作品や画像は読み込みません。','すべての作品','チャレンジ別','利用できません','DreamSnapsに戻る'],
 'zh-CN':['社区 DreamSnaps','提交','评审','结果','我的 DreamSnaps','社区 DreamSnaps 浏览功能尚未启用。此处不加载任何公开作品或图片。','全部作品','按挑战','暂不可用','返回 DreamSnaps'],
 'pt-BR':['DreamSnaps da comunidade','Enviar','Julgar','Resultados','Meus DreamSnaps','A navegação dos DreamSnaps da comunidade ainda não está ativada. Nenhuma obra ou imagem pública é carregada aqui.','Todas as obras','Por desafio','Indisponível','Voltar ao DreamSnaps']
});
export function dreamsnapsStage1Copy(locale='en'){
 const [community,submit,judge,results,my,unavailable,allWorks,byChallenge,locked,back]=labels[locale]??labels.en;
 return Object.freeze({community,submit,judge,results,my,unavailable,allWorks,byChallenge,locked,back});
}
