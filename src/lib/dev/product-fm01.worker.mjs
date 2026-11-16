import {loadProtectedFm01RustWasm,FM01_RELEASE} from '../ddv/core/save/product-scoped-placement-release.mjs';
import {createProductSwitch626Fm01LocalAdapter} from '../ddv/core/save/product-scoped-amount-local-adapter.mjs';
import {installLocalFm01DevWorker} from './local-scoped-edit-worker-port.mjs';
import {bootPlacement} from './product-placement-worker-boot.mjs';
void bootPlacement(loadProtectedFm01RustWasm,createProductSwitch626Fm01LocalAdapter,installLocalFm01DevWorker,FM01_RELEASE.operation);
