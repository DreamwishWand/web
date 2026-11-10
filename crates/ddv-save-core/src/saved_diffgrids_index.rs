//! 01A / R04 R06 R22: stored DiffGrids metadata only.
//! One validated ProductSession, one indexed lexical scanner, Rust-owned
//! cursor grants. This does NOT load external layouts, assemble effective
//! grids, repair saves, verify Native semantics, or authorize a Writer.
use super::{
    indexed_read::{self, CursorGrant, IndexedCache, IndexedDomain, Span},
    BuildKind, Platform, ProductSession, WorkerEnvelope,
};
use crate::{CoreError, CoreResult};
use std::collections::BTreeSet;

const EXACT_STEAM_FULL_VERSION:&str =
    "releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22";
const GRID_LIMIT:usize=50_000;
const IDS_PER_GRID_LIMIT:usize=16_384;
const PAGE_LIMIT:usize=8;
const KEY_BYTES_LIMIT:usize=128;
const FIELD_STRING_BYTES_LIMIT:usize=4096;

fn denied(code:&'static str)->CoreError {CoreError(code)}

/// Literal status for EVERY returned external Native reference. No existence,
/// resolution, hash or loader validity is inferred from a stored path.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum ExternalLayoutStatus { UnresolvedExternalLayout }
impl ExternalLayoutStatus {
    pub const fn as_str(self)->&'static str {"UNRESOLVED_EXTERNAL_LAYOUT"}
}
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum StoredRemovedShape { Absent, Array, ObjectMap }
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct SavedDiffGridMetadata {
    pub grid_id:u64,
    pub default_layout_grid_id:Option<u64>,
    pub grid_default_layout_path:Option<String>,
    pub grid_default_layout_type:Option<String>,
    pub default_grid_hash_code:Option<i32>,
    pub default_grid_data_hash_code:Option<i32>,
    // Saved ID lists only. No Modified−Removed precedence inferred.
    pub modified_object_ids:Vec<u64>,
    pub removed_object_ids:Vec<u64>,
    pub removed_shape:StoredRemovedShape,
    /// Distinct ObjectIDs simultaneously present in saved Mod and Rem.
    /// Not the number of DiffGrids containing an overlap; never an error.
    pub modified_removed_id_pairs:usize,
    pub external_layout:ExternalLayoutStatus,
    pub native_effective_grid_verified:bool,
}
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct SavedDiffGridsCursorReceipt {
    pub cursor:[u8;16],
    pub session_id:[u8;16],
    pub revision:u64,
    pub index_generation:u64,
    pub decoded_sha256:[u8;32],
    pub indexed_records:usize,
    pub max_records_per_page:usize,
    pub all_native_references_verified:bool,
    pub product_read_accepted:bool,
    pub writer_authorized:bool,
}
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct SavedDiffGridsPage {
    pub session_id:[u8;16],
    pub revision:u64,
    pub index_generation:u64,
    pub decoded_sha256:[u8;32],
    pub records:Vec<SavedDiffGridMetadata>,
    pub next_cursor:Option<[u8;16]>,
    pub all_native_references_verified:bool,
    pub product_read_accepted:bool,
    pub writer_authorized:bool,
}
#[derive(Clone, Copy, Debug)]
pub(super) struct SavedDiffGridIndexEntry {
    pub grid_id:u64,
    pub span:Span,
}
// This is an adapter OVER the accepted indexed_read lexical scanner, NOT a
// second JSON reader. Entire document was strictly validated on Session open.
fn walk_object<F>(b:&[u8], s:Span, mut visit:F)->CoreResult<()>
where F:FnMut(&str,Span)->CoreResult<()> {
    if b.get(s.begin)!=Some(&b'{') || b.get(s.end.saturating_sub(1))!=Some(&b'}'){
        return Err(denied("SAVED_DIFFGRIDS_OBJECT_REQUIRED"));
    }
    let mut i=s.begin+1;
    loop {
        i=indexed_read::skip_ws(b,i);
        if i==s.end-1 {return Ok(());}
        if i>=s.end {return Err(denied("SAVED_DIFFGRIDS_OBJECT_BOUNDS"));}
        let key_end=indexed_read::string_end(b,i)?;
        if key_end-i>KEY_BYTES_LIMIT {return Err(denied("SAVED_DIFFGRIDS_KEY_BOUNDS"));}
        let key:String=serde_json::from_slice(&b[i..key_end])
            .map_err(|_|denied("SAVED_DIFFGRIDS_KEY_INVALID"))?;
        i=indexed_read::skip_ws(b,key_end);
        if b.get(i)!=Some(&b':'){return Err(denied("SAVED_DIFFGRIDS_COLON"));}
        i=indexed_read::skip_ws(b,i+1);
        let end=indexed_read::value_end(b,i)?;
        if end>=s.end {return Err(denied("SAVED_DIFFGRIDS_CHILD_OUT_OF_BOUNDS"));}
        visit(&key,Span{begin:i,end})?;
        i=indexed_read::skip_ws(b,end);
        match b.get(i) {
            Some(b',')=>i+=1,
            Some(b'}') if i==s.end-1=>return Ok(()),
            _=>return Err(denied("SAVED_DIFFGRIDS_DELIMITER")),
        }
    }
}
fn find_field(b:&[u8],s:Span,name:&str)->CoreResult<Option<Span>> {
    let mut found=None;
    walk_object(b,s,|key,span|{
        if key==name {
            if found.replace(span).is_some() {return Err(denied("SAVED_DIFFGRIDS_DUPLICATE_FIELD"));}
        }
        Ok(())
    })?;
    Ok(found)
}
fn required(b:&[u8],s:Span,name:&str)->CoreResult<Span> {
    find_field(b,s,name)?.ok_or(denied("SAVED_DIFFGRIDS_REQUIRED_FIELD"))
}
fn number(b:&[u8],s:Span)->CoreResult<u64>{
    let n:u64=serde_json::from_slice(&b[s.begin..s.end])
        .map_err(|_|denied("SAVED_DIFFGRIDS_INTEGER_REQUIRED"))?;
    if n>9_007_199_254_740_991 {
        return Err(denied("SAVED_DIFFGRIDS_INTEGER_UNSAFE"));
    }
    Ok(n)
}
fn signed_hash(b:&[u8],s:Span)->CoreResult<i32>{
    serde_json::from_slice::<i32>(&b[s.begin..s.end])
        .map_err(|_|denied("SAVED_DIFFGRIDS_I32_HASH_REQUIRED"))
}
fn text_field(b:&[u8],s:Span)->CoreResult<String>{
    if s.end-s.begin>FIELD_STRING_BYTES_LIMIT {
        return Err(denied("SAVED_DIFFGRIDS_STRING_BOUNDS"));
    }
    serde_json::from_slice::<String>(&b[s.begin..s.end])
        .map_err(|_|denied("SAVED_DIFFGRIDS_STRING_REQUIRED"))
}
fn key_id(key:&str)->CoreResult<u64>{
    if key.is_empty()||key.len()>20||key.as_bytes().iter().any(|b|!b.is_ascii_digit()){
        return Err(denied("SAVED_DIFFGRIDS_NONCANONICAL_KEY"));
    }
    let n=key.parse::<u64>().map_err(|_|denied("SAVED_DIFFGRIDS_KEY_OVERFLOW"))?;
    if n>9_007_199_254_740_991 || n.to_string()!=key {
        return Err(denied("SAVED_DIFFGRIDS_NONCANONICAL_KEY"));
    }
    Ok(n)
}
fn walk_array<F>(b:&[u8],s:Span,mut visit:F)->CoreResult<()>
where F:FnMut(Span)->CoreResult<()> {
    if b.get(s.begin)!=Some(&b'[')||b.get(s.end.saturating_sub(1))!=Some(&b']'){
        return Err(denied("SAVED_DIFFGRIDS_ARRAY_REQUIRED"));
    }
    let mut i=s.begin+1;
    loop {
        i=indexed_read::skip_ws(b,i);
        if i==s.end-1{return Ok(());}
        if i>=s.end{return Err(denied("SAVED_DIFFGRIDS_ARRAY_BOUNDS"));}
        let end=indexed_read::value_end(b,i)?;
        if end>=s.end{return Err(denied("SAVED_DIFFGRIDS_ARRAY_OUT_OF_BOUNDS"));}
        visit(Span{begin:i,end})?;
        i=indexed_read::skip_ws(b,end);
        match b.get(i){
            Some(b',')=>i+=1,
            Some(b']') if i==s.end-1=>return Ok(()),
            _=>return Err(denied("SAVED_DIFFGRIDS_ARRAY_DELIMITER")),
        }
    }
}
fn push_bounded(ids:&mut Vec<u64>,id:u64)->CoreResult<()>{
    if ids.len()==IDS_PER_GRID_LIMIT {return Err(denied("SAVED_DIFFGRIDS_OBJECT_COUNT_BOUNDS"));}
    ids.push(id);
    Ok(())
}
fn record(b:&[u8],entry:SavedDiffGridIndexEntry)->CoreResult<SavedDiffGridMetadata>{
    let grid=entry.span;
    let saved_id=number(b,required(b,grid,"ID")?)?;
    if saved_id!=entry.grid_id{return Err(denied("SAVED_DIFFGRIDS_KEY_ID_MISMATCH"));}
    let default_layout_grid_id=find_field(b,grid,"DefaultLayoutGridID")?
        .map(|s|number(b,s)).transpose()?;
    // 0 is retained as a literal, never interpreted as a valid Native target.
    let grid_default_layout_path=find_field(b,grid,"GridDefaultLayoutPath")?
        .map(|s|text_field(b,s)).transpose()?;
    let grid_default_layout_type=find_field(b,grid,"GridDefaultLayoutType")?
        .map(|s|text_field(b,s)).transpose()?;
    let default_grid_hash_code=find_field(b,grid,"DefaultGridHashCode")?
        .map(|s|signed_hash(b,s)).transpose()?;
    let default_grid_data_hash_code=find_field(b,grid,"DefaultGridDataHashCode")?
        .map(|s|signed_hash(b,s)).transpose()?;
    let mut modified_object_ids=Vec::new();
    if let Some(span)=find_field(b,grid,"ModifiedObjects")? {
        walk_object(b,span,|key,item|{
            let id=key_id(key)?;
            if number(b,required(b,item,"ID")?)?!=id{
                return Err(denied("SAVED_DIFFGRIDS_MODIFIED_KEY_ID_MISMATCH"));
            }
            push_bounded(&mut modified_object_ids,id)
        })?;
    }
    let mut removed_object_ids=Vec::new();
    let mut removed_shape=StoredRemovedShape::Absent;
    if let Some(span)=find_field(b,grid,"RemovedObjects")? {
        match b.get(span.begin) {
            Some(b'[')=>{
                removed_shape=StoredRemovedShape::Array;
                walk_array(b,span,|id|{
                    let value=number(b,id)?;
                    push_bounded(&mut removed_object_ids,value)
                })?;
            }
            Some(b'{')=>{
                removed_shape=StoredRemovedShape::ObjectMap;
                walk_object(b,span,|_,id|{
                    let value=number(b,id)?;
                    push_bounded(&mut removed_object_ids,value)
                })?;
            }
            _=>return Err(denied("SAVED_DIFFGRIDS_REMOVED_SHAPE_UNSUPPORTED")),
        }
    }
    let removed_set:BTreeSet<u64>=removed_object_ids.iter().copied().collect();
    let modified_removed_id_pairs=modified_object_ids.iter()
        .filter(|id|removed_set.contains(id)).count();
    Ok(SavedDiffGridMetadata {
        grid_id:entry.grid_id,default_layout_grid_id,
        grid_default_layout_path,grid_default_layout_type,
        default_grid_hash_code,default_grid_data_hash_code,
        modified_object_ids,removed_object_ids,removed_shape,
        modified_removed_id_pairs,
        external_layout:ExternalLayoutStatus::UnresolvedExternalLayout,
        native_effective_grid_verified:false,
    })
}
fn build_index(b:&[u8])->CoreResult<Vec<SavedDiffGridIndexEntry>>{
    let world=indexed_read::roots(b)?.world;
    let collection=required(b,world,"GridCollection")?;
    let diffs=required(b,collection,"DiffGrids")?;
    let mut seen=BTreeSet::new();
    let mut entries=Vec::new();
    walk_object(b,diffs,|key,span|{
        if entries.len()==GRID_LIMIT{return Err(denied("SAVED_DIFFGRIDS_GRID_COUNT_BOUNDS"));}
        let grid_id=key_id(key)?;
        if !seen.insert(grid_id) {return Err(denied("SAVED_DIFFGRIDS_DUPLICATE_ID"));}
        if number(b,required(b,span,"ID")?)?!=grid_id{
            return Err(denied("SAVED_DIFFGRIDS_KEY_ID_MISMATCH"));
        }
        entries.push(SavedDiffGridIndexEntry{grid_id,span});
        Ok(())
    })?;
    Ok(entries)
}
impl ProductSession{
    fn check_saved_diffgrids_build(&self)->CoreResult<()>{
        let b=&self.native_source_build;
        if b.platform!=Platform::SteamWindows||
           b.build_kind!=BuildKind::SteamFullVersion||
           b.build_id!=EXACT_STEAM_FULL_VERSION||b.schema!=626||
           !b.externally_attested {
            return Err(denied("SAVED_DIFFGRIDS_EXACT_STEAM_BUILD_REQUIRED"));
        }
        Ok(())
    }
    /// Explicit stored-metadata operation; NOT a native/effective Grid read.
    /// Source Build is declared and bounded, not cryptographically game attested.
    /// Token is CSPRNG-minted and shared with existing indexed cursor grants.
    pub fn issue_saved_diffgrids_cursor(
        &self,scope:WorkerEnvelope
    )->CoreResult<SavedDiffGridsCursorReceipt>{
        self.check_saved_diffgrids_build()?;
        let mut st=self.lock()?;
        indexed_read::validate_scope(self,&st,&scope)?;
        if st.indexed.is_none(){
            st.indexed=Some(IndexedCache{
                roots:indexed_read::roots(&self.decoded)?,
                grants:Vec::new(),next_nonce:0,saved_diffgrids:None
            });
        }
        let cache=st.indexed.as_mut().ok_or(denied("SAVED_DIFFGRIDS_INDEX_MISSING"))?;
        if cache.grants.len()>=indexed_read::INDEX_MAX_ACTIVE_CURSORS{
            return Err(denied("SAVED_DIFFGRIDS_ACTIVE_CURSOR_LIMIT"));
        }
        if cache.saved_diffgrids.is_none(){
            cache.saved_diffgrids=Some(build_index(&self.decoded)?);
        }
        let records=cache.saved_diffgrids.as_ref()
            .ok_or(denied("SAVED_DIFFGRIDS_INDEX_MISSING"))?.len();
        let token=indexed_read::mint_cursor(self,cache)?;
        if cache.grants.iter().any(|g|g.token==token){
            return Err(denied("SAVED_DIFFGRIDS_CURSOR_COLLISION"));
        }
        cache.grants.push(CursorGrant{
            token,domain:IndexedDomain::SavedDiffGrids,pos:0,
            revision:st.revision,generation:st.generation
        });
        Ok(SavedDiffGridsCursorReceipt{
            cursor:token,session_id:scope.session_id,
            revision:scope.expected_revision,index_generation:scope.expected_index_generation,
            decoded_sha256:scope.expected_decoded_sha256,
            indexed_records:records,max_records_per_page:PAGE_LIMIT,
            all_native_references_verified:false,product_read_accepted:false,
            writer_authorized:false,
        })
    }
    /// 0-8 bounded records, no JSON spans/full document transported to caller.
    /// Grant is single-use: Core rotates token after successful page parsing.
    pub fn read_saved_diffgrids_page(
        &self,scope:WorkerEnvelope,cursor:[u8;16]
    )->CoreResult<SavedDiffGridsPage>{
        self.check_saved_diffgrids_build()?;
        let mut st=self.lock()?;
        indexed_read::validate_scope(self,&st,&scope)?;
        let cache=st.indexed.as_mut()
            .ok_or(denied("SAVED_DIFFGRIDS_INDEX_NOT_ISSUED"))?;
        let slot=cache.grants.iter().position(|g|g.token==cursor)
            .ok_or(denied("SAVED_DIFFGRIDS_CURSOR_UNKNOWN_OR_CONSUMED"))?;
        let grant=cache.grants[slot].clone();
        if grant.domain!=IndexedDomain::SavedDiffGrids||
           grant.revision!=scope.expected_revision||
           grant.generation!=scope.expected_index_generation {
            return Err(denied("SAVED_DIFFGRIDS_CURSOR_SCOPE_INVALID"));
        }
        let entries=cache.saved_diffgrids.as_ref()
            .ok_or(denied("SAVED_DIFFGRIDS_INDEX_MISSING"))?;
        if grant.pos>entries.len(){return Err(denied("SAVED_DIFFGRIDS_CURSOR_BOUNDS"));}
        let end=grant.pos.saturating_add(PAGE_LIMIT).min(entries.len());
        let mut records=Vec::with_capacity(end-grant.pos);
        for entry in &entries[grant.pos..end] {
            records.push(record(&self.decoded,*entry)?);
        }
        let next_cursor=if end==entries.len(){None}
            else{Some(indexed_read::mint_cursor(self,cache)?)};
        if let Some(next)=next_cursor {
            if cache.grants.iter().any(|g|g.token==next){
                return Err(denied("SAVED_DIFFGRIDS_CURSOR_COLLISION"));
            }
            cache.grants[slot].token=next;
            cache.grants[slot].pos=end;
        }else{
            cache.grants.remove(slot);
        }
        Ok(SavedDiffGridsPage{
            session_id:st.id,revision:st.revision,index_generation:st.generation,
            decoded_sha256:self.sha,records,next_cursor,
            all_native_references_verified:false,
            product_read_accepted:false,writer_authorized:false,
        })
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    use crate::{BuildIdentity, PRODUCT_WORKER_CONTRACT, WorkerAction};
    const STEAM:&str="releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22";
    fn open(doc:&str,platform:Platform)->ProductSession{
        let (kind,id)=if platform==Platform::SteamWindows {
            (BuildKind::SteamFullVersion,STEAM)
        }else{(BuildKind::SwitchBid,"9A239D3DB569756D")};
        ProductSession::open_decoded_readonly(doc.as_bytes().to_vec(),BuildIdentity{
            platform,build_kind:kind,build_id:id.into(),schema:626,
            externally_attested:true,
        }).unwrap()
    }
    fn scope(s:&ProductSession)->WorkerEnvelope{
        let r=s.receipt().unwrap();
        WorkerEnvelope{contract:PRODUCT_WORKER_CONTRACT,
            session_id:r.session_id,expected_revision:r.revision,
            expected_index_generation:r.index_generation,
            expected_decoded_sha256:r.decoded_sha256,action:WorkerAction::ReadDomain}
    }
    const DOC:&str=r#"{"GameInfo":{"Version":626},"Player":{},"World":{"GridCollection":{"Grids":{},"DiffGrids":{"0":{"ID":0,"DefaultLayoutGridID":0,"GridDefaultLayoutPath":"unverified/external","GridDefaultLayoutType":"some.Type, Assembly","DefaultGridHashCode":-4,"DefaultGridDataHashCode":6,"ModifiedObjects":{"7":{"ID":7},"8":{"ID":8}},"RemovedObjects":[7,9]},"15":{"ID":15,"ModifiedObjects":{"22":{"ID":22}},"RemovedObjects":{"a":22}}}}}}"#;
    #[test]
    fn saved_only_typed_paged_core_cursor_and_unknown_external(){
        let s=open(DOC,Platform::SteamWindows);
        let st=scope(&s);
        let first=s.issue_saved_diffgrids_cursor(st).unwrap();
        assert_eq!(first.indexed_records,2);
        assert_eq!(first.max_records_per_page,8);
        let page=s.read_saved_diffgrids_page(st,first.cursor).unwrap();
        assert_eq!(page.records.len(),2);
        assert_eq!(page.records[0].grid_id,0); // literal, NOT permitted Native Grid0
        assert_eq!(page.records[0].default_layout_grid_id,Some(0));
        assert_eq!(page.records[0].default_grid_hash_code,Some(-4));
        assert_eq!(page.records[0].default_grid_data_hash_code,Some(6));
        assert_eq!(page.records[0].grid_default_layout_path.as_deref(),Some("unverified/external"));
        assert_eq!(page.records[0].grid_default_layout_type.as_deref(),Some("some.Type, Assembly"));
        assert_eq!(page.records[0].modified_object_ids,[7,8]);
        assert_eq!(page.records[0].removed_object_ids,[7,9]);
        assert_eq!(page.records[0].modified_removed_id_pairs,1);
        assert_eq!(page.records[0].external_layout.as_str(),"UNRESOLVED_EXTERNAL_LAYOUT");
        assert!(!page.records[0].native_effective_grid_verified);
        assert_eq!(page.records[1].removed_shape,StoredRemovedShape::ObjectMap);
        assert_eq!(page.records[1].modified_removed_id_pairs,1);
        assert!(!page.all_native_references_verified&&!page.product_read_accepted&&!page.writer_authorized);
        assert!(page.next_cursor.is_none());
        assert!(s.read_saved_diffgrids_page(st,first.cursor).is_err()); // consumed
        assert!(!s.receipt().unwrap().product_read_accepted);
    }
    #[test]
    fn fixed8_native_metadata_pages_and_root_cursors_do_not_alias(){
        let mut diffs=Vec::new();
        for id in 1..=17u64 {
            diffs.push(format!("\"{id}\":{{\"ID\":{id},\"ModifiedObjects\":{{}},\"RemovedObjects\":[]}}"));
        }
        let doc=format!("{{\"GameInfo\":{{\"Version\":626}},\"Player\":{{}},\"World\":{{\"GridCollection\":{{\"DiffGrids\":{{{}}}}}}}}}",diffs.join(","));
        let s=open(&doc,Platform::SteamWindows);let st=scope(&s);
        let root=s.issue_indexed_cursor(st,IndexedDomain::World).unwrap();
        let head=s.issue_saved_diffgrids_cursor(st).unwrap();
        assert_eq!(head.indexed_records,17);
        let p1=s.read_saved_diffgrids_page(st,head.cursor).unwrap();
        assert_eq!(p1.records.len(),8);
        let p2=s.read_saved_diffgrids_page(st,p1.next_cursor.unwrap()).unwrap();
        assert_eq!(p2.records.len(),8);
        let p3=s.read_saved_diffgrids_page(st,p2.next_cursor.unwrap()).unwrap();
        assert_eq!(p3.records.len(),1);
        assert!(p3.next_cursor.is_none());
        assert!(s.read_indexed_page(st,head.cursor).is_err());
        let world=s.read_indexed_page(st,root.cursor).unwrap();
        assert_eq!(world.fields.len(),1);
        assert!(!world.product_read_accepted);
    }
    #[test]
    fn malicious_saved_shapes_wrong_build_and_stale_cas_fail_closed(){
        for src in [
            DOC.replace("\"ID\":0","\"ID\":9"),
            DOC.replace("\"7\":{\"ID\":7}","\"7\":{\"ID\":8}"),
            DOC.replace("\"RemovedObjects\":[7,9]","\"RemovedObjects\":[\"7\"]"),
            DOC.replace("\"RemovedObjects\":[7,9]","\"RemovedObjects\":null"),
            DOC.replace("\"DefaultGridHashCode\":-4","\"DefaultGridHashCode\":\"-4\""),
            DOC.replace("\"DefaultLayoutGridID\":0","\"DefaultLayoutGridID\":\"0\""),
            DOC.replace("\"GridDefaultLayoutType\":\"some.Type, Assembly\"","\"GridDefaultLayoutType\":null"),
            DOC.replace("\"0\":{\"ID\":0","\"00\":{\"ID\":0"),
            DOC.replace("\"DiffGrids\":{","\"DiffGrids\":[] ,\"NotGrids\":{"),
        ] {
            if let Ok(s)=ProductSession::open_decoded_readonly(src.into_bytes(),BuildIdentity{
                platform:Platform::SteamWindows,build_kind:BuildKind::SteamFullVersion,
                build_id:STEAM.into(),schema:626,externally_attested:true}) {
                let st=scope(&s);
                match s.issue_saved_diffgrids_cursor(st) {
                    Err(_)=>{},
                    Ok(c)=>assert!(s.read_saved_diffgrids_page(st,c.cursor).is_err(),
                        "invalid saved field must fail no data authority"),
                }
            }
        }
        let sw=open(DOC,Platform::Switch);
        assert!(sw.issue_saved_diffgrids_cursor(scope(&sw)).is_err());
        let s=open(DOC,Platform::SteamWindows);let st=scope(&s);
        let mut rev=st;rev.expected_revision+=1;
        assert!(s.issue_saved_diffgrids_cursor(rev).is_err());
        let mut gen=st;gen.expected_index_generation+=1;
        assert!(s.issue_saved_diffgrids_cursor(gen).is_err());
        let mut sha=st;sha.expected_decoded_sha256=[3;32];
        assert!(s.issue_saved_diffgrids_cursor(sha).is_err());
        let mut action=st;action.action=WorkerAction::Stage;
        assert!(s.issue_saved_diffgrids_cursor(action).is_err());
        let token=s.issue_saved_diffgrids_cursor(st).unwrap().cursor;
        assert!(s.read_saved_diffgrids_page(st,[0;16]).is_err());
        let foreign=open(DOC,Platform::SteamWindows);
        assert!(s.read_saved_diffgrids_page(scope(&foreign),token).is_err());
        s.close().unwrap();
        assert!(s.read_saved_diffgrids_page(st,token).is_err());
    }
    #[test]
    fn duplicate_modified_removed_not_meaningfully_reclassified(){
        let mut diffs=Vec::new();
        for id in 1..=14u64 {
            diffs.push(format!("\"{id}\":{{\"ID\":{id},\"ModifiedObjects\":{{\"7\":{{\"ID\":7}},\"8\":{{\"ID\":8}},\"9\":{{\"ID\":9}},\"10\":{{\"ID\":10}}}},\"RemovedObjects\":[7,8,9,10]}}"));
        }
        let doc=format!("{{\"GameInfo\":{{\"Version\":626}},\"Player\":{{}},\"World\":{{\"GridCollection\":{{\"DiffGrids\":{{{}}}}}}}}}",diffs.join(","));
        let s=open(&doc,Platform::SteamWindows);let st=scope(&s);
        let mut token=s.issue_saved_diffgrids_cursor(st).unwrap().cursor;
        let mut grid_count=0usize;
        let mut pair_count=0usize;
        loop{
            let p=s.read_saved_diffgrids_page(st,token).unwrap();
            for g in p.records {
                grid_count+=1;pair_count+=g.modified_removed_id_pairs;
                assert_eq!(g.external_layout,ExternalLayoutStatus::UnresolvedExternalLayout);
                assert!(!g.native_effective_grid_verified);
            }
            if let Some(t)=p.next_cursor {token=t}else{break}
        }
        assert_eq!(grid_count,14);
        assert_eq!(pair_count,56); // different units, zero semantic decision
    }
}