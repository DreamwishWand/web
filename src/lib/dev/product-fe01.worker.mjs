import {loadProtectedFe01RustWasm,FE01_RELEASE} from '../ddv/core/save/product-scoped-placement-release.mjs';
import {createProductSwitch626Fe01LocalAdapter} from '../ddv/core/save/product-scoped-amount-local-adapter.mjs';
import {installLocalFe01DevWorker} from './local-scoped-edit-worker-port.mjs';
import {bootPlacement} from './product-placement-worker-boot.mjs';
void bootPlacement(loadProtectedFe01RustWasm,createProductSwitch626Fe01LocalAdapter,installLocalFe01DevWorker,FE01_RELEASE.operation);
