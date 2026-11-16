import {loadProtectedVaseAddRustWasm,VASE_ADD_RELEASE} from '../ddv/core/save/product-scoped-placement-release.mjs';
import {createProductSteam626VaseAddLocalAdapter} from '../ddv/core/save/product-scoped-amount-local-adapter.mjs';
import {installLocalVaseDevWorker} from './local-scoped-edit-worker-port.mjs';
import {bootPlacement} from './product-placement-worker-boot.mjs';
void bootPlacement(loadProtectedVaseAddRustWasm,createProductSteam626VaseAddLocalAdapter,installLocalVaseDevWorker,VASE_ADD_RELEASE.operation);
