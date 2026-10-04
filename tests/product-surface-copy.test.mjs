import test from 'node:test';
import assert from 'node:assert/strict';

import { HOME_COPY } from '../src/lib/product-home/copy.js';
import { MOODBOARD_COPY } from '../src/lib/moodboards/copy.js';
import { COLLECTION_COPY } from '../src/lib/collection/copy.js';
import { GUIDE_COPY } from '../src/lib/guide/copy.js';
import { EXPLORE_COPY } from '../src/lib/explore/copy.js';
import { NATIVE_PRESET_COPY } from '../src/lib/presets/native-preset-copy.js';

const locales=['en','fr','it','de','es-ES','ja','zh-CN','pt-BR'];
const surfaces={HOME_COPY,MOODBOARD_COPY,COLLECTION_COPY,GUIDE_COPY,EXPLORE_COPY,NATIVE_PRESET_COPY};

test('new Product surfaces contain the exact eight launch locales with key parity',()=>{
  for(const [name,catalog] of Object.entries(surfaces)){
    assert.deepEqual(Object.keys(catalog).sort(),[...locales].sort(),name+' locale set');
    const base=Object.keys(catalog.en).sort();
    for(const locale of locales){
      assert.deepEqual(Object.keys(catalog[locale]).sort(),base,`${name} ${locale} key parity`);
      for(const key of base)assert.equal(typeof catalog[locale][key],'string',`${name} ${locale} ${key}`);
    }
  }
});
