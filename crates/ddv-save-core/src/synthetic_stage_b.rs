//! W-CORE-RUST-V2-CAS-078: native-only, *synthetic* two-domain CAS lab.
//! Compile only with synthetic-stage-b; wasm32/product Worker compilation rejects
//! this feature. No P1G codec, actual game edit, user Save or Product Writer.
use super::{ProductSession, State, WorkerAction, WorkerEnvelope, PRODUCT_WORKER_CONTRACT};
use crate::{strict_document::validate_entire_document, CoreError, CoreResult};
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::{fs::{self, OpenOptions}, io::Write, path::Path};

const MAX_FIXTURE:usize = 1024*1024;
const MARKER:&str = "WAND_SYNTHETIC_ONLY_NOT_A_REAL_SAVE";
const SOURCE_NAME:&str = "wand-stageb-original.json";
const BACKUP_NAME:&str = "wand-stageb-original.backup.json";
const EDIT_NAME:&str = "wand-stageb-edited-copy.json";
const MAX_COUNTER:i64 = 1_000_000_000;

#[derive(Clone,Copy,Debug,PartialEq,Eq)]
pub struct SyntheticChangeSet {
    pub scope:WorkerEnvelope,
    pub expected_player:i64,
    pub new_player:i64,
    pub expected_world:i64,
    pub new_world:i64,
}
#[derive(Clone,Copy,Debug,PartialEq,Eq)]
pub struct SyntheticStageReceipt {
    pub session_id:[u8;16], pub revision:u64, pub index_generation:u64,
    pub decoded_source_sha256:[u8;32], pub applied:bool,
    pub cross_domain_atomic:bool, pub writer_authorized:bool,
}
#[derive(Clone,Copy,Debug,PartialEq,Eq)]
pub struct SyntheticExportReceipt {
    pub decoded_source_sha256:[u8;32],pub backup_sha256:[u8;32],
    pub edited_sha256:[u8;32],pub original_unchanged:bool,
    pub distinct_backup_verified:bool,pub distinct_edited_verified:bool,
    pub same_process_reopen_validated:bool,pub fresh_process_reopen_validated:bool,
    pub writer_authorized:bool,
}
#[derive(Clone,Debug)]
struct Patch { key:&'static str,start:usize,end:usize,old:i64,new:i64 }
#[derive(Clone,Debug)]
pub(super) struct SyntheticLedger {
    patches:[Patch;2], applied:bool, consumed:bool,
}
fn err(code:&'static str)->CoreError { CoreError(code) }
fn sha(bytes:&[u8])->[u8;32] {Sha256::digest(bytes).into()}
fn validate_scope(s:&ProductSession,st:&State,e:&WorkerEnvelope,action:WorkerAction)->CoreResult<()> {
    if st.closed {return Err(err("SESSION_CLOSED"));}
    if e.contract!=PRODUCT_WORKER_CONTRACT || e.session_id!=st.id ||
       e.expected_decoded_sha256!=s.sha {
        return Err(err("SESSION_SOURCE_SCOPE_MISMATCH"));
    }
    if e.expected_revision!=st.revision || e.expected_index_generation!=st.generation {
        return Err(err("SESSION_REVISION_GENERATION_CAS"));
    }
    if e.action!=action {return Err(err("SYNTHETIC_OPERATION_DENIED"));}
    Ok(())
}
fn bounded_counter(i:i64)->CoreResult<()> {
    if !(0..=MAX_COUNTER).contains(&i){return Err(err("SYNTHETIC_COUNTER_BOUNDS"));}
    Ok(())
}
fn fixture_values(bytes:&[u8])->CoreResult<(i64,i64)> {
    if bytes.is_empty() || bytes.len()>MAX_FIXTURE {return Err(err("SYNTHETIC_FIXTURE_SIZE"));}
    let root:Value=serde_json::from_slice(bytes).map_err(|_|err("SYNTHETIC_FIXTURE_JSON"))?;
    if root.get("__WandSyntheticStageBOnly").and_then(Value::as_str)!=Some(MARKER) {
        return Err(err("SYNTHETIC_ONLY_MARKER_REQUIRED"));
    }
    // Canonical JSON makes exact-byte patch offsets deterministic. No whole
    // game JSON allocation: hard <=1MiB bound and opt-in test feature only.
    let canonical=serde_json::to_vec(&root).map_err(|_|err("SYNTHETIC_CANONICAL_JSON"))?;
    if canonical.as_slice()!=bytes{return Err(err("SYNTHETIC_CANONICAL_REQUIRED"));}
    let player=root.get("Player").and_then(|v|v.get("__wandPlayerCounter"))
        .and_then(Value::as_i64).ok_or(err("SYNTHETIC_PLAYER_REF_MISSING"))?;
    let world=root.get("World").and_then(|v|v.get("__wandWorldCounter"))
        .and_then(Value::as_i64).ok_or(err("SYNTHETIC_WORLD_REF_MISSING"))?;
    bounded_counter(player)?;bounded_counter(world)?;
    Ok((player,world))
}
fn locate(bytes:&[u8],key:&'static str,old:i64,new:i64)->CoreResult<Patch>{
    bounded_counter(new)?;
    let prefix=format!("\"{}\":",key);
    let needle=prefix.as_bytes();
    let starts:Vec<usize>=bytes.windows(needle.len()).enumerate()
        .filter_map(|(i,w)|(w==needle).then_some(i)).collect();
    if starts.len()!=1 {return Err(err("SYNTHETIC_REF_NOT_UNIQUE"));}
    let start=starts[0]+needle.len();
    let old_str=old.to_string();
    let end=start.checked_add(old_str.len()).ok_or(err("SYNTHETIC_OFFSET_OVERFLOW"))?;
    if bytes.get(start..end)!=Some(old_str.as_bytes()) ||
      !matches!(bytes.get(end).copied(),Some(b','|b'}')) {
        return Err(err("SYNTHETIC_OLD_VALUE_MISMATCH"));
    }
    Ok(Patch{key,start,end,old,new})
}
fn verified_patches(bytes:&[u8],change:&SyntheticChangeSet)->CoreResult<[Patch;2]> {
    let (player,world)=fixture_values(bytes)?;
    if player!=change.expected_player || world!=change.expected_world {
        return Err(err("SYNTHETIC_OLD_VALUE_CAS"));
    }
    if change.expected_player==change.new_player ||
       change.expected_world==change.new_world {
        return Err(err("SYNTHETIC_ZERO_CHANGESET"));
    }
    let mut patches=[
        locate(bytes,"__wandPlayerCounter",player,change.new_player)?,
        locate(bytes,"__wandWorldCounter",world,change.new_world)?,
    ];
    patches.sort_by_key(|p|p.start);
    if patches[0].end>patches[1].start{return Err(err("SYNTHETIC_OVERLAPPING_PATCH"));}
    Ok(patches)
}
fn render(bytes:&[u8],patches:&[Patch;2])->CoreResult<Vec<u8>> {
    let mut out=Vec::with_capacity(bytes.len()+32);
    let mut cursor=0usize;
    for p in patches {
        if p.start<cursor || p.end>bytes.len() ||
           bytes.get(p.start..p.end)!=Some(p.old.to_string().as_bytes()) {
            return Err(err("SYNTHETIC_EXACT_DIFF_MISMATCH"));
        }
        out.extend_from_slice(&bytes[cursor..p.start]);
        out.extend_from_slice(p.new.to_string().as_bytes());
        cursor=p.end;
    }
    out.extend_from_slice(&bytes[cursor..]);
    validate_entire_document(&out,626)?;
    let (p,w)=fixture_values(&out)?;
    let expected_player=patches.iter().find(|x|x.key=="__wandPlayerCounter")
        .ok_or(err("SYNTHETIC_PLAYER_REF_MISSING"))?.new;
    let expected_world=patches.iter().find(|x|x.key=="__wandWorldCounter")
        .ok_or(err("SYNTHETIC_WORLD_REF_MISSING"))?.new;
    if p!=expected_player || w!=expected_world {
        return Err(err("SYNTHETIC_POST_CHANGESET_REF_MISMATCH"));
    }
    Ok(out)
}
fn verified_file(path:&Path,expected:&[u8])->CoreResult<()> {
    let b=fs::read(path).map_err(|_|err("SYNTHETIC_READBACK_FAILED"))?;
    if b!=expected {return Err(err("SYNTHETIC_READBACK_DIFFERENT"));}
    Ok(())
}
fn reserve_new(path:&Path,content:&[u8])->CoreResult<()> {
    let mut f=OpenOptions::new().write(true).create_new(true).open(path)
        .map_err(|_|err("SYNTHETIC_DESTINATION_EXISTS_OR_DENIED"))?;
    f.write_all(content).map_err(|_|err("SYNTHETIC_WRITE_FAILED"))?;
    f.sync_all().map_err(|_|err("SYNTHETIC_FSYNC_FAILED"))?;
    verified_file(path,content)
}

impl ProductSession {
    /// Synthetic fixture-only atomic two-domain change with old-value CAS.
    /// Product Worker dispatch keeps rejecting Stage and Writer.
    pub fn synthetic_stage(&self,c:SyntheticChangeSet)->CoreResult<SyntheticStageReceipt>{
        let patches=verified_patches(&self.decoded,&c)?;
        let mut st=self.lock()?;
        validate_scope(self,&st,&c.scope,WorkerAction::Stage)?;
        if st.lab.is_some(){return Err(err("SYNTHETIC_STAGE_ALREADY_EXISTS"));}
        let rev=st.revision.checked_add(1).ok_or(err("REVISION_OVERFLOW"))?;
        let generation=st.generation.checked_add(1).ok_or(err("GENERATION_OVERFLOW"))?;
        st.lab=Some(SyntheticLedger{patches,applied:true,consumed:false});
        st.revision=rev;st.generation=generation;
        Ok(SyntheticStageReceipt{session_id:st.id,revision:rev,index_generation:generation,
            decoded_source_sha256:self.sha,applied:true,cross_domain_atomic:true,writer_authorized:false})
    }
    fn synthetic_toggle(&self,e:WorkerEnvelope,apply:bool)->CoreResult<SyntheticStageReceipt>{
        let mut st=self.lock()?;
        validate_scope(self,&st,&e,WorkerAction::Stage)?;
        let ledger=st.lab.as_ref().ok_or(err("SYNTHETIC_STAGE_REQUIRED"))?;
        if ledger.consumed {return Err(err("SYNTHETIC_EXPORT_CONSUMED"));}
        if ledger.applied==apply{return Err(err("SYNTHETIC_UNDO_REDO_STATE"));}
        let rev=st.revision.checked_add(1).ok_or(err("REVISION_OVERFLOW"))?;
        let generation=st.generation.checked_add(1).ok_or(err("GENERATION_OVERFLOW"))?;
        st.lab.as_mut().ok_or(err("SYNTHETIC_STAGE_REQUIRED"))?.applied=apply;
        st.revision=rev;st.generation=generation;
        Ok(SyntheticStageReceipt{session_id:st.id,revision:rev,index_generation:generation,
            decoded_source_sha256:self.sha,applied:apply,cross_domain_atomic:true,writer_authorized:false})
    }
    pub fn synthetic_undo(&self,e:WorkerEnvelope)->CoreResult<SyntheticStageReceipt>{
        self.synthetic_toggle(e,false)
    }
    pub fn synthetic_redo(&self,e:WorkerEnvelope)->CoreResult<SyntheticStageReceipt>{
        self.synthetic_toggle(e,true)
    }
    /// Only enabled for synthetic-stage-b native fixtures. Refuses real P1G,
    /// arbitrary output names, overwrite, replay and caller-chosen paths.
    /// A failed export attempt consumes this ledger; no false atomic-FS claim.
    pub fn synthetic_export_to_dir(&self,e:WorkerEnvelope,dir:&Path)->CoreResult<SyntheticExportReceipt>{
        let mut st=self.lock()?;
        validate_scope(self,&st,&e,WorkerAction::ExportEditedCopy)?;
        let lab=st.lab.as_ref().ok_or(err("SYNTHETIC_STAGE_REQUIRED"))?;
        if lab.consumed {return Err(err("SYNTHETIC_EXPORT_CONSUMED"));}
        if !lab.applied{return Err(err("SYNTHETIC_UNDO_NOT_RESTAGED"));}
        let edited=render(&self.decoded,&lab.patches)?;
        if sha(&edited)==self.sha{return Err(err("SYNTHETIC_NO_DIFF"));}
        // Mark BEFORE touching filesystem; error must not authorize retry.
        st.lab.as_mut().ok_or(err("SYNTHETIC_STAGE_REQUIRED"))?.consumed=true;
        let base=fs::canonicalize(dir).map_err(|_|err("SYNTHETIC_DIR_REQUIRED"))?;
        let original=base.join(SOURCE_NAME);
        let backup=base.join(BACKUP_NAME);
        let edited_path=base.join(EDIT_NAME);
        let meta=fs::symlink_metadata(&original).map_err(|_|err("SYNTHETIC_ORIGINAL_REQUIRED"))?;
        if !meta.file_type().is_file() || meta.len()>MAX_FIXTURE as u64 ||
            meta.file_type().is_symlink() {return Err(err("SYNTHETIC_NOT_REGULAR_ORIGINAL"));}
        // Existing destinations (including symlinks) are never overwritten.
        if fs::symlink_metadata(&backup).is_ok() || fs::symlink_metadata(&edited_path).is_ok(){
            return Err(err("SYNTHETIC_NO_OVERWRITE"));
        }
        verified_file(&original,&self.decoded)?;
        if sha(&self.decoded)!=self.sha{return Err(err("SYNTHETIC_ORIGINAL_SHA_CHANGED"));}
        reserve_new(&backup,&self.decoded)?;
        reserve_new(&edited_path,&edited)?;
        verified_file(&original,&self.decoded)?;
        let b=fs::read(&backup).map_err(|_|err("SYNTHETIC_BACKUP_REOPEN_FAILED"))?;
        let ecopy=fs::read(&edited_path).map_err(|_|err("SYNTHETIC_EDIT_REOPEN_FAILED"))?;
        if sha(&b)!=self.sha || sha(&ecopy)!=sha(&edited){return Err(err("SYNTHETIC_SHA_READBACK_MISMATCH"));}
        validate_entire_document(&ecopy,626)?;
        fixture_values(&ecopy)?;
        let generation=st.generation.checked_add(1).ok_or(err("GENERATION_OVERFLOW"))?;
        st.closed=true;st.generation=generation;
        Ok(SyntheticExportReceipt{decoded_source_sha256:self.sha,backup_sha256:sha(&b),
            edited_sha256:sha(&ecopy),original_unchanged:true,distinct_backup_verified:true,
            distinct_edited_verified:true,same_process_reopen_validated:true,
            fresh_process_reopen_validated:false,writer_authorized:false})
    }
    /// Used only by synthetic child-process proof; never product indexed reads.
    pub fn synthetic_fixture_counters(&self)->CoreResult<(i64,i64)> {
        let st=self.lock()?;
        if st.closed{return Err(err("SESSION_CLOSED"));}
        fixture_values(&self.decoded)
    }
}
