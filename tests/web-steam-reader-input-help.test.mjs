import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {STEAM_INPUT_HASH_COMMAND,steamReaderInputHelp} from '../src/lib/wep/steam-reader-input-help.mjs';
import {STEAM_DIFFGRIDS_LOCALES} from '../src/lib/wep/steam-saved-diffgrids-copy.mjs';
test('eight localized independent Windows input instructions and literal read-only example',()=>{
 const expected={"en":"Before opening a Steam save","ja":"Steamセーブを開く前の準備","fr":"Avant d’ouvrir une sauvegarde Steam","it":"Prima di aprire un salvataggio Steam","de":"Vor dem Öffnen eines Steam-Spielstands","es-ES":"Antes de abrir un guardado de Steam","zh-CN":"打开 Steam 存档前的准备","pt-BR":"Antes de abrir um save do Steam"};
 for(const locale of STEAM_DIFFGRIDS_LOCALES){
  const copy=steamReaderInputHelp(locale);
  assert.equal(copy.title,expected[locale]);
  assert.match(copy.version,/1\.25\.3/);assert.match(copy.version,/626/);
  assert.match(copy.hash,/Windows PowerShell/);assert.match(copy.hash,/SHA-256/);assert.match(copy.hash,/64/);
  assert.match(copy.open,/SHA-256/);assert.ok(Object.isFrozen(copy));
 }
 assert.deepEqual(steamReaderInputHelp('unknown'),steamReaderInputHelp('en'));
 assert.equal(STEAM_INPUT_HASH_COMMAND,"(Get-FileHash -LiteralPath 'C:\\path\\profile.p1g' -Algorithm SHA256).Hash.ToLowerInvariant()");
});
test('dedicated help is display-only and existing Reader/robots remain intact',()=>{
 const page=readFileSync(new URL('../src/routes/editor/steam-reader/+page.svelte',import.meta.url),'utf8');
 assert.match(page,/<details class="input-help" data-steam-input-help>/);
 assert.match(page,/<summary>\{prep.title\}<\/summary>/);
 assert.match(page,/<pre><code>\{STEAM_INPUT_HASH_COMMAND\}<\/code><\/pre>/);
 assert.match(page,/<SteamSavedDiffGridsReadonly preformal=\{true\} \/>/);
 assert.match(page,/<meta name="robots" content="noindex,nofollow" \/>/);
 assert.doesNotMatch(page,/on:click|fetch\(|new Worker|type="file"|crypto\.subtle/);
});
