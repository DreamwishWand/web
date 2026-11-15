//! Exact COMP03 shape shared by the existing native collector and future
//! product binding. No session, permissions, IO, private plan or coordinates.
//! Shape alone never proves occupancy, root, rights, references or eligibility.
use serde_json::{json, Value};

pub(super) const ROAD: u32 = 40100038;

pub(super) fn object(id: u32, x: u32, y: u32) -> Value {
    json!({"ID":id,"ItemID":ROAD,"X":x,"Y":y,"Orientation":"GridOrientation_Down","State":null})
}

/// Keep the seed; return exactly eight fresh records in saved row-major order.
/// Coordinates and allocator bounds mirror the accepted COMP03 collector.
/// Callers must still bind their own Core-minted target and ledger CAS.
pub(super) fn additions(next: u32, x: u32, y: u32) -> Option<Vec<Value>> {
    if next == 0 || next.checked_add(8)? > i32::MAX as u32
        || x % 4 != 0 || y % 4 != 0 || x.checked_add(12)? > 260
        || y.checked_add(12)? > 260 {
        return None;
    }
    let mut result = Vec::with_capacity(8);
    for dy in 0..3 {
        for dx in 0..3 {
            if dx == 0 && dy == 0 { continue; }
            result.push(object(next + result.len() as u32, x + 4 * dx, y + 4 * dy));
        }
    }
    Some(result)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn comp03_shape_exact_row_major_eight_and_bounds() {
        let rows = additions(100, 12, 16).unwrap();
        let expected = [(16,16),(20,16),(12,20),(16,20),(20,20),(12,24),(16,24),(20,24)];
        assert_eq!(rows.len(), 8);
        for (i, (x,y)) in expected.into_iter().enumerate() {
            assert_eq!(rows[i], json!({"ID":100+i as u32,"ItemID":40100038,"X":x,"Y":y,
                "Orientation":"GridOrientation_Down","State":null}));
        }
        assert!(additions(i32::MAX as u32 - 8, 248, 248).is_some());
        for (n,x,y) in [(0,0,0),(i32::MAX as u32-7,0,0),(u32::MAX,0,0),
            (10,1,0),(10,0,1),(10,252,0),(10,0,252),(10,u32::MAX,0),(10,0,u32::MAX)] {
            assert!(additions(n,x,y).is_none());
        }
    }
}
