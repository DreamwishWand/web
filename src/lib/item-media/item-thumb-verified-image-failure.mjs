// Shared ItemThumb view-only failure lifetime, no media release authority.
// A fresh independently revalidated manifest may retry the same signed WebP
// after a transient 404/CDN error. A stale old <img> event cannot hide a new
// catalog URL. The sole publication/rights gate is upstream manifest validation.
export function createVerifiedItemThumbFailureGate(){
  let verifiedCatalog=null,failedHref=null;
  return Object.freeze({
    visibleHref(status,catalog,href,_errorEpoch){
      if(status!=='VERIFIED'||!catalog||typeof catalog!=='object'){
        verifiedCatalog=null;failedHref=null;return null;
      }
      if(catalog!==verifiedCatalog){verifiedCatalog=catalog;failedHref=null}
      return typeof href==='string'&&href.startsWith('/')&&href!==failedHref?href:null;
    },
    rejectFailed(catalog,failedSrc,renderHref){
      if(!catalog||catalog!==verifiedCatalog||typeof failedSrc!=='string'||
         failedSrc!==renderHref||!failedSrc.startsWith('/'))return false;
      failedHref=failedSrc;
      return true;
    }
  });
}
