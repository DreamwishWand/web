//! Internal Steam626 active-HairColorIndex candidate only. No Stage or WASM export.
//! E1328 / static catalog contract SHA256:
//! 49c68166983cb2170290e81120397d7cd2f0f6c131284a2e93b83f1e7a747e16.
//! Core-minted current source span, not a caller plan or authorization.
use super::*;
use super::appearance_observer::*;
use serde_json::Value;
pub(super) struct HairCandidate {
    pub(super) scope:WorkerEnvelope,
    pub(super) active_male:bool,
    pub(super) span:Span,
    pub(super) old:i32,
    pub(super) new:i32,
    pub(super) highlight:i32,
    pub(super) female_sha:String,
    pub(super) male_sha:String,
    pub(super) old_token_sha:String,
    pub(super) ownership:Value,
}
impl ProductSession {
    pub(super) fn prepare_product_hair_candidate(&self,e:WorkerEnvelope,new:i32)->CoreResult<HairCandidate>{
        self.prepare_product_hair_candidate_for(e,new,AppearanceBuildScope::Steam626)
    }
    fn prepare_product_hair_candidate_for(&self,e:WorkerEnvelope,new:i32,scope:AppearanceBuildScope)->CoreResult<HairCandidate>{
        product_appearance_scope_for(self,&e,scope)?;
        // Lock again for the read to exclude close/mutation between check and scan.
        let st=self.lock()?;validate_scope(self,&st,&e)?;
        let b=&self.decoded;let root=roots(b)?;
        let player=members(b,root.player,1024)?;
        let male=match &b[required(&player,"AvatarIsMale")?.begin..required(&player,"AvatarIsMale")?.end]{
            b"true"=>true,b"false"=>false,_=>return Err(denied("HAIR_PRODUCT_ACTIVE_BRANCH_BOOL"))};
        let fs=required(&player,"FemaleAvatar")?;let ms=required(&player,"MaleAvatar")?;
        let f=branch(b,fs)?;let m=branch(b,ms)?;
        let active=if male{&m}else{&f};let active_span=if male{ms}else{fs};
        // Switch affected delta covers the active male and inactive female
        // palette match only; no general branch or palette expansion.
        if scope==AppearanceBuildScope::Switch626&&(!male||f.hair!=Some(new)||!palette(f.highlight)){
            return Err(denied("HAIR_SWITCH626_BRANCH_SCOPE"));
        }
        let old=active.hair.ok_or(denied("HAIR_PRODUCT_OLD_ABSENT"))?;
        let highlight=active.highlight.ok_or(denied("HAIR_PRODUCT_HIGHLIGHT_ABSENT"))?;
        if !palette(Some(old))||!palette(Some(new))||!palette(Some(highlight))||old==new{
            return Err(denied("HAIR_PRODUCT_PALETTE_SCOPE"));}
        let span=required(&members(b,active_span,MAX_AVATAR_FIELDS)?,"HairColorIndex")?;
        if int(b,span)?!=old{return Err(denied("HAIR_PRODUCT_OLD_CAS"));}
        let ownership=inventory_dependencies(b,required(&player,"ListInventories")?,&f,&m)?;
        if ownership["allFourMapsPerBranchPresent"]!=true||ownership["allObservedReferencesHavePositiveSavedAmount"]!=true{
            return Err(denied("HAIR_PRODUCT_REFERENCE_STOCK"));}
        // Preserve all references and markers; no inference of ownership rights.
        for r in ownership["routes"].as_array().ok_or(denied("HAIR_PRODUCT_ROUTE"))?{
            for i in r["entries"].as_array().ok_or(denied("HAIR_PRODUCT_ENTRY"))?{
                if i["markerPresent"]!=true{return Err(denied("HAIR_PRODUCT_MARKER_ABSENT"));}
            }
        }
        Ok(HairCandidate{scope:e,active_male:male,span,old,new,highlight,female_sha:f.sha,male_sha:m.sha,
            old_token_sha:sha(&b[span.begin..span.end]),ownership})
    }
}
// Fixed operation policy: palette indices only, not a saved branch or private plan.
// No product authorization until current affected closure and ledger/ABI are bound.
const FIXED_OLD:i32=74;
const FIXED_NEW:i32=20;
impl ProductSession {
    pub(super) fn prepare_fixed_product_hair_candidate(&self,e:WorkerEnvelope,new:i32)->CoreResult<HairCandidate>{
        self.prepare_fixed_product_hair_candidate_for(e,new,AppearanceBuildScope::Steam626)
    }
    pub(super) fn prepare_fixed_product_hair_candidate_for(&self,e:WorkerEnvelope,new:i32,scope:AppearanceBuildScope)->CoreResult<HairCandidate>{
        if new!=FIXED_NEW{return Err(denied("HAIR_FIXED_NEW_SCOPE"));}
        let t=self.prepare_product_hair_candidate_for(e,new,scope)?;
        if t.old!=FIXED_OLD{return Err(denied("HAIR_FIXED_OLD_SCOPE"));}
        Ok(t)
    }
}
// Internal typed Stage candidate. No WASM/Worker dispatch is wired by this module.
// A future product route must establish the current affected definition/reference
// closure independently; exact pair, hashes and persisted stock are not authority.
#[cfg(feature="semantic-writer-dev")]
impl ProductSession {
    pub(super) fn project_fixed_hair_candidate(&self,e:WorkerEnvelope,new:i32)->CoreResult<[u8;32]>{
        let t=self.prepare_fixed_product_hair_candidate(e,new)?;
        self.project_appearance_scalar_candidate(t.span,t.old,t.new)
    }
    pub(super) fn stage_fixed_hair_candidate(&self,e:WorkerEnvelope,new:i32,old:i32,
        old_sha:&str,female_sha:&str,male_sha:&str,projected:[u8;32])->CoreResult<crate::SemanticStageReceipt>{
        if e.action!=WorkerAction::Stage{return Err(denied("HAIR_PRODUCT_STAGE_ACTION"));}
        let t=self.prepare_fixed_product_hair_candidate(WorkerEnvelope{action:WorkerAction::ReadDomain,..e},new)?;
        if t.old!=old||t.old_token_sha!=old_sha||t.female_sha!=female_sha||t.male_sha!=male_sha{
            return Err(denied("HAIR_PRODUCT_STAGE_CAS"));}
        self.commit_appearance_scalar_candidate(e,t.span,t.old,t.new,projected)
    }
}
#[cfg(test)]
mod tests{
    use super::*;use crate::{BuildIdentity,BuildKind,Platform};use serde_json::json;
    fn doc()->Value{let branch=json!({"HairColorIndex":0,"HairHighlightColor":89,"Clothes":{"0":50000001},
        "IncompatibleClothes":{},"Makeup":{},"ClothingCustomization":{}});
        json!({"GameInfo":{"Version":626},"Player":{"AvatarIsMale":true,"MaleAvatar":branch,"FemaleAvatar":branch,
          "ListInventories":{"1":{"ID":1,"CompatibleItemType":"ItemType_Clothing","Inventory":{"50000001":{"Amount":1,"Marker":"ItemMarker_None"}}},
            "3":{"ID":3,"CompatibleItemType":"ItemType_Makeup","Inventory":{}}}},"World":{}})}
    fn open(d:Value)->ProductSession{let mut s=ProductSession::open_decoded_readonly(serde_json::to_vec(&d).unwrap(),
        BuildIdentity{platform:Platform::SteamWindows,build_kind:BuildKind::SteamFullVersion,build_id:APPEARANCE_BUILD.into(),schema:626,externally_attested:true}).unwrap();
        // Native synthetic test only; actual generated Worker is separate QA.
        s.worker_bound=true;s}
    fn env(s:&ProductSession)->WorkerEnvelope{let r=s.receipt().unwrap();WorkerEnvelope{contract:PRODUCT_WORKER_CONTRACT,
        session_id:r.session_id,expected_revision:r.revision,expected_index_generation:r.index_generation,expected_decoded_sha256:r.decoded_sha256,action:WorkerAction::ReadDomain}}
    #[test]fn product_hair_core_minted_current_candidate_only(){
        for male in [true,false]{let mut d=doc();d["Player"]["AvatarIsMale"]=json!(male);
            let s=open(d);let before=s.receipt().unwrap();let e=env(&s);
            let t=s.prepare_product_hair_candidate(e,89).unwrap();
            assert_eq!(t.active_male,male);assert_eq!((t.old,t.new,t.highlight),(0,89,89));
            assert_eq!(&s.decoded[t.span.begin..t.span.end],b"0");assert_eq!(t.scope.session_id,e.session_id);
            assert_eq!(t.old_token_sha,sha(b"0"));assert!(!t.female_sha.is_empty()&&!t.male_sha.is_empty());
            assert_eq!(t.ownership["rightsVerified"],false);assert_eq!(s.receipt().unwrap(),before);
            for new in [-1,0,90]{assert!(s.prepare_product_hair_candidate(e,new).is_err());}
            let mut stale=e;stale.expected_revision+=1;assert!(s.prepare_product_hair_candidate(stale,89).is_err());
            let mut stage=e;stage.action=WorkerAction::Stage;assert!(s.prepare_product_hair_candidate(stage,89).is_err());
            let foreign=open(doc());assert!(foreign.prepare_product_hair_candidate(e,89).is_err());
            s.close().unwrap();assert!(s.prepare_product_hair_candidate(e,89).is_err());
        }
    }
    #[test]fn product_hair_fixed_scope_not_palette_wide(){
        let mut d=doc();d["Player"]["MaleAvatar"]["HairColorIndex"]=json!(FIXED_OLD);
        let s=open(d);let e=env(&s);let before=s.receipt().unwrap();
        let t=s.prepare_fixed_product_hair_candidate(e,FIXED_NEW).unwrap();
        assert_eq!((t.old,t.new),(FIXED_OLD,FIXED_NEW));
        assert!(s.prepare_fixed_product_hair_candidate(e,89).is_err());
        assert!(s.prepare_fixed_product_hair_candidate(e,FIXED_OLD).is_err());
        let other=open(doc());assert!(other.prepare_fixed_product_hair_candidate(env(&other),FIXED_NEW).is_err());
        assert_eq!(s.receipt().unwrap(),before);
    }
    #[cfg(feature="semantic-writer-dev")]
    #[test]fn product_hair_fixed_exact1_shared_ledger_candidate(){
        for male in [true,false]{let mut d=doc();let k=if male{"MaleAvatar"}else{"FemaleAvatar"};
            d["Player"]["AvatarIsMale"]=json!(male);d["Player"][k]["HairColorIndex"]=json!(FIXED_OLD);
            let s=open(d.clone());let e=env(&s);let t=s.prepare_fixed_product_hair_candidate(e,FIXED_NEW).unwrap();
            let projected=s.project_fixed_hair_candidate(e,FIXED_NEW).unwrap();let stage=WorkerEnvelope{action:WorkerAction::Stage,..e};
            let call=|s:&ProductSession,e:WorkerEnvelope,old,sha:&str,p|s.stage_fixed_hair_candidate(e,FIXED_NEW,old,sha,&t.female_sha,&t.male_sha,p);
            assert!(call(&s,e,t.old,&t.old_token_sha,projected).is_err());
            assert!(call(&s,stage,t.old,"bad",projected).is_err());
            assert!(call(&s,stage,t.old+1,&t.old_token_sha,projected).is_err());
            assert!(call(&s,stage,t.old,&t.old_token_sha,[0;32]).is_err());
            let foreign=open(d.clone());assert!(call(&foreign,stage,t.old,&t.old_token_sha,projected).is_err());
            let r=call(&s,stage,t.old,&t.old_token_sha,projected).unwrap();
            assert_eq!(r.exact_field_changed_count,1);assert_eq!(r.staged_decoded_sha256,projected);assert!(!r.product_writer_authorized);
            assert!(call(&s,stage,t.old,&t.old_token_sha,projected).is_err());
            let now=env(&s);s.undo_typed_semantic_batch(WorkerEnvelope{action:WorkerAction::Stage,..now}).unwrap();
            let now=env(&s);assert!(s.take_typed_semantic_decoded_once(WorkerEnvelope{action:WorkerAction::ExportEditedCopy,..now}).is_err());
            s.redo_typed_semantic_batch(WorkerEnvelope{action:WorkerAction::Stage,..now}).unwrap();
            let out_e=WorkerEnvelope{action:WorkerAction::ExportEditedCopy,..env(&s)};let out=s.take_typed_semantic_decoded_once(out_e).unwrap();
            assert!(s.take_typed_semantic_decoded_once(out_e).is_err());d["Player"][k]["HairColorIndex"]=json!(FIXED_NEW);
            assert_eq!(out,serde_json::to_vec(&d).unwrap());assert!(s.receipt().is_err());assert_eq!(sha(&s.decoded),hex(&e.expected_decoded_sha256));
        }
    }
    #[test]fn product_hair_current_reference_denials(){
        for (key,val) in [("HairColorIndex",json!(90)),("HairHighlightColor",json!(-1)),("Clothes",json!({"0":50000002})),
            ("ClothingCustomization",json!(null))]{let mut d=doc();d["Player"]["MaleAvatar"][key]=val;
            let s=open(d);assert!(s.prepare_product_hair_candidate(env(&s),89).is_err());}
        let mut d=doc();d["Player"]["ListInventories"]["1"]["Inventory"]["50000001"]["Amount"]=json!(0);
        let s=open(d);assert!(s.prepare_product_hair_candidate(env(&s),89).is_err());
        let mut s=open(doc());s.worker_bound=false;assert!(s.prepare_product_hair_candidate(env(&s),89).is_err());
    }
}
