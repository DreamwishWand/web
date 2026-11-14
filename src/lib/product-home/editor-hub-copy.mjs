// Editor entry copy only; never an operation or release authorization.
const keys=["title","intro","catalogTitle","catalogDetail","catalogAction","worldTitle","worldDetail","worldAction","timingTitle","timingDetail","timingAction","boundary"];
const rows={
  "en": [
    "Editor",
    "Choose a local tool or a design workspace.",
    "Item catalog",
    "Switch v1.25.0 reference catalog · personal inventory not connected.",
    "Browse catalog",
    "World Editor",
    "Arrange a local scene and save a Scene Preset.",
    "Open World Editor",
    "Timing & Spawn Inspector",
    "Nintendo Switch v1.25.3 · local event search, read-only.",
    "Inspect events",
    "Save editing is not available here. No direct save-to-world loading or persistent world changes."
  ],
  "ja": [
    "エディター",
    "ローカルツールやデザイン作業を選びます。",
    "アイテムカタログ",
    "Switch v1.25.0の参照カタログ · 所持情報は未接続。",
    "カタログを開く",
    "ワールドエディター",
    "ローカルのシーンを配置し、シーンプリセットに保存。",
    "ワールドエディターを開く",
    "日時・スポーン検索",
    "Nintendo Switch v1.25.3 · ローカルイベント検索・読取り専用。",
    "イベントを調べる",
    "ここではセーブ編集はできません。実セーブからの直接ワールド読込み・永続的な変更は未対応です。"
  ],
  "fr": [
    "Éditeur",
    "Choisissez un outil local ou un espace de création.",
    "Catalogue d’objets",
    "Catalogue de référence Switch v1.25.0 · inventaire personnel non connecté.",
    "Parcourir le catalogue",
    "Éditeur de monde",
    "Disposez une scène locale et enregistrez un préréglage de scène.",
    "Ouvrir l’éditeur de monde",
    "Inspection des horaires et apparitions",
    "Nintendo Switch v1.25.3 · recherche locale d’événements, en lecture seule.",
    "Inspecter les événements",
    "L’édition des sauvegardes n’est pas disponible ici. Aucun chargement direct du monde ni modification persistante."
  ],
  "it": [
    "Editor",
    "Scegli uno strumento locale o uno spazio di progettazione.",
    "Catalogo oggetti",
    "Catalogo di riferimento Switch v1.25.0 · inventario personale non collegato.",
    "Sfoglia il catalogo",
    "Editor del mondo",
    "Disponi una scena locale e salva un preset della scena.",
    "Apri l’editor del mondo",
    "Orari e apparizioni",
    "Nintendo Switch v1.25.3 · ricerca locale di eventi, in sola lettura.",
    "Esamina gli eventi",
    "Qui non è possibile modificare i salvataggi. Nessun caricamento diretto del mondo o modifica persistente."
  ],
  "de": [
    "Editor",
    "Wähle ein lokales Werkzeug oder einen Gestaltungsbereich.",
    "Objektkatalog",
    "Referenzkatalog für Switch v1.25.0 · persönliches Inventar nicht verbunden.",
    "Katalog durchsuchen",
    "Welteditor",
    "Gestalte eine lokale Szene und speichere eine Szenenvorlage.",
    "Welteditor öffnen",
    "Zeit- und Spawn-Inspektor",
    "Nintendo Switch v1.25.3 · lokale Ereignissuche, nur lesend.",
    "Ereignisse prüfen",
    "Spielstände können hier nicht bearbeitet werden. Kein direktes Laden der Welt oder dauerhafte Weltänderungen."
  ],
  "es-ES": [
    "Editor",
    "Elige una herramienta local o un espacio de diseño.",
    "Catálogo de objetos",
    "Catálogo de referencia de Switch v1.25.0 · inventario personal sin conectar.",
    "Explorar catálogo",
    "Editor del mundo",
    "Organiza una escena local y guarda un preajuste de escena.",
    "Abrir editor del mundo",
    "Inspector de horarios y apariciones",
    "Nintendo Switch v1.25.3 · búsqueda local de eventos, solo lectura.",
    "Inspeccionar eventos",
    "Aquí no se pueden editar partidas guardadas. Sin carga directa del mundo ni cambios persistentes."
  ],
  "zh-CN": [
    "编辑器",
    "选择本地工具或设计工作区。",
    "物品目录",
    "Switch v1.25.0 参考目录 · 尚未连接个人库存。",
    "浏览目录",
    "世界编辑器",
    "布置本地场景并保存为场景预设。",
    "打开世界编辑器",
    "时间与生成检查器",
    "Nintendo Switch v1.25.3 · 本地事件搜索，只读。",
    "查看事件",
    "此处暂不支持编辑存档。无法直接载入存档世界或永久修改世界。"
  ],
  "pt-BR": [
    "Editor",
    "Escolha uma ferramenta local ou um espaço de criação.",
    "Catálogo de itens",
    "Catálogo de referência do Switch v1.25.0 · inventário pessoal não conectado.",
    "Explorar catálogo",
    "Editor de mundo",
    "Organize uma cena local e salve uma predefinição de cena.",
    "Abrir editor de mundo",
    "Inspetor de horários e surgimentos",
    "Nintendo Switch v1.25.3 · busca local de eventos, somente leitura.",
    "Inspecionar eventos",
    "Não é possível editar saves aqui. Sem carregar o mundo diretamente do save nem fazer alterações persistentes."
  ]
};
const copies=Object.freeze(Object.fromEntries(Object.entries(rows).map(([locale,row])=>[locale,Object.freeze(Object.fromEntries(keys.map((key,index)=>[key,row[index]])))])));
export const EDITOR_HUB_LOCALES=Object.freeze(Object.keys(copies));
export function editorHubCopy(locale){return Object.hasOwn(copies,locale)?copies[locale]:copies.en;}
