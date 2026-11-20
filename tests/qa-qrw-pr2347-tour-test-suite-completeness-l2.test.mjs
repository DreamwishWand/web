// 04 QR-W independent changed-only L2: source PR2347 test-suite completeness.
// Tests the actual pinned runner copy in isolated tiny temp trees. Does NOT
// modify product tests, gate Pages, mock Chrome in production, or use owner data.
import test from 'node:test';
import assert from 'node:assert/strict';
import {copyFileSync,existsSync,mkdirSync,mkdtempSync,readFileSync,rmSync,symlinkSync,writeFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
const SOURCE=new URL('../scripts/web-serial-tour-test-runner.mjs',import.meta.url);
const TEST='web-presets-my-tour-contract.test.mjs';
function fixture(){
  const root=mkdtempSync(join(tmpdir(),'04qrw2347-'));
  mkdirSync(join(root,'tests'));
  mkdirSync(join(root,'scripts'));
  mkdirSync(join(root,'fixtures'));
  copyFileSync(fileURLToPath(SOURCE),join(root,'scripts','web-serial-tour-test-runner.mjs'));
  writeFileSync(join(root,'package.json'),'{"type":"module"}\n');
  const file=(name,label,fail=false,folder='tests')=>{
    const code="import test from 'node:test';\n"+
      "import {appendFileSync} from 'node:fs';\n"+
      "appendFileSync('marker.txt',"+JSON.stringify(label+'\n')+");\n"+
      "test("+JSON.stringify(label)+",()=>{"+(fail?"throw Error('INJECTED_FAIL')":"")+"});\n";
    writeFileSync(join(root,folder,name),code);
  };
  const run=()=>spawnSync(process.execPath,[join(root,'scripts','web-serial-tour-test-runner.mjs')],{
    cwd:root,encoding:'utf8',timeout:30000,maxBuffer:8*1024*1024,
    // Nested node --test would skip all child test files if this inherited.
    env:{...process.env,NODE_TEST_CONTEXT:undefined}
  });
  const seen=()=>existsSync(join(root,'marker.txt'))?
    readFileSync(join(root,'marker.txt'),'utf8').trim().split('\n'):[];
  const clean=()=>rmSync(root,{recursive:true,force:true});
  return {root,file,run,seen,clean};
}
test('all regular top-level *.test.mjs execute exactly once, ordinary before real Tour',()=>{
 const f=fixture();
 try{
   f.file('alpha.test.mjs','ALPHA');
   f.file('beta.test.mjs','BETA');
   f.file(TEST,'TOUR');
   const r=f.run();
   assert.equal(r.status,0,r.stderr+'\n'+r.stdout);
   assert.match(r.stdout,/WEB_TEST_PHASE ordinary files=2/);
   assert.match(r.stdout,/WEB_TEST_PHASE real-chrome-isolated files=1/);
   assert.match(r.stdout,/WEB_TEST_ALL_PHASES_PASS count=3/);
   const seen=f.seen();
   assert.deepEqual(seen.slice(0,2).sort(),['ALPHA','BETA']);
   assert.equal(seen[2],'TOUR');
 }finally{f.clean();}
});
test('failed ordinary file denies Tour execution and propagates nonzero',()=>{
 const f=fixture();
 try{
   f.file('fail.test.mjs','ORDINARY_FAIL',true);
   f.file(TEST,'TOUR');
   const r=f.run();
   assert.notEqual(r.status,0);
   assert.deepEqual(f.seen(),['ORDINARY_FAIL']);
   assert.doesNotMatch(r.stdout,/WEB_TEST_ALL_PHASES_PASS/);
 }finally{f.clean();}
});
test('failed real browser phase propagates nonzero without fake PASS',()=>{
 const f=fixture();
 try{
   f.file('ordinary.test.mjs','ORDINARY');
   f.file(TEST,'TOUR_FAIL',true);
   const r=f.run();
   assert.notEqual(r.status,0);
   assert.deepEqual(f.seen(),['ORDINARY','TOUR_FAIL']);
   assert.doesNotMatch(r.stdout,/WEB_TEST_ALL_PHASES_PASS/);
 }finally{f.clean();}
});
test('missing Tour and missing all ordinary tests fail before silent release',()=>{
 for(const missing of ['tour','ordinary']){
   const f=fixture();
   try{
     if(missing==='tour')f.file('ordinary.test.mjs','ORDINARY');
     else f.file(TEST,'TOUR');
     const r=f.run();
     assert.notEqual(r.status,0);
     assert.match(r.stderr,/WEB_TEST_DISCOVERY_MISSING/);
     assert.deepEqual(f.seen(),[]);
   }finally{f.clean();}
 }
});
test('symlinked *.test.mjs must execute OR explicitly fail; cannot silently omit it',()=>{
 const f=fixture();
 try{
   f.file('ordinary.test.mjs','ORDINARY');
   f.file(TEST,'TOUR');
   f.file('linked-fixture.mjs','SYMLINK_TEST',false,'fixtures');
   symlinkSync('../fixtures/linked-fixture.mjs',join(f.root,'tests','z-link.test.mjs'));
   const r=f.run();
   assert.ok(r.status!==0 || f.seen().includes('SYMLINK_TEST'),
     'TRUE_RED: historical node --test tests/*.test.mjs includes symlink; new isFile() silently drops it and claims all tests passed. stdout='+r.stdout.slice(-700));
 }finally{f.clean();}
});
test('directory named *.test.mjs cannot be silently ignored as a changed test path',()=>{
 const f=fixture();
 try{
   f.file('ordinary.test.mjs','ORDINARY');
   f.file(TEST,'TOUR');
   mkdirSync(join(f.root,'tests','z-dir.test.mjs'));
   const r=f.run();
   assert.notEqual(r.status,0,
     'TRUE_RED: wildcard-covered nonregular path omitted with false complete test count');
 }finally{f.clean();}
});
