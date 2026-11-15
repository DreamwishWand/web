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
    enum ReadRequest{
        Backpack{source:usize,destination:usize},
        #[cfg(feature="private-native-v1")]
        Ordinary{item:u32,grid:u32,object:Option<u32>,entry:[u8;32]},
    }
    #[cfg(feature="private-native-v1")]
    fn ordinary_entry(s:&str)->[u8;32]{
        if s.len()!=64||!s.bytes().all(|c|matches!(c,b'0'..=b'9'|b'a'..=b'f')){fail("ORDINARY_ENTRY_SHA")}
        let mut out=[0;32];
        for (i,x) in s.as_bytes().chunks_exact(2).enumerate(){
            let v=|b|match b{b'0'..=b'9'=>b-b'0',b'a'..=b'f'=>b-b'a'+10,_=>0};
            out[i]=(v(x[0])<<4)|v(x[1]);
        }
        if out==[0;32]{fail("ORDINARY_ENTRY_SHA")}
        out
    }
    fn request(argv:&[String])->ReadRequest{
        match argv{
            [m,i,j,o] if m=="--backpack-pair"&&o=="--receipt-fd3"=>{
                let (source,destination)=(id(i,true) as usize,id(j,true) as usize);
                if source==destination||source>=256||destination>=256{fail("SLOT_INDEX_BOUND")}
                ReadRequest::Backpack{source,destination}
            },
            #[cfg(feature="private-native-v1")]
            [m,a,item,grid,entry,o] if m=="--ordinary-adddel-readset"&&a=="add"&&o=="--receipt-fd3"=>
                ReadRequest::Ordinary{item:id(item,false),grid:id(grid,true),object:None,entry:ordinary_entry(entry)},
            #[cfg(feature="private-native-v1")]
            [m,a,item,grid,object,entry,o] if m=="--ordinary-adddel-readset"&&a=="delete"&&o=="--receipt-fd3"=>
                ReadRequest::Ordinary{item:id(item,false),grid:id(grid,true),object:Some(id(object,true)),entry:ordinary_entry(entry)},
            _=>fail("ARGS"),
        }
    }
    pub fn run(){
        let argv:Vec<String>=env::args().skip(1).collect();
        let req=request(&argv);
        let ordinary=match &req{
            ReadRequest::Backpack{..}=>false,
            #[cfg(feature="private-native-v1")]
            ReadRequest::Ordinary{..}=>true,
        };
        let mut out=private_pipe(3).unwrap_or_else(|code|fail(code));
        if required("WAND_LOCAL_INSTALLED_STEAM_FULLVERSION")!=EXACT{fail("EXACT_STEAM_BUILD")}
        let original_sha=sha_field("WAND_LOCAL_ORIGINAL_SHA256");
        let decoded_sha=sha_field("WAND_LOCAL_DECODED_SHA256");
        let original_size=required("WAND_LOCAL_ORIGINAL_SIZE_BYTES").parse::<u64>().unwrap_or_else(|_|fail("ORIGINAL_SIZE"));
        if original_size==0||original_size>128*1024*1024{fail("ORIGINAL_SIZE")}
        // Ordinary receipts require an external original/Backup equality
        // witness from the trusted Private Lab parent. Never open either
        // encrypted file or treat this declaration as a cryptographic grant.
        if ordinary{
            if env::var_os("WAND_LOCAL_INSTALLED_SWITCH_BID").is_some_and(|x|!x.is_empty()){
                fail("ORDINARY_MIXED_BUILD")
            }
            let backup=sha_field("WAND_LOCAL_BACKUP_SHA256");
            let size=required("WAND_LOCAL_BACKUP_SIZE_BYTES");
            if backup!=original_sha||size!=original_size.to_string(){
                fail("ORDINARY_BACKUP_BINDING")
            }
        }
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
        let mut receipt=match req{
            ReadRequest::Backpack{source,destination}=>{
                let value=session.read_private_backpack_slot_pair(e,source,destination)
                    .unwrap_or_else(|_|fail("NO_EXACT_EXISTING_BACKPACK_PAIR"));
                if value["source"]["slotIndex"]!=source||value["destination"]["slotIndex"]!=destination{
                    fail("TARGET_SCOPE")
                }
                value
            },
            #[cfg(feature="private-native-v1")]
            ReadRequest::Ordinary{item,grid,object,entry}=>{
                let mut value=session.read_private_ordinary_adddel_dependencies(e,item,entry,grid,object)
                    .unwrap_or_else(|_|fail("NO_EXACT_ORDINARY_READSET"));
                let stored=&value["ordinaryStoredGridReadSet"];
                let spawn=&value["ordinarySpawnAddressReadSet"];
                let target=object.map(u64::from).or_else(||stored["nextGridObjectId"].as_u64())
                    .unwrap_or_else(||fail("ORDINARY_TARGET_COUNTER"));
                if value["contract"]!="wand.native.private.ordinary-adddel-dependencies@1"||
                   value["target"]["inventoryId"]!=0||value["target"]["itemId"]!=item||
                   value["target"]["entrySha256"]!=hex(&entry)||stored["gridId"]!=grid||
                   spawn["gridId"]!=grid||spawn["objectId"]!=target||
                   (object.is_some()&&stored["selectedStoredObject"]["objectId"]!=target)||
                   (object.is_none()&&!stored["selectedStoredObject"].is_null())||
                   value["productReadAccepted"]!=false||value["editedCopyAuthorized"]!=false||
                   value["applyAuthorized"]!=false||stored["writerAuthorized"]!=false||
                   spawn["writerAuthorized"]!=false{fail("ORDINARY_TARGET_SCOPE")}
                value["operationReadOnly"]=serde_json::json!(if object.is_some(){"delete"}else{"add"});
                value["backupSha256SuppliedExternally"]=serde_json::json!(original_sha.clone());
                value["backupSizeBytesSuppliedExternally"]=serde_json::json!(original_size);
                value["originalBackupBytesIndependentlyVerifiedByHarness"]=serde_json::json!(false);
                value
            }
        };
        if receipt["sessionId"]!=hex(&r.session_id)||receipt["decodedSha256"]!=decoded_sha||
           receipt["revision"]!=r.revision||receipt["indexGeneration"]!=r.index_generation||
           receipt["writerAuthorized"]!=false||session.receipt().ok()!=Some(r){fail("TARGET_SCOPE")}
        receipt["originalSha256SuppliedExternally"]=serde_json::json!(original_sha);
        receipt["originalSizeBytesSuppliedExternally"]=serde_json::json!(original_size);
        receipt["externalBuildExactCandidate"]=serde_json::json!(true);
        receipt["physicalGameInstallCryptographicallyProven"]=serde_json::json!(false);
        receipt["originalModifiedByHarness"]=serde_json::json!(false);
        receipt["cloudUploadPerformed"]=serde_json::json!(false);
        session.close().unwrap_or_else(|_|fail("SESSION_CLOSE"));
        let bytes=serde_json::to_vec(&receipt).unwrap_or_else(|_|fail("RECEIPT_ENCODE"));
        if bytes.len()>if ordinary{8*1024*1024}else{65536}{fail("PRIVATE_RECEIPT_BOUND")}
        if out.write_all(&bytes).and_then(|_|out.flush()).is_err(){fail("PRIVATE_RECEIPT_WRITE")}
        drop(out);
        // No target fields, SHA, path, or original data in console.
        if ordinary{eprintln!("LOCAL_ORDINARY_ADDDEL_READ_PRIVATE_RECEIPT_WRITTEN");}
        else{eprintln!("LOCAL_BACKPACK_PAIR_READ_PRIVATE_RECEIPT_WRITTEN");}
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
