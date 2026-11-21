import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const get=(part)=>readFileSync(new URL('../src/routes/'+part,import.meta.url),'utf8');
const root=get('community-lab/+page.svelte');
const children=['community-lab/account/+page.svelte','community-lab/profiles/+page.svelte','community-lab/recovery/+page.svelte','community-ops/+page.svelte'];

test('internal Community Lab root has one noindex,nofollow robots head and retains local navigation',()=>{
 const head=root.match(/<svelte:head>([\s\S]*?)<\/svelte:head>/)?.[1];
 assert.ok(head,'root head missing');
 assert.equal((head.match(/name="robots"/g)||[]).length,1,'duplicate robots directives');
 assert.match(head,/<meta name="robots" content="noindex,nofollow" \/>/);
 assert.match(head,/<title>Community Lab — Dreamwish Wand<\/title>/);
 assert.match(root,/<a href="profiles\/">Profile Workspace acceptance<\/a>/);
 assert.match(root,/<a href="account\/">Account deletion acceptance<\/a>/);
 assert.match(root,/INTERNAL · STAGING ONLY/);
 assert.match(root,/function configureClient\(\)/);
 assert.match(root,/async function signIn\(\)/);
 assert.doesNotMatch(head,/index,follow|noarchive,none|canonical|refresh/i);
});

test('all existing internal Community children and ops remain noindex without replacing routes',()=>{
 for(const child of children){
  const page=get(child), head=page.match(/<svelte:head>([\s\S]*?)<\/svelte:head>/)?.[1];
  assert.ok(head,child+' missing head');
  assert.match(head,/<meta name="robots" content="noindex,nofollow" \/>/,child);
  assert.equal((head.match(/name="robots"/g)||[]).length,1,child+' duplicate robots');
 }
});

test('noindex is discoverability hint, not authorization or a change to staging provider/Writer',()=>{
 assert.match(root,/CommunityLabClient/);
 assert.match(root,/sessionStorage\.getItem\(CONFIG_KEY\)/);
 assert.doesNotMatch(root,/fetch\(.+\/functions\/v1\//);
 const newMeta=root.match(/<meta name="robots" content="([^"]+)" \/>/)?.[1];
 assert.equal(newMeta,'noindex,nofollow');
});
