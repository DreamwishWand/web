// CI ONLY: synthetic inputs permitted solely in the Stage H test harness.
import {installOwnerLocalSteamV1Worker}
  from '../../tools/owner-local-steam-v1/worker-core.mjs';
installOwnerLocalSteamV1Worker({
  allowSyntheticFixture:true,
  allowDevTypedMetadata:true
});
