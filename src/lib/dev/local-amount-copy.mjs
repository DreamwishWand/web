// Local DEV/OFF-only amount editor copy. No product/hosted route imports
// this module; strings never claim Native V3, rights or Writer permission.
const en={
 title:'Local Steam P1G amount editor — DEV/OFF',intro:'Local-only experimental editing. No upload or original overwrite. Only independently verified existing Inventory/Chest targets.',
 file:'Select local encrypted P1G',build:'Steam Windows FullVersion',sha:'Original encrypted SHA-256 (externally verified)',confirm:'I independently confirmed the exact Steam FullVersion and source hash.',
 open:'Open in Rust Worker',backup:'Verify original backup and read allowed items',
 target:'Verified existing item',newAmount:'New smaller amount',stage:'Stage CAS difference',undo:'Undo',redo:'Redo',export:'Save separately named edited copy and reopen',close:'Close local session',
 waiting:'DEV operation unavailable: independent Rust/real-Save acceptance pending.',empty:'No verified/rights-allowed targets. Editing is disabled.',
 backupOk:'Original backup verified and unchanged.',before:'Old',after:'Proposed',
 preview:'Staged difference (not exported)',done:'Edited copy verified by a fresh Codec Worker reopen; OS-process QA is separate.',failed:'Denied. The session was closed; reselect the source.',note:'No Skin, DLC, entitlement, unknown ID, direct JSON patch, source overwrite, network upload, or public Writer.'
};
const replace=(o)=>Object.freeze({...en,...o});
const map=Object.freeze({
 en,
 ja:replace({title:'Steam P1G 数量編集 — ローカルDEV/OFF',intro:'実験的な端末内編集。送信・原本上書き禁止。検証済み既存Inventory／Chestのみ。',
 file:'暗号化P1Gを手動選択',build:'Steam Windows 完全バージョン',sha:'原本の暗号化SHA-256（外部確認）',confirm:'Steam完全バージョンと原本SHAを別途確認した。',
 open:'Rust Workerで開く',backup:'原本Backupを検証し、編集可能な項目を読む',target:'確認済みの既存アイテム',
 newAmount:'減少後の数量',stage:'CAS差分を仮適用',undo:'元に戻す',redo:'再適用',export:'別名Edited-copyを保存・再読込',close:'ローカルSessionを閉じる',
 waiting:'独立Rust／実Save受入待ちのためDEV操作は無効です。',empty:'権利とItemIDを確認できた対象がありません。編集不可。',
 backupOk:'原本Backupの保持を検証済み。',before:'旧値',after:'変更案',preview:'仮差分（未Export）',
 done:'Edited-copyの別Worker再読込を確認済み。別OSプロセスQAは未受入。',failed:'拒否されました。Sessionを閉じました。再選択が必要です。',
 note:'未確認ID・Skin・DLC・有償権利・JSON直接編集・原本上書き・Cloud送信・公開Writerは禁止。'}),
 fr:replace({title:'Éditeur P1G Steam local — DEV/DÉSACTIVÉ',file:'Choisir un P1G local chiffré',open:'Ouvrir dans Rust Worker',backup:'Vérifier la sauvegarde originale',target:'Objet existant vérifié',newAmount:'Nouvelle quantité réduite',stage:'Prévisualiser la modification CAS',undo:'Annuler',redo:'Rétablir',export:'Exporter une copie distincte et la rouvrir',close:'Fermer la session',failed:'Refusé. Session fermée.'}),
 it:replace({title:'Editor P1G Steam locale — DEV/OFF',file:'Seleziona P1G cifrato',open:'Apri nel Rust Worker',backup:'Verifica backup originale',target:'Elemento esistente verificato',newAmount:'Nuova quantità minore',stage:'Anteprima differenza CAS',undo:'Annulla',redo:'Ripristina',export:'Salva copia separata e riapri',close:'Chiudi sessione'}),
 de:replace({title:'Lokaler Steam-P1G-Editor — DEV/AUS',file:'Verschlüsselte P1G wählen',open:'Im Rust Worker öffnen',backup:'Originalsicherung überprüfen',target:'Verifizierter vorhandener Gegenstand',newAmount:'Neue geringere Anzahl',stage:'CAS-Differenz vormerken',undo:'Rückgängig',redo:'Wiederholen',export:'Bearbeitete Kopie separat speichern und erneut öffnen',close:'Sitzung schließen'}),
 'es-ES':replace({title:'Editor Steam P1G local — DEV/APAGADO',file:'Elegir P1G cifrado',open:'Abrir en Rust Worker',backup:'Verificar copia original',target:'Objeto existente verificado',newAmount:'Nueva cantidad menor',stage:'Preparar diferencia CAS',undo:'Deshacer',redo:'Rehacer',export:'Guardar copia distinta y reabrir',close:'Cerrar sesión'}),
 'zh-CN':replace({title:'本地 Steam P1G 数量编辑 — DEV/关闭',file:'手动选择加密 P1G',open:'在 Rust Worker 中打开',backup:'验证原始备份',target:'已验证的现有物品',newAmount:'减少后的数量',stage:'预览 CAS 更改',undo:'撤销',redo:'重做',export:'另存已编辑副本并重新打开',close:'关闭会话'}),
 'pt-BR':replace({title:'Editor P1G Steam local — DEV/DESLIGADO',file:'Escolher P1G criptografado',open:'Abrir no Rust Worker',backup:'Verificar backup original',target:'Item existente verificado',newAmount:'Nova quantidade menor',stage:'Prévia da alteração CAS',undo:'Desfazer',redo:'Refazer',export:'Salvar cópia separada e reabrir',close:'Fechar sessão'})
});
// Complete all safety-critical labels in each locale; never fall back
// to English for build confirmation, original protection, DEV gate, or
// edited-copy caveats. English remains the explicit unknown-locale fallback.
const safety=Object.freeze({
 fr:{intro:'Modification expérimentale uniquement sur cet appareil. Aucun envoi ni écrasement. Objets existants vérifiés seulement.',
  build:'Version complète Steam Windows',sha:'SHA-256 chiffré de l’original (vérifié hors fichier)',
  confirm:'J’ai vérifié séparément la version Steam et le SHA de la source.',
  waiting:'Opération DEV désactivée avant les validations Rust et sauvegarde réelle.',
  empty:'Aucun objet existant avec ID et droits vérifiés : édition interdite.',
  backupOk:'Sauvegarde originale vérifiée et inchangée.',before:'Avant',after:'Proposé',
  preview:'Différence préparée, non exportée',done:'Copie rouverte dans un nouveau Worker Codec ; validation par processus OS séparé en attente.',
  note:'Aucun ID inconnu, Skin, DLC, droit payant, JSON arbitraire, écrasement, envoi Cloud ou Writer public.'},
 it:{intro:'Modifica sperimentale solo sul dispositivo. Nessun invio o sovrascrittura. Solo oggetti esistenti verificati.',
  build:'Versione completa Steam Windows',sha:'SHA-256 cifrato originale (verificato esternamente)',
  confirm:'Ho verificato separatamente versione Steam e SHA originale.',
  waiting:'Operazione DEV disabilitata finché Rust e il salvataggio reale non sono accettati.',
  empty:'Nessun oggetto con ID e diritti verificati: modifica vietata.',
  backupOk:'Backup originale verificato e invariato.',before:'Prima',after:'Proposto',
  preview:'Differenza preparata, non esportata',done:'Copia riaperta in un nuovo Worker Codec; verifica in processo OS separato in attesa.',
  failed:'Rifiutato. Sessione chiusa; selezionare nuovamente il file.',
  note:'Niente ID ignoti, Skin, DLC, diritti a pagamento, JSON arbitrario, sovrascrittura, Cloud o Writer pubblico.'},
 de:{intro:'Experimentelle Bearbeitung nur lokal. Kein Upload und kein Überschreiben. Nur geprüfte vorhandene Gegenstände.',
  build:'Vollständige Steam-Windows-Version',sha:'Verschlüsselter Original-SHA-256 (extern geprüft)',
  confirm:'Steam-Version und Original-SHA wurden unabhängig bestätigt.',
  waiting:'DEV-Bearbeitung bis zur unabhängigen Rust-/Echt-Save-Abnahme deaktiviert.',
  empty:'Keine Gegenstände mit geprüfter ID und Berechtigung: Bearbeitung gesperrt.',
  backupOk:'Originalsicherung geprüft und unverändert.',before:'Vorher',after:'Vorgeschlagen',
  preview:'Vorgemerkte Änderung (nicht exportiert)',done:'Kopie in neuem Codec Worker geprüft; getrennter OS-Prozess noch nicht abgenommen.',
  failed:'Abgelehnt. Sitzung geschlossen; Quelle neu auswählen.',
  note:'Keine unbekannten IDs, Skins, DLC, Bezahlinhalte, JSON-Patches, Überschreiben, Cloud-Uploads oder öffentliche Writer.'},
 'es-ES':{intro:'Edición experimental solo en este dispositivo. Sin subida ni sobrescritura. Solo objetos existentes verificados.',
  build:'Versión completa Steam Windows',sha:'SHA-256 cifrado original (verificado externamente)',
  confirm:'He comprobado por separado la versión Steam y el SHA original.',
  waiting:'Edición DEV deshabilitada hasta aprobar Rust y la partida real.',
  empty:'No hay objetos con ID y permisos verificados. Edición bloqueada.',
  backupOk:'Copia original verificada e intacta.',before:'Anterior',after:'Propuesto',
  preview:'Diferencia preparada, sin exportar',done:'Copia reabierta en un nuevo Worker Codec; falta verificación de proceso OS independiente.',
  failed:'Rechazado. Sesión cerrada; vuelve a seleccionar el archivo.',
  note:'Sin ID desconocidos, Skin, DLC, derechos de pago, JSON arbitrario, sobrescritura, nube ni Writer público.'},
 'zh-CN':{intro:'仅限本机的实验性编辑。不上传、不覆盖原文件。仅允许独立确认的现有物品。',
  build:'Steam Windows 完整版本',sha:'原始加密文件 SHA-256（外部验证）',
  confirm:'我已独立确认 Steam 完整版本及原始文件 SHA。',
  waiting:'Rust 与真实存档独立验收之前，DEV 操作不可用。',
  empty:'没有已验证 ID 与权限的现有物品，禁止编辑。',
  backupOk:'原始备份已验证且未改变。',before:'原数量',after:'拟修改数量',
  preview:'暂存差异（未导出）',done:'已由新的 Codec Worker 重新打开；独立操作系统进程验证仍待验收。',
  failed:'操作被拒绝。会话已关闭，请重新选择文件。',
  note:'禁止未知 ID、Skin、DLC、付费权限、任意 JSON 补丁、覆盖原文件、云端上传及公开 Writer。'},
 'pt-BR':{intro:'Edição experimental apenas neste dispositivo. Sem upload ou sobrescrita. Só itens existentes verificados.',
  build:'Versão completa Steam Windows',sha:'SHA-256 criptografado do original (verificado externamente)',
  confirm:'Confirmei separadamente a versão Steam e o SHA original.',
  waiting:'Edição DEV desativada até a aceitação independente do Rust e do Save real.',
  empty:'Nenhum item com ID e direitos verificados; edição bloqueada.',
  backupOk:'Backup original verificado e intacto.',before:'Anterior',after:'Proposto',
  preview:'Diferença preparada (não exportada)',done:'Cópia reaberta em novo Worker Codec; processo OS independente ainda sem aprovação.',
  failed:'Negado. Sessão encerrada; selecione o arquivo novamente.',
  note:'Sem IDs desconhecidos, Skin, DLC, direitos pagos, JSON arbitrário, sobrescrita, Cloud ou Writer público.'}
});
const localized=Object.freeze(Object.fromEntries(Object.entries(map)
 .map(([k,v])=>[k,Object.freeze({...v,...(safety[k]||{})})])));
export const DEV_AMOUNT_UI_LOCALES=Object.freeze(Object.keys(localized));
export function localAmountCopy(locale){return localized[locale]||en}
