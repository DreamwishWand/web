//! 01A / R04: bounded native-only Area -> GridID structural reference slice.
//! Borrows the ONE ProductSession decoded buffer and the accepted indexed
//! lexical scanner. This is not a second Reader, a geometry validator, V3,
//! a product Consumer, nor an all-domain Native reference closure.
use super::{ProductSession, WorkerEnvelope};
use super::indexed_read::{roots, skip_ws, string_end, value_end, validate_scope, Span};
use crate::{CoreError,CoreResult};
use std::collections::{BTreeSet,HashMap};

const MAX_KEY_BYTES: usize=128;
const MAX_RECORDS: usize=1_000_000;
const JS_SAFE_INTEGER: u64=9_007_199_254_740_991;
fn fail(s:&'static str)->CoreError{CoreError(s)}
fn number(bytes:&[u8],span:Span)->CoreResult<u64>{
    let n: u64=serde_json::from_slice(&bytes[span.begin..span.end])
        .map_err(|_|fail("NATIVE_REF_TYPED_INTEGER_REQUIRED"))?;
    if n>JS_SAFE_INTEGER{return Err(fail("NATIVE_REF_INTEGER_BOUNDS"));}
    Ok(n)
}
fn canonical_key(key:&str)->CoreResult<u64>{
    if key.is_empty()||key.len()>20||key.as_bytes().iter().any(|b|!b.is_ascii_digit()){
        return Err(fail("NATIVE_REF_NONCANONICAL_KEY"));
    }
    let n=key.parse::<u64>().map_err(|_|fail("NATIVE_REF_KEY_OVERFLOW"))?;
    if n>JS_SAFE_INTEGER||n.to_string()!=key{
        return Err(fail("NATIVE_REF_NONCANONICAL_KEY"));
    }
    Ok(n)
}
fn count(n:&mut usize)->CoreResult<()>{
    *n=n.checked_add(1).ok_or(fail("NATIVE_REF_COUNT_OVERFLOW"))?;
    if *n>MAX_RECORDS{return Err(fail("NATIVE_REF_COUNT_BOUNDS"));}
    Ok(())
}
// The strict whole-document JSON validator ran before ProductSession opened.
// This walker reuses the already-accepted lexical span parser, never builds a
// serde_json::Value tree or exports original text to JS/UI.
fn object<F>(b:&[u8],s:Span,mut visit:F)->CoreResult<()>
where F:FnMut(String,Span)->CoreResult<()>{
    if b.get(s.begin)!=Some(&b'{')||b.get(s.end-1)!=Some(&b'}'){
        return Err(fail("NATIVE_REF_OBJECT_REQUIRED"));
    }
    let mut i=s.begin+1;
    loop{
        i=skip_ws(b,i);
        if i==s.end-1{return Ok(());}
        let begin=i;
        let end=string_end(b,i)?;
        if end-begin>MAX_KEY_BYTES{return Err(fail("NATIVE_REF_KEY_BOUNDS"));}
        let key:String=serde_json::from_slice(&b[begin..end])
            .map_err(|_|fail("NATIVE_REF_KEY_INVALID"))?;
        i=skip_ws(b,end);
        if b.get(i)!=Some(&b':'){return Err(fail("NATIVE_REF_COLON"));}
        i=skip_ws(b,i+1);
        let last=value_end(b,i)?;
        if last>=s.end{return Err(fail("NATIVE_REF_OUTSIDE_OBJECT"));}
        visit(key,Span{begin:i,end:last})?;
        i=skip_ws(b,last);
        match b.get(i){
            Some(b',')=>i+=1,
            Some(b'}') if i==s.end-1=>return Ok(()),
            _=>return Err(fail("NATIVE_REF_OBJECT_DELIMITER")),
        }
    }
}
fn array<F>(b:&[u8],s:Span,mut visit:F)->CoreResult<()>
where F:FnMut(Span)->CoreResult<()>{
    if b.get(s.begin)!=Some(&b'[')||b.get(s.end-1)!=Some(&b']'){
        return Err(fail("NATIVE_REF_ARRAY_REQUIRED"));
    }
    let mut i=s.begin+1;
    loop{
        i=skip_ws(b,i);
        if i==s.end-1{return Ok(());}
        let end=value_end(b,i)?;
        if end>=s.end{return Err(fail("NATIVE_REF_OUTSIDE_ARRAY"));}
        visit(Span{begin:i,end})?;
        i=skip_ws(b,end);
        match b.get(i){
            Some(b',')=>i+=1,
            Some(b']') if i==s.end-1=>return Ok(()),
            _=>return Err(fail("NATIVE_REF_ARRAY_DELIMITER")),
        }
    }
}
fn field(b:&[u8],s:Span,name:&str)->CoreResult<Option<Span>>{
    let mut result=None;
    object(b,s,|key,val|{
        if key==name {
            if result.replace(val).is_some(){return Err(fail("NATIVE_REF_FIELD_DUPLICATE"));}
        }
        Ok(())
    })?;
    Ok(result)
}
fn required(b:&[u8],s:Span,name:&str)->CoreResult<Span>{
    field(b,s,name)?.ok_or(fail("NATIVE_REF_REQUIRED_FIELD_MISSING"))
}
/// Only direct village Area/Grid + optional FloatingIsland/Grid structural links,
/// and per-Grid ObjectID identity. Map absence remains UNKNOWN, never 0 verified.
/// Other World refs (Group, SubGrid, Footprint, Quest, Clock etc.) are UNKNOWN.
#[derive(Clone,Copy,Debug,PartialEq,Eq)]
pub struct NativeAreaGridSliceReceipt {
    pub session_id:[u8;16],
    pub revision:u64,
    pub index_generation:u64,
    pub decoded_sha256:[u8;32],
    pub village_records:usize,
    pub area_records:usize,
    pub grid_records:usize,
    pub direct_area_grid_links:usize,
    pub grid_object_identity_records:usize,
    pub floating_island_map_present:bool,
    pub floating_island_records:usize,
    pub floating_island_direct_grid_links:usize,
    pub direct_root_ownership_unique:bool,
    pub full_native_reference_closure_verified:bool,
    pub area_group_footprint_verified:bool,
    pub native_v3_verified:bool,
    pub product_read_accepted:bool,
    pub writer_authorized:bool,
}
impl ProductSession {
    /// Opt-in, PRIVATE NATIVE feature only. No UI cursor or client-supplied
    /// path/readset; a Rust-owned Session/Revision/Generation/SHA CAS is required.
    /// The mutex linearizes the scan against Close/Stage/Undo/Redo.
    pub fn verify_native_area_grid_slice(
        &self,scope:WorkerEnvelope
    )->CoreResult<NativeAreaGridSliceReceipt>{
        let state=self.lock()?;
        validate_scope(self,&state,&scope)?;
        // The existing index scanner supplies the World root span.
        let b:&[u8]=&self.decoded;
        let world=roots(b)?.world;
        let grid_collection=required(b,world,"GridCollection")?;
        let grids=required(b,grid_collection,"Grids")?;
        let villages=required(b,world,"Villages")?;
        let mut grid_ids=HashMap::<u64,()>::new();
        let mut grid_count=0;
        let mut object_count=0;
        object(b,grids,|key,grid|{
            count(&mut grid_count)?;
            let id=canonical_key(&key)?;
            if number(b,required(b,grid,"ID")?)?!=id{
                return Err(fail("NATIVE_REF_GRID_KEY_ID_MISMATCH"));
            }
            if grid_ids.insert(id,()).is_some(){
                return Err(fail("NATIVE_REF_DUPLICATE_GRID_ID"));
            }
            if let Some(objects)=field(b,grid,"Objects")?{
                let mut per_grid=BTreeSet::new();
                object(b,objects,|key,item|{
                    count(&mut object_count)?;
                    let id=canonical_key(&key)?;
                    if number(b,required(b,item,"ID")?)?!=id{
                        return Err(fail("NATIVE_REF_OBJECT_KEY_ID_MISMATCH"));
                    }
                    if !per_grid.insert(id){
                        return Err(fail("NATIVE_REF_DUPLICATE_OBJECT_ID"));
                    }
                    Ok(())
                })?;
            }
            Ok(())
        })?;
        let mut village_count=0;
        let mut area_count=0;
        let mut links=0;
        // This is a conservative direct-root key uniqueness check only.
        // It does not infer Native Area/Island/Group layout semantics.
        let mut owned_direct_root_ids=BTreeSet::<u64>::new();
        array(b,villages,|village|{
            count(&mut village_count)?;
            if let Some(areas)=field(b,village,"Areas")?{
                object(b,areas,|area_key,area|{
                    count(&mut area_count)?;
                    canonical_key(&area_key)?;
                    let grid_array=required(b,area,"GridIDs")?;
                    let mut within_area=BTreeSet::new();
                    array(b,grid_array,|value|{
                        count(&mut links)?;
                        let id=number(b,value)?;
                        if !grid_ids.contains_key(&id){
                            return Err(fail("NATIVE_REF_ORPHAN_AREA_GRID"));
                        }
                        if !within_area.insert(id){
                            return Err(fail("NATIVE_REF_DUPLICATE_AREA_GRID_LINK"));
                        }
                        if !owned_direct_root_ids.insert(id){
                            return Err(fail("NATIVE_REF_CROSS_LOCATION_ROOT_ALIAS"));
                        }
                        Ok(())
                    })?;
                    Ok(())
                })?;
            }
            Ok(())
        })?;
        // FloatingIslands is optional in a strict document. Its absence is
        // explicitly UNKNOWN rather than a zero-record complete-domain proof.
        // Present records MUST have exact SceneItemId/key and typed GridIDs.
        // No assumption is made that an empty/locked Island is a usable route.
        let floating_map=field(b,world,"FloatingIslands")?;
        let mut floating_records=0usize;
        let mut floating_links=0usize;
        if let Some(floating)=floating_map {
            object(b,floating,|key,island|{
                count(&mut floating_records)?;
                let scene_id=canonical_key(&key)?;
                if scene_id==0 {return Err(fail("NATIVE_REF_ISLAND_SCENE_ID_ZERO"));}
                if number(b,required(b,island,"SceneItemId")?)?!=scene_id{
                    return Err(fail("NATIVE_REF_ISLAND_SCENE_KEY_ID_MISMATCH"));
                }
                let direct=required(b,island,"GridIDs")?;
                let mut local=BTreeSet::new();
                array(b,direct,|raw|{
                    count(&mut floating_links)?;
                    let grid_id=number(b,raw)?;
                    if !grid_ids.contains_key(&grid_id){
                        return Err(fail("NATIVE_REF_ORPHAN_FLOATING_GRID"));
                    }
                    if !local.insert(grid_id){
                        return Err(fail("NATIVE_REF_DUPLICATE_FLOATING_GRID_LINK"));
                    }
                    if !owned_direct_root_ids.insert(grid_id){
                        return Err(fail("NATIVE_REF_CROSS_LOCATION_ROOT_ALIAS"));
                    }
                    Ok(())
                })?;
                Ok(())
            })?;
        }
        Ok(NativeAreaGridSliceReceipt{
            session_id:state.id,revision:state.revision,
            index_generation:state.generation,decoded_sha256:self.sha,
            village_records:village_count,area_records:area_count,
            grid_records:grid_count,direct_area_grid_links:links,
            grid_object_identity_records:object_count,
            floating_island_map_present:floating_map.is_some(),
            floating_island_records:floating_records,
            floating_island_direct_grid_links:floating_links,
            direct_root_ownership_unique:floating_map.is_some(),
            full_native_reference_closure_verified:false,
            area_group_footprint_verified:false,native_v3_verified:false,
            product_read_accepted:false,writer_authorized:false,
        })
    }
}
#[cfg(test)]
mod tests{
    use super::*;
    use crate::{BuildIdentity,BuildKind,Platform,WorkerAction,PRODUCT_WORKER_CONTRACT};
    const VALID:&str=r#"{"GameInfo":{"Version":626},"Player":{},"World":{"Villages":[{"Areas":{"1":{"GridIDs":[7]}}}],"GridCollection":{"Grids":{"7":{"ID":7,"Objects":{"4":{"ID":4,"ItemID":100}}}}}}}"#;
    fn session(s:&str)->ProductSession{
        ProductSession::open_decoded_readonly(s.as_bytes().to_vec(),BuildIdentity{
            platform:Platform::SteamWindows,build_kind:BuildKind::SteamFullVersion,
            build_id:"releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22".into(),
            schema:626,externally_attested:true
        }).unwrap()
    }
    fn scope(s:&ProductSession)->WorkerEnvelope{
        let r=s.receipt().unwrap();
        WorkerEnvelope{
            contract:PRODUCT_WORKER_CONTRACT,session_id:r.session_id,
            expected_revision:r.revision,expected_index_generation:r.index_generation,
            expected_decoded_sha256:r.decoded_sha256,action:WorkerAction::ReadDomain,
        }
    }
    #[test]
    fn real_scanner_direct_area_to_grid_and_object_identity_only(){
        let s=session(VALID);
        let r=s.verify_native_area_grid_slice(scope(&s)).unwrap();
        assert_eq!((r.village_records,r.area_records,r.grid_records,r.direct_area_grid_links,r.grid_object_identity_records),(1,1,1,1,1));
        assert!(!r.full_native_reference_closure_verified&&!r.area_group_footprint_verified&&!r.native_v3_verified&&!r.product_read_accepted&&!r.writer_authorized);
    }
    #[test]
    fn orphan_duplicate_malformed_and_unknown_ids_fail_closed(){
        let cases=[
            VALID.replace("\"GridIDs\":[7]","\"GridIDs\":[8]"),
            VALID.replace("\"GridIDs\":[7]","\"GridIDs\":[7,7]"),
            VALID.replace("\"GridIDs\":[7]","\"GridIDs\":[\"7\"]"),
            VALID.replace("\"GridIDs\":[7]","\"GridIDs\":null"),
            VALID.replace("\"7\":{\"ID\":7","\"7\":{\"ID\":6"),
            VALID.replace("\"4\":{\"ID\":4","\"4\":{\"ID\":5"),
            VALID.replace("\"4\":{\"ID\":4,\"ItemID\":100}","\"4\":{\"ID\":4},\"04\":{\"ID\":4}"),
            VALID.replace("\"1\":{\"GridIDs\"","\"01\":{\"GridIDs\""),
            VALID.replace("\"Villages\":[{\"Areas\":{\"1\":{\"GridIDs\":[7]}}}]","\"Villages\":{}"),
        ];
        for input in cases {
            let s=session(&input);
            assert!(s.verify_native_area_grid_slice(scope(&s)).is_err(),"bad scoped record must deny");
        }
    }
    #[test]
    fn floating_island_direct_grid_links_are_typed_and_scoped_only(){
        let with_other_grid=VALID.replace(
            "\"7\":{\"ID\":7,\"Objects\":{\"4\":{\"ID\":4,\"ItemID\":100}}}",
            "\"7\":{\"ID\":7,\"Objects\":{\"4\":{\"ID\":4,\"ItemID\":100}}},\"8\":{\"ID\":8,\"Objects\":{}}"
        );
        let valid=with_other_grid.replace(
            "\"GridCollection\":",
            "\"FloatingIslands\":{\"1540000147\":{\"SceneItemId\":1540000147,\"GridIDs\":[8]}},\"GridCollection\":"
        );
        let s=session(&valid);
        let got=s.verify_native_area_grid_slice(scope(&s)).unwrap();
        assert!(got.floating_island_map_present&&got.direct_root_ownership_unique);
        assert_eq!((got.floating_island_records,got.floating_island_direct_grid_links),(1,1));
        assert!(!got.full_native_reference_closure_verified);
        assert!(!got.area_group_footprint_verified&&!got.native_v3_verified);
        assert!(!got.product_read_accepted&&!got.writer_authorized);
        let bad=[
            valid.replace("\"GridIDs\":[8]","\"GridIDs\":[9]"), // orphan
            valid.replace("\"GridIDs\":[8]","\"GridIDs\":[8,8]"), // duplicate
            valid.replace("\"GridIDs\":[8]","\"GridIDs\":[7]"), // cross Area
            valid.replace("\"GridIDs\":[8]","\"GridIDs\":[\"8\"]"), // type
            valid.replace("\"GridIDs\":[8]","\"GridIDs\":null"), // unknown
            valid.replace("\"SceneItemId\":1540000147","\"SceneItemId\":1540000148"),
            valid.replace("\"1540000147\":{\"SceneItemId\"","\"01540000147\":{\"SceneItemId\""),
            valid.replace("\"FloatingIslands\":{","\"FloatingIslands\":["), // wrong map
        ];
        for input in bad {
            // Invalid entire-document syntax is a valid strict-open denial.
            if let Ok(rejected)=ProductSession::open_decoded_readonly(
                input.into_bytes(),BuildIdentity{
                    platform:Platform::SteamWindows,build_kind:BuildKind::SteamFullVersion,
                    build_id:"releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22".into(),
                    schema:626,externally_attested:true
                }
            ){
                assert!(rejected.verify_native_area_grid_slice(scope(&rejected)).is_err());
            }
        }
        let missing=session(VALID);
        let m=missing.verify_native_area_grid_slice(scope(&missing)).unwrap();
        assert!(!m.floating_island_map_present&&!m.direct_root_ownership_unique);
        assert_eq!(m.floating_island_records,0);
    }
    #[test]
    fn shared_root_between_two_village_areas_is_conservatively_denied(){
        let two=VALID.replace(
            "\"1\":{\"GridIDs\":[7]}",
            "\"1\":{\"GridIDs\":[7]},\"2\":{\"GridIDs\":[7]}"
        );
        let s=session(&two);
        assert!(s.verify_native_area_grid_slice(scope(&s)).is_err());
    }
    #[test]
    fn foreign_stale_action_and_closed_session_fail_closed(){
        let s=session(VALID);
        let e=scope(&s);
        let mut stale=e;stale.expected_revision+=1;
        assert!(s.verify_native_area_grid_slice(stale).is_err());
        let mut invalid=e;invalid.expected_index_generation+=1;
        assert!(s.verify_native_area_grid_slice(invalid).is_err());
        let mut forbidden=e;forbidden.action=WorkerAction::Stage;
        assert!(s.verify_native_area_grid_slice(forbidden).is_err());
        let other=session(VALID);
        assert!(s.verify_native_area_grid_slice(scope(&other)).is_err());
        s.close().unwrap();
        assert!(s.verify_native_area_grid_slice(e).is_err());
    }
}
