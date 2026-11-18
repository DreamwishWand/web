// DEC-UX-06: derive Universe choices from VERIFIED decoration records in
// the current family, not from the global Collection Universe dictionary.
// Presentation only: no new taxonomy, ItemID/ownership/placement changes.
export function decorationFamilyUniverses(records, family=''){
  if(!Array.isArray(records))return [];
  const unique=new Set();
  for(const record of records){
    if(!record || typeof record!=='object' || (family && record.family!==family) || !Array.isArray(record.universes))continue;
    for(const universe of record.universes){
      if(typeof universe==='string' && universe.length>0)unique.add(universe);
    }
  }
  return [...unique];
}

export function reconcileDecorationUniverse(selected, available){
  return typeof selected==='string' && Array.isArray(available) && available.includes(selected) ? selected : '';
}
