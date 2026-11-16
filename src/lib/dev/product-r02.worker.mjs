import {loadProtectedR02RustWasm,R02_RELEASE} from '../ddv/core/save/product-scoped-placement-release.mjs';
import {createProductSwitch626R02LocalAdapter} from '../ddv/core/save/product-scoped-amount-local-adapter.mjs';
import {installLocalR02DevWorker} from './local-scoped-edit-worker-port.mjs';
import {bootPlacement} from './product-placement-worker-boot.mjs';
void bootPlacement(loadProtectedR02RustWasm,createProductSwitch626R02LocalAdapter,installLocalR02DevWorker,R02_RELEASE.operation);
