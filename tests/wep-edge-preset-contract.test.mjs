import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read=(path)=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8');

test('WEP Preset Edge validator uses executable portable identity regexes',()=>{
  const source=read('supabase/functions/wep-preset-artifact/index.ts');
  assert.match(source,/\/\^o\\d\+\$\//);
  assert.match(source,/\/\^c\\d\+\$\//);
  assert.match(source,/\/\^n\\d\+\$\//);
  assert.doesNotMatch(source,/\/\^o\\\\d\+\$\//);
  assert.doesNotMatch(source,/\/\^c\\\\d\+\$\//);
  assert.doesNotMatch(source,/\/\^n\\\\d\+\$\//);
});

test('WEP Preset Edge storage namespace is stable WandAccount identity',()=>{
  const source=read('supabase/functions/wep-preset-artifact/index.ts');
  assert.match(source,/staging\/\$\{accountId\}\//);
  assert.match(source,/published\/\$\{accountId\}\//);
  assert.doesNotMatch(source,/staging\/\$\{subject\}\//);
  assert.doesNotMatch(source,/published\/\$\{subject\}\//);
});
