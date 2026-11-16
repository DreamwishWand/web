// R22 exact accepted-source maintenance scope. NOT an acceptance issuer,
// merge authority, public Writer permission, or a generic Rust exception.
// Fixed reviewed Source1372 + approved Cargo pin (ACT1020/1023/1030).
// ACT1100 adds only Source1422 exact4 after the accepted common Core tree.
// Must first be accepted by independent 04QR-S and sole09INT on protected main.
// A candidate cannot introduce or modify this gate to authorize itself.
import {execFileSync} from 'node:child_process';
import {inspectSelection} from '../int-selection-preflight.mjs';

const APPROVED_ANCESTOR='2ec84d06a24d5fe964c7e8b8186a6b442650593b';
const SHA=/^[0-9a-f]{40}$/;
const entries=[
  {
    "path": ".github/workflows/core-product-session-boundary.yml",
    "before": {
      "mode": "100644",
      "blob": "1995e60e584f7ed144ab73b1ddeec87bd293fb13"
    },
    "after": {
      "mode": "100644",
      "blob": "93c4244c053dfeabcf27b0817b6a2e81a5fb905d"
    }
  },
  {
    "path": "crates/ddv-save-core/Cargo.toml",
    "before": {
      "mode": "100644",
      "blob": "27cc74609bc818741ff068bdd00c0b7d430aa257"
    },
    "after": {
      "mode": "100644",
      "blob": "0939c989984ff49aff466da35e427289758d8d4f"
    }
  },
  {
    "path": "crates/ddv-save-core/data/steam626-amount-dependency-projection.json",
    "before": null,
    "after": {
      "mode": "100644",
      "blob": "81571df377231f06496165530bb3b079897da769"
    }
  },
  {
    "path": "crates/ddv-save-core/data/steam626-amount-layout-reference.jsonl",
    "before": null,
    "after": {
      "mode": "100644",
      "blob": "82b9e1c3f53ffce85f2277a81d0cab195be1aff8"
    }
  },
  {
    "path": "crates/ddv-save-core/data/steam626-amount-packaged-candidates.json",
    "before": null,
    "after": {
      "mode": "100644",
      "blob": "5ed37e479b1c797bbe86df5857e8469e30978b0e"
    }
  },
  {
    "path": "crates/ddv-save-core/src/lib.rs",
    "before": {
      "mode": "100644",
      "blob": "6e47eb5d2d2c829c0b0fe6a741db550b1faf70e5"
    },
    "after": {
      "mode": "100644",
      "blob": "9cc0dfdde15399d2797f30c861684f530635c4ef"
    }
  },
  {
    "path": "crates/ddv-save-core/src/native_reference_slice.rs",
    "before": {
      "mode": "100644",
      "blob": "84c010a851bd1324d1ba716e3ac20ee7ff97e69e"
    },
    "after": {
      "mode": "100644",
      "blob": "061df02b8d8a8b9ed8c4d0ccd549ed4ea5ab3a2c"
    }
  },
  {
    "path": "crates/ddv-save-core/src/private_collection_read.rs",
    "before": {
      "mode": "100644",
      "blob": "dd4364c14004e4b577b63b20138e0b366c4d67fb"
    },
    "after": {
      "mode": "100644",
      "blob": "934662f1f68dfc8dbde67d90dd00a190d11a33f0"
    }
  },
  {
    "path": "crates/ddv-save-core/src/product_amount_scoped.rs",
    "before": null,
    "after": {
      "mode": "100644",
      "blob": "d62bccfcd2f13a184dbe9b3061cda3e616b21ad7"
    }
  },
  {
    "path": "crates/ddv-save-core/src/product_session.rs",
    "before": {
      "mode": "100644",
      "blob": "4958dc920ad3450aa01757502fafc1f4205da403"
    },
    "after": {
      "mode": "100644",
      "blob": "ac17f7a736f6c61152b4a7fd032f711b3fbec7cf"
    }
  },
  {
    "path": "crates/ddv-save-core/src/reference_span_walk.rs",
    "before": null,
    "after": {
      "mode": "100644",
      "blob": "f12edf8eed2d6575bb0c581679e038658f126692"
    }
  },
  {
    "path": "crates/ddv-save-core/src/semantic_writer.rs",
    "before": {
      "mode": "100644",
      "blob": "f7ffe74e3bb11610430cae3b8e9a1924554e3ef9"
    },
    "after": {
      "mode": "100644",
      "blob": "c23187216e12ec79da32ced511d41768bec91fe5"
    }
  },
  {
    "path": "crates/ddv-save-core/src/wasm_worker.rs",
    "before": {
      "mode": "100644",
      "blob": "387afcb5bc151942fcc7f5848e3d9d5722b90de5"
    },
    "after": {
      "mode": "100644",
      "blob": "98e630acad496de9df94a83fc839f1bc382aa403"
    }
  },
  {
    "path": "crates/ddv-save-core/src/worker_session.rs",
    "before": {
      "mode": "100644",
      "blob": "d84fcd08849c9eaae046aeaa16d217b77d0b3b0d"
    },
    "after": {
      "mode": "100644",
      "blob": "6d6fad2fa9494bfdc732ad8bf2f82ab047528812"
    }
  },
  {
    "path": "scripts/wasm-distribution/protected-release-inputs.json",
    "before": {
      "mode": "100644",
      "blob": "c90840cf2b759f933b20577a6b6dcb67cf1b3c25"
    },
    "after": {
      "mode": "100644",
      "blob": "d5e20db31ce4302964989d65355d1e26a61e22ec"
    }
  }
];
const switch626ChestEntries=[
  {
    "path": "crates/ddv-save-core/src/product_amount_scoped.rs",
    "before": {
      "mode": "100644",
      "blob": "d62bccfcd2f13a184dbe9b3061cda3e616b21ad7"
    },
    "after": {
      "mode": "100644",
      "blob": "a5e774917e5d5d43cca2493e2c74a2cf07f45e53"
    }
  },
  {
    "path": "crates/ddv-save-core/src/product_switch626_chest.rs",
    "before": null,
    "after": {
      "mode": "100644",
      "blob": "fd3fad8d8fcfac9ca417eb2185cd0e6cfde22293"
    }
  },
  {
    "path": "crates/ddv-save-core/src/wasm_worker.rs",
    "before": {
      "mode": "100644",
      "blob": "98e630acad496de9df94a83fc839f1bc382aa403"
    },
    "after": {
      "mode": "100644",
      "blob": "0fcdac70758ca09675fa28c4b854e4c1885e681b"
    }
  },
  {
    "path": "crates/ddv-save-core/src/worker_session.rs",
    "before": {
      "mode": "100644",
      "blob": "6d6fad2fa9494bfdc732ad8bf2f82ab047528812"
    },
    "after": {
      "mode": "100644",
      "blob": "3aee4b593a4d62c3ff233c678095bf09cd0474bd"
    }
  }
];
const gatePaths=['scripts/wasm-distribution/verify-protected-release.mjs',
 'scripts/wasm-distribution/r22-accepted-rust-scope.mjs','scripts/int-selection-preflight.mjs'];
