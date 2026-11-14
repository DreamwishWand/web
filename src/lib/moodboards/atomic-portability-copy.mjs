const COPY=Object.freeze({
  "en": {
    "export": "Export portable Board",
    "import": "Import portable Board",
    "note": "For a site move, export the current Board and its previous snapshot together. Import only into an empty isolated Board. The legacy Moodboards are separate and unchanged. Files stay on this device.",
    "exported": "Portable Board exported.",
    "imported": "Portable Board imported and reopened.",
    "rejected": "Portable Board rejected. Keep the original file; an existing destination is never replaced."
  },
  "ja": {
    "export": "移行用ボードを出力",
    "import": "移行用ボードを入力",
    "note": "サイト移行時は現在のボードと前のスナップショットをまとめて出力し、空の独立ボードにのみ入力してください。通常Moodboardとは別の保存領域です。ファイルは端末内に留まります。",
    "exported": "移行用ボードを出力しました。",
    "imported": "移行用ボードを入力し、再読込しました。",
    "rejected": "入力・出力を拒否しました。原本ファイルを保持してください。既存の移行先は置き換えません。"
  },
  "fr": {
    "export": "Exporter le tableau portable",
    "import": "Importer le tableau portable",
    "note": "Pour changer de site, exportez le tableau actuel et son instantané précédent ensemble. Importez uniquement dans un tableau isolé vide. Les Moodboards habituels restent distincts et inchangés. Les fichiers restent sur cet appareil.",
    "exported": "Tableau portable exporté.",
    "imported": "Tableau portable importé et rouvert.",
    "rejected": "Tableau portable refusé. Conservez le fichier original ; la destination existante n’est jamais remplacée."
  },
  "it": {
    "export": "Esporta bacheca portabile",
    "import": "Importa bacheca portabile",
    "note": "Per cambiare sito, esporta insieme la bacheca attuale e lo snapshot precedente. Importa solo in una bacheca isolata vuota. I Moodboard normali restano separati e invariati. I file restano sul dispositivo.",
    "exported": "Bacheca portabile esportata.",
    "imported": "Bacheca portabile importata e riaperta.",
    "rejected": "Bacheca portabile rifiutata. Conserva il file originale; la destinazione esistente non viene sostituita."
  },
  "de": {
    "export": "Portables Board exportieren",
    "import": "Portables Board importieren",
    "note": "Beim Site-Wechsel aktuelles Board und vorherigen Snapshot gemeinsam exportieren. Nur in ein leeres isoliertes Board importieren. Normale Moodboards bleiben getrennt und unverändert. Dateien bleiben auf diesem Gerät.",
    "exported": "Portables Board exportiert.",
    "imported": "Portables Board importiert und erneut geöffnet.",
    "rejected": "Portables Board abgelehnt. Originaldatei behalten; ein vorhandenes Ziel wird nie ersetzt."
  },
  "es-ES": {
    "export": "Exportar tablero portátil",
    "import": "Importar tablero portátil",
    "note": "Para cambiar de sitio, exporta juntos el tablero actual y su instantánea anterior. Importa solo en un tablero aislado vacío. Los Moodboards habituales permanecen separados e intactos. Los archivos quedan en el dispositivo.",
    "exported": "Tablero portátil exportado.",
    "imported": "Tablero portátil importado y reabierto.",
    "rejected": "Tablero portátil rechazado. Conserva el archivo original; no se reemplaza un destino existente."
  },
  "zh-CN": {
    "export": "导出可迁移看板",
    "import": "导入可迁移看板",
    "note": "迁移站点时，请一起导出当前看板和上一个快照。仅导入空白的独立看板。普通 Moodboard 保持独立且不变。文件保留在此设备上。",
    "exported": "已导出可迁移看板。",
    "imported": "已导入并重新打开看板。",
    "rejected": "看板操作被拒绝。保留原始文件；不会替换已有目标。"
  },
  "pt-BR": {
    "export": "Exportar Board portátil",
    "import": "Importar Board portátil",
    "note": "Para mudar de site, exporte juntos o Board atual e o snapshot anterior. Importe somente em um Board isolado vazio. Os Moodboards comuns continuam separados e inalterados. Os arquivos ficam neste dispositivo.",
    "exported": "Board portátil exportado.",
    "imported": "Board portátil importado e reaberto.",
    "rejected": "Board portátil recusado. Preserve o arquivo original; um destino existente não é substituído."
  }
});
export const atomicPortabilityCopy=locale=>COPY[locale]??COPY.en;
