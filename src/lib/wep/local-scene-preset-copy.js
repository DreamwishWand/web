const COPY={
 en:{title:'Local Scene Presets',save:'Save capture on this device',reopen:'Reopen local library',preview:'Read-only preview',reuse:'Prepare detached read-only draft',reuseReady:'Detached local-coordinate draft ready. No Editor change or DDV Apply.',reuseBlocked:'Draft denied: the library changed or this Scene geometry is unsupported.',empty:'No local Scene Presets saved on this device.',saved:'Local Scene Preset saved and independently reopened.',opened:'Reopened a verified local Scene Preset. DDV writer remains off.',blocked:'Local Scene Preset unavailable or changed. No content was overwritten.',notice:'Device-only IndexedDB. Atomic CAS and Backup; no account ownership, Cloud, Apply or DDV Save writer.'},
 fr:{title:'Presets Scene locaux',save:'Enregistrer la capture sur cet appareil',reopen:'Rouvrir la bibliothèque locale',preview:'Aperçu en lecture seule',reuse:'Préparer un brouillon détaché en lecture seule',reuseReady:'Brouillon local prêt, sans modification de l\'éditeur ni application DDV.',reuseBlocked:'Brouillon refusé : bibliothèque modifiée ou géométrie non prise en charge.',empty:'Aucun Preset Scene local enregistré.',saved:'Preset Scene enregistré et rouvert avec vérification.',opened:'Preset local vérifié et rouvert. Écriture DDV désactivée.',blocked:'Preset local indisponible ou modifié. Aucune donnée écrasée.',notice:'IndexedDB sur cet appareil. CAS et sauvegarde atomiques ; sans Cloud, Apply ni écriture DDV.'},
 it:{title:'Preset Scene locali',save:'Salva acquisizione su questo dispositivo',reopen:'Riapri libreria locale',preview:'Anteprima di sola lettura',reuse:'Prepara bozza separata in sola lettura',reuseReady:'Bozza locale pronta, senza modifiche all\'editor né applicazione DDV.',reuseBlocked:'Bozza negata: libreria modificata o geometria non supportata.',empty:'Nessun Preset Scene locale salvato.',saved:'Preset Scene salvato e riaperto con verifica.',opened:'Preset locale verificato e riaperto. Scrittura DDV disattivata.',blocked:'Preset locale non disponibile o modificato. Nessuna sovrascrittura.',notice:'IndexedDB solo sul dispositivo. CAS e backup atomici; nessun Cloud, Apply o scrittura DDV.'},
 de:{title:'Lokale Scene Presets',save:'Aufnahme auf diesem Gerät speichern',reopen:'Lokale Bibliothek neu öffnen',preview:'Schreibgeschützte Vorschau',reuse:'Getrennten schreibgeschützten Entwurf vorbereiten',reuseReady:'Lokaler Entwurf bereit. Keine Editor-Änderung oder DDV-Anwendung.',reuseBlocked:'Entwurf verweigert: Bibliothek geändert oder Geometrie nicht unterstützt.',empty:'Keine lokalen Scene Presets gespeichert.',saved:'Scene Preset gespeichert und unabhängig erneut geöffnet.',opened:'Verifiziertes lokales Preset erneut geöffnet. DDV-Schreibzugriff aus.',blocked:'Lokales Preset nicht verfügbar oder geändert. Nichts überschrieben.',notice:'Nur gerätegebundenes IndexedDB. Atomisches CAS/Backup, keine Cloud-/DDV-Schreibfreigabe.'},
 'es-ES':{title:'Presets Scene locales',save:'Guardar captura en este dispositivo',reopen:'Reabrir biblioteca local',preview:'Vista de solo lectura',reuse:'Preparar borrador independiente de solo lectura',reuseReady:'Borrador local listo, sin cambios al editor ni aplicación DDV.',reuseBlocked:'Borrador denegado: biblioteca cambiada o geometría no admitida.',empty:'No hay Presets Scene locales guardados.',saved:'Preset Scene guardado y reabierto con verificación.',opened:'Preset local verificado y reabierto. Escritura DDV desactivada.',blocked:'Preset local no disponible o modificado. Nada sobrescrito.',notice:'IndexedDB solo del dispositivo. CAS y copia atómicos; sin Cloud, Apply o escritura DDV.'},
 ja:{title:'ローカルScene Preset',save:'この端末にCaptureを保存',reopen:'ローカルライブラリを再Open',preview:'読み取り専用Preview',reuse:'分離した読み取り専用Draftを準備',reuseReady:'ローカル座標のDraftを準備しました。Editorへの配置・DDV Applyは行いません。',reuseBlocked:'ライブラリが更新されたか、Sceneの座標・構造が未対応のためDraftを拒否しました。',empty:'この端末には保存済みScene Presetがありません。',saved:'ローカルScene Presetを保存し、別トランザクションで再Open検証しました。',opened:'保存済みScene Presetを読み取り専用で再Openしました。Save WriterはOFFです。',blocked:'Scene Presetが更新または破損しています。データの上書きは行いません。',notice:'端末内IndexedDBのみ。CAS・原子Backup付き。Created所有権・Cloud・Apply・DDV Writerの権限はありません。'},
 'zh-CN':{title:'本地 Scene Preset',save:'将捕获内容保存到本机',reopen:'重新打开本地资料库',preview:'只读预览',reuse:'准备独立的只读草稿',reuseReady:'本地坐标草稿已就绪；不更改编辑器或执行 DDV Apply。',reuseBlocked:'草稿被拒绝：资料库已更改或几何结构不受支持。',empty:'本机没有已保存的 Scene Preset。',saved:'Scene Preset 已保存并独立重开验证。',opened:'已只读重开已验证的 Scene Preset。DDV 写入关闭。',blocked:'本地预设不可用或已更改。没有覆盖数据。',notice:'仅设备 IndexedDB；原子 CAS/备份；不启用云端、Apply 或 DDV 写入。'},
 'pt-BR':{title:'Presets Scene locais',save:'Salvar captura neste dispositivo',reopen:'Reabrir biblioteca local',preview:'Prévia somente leitura',reuse:'Preparar rascunho isolado somente leitura',reuseReady:'Rascunho local pronto. Nenhuma alteração no editor ou aplicação DDV.',reuseBlocked:'Rascunho negado: biblioteca alterada ou geometria não suportada.',empty:'Nenhum Preset Scene local salvo.',saved:'Preset Scene salvo e reaberto com verificação.',opened:'Preset local validado e reaberto. Gravação DDV desligada.',blocked:'Preset local indisponível ou alterado. Nada sobrescrito.',notice:'IndexedDB apenas no dispositivo. CAS e backup atômicos; sem Cloud, Apply ou escrita DDV.'}
};
export function localScenePresetCopy(locale='en'){return COPY[locale]??COPY.en;}
export const LOCAL_SCENE_PRESET_LOCALES=Object.freeze(Object.keys(COPY));

