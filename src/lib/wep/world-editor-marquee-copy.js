// Presentation only: shared locale selection stays owned by the Web runtime.
const COPY = Object.freeze({
  en: { tool:'Rectangle select', hint:'Drag an empty part of the canvas to select editable visible objects. Shift adds, Ctrl toggles, Alt removes. Esc cancels.', live:'Rectangle selection: {count} editable objects', cancel:'Rectangle selection cancelled', applied:'Rectangle selection updated: {count} selected' },
  ja: { tool:'矩形範囲選択', hint:'キャンバスの空白部分からドラッグして表示中の編集可能な物を選択します。Shiftで追加、Ctrlで切替、Altで除外。Escで中止。', live:'矩形選択：編集可能な対象 {count} 件', cancel:'矩形選択を中止しました', applied:'矩形選択を更新：{count} 件選択中' },
  de: { tool:'Rechteckauswahl', hint:'Vom leeren Canvas-Bereich ziehen. Umschalt: hinzufügen, Strg: umschalten, Alt: entfernen, Esc: abbrechen.', live:'Rechteckauswahl: {count} bearbeitbare Objekte', cancel:'Rechteckauswahl abgebrochen', applied:'Auswahl aktualisiert: {count} Objekte' },
  fr: { tool:'Sélection rectangulaire', hint:'Glissez depuis une zone vide. Maj ajoute, Ctrl bascule, Alt retire, Échap annule.', live:'Sélection rectangulaire : {count} objets modifiables', cancel:'Sélection rectangulaire annulée', applied:'Sélection mise à jour : {count} objets' },
  it: { tool:'Selezione rettangolare', hint:'Trascina da una zona vuota. Maiusc aggiunge, Ctrl commuta, Alt rimuove, Esc annulla.', live:'Selezione rettangolare: {count} oggetti modificabili', cancel:'Selezione annullata', applied:'Selezione aggiornata: {count} oggetti' },
  'es-ES': { tool:'Selección rectangular', hint:'Arrastra desde un área vacía. Mayús añade, Ctrl alterna, Alt quita, Esc cancela.', live:'Selección rectangular: {count} objetos editables', cancel:'Selección cancelada', applied:'Selección actualizada: {count} objetos' },
  'pt-BR': { tool:'Seleção retangular', hint:'Arraste de uma área vazia. Shift adiciona, Ctrl alterna, Alt remove, Esc cancela.', live:'Seleção retangular: {count} objetos editáveis', cancel:'Seleção cancelada', applied:'Seleção atualizada: {count} objetos' },
  'zh-CN': { tool:'矩形选择', hint:'从画布空白处拖动。Shift 添加、Ctrl 切换、Alt 移除、Esc 取消。', live:'矩形选择：{count} 个可编辑对象', cancel:'已取消矩形选择', applied:'已更新选择：{count} 个对象' }
});
export function worldEditorMarqueeCopy(locale) { return COPY[locale] ?? COPY.en; }
export const WORLD_EDITOR_MARQUEE_LOCALES = Object.freeze(Object.keys(COPY));
