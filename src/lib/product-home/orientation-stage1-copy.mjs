// 08 WEB: HOME-UX-23..27 orientation purpose/first-step, NOT Home dashboard.
// Guidance describes product intent only. No availability, Provider, Writer or media claim.
const PRODUCT_KEYS = Object.freeze(["decorate","collection","guide","presets","gallery","dreamsnaps","help"]);
const ORIENTATION_COPY = Object.freeze({
  "en": {
    "intro": "Dreamwish Wand is a home for discovering DDV ideas, organizing creative references, learning game systems, and using supported local tools. Choose a product below to begin.",
    "start": "Where to start",
    "purpose": "What it helps you do",
    "action": "Open product",
    "scope": "Availability depends on the feature",
    "seeStatus": "Check supported features and versions",
    "accountTitle": "Account is optional to explore",
    "account": "You can enter Wand and browse supported public or local information without signing in. Contributing, managing account-linked content, and private spaces require their own authorization.",
    "saveTitle": "A DDV save is optional",
    "save": "Browsing does not require a save. Local saves remain on your device and are never uploaded automatically. Editing and exporting an edited copy stay disabled until the exact version and operation are verified; always preserve the original.",
    "supportTitle": "When a feature is unavailable",
    "support": "A visible product card is not a publication or writer permission. Data, media rights, versions, and Community operations have separate acceptance gates. Check the current availability list before relying on a feature.",
    "products": [
      [
        "Explore decoration items, gather references in Moodboards, then work in the World Editor where supported.",
        "Begin with Explore or create a local Moodboard."
      ],
      [
        "Browse categories and item details. Personal Owned/Missing data is shown only when compatible save evidence exists.",
        "Open Collection and choose an item category."
      ],
      [
        "Navigate Quests, Star Paths, Events, and Systems as distinct knowledge areas. Community Issues belong in Help Center.",
        "Open Guide and choose a topic."
      ],
      [
        "Find reusable creative layouts and inspect which preset operations are supported for the current version.",
        "Open Presets and check the available sections."
      ],
      [
        "Discover noncompetitive creative works. Public Works and media appear only when rights and visibility permit.",
        "Open Gallery and inspect permitted public areas."
      ],
      [
        "Navigate Community, Submit, Judge, Results, and your own DreamSnaps with competition privacy preserved.",
        "Open DreamSnaps and check the available phase."
      ],
      [
        "Find Questions, Tips, and Issues, plus your own activity. Posting requires a permitted account.",
        "Open Community Help Center and choose Questions, Tips, or Issues."
      ]
    ]
  },
  "ja": {
    "intro": "Dreamwish Wandは、DDVのアイデア探し、創作資料の整理、ゲームの知識、対応済みのローカルツールを一か所で扱う場所です。まず使いたいプロダクトを選びます。",
    "start": "最初の操作",
    "purpose": "できること",
    "action": "プロダクトを開く",
    "scope": "機能によって利用条件が異なります",
    "seeStatus": "利用可能な機能・対応バージョンを確認",
    "accountTitle": "閲覧にアカウントは不要",
    "account": "Wandへのアクセスや対応済みの公開・ローカル情報の閲覧は、サインインせずに始められます。投稿、アカウントに紐づく管理、非公開領域には個別の認可が必要です。",
    "saveTitle": "DDVのセーブも必須ではありません",
    "save": "閲覧にはセーブは不要です。ローカルセーブは端末内で扱い、自動でCloudへアップロードしません。編集・別名コピーの書き出しは、対応バージョンと操作が検証されるまで無効です。原本を保管してください。",
    "supportTitle": "利用できない機能がある場合",
    "support": "プロダクトへの入口があっても、公開やセーブの書き込みが許可されたわけではありません。データ、画像の権利、ゲームのバージョン、Community機能には別の受入条件があります。",
    "products": [
      [
        "家具や装飾を探し、Moodboardでアイデアを整理し、対応済みの範囲でWorld Editorにつなげます。",
        "Exploreから探すか、ローカルMoodboardを作成します。"
      ],
      [
        "カテゴリ別にアイテム情報を確認します。所持・未所持は、対応するセーブの根拠が確認できる場合に限り表示します。",
        "Collectionを開き、カテゴリを選びます。"
      ],
      [
        "Quests・Star Paths・Events・Systemsの4つの知識領域を探します。Communityの問題報告はHelp Centerの担当です。",
        "Guideを開き、知りたい分野を選びます。"
      ],
      [
        "創作レイアウトの再利用を探し、バージョン別に利用できるプリセット操作を確認します。",
        "Presetsを開き、利用できる項目を確認します。"
      ],
      [
        "競争を伴わない創作作品を探します。公開作品と画像は権利・公開範囲が認める場合のみ表示します。",
        "Galleryを開き、閲覧できる領域を確認します。"
      ],
      [
        "Community・応募・審査・結果・自分のDreamSnapsへ進みます。投票期間中のプライバシーは維持します。",
        "DreamSnapsを開き、利用できる段階を確認します。"
      ],
      [
        "質問・ヒント・問題と自分のアクティビティを扱います。投稿には認可済みのアカウントが必要です。",
        "Community Help Centerから質問・ヒント・問題を選びます。"
      ]
    ]
  },
  "fr": {
    "intro": "Dreamwish Wand réunit les idées DDV, les références créatives, les connaissances du jeu et les outils locaux pris en charge. Choisissez un espace pour commencer.",
    "start": "Pour commencer",
    "purpose": "À quoi sert cet espace",
    "action": "Ouvrir",
    "scope": "La disponibilité dépend de chaque fonction",
    "seeStatus": "Vérifier les fonctions et versions",
    "accountTitle": "Explorer sans compte",
    "account": "L’accès et la consultation des données publiques ou locales prises en charge ne nécessitent pas de connexion. Publier et gérer du contenu lié à un compte requiert des autorisations distinctes.",
    "saveTitle": "Aucune sauvegarde DDV requise pour explorer",
    "save": "La consultation ne nécessite pas de sauvegarde. Les fichiers locaux restent sur votre appareil, sans transfert automatique vers le Cloud. La modification et l’export d’une copie restent bloqués avant vérification de la version et de l’opération. Conservez l’original.",
    "supportTitle": "Fonctions indisponibles",
    "support": "Une carte visible n’autorise ni la publication ni l’écriture. Les données, droits des images, versions et fonctions communautaires ont des contrôles distincts.",
    "products": [
      [
        "Rechercher des décorations, préparer des Moodboards et utiliser World Editor lorsque cela est autorisé.",
        "Commencez par Explore ou un Moodboard local."
      ],
      [
        "Parcourir catégories et détails d’objets. Possédé/Manquant dépend de preuves de sauvegarde compatibles.",
        "Ouvrez Collection et choisissez une catégorie."
      ],
      [
        "Consulter Quêtes, Voies des étoiles, Événements et Systèmes; les problèmes communautaires relèvent du Help Center.",
        "Ouvrez Guide et choisissez un thème."
      ],
      [
        "Découvrir des compositions réutilisables et vérifier les opérations de preset disponibles.",
        "Ouvrez Presets et vérifiez les sections."
      ],
      [
        "Explorer les œuvres créatives non compétitives sous réserve des droits et de la visibilité.",
        "Ouvrez Gallery et ses espaces autorisés."
      ],
      [
        "Accéder à Community, Participer, Juger, Résultats et Mes DreamSnaps sans exposer les votes privés.",
        "Ouvrez DreamSnaps et consultez la phase disponible."
      ],
      [
        "Trouver Questions, Conseils, Problèmes et votre activité; publier demande un compte autorisé.",
        "Ouvrez Community Help Center et choisissez un sujet."
      ]
    ]
  },
  "it": {
    "intro": "Dreamwish Wand raccoglie idee DDV, riferimenti creativi, conoscenze di gioco e strumenti locali supportati. Scegli un’area per iniziare.",
    "start": "Come iniziare",
    "purpose": "Cosa puoi fare",
    "action": "Apri",
    "scope": "La disponibilità varia per funzione",
    "seeStatus": "Controlla funzioni e versioni",
    "accountTitle": "Esplora senza account",
    "account": "Puoi accedere e consultare informazioni pubbliche o locali supportate senza effettuare l’accesso. Pubblicazione e gestione di contenuti personali richiedono autorizzazioni specifiche.",
    "saveTitle": "Non serve un salvataggio DDV per esplorare",
    "save": "La consultazione non richiede un salvataggio. I file locali restano sul dispositivo, senza upload Cloud automatico. Modifica ed esportazione di una copia restano bloccate finché versione e operazione non sono verificate. Conserva l’originale.",
    "supportTitle": "Funzioni non disponibili",
    "support": "Una sezione visibile non autorizza pubblicazione o scrittura. Dati, diritti delle immagini, versioni e Community hanno verifiche separate.",
    "products": [
      [
        "Scopri decorazioni, organizza Moodboard e usa World Editor dove supportato.",
        "Inizia da Explore o crea un Moodboard locale."
      ],
      [
        "Sfoglia categorie e dettagli. Posseduto/Mancante richiede una fonte di salvataggio compatibile.",
        "Apri Collection e scegli una categoria."
      ],
      [
        "Consulta Missioni, Percorsi Stellari, Eventi e Sistemi; i problemi della Community sono nel Help Center.",
        "Apri Guide e scegli un argomento."
      ],
      [
        "Scopri composizioni riutilizzabili e controlla le operazioni preset supportate.",
        "Apri Presets e le sezioni disponibili."
      ],
      [
        "Sfoglia opere creative non competitive solo quando visibilità e diritti lo consentono.",
        "Apri Gallery e gli spazi consentiti."
      ],
      [
        "Accedi a Community, Invia, Giudica, Risultati e ai tuoi DreamSnaps rispettando la privacy del voto.",
        "Apri DreamSnaps e verifica la fase disponibile."
      ],
      [
        "Consulta Domande, Consigli, Problemi e attività personali; per pubblicare serve un account autorizzato.",
        "Apri Community Help Center e scegli una sezione."
      ]
    ]
  },
  "de": {
    "intro": "Dreamwish Wand verbindet DDV-Ideen, kreative Sammlungen, Spielwissen und unterstützte lokale Werkzeuge. Wähle einen Bereich zum Einstieg.",
    "start": "Erster Schritt",
    "purpose": "Wofür es gedacht ist",
    "action": "Produkt öffnen",
    "scope": "Verfügbarkeit ist funktionsabhängig",
    "seeStatus": "Funktionen und Versionen prüfen",
    "accountTitle": "Ohne Konto erkunden",
    "account": "Wand und unterstützte öffentliche oder lokale Informationen lassen sich ohne Anmeldung erkunden. Beiträge und die Verwaltung kontogebundener Inhalte benötigen eigene Berechtigungen.",
    "saveTitle": "Zum Erkunden ist kein DDV-Spielstand nötig",
    "save": "Zum Lesen ist kein Spielstand erforderlich. Lokale Dateien bleiben auf deinem Gerät; es gibt keinen automatischen Cloud-Upload. Änderungen und Export einer Kopie bleiben gesperrt, bis Version und Vorgang verifiziert sind. Bewahre das Original auf.",
    "supportTitle": "Nicht verfügbare Funktionen",
    "support": "Ein sichtbarer Produktbereich ist keine Freigabe für Veröffentlichung oder Schreiben. Daten, Bildrechte, Versionen und Community-Dienste haben eigene Freigaben.",
    "products": [
      [
        "Dekorationen entdecken, Moodboards sammeln und den World Editor nur im unterstützten Umfang verwenden.",
        "Beginne mit Explore oder einem lokalen Moodboard."
      ],
      [
        "Kategorien und Objektdetails durchsehen. Besitzstatus braucht einen kompatiblen Spielstandsnachweis.",
        "Öffne Collection und wähle eine Kategorie."
      ],
      [
        "Quests, Sternenpfade, Events und Systeme erkunden; Community-Probleme gehören ins Help Center.",
        "Öffne Guide und wähle ein Thema."
      ],
      [
        "Wiederverwendbare Layouts finden und unterstützte Preset-Vorgänge prüfen.",
        "Öffne Presets und verfügbare Bereiche."
      ],
      [
        "Nichtkompetitive kreative Werke nur mit passenden Sichtbarkeits- und Bildrechten sehen.",
        "Öffne Gallery und freigegebene Bereiche."
      ],
      [
        "Community, Einreichen, Bewerten, Ergebnisse und eigene DreamSnaps unter Wahrung der Abstimmungsprivatsphäre nutzen.",
        "Öffne DreamSnaps und prüfe die aktuelle Phase."
      ],
      [
        "Fragen, Tipps, Probleme und eigene Aktivitäten finden; Beiträge erfordern ein berechtigtes Konto.",
        "Öffne Community Help Center und wähle einen Bereich."
      ]
    ]
  },
  "es-ES": {
    "intro": "Dreamwish Wand reúne ideas de DDV, referencias creativas, conocimientos del juego y herramientas locales compatibles. Elige un área para comenzar.",
    "start": "Primer paso",
    "purpose": "Para qué sirve",
    "action": "Abrir producto",
    "scope": "La disponibilidad varía según la función",
    "seeStatus": "Consultar funciones y versiones",
    "accountTitle": "Explora sin cuenta",
    "account": "Puedes acceder a Wand y consultar información pública o local compatible sin iniciar sesión. Publicar y gestionar contenidos vinculados a una cuenta requiere autorización específica.",
    "saveTitle": "No necesitas una partida DDV para explorar",
    "save": "La consulta no requiere partida. Los archivos locales permanecen en tu dispositivo y no se suben automáticamente a Cloud. La edición y exportación de una copia siguen bloqueadas hasta verificar la versión y la operación. Conserva el original.",
    "supportTitle": "Funciones no disponibles",
    "support": "Una tarjeta visible no autoriza publicar ni escribir. Datos, derechos de imágenes, versiones y funciones comunitarias tienen controles independientes.",
    "products": [
      [
        "Explora decoración, reúne ideas en Moodboards y usa World Editor cuando esté permitido.",
        "Empieza con Explore o crea un Moodboard local."
      ],
      [
        "Consulta categorías y detalles. Propio/Faltante necesita pruebas de partida compatibles.",
        "Abre Collection y elige una categoría."
      ],
      [
        "Encuentra Misiones, Rutas Estelares, Eventos y Sistemas; los problemas comunitarios pertenecen a Help Center.",
        "Abre Guide y elige un tema."
      ],
      [
        "Descubre diseños reutilizables y consulta qué operaciones Presets están disponibles.",
        "Abre Presets y revisa sus secciones."
      ],
      [
        "Explora obras no competitivas solo cuando sus derechos y visibilidad lo permitan.",
        "Abre Gallery y sus áreas autorizadas."
      ],
      [
        "Accede a Comunidad, Enviar, Juzgar, Resultados y tus DreamSnaps con privacidad durante la votación.",
        "Abre DreamSnaps y comprueba la fase disponible."
      ],
      [
        "Busca Preguntas, Consejos, Problemas y tu actividad; publicar requiere una cuenta autorizada.",
        "Abre Community Help Center y elige un tema."
      ]
    ]
  },
  "zh-CN": {
    "intro": "Dreamwish Wand 汇集 DDV 创作灵感、参考收藏、游戏知识与已支持的本地工具。选择一个产品开始。",
    "start": "从这里开始",
    "purpose": "可以做什么",
    "action": "打开产品",
    "scope": "功能可用性取决于具体条件",
    "seeStatus": "查看可用功能与版本",
    "accountTitle": "无需账号即可探索",
    "account": "浏览 Wand 和已支持的公开或本地信息不需要登录。发布内容及管理绑定账号的空间需要单独授权。",
    "saveTitle": "浏览不需要 DDV 存档",
    "save": "浏览不需要存档。本地存档留在你的设备中，不会自动上传到云端。编辑及导出副本须在版本和操作完成验证后才开放，请保留原始文件。",
    "supportTitle": "功能暂不可用时",
    "support": "看到产品入口并不等于获得发布或写入权限。数据、图像版权、游戏版本和社区功能分别受验证限制。",
    "products": [
      [
        "发现装饰物，整理 Moodboard 参考，并在支持范围内使用 World Editor。",
        "从 Explore 或本地 Moodboard 开始。"
      ],
      [
        "按分类查看物品详情。拥有/缺少状态须有兼容的存档证据。",
        "打开 Collection 并选择分类。"
      ],
      [
        "浏览任务、星路、活动和系统知识；社区问题归 Help Center 管理。",
        "打开 Guide 并选择主题。"
      ],
      [
        "探索可复用的设计布局，并查看哪些预设操作得到支持。",
        "打开 Presets 并检查可用区域。"
      ],
      [
        "仅在版权和可见性允许时浏览非竞赛的创作作品。",
        "打开 Gallery 并查看允许的区域。"
      ],
      [
        "进入社区、提交、评审、结果和个人 DreamSnaps，保护投票期隐私。",
        "打开 DreamSnaps 并查看当前可用阶段。"
      ],
      [
        "查找问题、技巧、故障和个人活动；发布内容需要授权账号。",
        "打开 Community Help Center 并选择栏目。"
      ]
    ]
  },
  "pt-BR": {
    "intro": "Dreamwish Wand reúne ideias de DDV, referências criativas, conhecimentos do jogo e ferramentas locais compatíveis. Escolha uma área para começar.",
    "start": "Por onde começar",
    "purpose": "O que você pode fazer",
    "action": "Abrir produto",
    "scope": "Disponibilidade varia por recurso",
    "seeStatus": "Ver recursos e versões disponíveis",
    "accountTitle": "Explore sem conta",
    "account": "Você pode entrar no Wand e consultar informações públicas ou locais compatíveis sem fazer login. Publicar e administrar conteúdo vinculado a uma conta exigem autorização própria.",
    "saveTitle": "Não é necessário um save DDV para explorar",
    "save": "A navegação não requer save. Os arquivos locais permanecem no dispositivo, sem upload automático para a Cloud. A edição e exportação de cópia ficam bloqueadas até confirmar versão e operação. Guarde o original.",
    "supportTitle": "Quando um recurso não está disponível",
    "support": "A presença de um cartão não autoriza publicação ou gravação. Dados, direitos das imagens, versões e recursos da comunidade têm verificações independentes.",
    "products": [
      [
        "Descubra decorações, organize referências em Moodboards e use World Editor apenas quando permitido.",
        "Comece pelo Explore ou crie um Moodboard local."
      ],
      [
        "Explore categorias e detalhes. Owned/Missing precisa de evidência de save compatível.",
        "Abra Collection e escolha uma categoria."
      ],
      [
        "Consulte Quests, Star Paths, Events e Systems; Issues da comunidade ficam no Help Center.",
        "Abra Guide e escolha um tema."
      ],
      [
        "Encontre layouts reutilizáveis e confira quais operações de preset são compatíveis.",
        "Abra Presets e verifique as seções disponíveis."
      ],
      [
        "Explore obras não competitivas somente quando direitos e visibilidade permitirem.",
        "Abra Gallery e os espaços permitidos."
      ],
      [
        "Acesse Community, Submit, Judge, Results e seus DreamSnaps sem expor votos privados.",
        "Abra DreamSnaps e confira a fase disponível."
      ],
      [
        "Encontre Questions, Tips, Issues e suas atividades; publicar requer uma conta autorizada.",
        "Abra Community Help Center e escolha uma seção."
      ]
    ]
  }
});
export const ORIENTATION_DESTINATIONS = Object.freeze([
  '/decorate/','/collection/','/guide/','/presets/','/gallery/','/dreamsnaps/','/help/'
]);
export function orientationCopy(locale='en'){
 const source=ORIENTATION_COPY[locale]??ORIENTATION_COPY.en;
 return {...source,products:source.products.map((pair,i)=>Object.freeze({
   id:PRODUCT_KEYS[i],path:ORIENTATION_DESTINATIONS[i],purpose:pair[0],step:pair[1]
 }))};
}
