// One fixed COMP03 route; the protected build chooses the optional release.
// Null means no optional release configured. Any other value MUST pass the
// existing spatial mount/anchor validation; never downgrade on rejection.
// Neither query parameters nor Worker method discovery can select a runtime.
import {PROTECTED_COMP03_SPATIAL_RELEASE_ANCHOR} from '../ddv/core/save/product-scoped-comp03-spatial-release-anchor.mjs';
import {createProductComp03Port,createProductComp03SpatialPort} from './product-placement-client.mjs';

export function createComp03ReviewPort(options){
 return (PROTECTED_COMP03_SPATIAL_RELEASE_ANCHOR===null?createProductComp03Port:createProductComp03SpatialPort)(options);
}
