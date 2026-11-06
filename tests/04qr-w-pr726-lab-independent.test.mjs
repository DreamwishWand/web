// 04 QR-W NEW_ONLY independently pins 08 WEB PR726 original Source4.
// Local source/prerender only: no actual hosted HTTP, Auth/RLS/CDN or public permission claim.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';

const BASE='3613cf847bec5306a3e0c234ff3bca876546a335';
const SOURCE='6156774111334275f081503f25249589e843413e';
const SOURCE_FILES=new Map([
  ['.github/workflows/web-internal-lab-robots.yml','e3ff7e2f4f280a04c5e8372e7f740b0aa060b068'],
  ['scripts/web-internal-lab-robots-chrome.mjs','988ff4e66072f82d353f12bfecc7866c6c7d152c'],
  ['src/routes/community-lab/+page.svelte','933863a1ae3e232bd2b76854154b41afe10c77ac'],
  ['tests/web-internal-lab-robots.test.mjs','cf0cb6b1075763bf7fcc357ae5c2e0f3f5e76ae7']
]);
const QA_FILES=[
  '.github/workflows/04qr-w-pr726-lab-independent.yml',
  'scripts/04qr-w-pr726-lab-chrome.mjs',
  'tests/04qr-w-pr726-lab-independent.test.mjs'
].sort();
const command=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
const files=(a,b)=>command('diff','--name-only',a,b).split('\n').filter(Boolean).sort();
const raw=path=>readFileSync(path,'utf8');
const rootPath='src/routes/community-lab/+page.svelte';
const root=raw(rootPath);
const older=command('show',BASE+':'+rootPath);
const meta='  <meta name="robots" content="noindex,nofollow" />\n';
const underTest=[
 'src/routes/community-lab/account/+page.svelte',
 'src/routes/community-lab/profiles/+page.svelte',
 'src/routes/community-lab/recovery/+page.svelte',
 'src/routes/community-ops/+page.svelte'
];

test('QR726-01 original four fixed Source blobs, one Source commit, and exactly three QA-only additions',()=>{
  assert.equal(command('rev-parse',SOURCE),SOURCE);
  assert.equal(command('merge-base',BASE,SOURCE),BASE);
  assert.equal(command('rev-list','--count',BASE+'..'+SOURCE),'1');
  assert.deepEqual(files(BASE,SOURCE),[...SOURCE_FILES.keys()].sort());
  for(const [path,sha] of SOURCE_FILES){
    assert.equal(command('rev-parse',SOURCE+':'+path),sha,path);
    assert.equal(command('hash-object',path),sha,path+' immutable');
  }
  assert.equal(command('merge-base',SOURCE,'HEAD'),SOURCE);
  assert.deepEqual(files(SOURCE,'HEAD'),QA_FILES);
});

test('QR726-02 source original root is literally unchanged except one noindex,nofollow head tag',()=>{
  assert.equal((root.split(meta).length-1),1,'exactly one root robots meta');
  assert.equal(root.replace(meta,'').trimEnd(),older,'only one addition, no accidental form/RPC rewrite; git show helper trims EOL');
  assert.match(root,/<svelte:head>/);
  assert.match(root,/<title>Community Lab — Dreamwish Wand<\/title>/);
  assert.match(root,/<meta name="robots" content="noindex,nofollow" \/>/);
  assert.match(root,/<a href="profiles\/">Profile Workspace acceptance<\/a>/);
  assert.match(root,/<a href="account\/">Account deletion acceptance<\/a>/);
  assert.match(root,/<button on:click=\{signIn\} disabled=\{busy \|\| !email \|\| !password \|\| !publishableKey\}>/);
  assert.match(root,/<h1>Community Lab<\/h1>/);
});

test('QR726-03 all child and ops robots remain exact and source blobs byte-identical',()=>{
  for(const path of underTest){
    assert.equal(command('rev-parse',SOURCE+':'+path),command('rev-parse',BASE+':'+path),path);
    const s=raw(path);
    assert.equal((s.match(/<meta name="robots" content="noindex,nofollow" \/>/g)??[]).length,1,path);
    assert.match(s,/<svelte:head>/,path);
  }
});

test('QR726-04 no layout, static files, community APIs, permissions, auth, provider or Pages config changed',()=>{
  const preserved=[
   '.github/workflows/ci.yml',
   '.github/workflows/pages.yml',
   'package.json',
   'package-lock.json',
   'svelte.config.js',
   'src/lib/community/staging-http-client.ts',
   'src/routes/+page.svelte',
   'static/ddv/integrity/promoted-baselines.json'
  ];
  for(const path of preserved){
    // Check paths present on this frozen base; paths absent on both trees are not a Scope check.
    assert.equal(command('rev-parse',SOURCE+':'+path),command('rev-parse',BASE+':'+path),path);
  }
  assert.deepEqual(files(BASE,SOURCE).filter(p=>p.startsWith('supabase/')||p.startsWith('static/')||p.startsWith('src/lib/')),[]);
  const pages=raw('.github/workflows/pages.yml');
  assert.match(pages,/build\/community-lab\/index\.html/);
  assert.match(pages,/actions\/deploy-pages@v4/);
  const qa=raw('.github/workflows/04qr-w-pr726-lab-independent.yml');
  assert.match(qa,/permissions:\s*\n\s*contents: read/);
  assert.doesNotMatch(qa,/deploy-pages|pages:\s*write/);
});

test('QR726-05 robot hint is not false access control and password/Account workflow retained',()=>{
  assert.match(root,/CommunityLabClient/);
  assert.match(root,/sessionStorage\.getItem\(CONFIG_KEY\)/);
  assert.match(root,/on:click=\{signIn\}/);
  assert.match(root,/type="password"/);
  assert.match(root,/name="robots" content="noindex,nofollow"/);
  assert.doesNotMatch(meta,/auth|block|private|deny|401/);
  assert.equal((root.match(/<meta name="robots"/g)??[]).length,1);
});