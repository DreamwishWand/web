//! 05 QR-C: independent changed-only Rust Wardrobe readset negative QA.
//! QA-only child of 01A PR2193 fixed HEAD 1f9306211fff3e051befa99ac0c371f5f1715da9.
//! No real Save, secret, Writer, inherited output path or product release authority.
#![cfg(feature = "private-native-v1")]
use ddv_save_core::{
    BuildIdentity, BuildKind, CoreResult, Platform, ProductSession, SessionReceipt,
    WorkerAction, WorkerEnvelope, PRODUCT_WORKER_CONTRACT,
};
use serde_json::{json, Value};

const STEAM: &str = "releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22";
const SWITCH: &str = "9A239D3DB569756D";

fn fixture() -> Value {
    json!({"GameInfo":{"Version":626},"World":{},"Player":{
        "AvatarIsMale":true,
        "FemaleAvatar":{"HairColorIndex":0,"HairHighlightColor":0,
            "Clothes":{"0":50000001},"IncompatibleClothes":{},"Makeup":{},
            "ClothingCustomization":{"50000001":23}},
        "MaleAvatar":{"HairColorIndex":89,"HairHighlightColor":1,
            "Clothes":{"0":50000002},"IncompatibleClothes":{},
            "Makeup":{"1":{"MakeupItemID":140000001,"Unknown":"preserve"}},
            "ClothingCustomization":{}},
        "ListInventories":{
            "0":{"ID":0,"CompatibleItemType":"ItemType_Furniture","Inventory":{}},
            "1":{"ID":1,"CompatibleItemType":"ItemType_Clothing","Inventory":{
                "50000001":{"Amount":3,"Marker":"ItemMarker_None"},
                "50000002":{"Amount":1,"Marker":"ItemMarker_Favorite"},
                "50000003":{"Amount":2,"Marker":"ItemMarker_None"}}},
            "3":{"ID":3,"CompatibleItemType":"ItemType_Makeup","Inventory":{
                "140000001":{"Amount":2,"Marker":"ItemMarker_None"}}}
        }
    }})
}
fn open(v: &Value, switch: bool) -> CoreResult<ProductSession> {
    ProductSession::open_decoded_readonly(
        serde_json::to_vec(v).unwrap(),
        BuildIdentity {
            platform: if switch { Platform::Switch } else { Platform::SteamWindows },
            build_kind: if switch { BuildKind::SwitchBid } else { BuildKind::SteamFullVersion },
            build_id: (if switch { SWITCH } else { STEAM }).into(),
            schema:626,
            externally_attested:true,
        },
    )
}
fn scope(r: SessionReceipt) -> WorkerEnvelope {
    WorkerEnvelope {
        contract: PRODUCT_WORKER_CONTRACT,
        session_id:r.session_id,
        expected_revision:r.revision,
        expected_index_generation:r.index_generation,
        expected_decoded_sha256:r.decoded_sha256,
        action:WorkerAction::ReadDomain,
    }
}
fn read(s: &ProductSession, e: WorkerEnvelope, switch: bool) -> CoreResult<Value> {
    if switch {
        s.read_private_switch626_wardrobe_same_slot(e,0,50000002,50000003)
            .map(|r|r.to_private_receipt_json())
    } else {
        s.read_private_wardrobe_same_slot(e,0,50000002,50000003)
            .map(|r|r.to_private_receipt_json())
    }
}
fn must_deny(mutated: Value, switch: bool, name: &str) {
    // Full-document refusal is also fail-closed. A successfully opened document
    // must still reject the candidate by the scoped Rust readset.
    if let Ok(s) = open(&mutated,switch) {
        let e=scope(s.receipt().unwrap());
        assert!(read(&s,e,switch).is_err(),"accepted unsafe case: {name}");
    }
}

#[test]
fn exact_steam_and_switch_readset_are_non_authorizing_and_immutable() {
    for switch in [false,true] {
        let s=open(&fixture(),switch).unwrap();
        let before=s.receipt().unwrap();
        let e=scope(before);
        let r=read(&s,e,switch).unwrap();
        assert_eq!(r["oldItemId"],50000002);
        assert_eq!(r["proposedItemId"],50000003);
        assert_eq!(r["slot"],0);
        assert_eq!(r["inventory"]["oldStock"]["savedAmount"],1);
        assert_eq!(r["inventory"]["oldStock"]["savedMarker"],"ItemMarker_Favorite");
        assert_eq!(r["inventory"]["proposedStock"]["savedAmount"],2);
        assert_eq!(r["inventory"]["proposedStock"]["savedMarker"],"ItemMarker_None");
        assert_eq!(r["inventory"]["inventoryId"],1);
        assert_eq!(r["inventory"]["compatibleItemType"],"ItemType_Clothing");
        assert_eq!(r["avatar"]["activeBranch"],"MaleAvatar");
        assert_eq!(r["avatar"]["platform"],if switch {"Switch"}else{"SteamWindows"});
        for key in [
            "sameSlotDefinitionVerified","effectiveEligibilityVerified","rightsVerified",
            "subscriberClosureVerified","productReadAccepted","writerAuthorized",
            "editedCopyAuthorized","applyAuthorized",
        ] {
            assert_eq!(r[key],false,"unexpected authority flag {key}");
        }
        assert_eq!(r["fullDocumentRustValidated"],true);
        assert_eq!(s.receipt().unwrap(),before,"read mutated ProductSession");
        // ReadDomain must not cross the opposite platform's private wrapper.
        assert!(if switch {
            s.read_private_wardrobe_same_slot(e,0,50000002,50000003).is_err()
        }else{
            s.read_private_switch626_wardrobe_same_slot(e,0,50000002,50000003).is_err()
        });
        s.close().unwrap();
        assert!(read(&s,e,switch).is_err(),"closed session reused");
    }
}

