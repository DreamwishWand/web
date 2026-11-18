// 08 WEB / progressive public beta: presentation ONLY. Never grants SaveSession,
// Writer, Export, Provider, image rights, or an Operation/Build release.
// New Save operations must be authorized by their own accepted Core/Gate contract,
// not by editing a string, query parameter, localStorage or this display model.
export const BETA_EDITOR_PENDING_OPERATIONS=Object.freeze([
  'inventory-quantity',
  'chest-storage',
  'collection-ownership',
  'world-grid',
  'appearance-hair-skin',
  'wardrobe',
  'time-spawn',
  'save-backup-restore'
].map(id=>Object.freeze({id,state:'pending',href:null,writerAuthorized:false})));

const codes=['en','ja','fr','it','de','es-ES','zh-CN','pt-BR'];
const rows={
 en:{
  title:'Editor beta availability',intro:'Use local design and read-only tools now. Save editing is enabled per verified operation and game build, never for an entire category by assumption.',
  local:'Local design',read:'Read-only',test:'Test / scoped',pending:'Not yet available',pendingTitle:'Save editing operations',
  pendingDetail:'These operations cannot edit, export or overwrite a game save from this page. Each will become actionable only after its own accepted Build, safety and release gate.',
  moodboards:'Moodboards',moodboardsDetail:'Create and manage local inspiration boards without a game save.',
  catalogDetail:'Browse verified reference items; no inventory write.',
  worldDetail:'Plan a local scene and save a Scene Preset; this does not write the game world.',
  timingDetail:'Inspect supported local timing data; editing remains unavailable.',
  readerDetail:'Preformal Steam save read test, not general Save editing.',
  collectionDetail:'Scoped Collection test entry, not proof of a public writer.',
  operations:['Inventory / quantity','Chests / storage','Collection / ownership','World / grid placement','Appearance / hair / skin','Wardrobe','Time / spawn edits','Game save backup / restore']
 },
 ja:{
  title:'エディターβ 対応状況',intro:'ローカルデザインと読取り専用機能は利用できます。ゲームのセーブ編集はOperation・Buildごとの受入完了後に個別公開します。',
  local:'ローカルデザイン',read:'読取り専用',test:'試験用・限定',pending:'未対応',pendingTitle:'セーブ編集の対応予定',
  pendingDetail:'以下の項目からゲームのセーブを編集・出力・上書きすることはできません。各OperationのBuild・安全性・公開Gateが成立した項目から個別に利用可能にします。',
  moodboards:'ムードボード',moodboardsDetail:'セーブ不要でローカルのアイデアを作成・管理します。',
  catalogDetail:'ゲーム項目を参照します。インベントリーへの書込みは行いません。',
  worldDetail:'ローカルのシーンを配置しプリセットを保存。ゲーム内ワールドは変更しません。',
  timingDetail:'対応データの日時を読取り専用で調べます。',
  readerDetail:'Steamセーブの正式前読取り試験。一般公開のSave編集ではありません。',
  collectionDetail:'Collectionの限定試験。公開Writerの受入を意味しません。',
  operations:['インベントリー・数量','チェスト・収納','コレクション・所有情報','ワールド・グリッド配置','外見・髪型・スキン','ワードローブ','時間・スポーン編集','ゲームセーブのバックアップ・復元']
 },
 fr:{
  title:'Disponibilité de l’éditeur bêta',intro:'Les outils de création locale et de lecture seule sont utilisables. Chaque opération de sauvegarde exige sa propre validation et version du jeu.',
  local:'Création locale',read:'Lecture seule',test:'Test limité',pending:'Non disponible',pendingTitle:'Édition de sauvegarde',
  pendingDetail:'Ces opérations ne peuvent ni modifier, ni exporter, ni écraser une sauvegarde ici. Chacune nécessite une validation indépendante.',
  moodboards:'Moodboards',moodboardsDetail:'Créer et gérer des idées locales sans sauvegarde.',
  catalogDetail:'Consulter les objets sans écrire dans l’inventaire.',
  worldDetail:'Créer une scène locale et son préréglage sans modifier le monde du jeu.',
  timingDetail:'Consulter les horaires compatibles sans modification.',
  readerDetail:'Test préliminaire de lecture des sauvegardes Steam, pas un éditeur public.',
  collectionDetail:'Test limité de Collection, sans autorisation Writer.',
  operations:['Inventaire et quantité','Coffres et stockage','Collection et propriété','Monde et grille','Apparence, cheveux et peau','Garde-robe','Heures et apparitions','Sauvegarde et restauration du jeu']
 },
 it:{
  title:'Disponibilità Editor beta',intro:'Gli strumenti locali e di sola lettura sono disponibili. Ogni modifica ai salvataggi richiede una verifica per operazione e build.',
  local:'Progettazione locale',read:'Sola lettura',test:'Test limitato',pending:'Non disponibile',pendingTitle:'Modifiche ai salvataggi',
  pendingDetail:'Da qui non puoi modificare, esportare o sovrascrivere il salvataggio. Ogni operazione richiede una propria approvazione.',
  moodboards:'Moodboards',moodboardsDetail:'Crea e gestisci idee locali senza salvataggi.',
  catalogDetail:'Sfoglia oggetti senza scrivere nell’inventario.',
  worldDetail:'Progetta una scena locale e salva un preset, senza modificare il mondo di gioco.',
  timingDetail:'Consulta gli orari supportati senza modifiche.',
  readerDetail:'Lettura sperimentale di salvataggi Steam, non editor pubblico.',
  collectionDetail:'Test limitato Collection, non autorizza Writer.',
  operations:['Inventario e quantità','Bauli e deposito','Collezione e proprietà','Mondo e griglia','Aspetto, capelli e pelle','Guardaroba','Tempo e spawn','Backup e ripristino del salvataggio']
 },
 de:{
  title:'Beta-Editor: Verfügbarkeit',intro:'Lokale Gestaltung und schreibgeschützte Werkzeuge sind nutzbar. Jede Speicherbearbeitung wird je Operation und Build geprüft.',
  local:'Lokale Gestaltung',read:'Nur lesen',test:'Begrenzter Test',pending:'Noch nicht verfügbar',pendingTitle:'Speicherbearbeitungen',
  pendingDetail:'Hier können Spielstände weder bearbeitet, exportiert noch überschrieben werden. Jede Operation braucht eine eigene Freigabe.',
  moodboards:'Moodboards',moodboardsDetail:'Lokale Ideen ohne Spielstand verwalten.',
  catalogDetail:'Gegenstände ansehen, Inventar nicht ändern.',
  worldDetail:'Lokale Szenen und Vorlagen erstellen, Spielwelt unverändert.',
  timingDetail:'Unterstützte Zeiten nur lesen.',
  readerDetail:'Vorläufiger Steam-Lesetest, kein öffentlicher Speichereditor.',
  collectionDetail:'Begrenzter Collection-Test, keine Writer-Freigabe.',
  operations:['Inventar und Menge','Truhen und Lager','Sammlung und Besitz','Welt und Raster','Aussehen, Haare und Haut','Garderobe','Zeit und Spawn','Spielstand sichern und wiederherstellen']
 },
 'es-ES':{
  title:'Disponibilidad del editor beta',intro:'Ya están disponibles el diseño local y las herramientas de solo lectura. Cada operación de guardado requiere aprobación y versión compatible.',
  local:'Diseño local',read:'Solo lectura',test:'Prueba limitada',pending:'No disponible',pendingTitle:'Edición de partidas',
  pendingDetail:'Estas funciones no editan, exportan ni sobrescriben partidas aquí. Cada operación requiere su propia validación.',
  moodboards:'Moodboards',moodboardsDetail:'Crear y gestionar ideas locales sin una partida.',
  catalogDetail:'Consultar objetos sin modificar el inventario.',
  worldDetail:'Diseñar escenas locales y guardar presets sin modificar el mundo.',
  timingDetail:'Consultar horarios compatibles sin cambios.',
  readerDetail:'Prueba previa de lectura de Steam, no edición pública.',
  collectionDetail:'Prueba limitada de Collection, sin permiso Writer.',
  operations:['Inventario y cantidad','Cofres y almacenamiento','Colección y propiedad','Mundo y cuadrícula','Aspecto, cabello y piel','Vestuario','Tiempo y apariciones','Copia y restauración de partidas']
 },
 'zh-CN':{
  title:'编辑器测试版支持情况',intro:'目前可使用本地设计和只读工具。存档编辑必须按具体操作和游戏版本分别通过验证。',
  local:'本地设计',read:'只读',test:'限定测试',pending:'尚未支持',pendingTitle:'存档编辑项目',
  pendingDetail:'此处不能编辑、导出或覆盖游戏存档。每项操作须单独通过版本、安全和发布验证。',
  moodboards:'灵感板',moodboardsDetail:'无需游戏存档即可在本地整理设计灵感。',
  catalogDetail:'浏览物品资料，不修改背包。',
  worldDetail:'创建本地场景和预设，不修改游戏世界。',
  timingDetail:'只读查看受支持的时间数据。',
  readerDetail:'Steam 存档预发布读取测试，不是正式编辑功能。',
  collectionDetail:'Collection 限定测试，不代表 Writer 已获授权。',
  operations:['背包与数量','箱子与仓储','收藏与所有权','世界与网格摆放','外观、发型与皮肤','衣橱','时间与刷新编辑','游戏存档备份与恢复']
 },
 'pt-BR':{
  title:'Disponibilidade do Editor beta',intro:'O design local e as ferramentas somente leitura estão disponíveis. Cada edição de save exige aprovação por operação e versão.',
  local:'Design local',read:'Somente leitura',test:'Teste limitado',pending:'Indisponível',pendingTitle:'Operações de edição de saves',
  pendingDetail:'Estas ações não editam, exportam nem substituem um save aqui. Cada operação precisa de validação independente.',
  moodboards:'Moodboards',moodboardsDetail:'Crie e organize ideias locais sem save.',
  catalogDetail:'Consulte itens sem alterar o inventário.',
  worldDetail:'Crie cenas locais e presets sem alterar o mundo do jogo.',
  timingDetail:'Inspecione dados de tempo sem alterações.',
  readerDetail:'Teste preliminar de leitura Steam, não um editor público.',
  collectionDetail:'Teste limitado da Collection, sem autorização Writer.',
  operations:['Inventário e quantidade','Baús e armazenamento','Coleção e propriedade','Mundo e grade','Aparência, cabelo e pele','Guarda-roupa','Tempo e surgimentos','Backup e restauração de save']
 }
};
export const EDITOR_BETA_LOCALES=Object.freeze(codes);
const copy=Object.freeze(Object.fromEntries(codes.map(code=>{
 const source=rows[code];
 if(!source||source.operations.length!==BETA_EDITOR_PENDING_OPERATIONS.length)throw Error('BETA_EDITOR_LOCALE_MISMATCH');
 return [code,Object.freeze({...source,operations:Object.freeze(source.operations.slice())})];
})));
export function editorBetaCopy(locale){return copy[locale]??copy.en;}
