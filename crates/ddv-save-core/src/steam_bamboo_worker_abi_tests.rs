//! ACT1685: Native bridge proof on only synthetic public data.
//! Accepted geometry and minted target are reused, not reimplemented here.
use super::*;
use crate::worker_session::WorkerSessionGuard;
use crate::{BuildIdentity, BuildKind, Platform, PRODUCT_WORKER_CONTRACT, WorkerAction};
use serde_json::{json, Value};

fn fixture() -> (Value, u32, u32) {
    let geometry = MeadowGeometry::fixed(EXACT_STEAM, 626).unwrap();
    let (x,y) = (4..388u32).step_by(2)
        .flat_map(|a| (4..196u32).step_by(2).map(move |b| (a,b)))
        .find(|&(a,b)| (0..2).all(|i| (0..2).all(|j| geometry.floor4(a+i,b+j))))
        .expect("installed fixed Bamboo floor");
    let other_x = if x < 190 {388} else {0};
    let other_y = if y < 100 {196} else {0};
    (json!({
      "GameInfo": {"Version":626},
      "World":{
        "Villages":[{"Areas":{"2":{"Unlocked":true,"GridIDs":[90001]}}}],
        "PlayerHouses":[],
        "GridCollection":{"Grids":{"90001":{
          "ID":90001, "GridDataPath":GRID,"GridDefaultLayoutPath":"",
          "TessellationFactor":2,"NextGridObjectID":50,"Objects":{"10":{
            "ID":10,"ItemID":40700007,"X":other_x,"Y":other_y,
            "Orientation":"GridOrientation_Down","State":null
          }}
        }},"DiffGrids":{}}
      },
      "Player":{
        "ListInventories":{"0":{
          "ID":0, "CompatibleItemType":"ItemType_Furniture",
          "CompatibleFurnitureTypes":{"List":["FurnitureItemType_Fence"]},
          "Inventory":{"40700007":{"Amount":10,"Marker":"ItemMarker_None"}}
        }},
        "ContainerInventories":{}
      }
    }), x, y)
}

fn open(doc: &Value, switch: bool) -> WorkerSessionGuard {
    let build = BuildIdentity {
        platform: if switch {Platform::Switch} else {Platform::SteamWindows},
        build_kind: if switch {BuildKind::SwitchBid} else {BuildKind::SteamFullVersion},
        build_id: if switch {"9A239D3DB569756D".into()} else {EXACT_STEAM.into()},
        schema: 626, externally_attested: true,
    };
    let mut session = ProductSession::open_decoded_readonly(serde_json::to_vec(doc).unwrap(),build).unwrap();
    session.worker_bound=true;
    WorkerSessionGuard::attach(session)
}
fn env(g: &WorkerSessionGuard) -> WorkerEnvelope {
    let r=g.receipt().unwrap();
    WorkerEnvelope{
        contract: PRODUCT_WORKER_CONTRACT, session_id: r.session_id,
        expected_revision:r.revision, expected_index_generation:r.index_generation,
        expected_decoded_sha256:r.decoded_sha256, action: WorkerAction::ReadDomain,
    }
}

#[test]
fn bamboo_worker_exact_read_receipt_is_immutable_and_non_authorizing() {
    let (doc,x,y)=fixture();
    let mut guard=open(&doc,false);
    let before=guard.receipt().unwrap();
    let out=guard.read_steam626_bamboo_single_target(env(&guard),90001,x,y).unwrap();
    assert_eq!(out["contract"],"wand.worker.steam626.bamboo.readonly-target@1");
    assert_eq!(out["itemId"],40700007);
    assert_eq!(out["gridId"],90001);
    assert_eq!(out["oldStock"],10);
    assert_eq!(out["nextGridObjectId"],50);
    assert_eq!(out["stockDelta"],0);
    assert_eq!(out["readOnly"],true);
    for flag in ["productReadAccepted","writerAuthorized","stageAuthorized","editedCopyAuthorized","operationOn"] {
        assert_eq!(out[flag],false,"{flag}");
    }
    for field in ["decodedSha256","rootSha256","gridSha256","counterSha256","stockSha256","housesSha256"] {
        assert_eq!(out[field].as_str().unwrap().len(),64,"{field}");
    }
    assert_eq!(before, guard.receipt().unwrap());
    guard.close().unwrap();
    assert!(guard.read_steam626_bamboo_single_target(env_for(&before),90001,x,y).is_err());
}

fn env_for(r: &crate::SessionReceipt) -> WorkerEnvelope {
    WorkerEnvelope{
        contract: PRODUCT_WORKER_CONTRACT, session_id:r.session_id,
        expected_revision:r.revision, expected_index_generation:r.index_generation,
        expected_decoded_sha256:r.decoded_sha256, action:WorkerAction::ReadDomain,
    }
}
#[test]
fn bamboo_worker_rejects_forged_cas_wrong_build_geometry_stock_and_stage() {
    let (doc,x,y)=fixture();
    let guard=open(&doc,false);
    let receipt=guard.receipt().unwrap();
    let e=env(&guard);
    let mut invalid=e;invalid.action=WorkerAction::Stage;
    assert!(guard.read_steam626_bamboo_single_target(invalid,90001,x,y).is_err());
    invalid=e;invalid.expected_revision+=1;
    assert!(guard.read_steam626_bamboo_single_target(invalid,90001,x,y).is_err());
    invalid=e;invalid.expected_index_generation+=1;
    assert!(guard.read_steam626_bamboo_single_target(invalid,90001,x,y).is_err());
    invalid=e;invalid.session_id=[9;16];
    assert!(guard.read_steam626_bamboo_single_target(invalid,90001,x,y).is_err());
    invalid=e;invalid.expected_decoded_sha256=[9;32];
    assert!(guard.read_steam626_bamboo_single_target(invalid,90001,x,y).is_err());
    assert!(guard.read_steam626_bamboo_single_target(e,90001,x+1,y).is_err());
    assert!(guard.read_steam626_bamboo_single_target(e,7,x,y).is_err());
    let wrong=open(&doc,true);
    assert!(wrong.read_steam626_bamboo_single_target(env(&wrong),90001,x,y).is_err());
    let foreign=open(&doc,false);
    assert!(foreign.read_steam626_bamboo_single_target(e,90001,x,y).is_err());
    let mut denied=doc.clone();
    denied["Player"]["ListInventories"]["0"]["Inventory"]["40700007"]["Amount"]=json!(1);
    let stock_guard=open(&denied,false);
    assert!(stock_guard.read_steam626_bamboo_single_target(env(&stock_guard),90001,x,y).is_err());
    assert_eq!(guard.receipt().unwrap(),receipt);
    assert!(guard.dispatch(WorkerEnvelope{action:WorkerAction::ExportEditedCopy,..e}).is_err());
}