const PORTABLE={
  "en": {
    "export": "Export Scene file",
    "choose": "Choose Scene file",
    "import": "Import selected file",
    "count": "Scenes in file",
    "exported": "Scene file exported. Original library retained.",
    "imported": "Imported and independently reopened.",
    "blocked": "File unavailable, unsupported, or library changed. Reopen the library before retrying.",
    "notice": "Local file only. Import appends; duplicate IDs are rejected. Keep the original file and old site data."
  },
  "fr": {
    "export": "Exporter le fichier Scene",
    "choose": "Choisir un fichier Scene",
    "import": "Importer le fichier choisi",
    "count": "Scenes dans le fichier",
    "exported": "Fichier Scene exporté. Bibliothèque originale conservée.",
    "imported": "Importé et rouvert avec vérification.",
    "blocked": "Fichier indisponible, non pris en charge ou bibliothèque modifiée. Rouvrez la bibliothèque avant de réessayer.",
    "notice": "Fichier local uniquement. L’import ajoute des Scenes et refuse les identifiants en double. Conservez le fichier et les données d’origine."
  },
  "it": {
    "export": "Esporta file Scene",
    "choose": "Scegli file Scene",
    "import": "Importa file selezionato",
    "count": "Scene nel file",
    "exported": "File Scene esportato. Libreria originale conservata.",
    "imported": "Importato e riaperto con verifica.",
    "blocked": "File non disponibile, non supportato o libreria modificata. Riapri la libreria prima di riprovare.",
    "notice": "Solo file locale. L’importazione aggiunge Scene e rifiuta ID duplicati. Conserva file e dati originali."
  },
  "de": {
    "export": "Scene-Datei exportieren",
    "choose": "Scene-Datei auswählen",
    "import": "Gewählte Datei importieren",
    "count": "Scenes in der Datei",
    "exported": "Scene-Datei exportiert. Originalbibliothek bleibt erhalten.",
    "imported": "Importiert und unabhängig erneut geöffnet.",
    "blocked": "Datei fehlt, ist nicht unterstützt oder Bibliothek geändert. Bibliothek vor erneutem Versuch öffnen.",
    "notice": "Nur lokale Datei. Import fügt Scenes hinzu und lehnt doppelte IDs ab. Originaldatei und alte Daten behalten."
  },
  "es-ES": {
    "export": "Exportar archivo Scene",
    "choose": "Elegir archivo Scene",
    "import": "Importar archivo seleccionado",
    "count": "Scenes en el archivo",
    "exported": "Archivo Scene exportado. Biblioteca original conservada.",
    "imported": "Importado y reabierto con verificación.",
    "blocked": "Archivo no disponible, no compatible o biblioteca modificada. Reabre la biblioteca antes de reintentar.",
    "notice": "Solo archivo local. La importación añade Scenes y rechaza IDs duplicados. Conserva el archivo y los datos originales."
  },
  "ja": {
    "export": "Sceneファイルを出力",
    "choose": "Sceneファイルを選択",
    "import": "選択したファイルを取り込む",
    "count": "ファイル内のScene数",
    "exported": "Sceneファイルを出力しました。元のライブラリは保持されます。",
    "imported": "取り込み後、別トランザクションで再Openしました。",
    "blocked": "ファイルが未対応、またはライブラリが更新されています。再試行前にライブラリを再Openしてください。",
    "notice": "端末内ファイルのみ。取り込みは追加のみで、重複IDは拒否します。元のファイルと旧サイトのデータは保持してください。"
  },
  "zh-CN": {
    "export": "导出 Scene 文件",
    "choose": "选择 Scene 文件",
    "import": "导入所选文件",
    "count": "文件中的 Scene 数量",
    "exported": "已导出 Scene 文件，保留原资料库。",
    "imported": "已导入并独立重开验证。",
    "blocked": "文件不可用、不受支持或资料库已更改。重试前请重新打开资料库。",
    "notice": "仅本地文件。导入仅追加，拒绝重复 ID。请保留原文件和旧站点数据。"
  },
  "pt-BR": {
    "export": "Exportar arquivo Scene",
    "choose": "Escolher arquivo Scene",
    "import": "Importar arquivo selecionado",
    "count": "Scenes no arquivo",
    "exported": "Arquivo Scene exportado. Biblioteca original preservada.",
    "imported": "Importado e reaberto com verificação.",
    "blocked": "Arquivo indisponível, incompatível ou biblioteca alterada. Reabra a biblioteca antes de tentar novamente.",
    "notice": "Somente arquivo local. A importação adiciona Scenes e rejeita IDs duplicados. Preserve o arquivo e os dados originais."
  }
};
export function localScenePortableCopy(locale='en'){return PORTABLE[locale]??PORTABLE.en;}
