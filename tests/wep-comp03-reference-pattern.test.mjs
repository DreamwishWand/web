import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { compile } from 'svelte/compiler';
import { render } from 'svelte/server';

const root = fileURLToPath(new URL('../', import.meta.url));
const sourcePath = resolve(root, 'src/lib/wep/Comp03ReferencePattern.svelte');

test('COMP03 reference pattern SSR: exact 1 + 8, eight locales, no interactive authority', async () => {
  const source = await readFile(sourcePath, 'utf8');
  const compiled = compile(source, { filename: sourcePath, generate: 'server' });
  const temp = await mkdtemp(join(root, '.wand-comp03-preview-'));
  try {
    const file = join(temp, 'reference.mjs');
    await writeFile(file, compiled.js.code, 'utf8');
    const { default: ReferencePattern } = await import(pathToFileURL(file).href);
    const expected = {
  "en": "3 × 3 road reference pattern",
  "fr": "Motif de route de référence 3 × 3",
  "it": "Schema stradale di riferimento 3 × 3",
  "de": "3 × 3 Straßen-Referenzmuster",
  "es-ES": "Patrón de camino de referencia 3 × 3",
  "ja": "道路の参考配置 3 × 3",
  "zh-CN": "3 × 3 道路参考布局",
  "pt-BR": "Padrão de referência de caminho 3 × 3"
};
    for (const [locale, title] of Object.entries(expected)) {
      const { body } = render(ReferencePattern, { props: { locale } });
      assert.ok(body.includes(title), locale);
      const cells = [...body.matchAll(/data-comp03-reference-cell="(seed|addition)"/g)].map(m => m[1]);
      assert.deepEqual(cells, ['seed', ...Array(8).fill('addition')], locale);
      assert.match(body, /role="img" aria-label="[^"]+"/);
      assert.equal((body.match(/data-comp03-reference-pattern/g) || []).length, 1);
      assert.doesNotMatch(body, /<(?:button|input|form|a)(?:\s|>)/i);
      assert.doesNotMatch(body, /(?:data-target|data-object-id|data-grid-id|data-save|data-command)=/i);
    }
    const english = render(ReferencePattern, { props: { locale: 'en' } }).body;
    assert.ok(english.includes('Illustration only. The current save, eligibility and placement are not checked here.'));
    for (const locale of ['unknown', '__proto__', 'constructor']) {
      assert.equal(render(ReferencePattern, { props: { locale } }).body, english);
    }
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});
