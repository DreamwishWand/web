//! 05 QR PR341 independent synthetic W1 READ audit. Never use a real game save.
 //! Exact source 0ebf4efe53df82a947873cf8163b4a7949af4cf4.
use ddv_save_core::{
 sha256,
 p1g::encode_synthetic_fixture,
 read_only_index::{ReadRequest,W1ReadIndex,READ_INDEX_CONTRACT}
};
use aes::{Aes256,cipher::{KeyInit,BlockDecrypt,BlockEncrypt,generic_array::GenericArray}};
use sha2::{Digest,Sha256};
use std::fmt::Write as _;

const BID:&str="9A239D3DB569756D";
const KEY:[u8;32]=[0x71;32];
const CURSOR_KEY:[u8;32]=[0xa9;32];

fn json() -> Vec<u8>{
 br#"{"GameInfo":{"Version":626},"Player":{},"World":{"RecurringEvents":{"7":{"ItemSpawning":{"RecurringEventItemID":2010000021,"NextOccurrence":"2126-08-20T00:00:00Z","Extra":{"ignore":["abc",10]}}},"12":{"WildCropsSpawningInVillage":{"RecurringEventItemID":"2010400001","NextOccurrence":"2022-09-06T00:00:00Z"}},"155":{"FlowerSpawningInVillage":{"RecurringEventItemID":2010500008,"NextOccurrence":"2025-01-01T00:00:00Z"}}}},"Unknown":{"escaped":"\u00e9","nonNormalizedDecimal":1.00,"opaque":[1,{"x":true}]}}"#.to_vec()
}
fn req<'a>(id:u64,source:[u8;32],cursor:Option<&'a str>,limit:usize)->ReadRequest<'a>{
 ReadRequest{
  expected_session_id:id,expected_revision:0,expected_index_generation:0,
  expected_decoded_sha256:source,cursor,limit
 }
}
fn open(id:u64,private_key:[u8;32])->W1ReadIndex{
 let data=json();
 W1ReadIndex::open_decoded_research(id,data.clone(),sha256(&data),BID,private_key).unwrap()
}
fn assert_refused<T>(v:Result<T,&'static str>){
 assert!(v.is_err(),"unexpected accepted input");
}
fn sha2_hmac_reference(
 key:[u8;32],sid:u64,revision:u64,index_gen:u64,
 json_sha:[u8;32],p1g_sha:Option<[u8;32]>,position:u64
)->String{
 // Independent RFC2104-style construction and payload serialization.
 let mut material=READ_INDEX_CONTRACT.as_bytes().to_vec();
 material.extend(sid.to_le_bytes());
 material.extend(revision.to_le_bytes());
 material.extend(index_gen.to_le_bytes());
 material.extend(json_sha);
 if let Some(h)=p1g_sha{material.extend(h);}
 material.extend(BID.as_bytes());
 material.extend(position.to_le_bytes());
 let mut inner=vec![0x36_u8;64];let mut outer=vec![0x5c_u8;64];
 for i in 0..key.len(){inner[i]^=key[i];outer[i]^=key[i];}
 inner.extend(material);
 let inner_hash=Sha256::digest(inner);
 outer.extend(inner_hash);
 let mac=Sha256::digest(outer);
 let mut s=format!("w1r1.{position:016x}.");
 for b in mac {write!(&mut s,"{b:02x}").unwrap();}
 s
}
fn mutate_encrypted_zip<F:FnOnce(&mut Vec<u8>)>(
 encrypted:&[u8],key:[u8;32],change:F
)->Vec<u8>{
 let aes=Aes256::new(GenericArray::from_slice(&key));
 let mut raw=encrypted.to_vec();
 assert_eq!(raw.len()%16,0);
 for block in raw.chunks_exact_mut(16){aes.decrypt_block(GenericArray::from_mut_slice(block));}
 let pad=*raw.last().unwrap() as usize;
 assert!(pad>0&&pad<=16);
 raw.truncate(raw.len()-pad);
 change(&mut raw);
 let new_pad=16-(raw.len()%16);
 raw.resize(raw.len()+new_pad,new_pad as u8);
 for block in raw.chunks_exact_mut(16){aes.encrypt_block(GenericArray::from_mut_slice(block));}
 raw
}
#[test]
fn independently_recompute_hmac_and_check_w1_scoped_pagination(){
 let source=json(); let hash=sha256(&source);
 let mut s=open(309,CURSOR_KEY);
 assert_eq!(s.row_count(),3);
 let p=s.query_page(req(309,hash,None,1)).unwrap();
 assert_eq!(p.total_w1_rows,3);
 assert_eq!(p.rows.len(),1);
 assert_eq!(p.rows[0].saved_index,7);
 assert_eq!(p.rows[0].event_id,2010000021);
 assert_eq!(p.rows[0].next_occurrence_pointer,"/World/RecurringEvents/7/ItemSpawning/NextOccurrence");
 assert_eq!(p.rows[0].raw_timestamp_json,"\"2126-08-20T00:00:00Z\"");
 assert!(!p.complete && p.w1_source_index_complete);
 assert!(!p.full_domain_reference_closure_complete);
 assert!(!p.product_read_worker_accepted);
 assert!(!p.product_writer_authorized);
 assert_eq!(p.encrypted_p1g_sha256,None);
 let first=p.next_cursor.unwrap();
 assert_eq!(first,sha2_hmac_reference(CURSOR_KEY,309,0,0,hash,None,1));
 let p2=s.query_page(req(309,hash,Some(&first),1)).unwrap();
 assert_eq!(p2.rows[0].saved_index,12);
 let second=p2.next_cursor.unwrap();
 assert_eq!(second,sha2_hmac_reference(CURSOR_KEY,309,0,0,hash,None,2));
 let p3=s.query_page(req(309,hash,Some(&second),64)).unwrap();
 assert_eq!(p3.rows[0].saved_index,155);
 assert!(p3.complete && p3.next_cursor.is_none());
 assert_eq!(s.query_page(req(309,hash,None,1)).err(),Some("READ_CURSOR_EXHAUSTED"));
}
#[test]
fn forged_mutated_position_out_of_range_and_replay_cannot_advance(){
 let hash=sha256(&json());let mut s=open(310,CURSOR_KEY);
 assert_refused(s.query_page(req(310,hash,Some("w1r1.fake"),1)));
 assert_refused(s.query_page(req(310,hash,None,0)));
 assert_refused(s.query_page(req(310,hash,None,65)));
 let first=s.query_page(req(310,hash,None,1)).unwrap().next_cursor.unwrap();
 let tampered=format!("{}{}", &first[..first.len()-1], if first.ends_with('a'){"b"}else{"a"});
 let wrong_position=first.replacen("0000000000000001","ffffffffffffffff",1);
 for wrong in [&tampered,&wrong_position,"w1r1.0000000000001234.00", ""] {
  assert_eq!(s.query_page(req(310,hash,Some(wrong),1)).err(),
             Some("READ_CURSOR_REPLAY_OR_SCOPE_MISMATCH"));
 }
 assert_eq!(s.query_page(req(311,hash,Some(&first),1)).err(),Some("READ_SESSION_MISMATCH"));
 assert_eq!(s.query_page(req(310,[0;32],Some(&first),1)).err(),Some("READ_SOURCE_SHA_STALE"));
 assert_eq!(s.query_page(ReadRequest{expected_revision:1,..req(310,hash,Some(&first),1)}).err(),
            Some("READ_REVISION_STALE"));
 assert_eq!(s.query_page(ReadRequest{expected_index_generation:99,..req(310,hash,Some(&first),1)}).err(),
            Some("READ_INDEX_GENERATION_STALE"));
 let second=s.query_page(req(310,hash,Some(&first),1)).unwrap();
 assert_eq!(second.rows[0].saved_index,12);
 assert_eq!(s.query_page(req(310,hash,Some(&first),1)).err(),
            Some("READ_CURSOR_REPLAY_OR_SCOPE_MISMATCH"));
 let pending=second.next_cursor.unwrap();
 s.close();
 assert_eq!(s.query_page(req(310,hash,Some(&pending),1)).err(),Some("READ_SESSION_CLOSED"));
}
#[test]
fn hmac_binding_to_source_key_session_and_issuer_freshness_counterexample(){
 let h=sha256(&json());
 let mut first=open(414,CURSOR_KEY);
 let token=first.query_page(req(414,h,None,1)).unwrap().next_cursor.unwrap();
 let mut second=open(414,[0x3b;32]);
 second.query_page(req(414,h,None,1)).unwrap();
 assert_eq!(second.query_page(req(414,h,Some(&token),1)).err(),
            Some("READ_CURSOR_REPLAY_OR_SCOPE_MISMATCH"));
 let mut other_session=open(415,CURSOR_KEY);
 let second_token=other_session.query_page(req(415,h,None,1)).unwrap().next_cursor.unwrap();
 assert_ne!(token,second_token,"must bind session even when source and key are same");
 let mut altered=json();
 altered.extend_from_slice(b" ");
 let altered_sha=sha256(&altered);
 let mut other_source=W1ReadIndex::open_decoded_research(414,altered,altered_sha,BID,CURSOR_KEY).unwrap();
 let other_token=other_source.query_page(req(414,altered_sha,None,1)).unwrap().next_cursor.unwrap();
 assert_ne!(token,other_token,"must bind source even when session/key same");
 // Research limitation: SAME caller-supplied key/session reused after a
 // fresh open reproduces the same token. Only future trusted host must
 // allocate fresh unpredictable session/key and prevent cross-open replay.
 let mut reused=open(414,CURSOR_KEY);
 let same=reused.query_page(req(414,h,None,1)).unwrap().next_cursor.unwrap();
 assert_eq!(same,token,"host key/session reuse counterexample not closed by research API");
 assert!(reused.query_page(req(414,h,Some(&token),1)).is_ok());
}
#[test]
fn full_strict_source_validation_rejects_outside_w1_before_index(){
 let malformed=[
 br#"{"GameInfo":{"Version":626},"World":{"RecurringEvents":[]},"Unrelated":{"a":1,"a":2}}"#.as_slice(),
 br#"{"GameInfo":{"Version":626},"World":{"RecurringEvents":[]},"Unrelated":"\uD800"}"#,
 br#"{"GameInfo":{"Version":626},"World":{"RecurringEvents":[]},"Unrelated":1e999}"#,
 br#"{"GameInfo":{"Version":626},"World":{"RecurringEvents":[]},"Unrelated":true} trailing"#,
 ];
 for b in malformed{
  assert_refused(W1ReadIndex::open_decoded_research(418,b.to_vec(),sha256(b),BID,CURSOR_KEY));
 }
 let mut source=json();
 source.extend_from_slice(b" ");
 let hash=sha256(&source);
 let mut read=W1ReadIndex::open_decoded_research(418,source,hash,BID,CURSOR_KEY).unwrap();
 assert_eq!(read.query_page(req(418,hash,None,64)).unwrap().rows.len(),3);
}
#[test]
fn bounded_index_refuses_large_w1_and_invalid_object_key_and_row_count(){
 let too_big="x".repeat(2*1024*1024);
 let b=format!(r#"{{"GameInfo":{{"Version":626}},"World":{{"RecurringEvents":[{{"ItemSpawning":{{"RecurringEventItemID":1,"NextOccurrence":"2000-01-01T00:00:00Z","opaque":"{}"}}}}]}}}}"#,too_big).into_bytes();
 let h=sha256(&b);
 assert_eq!(W1ReadIndex::open_decoded_research(420,b,h,BID,CURSOR_KEY).err(),
            Some("READ_W1_SUBTREE_TOO_LARGE"));
 // A large unrelated subtree is allowed by the W1-specific 2 MiB cap.
 let outside="x".repeat(2*1024*1024);
 let b=format!(r#"{{"GameInfo":{{"Version":626}},"World":{{"RecurringEvents":[]}},"Unknown":{{"Large":"{}"}}}}"#,outside).into_bytes();
 let h=sha256(&b);
 let mut s=W1ReadIndex::open_decoded_research(420,b,h,BID,CURSOR_KEY).unwrap();
 let empty=s.query_page(req(420,h,None,1)).unwrap();
 assert!(empty.complete && empty.rows.is_empty());
 for key in ["00","-1","not-a-index"]{
  let b=format!(r#"{{"GameInfo":{{"Version":626}},"World":{{"RecurringEvents":{{"{}":{{"ItemSpawning":{{"RecurringEventItemID":1,"NextOccurrence":"2000-01-01T00:00:00Z"}}}}}}}}}}"#,key).into_bytes();
  assert_refused(W1ReadIndex::open_decoded_research(420,b.clone(),sha256(&b),BID,CURSOR_KEY));
 }
 let values=(0..4097).map(|i|format!(r#"{{"ItemSpawning":{{"RecurringEventItemID":{},"NextOccurrence":"2000-01-01T00:00:00Z"}}}}"#,i+1)).collect::<Vec<_>>().join(",");
 let b=format!(r#"{{"GameInfo":{{"Version":626}},"World":{{"RecurringEvents":[{}]}}}}"#,values).into_bytes();
 assert_refused(W1ReadIndex::open_decoded_research(420,b.clone(),sha256(&b),BID,CURSOR_KEY));
}
#[test]
fn page_boundary_64_rows_no_index_out_of_bounds_or_fake_complete(){
 let rows=(0..65).map(|i|format!(r#"{{"ItemSpawning":{{"RecurringEventItemID":{},"NextOccurrence":"2000-01-01T00:00:00Z"}}}}"#,i+1)).collect::<Vec<_>>().join(",");
 let b=format!(r#"{{"GameInfo":{{"Version":626}},"World":{{"RecurringEvents":[{}]}}}}"#,rows).into_bytes();
 let h=sha256(&b);
 let mut s=W1ReadIndex::open_decoded_research(422,b,h,BID,CURSOR_KEY).unwrap();
 let first=s.query_page(req(422,h,None,64)).unwrap();
 assert_eq!(first.rows.len(),64);
 assert!(!first.complete);
 assert_eq!(first.total_w1_rows,65);
 assert_eq!(first.next_cursor.as_deref(),Some(sha2_hmac_reference(CURSOR_KEY,422,0,0,h,None,64).as_str()));
 let second=s.query_page(req(422,h,first.next_cursor.as_deref(),64)).unwrap();
 assert_eq!(second.rows.len(),1);
 assert_eq!(second.rows[0].saved_index,64);
 assert!(second.complete && second.next_cursor.is_none());
 assert_eq!(s.query_page(req(422,h,None,1)).err(),Some("READ_CURSOR_EXHAUSTED"));
}
#[test]
fn store_deflate_p1g_separate_shas_hmac_and_zip_negative_matrix(){
 let source=json();let decoded_sha=sha256(&source);
 for method in [0_u16,8_u16]{
  let cipher=encode_synthetic_fixture(&source,&KEY,method).unwrap();
  let cipher_sha=sha256(&cipher);
  let mut s=W1ReadIndex::open_p1g_research(531,&cipher,&KEY,cipher_sha,decoded_sha,BID,CURSOR_KEY).unwrap();
  let p=s.query_page(req(531,decoded_sha,None,1)).unwrap();
  assert_eq!(p.encrypted_p1g_sha256,Some(cipher_sha));
  let token=p.next_cursor.unwrap();
  assert_eq!(token,sha2_hmac_reference(CURSOR_KEY,531,0,0,decoded_sha,Some(cipher_sha),1));
  assert!(!p.product_read_worker_accepted&&!p.product_writer_authorized);
  assert_refused(W1ReadIndex::open_p1g_research(531,&cipher,&KEY,[0;32],decoded_sha,BID,CURSOR_KEY));
  assert_refused(W1ReadIndex::open_p1g_research(531,&cipher,&KEY,cipher_sha,[0;32],BID,CURSOR_KEY));
  assert_refused(W1ReadIndex::open_p1g_research(531,&cipher,&[0;32],cipher_sha,decoded_sha,BID,CURSOR_KEY));
  assert_refused(W1ReadIndex::open_p1g_research(531,&cipher,&KEY,cipher_sha,decoded_sha,"UNVERIFIED",CURSOR_KEY));
  for change in [
   0usize, // raw header invalid signature
   6,      // local flags change: local vs central mismatch
   10,     // DOS time change: local vs central mismatch
   14,     // CRC change: local vs central mismatch
   18,     // compressed size change
   28,     // unknown extra length
   30,     // filename bytes change
  ]{
   let damaged=mutate_encrypted_zip(&cipher,KEY,|zip|zip[change]^=1);
   assert_refused(W1ReadIndex::open_p1g_research(
    531,&damaged,&KEY,sha256(&damaged),decoded_sha,BID,CURSOR_KEY));
  }
  let bad_comment=mutate_encrypted_zip(&cipher,KEY,|zip|{
   let n=zip.len();zip[n-2]=1; // EOCD fixed-comment field
  });
  assert_refused(W1ReadIndex::open_p1g_research(
   531,&bad_comment,&KEY,sha256(&bad_comment),decoded_sha,BID,CURSOR_KEY));
  let bad_descriptor=mutate_encrypted_zip(&cipher,KEY,|zip|{
   zip[6]|=8; // local general-purpose bit3, descriptor unsupported
  });
  assert_refused(W1ReadIndex::open_p1g_research(
   531,&bad_descriptor,&KEY,sha256(&bad_descriptor),decoded_sha,BID,CURSOR_KEY));
 }
}
