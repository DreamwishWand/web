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
const downloads=Object.freeze({
 en:{downloadBackup:'Download original backup',downloadEdited:'Download edited P1G copy'},
 ja:{downloadBackup:'原本Backupをダウンロード',downloadEdited:'編集済みP1Gをダウンロード'},
 fr:{downloadBackup:'Télécharger la sauvegarde originale',downloadEdited:'Télécharger la copie P1G modifiée'},
 it:{downloadBackup:'Scarica il backup originale',downloadEdited:'Scarica la copia P1G modificata'},
 de:{downloadBackup:'Original-Sicherung herunterladen',downloadEdited:'Bearbeitete P1G-Kopie herunterladen'},
 'es-ES':{downloadBackup:'Descargar copia original',downloadEdited:'Descargar copia P1G editada'},
 'zh-CN':{downloadBackup:'下载原始备份',downloadEdited:'下载编辑后的 P1G 副本'},
 'pt-BR':{downloadBackup:'Baixar backup original',downloadEdited:'Baixar cópia P1G editada'}
});
// Display only: same typed address already returned by the trusted Worker.
// Distinguish equal item/amount in different physical slots; no new ID lookup.
const addresses=Object.freeze({
 en:{inventory:'Inventory',chest:'Chest',inventoryId:'Inventory ID',containerId:'Container ID',slot:'Slot index (0-based)',itemId:'Item ID',review:'Review selected target before staging'},
 ja:{inventory:'インベントリ',chest:'チェスト',inventoryId:'インベントリID',containerId:'コンテナID',slot:'スロット番号（0始まり）',itemId:'アイテムID',review:'仮適用前に選択対象を確認'},
 fr:{inventory:'Inventaire',chest:'Coffre',inventoryId:'ID inventaire',containerId:'ID conteneur',slot:'Index emplacement (dès 0)',itemId:'ID objet',review:'Vérifier la cible avant préparation'},
 it:{inventory:'Inventario',chest:'Baule',inventoryId:'ID inventario',containerId:'ID contenitore',slot:'Indice slot (da 0)',itemId:'ID oggetto',review:'Controlla la destinazione prima di preparare'},
 de:{inventory:'Inventar',chest:'Truhe',inventoryId:'Inventar-ID',containerId:'Behälter-ID',slot:'Platzindex (ab 0)',itemId:'Gegenstands-ID',review:'Ausgewähltes Ziel vor dem Vormerken prüfen'},
 'es-ES':{inventory:'Inventario',chest:'Cofre',inventoryId:'ID de inventario',containerId:'ID de contenedor',slot:'Índice de ranura (desde 0)',itemId:'ID de objeto',review:'Revisar el objetivo antes de preparar'},
 'zh-CN':{inventory:'物品栏',chest:'储物箱',inventoryId:'物品栏 ID',containerId:'容器 ID',slot:'槽位索引（从 0 开始）',itemId:'物品 ID',review:'暂存前确认选中的目标'},
 'pt-BR':{inventory:'Inventário',chest:'Baú',inventoryId:'ID do inventário',containerId:'ID do recipiente',slot:'Índice do espaço (a partir de 0)',itemId:'ID do item',review:'Conferir o alvo antes de preparar'}
});
const localized=Object.freeze(Object.fromEntries(Object.entries(map)
 .map(([k,v])=>[k,Object.freeze({...v,...(safety[k]||{}),...downloads[k],...addresses[k]})])));
