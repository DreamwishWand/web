import {loadProtectedFd01RustWasm,FD01_RELEASE} from '../ddv/core/save/product-scoped-placement-release.mjs';
import {createProductSwitch626Fd01LocalAdapter} from '../ddv/core/save/product-scoped-amount-local-adapter.mjs';
import {installLocalFd01DevWorker} from './local-scoped-edit-worker-port.mjs';
import {bootPlacement} from './product-placement-worker-boot.mjs';
void bootPlacement(loadProtectedFd01RustWasm,createProductSwitch626Fd01LocalAdapter,installLocalFd01DevWorker,FD01_RELEASE.operation);
