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
        product_appearance_scope(self,&e)?;
        // Lock again for the read to exclude close/mutation between check and scan.
        let st=self.lock()?;validate_scope(self,&st,&e)?;
        let b=&self.decoded;let root=roots(b)?;
        let player=members(b,root.player,1024)?;
        let male=match &b[required(&player,"AvatarIsMale")?.begin..required(&player,"AvatarIsMale")?.end]{
            b"true"=>true,b"false"=>false,_=>return Err(denied("HAIR_PRODUCT_ACTIVE_BRANCH_BOOL"))};
        let fs=required(&player,"FemaleAvatar")?;let ms=required(&player,"MaleAvatar")?;
        let f=branch(b,fs)?;let m=branch(b,ms)?;
        let active=if male{&m}else{&f};let active_span=if male{ms}else{fs};
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
    #[test]fn product_hair_current_reference_denials(){
        for (key,val) in [("HairColorIndex",json!(90)),("HairHighlightColor",json!(-1)),("Clothes",json!({"0":50000002})),
            ("ClothingCustomization",json!(null))]{let mut d=doc();d["Player"]["MaleAvatar"][key]=val;
            let s=open(d);assert!(s.prepare_product_hair_candidate(env(&s),89).is_err());}
        let mut d=doc();d["Player"]["ListInventories"]["1"]["Inventory"]["50000001"]["Amount"]=json!(0);
        let s=open(d);assert!(s.prepare_product_hair_candidate(env(&s),89).is_err());
        let mut s=open(doc());s.worker_bound=false;assert!(s.prepare_product_hair_candidate(env(&s),89).is_err());
    }
}
