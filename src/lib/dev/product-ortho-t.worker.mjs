import {loadProtectedOrthoTRustWasm,ORTHOT_RELEASE} from '../ddv/core/save/product-scoped-placement-release.mjs';
import {createProductSwitch626OrthoTLocalAdapter} from '../ddv/core/save/product-scoped-amount-local-adapter.mjs';
import {installLocalOrthoTDevWorker} from './local-scoped-edit-worker-port.mjs';
import {bootPlacement} from './product-placement-worker-boot.mjs';
void bootPlacement(loadProtectedOrthoTRustWasm,createProductSwitch626OrthoTLocalAdapter,installLocalOrthoTDevWorker,ORTHOT_RELEASE.operation);
