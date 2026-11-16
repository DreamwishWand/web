import {loadProtectedRm01RustWasm,RM01_RELEASE} from '../ddv/core/save/product-scoped-placement-release.mjs';
import {createProductSwitch626Rm01LocalAdapter} from '../ddv/core/save/product-scoped-amount-local-adapter.mjs';
import {installLocalRm01DevWorker} from './local-scoped-edit-worker-port.mjs';
import {bootPlacement} from './product-placement-worker-boot.mjs';
void bootPlacement(loadProtectedRm01RustWasm,createProductSwitch626Rm01LocalAdapter,installLocalRm01DevWorker,RM01_RELEASE.operation);
