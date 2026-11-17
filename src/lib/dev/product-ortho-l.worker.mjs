import {loadProtectedOrthoLRustWasm,ORTHOL_RELEASE} from '../ddv/core/save/product-scoped-placement-release.mjs';
import {createProductSwitch626OrthoLLocalAdapter} from '../ddv/core/save/product-scoped-amount-local-adapter.mjs';
import {installLocalOrthoLDevWorker} from './local-scoped-edit-worker-port.mjs';
import {bootPlacement} from './product-placement-worker-boot.mjs';
void bootPlacement(loadProtectedOrthoLRustWasm,createProductSwitch626OrthoLLocalAdapter,installLocalOrthoLDevWorker,ORTHOL_RELEASE.operation);
