// Owner-approved contextual facets; no new Item model or personal-state claims.
export const COLLECTION_STAGE1_COPY = Object.freeze({
  en:{expansion:'Expansion'},
  fr:{expansion:'Extension'},
  it:{expansion:'Espansione'},
  de:{expansion:'Erweiterung'},
  'es-ES':{expansion:'Expansión'},
  ja:{expansion:'拡張コンテンツ'},
  'zh-CN':{expansion:'扩展内容'},
  'pt-BR':{expansion:'Expansão'}
});
export function collectionStage1Copy(locale='en'){return COLLECTION_STAGE1_COPY[locale]??COLLECTION_STAGE1_COPY.en;}
