// Local DEV/OFF-only amount editor copy. No product/hosted route imports
// this module; strings never claim Native V3, rights or Writer permission.
const en={
 title:'Local Steam P1G amount editor — DEV/OFF',intro:'Local-only experimental editing. No upload or original overwrite. Only independently verified existing Inventory/Chest targets.',
 file:'Select local encrypted P1G',build:'Steam Windows FullVersion',sha:'Original encrypted SHA-256 (externally verified)',confirm:'I independently confirmed the exact Steam FullVersion and source hash.',
 open:'Open in Rust Worker',backup:'Verify original backup and read allowed items',
 target:'Verified existing item',newAmount:'New smaller amount',stage:'Stage CAS difference',undo:'Undo',redo:'Redo',export:'Save separately named edited copy and reopen',close:'Close local session',
 waiting:'DEV operation unavailable: independent Rust/real-Save acceptance pending.',empty:'No verified/rights-allowed targets. Editing is disabled.',
 backupOk:'Original backup verified and unchanged.',before:'Old',after:'Proposed',
 preview:'Staged difference (not exported)',done:'Edited copy verified by independent reopen.',failed:'Denied. The session was closed; reselect the source.',note:'No Skin, DLC, entitlement, unknown ID, direct JSON patch, source overwrite, network upload, or public Writer.'
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
 done:'Edited-copyを別プロセス再読込で確認済み。',failed:'拒否されました。Sessionを閉じました。再選択が必要です。',
 note:'未確認ID・Skin・DLC・有償権利・JSON直接編集・原本上書き・Cloud送信・公開Writerは禁止。'}),
 fr:replace({title:'Éditeur P1G Steam local — DEV/DÉSACTIVÉ',file:'Choisir un P1G local chiffré',open:'Ouvrir dans Rust Worker',backup:'Vérifier la sauvegarde originale',target:'Objet existant vérifié',newAmount:'Nouvelle quantité réduite',stage:'Prévisualiser la modification CAS',undo:'Annuler',redo:'Rétablir',export:'Exporter une copie distincte et la rouvrir',close:'Fermer la session',failed:'Refusé. Session fermée.'}),
 it:replace({title:'Editor P1G Steam locale — DEV/OFF',file:'Seleziona P1G cifrato',open:'Apri nel Rust Worker',backup:'Verifica backup originale',target:'Elemento esistente verificato',newAmount:'Nuova quantità minore',stage:'Anteprima differenza CAS',undo:'Annulla',redo:'Ripristina',export:'Salva copia separata e riapri',close:'Chiudi sessione'}),
 de:replace({title:'Lokaler Steam-P1G-Editor — DEV/AUS',file:'Verschlüsselte P1G wählen',open:'Im Rust Worker öffnen',backup:'Originalsicherung überprüfen',target:'Verifizierter vorhandener Gegenstand',newAmount:'Neue geringere Anzahl',stage:'CAS-Differenz vormerken',undo:'Rückgängig',redo:'Wiederholen',export:'Bearbeitete Kopie separat speichern und erneut öffnen',close:'Sitzung schließen'}),
 'es-ES':replace({title:'Editor Steam P1G local — DEV/APAGADO',file:'Elegir P1G cifrado',open:'Abrir en Rust Worker',backup:'Verificar copia original',target:'Objeto existente verificado',newAmount:'Nueva cantidad menor',stage:'Preparar diferencia CAS',undo:'Deshacer',redo:'Rehacer',export:'Guardar copia distinta y reabrir',close:'Cerrar sesión'}),
 'zh-CN':replace({title:'本地 Steam P1G 数量编辑 — DEV/关闭',file:'手动选择加密 P1G',open:'在 Rust Worker 中打开',backup:'验证原始备份',target:'已验证的现有物品',newAmount:'减少后的数量',stage:'预览 CAS 更改',undo:'撤销',redo:'重做',export:'另存已编辑副本并重新打开',close:'关闭会话'}),
 'pt-BR':replace({title:'Editor P1G Steam local — DEV/DESLIGADO',file:'Escolher P1G criptografado',open:'Abrir no Rust Worker',backup:'Verificar backup original',target:'Item existente verificado',newAmount:'Nova quantidade menor',stage:'Prévia da alteração CAS',undo:'Desfazer',redo:'Refazer',export:'Salvar cópia separada e reabrir',close:'Fechar sessão'})
});
export const DEV_AMOUNT_UI_LOCALES=Object.freeze(Object.keys(map));
export function localAmountCopy(locale){return map[locale]||en}
