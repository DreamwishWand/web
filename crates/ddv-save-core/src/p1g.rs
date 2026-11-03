//! Research-only strictly bounded single-profile P1G / ZIP slice.
//! AES key is provided by a trusted caller, NEVER hard-coded or serialized.
//! Accepts exactly one non-descriptor, non-ZIP64 "profile" entry without extras,
//! comments or gaps. Unknown archive structures FAIL CLOSED, even if readable.
//! No authority to produce a product save or modify an original input.
use crate::{patch_json_string_tokens,sha256,TokenChange,validate_json,MAX_DECODED_JSON_BYTES};
use aes::cipher::{BlockDecrypt,BlockEncrypt,KeyInit,generic_array::GenericArray};
use aes::Aes256;
use flate2::{Compression,read::DeflateDecoder,write::DeflateEncoder};
use std::io::{Read,Write};

pub const P1G_RESEARCH_CONTRACT:&str="dreamwish.p1g.single-profile.synthetic@1";
const MAX_CIPHERTEXT_BYTES:usize=256*1024*1024;
const MAX_ARCHIVE_BYTES:usize=256*1024*1024;
const PROFILE_NAME:&[u8]=b"profile";
const LOCAL:u32=0x04034b50;
const CENTRAL:u32=0x02014b50;
const EOCD:u32=0x06054b50;
fn u16at(b:&[u8],i:usize)->Result<u16,&'static str>{
 let p=b.get(i..i+2).ok_or("ZIP_HEADER_TRUNCATED")?;
 Ok(u16::from_le_bytes([p[0],p[1]]))
}
fn u32at(b:&[u8],i:usize)->Result<u32,&'static str>{
 let p=b.get(i..i+4).ok_or("ZIP_HEADER_TRUNCATED")?;
 Ok(u32::from_le_bytes([p[0],p[1],p[2],p[3]]))
}
fn put16(bytes:&mut [u8],i:usize,value:u16){bytes[i..i+2].copy_from_slice(&value.to_le_bytes());}
fn put32(bytes:&mut [u8],i:usize,value:u32){bytes[i..i+4].copy_from_slice(&value.to_le_bytes());}
#[derive(Clone,Debug,PartialEq,Eq)]
pub struct P1gZipMetadata {
 pub method:u16,
 pub local_header:[u8;30],
 pub central_header:[u8;46],
 pub end_of_central_directory:[u8;22],
 pub compressed_size:usize,
 pub plain_size:usize,
}
#[derive(Debug)]
pub struct DecodedP1g {
 pub json:Vec<u8>,
 pub encrypted_source_sha256:[u8;32],
 pub decoded_json_sha256:[u8;32],
 pub metadata:P1gZipMetadata,
}
#[derive(Debug)]
pub struct ResearchVerifiedCopy {
 pub source_cipher_sha256:[u8;32],
 pub edited_cipher_sha256:[u8;32],
 pub decoded_before_sha256:[u8;32],
 pub decoded_after_sha256:[u8;32],
 pub edited_ciphertext:Vec<u8>,
 pub verified_changed_pointers:Vec<String>,
 pub product_encode_copy_authorized:bool,
 pub persistent_replace_authorized:bool,
}
fn unpad_ecb(source:&[u8],key:&[u8;32])->Result<Vec<u8>,&'static str>{
 if source.is_empty()||source.len()%16!=0||source.len()>MAX_CIPHERTEXT_BYTES {
  return Err("P1G_INVALID_CIPHERTEXT_SIZE");
 }
 let cipher=Aes256::new_from_slice(key).map_err(|_|"AES_KEY_INVALID")?;
 let mut plain=source.to_vec();
 for block in plain.chunks_exact_mut(16) {
  cipher.decrypt_block(GenericArray::from_mut_slice(block));
 }
 let pad=*plain.last().ok_or("P1G_INVALID_PADDING")? as usize;
 if pad==0||pad>16||pad>plain.len()||
    !plain[plain.len()-pad..].iter().all(|b|*b as usize==pad){
  return Err("P1G_INVALID_PADDING");
 }
 plain.truncate(plain.len()-pad);
 if plain.len()>MAX_ARCHIVE_BYTES{return Err("P1G_ARCHIVE_TOO_LARGE");}
 Ok(plain)
}
fn pad_ecb(archive:&[u8],key:&[u8;32])->Result<Vec<u8>,&'static str>{
 if archive.len()>MAX_ARCHIVE_BYTES{return Err("P1G_ARCHIVE_TOO_LARGE");}
 let cipher=Aes256::new_from_slice(key).map_err(|_|"AES_KEY_INVALID")?;
 let pad=16-archive.len()%16;
 let total=archive.len().checked_add(pad).ok_or("P1G_INVALID_CIPHERTEXT_SIZE")?;
 if total>MAX_CIPHERTEXT_BYTES{return Err("P1G_INVALID_CIPHERTEXT_SIZE");}
 let mut encrypted=archive.to_vec();
 encrypted.resize(total,pad as u8);
 for block in encrypted.chunks_exact_mut(16){
  cipher.encrypt_block(GenericArray::from_mut_slice(block));
 }
 Ok(encrypted)
}
fn read_archive(archive:&[u8],max_json:usize)
 ->Result<(Vec<u8>,P1gZipMetadata),&'static str>{
 if archive.len()<30+PROFILE_NAME.len()+46+PROFILE_NAME.len()+22{
  return Err("ZIP_TRUNCATED");
 }
 let epos=archive.len()-22;
 if u32at(archive,epos)?!=EOCD{return Err("ZIP_EOCD_NOT_FIXED_END");}
 if u16at(archive,epos+4)?!=0||u16at(archive,epos+6)?!=0||
    u16at(archive,epos+8)?!=1||u16at(archive,epos+10)?!=1||
    u16at(archive,epos+20)?!=0 {return Err("ZIP_UNSUPPORTED_DIRECTORY");}
 let cd_size=u32at(archive,epos+12)? as usize;
 let cd_offset=u32at(archive,epos+16)? as usize;
 if cd_offset.checked_add(cd_size)!=Some(epos){return Err("ZIP_DIRECTORY_BOUNDS");}
 if cd_size!=46+PROFILE_NAME.len(){return Err("ZIP_UNSUPPORTED_CENTRAL_METADATA");}
 if u32at(archive,cd_offset)?!=CENTRAL||u32at(archive,0)?!=LOCAL{
  return Err("ZIP_INVALID_SIGNATURE");
 }
 let local=archive.get(0..30).ok_or("ZIP_HEADER_TRUNCATED")?;
 let central=archive.get(cd_offset..cd_offset+46).ok_or("ZIP_HEADER_TRUNCATED")?;
 if u16at(central,28)? as usize!=PROFILE_NAME.len()||
    u16at(central,30)?!=0||u16at(central,32)?!=0||
    u16at(central,34)?!=0||u32at(central,42)?!=0||
    u16at(local,26)? as usize!=PROFILE_NAME.len()||
    u16at(local,28)?!=0 {return Err("ZIP_UNKNOWN_EXTRA_OR_NAME");}
 let flags=u16at(local,6)?;
 if flags!=u16at(central,8)?||flags&!0x0800!=0 {
  return Err("ZIP_UNSUPPORTED_FLAGS_DESCRIPTOR");
 }
 let method=u16at(local,8)?;
 if method!=u16at(central,10)?||!matches!(method,0|8){
  return Err("ZIP_UNSUPPORTED_METHOD");
 }
 if u16at(local,4)?!=u16at(central,6)?||
    u16at(local,10)?!=u16at(central,12)?||
    u16at(local,12)?!=u16at(central,14)?||
    local[14..26]!=central[16..28]{
  return Err("ZIP_LOCAL_CENTRAL_MISMATCH");
 }
 let compressed=u32at(local,18)? as usize;
 let uncompressed=u32at(local,22)? as usize;
 if uncompressed>max_json||uncompressed>MAX_DECODED_JSON_BYTES{
  return Err("ZIP_EXPANDED_PROFILE_TOO_LARGE");
 }
 let data_start=30+PROFILE_NAME.len();
 let data_end=data_start.checked_add(compressed).ok_or("ZIP_DATA_BOUNDS")?;
 if data_end!=cd_offset {return Err("ZIP_UNSUPPORTED_GAPS_OR_DESCRIPTOR");}
 if archive.get(30..data_start)!=Some(PROFILE_NAME)||
    archive.get(cd_offset+46..epos)!=Some(PROFILE_NAME){
  return Err("ZIP_PROFILE_ENTRY_IDENTITY");
 }
 let payload=archive.get(data_start..data_end).ok_or("ZIP_DATA_BOUNDS")?;
 let json=if method==0 {payload.to_vec()}else{
  let mut decoder=DeflateDecoder::new(payload);
  let mut limited=(&mut decoder).take(uncompressed as u64+1);
  let mut buf=Vec::new();
  limited.read_to_end(&mut buf).map_err(|_|"ZIP_DEFLATE_INVALID")?;
  drop(limited);
  if decoder.total_in()!=payload.len() as u64{
   return Err("ZIP_DEFLATE_TRAILING_OR_TRUNCATED");
  }
  buf
 };
 if json.len()!=uncompressed{return Err("ZIP_UNCOMPRESSED_SIZE_MISMATCH");}
 if crc32fast::hash(&json)!=u32at(local,14)?{
  return Err("ZIP_CRC_MISMATCH");
 }
 validate_json(&json)?;
 let mut l=[0u8;30];l.copy_from_slice(local);
 let mut c=[0u8;46];c.copy_from_slice(central);
 let mut e=[0u8;22];e.copy_from_slice(&archive[epos..]);
 Ok((json,P1gZipMetadata {
  method,local_header:l,central_header:c,
  end_of_central_directory:e,compressed_size:compressed,plain_size:uncompressed
 }))
}
pub fn decode_p1g_research(ciphertext:&[u8],key:&[u8;32],max_json:usize)
 ->Result<DecodedP1g,&'static str>{
 if max_json==0||max_json>MAX_DECODED_JSON_BYTES{
  return Err("P1G_READ_BUDGET_INVALID");
 }
 let archive=unpad_ecb(ciphertext,key)?;
 let (json,metadata)=read_archive(&archive,max_json)?;
 Ok(DecodedP1g{encrypted_source_sha256:sha256(ciphertext),
  decoded_json_sha256:sha256(&json),json,metadata})
}
fn zip_rebuild_research(json:&[u8],meta:&P1gZipMetadata)
 ->Result<Vec<u8>,&'static str>{
 if json.len()>MAX_DECODED_JSON_BYTES||json.len()>u32::MAX as usize {
  return Err("ZIP_PROFILE_TOO_LARGE");
 }
 let packed=if meta.method==0{json.to_vec()}else{
  let mut writer=DeflateEncoder::new(Vec::new(),Compression::new(6));
  writer.write_all(json).map_err(|_|"ZIP_COMPRESS_FAILED")?;
  writer.finish().map_err(|_|"ZIP_COMPRESS_FAILED")?
 };
 let compressed=u32::try_from(packed.len()).map_err(|_|"ZIP_TOO_LARGE")?;
 let expanded=u32::try_from(json.len()).map_err(|_|"ZIP_TOO_LARGE")?;
 let data_start=30+PROFILE_NAME.len();
 let central_offset=data_start.checked_add(packed.len()).ok_or("ZIP_TOO_LARGE")?;
 let mut local=meta.local_header;
 let mut central=meta.central_header;
 let mut end=meta.end_of_central_directory;
 for h in [&mut local[..],&mut central[..]]{
  let at=if h.len()==30{14}else{16};
  put32(h,at,crc32fast::hash(json));
  put32(h,at+4,compressed);
  put32(h,at+8,expanded);
 }
 put32(&mut end,16,u32::try_from(central_offset).map_err(|_|"ZIP_TOO_LARGE")?);
 put32(&mut end,12,(46+PROFILE_NAME.len()) as u32);
 // Retain all *accepted and verified* metadata, never invent missing entries.
 let mut archive=Vec::with_capacity(central_offset+46+PROFILE_NAME.len()+22);
 archive.extend_from_slice(&local);
 archive.extend_from_slice(PROFILE_NAME);
 archive.extend_from_slice(&packed);
 archive.extend_from_slice(&central);
 archive.extend_from_slice(PROFILE_NAME);
 archive.extend_from_slice(&end);
 let (check_json,check_meta)=read_archive(&archive,MAX_DECODED_JSON_BYTES)?;
 if check_json!=json||check_meta.method!=meta.method{
  return Err("ZIP_INDEPENDENT_SELF_AUDIT_FAILED");
 }
 Ok(archive)
}
/// Offline V2 research: rebuild a ZERO-EDIT copy of an explicitly supported
/// P1G envelope, retaining every decoded JSON byte. This intentionally
/// exercises Encode/Reopen instead of taking the immutable original shortcut.
/// The source ciphertext is never overwritten and no product capability is granted.
pub fn create_p1g_noop_rebuild_research(
 original_ciphertext:&[u8],expected_cipher_sha:[u8;32],
 key:&[u8;32],max_json:usize
)->Result<ResearchVerifiedCopy,&'static str>{
 if sha256(original_ciphertext)!=expected_cipher_sha{
  return Err("ENCRYPTED_SOURCE_SHA_CAS_FAILED");
 }
 let decoded=decode_p1g_research(original_ciphertext,key,max_json)?;
 let rebuilt=zip_rebuild_research(&decoded.json,&decoded.metadata)?;
 let encrypted=pad_ecb(&rebuilt,key)?;
 let reopened=decode_p1g_research(&encrypted,key,max_json)?;
 if reopened.json!=decoded.json ||
    reopened.decoded_json_sha256!=decoded.decoded_json_sha256 ||
    reopened.metadata.method!=decoded.metadata.method ||
    reopened.metadata.local_header[4..14]!=decoded.metadata.local_header[4..14] ||
    reopened.metadata.central_header[4..16]!=decoded.metadata.central_header[4..16] ||
    reopened.metadata.central_header[34..42]!=decoded.metadata.central_header[34..42] ||
    sha256(original_ciphertext)!=expected_cipher_sha{
   return Err("P1G_NOOP_REBUILD_METADATA_OR_REOPEN_MISMATCH");
 }
 Ok(ResearchVerifiedCopy {
  source_cipher_sha256:expected_cipher_sha,
  edited_cipher_sha256:sha256(&encrypted),
  decoded_before_sha256:decoded.decoded_json_sha256,
  decoded_after_sha256:reopened.decoded_json_sha256,
  edited_ciphertext:encrypted,
  verified_changed_pointers:Vec::new(),
  product_encode_copy_authorized:false,persistent_replace_authorized:false
 })
}

