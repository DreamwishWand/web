//! ACT1029 exact Switch626 linked Crop Chest48 amount 50 -> 49.
//! Reuses the single ProductSession, existing typed amount target, packed
//! eligibility/definition/layout projections and shared atomic semantic ledger.
//! Static source compatibility only; no initialized game/provider, rights,
//! general Writer or publication claim. The separate product V2/QA/flag gates
//! still apply. No caller-supplied pack, path, authority or Build inference.
use super::*;

const SWITCH_BID:&str="9A239D3DB569756D";
const PROFILE:&str="linked-crop-chest48";

fn exact_build(s:&ProductSession)->CoreResult<()>{
    let b=&s.native_source_build;
    need(b.platform==Platform::Switch&&b.build_kind==BuildKind::SwitchBid&&
        b.build_id==SWITCH_BID&&b.schema==626&&b.externally_attested,
        "PRODUCT_SWITCH626_EXACT_BUILD")?;
    // The existing compiled pack() and layout_index() verify exact digests
    // and contracts. E2165: all 39 Chest rows; E2223: 153 exact layout
    // assets; ACT1028: normal-retail source; ACT1029: four raw dependency
    // definition files SHA256-identical to the existing DEP pins.
    pack()?;layout_index()?;Ok(())
}
fn selection_only(selection:ExistingAmountSelection)->CoreResult<()>{
    need(matches!(selection,ExistingAmountSelection::Chest{container_id,slot_index}
        if container_id>1&&slot_index<48),"PRODUCT_SWITCH626_CHEST_ONLY")
}
fn candidate(s:&ProductSession,e:&WorkerEnvelope,selection:ExistingAmountSelection)
    ->CoreResult<CoreExistingAmountTarget>{
    selection_only(selection)?;
    let t=observe_existing_amount(s,e,selection)?;
    eligible_bound(s,&t,49,LayoutBinding::Switch626ChestStatic)?;
    Ok(t)
}
impl ProductSession{
    pub(crate) fn discover_switch626_scoped_chest(&self,e:WorkerEnvelope,offset:u32)
        ->CoreResult<(Vec<CoreExistingAmountTarget>,Option<u32>,u32)>{
        exact_build(self)?;
        let st=self.lock()?;check(self,&st,&e,WorkerAction::ReadDomain)?;
        need(st.semantic.is_none()&&st.revision==0&&st.generation==1,"PRODUCT_AMOUNT_FRESH_EPOCH")?;
        let b=&self.decoded;let roots=indexed_read::roots(b)?;
        let all=discovery_selections(b,roots.player,PROFILE)?;
        let start=offset as usize;need(start<=all.len(),"PRODUCT_AMOUNT_DISCOVERY_OFFSET")?;
        let end=start.saturating_add(DISCOVERY_SCAN_PAGE).min(all.len());
        let mut rows=Vec::new();
        for &selection in &all[start..end]{
            if let Ok(t)=candidate(self,&e,selection){rows.push(t);}
        }
        Ok((rows,(end<all.len()).then_some(end as u32),(end-start) as u32))
    }
    pub(crate) fn preview_switch626_scoped_chest(&self,e:WorkerEnvelope,selection:ExistingAmountSelection,new:u32)
        ->CoreResult<CoreExistingAmountTarget>{
        exact_build(self)?;need(new==49,"PRODUCT_SWITCH626_EXACT_DECREASE")?;
        let st=self.lock()?;check(self,&st,&e,WorkerAction::ReadDomain)?;
        need(st.semantic.is_none()&&st.revision==0&&st.generation==1,"PRODUCT_AMOUNT_FRESH_EPOCH")?;
        candidate(self,&e,selection)
    }
    pub(crate) fn stage_switch626_scoped_chest(&self,e:WorkerEnvelope,selection:ExistingAmountSelection,
        old:u32,new:u32,entry:[u8;32])->CoreResult<SemanticStageReceipt>{
        need(e.action==WorkerAction::Stage&&old==50&&new==49,"PRODUCT_SWITCH626_EXACT_DECREASE")?;
        let mut read=e;read.action=WorkerAction::ReadDomain;
        let t=self.preview_switch626_scoped_chest(read,selection,new)?;
        need(t.view().old_amount==old&&t.view().entry_sha256==entry,"PRODUCT_AMOUNT_ENTRY_CAS")?;
        // Do not relax the Steam-only generic batch or raw Worker guard.
        // Only this scoped, freshly re-minted typed target reaches the
        // existing exact replacement + full validation + locked CAS ledger.
        let cmd=command_from_target(&t,new)?;
        let player=indexed_read::roots(&self.decoded)?.player;
        let edit=target(&self.decoded,player,&cmd)?;
        self.commit_semantic_replacements(e,vec![edit],1,None)
    }
}
