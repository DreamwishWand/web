const ROWS = {
  en:['Current Scene revision','Inspect current','Owner revision readiness','Inspect readiness','Save Revision unavailable','Current revision','Preset revision','Gallery revision','Current cover','Historical media not available from this read contract','No Gallery cover','Media preview unavailable or expired. Retry to request a fresh link.','Retry cover','Existing Scene selected','Revision update requires a new atomic Backend writer and validated Gallery Cover.','Loading current Scene…','Owner diagnostics only','Historical Gallery references','Known Gallery references','Revision count','Blocked reasons'],
  ja:['Sceneの現行Revision','現行版を確認','所有者のRevision準備状態','準備状態を確認','Save Revisionは利用できません','現行Revision','Preset Revision','Gallery Revision','現行カバー','この読取契約では過去の画像を表示できません','Galleryカバーなし','画像を表示できないか、URLが期限切れです。再試行してください。','カバーを再取得','既存Sceneを選択中','Revision保存にはAtomic Backend Writerと検証済みGalleryカバーが必要です。','現行Sceneを読込中…','所有者向け診断のみ','過去のGallery参照数','確認済みGallery参照数','Revision数','ブロック理由'],
  de:['Aktuelle Scene-Revision','Aktuelle ansehen','Revision-Bereitschaft des Besitzers','Bereitschaft prüfen','Revision speichern nicht verfügbar','Aktuelle Revision','Preset-Revision','Gallery-Revision','Aktuelles Titelbild','Historische Medien nicht verfügbar','Kein Gallery-Titelbild','Medienvorschau ungültig oder abgelaufen. Erneut versuchen.','Titelbild erneut laden','Bestehende Scene ausgewählt','Revision benötigt geprüften atomaren Writer und Gallery-Titelbild.','Lade aktuelle Scene…','Nur Besitzerdiagnose','Historische Gallery-Verweise','Bekannte Gallery-Verweise','Revisionen','Blocker'],
  fr:['Révision Scene actuelle','Voir la révision','État de révision du propriétaire','Vérifier l’état','Enregistrement de révision indisponible','Révision actuelle','Révision Preset','Révision Gallery','Couverture actuelle','Médias historiques non disponibles','Aucune couverture Gallery','Aperçu indisponible ou lien expiré. Réessayez.','Recharger couverture','Scene existante sélectionnée','Révision bloquée sans écriture atomique et couverture validée.','Chargement de la Scene…','Diagnostic propriétaire uniquement','Références Gallery historiques','Références Gallery connues','Nombre de révisions','Blocages'],
  it:['Revisione Scene corrente','Mostra corrente','Stato revisione proprietario','Verifica stato','Salva revisione non disponibile','Revisione corrente','Revisione Preset','Revisione Gallery','Copertina corrente','Media storici non disponibili','Nessuna copertina Gallery','Anteprima non disponibile o URL scaduto. Riprova.','Ricarica copertina','Scene esistente selezionata','Revisione bloccata senza writer atomico e copertina verificata.','Caricamento Scene…','Solo diagnostica proprietario','Riferimenti Gallery storici','Riferimenti Gallery noti','Conteggio revisioni','Blocchi'],
  'es-ES':['Revisión Scene actual','Ver actual','Preparación de revisión del propietario','Comprobar estado','Guardar revisión no disponible','Revisión actual','Revisión Preset','Revisión Gallery','Portada actual','Medios históricos no disponibles','Sin portada Gallery','Vista previa no disponible o enlace caducado. Reintentar.','Recargar portada','Scene existente seleccionada','Revisión requiere escritura atómica y portada Gallery validada.','Cargando Scene…','Solo diagnóstico del propietario','Referencias Gallery históricas','Referencias Gallery conocidas','Número de revisiones','Motivos de bloqueo'],
  'pt-BR':['Revisão Scene atual','Ver atual','Prontidão da revisão do proprietário','Verificar prontidão','Salvar revisão indisponível','Revisão atual','Revisão Preset','Revisão Gallery','Capa atual','Mídia histórica indisponível','Sem capa Gallery','Prévia indisponível ou link expirado. Tente novamente.','Recarregar capa','Scene existente selecionada','Revisão exige writer atômico e capa Gallery validada.','Carregando Scene…','Apenas diagnóstico do proprietário','Referências Gallery históricas','Referências Gallery conhecidas','Número de revisões','Bloqueios'],
  'zh-CN':['当前 Scene 修订','查看当前','所有者修订就绪状态','检查就绪','无法保存修订','当前修订','Preset 修订','Gallery 修订','当前封面','此读取接口不提供历史媒体','无 Gallery 封面','预览不可用或链接已过期，请重试。','重新获取封面','已选择现有 Scene','保存修订需要已验证的原子写入和 Gallery 封面。','正在读取当前 Scene…','仅所有者诊断','历史 Gallery 引用','已知 Gallery 引用','修订数','阻止原因']
};
const KEYS = ['title','inspect','ownerTitle','ownerInspect','saveBlocked','current','presetRevision','galleryRevision','cover','historical','noCover','coverExpired','retryCover','selected','boundary','loading','ownerDiagnostics','historicGallery','galleryReferences','revisionCount','blockers'];
// Owner-only current/retired history diagnostics. No historical media URLs.
const DIAGNOSTIC = {
  en: ['Paired Gallery (owner)', 'Gallery row version (observed)', 'Owner Gallery current revision',
    'Historical edge scope', 'Historical edge SHA-256 (observed)', 'Graph / writer status',
    'Not atomic; writer unavailable', 'Owner vs public revision check',
    'Current media count', 'Unknown / not available', 'Owner diagnostic only'],
  ja: ['関連Gallery（所有者）', 'Gallery行バージョン（観測値）', '所有者側Gallery現行Revision',
    '過去参照集合のScope', '過去参照SHA-256（観測値）', 'Graph / Writer状態',
    '非原子的・書き込み不可', '所有者と公開Revisionの照合',
    '現行画像数', '未取得・確認不可', '所有者専用の診断'],
  de: ['Verknüpfte Gallery (Besitzer)', 'Gallery-Zeilenversion (beobachtet)', 'Gallery-Revision des Besitzers',
    'Umfang historischer Verknüpfungen', 'Historischer SHA-256 (beobachtet)', 'Graph-/Writer-Status',
    'Nicht atomar; Schreiben gesperrt', 'Vergleich Besitzer/öffentlich',
    'Aktuelle Medienanzahl', 'Unbekannt / nicht verfügbar', 'Nur Besitzerdiagnose'],
  fr: ['Gallery liée (propriétaire)', 'Version Gallery observée', 'Révision Gallery du propriétaire',
    'Portée des liens historiques', 'SHA-256 historique observé', 'État graphe / écriture',
    'Non atomique ; écriture bloquée', 'Comparaison propriétaire / public',
    'Nombre de médias actuels', 'Inconnu / indisponible', 'Diagnostic propriétaire uniquement'],
  it: ['Gallery collegata (proprietario)', 'Versione riga Gallery osservata', 'Revisione Gallery proprietario',
    'Ambito collegamenti storici', 'SHA-256 storico osservato', 'Stato grafo / scrittura',
    'Non atomico; scrittura bloccata', 'Confronto proprietario / pubblico',
    'Conteggio media correnti', 'Sconosciuto / non disponibile', 'Solo diagnostica proprietario'],
  'es-ES': ['Gallery vinculada (propietario)', 'Versión de fila Gallery observada', 'Revisión Gallery del propietario',
    'Ámbito de enlaces históricos', 'SHA-256 histórico observado', 'Estado grafo / escritura',
    'No atómico; escritura bloqueada', 'Comparación propietario / público',
    'Número de medios actuales', 'Desconocido / no disponible', 'Solo diagnóstico del propietario'],
  'pt-BR': ['Gallery vinculada (proprietário)', 'Versão da linha Gallery observada', 'Revisão Gallery do proprietário',
    'Escopo de links históricos', 'SHA-256 histórico observado', 'Estado do grafo / escrita',
    'Não atômico; escrita bloqueada', 'Comparação proprietário / público',
    'Quantidade de mídia atual', 'Desconhecido / indisponível', 'Diagnóstico só do proprietário'],
  'zh-CN': ['关联 Gallery（所有者）', 'Gallery 行版本（观察值）', '所有者 Gallery 当前修订',
    '历史关联范围', '历史关联 SHA-256（观察值）', '关系图／写入状态',
    '非原子性；禁止写入', '所有者与公开修订对比',
    '当前媒体数量', '未知／不可用', '仅限所有者诊断']
};
const DIAGNOSTIC_KEYS = ['pairedGalleryOwner','pairedGalleryRowVersion','pairedGalleryCurrentRevision',
  'historicalScope','historicalEdgeSha','graphFence','notAtomic','comparison',
  'currentMediaCount','unknown','diagnosticsOnly'];
export const SCENE_REVISION_COPY_LOCALES = Object.freeze(Object.keys(ROWS));
export function sceneRevisionCopy(locale) {
  const values = ROWS[locale] ?? ROWS.en;
  const diagnostic = DIAGNOSTIC[locale] ?? DIAGNOSTIC.en;
  return Object.fromEntries([
    ...KEYS.map((key,i)=>[key,values[i]]),
    ...DIAGNOSTIC_KEYS.map((key,i)=>[key,diagnostic[i]])
  ]);
}
