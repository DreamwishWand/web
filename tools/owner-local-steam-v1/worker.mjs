// Separate, explicitly chosen Owner-local worker. Not a product/public import.
import {installOwnerLocalSteamV1Worker} from './worker-core.mjs';
installOwnerLocalSteamV1Worker({allowSyntheticFixture:false});
