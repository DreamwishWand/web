// 09P CODE ACT1581: source-only exact1 BattlePass subscriber Rust trust,
// NEVER a Merge, Pages, writer, product consumer, or Op authority.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {verifyAcceptedRustScope} from '../scripts/wasm-distribution/r22-accepted-rust-scope.mjs';

const cwd=resolve(fileURLToPath(new URL('../',import.meta.url)));
const protectedMain='f62d591006c6244123283e0d2b100dd0ce68af8c';
const gatePath='scripts/wasm-distribution/r22-accepted-rust-scope.mjs';
const rustPath='crates/ddv-save-core/src/product_amount_scoped.rs';
const oldRust='e6e360f5326b9a5cf6884600a4c9ecf642aa12fa';
const newRust='13d861165bea3fb37f79d7bbc4cb9ab51669fa78';
const futureGate='949eda609e5ea91b1d7482d7f5c0324197f95323';
const env={...process.env,GIT_NO_REPLACE_OBJECTS:'1',
 GIT_AUTHOR_NAME:'R22 candidate synthetic exact1',GIT_AUTHOR_EMAIL:'synthetic@example.invalid',
 GIT_COMMITTER_NAME:'R22 candidate synthetic exact1',GIT_COMMITTER_EMAIL:'synthetic@example.invalid'};
const git=(args,extras={})=>execFileSync('git',args,{cwd,encoding:'utf8',
 env:{...env,...extras},maxBuffer:16*1024*1024,
 stdio:['pipe','pipe','pipe']}).trim();
const makeBlob=data=>execFileSync('git',['hash-object','-w','--stdin'],{
 cwd,env,encoding:'utf8',input:data}).trim();
let counter=0;
function synthetic(parent,entries){
 const dir=mkdtempSync(join(tmpdir(),'r22-amount-one-leaf-'));
 try{
  const idx=join(dir,'index-'+(++counter)),e={GIT_INDEX_FILE:idx};
  git(['read-tree',parent+'^{tree}'],e);
  for(const [path,blob,mode='100644'] of entries)
   git(['update-index','--add','--cacheinfo',mode,blob,path],e);
  const tree=git(['write-tree'],e);
  return git(['commit-tree',tree,'-p',parent,'-m','Source-only exact1 synthetic, no ref']);
 }finally{rmSync(dir,{recursive:true,force:true})}
}
function patchOne(data,old,next){
 assert.equal(data.split(old).length,2,'EXACT_SOURCE_PATCH_ANCHOR');
 return data.replace(old,next);
}
const oldSubscriberBlock="            // Event-only task progress is not replayed by this local edit.\n            item_refs(b,f(b,o,\"ItemIdsCollected\")?,0,&mut refs)?;";
const newSubscriberBlock="            // An ongoing Battle Pass objective is a live item subscriber.\n            // Never treat its historical ItemIdsCollected or broad/unknown\n            // ItemFilter as proof of independence from this amount target.\n            if st==\"BattlePassTaskState_OnGoing\"{\n                let filter=leaf(b,f(b,o,\"ItemFilter\")?)?;\n                need(filter_disjoint(&filter,item,furniture),\"PRODUCT_AMOUNT_BATTLEPASS_FILTER\")?;\n                item_refs(b,f(b,o,\"ItemIdsCollected\")?,item,&mut refs)?;\n            }else{\n                // Inactive history is not replayed by a local amount edit.\n                item_refs(b,f(b,o,\"ItemIdsCollected\")?,0,&mut refs)?;\n            }";
const oldRustTestAnchor="    #[test]fn static_layout_reference_bound_no_native_authority(){";
const addedRustTest="    #[test]fn ongoing_battlepass_target_filter_and_collected_id_fail_closed(){\n        for chest in [false,true]{\n            let mut d=if chest{chest_doc()}else{doc()};\n            let (sel,new,item,foreign)=if chest{\n                (ExistingAmountSelection::Chest{container_id:12,slot_index:0},49,30200000,30200001)\n            }else{\n                (ExistingAmountSelection::Inventory{inventory_id:0,item_id:40000048},2,40000048,40000049)\n            };\n            let tasks=&mut d[\"Player\"][\"BattlePassStates\"][\"FtueProgress\"][\"TasksProgress\"];\n            *tasks=json!([{\"TaskState\":\"BattlePassTaskState_OnGoing\",\"Objective\":{\n                \"CurAmount\":0,\"TargetAmount\":1,\"ItemIdsCollected\":[],\n                \"ItemFilter\":{\"Data\":{\"Item\":foreign,\"ItemList\":[],\"AnyActivityItem\":false}}\n            }}]);\n            let check=|v:&Value|->CoreResult<CoreExistingAmountTarget>{\n                let s=open(v);s.preview_scoped_product_amount(scope(&s,WorkerAction::ReadDomain),sel,new)\n            };\n            assert!(check(&d).is_ok(),\"known disjoint ongoing item filter must remain eligible\");\n\n            let mut q=d.clone();\n            q[\"Player\"][\"BattlePassStates\"][\"FtueProgress\"][\"TasksProgress\"][0][\"Objective\"][\"ItemFilter\"][\"Data\"][\"Item\"]=json!(item);\n            assert_eq!(check(&q).unwrap_err().0,\"PRODUCT_AMOUNT_BATTLEPASS_FILTER\");\n\n            let mut q=d.clone();\n            q[\"Player\"][\"BattlePassStates\"][\"FtueProgress\"][\"TasksProgress\"][0][\"Objective\"][\"ItemIdsCollected\"]=json!([item]);\n            assert_eq!(check(&q).unwrap_err().0,\"PRODUCT_AMOUNT_REFERENCE_TARGET\");\n\n            let mut q=d.clone();\n            q[\"Player\"][\"BattlePassStates\"][\"FtueProgress\"][\"TasksProgress\"][0][\"Objective\"][\"ItemFilter\"]=Value::Null;\n            assert_eq!(check(&q).unwrap_err().0,\"PRODUCT_AMOUNT_BATTLEPASS_FILTER\");\n        }\n    }\n\n";

