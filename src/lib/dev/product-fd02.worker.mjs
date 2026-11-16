import {loadProtectedFd02RustWasm,FD02_RELEASE} from '../ddv/core/save/product-scoped-placement-release.mjs';
import {createProductSwitch626Fd02LocalAdapter} from '../ddv/core/save/product-scoped-amount-local-adapter.mjs';
import {installLocalFd02DevWorker} from './local-scoped-edit-worker-port.mjs';
import {bootPlacement} from './product-placement-worker-boot.mjs';
void bootPlacement(loadProtectedFd02RustWasm,createProductSwitch626Fd02LocalAdapter,installLocalFd02DevWorker,FD02_RELEASE.operation);
