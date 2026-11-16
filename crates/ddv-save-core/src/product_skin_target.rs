//! Internal static-catalog and same-session Skin candidate preparation, NOT Stage.
//! Static pack SHA256 11a9512f27c0394bff4224c1fac12a9fc622c8be2e5cc8e716f6fbe61dff47d6.
//! Three static catalog matches are candidates only; final fixed accepted operation
//! admission is separate. No private plan, entitlement grant or effective flag claim.
use super::*;
use super::appearance_observer::*;
use serde_json::Value;
// Exact catalog-only projection of the three matching rows, not Save-derived IDs.
const CHARACTER:i32=10000053;
const ORDINARY_NEW:i32=170000000;
const STATIC_OLD:[i32;3]=[170000027,170000054,170000108];
const CONDITION_FLAG:i32=2030500265;
pub(super) struct SkinCandidate{
    pub(super) scope:WorkerEnvelope,pub(super) span:Span,
    pub(super) character:i32,pub(super) old:i32,pub(super) new:i32,
    pub(super) base_sha:String,pub(super) character_sha:String,pub(super) old_token_sha:String,
    pub(super) characters_sha:String,pub(super) inventory_sha:String,
    pub(super) old_stock:Value,pub(super) new_stock:Value,pub(super) flags:Value,
}
impl ProductSession{
    pub(super) fn prepare_product_skin_candidate(&self,e:WorkerEnvelope,character:i32,new:i32)->CoreResult<SkinCandidate>{
        self.prepare_product_skin_candidate_for(e,character,new,AppearanceBuildScope::Steam626)
    }
    fn prepare_product_skin_candidate_for(&self,e:WorkerEnvelope,character:i32,new:i32,scope:AppearanceBuildScope)->CoreResult<SkinCandidate>{
        product_appearance_scope_for(self,&e,scope)?;
        let st=self.lock()?;validate_scope(self,&st,&e)?;
        if character!=CHARACTER||new!=ORDINARY_NEW{return Err(denied("SKIN_PRODUCT_CATALOG_SCOPE"));}
        let b=&self.decoded;let roots=roots(b)?;let world=members(b,roots.world,1024)?;let player=members(b,roots.player,1024)?;
        let chars=required(&world,"Characters")?;let (_,character_span,base)=character_span(b,chars,character)?;
        let fs=members(b,character_span,128)?;let span=required(&fs,"SkinID")?;
        let old=int(b,span)?;
        if !STATIC_OLD.contains(&old)||old==new{return Err(denied("SKIN_PRODUCT_CATALOG_PAIR"));}
        let lists=required(&player,"ListInventories")?;
        let os=skin_inventory(b,lists,old)?;let ns=skin_inventory(b,lists,new)?;
        for x in [&os,&ns]{
            if x["inventoryId"]!=7||x["compatibleItemType"]!="ItemType_Skin"||
                x["savedAmount"].as_i64().unwrap_or(0)<=0||x["markerPresent"]!=true||
                x["savedMarker"]!="ItemMarker_None"||!x["markerSha256"].is_string(){
                return Err(denied("SKIN_PRODUCT_STOCK_ROUTE_MARKER"));}
        }
        let flags=skin_dialogue_flags(b,field(&world,"DialogueFlags"),CONDITION_FLAG)?;
        if flags["persistedMembership"]!=true||flags["targetPositions"].as_array().map_or(true,|x|x.len()!=1){
            return Err(denied("SKIN_PRODUCT_PERSISTED_FLAG_SCOPE"));}
        // Effective override remains unknown; do not replay events or grant stock.
        Ok(SkinCandidate{scope:e,span,character,old,new,base_sha:sha(&b[base.begin..base.end]),
            character_sha:sha(&b[character_span.begin..character_span.end]),old_token_sha:sha(&b[span.begin..span.end]),
            characters_sha:sha(&b[chars.begin..chars.end]),inventory_sha:sha(&b[lists.begin..lists.end]),old_stock:os,new_stock:ns,flags})
    }
}
// Fixed catalog operation policy; the other static matches are NOT approved.
// Still no Stage/Writer authorization or condition-runtime claim.
const FIXED_OLD:i32=170000054;
impl ProductSession {
    pub(super) fn prepare_fixed_product_skin_candidate(&self,e:WorkerEnvelope,character:i32,new:i32)->CoreResult<SkinCandidate>{
        self.prepare_fixed_product_skin_candidate_for(e,character,new,AppearanceBuildScope::Steam626)
    }
    pub(super) fn prepare_fixed_product_skin_candidate_for(&self,e:WorkerEnvelope,character:i32,new:i32,scope:AppearanceBuildScope)->CoreResult<SkinCandidate>{
        let t=self.prepare_product_skin_candidate_for(e,character,new,scope)?;
        if t.old!=FIXED_OLD{return Err(denied("SKIN_FIXED_OLD_SCOPE"));}
        Ok(t)
    }
}
// Internal typed Stage candidate; no product dispatch/entitlement or condition
// runtime authority. The current applicable closure is required before ABI use.
#[cfg(feature="semantic-writer-dev")]
impl ProductSession{
    pub(super) fn project_fixed_skin_candidate(&self,e:WorkerEnvelope,character:i32,new:i32)->CoreResult<[u8;32]>{
        let t=self.prepare_fixed_product_skin_candidate(e,character,new)?;
        self.project_appearance_scalar_candidate(t.span,t.old,t.new)
    }
    pub(super) fn stage_fixed_skin_candidate(&self,e:WorkerEnvelope,character:i32,new:i32,old:i32,
        old_sha:&str,character_sha:&str,inventory_sha:&str,projected:[u8;32])->CoreResult<crate::SemanticStageReceipt>{
        if e.action!=WorkerAction::Stage{return Err(denied("SKIN_PRODUCT_STAGE_ACTION"));}
        let t=self.prepare_fixed_product_skin_candidate(WorkerEnvelope{action:WorkerAction::ReadDomain,..e},character,new)?;
        if t.old!=old||t.old_token_sha!=old_sha||t.character_sha!=character_sha||t.inventory_sha!=inventory_sha{
            return Err(denied("SKIN_PRODUCT_STAGE_CAS"));}
        self.commit_appearance_scalar_candidate(e,t.span,t.old,t.new,projected)
    }
}
#[cfg(test)]
mod tests{
    use super::*;use crate::{BuildIdentity,BuildKind,Platform};use serde_json::json;
    fn doc(old:i32)->Value{let key=old.to_string();let mut inv=serde_json::Map::new();
        inv.insert(key,json!({"Amount":1,"Marker":"ItemMarker_None"}));inv.insert(ORDINARY_NEW.to_string(),json!({"Amount":2,"Marker":"ItemMarker_None"}));
        json!({"GameInfo":{"Version":626},"Player":{"ListInventories":{"7":{"ID":7,"CompatibleItemType":"ItemType_Skin","Inventory":inv}}},
            "World":{"Characters":[{"Base":{"id":CHARACTER},"SkinID":old,"Unknown":{"keep":7}}],"DialogueFlags":[CONDITION_FLAG]}})}
    fn open(d:Value)->ProductSession{let mut s=ProductSession::open_decoded_readonly(serde_json::to_vec(&d).unwrap(),
        BuildIdentity{platform:Platform::SteamWindows,build_kind:BuildKind::SteamFullVersion,build_id:APPEARANCE_BUILD.into(),schema:626,externally_attested:true}).unwrap();
        s.worker_bound=true;s}
    fn env(s:&ProductSession)->WorkerEnvelope{let r=s.receipt().unwrap();WorkerEnvelope{contract:PRODUCT_WORKER_CONTRACT,
        session_id:r.session_id,expected_revision:r.revision,expected_index_generation:r.index_generation,expected_decoded_sha256:r.decoded_sha256,action:WorkerAction::ReadDomain}}
    #[test]fn product_skin_catalog_only_current_candidates(){
        for old in STATIC_OLD{let s=open(doc(old));let e=env(&s);let before=s.receipt().unwrap();
            let t=s.prepare_product_skin_candidate(e,CHARACTER,ORDINARY_NEW).unwrap();
            assert_eq!((t.character,t.old,t.new),(CHARACTER,old,ORDINARY_NEW));
            assert_eq!(&s.decoded[t.span.begin..t.span.end],old.to_string().as_bytes());
            assert_eq!(t.scope.session_id,e.session_id);assert_eq!(t.old_stock["savedAmount"],1);assert_eq!(t.new_stock["savedAmount"],2);
            assert_eq!(t.flags["effectiveFlagVerified"],false);assert_eq!(t.old_token_sha,sha(old.to_string().as_bytes()));
            assert!([&t.base_sha,&t.character_sha,&t.characters_sha,&t.inventory_sha].iter().all(|x|x.len()==64));
            assert_eq!(s.receipt().unwrap(),before);
            assert!(s.prepare_product_skin_candidate(e,CHARACTER+1,ORDINARY_NEW).is_err());
            assert!(s.prepare_product_skin_candidate(e,CHARACTER,old).is_err());
            let mut stale=e;stale.expected_index_generation+=1;assert!(s.prepare_product_skin_candidate(stale,CHARACTER,ORDINARY_NEW).is_err());
            let foreign=open(doc(old));assert!(foreign.prepare_product_skin_candidate(e,CHARACTER,ORDINARY_NEW).is_err());
            s.close().unwrap();assert!(s.prepare_product_skin_candidate(e,CHARACTER,ORDINARY_NEW).is_err());
        }
    }
    #[test]fn product_skin_fixed_scope_not_three_static_pairs(){
        for old in STATIC_OLD{
            let s=open(doc(old));let e=env(&s);let before=s.receipt().unwrap();
            assert_eq!(s.prepare_fixed_product_skin_candidate(e,CHARACTER,ORDINARY_NEW).is_ok(),old==FIXED_OLD);
            assert!(s.prepare_fixed_product_skin_candidate(e,CHARACTER+1,ORDINARY_NEW).is_err());
            assert!(s.prepare_fixed_product_skin_candidate(e,CHARACTER,old).is_err());
            assert_eq!(s.receipt().unwrap(),before);
        }
    }
    #[cfg(feature="semantic-writer-dev")]
    #[test]fn product_skin_fixed_exact1_shared_ledger_candidate(){
        let mut d=doc(FIXED_OLD);let s=open(d.clone());let e=env(&s);
        let t=s.prepare_fixed_product_skin_candidate(e,CHARACTER,ORDINARY_NEW).unwrap();
        let projected=s.project_fixed_skin_candidate(e,CHARACTER,ORDINARY_NEW).unwrap();
        let stage=WorkerEnvelope{action:WorkerAction::Stage,..e};
        let call=|s:&ProductSession,e:WorkerEnvelope,old,sha:&str,p|s.stage_fixed_skin_candidate(e,CHARACTER,ORDINARY_NEW,old,sha,&t.character_sha,&t.inventory_sha,p);
        assert!(call(&s,e,t.old,&t.old_token_sha,projected).is_err());
        assert!(call(&s,stage,t.old,"bad",projected).is_err());
        assert!(call(&s,stage,t.old+1,&t.old_token_sha,projected).is_err());
        assert!(call(&s,stage,t.old,&t.old_token_sha,[0;32]).is_err());
        let foreign=open(d.clone());assert!(call(&foreign,stage,t.old,&t.old_token_sha,projected).is_err());
        let r=call(&s,stage,t.old,&t.old_token_sha,projected).unwrap();assert_eq!(r.exact_field_changed_count,1);assert_eq!(r.staged_decoded_sha256,projected);assert!(!r.product_writer_authorized);
        assert!(call(&s,stage,t.old,&t.old_token_sha,projected).is_err());
        let now=env(&s);s.undo_typed_semantic_batch(WorkerEnvelope{action:WorkerAction::Stage,..now}).unwrap();
        let now=env(&s);assert!(s.take_typed_semantic_decoded_once(WorkerEnvelope{action:WorkerAction::ExportEditedCopy,..now}).is_err());
        s.redo_typed_semantic_batch(WorkerEnvelope{action:WorkerAction::Stage,..now}).unwrap();
        let out_e=WorkerEnvelope{action:WorkerAction::ExportEditedCopy,..env(&s)};let out=s.take_typed_semantic_decoded_once(out_e).unwrap();
        assert!(s.take_typed_semantic_decoded_once(out_e).is_err());d["World"]["Characters"][0]["SkinID"]=json!(ORDINARY_NEW);
        assert_eq!(out,serde_json::to_vec(&d).unwrap());assert!(s.receipt().is_err());assert_eq!(sha(&s.decoded),hex(&e.expected_decoded_sha256));
    }
    #[test]fn product_skin_physical_negative_controls(){
        let old=STATIC_OLD[0];let mut variants=Vec::new();
        let mut d=doc(old);d["World"]["DialogueFlags"]=json!([]);variants.push(d);
        let mut d=doc(old);d["World"]["DialogueFlags"]=json!([CONDITION_FLAG,CONDITION_FLAG]);variants.push(d);
        let mut d=doc(old);d["Player"]["ListInventories"]["7"]["Inventory"][old.to_string()]["Amount"]=json!(0);variants.push(d);
        let mut d=doc(old);d["Player"]["ListInventories"]["7"]["Inventory"][ORDINARY_NEW.to_string()]["Marker"]=json!("ItemMarker_Unknown");variants.push(d);
        let mut d=doc(old);d["World"]["Characters"].as_array_mut().unwrap().push(json!({"Base":{"id":CHARACTER},"SkinID":old}));variants.push(d);
        let mut d=doc(old);d["World"]["Characters"][0]["SkinID"]=json!(170000001);variants.push(d);
        for d in variants{let s=open(d);assert!(s.prepare_product_skin_candidate(env(&s),CHARACTER,ORDINARY_NEW).is_err());}
        let mut s=open(doc(old));s.worker_bound=false;assert!(s.prepare_product_skin_candidate(env(&s),CHARACTER,ORDINARY_NEW).is_err());
    }
}
