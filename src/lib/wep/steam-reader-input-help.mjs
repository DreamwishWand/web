// Display-only Windows input preparation; no shell execution, file access or authority.
export const STEAM_INPUT_HASH_COMMAND = "(Get-FileHash -LiteralPath 'C:\\path\\profile.p1g' -Algorithm SHA256).Hash.ToLowerInvariant()";
const labels = {
  "en": [
    "Before opening a Steam save",
    "1. Check the version of your installed Windows Steam game. This reader supports Steam 1.25.3 (schema 626). A filename or schema number alone does not establish the game build.",
    "2. In Windows PowerShell, replace the example path below with the path to your original encrypted P1G file and run the command. Copy its 64-character lowercase SHA-256 into the reader.",
    "3. Select that same original file, confirm the independently checked version and SHA-256, then open read-only. The command only reads the file; it does not change it or upload it. Keep the original."
  ],
  "ja": [
    "Steamセーブを開く前の準備",
    "1. Windows Steam版のインストール済みゲームバージョンを確認してください。このReaderはSteam 1.25.3（schema 626）に対応します。ファイル名やschema番号だけではBuildは確定できません。",
    "2. Windows PowerShellで、下の例のパスを暗号化された原本P1Gの実際のパスに置き換えて実行します。表示された64文字の小文字SHA-256をReaderに入力してください。",
    "3. 同じ原本を選び、別途確認したバージョンとSHA-256を確認して読み取り専用で開きます。このコマンドはファイルを読み取るだけで、変更・アップロードは行いません。原本は保管してください。"
  ],
  "fr": [
    "Avant d’ouvrir une sauvegarde Steam",
    "1. Vérifiez la version du jeu Steam installé sous Windows. Ce lecteur prend en charge Steam 1.25.3 (schéma 626). Le nom du fichier ou le numéro de schéma seul ne suffit pas à établir le build.",
    "2. Dans Windows PowerShell, remplacez le chemin d’exemple ci-dessous par celui du P1G original chiffré et exécutez la commande. Copiez le SHA-256 de 64 caractères en minuscules dans le lecteur.",
    "3. Sélectionnez ce même original, confirmez la version et le SHA-256 vérifiés séparément, puis ouvrez en lecture seule. La commande lit uniquement le fichier, sans le modifier ni l’envoyer. Conservez l’original."
  ],
  "it": [
    "Prima di aprire un salvataggio Steam",
    "1. Verifica la versione del gioco Steam installato su Windows. Il lettore supporta Steam 1.25.3 (schema 626). Il nome del file o il numero di schema da soli non identificano il build.",
    "2. In Windows PowerShell, sostituisci il percorso di esempio con quello del P1G originale cifrato ed esegui il comando. Copia lo SHA-256 di 64 caratteri minuscoli nel lettore.",
    "3. Seleziona lo stesso originale, conferma versione e SHA-256 verificati separatamente e apri in sola lettura. Il comando legge soltanto il file, senza modificarlo né caricarlo. Conserva l’originale."
  ],
  "de": [
    "Vor dem Öffnen eines Steam-Spielstands",
    "1. Prüfe die installierte Steam-Spielversion unter Windows. Dieser Reader unterstützt Steam 1.25.3 (Schema 626). Dateiname oder Schemanummer allein bestimmen den Build nicht.",
    "2. Ersetze in Windows PowerShell den Beispielpfad durch den Pfad zur verschlüsselten P1G-Originaldatei und führe den Befehl aus. Kopiere den 64-stelligen SHA-256 in Kleinbuchstaben in den Reader.",
    "3. Wähle dieselbe Originaldatei, bestätige die separat geprüfte Version und den SHA-256 und öffne schreibgeschützt. Der Befehl liest die Datei nur, ohne Änderung oder Upload. Bewahre das Original auf."
  ],
  "es-ES": [
    "Antes de abrir un guardado de Steam",
    "1. Comprueba la versión instalada del juego de Steam en Windows. Este lector admite Steam 1.25.3 (esquema 626). El nombre del archivo o el esquema por sí solos no identifican la compilación.",
    "2. En Windows PowerShell, sustituye la ruta de ejemplo por la del P1G original cifrado y ejecuta el comando. Copia el SHA-256 de 64 caracteres en minúsculas en el lector.",
    "3. Selecciona ese mismo original, confirma la versión y el SHA-256 comprobados por separado y abre en solo lectura. El comando solo lee el archivo, sin modificarlo ni subirlo. Conserva el original."
  ],
  "zh-CN": [
    "打开 Steam 存档前的准备",
    "1. 确认 Windows Steam 中已安装的游戏版本。本读取器支持 Steam 1.25.3（schema 626）。仅凭文件名或 schema 编号不能确认游戏构建版本。",
    "2. 在 Windows PowerShell 中，将下面示例路径替换为加密原始 P1G 文件的实际路径并运行命令。将输出的 64 位小写 SHA-256 输入读取器。",
    "3. 选择同一原始文件，确认独立核验的版本和 SHA-256，然后以只读方式打开。该命令仅读取文件，不修改或上传。请保留原始文件。"
  ],
  "pt-BR": [
    "Antes de abrir um save do Steam",
    "1. Confira a versão instalada do jogo Steam no Windows. Este leitor aceita Steam 1.25.3 (schema 626). O nome do arquivo ou o número do schema, isoladamente, não identifica a build.",
    "2. No Windows PowerShell, substitua o caminho de exemplo pelo caminho do P1G original criptografado e execute o comando. Copie o SHA-256 de 64 caracteres minúsculos para o leitor.",
    "3. Selecione o mesmo original, confirme a versão e o SHA-256 verificados separadamente e abra em modo somente leitura. O comando apenas lê o arquivo, sem alterar ou enviar. Preserve o original."
  ]
};
export function steamReaderInputHelp(locale){
 const [title,version,hash,open]=Object.hasOwn(labels,locale)?labels[locale]:labels.en;
 return Object.freeze({title,version,hash,open});
}
