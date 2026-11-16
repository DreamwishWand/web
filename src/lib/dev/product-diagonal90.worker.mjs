import {loadProtectedDiagonal90RustWasm,DIAGONAL90_RELEASE} from '../ddv/core/save/product-scoped-placement-release.mjs';
import {createProductSwitch626Diagonal90LocalAdapter} from '../ddv/core/save/product-scoped-amount-local-adapter.mjs';
import {installLocalDiagonal90DevWorker} from './local-scoped-edit-worker-port.mjs';
import {bootPlacement} from './product-placement-worker-boot.mjs';
void bootPlacement(loadProtectedDiagonal90RustWasm,createProductSwitch626Diagonal90LocalAdapter,installLocalDiagonal90DevWorker,DIAGONAL90_RELEASE.operation);