const git=(cwd,...args)=>execFileSync('git',args,{cwd,encoding:'utf8',maxBuffer:16*1024*1024,
 env:{...process.env,GIT_NO_REPLACE_OBJECTS:'1'},stdio:['ignore','pipe','pipe']}).trim();
const same=(a,b)=>a===null||b===null?a===b:a.mode===b.mode&&a.blob===b.blob;
const deny=m=>{throw Error('R22_ACCEPTED_SCOPE_'+m)};

// Shared existing exact-selection verifier: every candidate path and both
// regular-file blob/mode endpoints must match. No partial or superset permit.
export function verifyExactScopeEntries(cwd,base,source,approved){
 if(!Array.isArray(approved)||approved.length===0)deny('EMPTY');
 const selected=inspectSelection(cwd,{base,source,main:base,paths:approved.map(e=>e.path)});
 if(selected.entries.length!==approved.length)deny('COUNT');
 const byPath=new Map(approved.map(e=>[e.path,e]));
 for(const e of selected.entries){
  const pin=byPath.get(e.path);
  if(!pin||!same(e.before,pin.before)||!same(e.after,pin.after))deny('BLOB_OR_MODE');
 }
 return selected;
}

export function verifyAcceptedRustScope(cwd,base,source){
 if(!SHA.test(base??'')||!SHA.test(source??''))deny('SHA');
 // The old R22 historical ancestor remains checked by the caller. The
 // specific accepted composition additionally requires its reviewed base
 // lineage and the trusted gate already on the live protected base.
 git(cwd,'merge-base','--is-ancestor',APPROVED_ANCESTOR,base);
 for(const path of gatePaths){
  const pre=git(cwd,'rev-parse','--verify',base+':'+path);
  const post=git(cwd,'rev-parse','--verify',source+':'+path);
  if(!SHA.test(pre)||pre!==post)deny('PROTECTED_GATE_NOT_IDENTICAL');
 }
 // Exact changed paths alone do not constrain unchanged Core files.
 // Bind the complete reviewed Core trees; unrelated non-Core main changes
 // may proceed, but any cumulative Core drift requires new acceptance.
 const corePath='crates/ddv-save-core';
 const baseCore=git(cwd,'rev-parse','--verify',base+':'+corePath);
 const sourceCore=git(cwd,'rev-parse','--verify',source+':'+corePath);
 const profile=selectAcceptedCorePair(baseCore,sourceCore);
 const result=verifyExactScopeEntries(cwd,base,source,profile.entries);
 if(result.entries.length!==profile.count)deny('FIXED_SCOPE_COUNT');
 return {status:'R22_EXACT_ACCEPTED_SOURCE_SCOPE_MATCH_ONLY',
  ...profile.metadata,candidateHead:source,base,entryCount:profile.count,
  mergeAuthorized:false,writerAuthorized:false};
}

// This is a fixed source selector, not an authority grant. Neither a caller
// nor a candidate can supply the allowed paths/trees or change protected gate
// identity. Unknown Core pairs and mixed old/new pairs fail closed.
function selectAcceptedCorePair(baseCore,sourceCore){
 if(baseCore==='7de35a07df55bdf7f439caac6e4d734dd91fe9ba'){
  if(sourceCore!=='ca1ef1772b53ff535618fc8263cd647f757f3dad')deny('CANDIDATE_CORE_TREE');
  return {entries,count:15,metadata:{
   sourcePr:1372,sourceHead:'7c280ca740bda68cd69ceb46337fd75bf3e133bc',
   sourceTree:'06b31f58c383ca59e981248f2a23f7d6c41d0eef',
   historicalCandidateHead:'eaeafb84b55d522f1f6eab6e84d879780fc1d031'}};
 }
 if(baseCore==='ca1ef1772b53ff535618fc8263cd647f757f3dad'){
  if(sourceCore!=='2b50d1208e830433bd86bb9506b8cf67228d518d')deny('CANDIDATE_CORE_TREE');
  return {entries:switch626ChestEntries,count:4,metadata:{
   sourcePr:1422,sourceHead:'5a5ce7eab0e5922d15e50b9ed699c44570c23f30',
   sourceTree:'a73f5b6da2856b2329cee3b158c6e1e74b097d3c'}};
 }
 deny('BASE_CORE_TREE');
}

