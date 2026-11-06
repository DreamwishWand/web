// 04 QR-W independent new-only QA: Owner-approved exact ROOT README.md removal.
// No Source edits, Pages deployment, private Save or public visibility changes.
import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {existsSync,readFileSync} from 'node:fs';

const BASE='6b92d95db0f7c017a4fd37817b8b88811c50c0de';
const SOURCE='0c0870b59cef103b0c10705cc20e6450127fbd41';
const DELETED_BLOB='9f6ad24a635924d01e7097402ba0abeb524734ac';
const QA=[
 '.github/workflows/04qr-w-pr723-readme-independent.yml',
 'tests/04qr-w-pr723-readme-independent.test.mjs'
].sort();
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
const paths=(a,b)=>git('diff','--name-only',a,b).split('\n').filter(Boolean).sort();
const namesStatus=(a,b)=>git('diff','--name-status',a,b).split('\n').filter(Boolean);
const tracked=(ref)=>git('ls-tree','-r','--name-only',ref).split('\n').filter(Boolean);
const preserve=[
 '.github/workflows/ci.yml',
 '.github/workflows/pages.yml',
 'package.json',
 'package-lock.json',
 'svelte.config.js',
 'src/routes/+page.svelte',
 'src/routes/help/+page.svelte',
 'static/ddv/integrity/promoted-baselines.json'
];

test('QR723-01 original root README blob removed in one-path one-commit fixed Source',()=>{
 assert.equal(git('rev-parse',SOURCE),SOURCE);
 assert.equal(git('rev-parse',BASE),BASE);
 assert.equal(git('merge-base',BASE,SOURCE),BASE);
 assert.equal(git('rev-parse',BASE+':README.md'),DELETED_BLOB);
 assert.deepEqual(namesStatus(BASE,SOURCE),['D\tREADME.md']);
 assert.deepEqual(paths(BASE,SOURCE),['README.md']);
 assert.equal(git('rev-list','--count',BASE+'..'+SOURCE),'1');
 assert.equal(tracked(SOURCE).includes('README.md'),false);
 assert.equal(existsSync('README.md'),false);
});

test('QR723-02 QA HEAD only adds two independent files and cannot undo or bundle any deletion',()=>{
 assert.equal(git('merge-base',SOURCE,'HEAD'),SOURCE);
 assert.deepEqual(paths(SOURCE,'HEAD'),QA);
 assert.deepEqual(namesStatus(SOURCE,'HEAD'),QA.map(p=>'A\t'+p));
 assert.equal(existsSync('README.md'),false);
});

test('QR723-03 nested README documents and static assets are kept byte-identical',()=>{
 const before=tracked(BASE);
 const after=tracked(SOURCE);
 assert.deepEqual(after,before.filter(p=>p!=='README.md'));
 const nested=before.filter(p=>p.endsWith('/README.md'));
 assert.ok(nested.length>=1,'the owner has not authorized deleting nested README files');
 assert.ok(nested.every(p=>after.includes(p)));
 for(const p of [...preserve,...nested]){
  assert.equal(git('rev-parse',SOURCE+':'+p),git('rev-parse',BASE+':'+p),'must preserve '+p);
 }
});

test('QR723-04 site build/Pages inputs remain unchanged; QA branch never publishes',()=>{
 const pkg=JSON.parse(readFileSync('package.json','utf8'));
 for(const key of ['build','check','test','verify:canonical','verify:community-ops','verify:community-integrated-tree'])
  assert.ok(typeof pkg.scripts[key]==='string' && pkg.scripts[key].length>2,key);
 assert.ok(pkg.scripts.build.includes('vite build'));
 const pages=readFileSync('.github/workflows/pages.yml','utf8');
 assert.match(pages,/branches:\s*\[main\]/);
 assert.match(pages,/BASE_PATH:\s*\/web/);
 assert.match(pages,/npm run build/);
 assert.match(pages,/test -f build\/index\.html/);
 assert.match(pages,/test -f build\/help\/index\.html/);
 assert.match(pages,/test -f build\/community-lab\/index\.html/);
 assert.match(pages,/actions\/deploy-pages@v4/);
 assert.doesNotMatch(pages,/readme\.md/i);
 const qaWorkflow=readFileSync('.github/workflows/04qr-w-pr723-readme-independent.yml','utf8');
 assert.doesNotMatch(qaWorkflow,/deploy-pages|pages:\s*write|push:\s*\n\s*branches:\s*\[main\]/);
 assert.match(qaWorkflow,/permissions:\s*\n\s*contents:\s*read/);
});

test('QR723-05 executable code cannot require or copy the deleted root README',()=>{
 const files=git('ls-files','-z').split('\0').filter(p=>p&&(
   p==='package.json'||p==='svelte.config.js'||p==='vite.config.ts'||
   p.startsWith('.github/workflows/')||p.startsWith('scripts/')||
   p.startsWith('src/')
 )).filter(p=>/\.(?:js|mjs|cjs|ts|svelte|json|ya?ml|sh)$/.test(p));
 const patterns=[
  /(?:readFileSync|readFile|copyFileSync|copyFile|require|import|fetch|open)\s*\([^;\n]{0,220}['"\x60](?:\.\/)?README\.md['"\x60]/,
  /(?:^|\s)(?:cp|cat|source|test\s+-f)\s+(?:-[-A-Za-z]+\s+)*(?:\.\/)?README\.md(?:\s|$)/,
  /(?:^|\s)(?:uses|working-directory|entrypoint|path):\s*(?:\.\/)?README\.md\s*$/i
 ];
 const actionable=[];
 for(const p of files){
  const content=readFileSync(p,'utf8');
  for(const [i,line] of content.split('\n').entries()){
   if(patterns.some(rx=>rx.test(line)) && !/^\s*(?:\/\/|#|\*|<!--)/.test(line))
    actionable.push(p+':'+(i+1)+':'+line.trim().slice(0,150));
  }
 }
 assert.deepEqual(actionable,[],'runtime/build input references to deleted root README');
});

test('QR723-06 deleting README cannot alter product/config/native permission',()=>{
 const code=paths(BASE,SOURCE);
 assert.ok(!code.some(p=>/^(?:src|static|supabase|packages|crates|scripts|\.github)\/|^package\.json/.test(p)));
 for(const p of ['src/routes/+page.svelte','src/routes/help/+page.svelte','.github/workflows/pages.yml','.github/workflows/ci.yml'])
  assert.ok(existsSync(p),p);
});