// Explicit opt-in Owner-local DEV typed metadata Worker. Product route remains OFF.
import {installOwnerLocalSteamV1Worker} from './worker-core.mjs';
installOwnerLocalSteamV1Worker({
  allowSyntheticFixture:false,
  allowDevTypedMetadata:true
});
