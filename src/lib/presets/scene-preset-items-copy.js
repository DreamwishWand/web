export const SCENE_PRESET_ITEMS_LOCALES=Object.freeze(['en','fr','it','de','es-ES','ja','zh-CN','pt-BR']);
const C=Object.freeze({
en:{title:'Used items',quantity:'Qty',fallback:'Item'},
fr:{title:'Items utilisés',quantity:'Qté',fallback:'Item'},
it:{title:'Item usati',quantity:'Qtà',fallback:'Item'},
de:{title:'Verwendete Items',quantity:'Anzahl',fallback:'Item'},
'es-ES':{title:'Items usados',quantity:'Cant.',fallback:'Item'},
ja:{title:'使用アイテム',quantity:'個数',fallback:'Item'},
'zh-CN':{title:'使用物品',quantity:'数量',fallback:'物品'},
'pt-BR':{title:'Itens usados',quantity:'Qtd.',fallback:'Item'}
});
export function scenePresetItemsCopy(locale){return C[locale]??C.en;}