#[test]
fn malformed_old_and_proposed_stock_or_foreign_references_fail_closed() {
    for switch in [false,true] {
        let base=fixture();
        let mut cases:Vec<(&str,Value)>=Vec::new();
        let mut d=base.clone();d["Player"]["ListInventories"]["1"]["Inventory"]["50000002"]["Amount"]=json!(0);
        cases.push(("zero old stock",d));
        let mut d=base.clone();d["Player"]["ListInventories"]["1"]["Inventory"]["50000002"]["Amount"]=json!("1");
        cases.push(("untyped old stock",d));
        let mut d=base.clone();d["Player"]["ListInventories"]["1"]["Inventory"]["50000002"].as_object_mut().unwrap().remove("Marker");
        cases.push(("unmarked old stock",d));
        let mut d=base.clone();d["Player"]["ListInventories"]["1"]["Inventory"]["50000003"]["Amount"]=json!(-1);
        cases.push(("negative proposed stock",d));
        let mut d=base.clone();d["Player"]["ListInventories"]["1"]["Inventory"]["50000003"]["Marker"]=json!("ItemMarker_Unknown");
        cases.push(("unknown proposed marker",d));
        let mut d=base.clone();d["Player"]["ListInventories"]["1"]["Inventory"].as_object_mut().unwrap().remove("50000003");
        cases.push(("absent proposed stock",d));
        let mut d=base.clone();d["Player"]["FemaleAvatar"]["Clothes"]["8"]=json!(50000003);
        cases.push(("proposed referenced by inactive Avatar",d));
        let mut d=base.clone();d["Player"]["FemaleAvatar"]["ClothingCustomization"]["50000003"]=json!(0);
        cases.push(("proposed referenced by inactive customization",d));
        let mut d=base.clone();d["Player"]["MaleAvatar"]["IncompatibleClothes"]["0"]=json!(50000001);
        cases.push(("occupied incompatible active slot",d));
        let mut d=base.clone();d["Player"]["MaleAvatar"]["ClothingCustomization"]["50000002"]=json!(1);
        cases.push(("active customization unknown closure",d));
        let mut d=base.clone();d["Player"]["ListInventories"]["1"]["CompatibleItemType"]=json!("ItemType_Furniture");
        cases.push(("wrong clothing route type",d));
        let mut d=base.clone();d["Player"]["ListInventories"].as_object_mut().unwrap().remove("3");
        cases.push(("missing shared makeup route",d));
        let mut d=base.clone();d["Player"]["ListInventories"]["1"]["Inventory"]["050000003"]=json!({"Amount":2,"Marker":"ItemMarker_None"});
        cases.push(("noncanonical clothing inventory key",d));
        for (name,v) in cases {
            must_deny(v,switch,name);
        }
    }
}
#[test]
fn stale_epoch_wrong_action_and_foreign_source_never_reuse_readset() {
    for switch in [false,true] {
        let s=open(&fixture(),switch).unwrap();
        let good=scope(s.receipt().unwrap());
        assert!(read(&s,good,switch).is_ok());
        let mut wrong=good;wrong.action=WorkerAction::Stage;
        assert!(read(&s,wrong,switch).is_err(),"Stage action accepted");
        let mut wrong=good;wrong.expected_revision+=1;
        assert!(read(&s,wrong,switch).is_err(),"stale revision accepted");
        let mut wrong=good;wrong.expected_index_generation+=1;
        assert!(read(&s,wrong,switch).is_err(),"stale generation accepted");
        let mut wrong=good;wrong.expected_decoded_sha256[0]^=1;
        assert!(read(&s,wrong,switch).is_err(),"decoded hash spoof accepted");
        let mut changed=fixture();
        changed["Player"]["ListInventories"]["1"]["Inventory"]["50000003"]["Amount"]=json!(3);
        let foreign=open(&changed,switch).unwrap();
        assert!(read(&foreign,good,switch).is_err(),"foreign source accepted");
        assert_eq!(s.receipt().unwrap().revision,0);
    }
}