/// Synthetic encrypted P1G copy with exact JSON token splice and self-Reopen.
/// The source stays immutable. Consumer must NEVER treat this as product authority.
pub fn create_p1g_copy_research(
 original_ciphertext:&[u8],expected_cipher_sha:[u8;32],
 key:&[u8;32],expected_schema:u64,changes:&[TokenChange],max_json:usize
)->Result<ResearchVerifiedCopy,&'static str>{
 if sha256(original_ciphertext)!=expected_cipher_sha {
  return Err("ENCRYPTED_SOURCE_SHA_CAS_FAILED");
 }
 let decoded=decode_p1g_research(original_ciphertext,key,max_json)?;
 let patched=patch_json_string_tokens(&decoded.json,decoded.decoded_json_sha256,
     expected_schema,changes)?;
 let zip=zip_rebuild_research(&patched.bytes,&decoded.metadata)?;
 let encrypted=pad_ecb(&zip,key)?;
 let reopened=decode_p1g_research(&encrypted,key,max_json)?;
 if reopened.json!=patched.bytes||
    reopened.decoded_json_sha256!=patched.edited_sha256||
    sha256(original_ciphertext)!=expected_cipher_sha {
  return Err("P1G_REOPEN_OR_ORIGINAL_MISMATCH");
 }
 Ok(ResearchVerifiedCopy {
  source_cipher_sha256:expected_cipher_sha,
  edited_cipher_sha256:sha256(&encrypted),
  decoded_before_sha256:decoded.decoded_json_sha256,
  decoded_after_sha256:patched.edited_sha256,
  edited_ciphertext:encrypted,
  verified_changed_pointers:changes.iter().map(|x|x.pointer.clone()).collect(),
  product_encode_copy_authorized:false,persistent_replace_authorized:false
 })
}
/// Synthetic fixture helper. Never invoke on a real save or expose as Writer.
pub fn encode_synthetic_fixture(json:&[u8],key:&[u8;32],method:u16)
 ->Result<Vec<u8>,&'static str>{
 validate_json(json)?;
 if !matches!(method,0|8){return Err("ZIP_UNSUPPORTED_METHOD");}
 let mut local=[0u8;30];let mut central=[0u8;46];let mut end=[0u8;22];
 put32(&mut local,0,LOCAL);put16(&mut local,4,20);
 put16(&mut local,8,method);put16(&mut local,26,PROFILE_NAME.len() as u16);
 put32(&mut central,0,CENTRAL);put16(&mut central,4,20);
 put16(&mut central,6,20);put16(&mut central,10,method);
 put16(&mut central,28,PROFILE_NAME.len() as u16);
 put32(&mut end,0,EOCD);put16(&mut end,8,1);put16(&mut end,10,1);
 let meta=P1gZipMetadata{method,local_header:local,central_header:central,
  end_of_central_directory:end,compressed_size:0,plain_size:0};
 let zip=zip_rebuild_research(json,&meta)?;
 pad_ecb(&zip,key)
}
