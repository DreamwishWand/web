import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { constructCandidateTree } from '../scripts/int-candidate-tree.mjs';

test('candidate exact ADD/MOD/DELETE/mode on squash-equivalent main; leaves refs/index/worktree alone',()=>{
 const dir=mkdtempSync(join(tmpdir(),'wand-candidate-test-'));
 const git=(...args)=>execFileSync('git',args,{cwd:dir,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
 const write=(p,s)=>writeFileSync(join(dir,p),s);
 const commit=m=>{git('add','-A');git('commit','-m',m);return git('rev-parse','HEAD');};
 try{
  git('init','-b','main');git('config','user.name','Synthetic');git('config','user.email','synthetic@example.invalid');git('config','core.filemode','true');
  write('a.txt','old');write('remove.txt','remove');write('mode.txt','script');commit('root');
  git('checkout','-b','source');write('parent.txt','parent');const base=commit('parent');
  write('a.txt','new');write('add.txt','add');rmSync(join(dir,'remove.txt'));chmodSync(join(dir,'mode.txt'),0o755);const source=commit('child');
  git('checkout','main');write('parent.txt','parent');write('unrelated.txt','keep');const main=commit('main');
  write('a.txt','uncommitted');git('add','a.txt');write('untracked.txt','untouched');
  const index=readFileSync(join(dir,'.git','index')),refs=git('show-ref'),status=git('status','--porcelain');
  const input={base,source,main,paths:['remove.txt','mode.txt','add.txt','a.txt']};
  const out=constructCandidateTree(dir,input);
  assert.equal(out.status,'EXACT_CANDIDATE_TREE_ONLY');assert.equal(out.mergeAuthorized,false);
  assert.equal(out.acceptanceVerified,false);assert.equal(out.remoteFreshnessVerified,false);assert.equal(out.refsUpdated,false);
  assert.equal(git('show',out.tree+':a.txt'),'new');assert.equal(git('show',out.tree+':add.txt'),'add');
  assert.equal(git('show',out.tree+':unrelated.txt'),'keep');assert.equal(git('ls-tree',out.tree,'remove.txt'),'');
  assert.match(git('ls-tree',out.tree,'mode.txt'),/^100755 blob /);
  assert.equal(constructCandidateTree(dir,input).tree,out.tree);
  assert.equal(git('show-ref'),refs);assert.equal(git('rev-parse','HEAD'),main);
  assert.deepEqual(readFileSync(join(dir,'.git','index')),index);
  assert.equal(git('status','--porcelain'),status);assert.equal(readFileSync(join(dir,'a.txt'),'utf8'),'uncommitted');
  assert.throws(()=>constructCandidateTree(dir,{...input,paths:['a.txt']}),/SOURCE_PATH_SET_MISMATCH/);
  assert.throws(()=>constructCandidateTree(dir,{...input,main:source}),/MAIN_PREIMAGE_MISMATCH/);
  assert.equal(git('show-ref'),refs);assert.deepEqual(readFileSync(join(dir,'.git','index')),index);
 }finally{rmSync(dir,{recursive:true,force:true});}
});

test('historical actual protected main transition reconstructs exact integrated tree',(t)=>{
 // Historical nonprivate Git-only example. Existing CI uses checkout fetch-depth:0.
 // This is a tree replay, not a new acceptance or a current remote freshness check.
 const cwd=process.cwd();
 const git=(...args)=>execFileSync('git',args,{cwd,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
 const base='c40fe718fec1fa52462e68cdcf96051d72f24310',source='31ce87aaac5925f33e052b60110593589337f4b4';
 // Local shallow checkouts may lack historical objects; CI full checkout must have them.
 try{git('cat-file','-e',base+'^{commit}');git('cat-file','-e',source+'^{commit}');}
 catch(error){if(process.env.CI==='true')throw error;t.skip('Historical Git objects unavailable in local shallow checkout');return;}
 const paths=['scripts/01a-main-w1-preview-browser.mjs','src/lib/ddv/core/save/local-original-backup.mjs','src/lib/ddv/core/save/local-save-session-bridge.mjs','src/lib/wep/SteamSavedDiffGridsReadonly.svelte','src/lib/wep/steam-saved-diffgrids-copy.mjs','tests/timing-w1-preview.test.mjs','tests/web-steam-saved-diffgrids-consumer.test.mjs','tests/web-steam-saved-diffgrids-real-chrome.mjs'];
 const out=constructCandidateTree(cwd,{base,source,main:base,paths});
 assert.equal(out.tree,'93feeabb5a453093b392cfda04787391b92fd904');
 assert.equal(out.tree,git('rev-parse',source+'^{tree}'));
 assert.equal(out.entries.length,8);
 assert.equal(out.mergeAuthorized,false);
 assert.throws(()=>constructCandidateTree(cwd,{base,source,main:source,paths}),/MAIN_PREIMAGE_MISMATCH/);
});
