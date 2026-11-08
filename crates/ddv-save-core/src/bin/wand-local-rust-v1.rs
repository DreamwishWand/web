//! W-CORE-004: strictly PRIVATE/native V1 reader into the accepted, SINGLE
//! ProductSession. No P1G decryptor, Editor, Writer or second JSON reader.
//! Input is decoded UTF8 JSON on standard input from the existing local P1G
//! codec. Environment supplies independently captured encrypted-original
//! metadata; Rust does NOT claim to cryptographically prove the game install.
//! ALL execution involving real Owner data is local/off-GitHub/off-Cloud.
use ddv_save_core::{
    BuildIdentity,BuildKind,IndexedDomain,Platform,ProductSession,WorkerAction,
    WorkerEnvelope,PRODUCT_WORKER_CONTRACT,
};
use sha2::{Digest,Sha256};
use std::{env,io::{self,Read}};
const EXACT_STEAM_VERSION:&str="releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22";
const MAX_BYTES:u64=256*1024*1024;
const MAX_PAGES:usize=8192;
fn denied(code:&str)->!{
    // Error code ONLY. Never log private Save path, hash, keys or decoded values.
    eprintln!("LOCAL_RUST_V1_DENIED:{code}");
    std::process::exit(12)
}
fn required(name:&str)->String{
    env::var(name).ok().filter(|s|!s.is_empty())
      .unwrap_or_else(||denied("EXTERNAL_ATTESTATION_REQUIRED"))
}
fn hex32(input:&str)->[u8;32]{
    if input.len()!=64||!input.as_bytes().iter().all(|c|
       matches!(*c,b'0'..=b'9'|b'a'..=b'f')){
       denied("EXPECTED_SHA_FORMAT");
    }
    let mut h=[0;32];
    for (i,part) in input.as_bytes().chunks_exact(2).enumerate(){
      let v=|b|match b {
        b'0'..=b'9'=>b-b'0',
        b'a'..=b'f'=>b-b'a'+10,
        _=>0
      };
      h[i]=(v(part[0])<<4)|v(part[1]);
    }
    h
}
fn page_count(session:&ProductSession,scope:WorkerEnvelope,domain:IndexedDomain)->usize{
    let mut token=session.issue_indexed_cursor(scope,domain)
      .unwrap_or_else(|_|denied("NATIVE_INDEX_NOT_AVAILABLE")).cursor;
    let mut count=0usize;
    for _ in 0..MAX_PAGES{
      let page=session.read_indexed_page(scope,token)
        .unwrap_or_else(|_|denied("NATIVE_INDEX_CURSOR_INVALID"));
      if page.domain!=domain||page.product_read_accepted||page.writer_authorized||
         page.fields.len()>16||page.revision!=0||page.index_generation!=1{
         denied("NATIVE_READ_RECEIPT_INVARIANT");
      }
      count=count.checked_add(page.fields.len())
        .unwrap_or_else(||denied("NATIVE_INDEX_COUNT_OVERFLOW"));
      match page.next_cursor{
        Some(next)=>{if next==token||next==[0;16]{denied("CURSOR_REUSED_OR_ZERO");}token=next},
        None=>return count
      }
    }
    denied("NATIVE_INDEX_PAGE_BOUND");
}
fn run(){
    if env::args().len()!=1{denied("UNTRUSTED_CLI_ARGS");}
    if required("WAND_LOCAL_INSTALLED_STEAM_FULLVERSION")!=EXACT_STEAM_VERSION{
      denied("EXACT_EXTERNAL_STEAM_BUILD_REQUIRED");
    }
    let original_sha=hex32(&required("WAND_LOCAL_ORIGINAL_SHA256"));
    if original_sha==[0;32]{denied("ORIGINAL_SHA_ZERO");}
    let original_size=required("WAND_LOCAL_ORIGINAL_SIZE_BYTES").parse::<u64>()
        .unwrap_or_else(|_|denied("ORIGINAL_SIZE_INVALID"));
    if original_size==0||original_size>128*1024*1024{
      denied("ORIGINAL_SIZE_OUTSIDE_WORKER_BOUND");
    }
    let decoded_expected=hex32(&required("WAND_LOCAL_DECODED_SHA256"));
    if decoded_expected==[0;32]{denied("DECODED_SHA_ZERO");}
    let mut decoded=Vec::new();
    io::stdin().take(MAX_BYTES+1).read_to_end(&mut decoded)
        .unwrap_or_else(|_|denied("DECODED_STDIN_FAILURE"));
    if decoded.is_empty()||decoded.len() as u64>MAX_BYTES{
      denied("DECODED_INPUT_BOUNDS");
    }
    if Sha256::digest(&decoded).as_slice()!=decoded_expected{
      denied("DECODED_SOURCE_SHA_MISMATCH");
    }
    let build=BuildIdentity{
      platform:Platform::SteamWindows,
      build_kind:BuildKind::SteamFullVersion,
      build_id:EXACT_STEAM_VERSION.to_owned(),
      schema:626,externally_attested:true
    };
    let session=ProductSession::open_decoded_readonly(decoded,build)
      .unwrap_or_else(|_|denied("RUST_FULL_DOCUMENT_OR_SCHEMA_DENIED"));
    let receipt=session.receipt()
      .unwrap_or_else(|_|denied("RUST_RECEIPT_DENIED"));
    if receipt.product_worker_bound||receipt.product_read_accepted||
       receipt.all_domain_references_verified||receipt.writer_authorized||
       receipt.edited_copy_authorized||receipt.apply_authorized||
       receipt.revision!=0||receipt.index_generation!=1||
       receipt.decoded_sha256!=decoded_expected{
       denied("V1_NOT_READONLY");
    }
    let scope=WorkerEnvelope{
      contract:PRODUCT_WORKER_CONTRACT,session_id:receipt.session_id,
      expected_revision:receipt.revision,
      expected_index_generation:receipt.index_generation,
      expected_decoded_sha256:receipt.decoded_sha256,
      action:WorkerAction::ReadDomain
    };
    let player=page_count(&session,scope,IndexedDomain::Player);
    let world=page_count(&session,scope,IndexedDomain::World);
    // Revoke while preserving the immutable original. No plaintext on disk.
    session.close().unwrap_or_else(|_|denied("RUST_CLOSE_FAILED"));
    let out=serde_json::json!({
      "contract":"wand.native.private.real-steam-v1@1",
      "operation":"REAL_SAVE_STRUCTURAL_VERIFIED_CANDIDATE",
      "source":"PRIVATE_LOCAL_ONLY",
      "fullDocumentRustValidated":true,
      "coreOwnedIndexedPlayerFields":player,
      "coreOwnedIndexedWorldFields":world,
      "originalShaSuppliedSeparately":true,
      "originalBytesSuppliedSeparately":original_size,
      "decodedSHAValidatedByRust":true,
      "externalBuildExactCandidate":true,
      "physicalGameInstallCryptographicallyProven":false,
      "allNativeReferencesVerified":false,
      "rustV2EditedCopyVerified":false,
      "productReadAccepted":false,
      "writerAuthorized":false,
      "editedCopyAuthorized":false,
      "applyAuthorized":false,
      "cloudUploadPerformed":false,
      "originalModified":false
    });
    println!("{}",out);
}
fn main(){run()}