export function localAmountTargetLabel(t,words){
 if(!t)return '';
 const where=t.kind==='ChestExistingSlotAmountDecrease'?
  words.chest+' · '+words.containerId+' '+t.targetId+' · '+words.slot+' '+t.slotIndex:
  t.kind==='InventoryExistingAmountDecrease'?
  words.inventory+' · '+words.inventoryId+' '+t.targetId:'';
 return where?where+' · '+words.itemId+' '+t.itemId+' · '+words.before+' '+t.oldAmount:'';
}
export const DEV_AMOUNT_UI_LOCALES=Object.freeze(Object.keys(localized));
// Only Build and operation-specific text changes; reuse existing safety copy.
const switchCopy=Object.freeze({
 en:{title:'Switch P1G Chest editor — DEV/OFF',build:'Switch Build ID (BID)',sha:'Original encrypted SHA-256 (computed locally)',confirm:'I independently confirmed this exact Switch BID.',intro:'Local experimental editing only. Verified Chest amount 50 → 49; no upload or original overwrite.'},
 ja:{title:'Switch P1G チェスト数量編集 — DEV/OFF',build:'Switch ビルドID（BID）',sha:'原本暗号化SHA-256（端末内で計算）',confirm:'このSwitch BIDを別途確認した。',intro:'端末内の実験的編集。検証済みチェストの数量50→49のみ。送信・原本上書き禁止。'},
 fr:{title:'Éditeur coffre P1G Switch — DEV/OFF',build:'ID de build Switch (BID)',sha:'SHA-256 chiffré original (calcul local)',confirm:'J’ai vérifié séparément ce BID Switch exact.',intro:'Édition locale expérimentale : coffre vérifié 50 → 49 uniquement. Aucun envoi ni écrasement.'},
 it:{title:'Editor baule P1G Switch — DEV/OFF',build:'ID build Switch (BID)',sha:'SHA-256 cifrato originale (calcolo locale)',confirm:'Ho verificato separatamente questo BID Switch esatto.',intro:'Modifica sperimentale locale: solo baule verificato 50 → 49. Nessun invio o sovrascrittura.'},
 de:{title:'Switch-P1G-Truheneditor — DEV/AUS',build:'Switch-Build-ID (BID)',sha:'Verschlüsselter Original-SHA-256 (lokal berechnet)',confirm:'Ich habe diese exakte Switch-BID separat bestätigt.',intro:'Lokale experimentelle Bearbeitung: nur geprüfte Truhe 50 → 49. Kein Upload oder Überschreiben.'},
 'es-ES':{title:'Editor de cofre P1G Switch — DEV/APAGADO',build:'ID de compilación Switch (BID)',sha:'SHA-256 cifrado original (calculado localmente)',confirm:'He confirmado por separado este BID Switch exacto.',intro:'Edición local experimental: solo cofre verificado 50 → 49. Sin subida ni sobrescritura.'},
 'zh-CN':{title:'Switch P1G 储物箱编辑 — DEV/关闭',build:'Switch 构建 ID（BID）',sha:'原始加密 SHA-256（本地计算）',confirm:'我已另行确认此 Switch BID。',intro:'仅限本机实验性编辑：已验证储物箱数量 50→49。不上传、不覆盖原文件。'},
 'pt-BR':{title:'Editor de baú P1G Switch — DEV/DESLIGADO',build:'ID de build Switch (BID)',sha:'SHA-256 criptografado original (cálculo local)',confirm:'Confirmei separadamente este BID Switch exato.',intro:'Edição experimental local: apenas baú verificado 50 → 49. Sem upload ou sobrescrita.'}
});
const steamChestCopy=Object.freeze({
 en:{title:'Steam P1G Chest editor — DEV/OFF',confirm:'I independently confirmed this exact Steam FullVersion.',intro:'Local editing only. Verified Chest amount 50 → 49; no upload or original overwrite.'},
 ja:{title:'Steam P1G チェスト数量編集 — DEV/OFF',confirm:'このSteam完全バージョンを別途確認した。',intro:'端末内編集。検証済みチェストの数量50→49のみ。送信・原本上書き禁止。'},
 fr:{title:'Éditeur coffre P1G Steam — DEV/OFF',confirm:'J’ai vérifié séparément cette version complète Steam.',intro:'Édition locale : coffre vérifié 50 → 49 uniquement. Aucun envoi ni écrasement.'},
 it:{title:'Editor baule P1G Steam — DEV/OFF',confirm:'Ho verificato separatamente questa versione completa Steam.',intro:'Modifica locale: solo baule verificato 50 → 49. Nessun invio o sovrascrittura.'},
 de:{title:'Steam-P1G-Truheneditor — DEV/AUS',confirm:'Ich habe diese vollständige Steam-Version separat bestätigt.',intro:'Lokale Bearbeitung: nur geprüfte Truhe 50 → 49. Kein Upload oder Überschreiben.'},
 'es-ES':{title:'Editor de cofre P1G Steam — DEV/APAGADO',confirm:'He confirmado por separado esta versión completa de Steam.',intro:'Edición local: solo cofre verificado 50 → 49. Sin subida ni sobrescritura.'},
 'zh-CN':{title:'Steam P1G 储物箱编辑 — DEV/关闭',confirm:'我已另行确认此 Steam 完整版本。',intro:'仅限本机编辑：已验证储物箱数量 50→49。不上传、不覆盖原文件。'},
 'pt-BR':{title:'Editor de baú P1G Steam — DEV/DESLIGADO',confirm:'Confirmei separadamente esta versão completa do Steam.',intro:'Edição local: apenas baú verificado 50 → 49. Sem upload ou sobrescrita.'}
});
export function localAmountCopy(locale,switchChest=false,productMode='',steamChest=false){
 const base=localized[locale]||localized.en;
 if(!switchChest&&!steamChest)return base;
 const selected=steamChest?{...base,...(steamChestCopy[locale]||steamChestCopy.en),sha:(switchCopy[locale]||switchCopy.en).sha}:{...base,...(switchCopy[locale]||switchCopy.en)};
 // The UI label is not an authority grant; only the branded sealed port is.
 if(productMode==='public-accepted'||productMode==='private-product-v2')selected.title=selected.title.split(' — ')[0]+(productMode==='private-product-v2'?' — V2':'');
 return Object.freeze(selected);
}
