//! Streaming full-document syntax/duplicate-key scan. Does NOT assert Native
//! reference closure or build provenance. No whole serde_json::Value copy.
use crate::{CoreError, CoreResult};
use serde::de::{self, DeserializeSeed, Deserializer, MapAccess, SeqAccess, Visitor};
use std::{collections::HashSet, fmt};
const MAX_DEPTH: usize = 128;

struct AnySeed { depth: usize }
impl<'de> DeserializeSeed<'de> for AnySeed {
    type Value = ();
    fn deserialize<D: Deserializer<'de>>(self, deserializer: D) -> Result<(), D::Error> {
        if self.depth >= MAX_DEPTH { return Err(de::Error::custom("JSON_DEPTH_LIMIT")); }
        deserializer.deserialize_any(AnyVisitor { depth: self.depth })
    }
}
struct AnyVisitor { depth: usize }
impl<'de> Visitor<'de> for AnyVisitor {
    type Value = ();
    fn expecting(&self, f: &mut fmt::Formatter) -> fmt::Result { f.write_str("valid bounded JSON") }
    fn visit_bool<E: de::Error>(self, _: bool) -> Result<(), E> { Ok(()) }
    fn visit_i64<E: de::Error>(self, _: i64) -> Result<(), E> { Ok(()) }
    fn visit_u64<E: de::Error>(self, _: u64) -> Result<(), E> { Ok(()) }
    fn visit_f64<E: de::Error>(self, _: f64) -> Result<(), E> { Ok(()) }
    fn visit_str<E: de::Error>(self, _: &str) -> Result<(), E> { Ok(()) }
    fn visit_string<E: de::Error>(self, _: String) -> Result<(), E> { Ok(()) }
    fn visit_unit<E: de::Error>(self) -> Result<(), E> { Ok(()) }
    fn visit_none<E: de::Error>(self) -> Result<(), E> { Ok(()) }
    fn visit_some<D: Deserializer<'de>>(self, d: D) -> Result<(), D::Error> {
        AnySeed { depth: self.depth + 1 }.deserialize(d)
    }
    fn visit_seq<S: SeqAccess<'de>>(self, mut seq: S) -> Result<(), S::Error> {
        while seq.next_element_seed(AnySeed { depth: self.depth + 1 })?.is_some() {}
        Ok(())
    }
    fn visit_map<M: MapAccess<'de>>(self, mut map: M) -> Result<(), M::Error> {
        let mut keys = HashSet::new();
        while let Some(key) = map.next_key::<String>()? {
            if !keys.insert(key) { return Err(de::Error::custom("JSON_DUPLICATE_KEY")); }
            map.next_value_seed(AnySeed { depth: self.depth + 1 })?;
        }
        Ok(())
    }
}
struct RequiredObjectSeed { depth: usize }
impl<'de> DeserializeSeed<'de> for RequiredObjectSeed {
    type Value = ();
    fn deserialize<D: Deserializer<'de>>(self, d: D) -> Result<(), D::Error> {
        d.deserialize_map(AnyVisitor { depth: self.depth })
    }
}
struct GameInfoSeed { schema: u64 }
impl<'de> DeserializeSeed<'de> for GameInfoSeed {
    type Value = ();
    fn deserialize<D: Deserializer<'de>>(self, d: D) -> Result<(), D::Error> {
        d.deserialize_map(GameInfoVisitor { schema: self.schema })
    }
}
struct GameInfoVisitor { schema: u64 }
impl<'de> Visitor<'de> for GameInfoVisitor {
    type Value = ();
    fn expecting(&self, f: &mut fmt::Formatter) -> fmt::Result { f.write_str("GameInfo object") }
    fn visit_map<M: MapAccess<'de>>(self, mut map: M) -> Result<(), M::Error> {
        let mut keys = HashSet::new();
        let mut version_found = false;
        while let Some(key) = map.next_key::<String>()? {
            if !keys.insert(key.clone()) { return Err(de::Error::custom("JSON_DUPLICATE_KEY")); }
            if key == "Version" {
                let version = map.next_value::<u64>()?;
                if version != self.schema { return Err(de::Error::custom("SAVE_SCHEMA_MISMATCH")); }
                version_found = true;
            } else {
                map.next_value_seed(AnySeed { depth: 2 })?;
            }
        }
        if !version_found { return Err(de::Error::custom("SAVE_SCHEMA_REQUIRED")); }
        Ok(())
    }
}
struct RootSeed { schema: u64 }
impl<'de> DeserializeSeed<'de> for RootSeed {
    type Value = ();
    fn deserialize<D: Deserializer<'de>>(self, d: D) -> Result<(), D::Error> {
        d.deserialize_map(RootVisitor { schema: self.schema })
    }
}
struct RootVisitor { schema: u64 }
impl<'de> Visitor<'de> for RootVisitor {
    type Value = ();
    fn expecting(&self, f: &mut fmt::Formatter) -> fmt::Result { f.write_str("DDV root JSON object") }
    fn visit_map<M: MapAccess<'de>>(self, mut map: M) -> Result<(), M::Error> {
        let mut keys = HashSet::new();
        let mut game_info = false;
        let mut player = false;
        let mut world = false;
        while let Some(key) = map.next_key::<String>()? {
            if !keys.insert(key.clone()) { return Err(de::Error::custom("JSON_DUPLICATE_KEY")); }
            match key.as_str() {
                "GameInfo" => { map.next_value_seed(GameInfoSeed { schema: self.schema })?; game_info = true; }
                "Player" => { map.next_value_seed(RequiredObjectSeed { depth: 1 })?; player = true; }
                "World" => { map.next_value_seed(RequiredObjectSeed { depth: 1 })?; world = true; }
                _ => { map.next_value_seed(AnySeed { depth: 1 })?; }
            }
        }
        if !(game_info && player && world) { return Err(de::Error::custom("SAVE_REQUIRED_ROOT_MISSING")); }
        Ok(())
    }
}
pub(crate) fn validate_entire_document(bytes: &[u8], schema: u64) -> CoreResult<()> {
    let mut decoder = serde_json::Deserializer::from_slice(bytes);
    RootSeed { schema }.deserialize(&mut decoder)
        .and_then(|()| decoder.end())
        .map_err(|_| CoreError("FULL_DOCUMENT_VALIDATION_DENIED"))
}
