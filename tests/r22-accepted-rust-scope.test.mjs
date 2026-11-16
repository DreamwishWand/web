import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync,mkdirSync,chmodSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {execFileSync} from 'node:child_process';
import {verifyExactScopeEntries,verifyAcceptedRustScope} from '../scripts/wasm-distribution/r22-accepted-rust-scope.mjs';

test('R22 exact scope requires all paths, modes and both blobs; no authority grant',()=>{
 const dir=mkdtempSync(join(tmpdir(),'wand-r22-scope-'));
 const git=(...a)=>execFileSync('git',a,{cwd:dir,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
 const write=(p,s)=>{mkdirSync(dirname(join(dir,p)),{recursive:true});writeFileSync(join(dir,p),s)};
 const commit=m=>{git('add','-A');git('commit','-m',m);return git('rev-parse','HEAD')};
 const a='crates/ddv-save-core/src/lib.rs',b='crates/ddv-save-core/src/new.rs';
 try{
  git('init','-b','main');git('config','user.name','Synthetic');git('config','user.email','synthetic@example.invalid');
  write(a,'old');write('README.md','old');const base=commit('base');
  write(a,'accepted');write(b,'new');const head=commit('exact');
  const pin=(rev,path)=>({mode:'100644',blob:git('rev-parse',rev+':'+path)});
  const approved=[{path:a,before:pin(base,a),after:pin(head,a)},{path:b,before:null,after:pin(head,b)}];
  const result=verifyExactScopeEntries(dir,base,head,approved);
  assert.equal(result.entries.length,2);assert.equal(result.mergeAuthorized,false);
  assert.throws(()=>verifyExactScopeEntries(dir,base,head,[approved[0]]));
  assert.throws(()=>verifyExactScopeEntries(dir,base,head,[...approved,{path:'README.md',before:null,after:pin(head,'README.md')}]));
  for(const bad of [{...approved[0],before:pin(head,a)},{...approved[0],after:pin(base,a)},
   {...approved[0],after:{...pin(head,a),mode:'100755'}},{...approved[0],before:null}]){
   assert.throws(()=>verifyExactScopeEntries(dir,base,head,[bad,approved[1]]));
  }
  write('README.md','unapproved');const extra=commit('extra');
  assert.throws(()=>verifyExactScopeEntries(dir,base,extra,approved));
  git('checkout','--detach',head);write(a,'changed');const altered=commit('altered');
  assert.throws(()=>verifyExactScopeEntries(dir,base,altered,approved));
  git('checkout','--detach',head);chmodSync(join(dir,a),0o755);const mode=commit('mode');
  assert.throws(()=>verifyExactScopeEntries(dir,base,mode,approved));
  // Source-only / arbitrary ancestry cannot invoke production fixed scope.
  assert.throws(()=>verifyAcceptedRustScope(dir,base,head));
  assert.throws(()=>verifyAcceptedRustScope(dir,'not-a-sha',head));
 }finally{rmSync(dir,{recursive:true,force:true})}
});
