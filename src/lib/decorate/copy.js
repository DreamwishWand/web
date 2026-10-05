export const DECORATE_ENTRY_COPY = Object.freeze({
  en:{title:'Decorate',products:'Decorate tools',explore:'Explore',exploreDescription:'Discover the pieces',moodboards:'Moodboards',moodboardsDescription:'Gather your vision',worldEditor:'World Editor',worldEditorDescription:'Shape your world'},
  fr:{title:'Décorer',products:'Outils de décoration',explore:'Explorer',exploreDescription:'Découvrez les éléments',moodboards:'Moodboards',moodboardsDescription:'Rassemblez votre vision',worldEditor:'World Editor',worldEditorDescription:'Façonnez votre monde'},
  it:{title:'Decora',products:'Strumenti di decorazione',explore:'Esplora',exploreDescription:'Scopri gli elementi',moodboards:'Moodboard',moodboardsDescription:'Raccogli la tua visione',worldEditor:'World Editor',worldEditorDescription:'Dai forma al tuo mondo'},
  de:{title:'Dekorieren',products:'Dekorationswerkzeuge',explore:'Entdecken',exploreDescription:'Entdecke die Stücke',moodboards:'Moodboards',moodboardsDescription:'Sammle deine Vision',worldEditor:'World Editor',worldEditorDescription:'Gestalte deine Welt'},
  'es-ES':{title:'Decorar',products:'Herramientas de decoración',explore:'Explorar',exploreDescription:'Descubre las piezas',moodboards:'Moodboards',moodboardsDescription:'Reúne tu visión',worldEditor:'World Editor',worldEditorDescription:'Da forma a tu mundo'},
  ja:{title:'Decorate',products:'飾り付けツール',explore:'Explore',exploreDescription:'飾り付けのピースを見つける',moodboards:'Moodboards',moodboardsDescription:'イメージを集める',worldEditor:'World Editor',worldEditorDescription:'世界を形にする'},
  'zh-CN':{title:'装饰',products:'装饰工具',explore:'探索',exploreDescription:'发现装饰元素',moodboards:'Moodboards',moodboardsDescription:'汇集你的构想',worldEditor:'World Editor',worldEditorDescription:'塑造你的世界'},
  'pt-BR':{title:'Decorar',products:'Ferramentas de decoração',explore:'Explorar',exploreDescription:'Descubra as peças',moodboards:'Moodboards',moodboardsDescription:'Reúna sua visão',worldEditor:'World Editor',worldEditorDescription:'Molde o seu mundo'}
});

export function decorateEntryCopy(locale) {
  return DECORATE_ENTRY_COPY[locale] ?? DECORATE_ENTRY_COPY.en;
}
