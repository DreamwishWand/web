//! Synthetic **native** decoded/P1G profiling only; NOT real P1G, Chrome,
//! WASM Worker, production memory or reference-closure proof.
use std::time::Instant;
use ddv_save_core::sha256;
use ddv_save_core::p1g::encode_synthetic_fixture;
use ddv_save_core::trusted_read::{TrustedReadCore,PageQuery};
fn main(){
 let mib=std::env::args().nth(1).and_then(|x|x.parse::<usize>().ok()).unwrap_or(16);
 if ![16,64,100,200].contains(&mib){eprintln!("SYNTHETIC_CLASS_UNSUPPORTED");std::process::exit(2);}
 let target=mib*1024*1024;
 let begin=Instant::now();
 let mut decoded=Vec::with_capacity(target+32768);
 decoded.extend_from_slice(b"{\"GameInfo\":{\"Version\":626},\"World\":{\"GridCollection\":{\"OpaqueBlocks\":[");
 let mut n=0usize;
 let mut v=0x723451u32;
 while decoded.len()+32768<target {
  if n>0{decoded.push(b',');}
  decoded.extend_from_slice(b"{\"UnknownState\":\"");
  for _ in 0..16384 {
   v=v.wrapping_mul(1664525).wrapping_add(1013904223);
   decoded.push(b'A'+((v>>16)%26) as u8);
  }
  decoded.extend_from_slice(b"\"}");
  n+=1;
 }
 decoded.extend_from_slice(b"]},\"RecurringEvents\":[");
 for i in 0..474u32 {
  if i>0{decoded.push(b',');}
  let s=format!("{{\"ItemSpawning\":{{\"RecurringEventItemID\":{},\"NextOccurrence\":\"2126-08-20T00:00:00Z\"}}}}",2010000021+i);
  decoded.extend_from_slice(s.as_bytes());
 }
 decoded.extend_from_slice(b"]}}");
 let build_time=begin.elapsed();
 let source=encode_synthetic_fixture(&decoded,&[9u8;32],8).expect("SYNTHETIC_P1G_BUILD");
 let input_sha=sha256(&source);let json_sha=sha256(&decoded);
 let registry=b"synthetic-registry-profiling-only";
 let t=Instant::now();
 let mut session=TrustedReadCore::open_p1g_readonly(source,&[9u8;32],
  input_sha,json_sha,registry,sha256(registry),
  "9A239D3DB569756D",626,256*1024*1024).expect("SYNTHETIC_READ");
 let open_ms=t.elapsed().as_millis();
 let meta=session.receipt().expect("READ_RECEIPT");
 assert_eq!(meta.indexed_count,474);
 assert!(!meta.complete_all_domains);
 let start=Instant::now();
 let first=session.query_indexed_page(PageQuery{
  session_id:&meta.session_id,revision:0,generation:0,domain:"RecurringEvents",
  sort:"savedIndex",filter:"",limit:200,cursor:None
 }).expect("READ_PAGE");
 assert_eq!(first.rows.len(),200);
 assert!(!first.complete);
 let mut cursor=first.next_cursor;
 let mut count=first.rows.len();
 while let Some(token)=cursor{
  let p=session.query_indexed_page(PageQuery{
    session_id:&meta.session_id,revision:0,generation:0,domain:"RecurringEvents",
    sort:"savedIndex",filter:"",limit:200,cursor:Some(&token)
  }).expect("PAGE_CONTINUATION");
  count+=p.rows.len();
  cursor=p.next_cursor;
  if p.complete{break;}
 }
 assert_eq!(count,474);
 session.original_unchanged().expect("ORIGINAL_IMMUTABLE");
 println!("SYNTHETIC_NATIVE_ONLY class_mib={mib} json_bytes={} fixture_records={} build_ms={} core_open_ms={} query_all_ms={} domain_indexed=RecurringEvents domain_rows={count} complete_all_domains=false writer=false real_p1g_proof=false browser_wasm_worker_proof=false",
  decoded.len(),n,build_time.as_millis(),open_ms,start.elapsed().as_millis());
}
