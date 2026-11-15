//! Private-local, native-only ONE read receipt. No P1G decryptor, Writer,
//! original/backup file access, network, stdout data or product authorization.
//! Pipe decoded JSON from the already accepted local codec. External V0
//! encrypted-original/Build evidence must be independently checked by QR-L.
#[cfg(all(feature="semantic-writer-dev",not(target_arch="wasm32")))]
mod local {
    use ddv_save_core::{BuildIdentity,BuildKind,Platform,ProductSession,WorkerAction,WorkerEnvelope,PRODUCT_WORKER_CONTRACT};
    use sha2::{Digest,Sha256};
    use std::{env,fs::File,io::{self,Read,Write}};
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
// Fixed inherited anonymous pipe, never a caller-provided output path.
// The authorized Private Lab parent owns the reader and all persistence.
// No direct files, named FIFO, socket, stdout/stderr, or stdin alias.
#[cfg(target_os="linux")]
fn private_pipe(fd:i32)->Result<File,&'static str>{
    use std::{fs,os::unix::{fs::{FileTypeExt,MetadataExt},io::FromRawFd}};
    let p=format!("/proc/self/fd/{fd}");
    let link=fs::read_link(&p).map_err(|_|"PRIVATE_RECEIPT_FD_MISSING")?;
    let m=fs::metadata(&p).map_err(|_|"PRIVATE_RECEIPT_FD_MISSING")?;
    if !m.file_type().is_fifo()||link.to_str()!=Some(&format!("pipe:[{}]",m.ino())){
        return Err("PRIVATE_RECEIPT_ANONYMOUS_PIPE_REQUIRED")
    }
    for i in 0..3{
        if let Ok(other)=fs::metadata(format!("/proc/self/fd/{i}")){
            if other.dev()==m.dev()&&other.ino()==m.ino(){return Err("PRIVATE_RECEIPT_STDIO_ALIAS")}
        }
    }
    let info=fs::read_to_string(format!("/proc/self/fdinfo/{fd}")).map_err(|_|"PRIVATE_RECEIPT_FD_FLAGS")?;
    let flags=info.lines().find_map(|l|l.strip_prefix("flags:")).and_then(|x|u32::from_str_radix(x.trim(),8).ok()).ok_or("PRIVATE_RECEIPT_FD_FLAGS")?;
    if flags&3!=1{return Err("PRIVATE_RECEIPT_WRITE_ONLY_REQUIRED")}
    // Single-threaded example, descriptor inherited from verified parent.
    // No caller-controlled open/create/rename; ownership transfers once.
    Ok(unsafe{File::from_raw_fd(fd)})
}
#[cfg(not(target_os="linux"))]
fn private_pipe(_fd:i32)->Result<File,&'static str>{Err("PRIVATE_RECEIPT_LINUX_ONLY")}
    pub fn run(){
        let argv:Vec<String>=env::args().skip(1).collect();
        let (source,destination)=match argv.as_slice(){
            [m,i,j,o] if m=="--backpack-pair"&&o=="--receipt-fd3"=>
                (id(i,true) as usize,id(j,true) as usize),
            _=>fail("ARGS"),
        };
        if source==destination||source>=256||destination>=256{fail("SLOT_INDEX_BOUND")}
        let mut out=private_pipe(3).unwrap_or_else(|code|fail(code));
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
        if bytes.len()>65536{fail("PRIVATE_RECEIPT_BOUND")}
        if out.write_all(&bytes).and_then(|_|out.flush()).is_err(){fail("PRIVATE_RECEIPT_WRITE")}
        drop(out);
        // No target fields, SHA, path, or original data in console.
        eprintln!("LOCAL_BACKPACK_PAIR_READ_PRIVATE_RECEIPT_WRITTEN");
    }
#[cfg(all(test,target_os="linux"))]
#[test]
fn backpack_pair_anonymous_pipe_only(){
    use std::os::fd::{AsRawFd,IntoRawFd};
    let (mut reader,writer)=io::pipe().unwrap();
    assert!(private_pipe(reader.as_raw_fd()).is_err());
    let fd=writer.into_raw_fd();
    let mut out=private_pipe(fd).unwrap();
    out.write_all(b"synthetic receipt").unwrap();drop(out);
    let mut got=Vec::new();reader.read_to_end(&mut got).unwrap();
    assert_eq!(got,b"synthetic receipt");
    let f=File::open("/dev/null").unwrap();
    assert!(private_pipe(f.as_raw_fd()).is_err());
    assert!(private_pipe(-1).is_err());
}

}
#[cfg(all(feature="semantic-writer-dev",not(target_arch="wasm32")))]
fn main(){local::run()}
#[cfg(not(all(feature="semantic-writer-dev",not(target_arch="wasm32"))))]
fn main(){eprintln!("LOCAL_BACKPACK_PAIR_READ_DENIED:PRIVATE_NATIVE_FEATURE_REQUIRED");std::process::exit(12)}
