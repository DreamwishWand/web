//! R04/R05 Stage C: bounded, Core-owned top-level typed readset index.
//! Full JSON grammar + duplicate-key validation is performed by ProductSession
//! BEFORE opening. This scanner records spans only, never serde_json::Value
//! of a 100-200MiB document. No raw JSON/body bytes ever returned in a page.
//! No Native reference closure or Product Worker binding acceptance.
use super::{ProductSession, State, WorkerAction, WorkerEnvelope, PRODUCT_WORKER_CONTRACT};
use crate::{CoreError, CoreResult};
#[cfg(any(test,target_arch="wasm32"))]
use sha2::{Digest,Sha256};

pub const INDEX_PAGE_ENTRIES_MAX:usize=16;
const INDEX_KEY_BYTES_MAX:usize=128;
const INDEX_ROOT_KEY_BYTES_MAX:usize=128;
const INDEX_MAX_ACTIVE_CURSORS:usize=2;
const INDEX_MAX_DEPTH:usize=128;
#[derive(Clone,Copy,Debug,PartialEq,Eq)]
pub enum IndexedDomain {Player,World,Unsupported}
impl IndexedDomain{
    pub const fn path(self)->&'static str {
        match self {Self::Player=>"/Player",Self::World=>"/World",Self::Unsupported=>"<unsupported>"}
    }
}
#[derive(Clone,Copy,Debug,PartialEq,Eq)]
pub enum IndexedKind {Object,Array,String,Number,Boolean,Null}
#[derive(Clone,Debug,PartialEq,Eq)]
pub struct IndexedFieldWitness {
    pub key:String,
    pub kind:IndexedKind,
    pub value_bytes:usize,
}
#[derive(Clone,Copy,Debug,PartialEq,Eq)]
pub struct IndexedCursorReceipt {
    pub cursor:[u8;16],
    pub session_id:[u8;16],
    pub revision:u64,
    pub index_generation:u64,
    pub decoded_sha256:[u8;32],
    pub domain:IndexedDomain,
    pub max_entries_per_page:usize,
    pub complete_all_domains:bool,
    pub product_read_accepted:bool,
    pub writer_authorized:bool,
}
#[derive(Clone,Debug,PartialEq,Eq)]
pub struct IndexedPage {
    pub session_id:[u8;16],
    pub revision:u64,
    pub index_generation:u64,
    pub decoded_sha256:[u8;32],
    pub domain:IndexedDomain,
    pub fields:Vec<IndexedFieldWitness>,
    pub next_cursor:Option<[u8;16]>,
    pub complete_all_domains:bool,
    pub product_read_accepted:bool,
    pub writer_authorized:bool,
}
#[derive(Clone,Copy,Debug)]
pub(super) struct Span {pub(super) begin:usize,pub(super) end:usize}
#[derive(Clone,Copy,Debug)]
pub(super) struct RootIndex {pub(super) player:Span,pub(super) world:Span}
#[derive(Clone,Debug)]
struct CursorGrant{
    token:[u8;16],domain:IndexedDomain,pos:usize,
    revision:u64,generation:u64,
}
pub(super) struct IndexedCache {
    roots:RootIndex,
    grants:Vec<CursorGrant>,
    next_nonce:u64,
}
fn denied(error:&'static str)->CoreError{CoreError(error)}
pub(super) fn skip_ws(bytes:&[u8],mut i:usize)->usize {
    while i<bytes.len()&&matches!(bytes[i],b' '|b'\n'|b'\r'|b'\t'){i+=1;}
    i
}
pub(super) fn string_end(bytes:&[u8],at:usize)->CoreResult<usize>{
    if bytes.get(at)!=Some(&b'"'){return Err(denied("INDEX_JSON_STRING_REQUIRED"));}
    let mut i=at.checked_add(1).ok_or(denied("INDEX_OFFSET_OVERFLOW"))?;
    while i<bytes.len(){
        match bytes[i] {
            b'"'=>return Ok(i+1),
            b'\\'=>{i=i.checked_add(2).ok_or(denied("INDEX_OFFSET_OVERFLOW"))?;},
            _=>i+=1,
        }
    }
    Err(denied("INDEX_STRING_UNTERMINATED"))
}
pub(super) fn value_end(bytes:&[u8],start:usize)->CoreResult<usize>{
    let first=*bytes.get(start).ok_or(denied("INDEX_VALUE_MISSING"))?;
    if first==b'"'{return string_end(bytes,start);}
    if first==b'{'||first==b'['{
        let mut stack=[0_u8;INDEX_MAX_DEPTH];
        let mut depth=0usize;
        let mut i=start;
        while i<bytes.len(){
            match bytes[i] {
                b'"'=>{i=string_end(bytes,i)?;continue;}
                b'{'|b'['=>{
                    if depth==INDEX_MAX_DEPTH{return Err(denied("INDEX_DEPTH_BOUNDS"));}
                    stack[depth]=if bytes[i]==b'{'{b'}'}else{b']'};
                    depth+=1;
                }
                b'}'|b']'=>{
                    if depth==0||bytes[i]!=stack[depth-1]{
                        return Err(denied("INDEX_UNBALANCED_DOCUMENT"));
                    }
                    depth-=1;
                    if depth==0{return Ok(i+1);}
                }
                _=>{}
            }
            i+=1;
        }
        return Err(denied("INDEX_VALUE_UNTERMINATED"));
    }
    let mut end=start;
    while let Some(&b)=bytes.get(end){
        if matches!(b,b','|b'}'|b']'|b' '|b'\n'|b'\r'|b'\t'){break}
        end=end.checked_add(1).ok_or(denied("INDEX_OFFSET_OVERFLOW"))?;
    }
    if end==start{return Err(denied("INDEX_VALUE_MISSING"));}
    Ok(end)
}
fn kind(bytes:&[u8],begin:usize)->CoreResult<IndexedKind>{
    match bytes.get(begin).copied(){
        Some(b'{')=>Ok(IndexedKind::Object),
        Some(b'[')=>Ok(IndexedKind::Array),
        Some(b'"')=>Ok(IndexedKind::String),
        Some(b't'|b'f')=>Ok(IndexedKind::Boolean),
        Some(b'n')=>Ok(IndexedKind::Null),
        Some(b'-'|b'0'..=b'9')=>Ok(IndexedKind::Number),
        _=>Err(denied("INDEX_VALUE_KIND_DENIED")),
    }
}
pub(super) fn roots(bytes:&[u8])->CoreResult<RootIndex>{
    let mut i=skip_ws(bytes,0);
    if bytes.get(i)!=Some(&b'{'){return Err(denied("INDEX_ROOT_OBJECT_REQUIRED"));}
    i+=1;
    let mut player=None;
    let mut world=None;
    loop{
        i=skip_ws(bytes,i);
        if bytes.get(i)==Some(&b'}'){break;}
        let key_start=i;let key_end=string_end(bytes,i)?;
        let key=if key_end-key_start<=INDEX_ROOT_KEY_BYTES_MAX {
            Some(serde_json::from_slice::<String>(&bytes[key_start..key_end])
                .map_err(|_|denied("INDEX_ROOT_KEY_INVALID"))?)
        }else{None};
        i=skip_ws(bytes,key_end);
        if bytes.get(i)!=Some(&b':'){return Err(denied("INDEX_COLON_REQUIRED"));}
        i=skip_ws(bytes,i+1);
        let begin=i;let end=value_end(bytes,begin)?;
        let span=Span{begin,end};
        match key.as_deref(){
            Some("Player")=>{
                if bytes.get(begin)!=Some(&b'{')||player.replace(span).is_some(){
                    return Err(denied("INDEX_PLAYER_ROOT_INVALID"));
                }
            }
            Some("World")=>{
                if bytes.get(begin)!=Some(&b'{')||world.replace(span).is_some(){
                    return Err(denied("INDEX_WORLD_ROOT_INVALID"));
                }
            }
            _=>{}
        }
        i=skip_ws(bytes,end);
        match bytes.get(i){
            Some(b',')=>i+=1,
            Some(b'}')=>break,
            _=>return Err(denied("INDEX_ROOT_NEXT_INVALID")),
        }
    }
    Ok(RootIndex{
        player:player.ok_or(denied("INDEX_PLAYER_MISSING"))?,
        world:world.ok_or(denied("INDEX_WORLD_MISSING"))?,
    })
}
fn domain_span(roots:RootIndex,domain:IndexedDomain)->CoreResult<Span>{
    match domain {
        IndexedDomain::Player=>Ok(roots.player),
        IndexedDomain::World=>Ok(roots.world),
        IndexedDomain::Unsupported=>Err(denied("INDEX_DOMAIN_NOT_ALLOWLISTED")),
    }
}
fn page_fields(bytes:&[u8],span:Span,start:usize)
 ->CoreResult<(Vec<IndexedFieldWitness>,usize,bool)>{
    if start<=span.begin||start>span.end||bytes.get(span.begin)!=Some(&b'{')||
       bytes.get(span.end-1)!=Some(&b'}'){
        return Err(denied("INDEX_SPAN_INVALID"));
    }
    let mut pos=start;
    let mut fields=Vec::with_capacity(INDEX_PAGE_ENTRIES_MAX);
    loop{
        pos=skip_ws(bytes,pos);
        if pos>=span.end{return Err(denied("INDEX_CURSOR_OUT_OF_DOMAIN"));}
        if pos==span.end-1 {return Ok((fields,pos,true));}
        if fields.len()==INDEX_PAGE_ENTRIES_MAX{return Ok((fields,pos,false));}
        let key_start=pos;
        let key_end=string_end(bytes,pos)?;
        if key_end-key_start>INDEX_KEY_BYTES_MAX{
            return Err(denied("INDEX_FIELD_KEY_BOUNDS"));
        }
        let key:String=serde_json::from_slice(&bytes[key_start..key_end])
            .map_err(|_|denied("INDEX_FIELD_KEY_INVALID"))?;
        pos=skip_ws(bytes,key_end);
        if bytes.get(pos)!=Some(&b':'){return Err(denied("INDEX_FIELD_COLON_REQUIRED"));}
        pos=skip_ws(bytes,pos+1);
        let begin=pos;
        let kind=kind(bytes,begin)?;
        let end=value_end(bytes,begin)?;
        if end>span.end-1{return Err(denied("INDEX_FIELD_OVER_DOMAIN"));}
        fields.push(IndexedFieldWitness{key,kind,value_bytes:end-begin});
        pos=skip_ws(bytes,end);
        match bytes.get(pos){
            Some(b',')=>{pos+=1;},
            Some(b'}') if pos==span.end-1=>return Ok((fields,pos,true)),
            _=>return Err(denied("INDEX_FIELD_NEXT_INVALID")),
        }
    }
}
pub(super) fn validate_scope(s:&ProductSession,st:&State,e:&WorkerEnvelope)->CoreResult<()>{
    if st.closed{return Err(denied("SESSION_CLOSED"));}
    if e.contract!=PRODUCT_WORKER_CONTRACT||e.session_id!=st.id||
       e.expected_decoded_sha256!=s.sha{
        return Err(denied("SESSION_SOURCE_SCOPE_MISMATCH"));
    }
    if e.expected_revision!=st.revision||e.expected_index_generation!=st.generation{
        return Err(denied("SESSION_REVISION_GENERATION_CAS"));
    }
    if e.action!=WorkerAction::ReadDomain{
        return Err(denied("INDEX_OPERATION_DENIED"));
    }
    #[cfg(feature="synthetic-stage-b")]
    if st.lab.is_some(){return Err(denied("STAGED_SOURCE_READ_DISABLED"));}
    Ok(())
}
// Deterministic only relative to a secret Rust-owned key derived from Worker
// WebCrypto CSPRNG at open. SessionID and SourceSHA alone cannot mint tokens.
#[cfg(any(test,target_arch="wasm32"))]
fn derive_worker_cursor(key:&[u8;32],source_sha:&[u8;32],nonce:u64)->[u8;16]{
    let mut hash=Sha256::new();
    hash.update(b"wand.product.indexed.worker.cursor.v1");
    hash.update(key);
    hash.update(source_sha);
    hash.update(nonce.to_be_bytes());
    let digest=hash.finalize();
    let mut out=[0_u8;16];out.copy_from_slice(&digest[..16]);out
}
fn mint_cursor(source:&ProductSession,cache:&mut IndexedCache)->CoreResult<[u8;16]>{
    let next=cache.next_nonce.checked_add(1).ok_or(denied("INDEX_NONCE_OVERFLOW"))?;
    #[cfg(not(target_arch="wasm32"))]
    let mut token=[0_u8;16];
    #[cfg(target_arch="wasm32")]
    let token;
    #[cfg(not(target_arch="wasm32"))]
    {
        let _=source;
        getrandom::getrandom(&mut token)
            .map_err(|_|denied("INDEX_CSPRNG_UNAVAILABLE"))?;
    }
    #[cfg(target_arch="wasm32")]
    {
        #[cfg(feature="worker-wasm")]
        {
            if source.worker_cursor_key.iter().all(|b|*b==0) {
                return Err(denied("INDEX_WORKER_ENTROPY_NOT_BOUND"));
            }
            token=derive_worker_cursor(&source.worker_cursor_key,&source.sha,next);
        }
        #[cfg(not(feature="worker-wasm"))]
        {
            let _=source;let _=next;
            return Err(denied("INDEX_WORKER_ENTROPY_NOT_BOUND"));
        }
    }
    if token.iter().all(|b|*b==0){return Err(denied("INDEX_CURSOR_ZERO_DENIED"));}
    cache.next_nonce=next;
    Ok(token)
}
#[cfg(test)]
mod cursor_secret_tests {
    use super::*;
    #[test]
    fn cursor_kdf_separates_nonce_and_source_without_exposing_key() {
        let key=[0x53;32];let source=[0xa2;32];
        let a=derive_worker_cursor(&key,&source,1);
        assert_ne!(a,[0;16]);
        assert_ne!(a,derive_worker_cursor(&key,&source,2));
        assert_ne!(a,derive_worker_cursor(&key,&[0xa3;32],1));
        assert_ne!(a,derive_worker_cursor(&[0x54;32],&source,1));
    }
}
impl ProductSession {
    /// R04/R05 StageC: CORE whitelisted root only, not arbitrary paths/values.
    /// Feature is OFF by default and not bound to the browser Worker.
    pub fn issue_indexed_cursor(&self,scope:WorkerEnvelope,domain:IndexedDomain)
        ->CoreResult<IndexedCursorReceipt>{
        if domain==IndexedDomain::Unsupported{
            return Err(denied("INDEX_DOMAIN_NOT_ALLOWLISTED"));
        }
        let mut st=self.lock()?;
        validate_scope(self,&st,&scope)?;
        if st.indexed.is_none(){
            // Read only borrowed bytes from one immutable ProductSession.
            let index=roots(&self.decoded)?;
            st.indexed=Some(IndexedCache{roots:index,grants:Vec::new(),next_nonce:0});
        }
        let cache=st.indexed.as_mut().ok_or(denied("INDEX_NOT_INITIALIZED"))?;
        if cache.grants.len()>=INDEX_MAX_ACTIVE_CURSORS{
            return Err(denied("INDEX_ACTIVE_CURSOR_LIMIT"));
        }
        let span=domain_span(cache.roots,domain)?;
        let token=mint_cursor(self,cache)?;
        if cache.grants.iter().any(|g|g.token==token){
            return Err(denied("INDEX_TOKEN_COLLISION"));
        }
        cache.grants.push(CursorGrant{
            token,domain,pos:span.begin+1,
            revision:scope.expected_revision,generation:scope.expected_index_generation,
        });
        Ok(IndexedCursorReceipt{
            cursor:token,session_id:scope.session_id,
            revision:scope.expected_revision,index_generation:scope.expected_index_generation,
            decoded_sha256:scope.expected_decoded_sha256,domain,
            max_entries_per_page:INDEX_PAGE_ENTRIES_MAX,
            complete_all_domains:false,product_read_accepted:false,writer_authorized:false,
        })
    }
    /// Returns metadata descriptors only, <=16 keys, never raw value bytes.
    /// Each page consumes its token; follow-up ID is issued by Core, not UI.
    pub fn read_indexed_page(&self,scope:WorkerEnvelope,cursor:[u8;16])
        ->CoreResult<IndexedPage>{
        let mut st=self.lock()?;
        validate_scope(self,&st,&scope)?;
        let cache=st.indexed.as_mut().ok_or(denied("INDEX_NO_ACTIVE_CURSOR"))?;
        let slot=cache.grants.iter().position(|g|g.token==cursor)
            .ok_or(denied("INDEX_CURSOR_UNKNOWN_OR_CONSUMED"))?;
        let grant=cache.grants[slot].clone();
        if grant.revision!=scope.expected_revision||
           grant.generation!=scope.expected_index_generation{
            return Err(denied("INDEX_CURSOR_STALE"));
        }
        let span=domain_span(cache.roots,grant.domain)?;
        let (fields,new_pos,done)=page_fields(&self.decoded,span,grant.pos)?;
        let next_cursor=if done{None}else{Some(mint_cursor(self,cache)?)};
        if let Some(next)=next_cursor{
            if cache.grants.iter().any(|g|g.token==next){
                return Err(denied("INDEX_TOKEN_COLLISION"));
            }
            cache.grants[slot].pos=new_pos;
            cache.grants[slot].token=next;
        }else{
            cache.grants.remove(slot);
        }
        Ok(IndexedPage{
            session_id:st.id,revision:st.revision,index_generation:st.generation,
            decoded_sha256:self.sha,domain:grant.domain,
            fields,next_cursor,complete_all_domains:false,
            product_read_accepted:false,writer_authorized:false,
        })
    }
}
