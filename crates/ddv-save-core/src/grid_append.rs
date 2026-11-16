//! Shared lexical object-map append payload. Original Native Road
//! byte format; caller owns nonempty map, uniqueness, counter and geometry.
use crate::{CoreError,CoreResult};
use serde_json::Value;
pub(super) fn payload(records:&[Value])->CoreResult<Vec<u8>>{
    let mut insert=Vec::new();
    for o in records{
        let id=o["ID"].as_u64().and_then(|n|u32::try_from(n).ok()).ok_or(CoreError("RM01_PLAN_UINT"))?;
        insert.extend_from_slice(format!(",\"{id}\":").as_bytes());
        insert.extend_from_slice(&serde_json::to_vec(o).map_err(|_|CoreError("RM01_ENCODE"))?);
    }
    insert.push(b'}');Ok(insert)
}
