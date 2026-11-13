//! Private-local, native-only ONE read receipt. No P1G decryptor, Writer,
//! original/backup file access, network, stdout data or product authorization.
//! Pipe decoded JSON from the already accepted local codec. External V0
//! encrypted-original/Build evidence must be independently checked by QR-L.
#[cfg(all(feature="semantic-writer-dev",not(target_arch="wasm32")))]
mod local {
    use ddv_save_core::{BuildIdentity,BuildKind,ExistingAmountSelection,ExistingAmountItemType,
        Platform,ProductSession,WorkerAction,WorkerEnvelope,PRODUCT_WORKER_CONTRACT};
    use sha2::{Digest,Sha256};
    use std::{env,fs::{self,OpenOptions},io::{self,Read,Write},path::{Path,PathBuf}};
    const EXACT:&str="releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22";
    const MAX:u64=256*1024*1024;
    fn fail(code:&str)->!{eprintln!("LOCAL_AMOUNT_READ_DENIED:{code}");std::process::exit(12)}
    fn required(k:&str)->String{env::var(k).ok().filter(|s|!s.is_empty()).unwrap_or_else(||fail("EXTERNAL_EVIDENCE_REQUIRED"))}
    fn hex(bytes:&[u8])->String{bytes.iter().map(|b|format!("{b:02x}")).collect()}
    fn sha_field(k:&str)->String{
        let h=required(k);
        if h.len()!=64||h.bytes().any(|b|!matches!(b,b'0'..=b'9'|b'a'..=b'f'))||h.bytes().all(|b|b==b'0'){fail("SHA_FORMAT")}
        h
    }
    fn id(s:&str,allow_zero:bool)->u32{let v=s.parse::<u32>().unwrap_or_else(|_|fail("SELECTOR_ID"));if (!allow_zero&&v==0)||v.to_string()!=s{fail("SELECTOR_ID")}v}
    fn output_path(raw:&str)->PathBuf{
        let p=Path::new(raw);
        if !p.is_absolute()||p.file_name().is_none(){fail("PRIVATE_OUTPUT_ABSOLUTE_REQUIRED")}
        let parent=p.parent().unwrap_or_else(||fail("PRIVATE_OUTPUT_PARENT"));
        let real=fs::canonicalize(parent).unwrap_or_else(|_|fail("PRIVATE_OUTPUT_PARENT"));
        let meta=fs::metadata(&real).unwrap_or_else(|_|fail("PRIVATE_OUTPUT_PARENT"));
        if !meta.is_dir(){fail("PRIVATE_OUTPUT_PARENT")}
        #[cfg(unix)]{
            use std::os::unix::fs::PermissionsExt;
            if meta.permissions().mode()&0o077!=0{fail("PRIVATE_OUTPUT_DIRECTORY_PERMISSIONS")}
        }
        // Windows ACL is an external Owner-private directory prerequisite.
        let out=real.join(p.file_name().unwrap());
        if fs::symlink_metadata(&out).is_ok(){fail("PRIVATE_OUTPUT_ALREADY_EXISTS")}
        out
    }
    pub fn run(){
        let argv:Vec<String>=env::args().skip(1).collect();
        let (selection,path)=match argv.as_slice(){
            [m,o,p] if m=="--new-inventory-candidate"&&o=="--out"=>(None,output_path(p)),
            [m,i,j,o,p] if m=="--inventory"&&o=="--out"=>
                (Some(ExistingAmountSelection::Inventory{inventory_id:id(i,true),item_id:id(j,false)}),output_path(p)),
            _=>fail("ARGS"),
        };
        if required("WAND_LOCAL_INSTALLED_STEAM_FULLVERSION")!=EXACT{fail("EXACT_STEAM_BUILD")}
        let original_sha=sha_field("WAND_LOCAL_ORIGINAL_SHA256");
        let decoded_sha=sha_field("WAND_LOCAL_DECODED_SHA256");
        let original_size=required("WAND_LOCAL_ORIGINAL_SIZE_BYTES").parse::<u64>().unwrap_or_else(|_|fail("ORIGINAL_SIZE"));
        if original_size==0||original_size>128*1024*1024{fail("ORIGINAL_SIZE")}
        let mut decoded=Vec::new();
        io::stdin().take(MAX+1).read_to_end(&mut decoded).unwrap_or_else(|_|fail("STDIN"));
        if decoded.is_empty()||decoded.len() as u64>MAX||hex(&Sha256::digest(&decoded))!=decoded_sha{fail("DECODED_SHA_OR_BOUNDS")}
        let session=ProductSession::open_decoded_readonly(decoded,BuildIdentity{
            platform:Platform::SteamWindows,build_kind:BuildKind::SteamFullVersion,
            build_id:EXACT.into(),schema:626,externally_attested:true,
        }).unwrap_or_else(|_|fail("FULL_DOCUMENT_OR_BUILD"));
        let r=session.receipt().unwrap_or_else(|_|fail("SESSION_RECEIPT"));
        if !r.full_document_json_validated||r.product_worker_bound||r.product_read_accepted||
           r.writer_authorized||r.edited_copy_authorized||r.apply_authorized||r.all_domain_references_verified||
           r.revision!=0||r.index_generation!=1||hex(&r.decoded_sha256)!=decoded_sha{fail("SESSION_NOT_READONLY")}
        let e=WorkerEnvelope{contract:PRODUCT_WORKER_CONTRACT,session_id:r.session_id,
            expected_revision:r.revision,expected_index_generation:r.index_generation,
            expected_decoded_sha256:r.decoded_sha256,action:WorkerAction::ReadDomain};
        let target=match selection{
            Some(sel)=>session.read_existing_amount_target(e,sel),
            None=>session.find_one_existing_inventory_amount_target(e),
        }.unwrap_or_else(|_|fail("NO_EXACT_EXISTING_INVENTORY_TARGET"));
        let v=target.view();
        let (inventory_id,item_id)=match v.selection{
            ExistingAmountSelection::Inventory{inventory_id,item_id}=>(inventory_id,item_id),
            _=>fail("NON_INVENTORY_TARGET"),
        };
        let (type_id,type_token)=match v.compatible_item_type{
            ExistingAmountItemType::ActivityItem=>(3,"ItemType_ActivityItem"),
            ExistingAmountItemType::Furniture=>(4,"ItemType_Furniture"),
        };
        if v.session_id!=r.session_id||v.revision!=r.revision||v.index_generation!=r.index_generation||
           v.decoded_sha256!=r.decoded_sha256||v.item_id!=item_id as i32||v.old_amount<2||
           v.old_amount>9999||v.chest.is_some()||session.receipt().ok()!=Some(r){fail("TARGET_SCOPE")}
        let receipt=serde_json::json!({
            "contract":"wand.native.private.existing-amount-target-read@1",
            "selectionKind":if selection.is_some(){"EXPLICIT_EXISTING_SELECTOR_NOT_E1172_IDENTITY_PROOF"}else{"NEW_BOUNDED_CANDIDATE_NOT_E1172_IDENTITY"},
            "platform":"SteamWindows","fullVersion":EXACT,"schema":626,
            "externalBuildExactCandidate":true,"physicalGameInstallCryptographicallyProven":false,
            "originalSha256SuppliedExternally":original_sha,"originalSizeBytesSuppliedExternally":original_size,
            "decodedSha256":decoded_sha,"sessionId":hex(&v.session_id),"revision":v.revision,"indexGeneration":v.index_generation,
            "inventoryId":inventory_id,"itemId":v.item_id,"oldAmount":v.old_amount,
            "compatibleItemType":type_token,"nativeItemType":type_id,"entrySha256":hex(&v.entry_sha256),
            "fullDocumentRustValidated":true,"oneCoreMintedExistingTarget":true,
            "canonicalItemDbVerified":false,"rightsVerified":false,"variationVerified":false,
            "nativeReferenceClosureVerified":false,"subscriberClosureVerified":false,
            "productReadAccepted":false,"writerAuthorized":false,"editedCopyAuthorized":false,"applyAuthorized":false,
            "nativeV3Verified":false,"originalModifiedByHarness":false,"cloudUploadPerformed":false,
        });
        session.close().unwrap_or_else(|_|fail("SESSION_CLOSE"));
        let bytes=serde_json::to_vec(&receipt).unwrap_or_else(|_|fail("RECEIPT_ENCODE"));
        let mut opt=OpenOptions::new();opt.write(true).create_new(true);
        #[cfg(unix)]{use std::os::unix::fs::OpenOptionsExt;opt.mode(0o600);}
        let mut out=opt.open(&path).unwrap_or_else(|_|fail("PRIVATE_OUTPUT_CREATE_NEW"));
        if out.write_all(&bytes).and_then(|_|out.sync_all()).is_err(){drop(out);let _=fs::remove_file(&path);fail("PRIVATE_OUTPUT_WRITE")}
        // No target fields, SHA, path, or original data in console.
        eprintln!("LOCAL_AMOUNT_READ_PRIVATE_RECEIPT_WRITTEN");
    }
}
#[cfg(all(feature="semantic-writer-dev",not(target_arch="wasm32")))]
fn main(){local::run()}
#[cfg(not(all(feature="semantic-writer-dev",not(target_arch="wasm32"))))]
fn main(){eprintln!("LOCAL_AMOUNT_READ_DENIED:PRIVATE_NATIVE_FEATURE_REQUIRED");std::process::exit(12)}
