import {loadProtectedFrp01RustWasm,FRP01_RELEASE} from '../ddv/core/save/product-scoped-placement-release.mjs';
import {createProductSwitch624Frp01LocalAdapter} from '../ddv/core/save/product-scoped-amount-local-adapter.mjs';
import {installLocalFrp01DevWorker} from './local-scoped-edit-worker-port.mjs';
import {bootPlacement} from './product-placement-worker-boot.mjs';
void bootPlacement(loadProtectedFrp01RustWasm,createProductSwitch624Frp01LocalAdapter,installLocalFrp01DevWorker,FRP01_RELEASE.operation);
