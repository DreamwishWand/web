//! W-CORE-004: strictly PRIVATE/native V1 reader into the accepted, SINGLE
//! ProductSession. No P1G decryptor, Editor, Writer or second JSON reader.
//! Input is decoded UTF8 JSON on standard input from the existing local P1G
//! codec. Environment supplies independently captured encrypted-original
//! metadata; Rust does NOT claim to cryptographically prove the game install.
//! ALL execution involving real Owner data is local/off-GitHub/off-Cloud.
use ddv_save_core::{
    BuildIdentity,BuildKind,ExternalLayoutStatus,IndexedDomain,Platform,ProductSession,WorkerAction,
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
/// Counts only, never Rust-owned individual Grid/Object IDs, paths, saved
/// game hash values, decoded bytes, original SHA, or private SessionID.
#[derive(Default)]
struct StoredDiffGridsCounts {
    total_grids:usize,
    pages:usize,
    max_page_records:usize,
    modified_objects:usize,
    removed_objects:usize,
    modified_removed_same_id_pairs:usize,
    unresolved_external_layouts:usize,
    saved_grid_id_zero:usize,
    saved_default_layout_id_zero:usize,
    stored_layout_paths:usize,
    stored_layout_types:usize,
    stored_grid_hash_values:usize,
    stored_grid_data_hash_values:usize,
    consumed_cursor_denials:usize,
}
fn checked_plus(a:&mut usize,n:usize){
    *a=a.checked_add(n).unwrap_or_else(||denied("TYPED_COUNTS_OVERFLOW"));
}
fn saved_diffgrids_counts(
    session:&ProductSession,scope:WorkerEnvelope
)->StoredDiffGridsCounts{
    let issued=session.issue_saved_diffgrids_cursor(scope)
        .unwrap_or_else(|_|denied("TYPED_DIFFGRIDS_CURSOR_ISSUE_DENIED"));
    if issued.max_records_per_page!=8 || issued.session_id!=scope.session_id ||
       issued.revision!=scope.expected_revision ||
       issued.index_generation!=scope.expected_index_generation ||
       issued.decoded_sha256!=scope.expected_decoded_sha256 ||
       issued.product_read_accepted||issued.all_native_references_verified||
       issued.writer_authorized {
        denied("TYPED_DIFFGRIDS_CURSOR_SCOPE_INVALID");
    }
    let mut result=StoredDiffGridsCounts::default();
    let mut cursor=issued.cursor;
    for _ in 0..MAX_PAGES {
        let page=session.read_saved_diffgrids_page(scope,cursor)
            .unwrap_or_else(|_|denied("TYPED_DIFFGRIDS_PAGE_DENIED"));
        if page.session_id!=scope.session_id ||
           page.revision!=scope.expected_revision ||
           page.index_generation!=scope.expected_index_generation ||
           page.decoded_sha256!=scope.expected_decoded_sha256 ||
           page.records.len()>8 ||
           page.product_read_accepted||page.all_native_references_verified||
           page.writer_authorized {
            denied("TYPED_DIFFGRIDS_PAGE_SCOPE_INVALID");
        }
        checked_plus(&mut result.pages,1);
        checked_plus(&mut result.total_grids,page.records.len());
        result.max_page_records=result.max_page_records.max(page.records.len());
        for grid in page.records {
            if grid.external_layout!=ExternalLayoutStatus::UnresolvedExternalLayout ||
               grid.native_effective_grid_verified {
                denied("TYPED_DIFFGRIDS_UNVERIFIED_LAYOUT_AUTHORITY");
            }
            checked_plus(&mut result.unresolved_external_layouts,1);
            checked_plus(&mut result.modified_objects,grid.modified_object_ids.len());
            checked_plus(&mut result.removed_objects,grid.removed_object_ids.len());
            checked_plus(&mut result.modified_removed_same_id_pairs,
                         grid.modified_removed_id_pairs);
            if grid.grid_id==0 {checked_plus(&mut result.saved_grid_id_zero,1);}
            if grid.default_layout_grid_id==Some(0){
                checked_plus(&mut result.saved_default_layout_id_zero,1);
            }
            if grid.grid_default_layout_path.is_some(){
                checked_plus(&mut result.stored_layout_paths,1);
            }
            if grid.grid_default_layout_type.is_some(){
                checked_plus(&mut result.stored_layout_types,1);
            }
            if grid.default_grid_hash_code.is_some(){
                checked_plus(&mut result.stored_grid_hash_values,1);
            }
            if grid.default_grid_data_hash_code.is_some(){
                checked_plus(&mut result.stored_grid_data_hash_values,1);
            }
        }
        // The Rust cursor must be *consumed* by this read. Demonstrate the
        // same-session replay negative on EVERY page, without logging tokens.
        if session.read_saved_diffgrids_page(scope,cursor).is_ok(){
            denied("TYPED_DIFFGRIDS_CURSOR_REPLAY_ACCEPTED");
        }
        checked_plus(&mut result.consumed_cursor_denials,1);
        match page.next_cursor {
            Some(next)=>{
                if next==cursor || next==[0;16] || result.total_grids>=issued.indexed_records {
                    denied("TYPED_DIFFGRIDS_INVALID_NEXT_CURSOR");
                }
                cursor=next;
            }
            None=>{
                if result.total_grids!=issued.indexed_records ||
                   result.unresolved_external_layouts!=result.total_grids {
                    denied("TYPED_DIFFGRIDS_TOTAL_OR_UNKNOWN_MISMATCH");
                }
                return result;
            }
        }
    }
    denied("TYPED_DIFFGRIDS_PAGE_LIMIT");
}
fn run(){
    // The accepted no-argument V1 path remains byte-for-byte behaviorally
    // unchanged. Explicit private read-only slice cannot activate Writer.
    let argv:Vec<String>=env::args().skip(1).collect();
    let (native_slice,stored_diffgrids)=match argv.as_slice(){
      []=>(false,false),
      [flag] if flag=="--native-area-grid-slice-only"=>(true,false),
      [flag] if flag=="--dev-stored-diffgrids-typed-read-only"=>(false,true),
      _=>denied("UNTRUSTED_CLI_ARGS"),
    };
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
    let slice=if native_slice {
      Some(session.verify_native_area_grid_slice(scope)
          .unwrap_or_else(|_|denied("NATIVE_AREA_GRID_SLICE_DENIED")))
    } else {None};
    let typed_counts=if stored_diffgrids {
      Some(saved_diffgrids_counts(&session,scope))
    } else {None};
    // Revoke while preserving the immutable original. No plaintext on disk.
    session.close().unwrap_or_else(|_|denied("RUST_CLOSE_FAILED"));
    let mut out=serde_json::json!({
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
    if let Some(r)=slice {
      out["nativeAreaGridSlice"]=serde_json::json!({
        "villageRecords":r.village_records,
        "areaRecords":r.area_records,
        "gridRecords":r.grid_records,
        "directAreaGridLinks":r.direct_area_grid_links,
        "gridObjectIdentityRecords":r.grid_object_identity_records,
        "floatingIslandMapPresent":r.floating_island_map_present,
        "floatingIslandRecords":r.floating_island_records,
        "floatingIslandDirectGridLinks":r.floating_island_direct_grid_links,
        "directRootOwnershipUnique":r.direct_root_ownership_unique,
        "fullNativeReferenceClosureVerified":false,
        "areaGroupFootprintVerified":false,
        "nativeV3Verified":false,
        "productReadAccepted":false,
        "writerAuthorized":false
      });
    }
    if let Some(r)=typed_counts {
      // Original Size and any raw Save/Session/IDs are not part of the
      // new DEV-only aggregate receipt, even though default V1 retains its
      // legacy metadata fields.
      out.as_object_mut().unwrap().remove("originalBytesSuppliedSeparately");
      out["savedDiffGridsTypedRead"]=serde_json::json!({
        "contract":"wand.dev.stored-diffgrids-typed-read-only@1",
        "enabledOnlyByExplicitDevCliArg":true,
        "exactExternalSteamFullVersion":true,
        "singleProductSessionScopeValidated":true,
        "sessionIdMatchedCore":true,
        "revision":receipt.revision,
        "indexGeneration":receipt.index_generation,
        "decodedShaMatchedCore":true,
        "fullDocumentValidated":true,
        "indexedGridRecords":r.total_grids,
        "typedPages":r.pages,
        "maximumGridRecordsInPage":r.max_page_records,
        "modifiedObjectRecords":r.modified_objects,
        "removedObjectRecords":r.removed_objects,
        "modifiedRemovedSameIdPairs":r.modified_removed_same_id_pairs,
        "savedGridIdZeroRecords":r.saved_grid_id_zero,
        "savedDefaultLayoutIdZeroRecords":r.saved_default_layout_id_zero,
        "storedLayoutPathValues":r.stored_layout_paths,
        "storedLayoutTypeValues":r.stored_layout_types,
        "storedGridHashValues":r.stored_grid_hash_values,
        "storedGridDataHashValues":r.stored_grid_data_hash_values,
        "externalLayoutStatus":"UNRESOLVED_EXTERNAL_LAYOUT",
        "unresolvedExternalLayoutRecords":r.unresolved_external_layouts,
        "consumedCursorReplayDenials":r.consumed_cursor_denials,
        "nativeEffectiveGridVerified":false,
        "allNativeReferencesVerified":false,
        "productReadAccepted":false,
        "nativeV3Verified":false,
        "writerAuthorized":false,
        "editedCopyAuthorized":false,
        "applyAuthorized":false,
        "originalModified":false
      });
    }
    println!("{}",out);
}
fn main(){run()}
