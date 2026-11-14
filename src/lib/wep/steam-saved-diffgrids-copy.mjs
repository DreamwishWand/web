// Read-only Steam saved DiffGrids labels; unrelated to Native layout/ownership.
export const STEAM_DIFFGRIDS_LOCALES=Object.freeze([
  'en','fr','it','de','es-ES','ja','zh-CN','pt-BR'
]);
const labels={
 'en':['Saved grid metadata','Optional local save inspection','Nothing is read until you explicitly choose an encrypted Steam P1G. No upload, cloud backup, edit or apply.','Local encrypted Steam P1G','Observed Steam FullVersion','Original file SHA-256 (computed outside the save)','I independently checked the installed Steam version and original SHA-256.','Open read-only','Read next 8','Close local session','Local save reading is currently unavailable. Explicit enablement and successful runtime verification are required. No local save is read while this feature is unavailable.','Ready for local selection','Opening and validating locally…','Reading saved grid metadata…','Local read denied; session closed.','No save selected','Saved DiffGrids','Grid ID','Modified','Removed','In both','External layout','Unresolved','Page','Stored metadata only; Native layout, GridID 0 validity, ownership and editing remain unverified.','No saved grids','Read-only; Writer, Apply and Cloud are disabled.','Steam 1.25.3 · Pre-release read-only test'],
 'fr':['Métadonnées des grilles sauvegardées','Inspection locale facultative','Rien n’est lu avant la sélection explicite d’un P1G Steam chiffré. Aucun envoi, sauvegarde cloud ou modification.','P1G Steam chiffré local','Version complète Steam observée','SHA-256 du fichier original (calculé hors de la sauvegarde)','J’ai vérifié séparément la version Steam installée et le SHA-256 original.','Ouvrir en lecture seule','Lire les 8 suivants','Fermer la session locale','La lecture locale des sauvegardes est actuellement indisponible. Une activation explicite et une vérification réussie à l’exécution sont nécessaires. Aucune sauvegarde locale n’est lue tant que cette fonction est indisponible.','Prêt pour une sélection locale','Ouverture et validation locales…','Lecture des métadonnées…','Lecture refusée ; session fermée.','Aucune sauvegarde sélectionnée','DiffGrids sauvegardés','ID grille','Modifiés','Supprimés','Communs','Disposition externe','Non résolue','Page','Métadonnées uniquement ; disposition Native, GridID 0, possession et modification non vérifiés.','Aucune grille sauvegardée','Lecture seule ; écriture, application et cloud désactivés.','Steam 1.25.3 · Test en lecture seule avant publication'],
 'it':['Metadati delle griglie salvate','Ispezione locale facoltativa','Nessuna lettura prima di selezionare un P1G Steam cifrato. Nessun upload, cloud o modifica.','P1G Steam cifrato locale','Versione completa Steam osservata','SHA-256 del file originale (calcolato esternamente)','Ho verificato separatamente la versione Steam installata e lo SHA-256 originale.','Apri in sola lettura','Leggi altri 8','Chiudi sessione locale','La lettura locale dei salvataggi non è al momento disponibile. Sono necessarie l’attivazione esplicita e la verifica riuscita in fase di esecuzione. Finché la funzione non è disponibile, non viene letto alcun salvataggio locale.','Pronto per la selezione locale','Apertura e convalida locale…','Lettura dei metadati…','Lettura rifiutata; sessione chiusa.','Nessun salvataggio selezionato','DiffGrids salvati','ID griglia','Modificati','Rimossi','Comuni','Layout esterno','Non risolto','Pagina','Solo metadati; layout Native, validità GridID 0, proprietà e modifica non verificati.','Nessuna griglia salvata','Sola lettura; scrittura, applicazione e cloud disattivati.','Steam 1.25.3 · Test in sola lettura prima del rilascio'],
 'de':['Gespeicherte Gitter-Metadaten','Optionale lokale Prüfung','Erst nach ausdrücklicher Auswahl einer verschlüsselten Steam-P1G-Datei wird gelesen. Kein Upload, Cloud-Backup oder Bearbeiten.','Lokale verschlüsselte Steam-P1G','Beobachtete Steam-Vollversion','SHA-256 der Originaldatei (extern berechnet)','Ich habe installierte Steam-Version und Original-SHA-256 unabhängig geprüft.','Schreibgeschützt öffnen','Nächste 8 lesen','Lokale Sitzung schließen','Das lokale Lesen von Spielständen ist derzeit nicht verfügbar. Eine ausdrückliche Aktivierung und eine erfolgreiche Laufzeitprüfung sind erforderlich. Solange diese Funktion nicht verfügbar ist, wird kein lokaler Spielstand gelesen.','Bereit für lokale Auswahl','Lokales Öffnen und Prüfen…','Metadaten werden gelesen…','Lesen verweigert; Sitzung geschlossen.','Kein Spielstand gewählt','Gespeicherte DiffGrids','Gitter-ID','Geändert','Entfernt','Beide','Externes Layout','Ungeklärt','Seite','Nur Metadaten; Native-Layout, GridID 0, Besitz und Bearbeitung sind ungeprüft.','Keine gespeicherten Gitter','Schreibgeschützt; Writer, Apply und Cloud aus.','Steam 1.25.3 · Schreibgeschützter Vorabtest'],
 'es-ES':['Metadatos de cuadrículas guardadas','Inspección local opcional','No se lee nada hasta elegir un P1G cifrado de Steam. Sin subidas, copia en nube ni edición.','P1G cifrado local de Steam','Versión completa observada de Steam','SHA-256 del archivo original (calculado externamente)','He comprobado por separado la versión instalada de Steam y el SHA-256 original.','Abrir solo lectura','Leer otros 8','Cerrar sesión local','La lectura local de partidas guardadas no está disponible en este momento. Se requieren una activación explícita y una verificación correcta en tiempo de ejecución. Mientras esta función no esté disponible, no se lee ninguna partida guardada local.','Listo para elegir archivo local','Abriendo y validando localmente…','Leyendo metadatos…','Lectura rechazada; sesión cerrada.','Ningún guardado seleccionado','DiffGrids guardados','ID de cuadrícula','Modificados','Eliminados','Ambos','Diseño externo','Sin resolver','Página','Solo metadatos; diseño Native, GridID 0, propiedad y edición sin verificar.','No hay cuadrículas guardadas','Solo lectura; Writer, Apply y nube desactivados.','Steam 1.25.3 · Prueba de solo lectura previa al lanzamiento'],
 'ja':['保存済みグリッドのメタデータ','任意のローカルセーブ確認','暗号化されたSteam P1Gを手動選択するまで読み込みません。アップロード・クラウドバックアップ・編集・適用はしません。','ローカルの暗号化Steam P1G','別途確認したSteam FullVersion','原本ファイルのSHA-256（セーブとは別に算出）','インストール済みSteamバージョンと原本SHA-256を別途確認しました。','読み取り専用で開く','次の8件を読む','ローカルセッションを閉じる','現在、ローカルセーブの読み取りは利用できません。明示的な有効化と実行時検証の成功が必要です。この機能を利用できない間は、ローカルセーブを読み取りません。','ローカルファイル選択が可能です','端末内で開いて検証中…','保存済みメタデータを読み取り中…','読み取りを拒否し、セッションを閉じました。','セーブ未選択','保存済みDiffGrids','GridID','変更数','削除数','重複数','外部Layout','未解決','ページ','保存値のメタデータのみ。Native Layout、GridID 0の合法性、所有権、編集可否は未検証です。','保存済みグリッドなし','読み取り専用。Writer・Apply・Cloudは無効です。','Steam 1.25.3 · 正式リリース前の読み取り専用テスト'],
 'zh-CN':['已保存网格元数据','可选的本地存档检查','仅在手动选择加密 Steam P1G 后读取；不会上传、云备份、编辑或应用。','本地加密 Steam P1G','已独立确认的 Steam 完整版本','原始文件 SHA-256（在存档外计算）','我已分别确认安装的 Steam 版本和原始 SHA-256。','以只读方式打开','读取下 8 项','关闭本地会话','目前无法在本地读取存档。需要明确启用此功能并通过运行时验证。此功能不可用时，不会读取本地存档。','可选择本地文件','正在本地打开和验证…','正在读取元数据…','读取被拒绝；会话已关闭。','未选择存档','已保存 DiffGrids','网格 ID','修改数','移除数','重叠数','外部布局','未解析','页','仅显示存储的元数据；Native 布局、GridID 0 合法性、拥有状态和编辑均未验证。','没有已保存的网格','只读；写入、应用和云功能已关闭。','Steam 1.25.3 · 正式发布前只读测试'],
 'pt-BR':['Metadados de grades salvas','Inspeção local opcional','A leitura só começa após selecionar manualmente um P1G Steam criptografado. Sem upload, nuvem ou edição.','P1G Steam criptografado local','Versão completa do Steam observada','SHA-256 do arquivo original (calculado externamente)','Confirmei separadamente a versão Steam instalada e o SHA-256 original.','Abrir somente leitura','Ler mais 8','Fechar sessão local','A leitura local de dados salvos não está disponível no momento. São necessárias a ativação explícita e a verificação bem-sucedida em tempo de execução. Nenhum dado salvo local é lido enquanto este recurso está indisponível.','Pronto para selecionar arquivo local','Abrindo e validando localmente…','Lendo metadados…','Leitura negada; sessão fechada.','Nenhum save selecionado','DiffGrids salvos','ID da grade','Modificados','Removidos','Em ambos','Layout externo','Não resolvido','Página','Somente metadados; layout Native, legalidade do GridID 0, propriedade e edição não verificados.','Nenhuma grade salva','Somente leitura; Writer, Apply e Cloud desligados.','Steam 1.25.3 · Teste somente leitura antes do lançamento']
};
const backupLabels={
  "en": [
    "Download encrypted original backup",
    "Select saved backup to compare",
    "Original bytes only. Compare a separate local backup; no disk-path or Writer verification.",
    "Download requested. Save the file and verify it separately.",
    "Comparing encrypted bytes locally…",
    "Backup bytes match the original. Disk path and persistence are not verified.",
    "Backup comparison or download rejected."
  ],
  "fr": [
    "Télécharger la copie originale chiffrée",
    "Choisir la copie à comparer",
    "Octets originaux uniquement. Comparaison locale, sans preuve de chemin ni droit d’écriture.",
    "Téléchargement demandé. Enregistrez et vérifiez le fichier séparément.",
    "Comparaison locale des octets chiffrés…",
    "Octets identiques à l’original. Chemin et persistance non vérifiés.",
    "Copie ou comparaison refusée."
  ],
  "it": [
    "Scarica la copia originale cifrata",
    "Scegli la copia da confrontare",
    "Solo byte originali. Confronto locale, senza verifica del percorso o autorizzazione di scrittura.",
    "Download richiesto. Salva e verifica il file separatamente.",
    "Confronto locale dei byte cifrati…",
    "Byte identici all’originale. Percorso e persistenza non verificati.",
    "Download o confronto rifiutato."
  ],
  "de": [
    "Verschlüsselte Originalkopie herunterladen",
    "Gespeicherte Kopie vergleichen",
    "Nur Originalbytes. Lokaler Vergleich ohne Pfad- oder Schreibfreigabeprüfung.",
    "Download angefordert. Datei speichern und separat prüfen.",
    "Verschlüsselte Bytes werden lokal verglichen…",
    "Bytes stimmen überein. Pfad und dauerhafte Speicherung nicht geprüft.",
    "Download oder Vergleich abgelehnt."
  ],
  "es-ES": [
    "Descargar copia original cifrada",
    "Elegir copia guardada para comparar",
    "Solo bytes originales. Comparación local sin verificar ruta ni permiso de escritura.",
    "Descarga solicitada. Guarda y verifica el archivo por separado.",
    "Comparando bytes cifrados localmente…",
    "Bytes idénticos al original. Ruta y persistencia no verificadas.",
    "Descarga o comparación rechazada."
  ],
  "ja": [
    "暗号化原本をバックアップ",
    "保存したバックアップを選択して比較",
    "原本バイトのみ。別のローカルコピーを比較します。保存先や書込み権限は検証しません。",
    "ダウンロードを要求しました。保存したファイルを別途確認してください。",
    "暗号化バイトを端末内で比較中…",
    "バックアップのバイトが原本と一致しました。保存先・永続保存は未確認です。",
    "バックアップの取得または比較を拒否しました。"
  ],
  "zh-CN": [
    "下载加密原始备份",
    "选择已保存的备份进行比较",
    "仅原始字节。本地比较，不验证磁盘路径或写入权限。",
    "已请求下载。请保存并单独验证文件。",
    "正在本地比较加密字节…",
    "备份字节与原始文件一致。磁盘路径和持久保存未验证。",
    "备份下载或比较被拒绝。"
  ],
  "pt-BR": [
    "Baixar backup original criptografado",
    "Selecionar backup salvo para comparar",
    "Somente bytes originais. Comparação local sem verificar caminho ou permissão de escrita.",
    "Download solicitado. Salve e verifique o arquivo separadamente.",
    "Comparando bytes criptografados localmente…",
    "Bytes do backup iguais ao original. Caminho e persistência não verificados.",
    "Download ou comparação recusado."
  ]
};
const backupKeys=['backupDownload','backupCandidate','backupHint','backupRequested','backupChecking','backupMatched','backupRejected'];
for(const loc of STEAM_DIFFGRIDS_LOCALES)if(backupLabels[loc]?.length!==backupKeys.length)throw Error('DIFFGRIDS_BACKUP_TRANSLATION_FIELDS_MISSING_'+loc);
const keys=['title','subtitle','intro','file','version','sha','confirm','open','next','close','unavailable','ready','opening','reading','error','empty','count','gridId','modified','removed','overlap','layout','unresolved','page','safety','zero','off','preformal'];
for(const loc of STEAM_DIFFGRIDS_LOCALES)if(labels[loc]?.length!==keys.length)throw Error('DIFFGRIDS_TRANSLATION_FIELDS_MISSING_'+loc);
export function savedDiffGridsCopy(locale='en'){
 const loc=STEAM_DIFFGRIDS_LOCALES.includes(locale)?locale:'en';
 return Object.freeze(Object.fromEntries([...keys.map((key,i)=>[key,labels[loc][i]]),...backupKeys.map((key,i)=>[key,backupLabels[loc][i]])]));
}
