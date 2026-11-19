// 08 WEB: exact signed per-Operation V2 release evidence from an existing
// protected-issuer WeakMap-branded Product Port. This pure shape check does
// NOT authenticate arbitrary caller objects or mint a product capability.
// The Port's release scope was authenticated before the Worker was created.
import {STEAM626_FULL_VERSION,SWITCH626_CHEST_BID} from './local-amount-workflow.mjs';
const sha=x=>typeof x==='string'&&/^[0-9a-f]{64}$/.test(x);
const exact=(x,k)=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&
  Object.getPrototypeOf(x)===Object.prototype&&Object.keys(x).sort().join(',')===k.split(',').sort().join(',');
const profiles=Object.freeze({
  'steam-chest':Object.freeze({operation:'steam626.chest.exact1',platform:'steam-windows',buildId:STEAM626_FULL_VERSION}),
  'switch-chest':Object.freeze({operation:'switch626.chest.exact1',platform:'switch',buildId:SWITCH626_CHEST_BID}),
  'switch-catalog0':Object.freeze({operation:'switch626.catalog0.exact1',platform:'switch',buildId:SWITCH626_CHEST_BID})
});
export function acceptedProductAmountReleaseV2Evidence(scope,profile){
  const expected=Object.hasOwn(profiles,profile)?profiles[profile]:null;
  if(!expected||!exact(scope,'releaseId,operation,mode,builds')||!Object.isFrozen(scope)||
    scope.mode!=='public-accepted'||scope.operation!==expected.operation||!sha(scope.releaseId)||
    !Array.isArray(scope.builds)||!Object.isFrozen(scope.builds)||scope.builds.length!==1)return null;
  const build=scope.builds[0];
  if(!exact(build,'platform,buildId,productV2EvidenceSha256')||!Object.isFrozen(build)||
    build.platform!==expected.platform||build.buildId!==expected.buildId||
    !sha(build.productV2EvidenceSha256))return null;
  return Object.freeze({contract:'wand.product.amount.release-v2-evidence@1',
    releaseId:scope.releaseId,operation:scope.operation,
    platform:build.platform,buildId:build.buildId,
    productV2EvidenceSha256:build.productV2EvidenceSha256});
}

// Loopback/private Product V2 uses the SAME signed ProductPort/Build but has
// deliberately NO accepted OS-process evidence yet: it is the scope for
// obtaining that evidence on the official product route. It cannot be public.
export function acceptedProductAmountPrivateV2Scope(scope,profile){
  const expected=Object.hasOwn(profiles,profile)?profiles[profile]:null;
  if(!expected||!exact(scope,'releaseId,operation,mode,builds')||!Object.isFrozen(scope)||
    scope.mode!=='private-product-v2'||scope.operation!==expected.operation||!sha(scope.releaseId)||
    !Array.isArray(scope.builds)||!Object.isFrozen(scope.builds)||scope.builds.length!==1)return null;
  const build=scope.builds[0];
  if(!exact(build,'platform,buildId,productV2EvidenceSha256')||!Object.isFrozen(build)||
    build.platform!==expected.platform||build.buildId!==expected.buildId||
    build.productV2EvidenceSha256!==null)return null;
  return Object.freeze({contract:'wand.product.amount.private-v2-scope@1',
    releaseId:scope.releaseId,operation:scope.operation,
    platform:build.platform,buildId:build.buildId,productV2EvidenceSha256:null});
}
