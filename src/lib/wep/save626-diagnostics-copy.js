/** Switch v1.25.3 Save Read-only diagnostic addendum; no personal Save or ItemDB data. */
const COPY = Object.freeze({
  "en": Object.freeze({
    collectionBoundary: "Collection ownership, collected counts and the v1.25.0 catalog are not validated for v1.25.3. Personal Collection and Apply are unavailable.",
    incompleteDiagnostic: "Some World diagnostic sections are absent. Missing totals are unknown, not zero; this is not a native compatibility verdict.",
    localOnly: "The save is inspected only in this browser. This inspection does not upload or publish its contents."
  }),
  "ja": Object.freeze({
    collectionBoundary: "v1.25.3では所持・収集数やv1.25.0のCollectionカタログの互換性は未検証です。個人別CollectionとApplyは利用できません。",
    incompleteDiagnostic: "World診断の一部が欠けています。未取得件数は0ではなく不明であり、ネイティブ互換性を示すものではありません。",
    localOnly: "セーブはこのブラウザ内でのみ検査されます。内容のアップロードや公開は行いません。"
  }),
  "de": Object.freeze({
    collectionBoundary: "Besitz, Sammelmengen und der Katalog v1.25.0 sind für v1.25.3 nicht validiert. Persönliche Sammlung und Anwenden sind gesperrt.",
    incompleteDiagnostic: "Einige Welt-Diagnosedaten fehlen. Fehlende Werte sind unbekannt, nicht null. Dies ist kein Nachweis nativer Kompatibilität.",
    localOnly: "Die Datei wird nur lokal im Browser geprüft und weder hochgeladen noch veröffentlicht."
  }),
  "fr": Object.freeze({
    collectionBoundary: "La possession, les quantités et le catalogue v1.25.0 ne sont pas validés pour v1.25.3. Collection personnelle et application indisponibles.",
    incompleteDiagnostic: "Certains diagnostics du monde manquent. Les totaux absents sont inconnus, pas zéro. La compatibilité native n'est pas démontrée.",
    localOnly: "La sauvegarde est inspectée dans ce navigateur, sans envoi ni publication."
  }),
  "it": Object.freeze({
    collectionBoundary: "Possesso, quantità e catalogo v1.25.0 non sono validati per v1.25.3. Collezione personale e applicazione disabilitate.",
    incompleteDiagnostic: "Mancano alcuni dati diagnostici del mondo. I totali mancanti sono sconosciuti, non zero. Compatibilità nativa non dimostrata.",
    localOnly: "Il salvataggio viene esaminato solo nel browser, senza upload o pubblicazione."
  }),
  "es-ES": Object.freeze({
    collectionBoundary: "Propiedad, cantidades y catálogo v1.25.0 no están validados para v1.25.3. Colección personal y aplicación deshabilitadas.",
    incompleteDiagnostic: "Faltan datos diagnósticos del mundo. Los valores ausentes son desconocidos, no cero. No demuestran compatibilidad nativa.",
    localOnly: "El archivo se examina solo en el navegador, sin subir ni publicar su contenido."
  }),
  "pt-BR": Object.freeze({
    collectionBoundary: "Posse, quantidades e catálogo v1.25.0 não são validados para v1.25.3. Coleção pessoal e aplicação indisponíveis.",
    incompleteDiagnostic: "Faltam dados diagnósticos do mundo. Valores ausentes são desconhecidos, não zero. Não comprovam compatibilidade nativa.",
    localOnly: "O save é verificado apenas no navegador, sem envio ou publicação de conteúdo."
  }),
  "zh-CN": Object.freeze({
    collectionBoundary: "v1.25.3 的个人拥有、收集数量及 v1.25.0 图鉴兼容性尚未验证。个人图鉴与应用功能不可用。",
    incompleteDiagnostic: "部分世界诊断数据缺失。缺失数量表示未知，而不是零；不代表原生兼容性已通过。",
    localOnly: "存档只在此浏览器中检查，不会上传或公开其内容。"
  })
});
export const SAVE626_DIAGNOSTIC_LOCALES = Object.freeze(Object.keys(COPY));
export function save626DiagnosticCopy(locale) {return COPY[locale] ?? COPY.en;}
