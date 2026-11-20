// 08 WEB: display-only filter over an ALREADY manually reopened Scene list.
// Never imports or opens IndexedDB, Scene Store, account data or native Save.
export const LOCAL_SCENE_FILTER_MAX_QUERY=80;
const text=(s,locale)=>String(s).normalize('NFKC').toLocaleLowerCase(locale);
export function filterReopenedLocalScenes(entries,query='',locale='en'){
 if(!Array.isArray(entries))return Object.freeze([]);
 const term=text(String(query).trim().slice(0,LOCAL_SCENE_FILTER_MAX_QUERY),locale);
 if(!term)return entries;
 return entries.filter(e=>e&&typeof e.title==='string'&&text(e.title,locale).includes(term));
}
const rows=Object.freeze({
 en:['Search local Scenes','Clear search','No matching local Scenes. Your saved Scenes were not changed.'],
 ja:['端末内のシーンを検索','検索をクリア','一致するシーンはありません。保存済みシーンは変更されていません。'],
 fr:['Rechercher des scènes locales','Effacer la recherche','Aucune scène locale correspondante. Les scènes enregistrées sont inchangées.'],
 it:['Cerca scene locali','Cancella ricerca','Nessuna scena locale corrispondente. Le scene salvate non sono cambiate.'],
 de:['Lokale Szenen suchen','Suche löschen','Keine passenden lokalen Szenen. Gespeicherte Szenen bleiben unverändert.'],
 'es-ES':['Buscar escenas locales','Borrar búsqueda','No hay escenas locales coincidentes. Las escenas guardadas no se han modificado.'],
 'zh-CN':['搜索本地场景','清除搜索','没有匹配的本地场景。已保存的场景未更改。'],
 'pt-BR':['Pesquisar cenas locais','Limpar pesquisa','Nenhuma cena local correspondente. As cenas salvas não foram alteradas.']
});
const keys=['label','clear','noMatches'];
const copies=Object.freeze(Object.fromEntries(Object.entries(rows).map(([locale,values])=>{
 if(values.length!==keys.length||values.some(s=>typeof s!=='string'||!s.trim()))throw Error('LOCAL_SCENE_FILTER_COPY');
 return [locale,Object.freeze(Object.fromEntries(keys.map((k,i)=>[k,values[i]])))];
})));
export const LOCAL_SCENE_FILTER_LOCALES=Object.freeze(Object.keys(rows));
export function localSceneTitleFilterCopy(locale='en'){return copies[locale]??copies.en;}
