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
fn hex_bytes(b:&[u8])->String{b.iter().map(|x|format!("{x:02x}")).collect()}
fn private_output_path(raw:&str)->std::path::PathBuf{
    use std::{path::Path,fs};
    let p=Path::new(raw);
    if !p.is_absolute()||p.file_name().is_none(){denied("PRIVATE_OUTPUT_ABSOLUTE_REQUIRED")}
    let parent=fs::canonicalize(p.parent().unwrap_or_else(||denied("PRIVATE_OUTPUT_PARENT")))
        .unwrap_or_else(|_|denied("PRIVATE_OUTPUT_PARENT"));
    let meta=fs::metadata(&parent).unwrap_or_else(|_|denied("PRIVATE_OUTPUT_PARENT"));
    if !meta.is_dir(){denied("PRIVATE_OUTPUT_PARENT")}
    #[cfg(unix)]{use std::os::unix::fs::PermissionsExt;
        if meta.permissions().mode()&0o077!=0{denied("PRIVATE_OUTPUT_DIRECTORY_PERMISSIONS")}}
    let out=parent.join(p.file_name().unwrap());
    if fs::symlink_metadata(&out).is_ok(){denied("PRIVATE_OUTPUT_ALREADY_EXISTS")}
    out
}
fn write_private_receipt(path:&std::path::Path,v:&serde_json::Value){
    use std::{fs::{self,OpenOptions},io::Write};
    let bytes=serde_json::to_vec(v).unwrap_or_else(|_|denied("PRIVATE_RECEIPT_ENCODE"));
    let mut opts=OpenOptions::new();opts.write(true).create_new(true);
    #[cfg(unix)]{use std::os::unix::fs::OpenOptionsExt;opts.mode(0o600);}
    let mut out=opts.open(path).unwrap_or_else(|_|denied("PRIVATE_OUTPUT_CREATE_NEW"));
    if out.write_all(&bytes).and_then(|_|out.sync_all()).is_err(){
        drop(out);let _=fs::remove_file(path);denied("PRIVATE_OUTPUT_WRITE");
    }
}
// New dependency transport uses the independently accepted ACT407 Linux
// pinned-directory approach. Legacy V1 modes retain their existing contract.
struct PinnedPrivateOutput{path:std::path::PathBuf,_dir:std::fs::File}
#[cfg(target_os="linux")]
fn pinned_private_output(raw:&str)->PinnedPrivateOutput{
    use std::{fs,path::{Path,PathBuf},os::unix::{fs::{MetadataExt,PermissionsExt},io::AsRawFd}};
    let p=Path::new(raw);
    if !p.is_absolute()||p.file_name().is_none(){denied("PRIVATE_OUTPUT_ABSOLUTE_REQUIRED")}
    let real=fs::canonicalize(p.parent().unwrap_or_else(||denied("PRIVATE_OUTPUT_PARENT")))
        .unwrap_or_else(|_|denied("PRIVATE_OUTPUT_PARENT"));
    let meta=fs::metadata(&real).unwrap_or_else(|_|denied("PRIVATE_OUTPUT_PARENT"));
    if !meta.is_dir()||meta.permissions().mode()&0o077!=0{denied("PRIVATE_OUTPUT_DIRECTORY_PERMISSIONS")}
    let dir=fs::File::open(&real).unwrap_or_else(|_|denied("PRIVATE_OUTPUT_PARENT_OPEN"));
    let actual=dir.metadata().unwrap_or_else(|_|denied("PRIVATE_OUTPUT_PARENT"));
    if !actual.is_dir()||actual.dev()!=meta.dev()||actual.ino()!=meta.ino()||
       actual.permissions().mode()&0o077!=0{denied("PRIVATE_OUTPUT_DIRECTORY_CHANGED")}
    let anchor=PathBuf::from(format!("/proc/self/fd/{}",dir.as_raw_fd()));
    if fs::read_link(&anchor).ok().as_ref()!=Some(&real){denied("PRIVATE_OUTPUT_DIRECTORY_CHANGED")}
    let out=anchor.join(p.file_name().unwrap());
    if fs::symlink_metadata(&out).is_ok(){denied("PRIVATE_OUTPUT_ALREADY_EXISTS")}
    PinnedPrivateOutput{path:out,_dir:dir}
}
#[cfg(not(target_os="linux"))]
fn pinned_private_output(_raw:&str)->PinnedPrivateOutput{denied("PRIVATE_OUTPUT_LINUX_ONLY")}
fn selector_id(s:&str)->i32{
    let n=s.parse::<i32>().unwrap_or_else(|_|denied("CHARACTER_SKIN_SELECTOR_ID"));
    if n<=0||n.to_string()!=s{denied("CHARACTER_SKIN_SELECTOR_ID");}
    n
}
fn collection_selector(s:&str,major:i32)->i32{
    let n=s.parse::<i32>().unwrap_or_else(|_|denied("COLLECTION_SELECTOR_ID"));
    if n<=0||n.to_string()!=s||n/10_000_000!=major{denied("COLLECTION_SELECTOR_ID")}
    n
}
fn collection_group_index(s:&str)->usize{
    let n=s.parse::<usize>().unwrap_or_else(|_|denied("COLLECTION_GROUP_SELECTOR"));
    if n>=257||n.to_string()!=s{denied("COLLECTION_GROUP_SELECTOR")}
    n
}
fn run(){
    // The accepted no-argument V1 path remains byte-for-byte behaviorally
    // unchanged. Explicit private read-only slice cannot activate Writer.
    let argv:Vec<String>=env::args().skip(1).collect();
    let (native_slice,avatar_output,skin_output,dependency_output,skin_dependency_output,collection_output)=match argv.as_slice(){
      []=>(false,None,None,None,None,None),
      [flag] if flag=="--native-area-grid-slice-only"=>(true,None,None,None,None,None),
      [flag,out,path] if flag=="--active-avatar-receipt-only"&&out=="--out"=>
        (false,Some(private_output_path(path)),None,None,None,None),
      [flag,out,path] if flag=="--avatar-dependencies-receipt-only"&&out=="--out"=>
        (false,None,None,Some(private_output_path(path)),None,None),
      [flag,c,k,out,path] if flag=="--character-skin-receipt-only"&&out=="--out"=>
        (false,None,Some((selector_id(c),selector_id(k),private_output_path(path))),None,None,None),
      [flag,c,k,f,out,path] if flag=="--character-skin-dependencies-receipt-only"&&out=="--out"=>
        (false,None,None,None,Some((selector_id(c),selector_id(k),selector_id(f),pinned_private_output(path))),None),
      [flag,d,g,t,out,path] if flag=="--collection-group-receipt-only"&&out=="--out"=>
        (false,None,None,None,None,Some((collection_selector(d,212),collection_group_index(g),collection_selector(t,3),pinned_private_output(path)))),
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
    if let Some((definition,group,target,path))=collection_output{
        let witness=session.read_private_collection_group(scope,definition,group,target)
            .unwrap_or_else(|_|denied("COLLECTION_GROUP_READ_DENIED"));
        let mut out=witness.to_private_receipt_json();
        if out["contract"]!="wand.native.private.collection-group-readset@1"||
           out["fullVersion"]!=EXACT_STEAM_VERSION||out["schema"]!=626||
           out["sessionId"]!=hex_bytes(&receipt.session_id)||
           out["decodedSha256"]!=hex_bytes(&receipt.decoded_sha256)||
           out["revision"]!=receipt.revision||out["indexGeneration"]!=receipt.index_generation||
           out["selectedGroup"]["definitionId"]!=definition||
           out["selectedGroup"]["groupPosition"]!=group||
           out["targetItemId"]!=target||
           out["fullDocumentRustValidated"]!=true||
           ["packagedMembershipVerified","effectiveEligibilityVerified","ownershipVerified","rightsVerified",
            "subscriberClosureVerified","nativeV3Verified","productReadAccepted","writerAuthorized",
            "editedCopyAuthorized","applyAuthorized"].iter().any(|k|out[*k]!=false)||
           session.receipt().ok()!=Some(receipt){denied("COLLECTION_GROUP_RECEIPT_SCOPE_DENIED");}
        out["originalSha256SuppliedExternally"]=serde_json::json!(hex_bytes(&original_sha));
        out["originalSizeBytesSuppliedExternally"]=serde_json::json!(original_size);
        out["cloudUploadPerformed"]=serde_json::json!(false);
        out["originalModifiedByHarness"]=serde_json::json!(false);
        session.close().unwrap_or_else(|_|denied("RUST_CLOSE_FAILED"));
        write_private_receipt(&path.path,&out);
        eprintln!("LOCAL_RUST_V1_PRIVATE_COLLECTION_GROUP_RECEIPT_WRITTEN");
        return;
    }
    if let Some((character,skin,flag,path))=skin_dependency_output{
        let witness=session.read_private_character_skin_dependencies(scope,character,skin,flag)
            .unwrap_or_else(|_|denied("CHARACTER_SKIN_DEPENDENCIES_READ_DENIED"));
        let mut out=witness.to_private_receipt_json();
        out["originalSha256SuppliedExternally"]=serde_json::json!(hex_bytes(&original_sha));
        out["originalSizeBytesSuppliedExternally"]=serde_json::json!(original_size);
        out["cloudUploadPerformed"]=serde_json::json!(false);
        out["originalModifiedByHarness"]=serde_json::json!(false);
        if session.receipt().ok()!=Some(receipt){denied("CHARACTER_SKIN_DEPENDENCIES_EPOCH_CHANGED");}
        session.close().unwrap_or_else(|_|denied("RUST_CLOSE_FAILED"));
        write_private_receipt(&path.path,&out);
        eprintln!("LOCAL_RUST_V1_PRIVATE_CHARACTER_SKIN_DEPENDENCIES_RECEIPT_WRITTEN");
        return;
    }
    if let Some(path)=dependency_output{
        let witness=session.read_private_avatar_dependencies(scope)
            .unwrap_or_else(|_|denied("AVATAR_DEPENDENCIES_READ_DENIED"));
        let mut out=witness.to_private_receipt_json();
        out["originalSha256SuppliedExternally"]=serde_json::json!(hex_bytes(&original_sha));
        out["originalSizeBytesSuppliedExternally"]=serde_json::json!(original_size);
        out["cloudUploadPerformed"]=serde_json::json!(false);
        out["originalModifiedByHarness"]=serde_json::json!(false);
        if session.receipt().ok()!=Some(receipt){denied("AVATAR_DEPENDENCIES_EPOCH_CHANGED");}
        session.close().unwrap_or_else(|_|denied("RUST_CLOSE_FAILED"));
        write_private_receipt(&path,&out);
        eprintln!("LOCAL_RUST_V1_PRIVATE_AVATAR_DEPENDENCIES_RECEIPT_WRITTEN");
        return;
    }
    if let Some((character,skin,path))=skin_output{
        let witness=session.read_private_character_skin(scope,character,skin)
            .unwrap_or_else(|_|denied("CHARACTER_SKIN_READ_DENIED"));
        let mut out=witness.to_private_receipt_json();
        out["originalSha256SuppliedExternally"]=serde_json::json!(hex_bytes(&original_sha));
        out["originalSizeBytesSuppliedExternally"]=serde_json::json!(original_size);
        out["cloudUploadPerformed"]=serde_json::json!(false);
        out["originalModifiedByHarness"]=serde_json::json!(false);
        if session.receipt().ok()!=Some(receipt){denied("CHARACTER_SKIN_EPOCH_CHANGED");}
        session.close().unwrap_or_else(|_|denied("RUST_CLOSE_FAILED"));
        write_private_receipt(&path,&out);
        eprintln!("LOCAL_RUST_V1_PRIVATE_CHARACTER_SKIN_RECEIPT_WRITTEN");
        return;
    }
    if let Some(path)=avatar_output{
        let witness=session.read_private_active_avatar(scope)
            .unwrap_or_else(|_|denied("ACTIVE_AVATAR_READ_DENIED"));
        let mut out=witness.to_private_receipt_json();
        out["originalSha256SuppliedExternally"]=serde_json::json!(hex_bytes(&original_sha));
        out["originalSizeBytesSuppliedExternally"]=serde_json::json!(original_size);
        out["cloudUploadPerformed"]=serde_json::json!(false);
        out["originalModifiedByHarness"]=serde_json::json!(false);
        if session.receipt().ok()!=Some(receipt){denied("ACTIVE_AVATAR_EPOCH_CHANGED");}
        session.close().unwrap_or_else(|_|denied("RUST_CLOSE_FAILED"));
        write_private_receipt(&path,&out);
        eprintln!("LOCAL_RUST_V1_PRIVATE_AVATAR_RECEIPT_WRITTEN");
        return;
    }
    let player=page_count(&session,scope,IndexedDomain::Player);
    let world=page_count(&session,scope,IndexedDomain::World);
    let slice=if native_slice {
      Some(session.verify_native_area_grid_slice(scope)
          .unwrap_or_else(|_|denied("NATIVE_AREA_GRID_SLICE_DENIED")))
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
    println!("{}",out);
}
#[cfg(all(test,target_os="linux"))]
#[test]
fn skin_dependency_pinned_output_does_not_follow_replaced_parent(){
    use std::{fs,path::PathBuf,os::unix::fs::{DirBuilderExt,symlink},time::{SystemTime,UNIX_EPOCH}};
    let root=std::env::temp_dir().join(format!("wand-skin-pinned-{}-{}",std::process::id(),
        SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos()));
    fs::DirBuilder::new().mode(0o700).create(&root).unwrap();
    struct Cleanup(PathBuf);impl Drop for Cleanup{fn drop(&mut self){let _=fs::remove_dir_all(&self.0);}}
    let _cleanup=Cleanup(root.clone());
    let parent=root.join("parent");let moved=root.join("moved");let other=root.join("other");
    for p in [&parent,&other]{fs::DirBuilder::new().mode(0o700).create(p).unwrap();}
    let out=pinned_private_output(parent.join("receipt.json").to_str().unwrap());
    fs::rename(&parent,&moved).unwrap();symlink(&other,&parent).unwrap();
    let v=serde_json::json!({"writerAuthorized":false});
    write_private_receipt(&out.path,&v);
    assert!(!other.join("receipt.json").exists());
    assert_eq!(serde_json::from_slice::<serde_json::Value>(&fs::read(moved.join("receipt.json")).unwrap()).unwrap(),v);
}
fn main(){run()}
