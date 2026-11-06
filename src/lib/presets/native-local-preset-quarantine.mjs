/**
 * Extra diagnostics ONLY for imported schema624 PC backup files.
 * These warnings quarantine unsafe shapes without deleting unknown data,
 * recognizing a native source Build, or granting DDV game Save restoration.
 */
const record=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const positiveId=x=>Number.isSafeInteger(x)&&x>0;

export function nativeLocalPresetQuarantineWarnings(payload){
  const warnings=[];
  const gridCollection=record(payload?.GridCollection)?payload.GridCollection:null;
  if(!record(gridCollection?.DiffGrids))warnings.push('DIFF_GRIDS_MALFORMED');
  const grids=gridCollection?.Grids;
  if(record(grids)){
    for(const grid of Object.values(grids)){
      if(!record(grid)||!record(grid.Objects)){
        warnings.push('GRID_OBJECTS_MALFORMED');
        continue;
      }
      for(const item of Object.values(grid.Objects)){
        if(!record(item)){
          warnings.push('GRID_OBJECT_RECORD_MALFORMED');
          continue;
        }
        if(item.State!==null&&item.State!==undefined&&!record(item.State))
          warnings.push('GRID_OBJECT_STATE_MALFORMED');
        if(record(item.State)&&item.State.SubGrid!==null&&item.State.SubGrid!==undefined&&
           !record(item.State.SubGrid))
          warnings.push('SUBGRID_REFERENCE_MALFORMED');
      }
    }
  }
  if(!Array.isArray(payload?.ThumbnailItems)||payload.ThumbnailItems.some(x=>!positiveId(x)))
    warnings.push('THUMBNAIL_ITEM_ID_MALFORMED');
  return Object.freeze([...new Set(warnings)]);
}
