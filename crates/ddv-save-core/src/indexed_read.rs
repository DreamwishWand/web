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
pub(super) const INDEX_MAX_ACTIVE_CURSORS:usize=2;
const INDEX_MAX_DEPTH:usize=128;
#[derive(Clone,Copy,Debug,PartialEq,Eq)]
pub enum IndexedDomain {Player,World,SavedDiffGrids,Unsupported}
impl IndexedDomain{
    pub const fn path(self)->&'static str {
        match self {Self::Player=>"/Player",Self::World=>"/World",Self::SavedDiffGrids=>"/World/GridCollection/DiffGrids",Self::Unsupported=>"<unsupported>"}
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
pub(super) struct CursorGrant{
    pub(super) token:[u8;16],pub(super) domain:IndexedDomain,pub(super) pos:usize,
    pub(super) revision:u64,pub(super) generation:u64,
}
pub(super) struct IndexedCache {
    pub(super) roots:RootIndex,
    pub(super) grants:Vec<CursorGrant>,
    pub(super) next_nonce:u64,
    // Indexed saved-field spans belong to this SAME Rust ProductSession/Mutex.
    pub(super) saved_diffgrids:Option<Vec<super::saved_diffgrids_index::SavedDiffGridIndexEntry>>,
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
        IndexedDomain::SavedDiffGrids|IndexedDomain::Unsupported=>Err(denied("INDEX_DOMAIN_NOT_ALLOWLISTED")),
    }
}
// One existing indexed object-span scanner. Native-private typed witnesses
// reuse this same bounded lexical path; no whole-document Value reader.
fn indexed_field_at(bytes:&[u8],span:Span,pos:usize)
 ->CoreResult<(IndexedFieldWitness,Span,usize,bool)>{
    if span.begin>=span.end||span.end>bytes.len()||pos<=span.begin||
       pos>=span.end-1||bytes.get(span.begin)!=Some(&b'{')||
       bytes.get(span.end-1)!=Some(&b'}'){
        return Err(denied("INDEX_SPAN_INVALID"));
    }
    let key_start=skip_ws(bytes,pos);
    let key_end=string_end(bytes,key_start)?;
    if key_end-key_start>INDEX_KEY_BYTES_MAX{
        return Err(denied("INDEX_FIELD_KEY_BOUNDS"));
    }
    let key:String=serde_json::from_slice(&bytes[key_start..key_end])
        .map_err(|_|denied("INDEX_FIELD_KEY_INVALID"))?;
    let colon=skip_ws(bytes,key_end);
    if bytes.get(colon)!=Some(&b':'){return Err(denied("INDEX_FIELD_COLON_REQUIRED"));}
    let begin=skip_ws(bytes,colon+1);
    let kind=kind(bytes,begin)?;
    let end=value_end(bytes,begin)?;
    if end>span.end-1{return Err(denied("INDEX_FIELD_OVER_DOMAIN"));}
    let next=skip_ws(bytes,end);
    let (pos,done)=match bytes.get(next){
        Some(b',') if next<span.end-1=>(next+1,false),
        Some(b'}') if next==span.end-1=>(next,true),
        _=>return Err(denied("INDEX_FIELD_NEXT_INVALID")),
    };
    Ok((IndexedFieldWitness{key,kind,value_bytes:end-begin},Span{begin,end},pos,done))
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
        if pos==span.end-1{return Ok((fields,pos,true));}
        if fields.len()==INDEX_PAGE_ENTRIES_MAX{return Ok((fields,pos,false));}
        let (field,_,next,done)=indexed_field_at(bytes,span,pos)?;
        fields.push(field);
        pos=next;
        if done{return Ok((fields,pos,true));}
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
    #[cfg(feature="semantic-writer-dev")]
    if st.semantic.is_some(){return Err(denied("SEMANTIC_STAGED_READ_SET_INVALIDATED"));}
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
pub(super) fn mint_cursor(source:&ProductSession,cache:&mut IndexedCache)->CoreResult<[u8;16]>{
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
        if matches!(domain,IndexedDomain::Unsupported|IndexedDomain::SavedDiffGrids){
            return Err(denied("INDEX_DOMAIN_NOT_ALLOWLISTED"));
        }
        let mut st=self.lock()?;
        validate_scope(self,&st,&scope)?;
        if st.indexed.is_none(){
            // Read only borrowed bytes from one immutable ProductSession.
            let index=roots(&self.decoded)?;
            st.indexed=Some(IndexedCache{roots:index,grants:Vec::new(),next_nonce:0,saved_diffgrids:None});
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
        if grant.domain==IndexedDomain::SavedDiffGrids{
            return Err(denied("INDEX_TYPED_DIFFGRIDS_CURSOR_REQUIRED"));
        }
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


// 01A R08, E1225/E1233: Native-private active Avatar structural receipt.
// Excluded from public WASM; no mutation, second SaveSession or authority.
#[cfg(all(feature="private-native-v1",not(target_arch="wasm32")))]
mod private_avatar {
    use super::*;
    use super::super::{Platform,BuildKind};
    use sha2::{Digest,Sha256};
    use serde_json::{json,Value};
    const EXACT:&str="releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22";
    const MAX_AVATAR_FIELDS:usize=64;
    const MAX_CUSTOMIZATIONS:usize=256;
    const MAX_MAKEUP:usize=32; // bounded structural scan, not Native allowed set
    const MAX_AVATAR_BYTES:usize=1024*1024;
    fn sha(b:&[u8])->String{Sha256::digest(b).iter().map(|x|format!("{x:02x}")).collect()}
    fn hex(b:&[u8])->String{b.iter().map(|x|format!("{x:02x}")).collect()}
    fn members(bytes:&[u8],span:Span,max:usize)->CoreResult<Vec<(String,Span)>>{
        if span.end>bytes.len()||span.begin>=span.end||
            bytes.get(span.begin)!=Some(&b'{')||bytes.get(span.end-1)!=Some(&b'}'){
            return Err(denied("AVATAR_OBJECT_REQUIRED"));
        }
        let mut pos=skip_ws(bytes,span.begin+1);
        let mut out=Vec::new();
        while pos<span.end-1{
            if out.len()>=max{return Err(denied("AVATAR_MEMBER_BOUND"));}
            let (f,v,n,done)=indexed_field_at(bytes,span,pos)?;
            out.push((f.key,v));
            pos=skip_ws(bytes,n);
            if done{break}
        }
        if pos!=span.end-1{return Err(denied("AVATAR_OBJECT_SPAN"));}
        Ok(out)
    }
    fn field(fields:&[(String,Span)],name:&str)->Option<Span>{
        fields.iter().find(|(k,_)|k==name).map(|(_,v)|*v)
    }
    fn required(fields:&[(String,Span)],name:&str)->CoreResult<Span>{
        field(fields,name).ok_or(denied("AVATAR_REQUIRED_FIELD_ABSENT"))
    }
    fn int(bytes:&[u8],span:Span)->CoreResult<i32>{
        let token=bytes.get(span.begin..span.end).ok_or(denied("AVATAR_INT_SPAN"))?;
        if token.is_empty()||token.len()>11{return Err(denied("AVATAR_INT32_REQUIRED"));}
        let v=serde_json::from_slice::<i32>(token).map_err(|_|denied("AVATAR_INT32_REQUIRED"))?;
        // Native int32 decimal tokens only, no exponents, float or strings.
        if token!=v.to_string().as_bytes(){return Err(denied("AVATAR_INT32_CANONICAL"));}
        Ok(v)
    }
    fn key_u32(k:&str)->CoreResult<u32>{
        let v=k.parse::<u32>().map_err(|_|denied("AVATAR_MAP_KEY"))?;
        if v.to_string()!=k{return Err(denied("AVATAR_MAP_KEY"));}
        Ok(v)
    }
    fn optional_int(bytes:&[u8],fields:&[(String,Span)],name:&str)->CoreResult<Option<i32>>{
        field(fields,name).map(|s|int(bytes,s)).transpose()
    }
    fn palette(v:Option<i32>)->bool{v.map(|n|(0..90).contains(&n)).unwrap_or(false)}
    #[derive(Clone,Debug)]
    struct RefEntry{key:u32,value:i32,entry_sha:String}
    #[derive(Clone,Debug)]
    struct RefMap{present:bool,sha:Option<String>,entries:Vec<RefEntry>}
    fn refs(bytes:&[u8],span:Option<Span>,mode:&str)->CoreResult<RefMap>{
        let Some(s)=span else{return Ok(RefMap{present:false,sha:None,entries:Vec::new()})};
        let max=match mode{"Clothes"|"IncompatibleClothes"=>18,"Makeup"=>MAX_MAKEUP,
            "ClothingCustomization"=>MAX_CUSTOMIZATIONS,_=>return Err(denied("AVATAR_REF_MODE"))};
        let mut entries=Vec::new();
        for (k,v) in members(bytes,s,max)?{
            let key=key_u32(&k)?;
            let value=match mode{
                "Clothes"|"IncompatibleClothes"=>{
                    if key>17{return Err(denied("AVATAR_CLOTHING_SLOT"));}
                    let n=int(bytes,v)?;
                    // Explicit zero is retained as a saved scalar, not an
                    // inferred unequipped/default or authorized item.
                    if n<0||(n!=0&&n/10_000_000!=5){return Err(denied("AVATAR_CLOTHING_ID_PREFIX"));}
                    n
                },
                "Makeup"=>{
                    if key>=32{return Err(denied("AVATAR_MAKEUP_SLOT_BOUND"));}
                    let obj=members(bytes,v,32)?;
                    // Only a physically present exact member is read. No
                    // alias/default or claim of actual Steam save presence.
                    let n=int(bytes,required(&obj,"MakeupItemID")?)?;
                    if n<=0||n/10_000_000!=14{return Err(denied("AVATAR_MAKEUP_ID_PREFIX"));}
                    n
                },
                "ClothingCustomization"=>{
                    if key==0||key>i32::MAX as u32||key/10_000_000!=5{
                        return Err(denied("AVATAR_CUSTOMIZATION_ITEM_KEY"));}
                    // Native map<int32,int32>: retain exact saved design scalar,
                    // including zero/negative, never assume design ownership.
                    int(bytes,v)?
                },
                _=>return Err(denied("AVATAR_REF_MODE")),
            };
            entries.push(RefEntry{key,value,entry_sha:sha(&bytes[v.begin..v.end])});
        }
        Ok(RefMap{present:true,sha:Some(sha(&bytes[s.begin..s.end])),entries})
    }
    fn map_json(m:&RefMap)->Value{
        json!({"present":m.present,"mapSha256":m.sha,
            "entries":m.entries.iter().map(|r|json!({"key":r.key,"savedValue":r.value,"entrySha256":r.entry_sha})).collect::<Vec<_>>()})
    }
    #[derive(Clone,Debug)]
    struct Branch {
        sha:String,hair:Option<i32>,highlight:Option<i32>,
        clothes:RefMap,incompatible:RefMap,makeup:RefMap,customization:RefMap,
    }
    fn branch(bytes:&[u8],span:Span)->CoreResult<Branch>{
        if span.end-span.begin>MAX_AVATAR_BYTES{return Err(denied("AVATAR_BRANCH_BYTE_BOUND"));}
        let f=members(bytes,span,MAX_AVATAR_FIELDS)?;
        Ok(Branch{sha:sha(&bytes[span.begin..span.end]),
            hair:optional_int(bytes,&f,"HairColorIndex")?,
            highlight:optional_int(bytes,&f,"HairHighlightColor")?,
            clothes:refs(bytes,field(&f,"Clothes"),"Clothes")?,
            incompatible:refs(bytes,field(&f,"IncompatibleClothes"),"IncompatibleClothes")?,
            makeup:refs(bytes,field(&f,"Makeup"),"Makeup")?,
            customization:refs(bytes,field(&f,"ClothingCustomization"),"ClothingCustomization")?,
        })
    }
    fn branch_json(b:&Branch)->Value{
        json!({"branchSha256":b.sha,
            "hairColorIndex":b.hair,"hairColorIndexPresent":b.hair.is_some(),
            "hairHighlightColorIndex":b.highlight,"hairHighlightColorPresent":b.highlight.is_some(),
            "hairHighlightSavedField":"HairHighlightColor",
            "bothPackagedHairIndicesCandidate":palette(b.hair)&&palette(b.highlight),
            "clothes":map_json(&b.clothes),"incompatibleClothes":map_json(&b.incompatible),
            "makeup":map_json(&b.makeup),"clothingCustomization":map_json(&b.customization),
            "allFourReferenceMapsPresent":b.clothes.present&&b.incompatible.present&&b.makeup.present&&b.customization.present,
            "nativeReferenceClosureVerified":false,"rightsVerified":false})
    }
    /// Opaque native receipt; no Serialize/Deserialize for private source data.
    /// JSON is emitted only by the local explicit receipt executor.
    pub struct PrivateActiveAvatarReceipt{
        scope:WorkerEnvelope,is_male:bool,female:Branch,male:Branch,
    }
    impl PrivateActiveAvatarReceipt{
        pub fn to_private_receipt_json(&self)->Value{
            let active=if self.is_male{&self.male}else{&self.female};
            json!({"contract":"wand.native.private.active-avatar-read@1",
                "platform":"SteamWindows","fullVersion":EXACT,"schema":626,
                "sessionId":hex(&self.scope.session_id),"revision":self.scope.expected_revision,
                "indexGeneration":self.scope.expected_index_generation,
                "decodedSha256":hex(&self.scope.expected_decoded_sha256),
                "avatarIsMale":self.is_male,"activeBranch":if self.is_male{"MaleAvatar"}else{"FemaleAvatar"},
                "activeHairFieldsPresent":active.hair.is_some()&&active.highlight.is_some(),
                "activeBothPackagedHairIndicesCandidate":palette(active.hair)&&palette(active.highlight),
                "femaleAvatar":branch_json(&self.female),"maleAvatar":branch_json(&self.male),
                "fullDocumentRustValidated":true,"physicalGameInstallCryptographicallyProven":false,
                "actualAllowedPaletteVerified":false,"rightsVerified":false,
                "nativeReferenceClosureVerified":false,"cleanupClosureVerified":false,
                "productReadAccepted":false,"writerAuthorized":false,"editedCopyAuthorized":false,
                "applyAuthorized":false,"nativeV3Verified":false})
        }
    }
    impl ProductSession{
        pub fn read_private_active_avatar(&self,e:WorkerEnvelope)->CoreResult<PrivateActiveAvatarReceipt>{
            let b=&self.native_source_build;
            if b.platform!=Platform::SteamWindows||b.build_kind!=BuildKind::SteamFullVersion||
               b.build_id!=EXACT||b.schema!=626||!b.externally_attested{
                return Err(denied("AVATAR_EXACT_STEAM626_REQUIRED"));
            }
            let st=self.lock()?;validate_scope(self,&st,&e)?;
            let bytes=&self.decoded;
            let root=roots(bytes)?.player;
            // Player root itself can be large; use only the existing indexed
            // span walker and collect the three selected fields, not raw data.
            let mut pos=skip_ws(bytes,root.begin+1);
            let mut selected=Vec::with_capacity(3);
            let mut count=0usize;
            while pos<root.end-1{
                count+=1;if count>1024{return Err(denied("AVATAR_PLAYER_FIELD_BOUND"));}
                let (f,v,next,done)=indexed_field_at(bytes,root,pos)?;
                if matches!(f.key.as_str(),"AvatarIsMale"|"FemaleAvatar"|"MaleAvatar"){
                    selected.push((f.key,v));
                }
                pos=skip_ws(bytes,next);if done{break}
            }
            avatar_snapshot(bytes,&selected,e)
        }
    }

    fn avatar_snapshot(bytes:&[u8],fields:&[(String,Span)],e:WorkerEnvelope)
        ->CoreResult<PrivateActiveAvatarReceipt>{
        let gender=required(fields,"AvatarIsMale")?;
        let is_male=match &bytes[gender.begin..gender.end]{
            b"true"=>true,b"false"=>false,_=>return Err(denied("AVATAR_GENDER_BOOL_REQUIRED")),
        };
        Ok(PrivateActiveAvatarReceipt{scope:e,is_male,
            female:branch(bytes,required(fields,"FemaleAvatar")?)?,
            male:branch(bytes,required(fields,"MaleAvatar")?)?})
    }
    // ACT357: private, bounded dependency evidence for one existing Avatar
    // hair candidate. Same native ProductSession and lexical spans; no
    // caller paths, general JSON reader, condition evaluator or authority.
    pub struct PrivateAvatarDependencyReceipt{value:Value}
    impl PrivateAvatarDependencyReceipt{
        pub fn to_private_receipt_json(&self)->Value{self.value.clone()}
    }
    fn dependency_hash(bytes:&[u8],s:Option<Span>)->Value{
        json!({"present":s.is_some(),"sha256":s.map(|v|sha(&bytes[v.begin..v.end]))})
    }
    fn array_spans(bytes:&[u8],s:Span,max:usize)->CoreResult<Vec<Span>>{
        if s.begin>=s.end||s.end>bytes.len()||bytes.get(s.begin)!=Some(&b'[')||
            bytes.get(s.end-1)!=Some(&b']'){return Err(denied("AVATAR_DEP_ARRAY_REQUIRED"));}
        let mut pos=skip_ws(bytes,s.begin+1);let mut out=Vec::new();
        while pos<s.end-1{
            if out.len()>=max{return Err(denied("AVATAR_DEP_ARRAY_BOUND"));}
            let end=value_end(bytes,pos)?;
            if end>=s.end||end-pos>1024*1024{return Err(denied("AVATAR_DEP_RECORD_BOUND"));}
            out.push(Span{begin:pos,end});
            pos=skip_ws(bytes,end);
            match bytes.get(pos){
                Some(b',') if pos<s.end-1=>pos=skip_ws(bytes,pos+1),
                Some(b']') if pos==s.end-1=>break,
                _=>return Err(denied("AVATAR_DEP_ARRAY_TERMINATOR")),
            }
        }
        Ok(out)
    }
    fn scalar_witness(bytes:&[u8],fs:&[(String,Span)],key:&str)->CoreResult<Value>{
        let v=field(fs,key);
        Ok(json!({"present":v.is_some(),"value":v.map(|s|int(bytes,s)).transpose()?,
            "sha256":v.map(|s|sha(&bytes[s.begin..s.end]))}))
    }
    fn token_witness(bytes:&[u8],fs:&[(String,Span)],key:&str)->CoreResult<Value>{
        let v=field(fs,key);
        Ok(json!({"present":v.is_some(),"value":v.map(|s|text_token(bytes,s,128)).transpose()?,
            "sha256":v.map(|s|sha(&bytes[s.begin..s.end]))}))
    }
    fn enum_token(bytes:&[u8],s:Span,prefix:&str)->CoreResult<String>{
        let v=text_token(bytes,s,128)?;
        if !v.starts_with(prefix)||v.len()<=prefix.len()||
           !v.bytes().all(|b|b.is_ascii_alphanumeric()||b==b'_'){
            return Err(denied("AVATAR_DEP_ENUM_TOKEN"));}
        Ok(v)
    }
    fn branch_dependencies(bytes:&[u8],s:Span)->CoreResult<Value>{
        let fs=members(bytes,s,MAX_AVATAR_FIELDS)?;
        let mut scalars=serde_json::Map::new();
        for key in ["Id","SkinColorIndex","HairColorIndex","HairHighlightColor","BodyType","SprintEffectID"]{
            scalars.insert(key.into(),scalar_witness(bytes,&fs,key)?);
        }
        let mut makeup=Vec::new();
        if let Some(m)=field(&fs,"Makeup"){
            for (key,entry) in members(bytes,m,MAX_MAKEUP)?{
                let slot=key_u32(&key)?;if slot>=32{return Err(denied("AVATAR_MAKEUP_SLOT_BOUND"));}
                let f=members(bytes,entry,32)?;
                let item=int(bytes,required(&f,"MakeupItemID")?)?;
                if item<=0||item/10_000_000!=14{return Err(denied("AVATAR_MAKEUP_ID_PREFIX"));}
                let mut colors=serde_json::Map::new();
                for k in ["ColorIndex1","ColorIndex2","ColorIndex3"]{
                    colors.insert(k.into(),scalar_witness(bytes,&f,k)?);
                }
                // Physical numeric token, bounded and finite. No float
                // reconstruction or assumption about Native accepted range.
                for k in ["Opacity","Gloss"]{
                    let span=field(&f,k);
                    let raw=span.map(|v|{
                        let b=&bytes[v.begin..v.end];
                        if b.len()>64{return Err(denied("AVATAR_DEP_NUMBER_BOUND"));}
                        let n=serde_json::from_slice::<f64>(b).map_err(|_|denied("AVATAR_DEP_NUMBER_REQUIRED"))?;
                        if !n.is_finite(){return Err(denied("AVATAR_DEP_NUMBER_REQUIRED"));}
                        std::str::from_utf8(b).map(str::to_owned).map_err(|_|denied("AVATAR_DEP_NUMBER_REQUIRED"))
                    }).transpose()?;
                    colors.insert(k.into(),json!({"present":span.is_some(),"numericToken":raw,
                        "sha256":span.map(|v|sha(&bytes[v.begin..v.end]))}));
                }
                makeup.push(json!({"slot":slot,"itemId":item,"entrySha256":sha(&bytes[entry.begin..entry.end]),"scalars":colors}));
            }
        }
        let mut face=Vec::new();
        if let Some(v)=field(&fs,"FaceType"){
            for (key,entry) in members(bytes,v,32)?{
                let n=key_u32(&key)?;
                face.push(json!({"key":n,"savedValue":int(bytes,entry)?,"sha256":sha(&bytes[entry.begin..entry.end])}));
            }
        }
        let mut eye=serde_json::Map::new();
        if let Some(v)=field(&fs,"Eyeball"){
            // Explicit null stays distinct from a present object. No default
            // or invented color/item ID when the object is missing/null.
            if &bytes[v.begin..v.end]!=b"null"{
                let f=members(bytes,v,32)?;
                for k in ["EyeballItemID","ColorIndex1","ColorIndex2","ColorIndex3"]{
                    eye.insert(k.into(),scalar_witness(bytes,&f,k)?);
                }
            }
        }
        Ok(json!({"branchSha256":sha(&bytes[s.begin..s.end]),"scalars":scalars,
            "faceType":dependency_hash(bytes,field(&fs,"FaceType")),"faceTypeEntries":face,
            "eyeball":dependency_hash(bytes,field(&fs,"Eyeball")),"eyeballScalars":eye,
            "makeup":makeup,"otherFieldsRetainedByBranchHash":true}))
    }
    fn inventory_dependencies(bytes:&[u8],lists:Span,avatar:&PrivateActiveAvatarReceipt)->CoreResult<Value>{
        use std::collections::BTreeSet;
        let mut clothes=BTreeSet::new();let mut makeup=BTreeSet::new();
        for b in [&avatar.female,&avatar.male]{
            for m in [&b.clothes,&b.incompatible]{
                for e in &m.entries{if e.value>0{clothes.insert(e.value);}}
            }
            for e in &b.customization.entries{clothes.insert(e.key as i32);}
            for e in &b.makeup.entries{makeup.insert(e.value);}
        }
        let mut selected=[None,None];
        for (key,rec) in members(bytes,lists,128)?{
            let id=key_u32(&key)?;
            let f=members(bytes,rec,64)?;
            let id_span=required(&f,"ID")?;let id_token=&bytes[id_span.begin..id_span.end];
            let saved=serde_json::from_slice::<u32>(id_token)
                .map_err(|_|denied("AVATAR_DEP_INVENTORY_ID"))?;
            if id!=saved||id_token!=saved.to_string().as_bytes(){return Err(denied("AVATAR_DEP_INVENTORY_ID"));}
            let ty=text_token(bytes,required(&f,"CompatibleItemType")?,128)?;
            if id==1||ty=="ItemType_Clothing"{
                if id!=1||ty!="ItemType_Clothing"||selected[0].replace((rec,required(&f,"Inventory")?)).is_some(){
                    return Err(denied("AVATAR_DEP_CLOTHING_ROUTE"));}
            }
            if id==3||ty=="ItemType_Makeup"{
                if id!=3||ty!="ItemType_Makeup"||selected[1].replace((rec,required(&f,"Inventory")?)).is_some(){
                    return Err(denied("AVATAR_DEP_MAKEUP_ROUTE"));}
            }
        }
        let reference_count=clothes.len()+makeup.len();
        let all_maps_present=[&avatar.female,&avatar.male].iter().all(|b|
            b.clothes.present&&b.incompatible.present&&b.makeup.present&&b.customization.present);
        let mut all_positive=true;let mut routes=Vec::new();
        for (i,wanted) in [clothes,makeup].into_iter().enumerate(){
            let (rec,items)=selected[i].ok_or(denied("AVATAR_DEP_REQUIRED_ROUTE_ABSENT"))?;
            let (id,major,ty)=if i==0{(1,5,"ItemType_Clothing")}else{(3,14,"ItemType_Makeup")};
            let mut found=std::collections::BTreeMap::new();
            for (k,v) in members(bytes,items,16384)?{
                let n=key_u32(&k)?;
                if n==0||n>i32::MAX as u32||n/10_000_000!=major{
                    return Err(denied("AVATAR_DEP_INVENTORY_ITEM_KEY"));}
                if wanted.contains(&(n as i32)){found.insert(n as i32,v);}
            }
            let mut entries=Vec::new();
            for n in wanted{
                let span=found.get(&n).copied();
                let mut amount=None;let mut marker=None;let mut marker_sha=None;
                if let Some(v)=span{
                    let f=members(bytes,v,64)?;
                    amount=Some(int(bytes,required(&f,"Amount")?)?);
                    if let Some(m)=field(&f,"Marker"){
                        marker=Some(enum_token(bytes,m,"ItemMarker_")?);
                        marker_sha=Some(sha(&bytes[m.begin..m.end]));
                    }
                }
                let positive=amount.is_some_and(|a|a>0);
                all_positive&=positive;
                entries.push(json!({"itemId":n,"present":span.is_some(),"savedAmount":amount,
                    "entrySha256":span.map(|v|sha(&bytes[v.begin..v.end])),
                    "markerPresent":marker.is_some(),"savedMarker":marker,"markerSha256":marker_sha,
                    "positiveSavedAmount":positive,"nativeHasItemVerified":false,"rightsVerified":false}));
            }
            routes.push(json!({"inventoryId":id,"compatibleItemType":ty,
                "recordSha256":sha(&bytes[rec.begin..rec.end]),"mapSha256":sha(&bytes[items.begin..items.end]),
                "entries":entries}));
        }
        Ok(json!({"listInventoriesSha256":sha(&bytes[lists.begin..lists.end]),"routes":routes,
            "observedUniqueReferenceCount":reference_count,"allFourMapsPerBranchPresent":all_maps_present,
            "allObservedReferencesHavePositiveSavedAmount":all_positive,
            "nativeExtractClothesAndMakeupVerified":false,"adequateDressVerified":false,
            "variationVerified":false,"rightsVerified":false}))
    }
    fn achievements_dependencies(bytes:&[u8],s:Option<Span>)->CoreResult<Value>{
        let Some(span)=s else{return Ok(json!({"present":false,"sha256":null,"entries":[],"completeNativeClosureVerified":false}))};
        let mut seen=std::collections::BTreeSet::new();let mut out=Vec::new();
        for v in array_spans(bytes,span,4096)?{
            let f=members(bytes,v,64)?;
            let id=int(bytes,required(&f,"AchievementID")?)?;
            if id<=0||id/10_000_000!=211||!seen.insert(id){return Err(denied("AVATAR_DEP_ACHIEVEMENT_ID"));}
            let state=field(&f,"State").map(|x|enum_token(bytes,x,"AchievementState_")).transpose()?;
            out.push(json!({"achievementId":id,"recordSha256":sha(&bytes[v.begin..v.end]),
                "state":state,"statePresent":state.is_some(),
                "curAmount":scalar_witness(bytes,&f,"CurAmount")?,
                "maxAmount":scalar_witness(bytes,&f,"MaxAmount")?,
                "claimedRewardMilestone":scalar_witness(bytes,&f,"ClaimedRewardMilestone")?,
                "typesCollected":dependency_hash(bytes,field(&f,"TypesCollected")),
                "itemsUsed":dependency_hash(bytes,field(&f,"ItemsUsed"))}));
        }
        Ok(json!({"present":true,"sha256":sha(&bytes[span.begin..span.end]),"entries":out,
            "completeNativeClosureVerified":false}))
    }
    #[derive(Default)]
    struct DependencyBudget{nodes:usize,progress_entries:usize,progress_bytes:usize}
    impl DependencyBudget{
        fn node(&mut self)->CoreResult<()>{
            self.nodes+=1;
            if self.nodes>8192{return Err(denied("AVATAR_DEP_SUBSCRIBER_NODE_BOUND"));}
            Ok(())
        }
        fn progress(&mut self,key:&str,value_bytes:usize)->CoreResult<()>{
            self.progress_entries+=1;
            self.progress_bytes=self.progress_bytes.checked_add(key.len()+value_bytes)
                .ok_or(denied("AVATAR_DEP_PROGRESS_BOUND"))?;
            if self.progress_entries>4096||self.progress_bytes>2*1024*1024{
                return Err(denied("AVATAR_DEP_PROGRESS_BOUND"));}
            Ok(())
        }
    }
    fn objective_dependencies(bytes:&[u8],v:Span,budget:&mut DependencyBudget)->CoreResult<Value>{
        budget.node()?;
        let f=members(bytes,v,128)?;
        let mut progress=Vec::new();
        if let Some(s)=field(&f,"ProgressKeys"){
            for (key,val) in members(bytes,s,64)?{
                // Exact persisted scalar string, bounded; no caller paths,
                // no interpretation or defaulting of the Native progress key.
                if key.len()>128{return Err(denied("AVATAR_DEP_PROGRESS_KEY_BOUND"));}
                budget.progress(&key,val.end-val.begin)?;
                progress.push(json!({"key":key,"savedValue":text_token(bytes,val,512)?,
                    "sha256":sha(&bytes[val.begin..val.end])}));
            }
        }
        Ok(json!({"recordSha256":sha(&bytes[v.begin..v.end]),
            "targetAmount":scalar_witness(bytes,&f,"TargetAmount")?,
            "curAmount":scalar_witness(bytes,&f,"CurAmount")?,
            "status":token_witness(bytes,&f,"Status")?,
            "stepType":token_witness(bytes,&f,"StepType")?,
            "progressKeys":dependency_hash(bytes,field(&f,"ProgressKeys")),"progressEntries":progress,
            "itemIdsCollected":dependency_hash(bytes,field(&f,"ItemIdsCollected")),
            "gridObjectIdsCollected":dependency_hash(bytes,field(&f,"GridObjectIdsCollected")),
            "itemFilter":dependency_hash(bytes,field(&f,"ItemFilter"))}))
    }
    fn mission_dependencies(bytes:&[u8],s:Option<Span>,budget:&mut DependencyBudget)->CoreResult<Value>{
        let Some(span)=s else{return Ok(json!({"present":false,"sha256":null,"groups":[],"completeNativeClosureVerified":false}))};
        let mut groups=Vec::new();let mut total_slots=0usize;let mut total_objectives=0usize;
        for (key,g) in members(bytes,span,128)?{
            let group=key_u32(&key)?;let fs=members(bytes,g,64)?;
            let a=required(&fs,"Slots")?;let mut slots=Vec::new();let mut ids=std::collections::BTreeSet::new();
            for v in array_spans(bytes,a,512)?{
                budget.node()?;
                total_slots+=1;if total_slots>1024{return Err(denied("AVATAR_DEP_MISSION_SLOT_BOUND"));}
                let f=members(bytes,v,128)?;
                let slot=int(bytes,required(&f,"SlotId")?)?;
                let mission=int(bytes,required(&f,"MissionId")?)?;
                if slot<0||!ids.insert(slot)||mission<0||(mission>0&&mission/10_000_000!=207){
                    return Err(denied("AVATAR_DEP_MISSION_ID"));}
                let state=field(&f,"State").map(|s|enum_token(bytes,s,"MissionSlotState_")).transpose()?;
                let current=optional_int(bytes,&f,"CurrentStepIndex")?;
                let mut steps=Vec::new();
                if let Some(a)=field(&f,"MissionSteps"){
                    for (si,step) in array_spans(bytes,a,256)?.into_iter().enumerate(){
                        budget.node()?;
                        let sf=members(bytes,step,64)?;let mut substeps=Vec::new();
                        if let Some(ss)=field(&sf,"SubSteps"){
                            for (ui,sub) in array_spans(bytes,ss,256)?.into_iter().enumerate(){
                                budget.node()?;
                                let uf=members(bytes,sub,64)?;let mut objectives=Vec::new();
                                if let Some(o)=field(&uf,"Objectives"){
                                    for (oi,obj) in array_spans(bytes,o,256)?.into_iter().enumerate(){
                                        total_objectives+=1;
                                        if total_objectives>4096{return Err(denied("AVATAR_DEP_OBJECTIVE_BOUND"));}
                                        objectives.push(json!({"physicalIndex":oi,"witness":objective_dependencies(bytes,obj,budget)?}));
                                    }
                                }
                                substeps.push(json!({"physicalIndex":ui,"recordSha256":sha(&bytes[sub.begin..sub.end]),
                                    "objectivesPresent":field(&uf,"Objectives").is_some(),"objectives":objectives}));
                            }
                        }
                        steps.push(json!({"physicalIndex":si,"recordSha256":sha(&bytes[step.begin..step.end]),
                            "subStepsPresent":field(&sf,"SubSteps").is_some(),"subSteps":substeps}));
                    }
                }
                slots.push(json!({"slotId":slot,"missionId":mission,"recordSha256":sha(&bytes[v.begin..v.end]),
                    "state":state,"statePresent":state.is_some(),"currentStepIndex":current,
                    "currentStepIndexPresent":current.is_some(),
                    "characterId":scalar_witness(bytes,&f,"CharacterId")?,
                    "missionSteps":dependency_hash(bytes,field(&f,"MissionSteps")),"steps":steps}));
            }
            groups.push(json!({"groupKey":group,"recordSha256":sha(&bytes[g.begin..g.end]),"slots":slots}));
        }
        Ok(json!({"present":true,"sha256":sha(&bytes[span.begin..span.end]),"groups":groups,
            "completeNativeClosureVerified":false}))
    }
    fn evolve_dependencies(bytes:&[u8],s:Option<Span>,budget:&mut DependencyBudget)->CoreResult<Value>{
        let Some(span)=s else{return Ok(json!({"present":false,"sha256":null,"entries":[],"completeNativeClosureVerified":false}))};
        let fs=members(bytes,span,64)?;
        let map=field(&fs,"EvolveProgressState");
        let mut out=Vec::new();
        if let Some(a)=map{
            for (k,v) in members(bytes,a,4096)?{
                budget.node()?;
                let id=key_u32(&k)?;
                let f=members(bytes,v,64)?;
                if id==0||id>i32::MAX as u32||int(bytes,required(&f,"ItemID")?)?!=id as i32{
                    return Err(denied("AVATAR_DEP_EVOLVE_ID"));}
                let o=field(&f,"Objective").map(|x|objective_dependencies(bytes,x,budget)).transpose()?;
                out.push(json!({"itemId":id,"recordSha256":sha(&bytes[v.begin..v.end]),
                    "level":scalar_witness(bytes,&f,"Level")?,"objectivePresent":o.is_some(),"objective":o}));
            }
        }
        Ok(json!({"present":true,"sha256":sha(&bytes[span.begin..span.end]),
            "map":dependency_hash(bytes,map),"entries":out,"completeNativeClosureVerified":false}))
    }
    impl ProductSession{
        pub fn read_private_avatar_dependencies(&self,e:WorkerEnvelope)->CoreResult<PrivateAvatarDependencyReceipt>{
            let b=&self.native_source_build;
            if b.platform!=Platform::SteamWindows||b.build_kind!=BuildKind::SteamFullVersion||
               b.build_id!=EXACT||b.schema!=626||!b.externally_attested{
                return Err(denied("AVATAR_EXACT_STEAM626_REQUIRED"));}
            let st=self.lock()?;validate_scope(self,&st,&e)?;
            let bytes=&self.decoded;let root=roots(bytes)?;
            let player=members(bytes,root.player,1024)?;let world=members(bytes,root.world,1024)?;
            let avatar=avatar_snapshot(bytes,&player,e)?;
            let ownership=inventory_dependencies(bytes,required(&player,"ListInventories")?,&avatar)?;
            let mut budget=DependencyBudget::default();
            let missions=mission_dependencies(bytes,field(&world,"MissionSlots"),&mut budget)?;
            let evolve=evolve_dependencies(bytes,field(&player,"EvolveStatesProfile"),&mut budget)?;
            let value=json!({"contract":"wand.native.private.avatar-dependencies@1","avatar":avatar.to_private_receipt_json(),
                "femaleDependencies":branch_dependencies(bytes,required(&player,"FemaleAvatar")?)?,
                "maleDependencies":branch_dependencies(bytes,required(&player,"MaleAvatar")?)?,
                "ownership":ownership,"subscriberReadSet":{
                    "playerSha256":sha(&bytes[root.player.begin..root.player.end]),
                    "worldSha256":sha(&bytes[root.world.begin..root.world.end]),
                    "achievementsData":achievements_dependencies(bytes,field(&player,"AchievementsData"))?,
                    "missionSlots":missions,
                    "questInfo":dependency_hash(bytes,field(&world,"QuestInfo")),
                    "evolveStatesProfile":evolve,
                    "conditionAndDefinitionJoinRequired":true,"nativeSubscriberClosureVerified":false,
                    "effectiveActiveSubscriberSetVerified":false},
                "rightsVerified":false,"writerAuthorized":false,"productReadAccepted":false,
                "editedCopyAuthorized":false,"applyAuthorized":false,"nativeV3Verified":false});
            // A bounded private receipt, never a full document or generic
            // caller-selected JSON. Keep the output bound before CLI writes.
            if serde_json::to_vec(&value).map_err(|_|denied("AVATAR_DEP_RECEIPT_ENCODE"))?.len()>8*1024*1024{
                return Err(denied("AVATAR_DEP_RECEIPT_BOUND"));}
            Ok(PrivateAvatarDependencyReceipt{value})
        }
    }

    // Private Character Skin candidate receipt. Shares the accepted Avatar
    // span helpers, indexed walker, immutable ProductSession and V1 transport.
    // No catalog parser, condition evaluator or mutation authority.
    pub struct PrivateCharacterSkinReceipt { value:Value }
    impl PrivateCharacterSkinReceipt {
        pub fn to_private_receipt_json(&self)->Value{self.value.clone()}
    }
    fn character_id(v:i32)->bool{v>0&&v/10_000_000==1}
    fn character_skin_id(v:i32)->bool{
        v>0&&v/10_000_000==17&&(v%10_000_000)/100_000==0
    }
    fn text_token(bytes:&[u8],span:Span,max:usize)->CoreResult<String>{
        let token=bytes.get(span.begin..span.end).ok_or(denied("SKIN_TOKEN_SPAN"))?;
        if token.len()>max{return Err(denied("SKIN_TOKEN_BOUND"));}
        serde_json::from_slice::<String>(token).map_err(|_|denied("SKIN_STRING_REQUIRED"))
    }
    fn character_span(bytes:&[u8],array:Span,target:i32)->CoreResult<(usize,Span,Span)>{
        if array.begin>=array.end||array.end>bytes.len()||
            bytes.get(array.begin)!=Some(&b'[')||bytes.get(array.end-1)!=Some(&b']'){
            return Err(denied("SKIN_CHARACTERS_ARRAY_REQUIRED"));
        }
        let mut pos=skip_ws(bytes,array.begin+1);
        let mut index=0usize;
        let mut seen=std::collections::BTreeSet::new();
        let mut found=None;
        while pos<array.end-1{
            if index>=512{return Err(denied("SKIN_CHARACTER_COUNT_BOUND"));}
            let end=value_end(bytes,pos)?;
            if end>=array.end||end-pos>1024*1024{return Err(denied("SKIN_CHARACTER_SPAN_BOUND"));}
            let span=Span{begin:pos,end};
            let fs=members(bytes,span,128)?;
            let base=required(&fs,"Base")?;
            let b=members(bytes,base,32)?;
            // JSON spelling is the exact observed lowercase "id" in the
            // prior serialized shape. No "Id"/"ID" fallback or array index.
            // Steam626 physical presence remains subject to real private read.
            let id=int(bytes,required(&b,"id")?)?;
            if !character_id(id)||!seen.insert(id){return Err(denied("SKIN_CHARACTER_ID_OR_DUPLICATE"));}
            if id==target{found=Some((index,span,base));}
            index+=1;
            pos=skip_ws(bytes,end);
            match bytes.get(pos){
                Some(b',') if pos<array.end-1=>pos=skip_ws(bytes,pos+1),
                Some(b']') if pos==array.end-1=>break,
                _=>return Err(denied("SKIN_CHARACTER_ARRAY_TERMINATOR")),
            }
        }
        found.ok_or(denied("SKIN_CHARACTER_NOT_PRESENT"))
    }
    fn skin_inventory(bytes:&[u8],lists:Span,skin:i32)->CoreResult<Value>{
        let mut selected=None;
        for (key,record) in members(bytes,lists,128)?{
            let id=key_u32(&key)?;
            let fs=members(bytes,record,64)?;
            let id_span=required(&fs,"ID")?;
            let actual=serde_json::from_slice::<u32>(&bytes[id_span.begin..id_span.end])
                .map_err(|_|denied("SKIN_INVENTORY_ID_TYPE"))?;
            if actual!=id{return Err(denied("SKIN_INVENTORY_ID_MISMATCH"));}
            let ty=text_token(bytes,required(&fs,"CompatibleItemType")?,128)?;
            if ty!="ItemType_Skin"{continue;}
            // ID zero is a persisted unrelated route; only the selected Skin route must be positive.
            if id==0{return Err(denied("SKIN_INVENTORY_ID_ZERO"));}
            // Reject ambiguous compatible routes even if only one has item.
            if selected.is_some(){return Err(denied("SKIN_COMPATIBLE_INVENTORY_AMBIGUOUS"));}
            selected=Some((id,record,required(&fs,"Inventory")?));
        }
        let (id,record,items)=selected.ok_or(denied("SKIN_COMPATIBLE_INVENTORY_ABSENT"))?;
        let entries=members(bytes,items,16384)?;
        let wanted=skin.to_string();
        let mut found=None;
        for (k,v) in entries{
            let n=key_u32(&k)?;
            if n>i32::MAX as u32||n==0||n/10_000_000!=17{
                return Err(denied("SKIN_INVENTORY_ITEM_KEY"));
            }
            if k==wanted{found=Some(v);}
        }
        let entry=found.ok_or(denied("SKIN_INVENTORY_ENTRY_ABSENT"))?;
        let fields=members(bytes,entry,64)?;
        let amount=int(bytes,required(&fields,"Amount")?)?;
        if amount<1{return Err(denied("SKIN_NO_POSITIVE_SAVED_AMOUNT"));}
        let marker_span=field(&fields,"Marker");
        let marker=marker_span.map(|s|text_token(bytes,s,128)).transpose()?;
        if let Some(m)=&marker{
            if !m.starts_with("ItemMarker_")||m.len()<=11||
                !m.bytes().all(|c|c.is_ascii_alphanumeric()||c==b'_'){
                return Err(denied("SKIN_MARKER_SHAPE"));
            }
        }
        Ok(json!({"inventoryId":id,"compatibleItemType":"ItemType_Skin",
            "itemId":skin,"savedAmount":amount,"markerPresent":marker.is_some(),
            "savedMarker":marker,"markerSha256":marker_span.map(|s|sha(&bytes[s.begin..s.end])),
            "inventoryRecordSha256":sha(&bytes[record.begin..record.end]),
            "entrySha256":sha(&bytes[entry.begin..entry.end]),
            "positiveSavedAmount":true,"nativeHasItemVerified":false,
            "markerSemanticsVerified":false,"rightsVerified":false}))
    }
    impl ProductSession{
        /// Selectors identify a requested existing character and saved Skin
        /// entry only. They do not establish their catalog compatibility.
        pub fn read_private_character_skin(&self,e:WorkerEnvelope,character:i32,skin:i32)
            ->CoreResult<PrivateCharacterSkinReceipt>{
            let b=&self.native_source_build;
            if b.platform!=Platform::SteamWindows||b.build_kind!=BuildKind::SteamFullVersion||
                b.build_id!=EXACT||b.schema!=626||!b.externally_attested{
                return Err(denied("SKIN_EXACT_STEAM626_REQUIRED"));
            }
            let st=self.lock()?;validate_scope(self,&st,&e)?;
            if !character_id(character)||!character_skin_id(skin){
                return Err(denied("SKIN_SELECTOR_ID_OR_SUBTYPE"));
            }
            let bytes=&self.decoded;
            let root=roots(bytes)?;
            let world=members(bytes,root.world,1024)?;
            let player=members(bytes,root.player,1024)?;
            let array=required(&world,"Characters")?;
            let (index,span,base)=character_span(bytes,array,character)?;
            let fields=members(bytes,span,128)?;
            let old_span=field(&fields,"SkinID");
            let old=old_span.map(|s|int(bytes,s)).transpose()?;
            // Existing sentinel/zero is evidence only; unknown positive
            // incompatible subtype denied. Never invent absent/default.
            if old.is_some_and(|n|n>0&&!character_skin_id(n)){
                return Err(denied("SKIN_CURRENT_POSITIVE_TYPE"));
            }
            let lists=required(&player,"ListInventories")?;
            let inventory=skin_inventory(bytes,lists,skin)?;
            // Full source hash + exact selected spans are pointers for the
            // later native catalog/conditions/reference join. No condition
            // results, definition bytes, entitlement or event replay here.
            let value=json!({
                "contract":"wand.native.private.character-skin-read@1",
                "platform":"SteamWindows","fullVersion":EXACT,"schema":626,
                "sessionId":hex(&e.session_id),"revision":e.expected_revision,
                "indexGeneration":e.expected_index_generation,"decodedSha256":hex(&e.expected_decoded_sha256),
                "character":{"characterId":character,"savedArrayIndexDiagnosticOnly":index,
                    "baseIdSavedField":"id","baseSha256":sha(&bytes[base.begin..base.end]),
                    "characterSha256":sha(&bytes[span.begin..span.end]),
                    "skinIdPresent":old.is_some(),"currentSkinId":old,
                    "skinIdSha256":old_span.map(|s|sha(&bytes[s.begin..s.end])),
                    "requestedSkinId":skin,"sameSavedSkin":old==Some(skin)},
                "skinInventory":inventory,
                "referenceReadSet":{"charactersSha256":sha(&bytes[array.begin..array.end]),
                    "listInventoriesSha256":sha(&bytes[lists.begin..lists.end]),
                    "worldSha256":sha(&bytes[root.world.begin..root.world.end]),
                    "playerSha256":sha(&bytes[root.player.begin..root.player.end]),
                    "definitionJoinRequired":["CharacterItemID","AvailableWhen","CannotRemoveWhen","Conditions","Hidden","OnlineOnly","SyncOnline"],
                    "catalogDefinitionVerified":false,"actualConditionsEvaluated":false,
                    "activeReferenceClosureVerified":false,"subscriberClosureVerified":false},
                "fullDocumentRustValidated":true,"physicalGameInstallCryptographicallyProven":false,
                "characterSkinCompatibilityVerified":false,"ownedRightsVerified":false,
                "productReadAccepted":false,"writerAuthorized":false,"editedCopyAuthorized":false,
                "applyAuthorized":false,"nativeV3Verified":false
            });
            Ok(PrivateCharacterSkinReceipt{value})
        }
    }
    #[cfg(test)]
    mod character_skin_tests{
        use super::*;
        use crate::{BuildIdentity,SessionReceipt};
        fn open(v:Value)->ProductSession{
            ProductSession::open_decoded_readonly(serde_json::to_vec(&v).unwrap(),BuildIdentity{
                platform:Platform::SteamWindows,build_kind:BuildKind::SteamFullVersion,
                build_id:EXACT.into(),schema:626,externally_attested:true}).unwrap()
        }
        fn env(r:SessionReceipt)->WorkerEnvelope{WorkerEnvelope{
            contract:PRODUCT_WORKER_CONTRACT,session_id:r.session_id,expected_revision:r.revision,
            expected_index_generation:r.index_generation,expected_decoded_sha256:r.decoded_sha256,action:WorkerAction::ReadDomain}}
        fn doc()->Value{json!({"GameInfo":{"Version":626},"World":{"Characters":[
            {"Base":{"id":10000002},"SkinID":0},
            {"Base":{"id":10000053},"SkinID":170000001,"Unknown":{"keep":true}}
        ]},"Player":{"ListInventories":{
            "7":{"ID":7,"CompatibleItemType":"ItemType_ActivityItem","Inventory":{}},
            "42":{"ID":42,"CompatibleItemType":"ItemType_Skin","Inventory":{
                "170000000":{"Amount":1,"Marker":"ItemMarker_None"},"170100001":{"Amount":1}
            }}
        }}})}
        fn read(s:&ProductSession)->CoreResult<PrivateCharacterSkinReceipt>{
            s.read_private_character_skin(env(s.receipt().unwrap()),10000053,170000000)
        }
        #[test]
        fn exact_character_and_compatible_route_read_only(){
            let s=open(doc());let before=s.receipt().unwrap();let v=read(&s).unwrap().to_private_receipt_json();
            assert_eq!(v["character"]["characterId"],10000053);
            assert_eq!(v["character"]["savedArrayIndexDiagnosticOnly"],1);
            assert_eq!(v["character"]["currentSkinId"],170000001);
            assert_eq!(v["skinInventory"]["inventoryId"],42);
            assert_eq!(v["skinInventory"]["savedAmount"],1);
            assert_eq!(v["skinInventory"]["savedMarker"],"ItemMarker_None");
            assert_eq!(v["skinInventory"]["nativeHasItemVerified"],false);
            assert_eq!(v["ownedRightsVerified"],false);
            assert_eq!(v["referenceReadSet"]["actualConditionsEvaluated"],false);
            assert_eq!(v["writerAuthorized"],false);assert_eq!(s.receipt().unwrap(),before);
            let mut d=doc();d["World"]["Characters"][1].as_object_mut().unwrap().remove("SkinID");
            d["Player"]["ListInventories"]["42"]["Inventory"]["170000000"].as_object_mut().unwrap().remove("Marker");
            let s=open(d);let v=read(&s).unwrap().to_private_receipt_json();
            assert_eq!(v["character"]["skinIdPresent"],false);assert!(v["character"]["currentSkinId"].is_null());
            assert_eq!(v["skinInventory"]["markerPresent"],false);assert!(v["skinInventory"]["savedMarker"].is_null());
            for old in [0,-1,170000000]{
                let mut d=doc();d["World"]["Characters"][1]["SkinID"]=json!(old);
                let s=open(d);let v=read(&s).unwrap().to_private_receipt_json();
                assert_eq!(v["character"]["currentSkinId"],old);assert_eq!(v["character"]["skinIdPresent"],true);
                assert_eq!(v["character"]["sameSavedSkin"],old==170000000);
            }
        }
        #[test]
        fn nonskin_zero_route_preserves_selected_skin_invariants(){
            let baseline=open(doc());
            let expected=read(&baseline).unwrap().to_private_receipt_json();
            let mut d=doc();
            d["Player"]["ListInventories"]["0"]=json!({
                "ID":0,"CompatibleItemType":"ItemType_ActivityItem","Inventory":{}
            });
            let s=open(d.clone());let before=s.receipt().unwrap();
            let actual=read(&s).unwrap().to_private_receipt_json();
            assert_eq!(actual["character"],expected["character"]);
            assert_eq!(actual["skinInventory"],expected["skinInventory"]);
            assert_ne!(actual["referenceReadSet"]["listInventoriesSha256"],expected["referenceReadSet"]["listInventoriesSha256"]);
            assert_eq!(s.receipt().unwrap(),before);
            assert_eq!(actual["writerAuthorized"],false);
            assert_eq!(actual["ownedRightsVerified"],false);
            // Exact route invariants remain fail closed, even on unrelated records.
            for bad in [
                json!({"ID":1,"CompatibleItemType":"ItemType_ActivityItem","Inventory":{}}),
                json!({"ID":"0","CompatibleItemType":"ItemType_ActivityItem","Inventory":{}}),
                json!({"ID":0,"CompatibleItemType":0,"Inventory":{}}),
                json!({"ID":0,"CompatibleItemType":"ItemType_Skin","Inventory":{"170000000":{"Amount":1}}}),
            ]{
                let mut v=d.clone();v["Player"]["ListInventories"]["0"]=bad;
                let s=open(v);assert!(read(&s).is_err());
            }
            let mut v=d.clone();
            let selected=v["Player"]["ListInventories"].as_object_mut().unwrap().remove("42").unwrap();
            v["Player"]["ListInventories"]["0"]=selected;
            v["Player"]["ListInventories"]["0"]["ID"]=json!(0);
            let s=open(v);assert!(read(&s).is_err());
            let mut v=d.clone();
            v["Player"]["ListInventories"]["01"]=json!({"ID":1,"CompatibleItemType":"ItemType_ActivityItem","Inventory":{}});
            let s=open(v);assert!(read(&s).is_err());
            let mut v=d.clone();
            v["Player"]["ListInventories"]["43"]=v["Player"]["ListInventories"]["42"].clone();
            v["Player"]["ListInventories"]["43"]["ID"]=json!(43);
            let s=open(v);assert!(read(&s).is_err());
            let mut v=d.clone();
            v["Player"]["ListInventories"].as_object_mut().unwrap().remove("42");
            let s=open(v);assert!(read(&s).is_err());
            let e=env(before);
            assert!(s.read_private_character_skin(e,10000053,170000000).is_err());
            let s=open(d);let e=env(s.receipt().unwrap());
            let mut stale=e;stale.expected_revision+=1;
            assert!(s.read_private_character_skin(stale,10000053,170000000).is_err());
            assert!(s.read_private_character_skin(e,10000053,170100001).is_err());
        }
        #[test]
        fn rejects_ambiguous_wrong_type_and_stale(){
            let mut ds=Vec::new();
            let mut d=doc();d["World"]["Characters"][0]["Base"]["id"]=json!(10000053);ds.push(d);
            let mut d=doc();d["World"]["Characters"][1]["Base"]=json!({"Id":10000053});ds.push(d);
            let mut d=doc();d["World"]["Characters"][1]["SkinID"]=json!("170000001");ds.push(d);
            let mut d=doc();d["World"]["Characters"][1]["SkinID"]=json!(2147483648u64);ds.push(d);
            let mut d=doc();d["World"]["Characters"][1]["SkinID"]=json!(170100001);ds.push(d);
            let mut d=doc();d["Player"]["ListInventories"]["7"]["CompatibleItemType"]=json!("ItemType_Skin");ds.push(d);
            let mut d=doc();d["Player"]["ListInventories"]["42"]["ID"]=json!(7);ds.push(d);
            let mut d=doc();d["Player"]["ListInventories"]["42"]["CompatibleItemType"]=json!("ItemType_ActivityItem");ds.push(d);
            let mut d=doc();d["Player"]["ListInventories"]["42"]["Inventory"]["170000000"]["Amount"]=json!(0);ds.push(d);
            let mut d=doc();d["Player"]["ListInventories"]["42"]["Inventory"]["170000000"]["Amount"]=json!(2147483648u64);ds.push(d);
            let mut d=doc();d["Player"]["ListInventories"]["42"]["Inventory"]["170000000"]["Marker"]=json!(0);ds.push(d);
            let mut d=doc();d["Player"]["ListInventories"]["42"]["Inventory"]["0170000000"]=json!({"Amount":1});ds.push(d);
            let mut d=doc();d["Player"]["ListInventories"]["42"]["Inventory"].as_object_mut().unwrap().remove("170000000");ds.push(d);
            let mut d=doc();d["World"]["Characters"]=json!((10000000..10000513).map(|i|json!({"Base":{"id":i},"SkinID":0})).collect::<Vec<_>>());ds.push(d);
            for d in ds{let s=open(d);assert!(read(&s).is_err());}
            let s=open(doc());let e=env(s.receipt().unwrap());
            for (c,k) in [(10000099,170000000),(10000053,170100001),(10000053,0),(0,170000000),(10000053,i32::MAX)]{
                assert!(s.read_private_character_skin(e,c,k).is_err());
            }
            let mut stale=e;stale.expected_revision+=1;
            assert!(s.read_private_character_skin(stale,10000053,170000000).is_err());
            let mut wrong=e;wrong.action=WorkerAction::Stage;
            assert!(s.read_private_character_skin(wrong,10000053,170000000).is_err());
            assert!(open(doc()).read_private_character_skin(e,10000053,170000000).is_err());
            s.close().unwrap();assert!(s.read_private_character_skin(e,10000053,170000000).is_err());
            let sw=ProductSession::open_decoded_readonly(serde_json::to_vec(&doc()).unwrap(),BuildIdentity{
                platform:Platform::Switch,build_kind:BuildKind::SwitchBid,build_id:"9A239D3DB569756D".into(),
                schema:626,externally_attested:true}).unwrap();
            assert!(sw.read_private_character_skin(env(sw.receipt().unwrap()),10000053,170000000).is_err());
        }
    }

    #[cfg(test)]
    mod tests{
        use super::*;
        use crate::{BuildIdentity,SessionReceipt};
        fn open(v:Value)->ProductSession{
            ProductSession::open_decoded_readonly(serde_json::to_vec(&v).unwrap(),BuildIdentity{
                platform:Platform::SteamWindows,build_kind:BuildKind::SteamFullVersion,
                build_id:EXACT.into(),schema:626,externally_attested:true}).unwrap()
        }
        fn env(r:SessionReceipt)->WorkerEnvelope{WorkerEnvelope{
            contract:PRODUCT_WORKER_CONTRACT,session_id:r.session_id,expected_revision:r.revision,
            expected_index_generation:r.index_generation,expected_decoded_sha256:r.decoded_sha256,action:WorkerAction::ReadDomain}}
        fn doc()->Value{json!({"GameInfo":{"Version":626},"World":{},"Player":{
            "AvatarIsMale":true,"FemaleAvatar":{"HairColorIndex":0,"HairHighlightColor":0,
                "Clothes":{"0":50000001},"IncompatibleClothes":{},"Makeup":{},"ClothingCustomization":{"50000001":23}},
            "MaleAvatar":{"HairColorIndex":89,"HairHighlightColor":1,
                "Clothes":{"5":50000002},"Makeup":{"1":{"MakeupItemID":140000001,"Unknown":"preserve"}},"ClothingCustomization":{"50000002":0}}
        }})}
        fn dependency_doc()->Value{
            let mut v=doc();
            v["Player"]["ListInventories"]=json!({
                "0":{"ID":0,"CompatibleItemType":"ItemType_Furniture","Inventory":{}},
                "1":{"ID":1,"CompatibleItemType":"ItemType_Clothing","Inventory":{
                    "50000001":{"Amount":3,"Marker":"ItemMarker_None"},
                    "50000002":{"Amount":1}}},
                "3":{"ID":3,"CompatibleItemType":"ItemType_Makeup","Inventory":{
                    "140000001":{"Amount":2,"Marker":"ItemMarker_None"}}}
            });
            v["Player"]["MaleAvatar"]["SprintEffectID"]=json!(70100001);
            v["Player"]["MaleAvatar"]["Makeup"]["1"]["Opacity"]=json!(0.5);
            v["Player"]["AchievementsData"]=json!([{"AchievementID":2110000001,"CurAmount":2,
                "MaxAmount":10,"ClaimedRewardMilestone":0,"State":"AchievementState_OnGoing",
                "TypesCollected":[],"ItemsUsed":[]}]);
            v["Player"]["EvolveStatesProfile"]=json!({"EvolveProgressState":{"40000001":{
                "ItemID":40000001,"Level":1,"Objective":{"CurAmount":2,"TargetAmount":5,"ItemIdsCollected":[]}}}});
            v["World"]["MissionSlots"]=json!({"0":{"Slots":[{"SlotId":0,"MissionId":2070000001,
                "CurrentStepIndex":0,"CharacterId":10000001,"State":"MissionSlotState_OnGoing",
                "MissionSteps":[{"SubSteps":[{"Objectives":[{"TargetAmount":4,
                    "ProgressKeys":{"CurrentAmount":"2"},"Status":"MissionStepStatus_Ongoing","StepType":"StepGameplay"}]}]}]}]}});
            v["World"]["QuestInfo"]=json!({"MissionsCompleted":[]});
            v
        }
        #[test]
        fn dependency_readset_exact_ownership_and_subscriber_witness(){
            let v=dependency_doc();let s=open(v.clone());let before=s.receipt().unwrap();
            let e=env(before);
            let r=s.read_private_avatar_dependencies(e).unwrap().to_private_receipt_json();
            assert_eq!(r["avatar"],s.read_private_active_avatar(e).unwrap().to_private_receipt_json());
            assert_eq!(r["ownership"]["routes"][0]["entries"].as_array().unwrap().len(),2);
            assert_eq!(r["ownership"]["routes"][0]["entries"][0]["savedAmount"],3);
            assert_eq!(r["ownership"]["routes"][1]["entries"][0]["savedAmount"],2);
            assert_eq!(r["ownership"]["allObservedReferencesHavePositiveSavedAmount"],true);
            assert_eq!(r["maleDependencies"]["scalars"]["SprintEffectID"]["value"],70100001);
            assert_eq!(r["maleDependencies"]["makeup"][0]["scalars"]["Opacity"]["numericToken"],"0.5");
            assert_eq!(r["subscriberReadSet"]["achievementsData"]["entries"][0]["curAmount"]["value"],2);
            assert_eq!(r["subscriberReadSet"]["missionSlots"]["groups"][0]["slots"][0]["steps"][0]["subSteps"][0]["objectives"][0]["witness"]["progressEntries"][0]["savedValue"],"2");
            assert_eq!(r["subscriberReadSet"]["evolveStatesProfile"]["entries"][0]["objective"]["curAmount"]["value"],2);
            assert_eq!(r["subscriberReadSet"]["nativeSubscriberClosureVerified"],false);
            assert_eq!(r["rightsVerified"],false);assert_eq!(r["writerAuthorized"],false);
            assert_eq!(s.receipt().unwrap(),before);
            let mut d=v.clone();d["Player"]["ListInventories"]["1"]["Inventory"].as_object_mut().unwrap().remove("50000001");
            let x=open(d);let r=x.read_private_avatar_dependencies(env(x.receipt().unwrap())).unwrap().to_private_receipt_json();
            assert_eq!(r["ownership"]["routes"][0]["entries"][0]["present"],false);
            assert_eq!(r["ownership"]["allObservedReferencesHavePositiveSavedAmount"],false);
            let mut d=v.clone();d["Player"]["AchievementsData"]=json!([]);
            let x=open(d);let r=x.read_private_avatar_dependencies(env(x.receipt().unwrap())).unwrap().to_private_receipt_json();
            assert_eq!(r["subscriberReadSet"]["achievementsData"]["present"],true);
            let mut d=v.clone();d["Player"].as_object_mut().unwrap().remove("AchievementsData");
            let x=open(d);let r=x.read_private_avatar_dependencies(env(x.receipt().unwrap())).unwrap().to_private_receipt_json();
            assert_eq!(r["subscriberReadSet"]["achievementsData"]["present"],false);
            for (path,bad) in [
                ("route",json!(2)),("type",json!("ItemType_Skin")),("amount",json!("3")),
                ("achievement",json!("2")),("evolve",json!(40000002)),("progress",json!(2))
            ]{
                let mut d=v.clone();
                match path{
                    "route"=>d["Player"]["ListInventories"]["1"]["ID"]=bad,
                    "type"=>d["Player"]["ListInventories"]["3"]["CompatibleItemType"]=bad,
                    "amount"=>d["Player"]["ListInventories"]["1"]["Inventory"]["50000001"]["Amount"]=bad,
                    "achievement"=>d["Player"]["AchievementsData"][0]["CurAmount"]=bad,
                    "evolve"=>d["Player"]["EvolveStatesProfile"]["EvolveProgressState"]["40000001"]["ItemID"]=bad,
                    "progress"=>d["World"]["MissionSlots"]["0"]["Slots"][0]["MissionSteps"][0]["SubSteps"][0]["Objectives"][0]["ProgressKeys"]["CurrentAmount"]=bad,
                    _=>unreachable!(),
                }
                let x=open(d);assert!(x.read_private_avatar_dependencies(env(x.receipt().unwrap())).is_err(),"{path}");
            }
            let mut d=v.clone();let a=d["Player"]["AchievementsData"][0].clone();
            d["Player"]["AchievementsData"].as_array_mut().unwrap().push(a);
            let x=open(d);assert!(x.read_private_avatar_dependencies(env(x.receipt().unwrap())).is_err());
            let mut budget=DependencyBudget{nodes:8192,..Default::default()};
            assert!(budget.node().is_err());
            let mut budget=DependencyBudget{progress_entries:4096,..Default::default()};
            assert!(budget.progress("x",1).is_err());
            let mut budget=DependencyBudget{progress_bytes:2*1024*1024,..Default::default()};
            assert!(budget.progress("x",1).is_err());
            let mut stale=e;stale.expected_revision+=1;
            assert!(s.read_private_avatar_dependencies(stale).is_err());
            assert!(open(v).read_private_avatar_dependencies(e).is_err());
            s.close().unwrap();assert!(s.read_private_avatar_dependencies(e).is_err());
        }
        #[test]
        fn actual_branch_and_absence_zero_exact_refs(){
            let s=open(doc());let r=s.receipt().unwrap();let e=env(r);
            let v=s.read_private_active_avatar(e).unwrap().to_private_receipt_json();
            assert_eq!(v["activeBranch"],"MaleAvatar");
            assert_eq!(v["maleAvatar"]["hairColorIndex"],89);
            assert_eq!(v["femaleAvatar"]["hairHighlightColorIndex"],0);
            assert_eq!(v["maleAvatar"]["incompatibleClothes"]["present"],false);
            assert_eq!(v["femaleAvatar"]["incompatibleClothes"]["present"],true);
            assert_eq!(v["maleAvatar"]["makeup"]["entries"][0]["savedValue"],140000001);
            assert_eq!(v["maleAvatar"]["clothingCustomization"]["entries"][0]["savedValue"],0);
            assert_eq!(v["writerAuthorized"],false);assert_eq!(s.receipt().unwrap(),r);
            let mut v=doc();v["Player"]["MaleAvatar"].as_object_mut().unwrap().remove("HairHighlightColor");
            v["Player"]["MaleAvatar"]["HairHighlightColorIndex"]=json!(0);
            let s=open(v);let v=s.read_private_active_avatar(env(s.receipt().unwrap())).unwrap().to_private_receipt_json();
            assert!(v["maleAvatar"]["hairHighlightColorIndex"].is_null());
            assert_eq!(v["activeHairFieldsPresent"],false);
            assert_eq!(v["activeBothPackagedHairIndicesCandidate"],false);
        }
        #[test]
        fn bad_build_scope_shape_and_bounds(){
            for (key,value) in [("AvatarIsMale",json!(1)),("MaleAvatar",json!([])),("FemaleAvatar",Value::Null)]{
                let mut v=doc();v["Player"][key]=value;
                let s=open(v);assert!(s.read_private_active_avatar(env(s.receipt().unwrap())).is_err());
            }
            for (key,value) in [("HairColorIndex",json!("0")),("HairHighlightColor",json!(2147483648u64)),
              ("HairColorIndex",json!(1.0)),("Clothes",json!({"18":50000001})),
              ("Clothes",json!({"5":140000001})),("Makeup",json!({"1":{"MakeupItemID":50000001}})),
              ("Makeup",json!({"1":{"ItemID":140000001}})),("ClothingCustomization",json!({"050000001":1})),
              ("ClothingCustomization",json!({"50000001":"1"}))]{
                let mut v=doc();v["Player"]["MaleAvatar"][key]=value;
                let s=open(v);assert!(s.read_private_active_avatar(env(s.receipt().unwrap())).is_err(),"{key}");
            }
            let mut v=doc();v["Player"]["MaleAvatar"]["ClothingCustomization"]=json!((50000001..50000258).map(|i|(i.to_string(),json!(1))).collect::<serde_json::Map<String,Value>>());
            let s=open(v);assert!(s.read_private_active_avatar(env(s.receipt().unwrap())).is_err());
            let s=open(doc());let e=env(s.receipt().unwrap());let mut stale=e;stale.expected_revision+=1;
            assert!(s.read_private_active_avatar(stale).is_err());
            let mut wrong=e;wrong.action=WorkerAction::Stage;assert!(s.read_private_active_avatar(wrong).is_err());
            assert!(open(doc()).read_private_active_avatar(e).is_err());
            s.close().unwrap();assert!(s.read_private_active_avatar(e).is_err());
            let sw=ProductSession::open_decoded_readonly(serde_json::to_vec(&doc()).unwrap(),BuildIdentity{
                platform:Platform::Switch,build_kind:BuildKind::SwitchBid,build_id:"9A239D3DB569756D".into(),
                schema:626,externally_attested:true}).unwrap();
            assert!(sw.read_private_active_avatar(env(sw.receipt().unwrap())).is_err());
        }
    }
}
