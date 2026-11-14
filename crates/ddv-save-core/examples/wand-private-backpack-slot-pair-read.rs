//! Private-local, native-only ONE read receipt. No P1G decryptor, Writer,
//! original/backup file access, network, stdout data or product authorization.
//! Pipe decoded JSON from the already accepted local codec. External V0
//! encrypted-original/Build evidence must be independently checked by QR-L.
#[cfg(all(feature="semantic-writer-dev",not(target_arch="wasm32")))]
mod local {
    use ddv_save_core::{BuildIdentity,BuildKind,Platform,ProductSession,WorkerAction,WorkerEnvelope,PRODUCT_WORKER_CONTRACT};
    use sha2::{Digest,Sha256};
    use std::{env,fs::{self,File,OpenOptions},io::{self,Read,Write},path::{Path,PathBuf}};
    const EXACT:&str="releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22";
    const MAX:u64=256*1024*1024;
    fn fail(code:&str)->!{eprintln!("LOCAL_BACKPACK_PAIR_READ_DENIED:{code}");std::process::exit(12)}
    fn required(k:&str)->String{env::var(k).ok().filter(|s|!s.is_empty()).unwrap_or_else(||fail("EXTERNAL_EVIDENCE_REQUIRED"))}
    fn hex(bytes:&[u8])->String{bytes.iter().map(|b|format!("{b:02x}")).collect()}
    fn sha_field(k:&str)->String{
        let h=required(k);
        if h.len()!=64||h.bytes().any(|b|!matches!(b,b'0'..=b'9'|b'a'..=b'f'))||h.bytes().all(|b|b==b'0'){fail("SHA_FORMAT")}
        h
    }
    fn id(s:&str,allow_zero:bool)->u32{let v=s.parse::<u32>().unwrap_or_else(|_|fail("SELECTOR_ID"));if (!allow_zero&&v==0)||v.to_string()!=s{fail("SELECTOR_ID")}v}
struct PinnedPrivateOutput{path:PathBuf,_dir:File}
#[cfg(target_os="linux")]
fn output_path(raw:&str)->PinnedPrivateOutput{
    use std::{fs,path::{Path,PathBuf},os::unix::{fs::{MetadataExt,PermissionsExt},io::AsRawFd}};
    let p=Path::new(raw);
    if !p.is_absolute()||p.file_name().is_none(){fail("PRIVATE_OUTPUT_ABSOLUTE_REQUIRED")}
    let real=fs::canonicalize(p.parent().unwrap_or_else(||fail("PRIVATE_OUTPUT_PARENT")))
        .unwrap_or_else(|_|fail("PRIVATE_OUTPUT_PARENT"));
    let meta=fs::metadata(&real).unwrap_or_else(|_|fail("PRIVATE_OUTPUT_PARENT"));
    if !meta.is_dir()||meta.permissions().mode()&0o077!=0{fail("PRIVATE_OUTPUT_DIRECTORY_PERMISSIONS")}
    let dir=fs::File::open(&real).unwrap_or_else(|_|fail("PRIVATE_OUTPUT_PARENT_OPEN"));
    let actual=dir.metadata().unwrap_or_else(|_|fail("PRIVATE_OUTPUT_PARENT"));
    if !actual.is_dir()||actual.dev()!=meta.dev()||actual.ino()!=meta.ino()||
       actual.permissions().mode()&0o077!=0{fail("PRIVATE_OUTPUT_DIRECTORY_CHANGED")}
    let anchor=PathBuf::from(format!("/proc/self/fd/{}",dir.as_raw_fd()));
    if fs::read_link(&anchor).ok().as_ref()!=Some(&real){fail("PRIVATE_OUTPUT_DIRECTORY_CHANGED")}
    let out=anchor.join(p.file_name().unwrap());
    if fs::symlink_metadata(&out).is_ok(){fail("PRIVATE_OUTPUT_ALREADY_EXISTS")}
    PinnedPrivateOutput{path:out,_dir:dir}
}
#[cfg(not(target_os="linux"))]
fn output_path(_raw:&str)->PinnedPrivateOutput{fail("PRIVATE_OUTPUT_LINUX_ONLY")}
    pub fn run(){
        let argv:Vec<String>=env::args().skip(1).collect();
        let (source,destination,path)=match argv.as_slice(){
            [m,i,j,o,p] if m=="--backpack-pair"&&o=="--out"=>
                (id(i,true) as usize,id(j,true) as usize,output_path(p)),
            _=>fail("ARGS"),
        };
        if source==destination||source>=256||destination>=256{fail("SLOT_INDEX_BOUND")}
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
        let mut receipt=session.read_private_backpack_slot_pair(e,source,destination)
            .unwrap_or_else(|_|fail("NO_EXACT_EXISTING_BACKPACK_PAIR"));
        if receipt["sessionId"]!=hex(&r.session_id)||receipt["decodedSha256"]!=decoded_sha||
           receipt["revision"]!=r.revision||receipt["indexGeneration"]!=r.index_generation||
           receipt["source"]["slotIndex"]!=source||receipt["destination"]["slotIndex"]!=destination||
           receipt["writerAuthorized"]!=false||session.receipt().ok()!=Some(r){fail("TARGET_SCOPE")}
        receipt["originalSha256SuppliedExternally"]=serde_json::json!(original_sha);
        receipt["originalSizeBytesSuppliedExternally"]=serde_json::json!(original_size);
        receipt["externalBuildExactCandidate"]=serde_json::json!(true);
        receipt["physicalGameInstallCryptographicallyProven"]=serde_json::json!(false);
        receipt["originalModifiedByHarness"]=serde_json::json!(false);
        receipt["cloudUploadPerformed"]=serde_json::json!(false);
        session.close().unwrap_or_else(|_|fail("SESSION_CLOSE"));
        let bytes=serde_json::to_vec(&receipt).unwrap_or_else(|_|fail("RECEIPT_ENCODE"));
        let mut opt=OpenOptions::new();opt.write(true).create_new(true);
        #[cfg(unix)]{use std::os::unix::fs::OpenOptionsExt;opt.mode(0o600);}
        let mut out=opt.open(&path.path).unwrap_or_else(|_|fail("PRIVATE_OUTPUT_CREATE_NEW"));
        if out.write_all(&bytes).and_then(|_|out.sync_all()).is_err(){drop(out);let _=fs::remove_file(&path.path);fail("PRIVATE_OUTPUT_WRITE")}
        // No target fields, SHA, path, or original data in console.
        eprintln!("LOCAL_BACKPACK_PAIR_READ_PRIVATE_RECEIPT_WRITTEN");
    }
#[cfg(all(test,target_os="linux"))]
#[test]
fn backpack_pair_pinned_output_does_not_follow_replaced_parent(){
    use std::{fs,path::PathBuf,os::unix::fs::{DirBuilderExt,symlink},time::{SystemTime,UNIX_EPOCH}};
    let root=std::env::temp_dir().join(format!("wand-backpack-pinned-{}-{}",std::process::id(),
        SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos()));
    fs::DirBuilder::new().mode(0o700).create(&root).unwrap();
    struct Cleanup(PathBuf);impl Drop for Cleanup{fn drop(&mut self){let _=fs::remove_dir_all(&self.0);}}
    let _cleanup=Cleanup(root.clone());
    let parent=root.join("parent");let moved=root.join("moved");let other=root.join("other");
    for p in [&parent,&other]{fs::DirBuilder::new().mode(0o700).create(p).unwrap();}
    let out=output_path(parent.join("receipt.json").to_str().unwrap());
    fs::rename(&parent,&moved).unwrap();symlink(&other,&parent).unwrap();
    let v=serde_json::json!({"writerAuthorized":false});
    let mut f=OpenOptions::new().write(true).create_new(true).open(&out.path).unwrap();
    f.write_all(&serde_json::to_vec(&v).unwrap()).unwrap();drop(f);
    assert!(!other.join("receipt.json").exists());
    assert_eq!(serde_json::from_slice::<serde_json::Value>(&fs::read(moved.join("receipt.json")).unwrap()).unwrap(),v);
}

}
#[cfg(all(feature="semantic-writer-dev",not(target_arch="wasm32")))]
fn main(){local::run()}
#[cfg(not(all(feature="semantic-writer-dev",not(target_arch="wasm32"))))]
fn main(){eprintln!("LOCAL_BACKPACK_PAIR_READ_DENIED:PRIVATE_NATIVE_FEATURE_REQUIRED");std::process::exit(12)}
