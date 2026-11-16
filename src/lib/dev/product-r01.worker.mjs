import {loadProtectedR01RustWasm,R01_RELEASE} from '../ddv/core/save/product-scoped-placement-release.mjs';
import {createProductSwitch626R01LocalAdapter} from '../ddv/core/save/product-scoped-amount-local-adapter.mjs';
import {installLocalR01DevWorker} from './local-scoped-edit-worker-port.mjs';
import {bootPlacement} from './product-placement-worker-boot.mjs';
void bootPlacement(loadProtectedR01RustWasm,createProductSwitch626R01LocalAdapter,installLocalR01DevWorker,R01_RELEASE.operation);
