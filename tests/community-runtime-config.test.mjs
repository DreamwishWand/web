import test from 'node:test';
import assert from 'node:assert/strict';
import { readCommunityBrowserConfig } from '../src/lib/community/runtime-config.ts';

test('product runtime config prefers environment values', () => {
  const result=readCommunityBrowserConfig({
    env:{
      VITE_DREAMWISH_SUPABASE_URL:'https://example.supabase.co/',
      VITE_DREAMWISH_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_env'
    },
    storage:{getItem(){return JSON.stringify({supabaseUrl:'https://lab.supabase.co',publishableKey:'sb_publishable_lab'});}}
  });
  assert.deepEqual(result,{
    supabaseUrl:'https://example.supabase.co',
    publishableKey:'sb_publishable_env',
    source:'environment'
  });
});

test('staging Lab config is only a fallback', () => {
  const result=readCommunityBrowserConfig({
    env:{},
    storage:{getItem(){return JSON.stringify({supabaseUrl:'https://lab.supabase.co',publishableKey:'sb_publishable_lab'});}}
  });
  assert.equal(result?.source,'staging-lab');
});

test('missing or malformed config fails closed', () => {
  assert.equal(readCommunityBrowserConfig({env:{},storage:{getItem(){return null;}}}),null);
  assert.equal(readCommunityBrowserConfig({
    env:{VITE_SUPABASE_URL:'http://bad',VITE_SUPABASE_PUBLISHABLE_KEY:'bad'},
    storage:{getItem(){return '{bad';}}
  }),null);
});
