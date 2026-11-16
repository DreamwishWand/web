import {loadProtectedFd03RustWasm,FD03_RELEASE} from '../ddv/core/save/product-scoped-placement-release.mjs';
import {createProductSwitch626Fd03LocalAdapter} from '../ddv/core/save/product-scoped-amount-local-adapter.mjs';
import {installLocalFd03DevWorker} from './local-scoped-edit-worker-port.mjs';
import {bootPlacement} from './product-placement-worker-boot.mjs';
void bootPlacement(loadProtectedFd03RustWasm,createProductSwitch626Fd03LocalAdapter,installLocalFd03DevWorker,FD03_RELEASE.operation);
