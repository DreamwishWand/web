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
            revision:scope.expected_revision,generation:scope.expected_index_generation
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

// ACT451: native-only exact physical Storage candidate and stored link
// census. Reuse THIS module's accepted span traversal and ProductSession
// epoch. External default layouts, runtime orphan cache, effective grids,
// rights and geometry remain unresolved. No mutation or public ABI.
#[cfg(all(feature="private-native-v1",not(target_arch="wasm32")))]
mod private_storage {
    use super::*;
    use serde_json::{json,Value};
    use sha2::{Digest,Sha256};
    const ITEM:u64=40000053; // exact Steam626 packaged definition E1410/ACT440
    // ACT591: separately verified White 48-slot definition; never arbitrary
    // caller-provided item/capacity or an inference from saved Size.
    const WHITE48_ITEM:u64=40001838;
    #[derive(Clone,Copy)]
    enum StorageProfile { Original16, White48 }
    impl StorageProfile {
        fn item(self)->u64{match self{Self::Original16=>ITEM,Self::White48=>WHITE48_ITEM}}
        fn capacity(self)->usize{match self{Self::Original16=>16,Self::White48=>48}}
        fn contract(self)->&'static str{match self{
            Self::Original16=>"wand.native.private.storage-stored-readset@1",
            Self::White48=>"wand.native.private.storage48-white-stored-readset@1"}}
    }
    const MAX_OBJECTS:usize=250_000;
    const MAX_CONTAINERS:usize=4096;
    const MAX_LINKS:usize=16384;
    fn digest(b:&[u8],s:Span)->String{
        Sha256::digest(&b[s.begin..s.end]).iter().map(|v|format!("{v:02x}")).collect()
    }
    fn hex(b:&[u8])->String{b.iter().map(|v|format!("{v:02x}")).collect()}
    fn token(b:&[u8],s:Span)->&[u8]{&b[s.begin..s.end]}
    fn raw(b:&[u8],s:Span,want:&[u8])->bool{token(b,s)==want}
    fn nullable_id(b:&[u8],s:Span)->CoreResult<Option<u64>>{
        if raw(b,s,b"null"){return Ok(None);}
        let n=number(b,s)?;
        if n>i32::MAX as u64{return Err(denied("STORAGE_NATIVE_ID_BOUNDS"));}
        Ok(Some(n))
    }
    fn optional_witness(b:&[u8],s:Option<Span>)->Value{
        json!({"present":s.is_some(),"sha256":s.map(|x|digest(b,x))})
    }
    fn boolean(b:&[u8],s:Span)->CoreResult<bool>{
        if raw(b,s,b"true"){Ok(true)}else if raw(b,s,b"false"){Ok(false)}
        else{Err(denied("STORAGE_BOOL_REQUIRED"))}
    }
    fn canonical_record(b:&[u8],key:&str,s:Span)->CoreResult<u64>{
        let id=key_id(key)?;
        if number(b,required(b,s,"ID")?)?!=id{return Err(denied("STORAGE_KEY_ID_MISMATCH"));}
        Ok(id)
    }
    // Typed physical GridObject.State.Storage only. Unknown unrelated state
    // branches are not interpreted. The entire GridCollection digest binds
    // them for future independent native/default/subgrid reconciliation.
    fn storage_state(b:&[u8],o:Span)->CoreResult<Option<(Span,Span)>>{
        let Some(s)=find_field(b,o,"State")? else{return Ok(None)};
        if raw(b,s,b"null"){return Ok(None);}
        let Some(storage)=find_field(b,s,"Storage")? else{return Ok(None)};
        if raw(b,storage,b"null"){return Ok(None);}
        // Validate object even where ID is absent, preserve literal default.
        walk_object(b,storage,|_,_|Ok(()))?;
        Ok(Some((s,storage)))
    }
    #[derive(Clone,Copy)]
    struct Link{grid:u64,object:u64,item:u64,container:u64,diff:bool,object_span:Span,state:Span,storage:Span}
    struct Census{links:Vec<Link>,objects:usize,grids:usize,diffs:usize,default_templates:usize,external_layouts:usize}
    impl Census{
        fn new()->Self{Self{links:Vec::new(),objects:0,grids:0,diffs:0,default_templates:0,external_layouts:0}}
        fn scan(&mut self,b:&[u8],map:Span,diff:bool)->CoreResult<()>{
            walk_object(b,map,|k,g|{
                let gid=canonical_record(b,k,g)?;
                if self.grids+self.diffs>=GRID_LIMIT{return Err(denied("STORAGE_GRID_BOUND"));}
                if diff{
                    self.diffs+=1;
                    // Existing stored DiffGrid record verifies modified/removed
                    // identities and exact external metadata field types.
                    let m=record(b,SavedDiffGridIndexEntry{grid_id:gid,span:g})?;
                    if m.grid_default_layout_path.is_some()||m.default_layout_grid_id.is_some(){
                        self.external_layouts+=1;
                    }
                }else{self.grids+=1;}
                let field=if diff{"ModifiedObjects"}else{"Objects"};
                let Some(objects)=find_field(b,g,field)? else{
                    if diff{return Ok(());}else{return Err(denied("STORAGE_GRID_OBJECTS_REQUIRED"));}
                };
                let mut count=0;
                walk_object(b,objects,|k,o|{
                    self.objects+=1;count+=1;
                    if self.objects>MAX_OBJECTS||count>IDS_PER_GRID_LIMIT{return Err(denied("STORAGE_OBJECT_BOUND"));}
                    let oid=canonical_record(b,k,o)?;
                    let Some((state,storage))=storage_state(b,o)? else{return Ok(())};
                    let item=number(b,required(b,o,"ItemID")?)?;
                    if item==0||item>i32::MAX as u64{return Err(denied("STORAGE_ITEM_ID"));}
                    if let Some(d)=find_field(b,storage,"DefaultContainerInventoryData")?{
                        if !text_field(b,d)?.is_empty(){self.default_templates+=1;}
                    }
                    if let Some(cid)=find_field(b,storage,"ContainerInventoryID")?{
                        if let Some(id)=nullable_id(b,cid)?{
                            if id!=0{
                                if self.links.len()==MAX_LINKS{return Err(denied("STORAGE_LINK_BOUND"));}
                                self.links.push(Link{grid:gid,object:oid,item,container:id,diff,object_span:o,state,storage});
                            }
                        }
                    }
                    Ok(())
                })
            })
        }
    }
    fn candidate(b:&[u8],c:&Census,selector:Option<(u64,u64)>,profile:StorageProfile)->CoreResult<Link>{
        // First physical candidate only, or explicit exact composite selector.
        // A failed selected candidate does not silently fall back to another.
        let x=c.links.iter().find(|x|!x.diff&&x.item==profile.item()&&
            selector.map_or(true,|(g,o)|x.grid==g&&x.object==o))
            .copied().ok_or(denied("STORAGE_NO_PHYSICAL_CANDIDATE"))?;
        if x.container<=1||c.links.iter().filter(|y|y.container==x.container).count()!=1{
            return Err(denied("STORAGE_STORED_LINK_AMBIGUOUS"));
        }
        // Physical duplicate of selected composite in DiffGrids remains an
        // unresolved overlay even if the modified object has another state.
        let mut sole=true;
        walk_object(b,x.state,|k,s|{
            if k!="Storage"&&!raw(b,s,b"null"){sole=false;}
            Ok(())
        })?;
        if !sole{return Err(denied("STORAGE_STATE_ONEOF_UNRESOLVED"));}
        if !text_field(b,required(b,x.storage,"DefaultContainerInventoryData")?)?.is_empty(){
            return Err(denied("STORAGE_DEFAULT_TEMPLATE_NOT_CLEARED"));
        }
        if let Some(s)=find_field(b,x.storage,"UnlockKeyItemID")?{if number(b,s)?!=0{return Err(denied("STORAGE_UNLOCK_KEY"));}}
        if let Some(s)=find_field(b,x.storage,"UnlockLocId")?{if !text_field(b,s)?.is_empty(){return Err(denied("STORAGE_UNLOCK_LOCATION"));}}
        if let Some(s)=find_field(b,x.storage,"DesignID")?{if !raw(b,s,b"null"){return Err(denied("STORAGE_DESIGN_UNRESOLVED"));}}
        Ok(x)
    }
    fn slots(b:&[u8],s:Span,profile:StorageProfile)->CoreResult<Vec<Value>>{
        let mut out=Vec::new();
        walk_array(b,s,|v|{
            if out.len()==profile.capacity(){return Err(denied("STORAGE_PHYSICAL_SLOTS_BOUND"));}
            let item=number(b,required(b,v,"ItemID")?)?;
            let amt=number(b,required(b,v,"Amount")?)?;
            if item>i32::MAX as u64||amt>i32::MAX as u64||(item==0)!=(amt==0){
                return Err(denied("STORAGE_SLOT_ITEM_AMOUNT"));
            }
            let state=required(b,v,"State")?;
            let is_null=raw(b,state,b"null");
            if !is_null{
                if item==0{return Err(denied("STORAGE_EMPTY_SLOT_STATE"));}
                walk_object(b,state,|_,_|Ok(()))?;
            }
            out.push(json!({"position":out.len(),"itemId":item,"amount":amt,
                "stateExplicitNull":is_null,"stateSha256":digest(b,state),"entrySha256":digest(b,v)}));
            Ok(())
        })?;
        Ok(out)
    }
    fn project(b:&[u8],e:WorkerEnvelope,selector:Option<(u64,u64)>,profile:StorageProfile)->CoreResult<Value>{
        let item=profile.item();
        let roots=indexed_read::roots(b)?;
        let collection=required(b,roots.world,"GridCollection")?;
        let grids=required(b,collection,"Grids")?;
        let diffs=find_field(b,collection,"DiffGrids")?;
        let mut census=Census::new();
        census.scan(b,grids,false)?;
        if let Some(d)=diffs{census.scan(b,d,true)?;}
        let x=candidate(b,&census,selector,profile)?;
        // Do not assume saved Mod/Rem precedence or effective default grids.
        if let Some(d)=diffs{
            let mut overlay=false;
            walk_object(b,d,|k,g|{
                if key_id(k)?==x.grid{
                    let m=record(b,SavedDiffGridIndexEntry{grid_id:x.grid,span:g})?;
                    overlay=m.modified_object_ids.contains(&x.object)||m.removed_object_ids.contains(&x.object);
                }
                Ok(())
            })?;
            if overlay{return Err(denied("STORAGE_SELECTED_OVERLAY_AMBIGUOUS"));}
        }
        let o=x.object_span;
        let px=signed_hash(b,required(b,o,"X")?)?;
        let py=signed_hash(b,required(b,o,"Y")?)?;
        let ori=text_field(b,required(b,o,"Orientation")?)?;
        const ORIENTATIONS:[&str;16]=["GridOrientation_Up","GridOrientation_UpUpRight","GridOrientation_UpRight","GridOrientation_UpRightRight",
            "GridOrientation_Right","GridOrientation_DownRightRight","GridOrientation_DownRight","GridOrientation_DownDownRight",
            "GridOrientation_Down","GridOrientation_DownDownLeft","GridOrientation_DownLeft","GridOrientation_DownLeftLeft",
            "GridOrientation_Left","GridOrientation_UpLeftLeft","GridOrientation_UpLeft","GridOrientation_UpUpLeft"];
        if !ORIENTATIONS.contains(&ori.as_str()){return Err(denied("STORAGE_ORIENTATION"));}
        let containers=required(b,roots.player,"ContainerInventories")?;
        let mut chosen=None;let mut count=0;let mut max=0;
        let mut unmatched=Vec::new();
        let linked:BTreeSet<u64>=census.links.iter().map(|l|l.container).collect();
        let mut existing=BTreeSet::new();
        walk_object(b,containers,|k,v|{
            count+=1;
            if count>MAX_CONTAINERS{return Err(denied("STORAGE_CONTAINER_BOUND"));}
            let id=canonical_record(b,k,v)?;
            if id>i32::MAX as u64{return Err(denied("STORAGE_CONTAINER_ID_BOUND"));}
            existing.insert(id);max=max.max(id);
            if id==x.container{chosen=Some(v);}
            // A stored unmatched container is NOT a runtime orphan. Only
            // expose same-parent candidates and their immutable record hash.
            if id>1&&!linked.contains(&id){
                if let Some(p)=find_field(b,v,"ParentItemID")?{
                    if nullable_id(b,p)?==Some(item){
                        unmatched.push(json!({"containerId":id,"recordSha256":digest(b,v)}));
                    }
                }
            }
            Ok(())
        })?;
        if !linked.iter().all(|id|existing.contains(id)){return Err(denied("STORAGE_STORED_DANGLING_LINK"));}
        let c=chosen.ok_or(denied("STORAGE_CONTAINER_MISSING"))?;
        let next=number(b,required(b,roots.player,"NextContainerInventoryID")?)?;
        if next<=max||next>i32::MAX as u64{return Err(denied("STORAGE_COUNTER_UNRESOLVED"));}
        if number(b,required(b,c,"Size")?)?!=profile.capacity() as u64||number(b,required(b,c,"ExtraSize")?)?!=0||
           !boolean(b,required(b,c,"BelongsToPlayer")?)?||boolean(b,required(b,c,"BlockMoveTo")?)?||
           nullable_id(b,required(b,c,"ParentItemID")?)?!=Some(item){
            return Err(denied("STORAGE_CONTAINER_ROLE_OR_TEMPLATE"));
        }
        let arr=required(b,c,"Inventory")?;
        let slot_facts=slots(b,arr,profile)?;
        let lists=required(b,roots.player,"ListInventories")?;
        let mut catalog=None;let mut list_count=0usize;
        walk_object(b,lists,|k,v|{
            list_count+=1;
            if list_count>4096{return Err(denied("STORAGE_CATALOG_LIST_BOUND"));}
            let id=canonical_record(b,k,v)?;
            if id>u32::MAX as u64{return Err(denied("STORAGE_CATALOG_ID_BOUND"));}
            if id==0{catalog=Some(v);}
            Ok(())
        })?;
        let catalog=catalog.ok_or(denied("STORAGE_CATALOG_ZERO_ROLE"))?;
        if text_field(b,required(b,catalog,"CompatibleItemType")?)?!="ItemType_Furniture"{
            return Err(denied("STORAGE_CATALOG_ZERO_ROLE"));
        }
        let inventory=required(b,catalog,"Inventory")?;
        let mut entry=None;let mut item_count=0usize;
        walk_object(b,inventory,|k,v|{
            item_count+=1;
            if item_count>MAX_OBJECTS{return Err(denied("STORAGE_CATALOG_ITEM_BOUND"));}
            let id=key_id(k)?;
            if id==0||id>i32::MAX as u64{return Err(denied("STORAGE_CATALOG_ITEM_ID"));}
            if id==item{entry=Some(v);}
            Ok(())
        })?;
        let entry=entry.ok_or(denied("STORAGE_CATALOG_ITEM_MISSING"))?;
        let amount=number(b,required(b,entry,"Amount")?)?;
        if amount>i32::MAX as u64{return Err(denied("STORAGE_CATALOG_AMOUNT"));}
        // Presence and SHA only; no inference of ownership or runtime variation.
        let marker=optional_witness(b,find_field(b,entry,"Marker")?);
        let refs:Vec<Value>=census.links.iter().map(|l|json!({
            "gridId":l.grid,"objectId":l.object,"itemId":l.item,"containerId":l.container,
            "storedKind":if l.diff{"DiffGrids.ModifiedObjects"}else{"Grids.Objects"},
            "objectSha256":digest(b,l.object_span),"storageSha256":digest(b,l.storage)})).collect();
        let v=json!({"contract":profile.contract(),
            "platform":"SteamWindows","fullVersion":EXACT_STEAM_FULL_VERSION,"schema":626,
            "sessionId":hex(&e.session_id),"revision":e.expected_revision,"indexGeneration":e.expected_index_generation,
            "decodedSha256":hex(&e.expected_decoded_sha256),
            "selectionKind":if selector.is_some(){"EXPLICIT_PHYSICAL_COMPOSITE"}else{"FIRST_PHYSICAL_CANDIDATE"},
            "target":{"gridId":x.grid,"objectId":x.object,"itemId":item,"containerId":x.container,
                "x":px,"y":py,"orientation":ori,"objectSha256":digest(b,o),"stateSha256":digest(b,x.state),
                "storageSha256":digest(b,x.storage),"defaultTemplateCleared":true,
                "from":optional_witness(b,find_field(b,o,"From")?)},
            "container":{"recordSha256":digest(b,c),"mapSha256":digest(b,containers),"size":profile.capacity(),"extraSize":0,
                "belongsToPlayer":true,"blockMoveTo":false,"parentItemId":item,"physicalSlotCount":slot_facts.len(),
                "slotsSha256":digest(b,arr),"slots":slot_facts,"nextContainerInventoryId":next,"containerCount":count},
            "catalog":{"inventoryId":0,"itemId":item,"amount":amount,"marker":marker,"entrySha256":digest(b,entry),
                "routeSha256":digest(b,catalog)},
            "storedReferences":{"gridCollectionSha256":digest(b,collection),"worldSha256":digest(b,roots.world),
                "physicalGridCount":census.grids,"physicalDiffGridCount":census.diffs,"objectCount":census.objects,
                "diffGridsPresent":diffs.is_some(),"externalLayoutMetadataCount":census.external_layouts,
                "nonemptyStorageTemplateCount":census.default_templates,"links":refs,
                "sameParentStoredUnmatchedContainers":unmatched,"runtimeOrphanOrderVerified":false,
                "effectiveDefaultGridVerified":false,"effectiveSubgridParentClosureVerified":false,
                "allEffectiveReferencesVerified":false},
            "rightsVerified":false,"variationVerified":false,"initializedGeometryVerified":false,
            "nativeSubscriberClosureVerified":false,"nativeV3Verified":false,"productReadAccepted":false,
            "writerAuthorized":false,"editedCopyAuthorized":false,"applyAuthorized":false});
        if serde_json::to_vec(&v).map_err(|_|denied("STORAGE_RECEIPT_ENCODE"))?.len()>8*1024*1024{
            return Err(denied("STORAGE_RECEIPT_BOUND"));
        }
        Ok(v)
    }
    impl ProductSession{
        pub fn read_private_storage_stored_candidate(&self,e:WorkerEnvelope,selector:Option<(u64,u64)>)->CoreResult<Value>{
            self.check_saved_diffgrids_build()?;
            let st=self.lock()?;
            indexed_read::validate_scope(self,&st,&e)?;
            project(&self.decoded,e,selector,StorageProfile::Original16)
        }
        /// ACT591 exact White48, explicit physical composite only.
        pub fn read_private_storage48_white_stored(&self,e:WorkerEnvelope,grid:u64,object:u64)->CoreResult<Value>{
            self.check_saved_diffgrids_build()?;
            let st=self.lock()?;
            indexed_read::validate_scope(self,&st,&e)?;
            project(&self.decoded,e,Some((grid,object)),StorageProfile::White48)
        }
    }
    #[cfg(test)]
    mod tests{
        use super::*;
        use crate::{BuildIdentity,WorkerAction,PRODUCT_WORKER_CONTRACT};
        fn doc(n:usize)->Value{json!({"GameInfo":{"Version":626},"Player":{
            "NextContainerInventoryID":20,
            "ContainerInventories":{"12":{"ID":12,"ParentItemID":40000053,"BelongsToPlayer":true,"BlockMoveTo":false,
                "Size":16,"ExtraSize":0,"Inventory":vec![json!({"ItemID":0,"Amount":0,"State":null});n]},
                "13":{"ID":13,"ParentItemID":40000053}},
            "ListInventories":{"0":{"ID":0,"CompatibleItemType":"ItemType_Furniture","Inventory":{"40000053":{"Amount":0,"Marker":"ItemMarker_None"}}}}},
            "World":{"GridCollection":{"Grids":{"7":{"ID":7,"Objects":{"4":{"ID":4,"ItemID":40000053,"X":2,"Y":-1,
                "Orientation":"GridOrientation_Right","State":{"Storage":{"ContainerInventoryID":12,
                "DefaultContainerInventoryData":"","UnlockKeyItemID":0,"UnlockLocId":"","DesignID":null}}}}}},
                "DiffGrids":{"8":{"ID":8,"DefaultLayoutGridID":8,"ModifiedObjects":{},"RemovedObjects":[]}}}}})}
        fn open(d:&Value)->ProductSession{ProductSession::open_decoded_readonly(serde_json::to_vec(d).unwrap(),
            BuildIdentity{platform:Platform::SteamWindows,build_kind:BuildKind::SteamFullVersion,
                build_id:EXACT_STEAM_FULL_VERSION.into(),schema:626,externally_attested:true}).unwrap()}
        fn env(s:&ProductSession)->WorkerEnvelope{let r=s.receipt().unwrap();WorkerEnvelope{
            contract:PRODUCT_WORKER_CONTRACT,session_id:r.session_id,expected_revision:r.revision,
            expected_index_generation:r.index_generation,expected_decoded_sha256:r.decoded_sha256,action:WorkerAction::ReadDomain}}
        fn read(d:&Value)->CoreResult<Value>{let s=open(d);s.read_private_storage_stored_candidate(env(&s),None)}
        fn white(n:usize)->Value{
            let mut d=doc(n);
            let c=&mut d["Player"]["ContainerInventories"];
            c["12"]["Size"]=json!(48); c["12"]["ParentItemID"]=json!(WHITE48_ITEM);
            c["13"]["ParentItemID"]=json!(WHITE48_ITEM);
            let catalog=d["Player"]["ListInventories"]["0"]["Inventory"].as_object_mut().unwrap();
            let entry=catalog.remove("40000053").unwrap();catalog.insert("40001838".into(),entry);
            d["World"]["GridCollection"]["Grids"]["7"]["Objects"]["4"]["ItemID"]=json!(WHITE48_ITEM);
            d
        }
        fn read_white(d:&Value)->CoreResult<Value>{
            let s=open(d);s.read_private_storage48_white_stored(env(&s),7,4)
        }
        #[test]
        fn white48_exact_profile_and_old16_are_disjoint(){
            for n in [0,1,48]{
                let mut d=white(n);
                if n>0{d["Player"]["ContainerInventories"]["12"]["Inventory"][0]=
                    json!({"ItemID":30200001,"Amount":3,"State":{"Unknown":7},"Opaque":9});}
                let s=open(&d);let before=s.receipt().unwrap();
                let v=s.read_private_storage48_white_stored(env(&s),7,4).unwrap();
                assert_eq!(v["contract"],"wand.native.private.storage48-white-stored-readset@1");
                assert_eq!(v["target"]["itemId"],WHITE48_ITEM);assert_eq!(v["container"]["size"],48);
                assert_eq!(v["container"]["physicalSlotCount"],n);
                assert_eq!(v["container"]["slots"].as_array().unwrap().len(),n);
                assert_eq!(v["catalog"]["itemId"],WHITE48_ITEM);
                assert_eq!(v["storedReferences"]["sameParentStoredUnmatchedContainers"][0]["containerId"],13);
                assert_eq!(v["writerAuthorized"],false);assert_eq!(s.receipt().unwrap(),before);
                assert!(s.read_private_storage_stored_candidate(env(&s),Some((7,4))).is_err());
                assert!(s.read_private_storage48_white_stored(env(&s),8,4).is_err());
                assert!(open(&d).read_private_storage48_white_stored(env(&s),7,4).is_err());
                let mut stale=env(&s);stale.expected_revision+=1;
                assert!(s.read_private_storage48_white_stored(stale,7,4).is_err());
                if n>0{
                    assert_eq!(v["container"]["slots"][0]["stateSha256"],
                        hex(&Sha256::digest(br#"{"Unknown":7}"#)));
                }
            }
            assert!(read_white(&doc(16)).is_err());
            assert_eq!(read(&doc(16)).unwrap()["container"]["size"],16);
        }
        #[test]
        fn white48_wrong_target_capacity_and_existing_guards_deny(){
            assert!(read_white(&white(49)).is_err());
            for (f,v) in [("Size",json!(16)),("Size",json!(49)),("ParentItemID",json!(40000053)),
                ("ExtraSize",json!(1)),("BelongsToPlayer",json!(false)),("BlockMoveTo",json!(true))]{
                let mut d=white(0);d["Player"]["ContainerInventories"]["12"][f]=v;assert!(read_white(&d).is_err(),"{f}");
            }
            let mut d=white(0);d["World"]["GridCollection"]["Grids"]["7"]["Objects"]["4"]["ItemID"]=json!(40001839);
            assert!(read_white(&d).is_err());
            let mut d=white(0);d["World"]["GridCollection"]["DiffGrids"]["7"]=json!({"ID":7,"RemovedObjects":[4]});
            assert!(read_white(&d).is_err());
            let mut d=white(0);d["World"]["GridCollection"]["Grids"]["7"]["Objects"]["4"]["State"]["Storage"]["DefaultContainerInventoryData"]=json!("Furniture_48Slot");
            assert!(read_white(&d).is_err());
            let mut d=white(0);d["Player"]["ContainerInventories"].as_object_mut().unwrap().remove("12");
            assert!(read_white(&d).is_err());
            let mut d=white(0);d["Player"]["ListInventories"]["0"]["Inventory"].as_object_mut().unwrap().remove("40001838");
            assert!(read_white(&d).is_err());
        }
        #[test]
        fn preserves_physical_count_and_unknown_effective_layout(){
            for n in [0,15,16]{let mut d=doc(n);if n>0{d["Player"]["ContainerInventories"]["12"]["Inventory"][0]=json!({"ItemID":30200001,"Amount":3,"State":{"Unknown":7},"Opaque":9});}
                let s=open(&d);let before=s.receipt().unwrap();let v=s.read_private_storage_stored_candidate(env(&s),Some((7,4))).unwrap();
                assert_eq!(v["container"]["physicalSlotCount"],n);assert_eq!(v["catalog"]["amount"],0);
                assert_eq!(v["storedReferences"]["sameParentStoredUnmatchedContainers"][0]["containerId"],13);
                assert_eq!(v["storedReferences"]["allEffectiveReferencesVerified"],false);
                assert_eq!(v["storedReferences"]["externalLayoutMetadataCount"],1);
                assert_eq!(v["writerAuthorized"],false);assert_eq!(s.receipt().unwrap(),before);
                assert!(s.read_private_storage_stored_candidate(env(&s),Some((8,4))).is_err());
                let mut e=env(&s);e.expected_revision+=1;assert!(s.read_private_storage_stored_candidate(e,None).is_err());
                assert!(open(&d).read_private_storage_stored_candidate(env(&s),None).is_err());
                let e=env(&s);s.close().unwrap();assert!(s.read_private_storage_stored_candidate(e,None).is_err());
            }
        }
        #[test]
        fn stored_ambiguity_and_wrong_physical_contract_denied(){
            assert!(read(&doc(17)).is_err());
            for (f,v) in [("Size",json!(15)),("ExtraSize",json!(1)),("ParentItemID",json!(40000054)),
                ("BelongsToPlayer",json!(false)),("BlockMoveTo",json!(true)),("ID",json!(13))]{
                let mut d=doc(0);d["Player"]["ContainerInventories"]["12"][f]=v;assert!(read(&d).is_err(),"{f}");
            }
            let mut d=doc(0);d["World"]["GridCollection"]["Grids"]["7"]["Objects"]["4"]["State"]["Storage"]["DefaultContainerInventoryData"]=json!("Furniture_16Slot");assert!(read(&d).is_err());
            let mut d=doc(0);d["World"]["GridCollection"]["DiffGrids"]["8"]["ModifiedObjects"]["9"]=json!({"ID":9,"ItemID":40000053,"State":{"Storage":{"ContainerInventoryID":12}}});assert!(read(&d).is_err());
            let mut d=doc(0);d["World"]["GridCollection"]["DiffGrids"]["7"]=json!({"ID":7,"RemovedObjects":[4]});assert!(read(&d).is_err());
            let mut d=doc(0);d["Player"]["NextContainerInventoryID"]=json!(12);assert!(read(&d).is_err());
            let mut d=doc(1);d["Player"]["ContainerInventories"]["12"]["Inventory"][0]["State"]=json!({});assert!(read(&d).is_err());
            let mut d=doc(0);d["Player"]["ListInventories"]["0"]["ID"]=json!(1);assert!(read(&d).is_err());
            let mut d=doc(0);d["Player"]["ListInventories"]["00"]=json!({"ID":0});assert!(read(&d).is_err());
            let mut d=doc(0);d["Player"]["ListInventories"]["0"]["Inventory"]["040000053"]=json!({"Amount":0});assert!(read(&d).is_err());
            let mut d=doc(0);d["World"]["GridCollection"]["Grids"]["07"]=json!({"ID":7,"Objects":{}});assert!(read(&d).is_err());
            let mut d=doc(0);d["World"]["GridCollection"]["Grids"]["7"]["Objects"]["4"]["State"]["Other"]=json!({});assert!(read(&d).is_err());
        }
    }
}