test('ACT1581 approved exact1 BattlePass Rust source reconstructs and rejects forged Core, Cargo, Gate, mode and path',()=>{
 assert.equal(git(['rev-parse',protectedMain+':crates/ddv-save-core']),
  '42086449f9deef26ed48b21d7edab0f5685da7c2');
 assert.equal(git(['rev-parse',protectedMain+':'+rustPath]),oldRust);
 assert.equal(git(['rev-parse',protectedMain+':crates/ddv-save-core/Cargo.toml']),
  '751a73da41d8b58f7de70643f50b97722a3c1260');
 assert.equal(git(['rev-parse',protectedMain+':scripts/wasm-distribution/protected-release-inputs.json']),
  '30551c7cc566614f64c8ba04748c3aef44b419bb');
 assert.ok([ 'd3997b2d4460109562489c6afa2c5d5e51fa2b5a',
  // New ACT1581 Inventory0 Gate-first source selector ONLY; review/merge by
  // independent 04 QR-S and sole09INT required. No new signed/Writer grant.
  '02d8d757fc9dfe7bf85a306fda87e8fd1d76d0ed' ].includes(git(['rev-parse','HEAD:'+gatePath])));
 // Preserve all original Rust bytes, including the final newline.
 const before=execFileSync('git',['show',protectedMain+':'+rustPath],{
  cwd,env,encoding:'utf8'});
 const after=patchOne(patchOne(before,oldSubscriberBlock,newSubscriberBlock),
  oldRustTestAnchor,addedRustTest+oldRustTestAnchor);
 const blob=makeBlob(after);
 assert.equal(blob,newRust,'01A IMMUTABLE RUST SOURCE SHA MISMATCH');
 const base=synthetic(protectedMain,[[gatePath,futureGate]]);
 const approved=synthetic(base,[[rustPath,blob]]);
 const result=verifyAcceptedRustScope(cwd,base,approved);
 assert.equal(result.entryCount,1);
 assert.equal(result.sourcePr,2263);
 assert.equal(result.sourceHead,'906606344b17604fa4eee55e8b0482a5bec40335');
 assert.equal(result.coreBefore,'42086449f9deef26ed48b21d7edab0f5685da7c2');
 assert.equal(result.coreAfter,'36be23f81c4558eafd3557c85ac71ea56a1e3459');
 assert.equal(result.mergeAuthorized,false);
 assert.equal(result.writerAuthorized,false);
 assert.equal(result.operationOn,false);
 const badData=makeBlob('// UNAPPROVED AMOUNT SOURCE\n');
 const rejected=[
  synthetic(base,[[rustPath,badData]]),
  synthetic(base,[[rustPath,newRust,'100755']]),
  synthetic(base,[[rustPath,newRust],['crates/ddv-save-core/src/extra_unapproved.rs',badData]]),
  synthetic(base,[[rustPath,newRust],['scripts/wasm-distribution/protected-release-inputs.json',badData]]),
  synthetic(base,[[rustPath,newRust],['crates/ddv-save-core/Cargo.toml',badData]]),
  synthetic(approved,[[gatePath,git(['rev-parse',protectedMain+':'+gatePath])]]),
  synthetic(base,[])
 ];
 for(const attempt of rejected)
  assert.throws(()=>verifyAcceptedRustScope(cwd,base,attempt),
   /R22_ACCEPTED_SCOPE_|SOURCE_PATH_SET_MISMATCH|INT_SELECTION_/);
 console.log('R22_ACT1581_BATTLEPASS_EXACT1_1POS7NEG_CORE_SHA_AND_MODE_PIN');
});
