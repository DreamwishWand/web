// Current-version ItemThumb policy, built over accepted shared ItemThumb/Preferences.
// This is a *public release gate*, not a native game-reader or rights license.
// ACT456: 60 exact independently raster/visibility-accepted Switch1253 pins.
// ACT385/397 original 2 + ACT429 37 DXT5 + ACT442 21 ASTC. Hidden/HOLD excluded.
// Private union manifest SHA256 9d152d47c8d780cdf6b8a5109c43089a1bfb6d67c7c2d2daf838cb29a27ca944.
// Reconstructed PNG is not a first-party stored PNG or device GPU parity.
// No game pixels, personal Save, or private binaries in this source or CI.
import { writable } from 'svelte/store';
import {ITEM_IMAGE_OWNER_DECISION_ID} from './public-item-images.mjs';
export const SWITCH1253_OWNER_SCOPE='RELEASED_PLAYER_FACING_ITEM_THUMBNAILS';

export const SWITCH1253_ITEM_IMAGE_SCHEMA='wand.item-images.switch1253-release@1';
export const SWITCH1253_ITEM_IMAGE_VARIANT='switch-1.25.3-schema626-lossless160-v1';
export const SWITCH1253_MANIFEST_PATH='ddv/item-images/'+SWITCH1253_ITEM_IMAGE_VARIANT+'/manifest.json';
export const SWITCH1253_TARGET=Object.freeze({
  platform:'Nintendo Switch',gameVersion:'1.25.3',
  buildID:'9A239D3DB569756D',schema:626
});
export const SWITCH1253_ORIGINAL_BUNDLE_SHA256='346d9da74c03d93e3db71fe703724a7a1cadf72aa693474da813765e9f54f5ff';
export const SWITCH1253_NATIVE_PINS=Object.freeze({
  '40000047':Object.freeze({
    originalNativeStreamSha256:'b0352f4fde178c423dbfa0f02c1f3f6fbfdb24bd4edf2603b67ce2f74485a68c',
    sourcePngSha256:'c156d4e1a32de6e61a851704349f17333098bab39f20ace06f56a7ecf591cc26',
    webpSha256:'b3d130ebf054038655970ed6b9a963b387b2c82be4a1658c2835775ac61d1f54',
    rasterStatus:'SWITCH_ASTC6X6_SRGB_RGBA_EXACT_PRIVATE'
  }),
  '40006096':Object.freeze({
    originalNativeStreamSha256:'41622bafd70f97eef4d34eef63db0b4c3be6e85a29f400b7c8bceee370b77b13',
    sourcePngSha256:'41fd7dcaf0f4a6ae2b43cd29d111245b0be49873a04e4f7c42c6d572199f78c3',
    webpSha256:'4d2cbdf8cac7ad46ee5f7baa112ae5af34d2fc05de271db1a49d98d003a03858',
    rasterStatus:'SWITCH_DXT5_RGBA_EXACT_PRIVATE'
  }),
  '40000086':Object.freeze({originalNativeStreamSha256:'09ea94e1ed5790ff4c05ddfeea396ff7cfff5e3751cd2a4a84bf9a4f18268aa7',sourcePngSha256:'94ebc1b9ce7e418f5777322ef48d81a1b40055f88d5fdaeaf06a3972871c153e',webpSha256:'3656dc7371206920b4682e02ca62257a8a36193603a17914d79ed3efa80ad333',rasterStatus:'SWITCH_ASTC6X6_SRGB_RGBA_EXACT_PRIVATE'}),
  '40000166':Object.freeze({originalNativeStreamSha256:'2ae0e73381f362fe19851a2ceecdb0297e72524760d7657c1c42a1689f32f7c3',sourcePngSha256:'b7043a0fff34dd9c208708d73f030842e33e4d241de9cf402087ffdf700405b0',webpSha256:'f92b4bd09ef2194406588aecbe4540e0c926d1a8c54fc1e618b633130afd7e15',rasterStatus:'SWITCH_ASTC6X6_SRGB_RGBA_EXACT_PRIVATE'}),
  '40000342':Object.freeze({originalNativeStreamSha256:'44288c762c1d7ef2f23d2031c6651526cd77f1c379bb1069f32750f884f3111f',sourcePngSha256:'e66454791fca4492cf4c01dbb7c207347f5cd5353d143d7ae529adee3671b3b3',webpSha256:'831a8293c38c415a1fd6baccac8a2374582d5dbfb5ae8d1881d3da14b6e4d868',rasterStatus:'SWITCH_ASTC6X6_SRGB_RGBA_EXACT_PRIVATE'}),
  '40000350':Object.freeze({originalNativeStreamSha256:'19760772c713855f975a015da1b9299f4af2e6abbec6ef9587ffa26c7daa7bc1',sourcePngSha256:'4bac427feed2f7e36a81c640fd1b3ef4d829e8ec1593c4682e219e743be715a2',webpSha256:'cc0c772f90fb2a4201c6998efcd73dfdf9a41354cc58d4bb673211df2187d442',rasterStatus:'SWITCH_ASTC6X6_SRGB_RGBA_EXACT_PRIVATE'}),
  '40000353':Object.freeze({originalNativeStreamSha256:'d16638b66203de3493d03e1b7f3d83ab52d2612b87144189da19d31445f1fc68',sourcePngSha256:'024790f5ca6105e1cce53bea70e4a890f95129bc270d525d9f6546be052a1c6a',webpSha256:'1686dfde2593ec6caad6e741fe3cec6886300f4f40a9f7a535943add3a2d1717',rasterStatus:'SWITCH_ASTC6X6_SRGB_RGBA_EXACT_PRIVATE'}),
  '40000384':Object.freeze({originalNativeStreamSha256:'6b5178ea6b6bf1f93d51311a6a77e64d1a03998f02d3049e10599e4567ff5404',sourcePngSha256:'71d3143ab77ffb0208322447d7eb634f4018f07795330b56367ea821ca1fe28f',webpSha256:'89bb19317a13b39d6501db3ac482838616d407232278b72dd1ad0f6dea7313a5',rasterStatus:'SWITCH_ASTC6X6_SRGB_RGBA_EXACT_PRIVATE'}),
  '40000387':Object.freeze({originalNativeStreamSha256:'cc58a122612371c61b8efeb52fe0bae512af1f3a3969c3f71526acc9d918c0bb',sourcePngSha256:'324815b98d560f1e58d7f93fbca4989a837cee47b1091443c55d4c39ec88c87b',webpSha256:'eef3b631499cda6b6994810ada85ea653361f5b49289bc2b845e82986a9565c2',rasterStatus:'SWITCH_ASTC6X6_SRGB_RGBA_EXACT_PRIVATE'}),
  '40000428':Object.freeze({originalNativeStreamSha256:'fe72b64e8417ca91d03b9896334f4492ac2ecfdf8b9f5dd27d4d4c6b1873ee71',sourcePngSha256:'3a3aab8f05feb3d60a68e0afa37ab9426e77ea55ff71b844c39ffa28fb38ed8b',webpSha256:'2f71557f96453ca4e7ed87ea729924a056339fa56c6967716a6a439e02e78423',rasterStatus:'SWITCH_ASTC6X6_SRGB_RGBA_EXACT_PRIVATE'}),
  '40000486':Object.freeze({originalNativeStreamSha256:'954b8357d350455b95f92ede790b968466bf54b38a0fdf50137f0e6667f053c9',sourcePngSha256:'e8a6a16eb6de7414685dad3b1c889074bd2ddfce150632aa6c79e0dafb7e6b64',webpSha256:'2096b286bc7293f5baaa1a35875d1ca728fa12c86dcb6db04b172b25d3a57d77',rasterStatus:'SWITCH_ASTC6X6_SRGB_RGBA_EXACT_PRIVATE'}),
  '40000575':Object.freeze({originalNativeStreamSha256:'fc2118911d804d7292eb9e5202cfdbe779e3a3e11c8df6ef962f0d746df34526',sourcePngSha256:'51247d0adbc6afdf8ccdb5cce0466e79e619d0bf499247ce8a7db070f5b4461c',webpSha256:'de8f95ebc2bca6dd6f11c8cd353c1391288d178a57fbc7b5b61f465fcdda5144',rasterStatus:'SWITCH_ASTC6X6_SRGB_RGBA_EXACT_PRIVATE'}),
  '40001334':Object.freeze({originalNativeStreamSha256:'c23e8030c7554fe947ce6fa4407dacbbf4b0f9ba7dad8e9bc70500c30f8d5c73',sourcePngSha256:'1c5eb9667dc5949ad783d16b6e66c0abfa7e04de2c8a233721f9f3ccbd690712',webpSha256:'801081d4749e3d0f13ac6954dec3722265d295a3e204ad987b7530d90281a65f',rasterStatus:'SWITCH_ASTC6X6_SRGB_RGBA_EXACT_PRIVATE'}),
  '40001336':Object.freeze({originalNativeStreamSha256:'51a23c317171b7b07d6afac2f4ea2fabaa6b1c987d00f36656b0b4d97efa4658',sourcePngSha256:'2bd5e59b730852eea2767cdd9c2def127803ee3c6821a2e6e9d4cd5bcbec92d0',webpSha256:'c4094b3828ac314f2dc1a98e4c19d27385929a90fcf94fd4e3bf20e2fc77df55',rasterStatus:'SWITCH_ASTC6X6_SRGB_RGBA_EXACT_PRIVATE'}),
  '40001678':Object.freeze({originalNativeStreamSha256:'6badc9f9c08f0439c29b800ff11a5724cdeb480c3138860fcab9b454eed28aeb',sourcePngSha256:'24a2feeeddbe1fbe268d951cc0aaa9f038b90aa77109be9626cacc643eba8f5a',webpSha256:'79819cfea5ecbca9d4993503b453f2ba74ce88caaf57f9af5fe8287207dd0185',rasterStatus:'SWITCH_ASTC6X6_SRGB_RGBA_EXACT_PRIVATE'}),
  '40001756':Object.freeze({originalNativeStreamSha256:'11e609383c6883b848768a92ecbacb2444b9e4a03adae346752887fe468cd107',sourcePngSha256:'3031627933cf6de6e726436fcdadd5044d0cf116446d1c08fd1f65072e58fc0d',webpSha256:'3561bbf4d71486b7cf4e069ad8a3627bdf30dd2456ca8e20be9fe9d16ab3494a',rasterStatus:'SWITCH_ASTC6X6_SRGB_RGBA_EXACT_PRIVATE'}),
  '40001863':Object.freeze({originalNativeStreamSha256:'7c1216cdeec817cb09cb0bba9d87dc9ea337a4d1a50d432fc9b8ff7e50a6a82e',sourcePngSha256:'7187da05be6f01c3f608bd760f693886608e928bf7c8f3493c961e5b5bba1907',webpSha256:'81e95fca3b9bf598d9514053d884da0b56f8248e15293ca3bcc5d2b589eddb5e',rasterStatus:'SWITCH_ASTC6X6_SRGB_RGBA_EXACT_PRIVATE'}),
  '40001864':Object.freeze({originalNativeStreamSha256:'9d1b6a0ea195e948832a003640c41749f1d983d3cb638bba468328a55ab51541',sourcePngSha256:'0441853a42159ddc2e540b54e830a620029cc01c82c940929f2c013300564a89',webpSha256:'2f347cec3afa42caad635a68182d04c78b3eb14fdc56f4d584685703e02d9485',rasterStatus:'SWITCH_ASTC6X6_SRGB_RGBA_EXACT_PRIVATE'}),
  '40001994':Object.freeze({originalNativeStreamSha256:'52dc7a9fb0110728b35692fbfdae00e84fd225ef31f1bccc3466b0993c40db55',sourcePngSha256:'9f27f3a29de009ab8a371cb58abdc2d8f12f6c08e29eb12fb8e1430ee3d9b8fb',webpSha256:'97463a0faa71053eca4885223bbd3484b81b12f7f9bf890d8685aa47d83b5a49',rasterStatus:'SWITCH_ASTC6X6_SRGB_RGBA_EXACT_PRIVATE'}),
  '40001995':Object.freeze({originalNativeStreamSha256:'3c4c6966b0253f4497566aa117e18ea1567de351311bc22dc69e336dd632b440',sourcePngSha256:'986ab24f02b720e95678e0c6165387955255f07cec08c88101a0b2d116cf7dba',webpSha256:'7e07d2af40cc221f1017aea5986c02f87d66e2c86d8f71417a134fa99622655d',rasterStatus:'SWITCH_ASTC6X6_SRGB_RGBA_EXACT_PRIVATE'}),
  '40001996':Object.freeze({originalNativeStreamSha256:'9b01aa841174173b25a1cae49a536d82ae3b6a487527201ec98a24208850491e',sourcePngSha256:'2f1e81e699538379fb2bcb59603b51fe0667c3a364b145fd6a33957c5c17325e',webpSha256:'6def13d186aa3541d85da75abba12672403a6e1b9d27cf7f18ec417b3051a93c',rasterStatus:'SWITCH_ASTC6X6_SRGB_RGBA_EXACT_PRIVATE'}),
  '40002002':Object.freeze({originalNativeStreamSha256:'699a63606ba5dc2fdd6617c56e706f9e2eeccd576a819755d4ba7b3edb1af4c8',sourcePngSha256:'5921c2a895e55a059d49c43230ab51068b83fda197d508050672d34783804d02',webpSha256:'8436b76e6040964e46047b01cddaab42e4a33ce272ecaf1e67a83117944c452e',rasterStatus:'SWITCH_ASTC6X6_SRGB_RGBA_EXACT_PRIVATE'}),
  '40004581':Object.freeze({originalNativeStreamSha256:'4183b68d34caaef472413a3053cfea472f7665604d029df832b052f8a7fb3a0a',sourcePngSha256:'ad54d6737a8714c2fb3c5336c041a5d4ef72702160dab3352f7c0134c245752a',webpSha256:'db178eedadeabc49134ab5878595cb7e0dfadd91e2d0b31fb561a4ee7dbc3155',rasterStatus:'SWITCH_DXT5_RGBA_EXACT_PRIVATE'}),
  '40004837':Object.freeze({originalNativeStreamSha256:'f8735402f7c18b51f61e0d1f089abdf1427cf81c4e76c01a661fe67c755bd5b2',sourcePngSha256:'9c3a83c0b0796878483e6684bfef8272f1b22ac67baa2eda8f1ca6e607926fcb',webpSha256:'624e208dafcb46740d42101adec974bcfb33cb00148073b0d0eeee969ba57e80',rasterStatus:'SWITCH_DXT5_RGBA_EXACT_PRIVATE'}),
  '40004964':Object.freeze({originalNativeStreamSha256:'b9aef00a8d9219915ddb73bccb3ae97f5c4bfa4eb7e8a701bd99c661567a2846',sourcePngSha256:'6f1dc1005eb6dcb3a8b63e9799c2300bc849f57b32910514118aef51be88b8e3',webpSha256:'84fc2b1a52ff96f6491375cc34e5b175dd94198c50851698a297e4c76d3947a4',rasterStatus:'SWITCH_DXT5_RGBA_EXACT_PRIVATE'}),
  '40004979':Object.freeze({originalNativeStreamSha256:'208414232733c59a841c47697edb2c727b559aa5592e0a4256c273381e33d949',sourcePngSha256:'ea01ea0123999e90504e15f243d2e3748aa419c149f54b3d3c97d2b3788e4226',webpSha256:'a01d6a9fb4a3b3237be9acd9d7fb23c536b0b2ca47a1c5e90a995bf8ca6d2689',rasterStatus:'SWITCH_DXT5_RGBA_EXACT_PRIVATE'}),
  '40005017':Object.freeze({originalNativeStreamSha256:'3a6a541743e790f121724e4b523cc278a9d156acd52cb4529d25c4a22cd4a841',sourcePngSha256:'5727cdb64df00e5ce96c5af16a98e44f8f403dfc81b7215aeccfe830481fd9bb',webpSha256:'3802c5b8d2c887c2d3ef8900eb1ac2e7c285b121646b743611ba85b439d91cb1',rasterStatus:'SWITCH_DXT5_RGBA_EXACT_PRIVATE'}),
  '40005025':Object.freeze({originalNativeStreamSha256:'285b15d0d42a52d48a61a3fb97c5ba8ec6d5fa42f4bdf47f042141c0c153ff97',sourcePngSha256:'a574c75146f96c2354c6750968a0c9f9145acf6f6822ed56c5d5059adefcd09b',webpSha256:'379f21071cd0b0dde665ba5a0f40ec76c5b054c8265dd62bebfc4f9ad42935dc',rasterStatus:'SWITCH_DXT5_RGBA_EXACT_PRIVATE'}),
  '40005033':Object.freeze({originalNativeStreamSha256:'ddc6777c2a65e4324754c501c77ea451a31cddfa0e1e9022e5a4efb321bc3a0b',sourcePngSha256:'65e8bb4f365058f559a6592c15e28ea6f689e18787eb0aec031144fa79472932',webpSha256:'d45016d7864b6dfd643f3f2b2d16f9c0aecae4b7fdb090a6c7fc3d1d39a3c4d6',rasterStatus:'SWITCH_DXT5_RGBA_EXACT_PRIVATE'}),
  '40005110':Object.freeze({originalNativeStreamSha256:'369b7987e007fe8e0807df252446fab835110469befc40446f5520c5df26b784',sourcePngSha256:'1591ccbbdd0c6df86077503436f8042d642a82985566492b8d0d58f80014934a',webpSha256:'9cfbf4fb8b67a4db402d18b0834cfb080e96f6fa30d48c5dd7b4cd063a630142',rasterStatus:'SWITCH_DXT5_RGBA_EXACT_PRIVATE'}),
  '40005111':Object.freeze({originalNativeStreamSha256:'8eb6d939fb84d8b393eb226c3b79f7062fa6473d4a5357dd27fa3833fcfb8aa3',sourcePngSha256:'662fdde45aebd3c272f668eb0b0822500103fe7b72cccd63a34b5c37cf387faa',webpSha256:'b9ef2767472acbbd85aec5592b29fed3a22d49e0b3226163365b2a3be2ee65c8',rasterStatus:'SWITCH_DXT5_RGBA_EXACT_PRIVATE'}),
  '40005150':Object.freeze({originalNativeStreamSha256:'6a31411366e2c0005282ac0a72c4e8cabc45390274bba6c0892d3de2245cb3e7',sourcePngSha256:'2b3989ea0b87d9cd2a708fb18d52fd863fcc0184fbc6417ae658b9487116f14c',webpSha256:'fa04733b437b46aa02ef799e96ab8ed9f29a4c5f42e7ed5ecac883924449deef',rasterStatus:'SWITCH_DXT5_RGBA_EXACT_PRIVATE'}),
  '40005239':Object.freeze({originalNativeStreamSha256:'4fc2e44a372d9a3f9b1aaa16169bdaab06fac24f8d32e048b177515a59ef8b63',sourcePngSha256:'7cb3d9f7a5d3b3f5f88c13b2de296ed94323eb07db1150abe825b693caa5743e',webpSha256:'4dad2361ef521431487a2c64d1de8de1c3a09e249484bd493191f0713184e513',rasterStatus:'SWITCH_DXT5_RGBA_EXACT_PRIVATE'}),
  '40005252':Object.freeze({originalNativeStreamSha256:'f4853956b2accb9c2956ad224fafd8a6129a10ca3130506b133a072219fa61d2',sourcePngSha256:'17d6442612f9ede4c2381ca18b8f5162ac877821bf37a654f7834be9d638b912',webpSha256:'cea255744d1b8f99639022c958f2faadfec04c3a1018d0cb563f949496f316dc',rasterStatus:'SWITCH_DXT5_RGBA_EXACT_PRIVATE'}),
  '40005253':Object.freeze({originalNativeStreamSha256:'8d9d3e2a24096f2950acb158a073c3f3f25d956efd06e465b8d00e7a591a638f',sourcePngSha256:'d2b8d7ec5553a1eeba4a519b7b0ffe7c57a5e5ebf0202da03c85a4d3447b6b33',webpSha256:'ae0cdf7edb0fbb8e829ddb492f95d866b9d07f24d2d0434c148a4cc36ec67170',rasterStatus:'SWITCH_DXT5_RGBA_EXACT_PRIVATE'}),
  '40005267':Object.freeze({originalNativeStreamSha256:'baa08d94784a4d7603e6e2e80508443ae90e14fb72ef7b69da65cdab5d206bf0',sourcePngSha256:'c19fc94b22865e7eb67e33e500b5a55612d10ac1ff2cf2436d39f9568a4b6849',webpSha256:'5d23fc430d713ecf5257d0a389994c22c476d08db2ded941fc8914227f21da0b',rasterStatus:'SWITCH_DXT5_RGBA_EXACT_PRIVATE'}),
  '40005269':Object.freeze({originalNativeStreamSha256:'6e588f3a24d59a20dc551448679b7207503a779c3c5868cad3a18d768a5bad72',sourcePngSha256:'5776afe9d4c442574573a9f08bea0bbf7014288d7a179745fca1d0b74df8df1a',webpSha256:'ff759f0dc7c865fe151cc2dbae3ea192f84561bfb6b0a8235b6b741f76dc40b0',rasterStatus:'SWITCH_DXT5_RGBA_EXACT_PRIVATE'}),
  '40005413':Object.freeze({originalNativeStreamSha256:'a11c4ea00b07a2492dbd4fcca2cebb95ebf2ed0a38af3d56ef072dca7235f778',sourcePngSha256:'321cb6ae769505db611272390538673b7f39a64c4affefc0a5fdad22086543a0',webpSha256:'b0c61ca0779ddcdcf4670508b07cc928861e304759213cde47a8fefc62788aac',rasterStatus:'SWITCH_DXT5_RGBA_EXACT_PRIVATE'}),
  '40005415':Object.freeze({originalNativeStreamSha256:'d7dbf86af82b772fd6da48f2454711fb7295b3a914600eee11332b681b3300fd',sourcePngSha256:'62e021a42843b18c22efa42057ed35baf385cfa86c2c314a969de21affcc1c78',webpSha256:'eb8cbdc54f4b6e61964feb1e809a0b81bc4c01dc5c4be9e389164ecb3ca236c4',rasterStatus:'SWITCH_DXT5_RGBA_EXACT_PRIVATE'}),
  '40005431':Object.freeze({originalNativeStreamSha256:'f3c106146390007e72e644f7050bfd85d8b33dc293078587982ff71705732395',sourcePngSha256:'e093fdd8e200d5e83f8180a12ef01979aaffa14a3ff6e17637fb3ccfe2890e18',webpSha256:'5acf232e68b190bf4a9b789a91d39491d37f17042403cfaf1ee41d5be8e6823b',rasterStatus:'SWITCH_DXT5_RGBA_EXACT_PRIVATE'}),
  '40005432':Object.freeze({originalNativeStreamSha256:'0373de4f40616a85375319002f25ba505c4a5bce0dc530fe15834f9d53fb1883',sourcePngSha256:'aa459dce331f1840468a2031b6c365b680646be02bed937887b833b68db8f201',webpSha256:'53a0c1f4c257f0c41952e22a23fe787d627c2e6b4b642c6cbf082f54cb76bd0c',rasterStatus:'SWITCH_DXT5_RGBA_EXACT_PRIVATE'}),
  '40005584':Object.freeze({originalNativeStreamSha256:'5e5c4c84de039ed184220104ab9db478d7e894399be7ebd1a8fd36c9d905225a',sourcePngSha256:'96dd7d0ee62a715d584adccc79206839032bf436b109efcc41a62e63d9ca1d55',webpSha256:'a033c49c26cf7dc67fa2cf2290d75d6e54c13ba92070d529a3886bebb2eab8d1',rasterStatus:'SWITCH_DXT5_RGBA_EXACT_PRIVATE'}),
  '40005585':Object.freeze({originalNativeStreamSha256:'fc53bf12eed3e44a529330ab648ba5ebb4e3fb5f730c4665c89c0261567945b5',sourcePngSha256:'7fd8588a2cddd1a81568b9c7e5dc9ed86b7b5abbfcacf6d3aff91f20fb4b0ec1',webpSha256:'daa1c6a37a9c1319c73dc02df1f2d6803e09e3e1d4762c49040a31ed2e7b7ef9',rasterStatus:'SWITCH_DXT5_RGBA_EXACT_PRIVATE'}),
  '40005623':Object.freeze({originalNativeStreamSha256:'300d13af6a7234c1ae6aa92212f866a4b508d2ef8f6ada4a692c6dc4cd641cf0',sourcePngSha256:'39a83f8f35134f513c6d9c037bb291bcad7922124ac10ab2f5e491601ece515e',webpSha256:'940642476f3bb44b0d8fc3044fc1cde17cbd152220d1f50b673837ba088faf33',rasterStatus:'SWITCH_DXT5_RGBA_EXACT_PRIVATE'}),
  '40005853':Object.freeze({originalNativeStreamSha256:'6302c6eb02bfc3c48b7b9a6193038d5786551b05c6413d8880e4cb679b46e8e9',sourcePngSha256:'e404645d323029018d7826699808450a379923980dd5024a5c69e5c49d9a0e9e',webpSha256:'7e4699b87c8d8e15a9720748cd4c741a062419c5f3c7c31f9b32dd1a1d04f624',rasterStatus:'SWITCH_DXT5_RGBA_EXACT_PRIVATE'}),
  '40005863':Object.freeze({originalNativeStreamSha256:'6891af58366da490f25c350023cf0fd09113b91a7aaedd227437e3a035a18e9d',sourcePngSha256:'fe876b52504d2ea5b1637292f3786ccdbc09ee847154267edab79c229ffd5d53',webpSha256:'2ee078e0f61922fa675068cba478c8fc808a1803ed2626acaead348833554c75',rasterStatus:'SWITCH_DXT5_RGBA_EXACT_PRIVATE'}),
  '40005873':Object.freeze({originalNativeStreamSha256:'9780cd79a90f2ae326ae1a17ccaf915ef9e186047b51532581958e57d419d40d',sourcePngSha256:'f410401c053321319bee21c2e15ffb7de19329593b29c43e09f539074e6ab9d6',webpSha256:'17f064f32f6b74232c386fb6416f6e1206b8bed858f21562cd84df624b76be21',rasterStatus:'SWITCH_DXT5_RGBA_EXACT_PRIVATE'}),
  '40005929':Object.freeze({originalNativeStreamSha256:'fdeed6d406b628ab0fd0e15408de589778acebeda9a1875e495a0fd98bc7c06a',sourcePngSha256:'a1ef741ab94eb3a786a9fdcdd09843c1dacae71a877929cd5fadb2b3ce6e5127',webpSha256:'9dd4388b5b946e38e18aa295caadee8860964e692517a691a2f8bf527ef07675',rasterStatus:'SWITCH_DXT5_RGBA_EXACT_PRIVATE'}),
  '40005934':Object.freeze({originalNativeStreamSha256:'45cb31434494a5f7dcd3b9255f4af92df22a8fd03c2df7015536b5f52f9a715d',sourcePngSha256:'8e22e849dbf6e134e31711c0ae41c2821df73932e462e62bfacac21e9dc80d21',webpSha256:'d61edf60f5333f0648c80ec08ec8efe124ba7ef664315460758609e2dde98897',rasterStatus:'SWITCH_DXT5_RGBA_EXACT_PRIVATE'}),
  '40005954':Object.freeze({originalNativeStreamSha256:'c12f2c706aab683d78e3d43ba072449055b52ca3d1216f961d639c8dcc59b819',sourcePngSha256:'b2eda30d4dec117601f8d8b2ca35f15494d7edaa75add4991d600aa329caaa58',webpSha256:'35563bdba044aa5482a791de4cd0d29e79cc8b97b8485aeb1db5e21647b22858',rasterStatus:'SWITCH_DXT5_RGBA_EXACT_PRIVATE'}),
  '40005967':Object.freeze({originalNativeStreamSha256:'55603a72bbd40d5735c7003b7257a9ac0eb3b08528c7c830169a7aa7f13d41ae',sourcePngSha256:'f4e9d723a0a938432698091104fbd84256ec3c3e06b8c93596330d2ad04634a2',webpSha256:'d8451cd48f1dfe884508d59d3d99a993de2f5a362804b556038e0f14e95ecba8',rasterStatus:'SWITCH_DXT5_RGBA_EXACT_PRIVATE'}),
  '40006005':Object.freeze({originalNativeStreamSha256:'e89f95229939b72f36eeb6909d65754be9f00726b78d43f984f266c6993b62f5',sourcePngSha256:'44da1ac7af661622c99b2b2e54952b223db8fdcbafc6b2e1d3facc35ed56e928',webpSha256:'bc317e1b8ffb86e180db825571786c8f914fe3e83e22aff4c0b60c8c94bc9eb6',rasterStatus:'SWITCH_DXT5_RGBA_EXACT_PRIVATE'}),
  '40006072':Object.freeze({originalNativeStreamSha256:'3fa35828e3808ba0d3fc5a01702822fdc2b0b93de0d67a3da91a760cf4484140',sourcePngSha256:'f756b4900998a5954dee0bad424ce9d46fea4359d775d6b57f1cdc64a145eeda',webpSha256:'c0b1957b52d9f33d4fc679ce116014ce4a8796d320f0a50aa104040c513c14a4',rasterStatus:'SWITCH_DXT5_RGBA_EXACT_PRIVATE'}),
  '40006074':Object.freeze({originalNativeStreamSha256:'4ddeffc0180e47cb7e8525db7c420c654561aa01d6ef5c20379979d69929c7b9',sourcePngSha256:'54f8377190757eedae541ab86ff099fe065b23b285ec148187ec738957498adc',webpSha256:'87191e6b94d44f6f31b958d73739666fa71f60c82a190b9d62553853e6e8b7a0',rasterStatus:'SWITCH_DXT5_RGBA_EXACT_PRIVATE'}),
  '40006075':Object.freeze({originalNativeStreamSha256:'37ed204b90dcde0b8e8be614d31954a33ba2177ea51bf6bada95caef46de16b3',sourcePngSha256:'acd6aa12b53a3c9e15d97e0ac343f613b3e6b0f1ea5a2be65ab5a25735e6b15e',webpSha256:'61789c65d593dd3ad6fdbc1498ff97d985e20d11ed4da844ba5afe90facba252',rasterStatus:'SWITCH_DXT5_RGBA_EXACT_PRIVATE'}),
  '40006078':Object.freeze({originalNativeStreamSha256:'d7b300fef9138e5cae5ced46d5c1a2f46c9d8b34dcdbb84c5e15d24638bbaa3d',sourcePngSha256:'821822b60b777a0c0ba38e5261ffb5a16de0f550981669b62da3db283d270fd2',webpSha256:'527d059b2d4afaff804478845a665be34f41f385ccf6cadb4c3fd5a82ad4101c',rasterStatus:'SWITCH_DXT5_RGBA_EXACT_PRIVATE'}),
  '40006079':Object.freeze({originalNativeStreamSha256:'629f049b9ded867726fb058f301a355a753191b391f7398c31987ade9fe77d13',sourcePngSha256:'08181cafd943a557fd329a834d87587c556be692e8aa16e10246439a8464628f',webpSha256:'016305f79dcec3e53ea71b41b7119117ace8e9079fd9f4c5e5dbdffbe5e4edb0',rasterStatus:'SWITCH_DXT5_RGBA_EXACT_PRIVATE'}),
  '40006080':Object.freeze({originalNativeStreamSha256:'01317b8c1e4a12abd6f62ecfbcb49e9d5bb22c171f0f2fab386fbd5766c5a7e0',sourcePngSha256:'905f4d54c2686f5e695f2efb59d13680ea599fc12030582c705542cb693687c8',webpSha256:'adef9919737e25a53a3472aba3de2f3fbb4158f4f1cdf693eb992d27a4e0afed',rasterStatus:'SWITCH_DXT5_RGBA_EXACT_PRIVATE'}),
  '40300007':Object.freeze({originalNativeStreamSha256:'418d410651830460e230d6ecb8a283d95fbfe9488538ebd9b3f185de3ac7f49c',sourcePngSha256:'d085c29bddbc1af29b844669cbc6e58d7de7c96b58d560bcb4948f48635f8242',webpSha256:'7f5a1dc0f8151d5346a366f7e9750a3fcf54f6e83d802c763b4898cb045b70d1',rasterStatus:'SWITCH_ASTC6X6_SRGB_RGBA_EXACT_PRIVATE'}),
  '40300042':Object.freeze({originalNativeStreamSha256:'38e6941612731ffe30fec1eefedb1133bd75007e50531ebb0503c0152c951d03',sourcePngSha256:'d3ebf0a3bb05dc614fb46c3398a1ce18753114c2ba0c38c033c2d9960936d79a',webpSha256:'d758f81a9d133df5234304668e8d540efdea334836ce2f95f235134217352582',rasterStatus:'SWITCH_DXT5_RGBA_EXACT_PRIVATE'})
});
// Exact byte sizes for private staging verification; not a publication grant.
export const SWITCH1253_PREPARED_WEBP_SIZES=Object.freeze({
  '40000047':19064,
  '40000086':20160,
  '40000166':11372,
  '40000342':26646,
  '40000350':14476,
  '40000353':22022,
  '40000384':12094,
  '40000387':14378,
  '40000428':16812,
  '40000486':17060,
  '40000575':15502,
  '40001334':12522,
  '40001336':16222,
  '40001678':14602,
  '40001756':17820,
  '40001863':25938,
  '40001864':21404,
  '40001994':23264,
  '40001995':6530,
  '40001996':18972,
  '40002002':19288,
  '40004581':32374,
  '40004837':17778,
  '40004964':16684,
  '40004979':14124,
  '40005017':12486,
  '40005025':14794,
  '40005033':22666,
  '40005110':18222,
  '40005111':23660,
  '40005150':12516,
  '40005239':15522,
  '40005252':19844,
  '40005253':18948,
  '40005267':34318,
  '40005269':30304,
  '40005413':19240,
  '40005415':16098,
  '40005431':29382,
  '40005432':29594,
  '40005584':11354,
  '40005585':20716,
  '40005623':19384,
  '40005853':19176,
  '40005863':18656,
  '40005873':17232,
  '40005929':10026,
  '40005934':23774,
  '40005954':23534,
  '40005967':20946,
  '40006005':30340,
  '40006072':28792,
  '40006074':31584,
  '40006075':24228,
  '40006078':24166,
  '40006079':25782,
  '40006080':21328,
  '40006096':29314,
  '40300007':16422,
  '40300042':31974
});
// No rights/host/release acceptance. This compiled default is the runtime
// authority; untrusted fetched JSON cannot switch it to ON.
export const SWITCH1253_REVIEWED_RELEASE=Object.freeze({
  mediaPublic:false,decisionId:ITEM_IMAGE_OWNER_DECISION_ID,scope:SWITCH1253_OWNER_SCOPE,
  rightsHolderLicense:'UNKNOWN',licenseEvidenceSha256:null,rightsReview:'NOT_RUN',
  receivingContact:'NOT_RUN',takedown:'NOT_RUN',managedHttps:'NOT_RUN',
  attribution:'NOT_RUN',oldUrlAndCache:'NOT_RUN',rollback:'NOT_RUN',
  operatorReceiptSha256:null,
  items:Object.freeze({})
});
// Metadata-only draft, deliberately invalid as a public release manifest.
// Keep outside static/Pages; the actual operator receipt and final release
// manifest must be produced and accepted separately. No caller-supplied grants.
export function prepareSwitch1253ItemImageManifest(){
 const {mediaPublic,items,...pending}=SWITCH1253_REVIEWED_RELEASE;
 return {
  schema:SWITCH1253_ITEM_IMAGE_SCHEMA,assetVariant:SWITCH1253_ITEM_IMAGE_VARIANT,
  codec:'WEBP_LOSSLESS_RGBA_EXACT',format:'webp',lossless:true,
  source:{...SWITCH1253_TARGET,originalBundleSha256:SWITCH1253_ORIGINAL_BUNDLE_SHA256},
  target:{...SWITCH1253_TARGET},
  publication:{gate:'MEDIA_PUBLIC_PREPARED_OFF',...pending},
  items:Object.fromEntries(Object.entries(SWITCH1253_NATIVE_PINS).map(([id,pin])=>[id,{
   ...pin,pixelStatus:'SWITCH_RGBA_EXACT_VERIFIED',visibility:'RELEASED_PLAYER_FACING',
   rightsStatus:'UNKNOWN',publicationDecision:'NOT_RUN',assetStatus:'WEBP_LOSSLESS_VERIFIED_160'
  }]))
 };
}
export const switch1253PublicItemImageSource=writable({
  status:'NOT_CONFIGURED',catalog:null,reason:'MEDIA_PUBLIC_OFF'
});
const HEX=/^[0-9a-f]{64}$/;
const ITEM=/^[1-9][0-9]{0,15}$/;
const baseOk=base=>typeof base==='string'&&/^\/?(?:[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*)?$/.test(base);
const owns=(object,key)=>Object.prototype.hasOwnProperty.call(object,key);
function exactKeys(value,keys){
 if(!value||typeof value!=='object'||Array.isArray(value))return false;
 const actual=Object.keys(value);
 return actual.length===keys.length&&keys.every(key=>owns(value,key));
}
const fail=(name)=>{throw new TypeError('SWITCH1253_ITEM_IMAGE_'+name);};
function exactTarget(value){
 return value?.platform===SWITCH1253_TARGET.platform &&
   value?.gameVersion===SWITCH1253_TARGET.gameVersion &&
   value?.buildID===SWITCH1253_TARGET.buildID &&
   value?.schema===SWITCH1253_TARGET.schema;
}
function reviewedReleaseOn(release){
 return exactKeys(release,[
   'mediaPublic','decisionId','scope','rightsHolderLicense','licenseEvidenceSha256',
   'rightsReview','receivingContact','takedown','managedHttps',
   'attribution','oldUrlAndCache','rollback','operatorReceiptSha256','items'
 ]) && release?.mediaPublic===true &&
   release.decisionId===ITEM_IMAGE_OWNER_DECISION_ID &&
   release.scope===SWITCH1253_OWNER_SCOPE &&
   ((release.rightsHolderLicense==='UNKNOWN'&&release.licenseEvidenceSha256===null)||
    (release.rightsHolderLicense==='DOCUMENTED_SCOPE_LICENSE'&&
     typeof release.licenseEvidenceSha256==='string'&&HEX.test(release.licenseEvidenceSha256))) &&
   typeof release.operatorReceiptSha256==='string'&&HEX.test(release.operatorReceiptSha256) &&
   release.attribution==='EIGHT_LOCALES_REVIEWED' &&
   release.oldUrlAndCache==='MANAGED_TESTED' &&
   release.rollback==='MANAGED_TESTED' &&
   release.rightsReview==='OPERATOR_ACCEPTED' &&
   release.receivingContact==='MANAGED_VERIFIED' &&
   release.takedown==='MANAGED_TESTED' &&
   release.managedHttps==='MANAGED_VERIFIED' &&
   release.items && typeof release.items==='object' &&
   !Array.isArray(release.items);
}
// A test can inject a synthetic reviewed release without changing the
// immutable runtime OFF policy; the live UI never passes such an override.
export function validateSwitch1253ItemImageCatalog(raw,reviewedRelease=SWITCH1253_REVIEWED_RELEASE){
 if(!reviewedReleaseOn(reviewedRelease))fail('MEDIA_RIGHTS_OPERATOR_HOST_GATE_OFF');
 if(!raw||typeof raw!=='object'||Array.isArray(raw)||
    raw.schema!==SWITCH1253_ITEM_IMAGE_SCHEMA ||
    !exactTarget(raw.target)||!exactTarget(raw.source)||
    raw.source.originalBundleSha256!==SWITCH1253_ORIGINAL_BUNDLE_SHA256)
   fail('PLATFORM_VERSION_BID_SCHEMA_OR_ORIGINAL_SHA_UNVERIFIED');
 if(raw.assetVariant!==SWITCH1253_ITEM_IMAGE_VARIANT||
    raw.codec!=='WEBP_LOSSLESS_RGBA_EXACT'||
    raw.format!=='webp'||raw.lossless!==true)
   fail('PIXEL_FORMAT_OR_VARIANT_UNVERIFIED');
 // Manifest claims never authorize publication. Every field must match
 // the immutable compiled review; Issue604 is not a copyright licence.
 const publicationKeys=['decisionId','scope','rightsHolderLicense','licenseEvidenceSha256',
   'rightsReview','managedHttps','takedown','receivingContact','attribution',
   'oldUrlAndCache','rollback','operatorReceiptSha256'];
 if(raw.publication?.gate!=='MEDIA_PUBLIC_SCOPED_ON'||
    publicationKeys.some(key=>raw.publication?.[key]!==reviewedRelease[key]))
   fail('MANIFEST_PUBLICATION_UNVERIFIED');
 const rightsStatus=reviewedRelease.rightsHolderLicense==='UNKNOWN'?
   'UNKNOWN':'DOCUMENTED_LICENSE_APPROVED';
 if(!exactKeys(raw,[
     'schema','assetVariant','codec','format','lossless','source','target',
     'publication','items'
   ]) || !exactKeys(raw.target,['platform','gameVersion','buildID','schema']) ||
   !exactKeys(raw.source,['platform','gameVersion','buildID','schema','originalBundleSha256']) ||
   !exactKeys(raw.publication,['gate',...publicationKeys]))fail('UNKNOWN_ROOT_SOURCE_TARGET_OR_PUBLICATION_FIELDS');
 if(!raw.items||typeof raw.items!=='object'||Array.isArray(raw.items))
   fail('MAPPING_INVALID');
 const keys=Object.keys(raw.items);
 if(keys.length===0||keys.length>40000)fail('MAPPING_EMPTY_OR_OVERSIZED');
 const safe=Object.create(null);
 for(const id of keys){
   const e=raw.items[id],trusted=reviewedRelease.items[id],pin=SWITCH1253_NATIVE_PINS[id];
   if(!ITEM.test(id)||!Number.isSafeInteger(Number(id))||
      !owns(reviewedRelease.items,id)||!owns(SWITCH1253_NATIVE_PINS,id)||
      !e||typeof e!=='object'||Array.isArray(e)||
      !trusted||typeof trusted!=='object'||Array.isArray(trusted)||
      !exactKeys(trusted,['originalNativeStreamSha256','sourcePngSha256',
        'webpSha256','rightsStatus','publicationDecision','visibility'])||
      !exactKeys(e,['originalNativeStreamSha256','sourcePngSha256',
        'webpSha256','rasterStatus','pixelStatus','visibility','rightsStatus',
        'assetStatus','publicationDecision'])||
      !pin||!['SWITCH_DXT5_RGBA_EXACT_PRIVATE','SWITCH_ASTC6X6_SRGB_RGBA_EXACT_PRIVATE'].includes(pin.rasterStatus)||
      e.rasterStatus!==pin.rasterStatus||
      e.originalNativeStreamSha256!==pin.originalNativeStreamSha256||
      e.sourcePngSha256!==pin.sourcePngSha256||
      e.webpSha256!==pin.webpSha256||
      !HEX.test(e.originalNativeStreamSha256||'')||
      !HEX.test(e.sourcePngSha256||'')||!HEX.test(e.webpSha256||'')||
      e.pixelStatus!=='SWITCH_RGBA_EXACT_VERIFIED'||
      e.visibility!=='RELEASED_PLAYER_FACING'||
      e.rightsStatus!==rightsStatus||
      e.publicationDecision!=='OWNER_SCOPED_PUBLICATION_ACCEPTED'||
      trusted.publicationDecision!==e.publicationDecision||
      trusted.visibility!==e.visibility||
      e.assetStatus!=='WEBP_LOSSLESS_VERIFIED_160'||
      trusted.originalNativeStreamSha256!==e.originalNativeStreamSha256||
      trusted.sourcePngSha256!==e.sourcePngSha256||
      trusted.webpSha256!==e.webpSha256||
      trusted.rightsStatus!==rightsStatus)
     fail('ITEM_ID_NATIVE_SHA_RGBA_RELEASE_OR_RIGHTS_UNVERIFIED');
   safe[id]=Object.freeze({
     originalNativeStreamSha256:e.originalNativeStreamSha256,
     sourcePngSha256:e.sourcePngSha256,webpSha256:e.webpSha256
   });
 }
 return Object.freeze({
   target:Object.freeze({...SWITCH1253_TARGET}),
   assetVariant:SWITCH1253_ITEM_IMAGE_VARIANT,
   codec:'WEBP_LOSSLESS_RGBA_EXACT',
   items:Object.freeze(safe),count:keys.length
 });
}
export function switch1253ItemImagePath(itemId,catalog){
 if(!catalog||!exactTarget(catalog.target)||
    catalog.assetVariant!==SWITCH1253_ITEM_IMAGE_VARIANT||
    catalog.codec!=='WEBP_LOSSLESS_RGBA_EXACT')return null;
 const id=String(itemId);
 if(!ITEM.test(id)||!Number.isSafeInteger(Number(id)))return null;
 const item=catalog.items?.[id],pin=SWITCH1253_NATIVE_PINS[id];
 if(!item||!pin||item.originalNativeStreamSha256!==pin.originalNativeStreamSha256||
    item.sourcePngSha256!==pin.sourcePngSha256||
    item.webpSha256!==pin.webpSha256)return null;
 const shard=item.originalNativeStreamSha256.slice(0,2);
 return 'ddv/item-images/'+SWITCH1253_ITEM_IMAGE_VARIANT+'/'+shard+'/' +
   item.originalNativeStreamSha256+'-'+item.sourcePngSha256+'-'+item.webpSha256+'.webp';
}
export function scopedSwitch1253ItemImageHref(base,itemId,catalog){
 if(!baseOk(base))return null;
 const path=switch1253ItemImagePath(itemId,catalog);
 if(!path)return null;
 return (base?'/'+base.replace(/^\/+|\/+$/g,''):'')+'/'+path;
}
// A mutable manifest is a withdrawal control, never an immutable cached asset.
// Bound the visible-tab lifetime and clear before a refresh, including on
// focus/pageshow/visibility change. CDN/old immutable URL purge still requires
// independently measured operator controls; client refresh is not a purge.
export const SWITCH1253_MANIFEST_REFRESH_MS=60000;
export const SWITCH1253_MANIFEST_TIMEOUT_MS=10000;

// Test-only callers may construct an isolated controller with an explicit
// synthetic review. The production singleton below uses only compiled review.
export function createSwitch1253ManifestController(reviewedRelease,publish,clock=Date.now){
 let pending=null,last=null;
 const state=(reason)=>publish({status:'NOT_CONFIGURED',catalog:null,reason});
 function clear(reason='MANIFEST_REFRESH_REQUIRED'){
  const old=pending;pending=null;last=null;
  old?.stop();state(reason);
 }
 function load(base='',fetchImpl=globalThis.fetch,force=false){
  if(!reviewedReleaseOn(reviewedRelease)){clear('MEDIA_PUBLIC_OFF');return Promise.resolve(null);}
  if(!baseOk(base)||typeof fetchImpl!=='function'){clear('BASE_OR_FETCH_INVALID');return Promise.resolve(null);}
  if(pending&&pending.base===base)return pending.promise;
  const now=clock();
  if(!force&&last&&last.base===base&&now>=last.at&&now-last.at<SWITCH1253_MANIFEST_REFRESH_MS)
   return Promise.resolve(last.catalog);
  clear('MANIFEST_REFRESH_PENDING');
  const abort=new AbortController(),slot={base,promise:null,stop:null};
  pending=slot;
  let rejectStop;
  const stopped=new Promise((_,reject)=>{rejectStop=reject});
  slot.stop=()=>{abort.abort();rejectStop(new Error('MANIFEST_REFRESH_CANCELLED'))};
  const deadline=setTimeout(()=>{
   if(pending===slot){pending=null;last=null;state('MANIFEST_REFRESH_TIMEOUT');slot.stop();}
  },SWITCH1253_MANIFEST_TIMEOUT_MS);
  const prefix=base?'/'+base.replace(/^\/+|\/+$/g,''):'';
  const request=(async()=>{
   const response=await fetchImpl(prefix+'/'+SWITCH1253_MANIFEST_PATH,
    {credentials:'omit',redirect:'error',cache:'no-store',signal:abort.signal});
   if(!response.ok)fail('PUBLISHED_MANIFEST_UNAVAILABLE');
   const mime=response.headers?.get('content-type')?.split(';')[0].trim().toLowerCase();
   if(mime!=='application/json')fail('PUBLISHED_MANIFEST_MIME_INVALID');
   return validateSwitch1253ItemImageCatalog(await response.json(),reviewedRelease);
  })();
  slot.promise=Promise.race([request,stopped]).then(catalog=>{
   if(pending!==slot)return null;
   last={base,at:clock(),catalog};
   publish({status:'VERIFIED',catalog,reason:''});
   return catalog;
  }).catch(err=>{
   if(pending===slot){last=null;state(String(err?.message||err));}
   return null;
  }).finally(()=>{clearTimeout(deadline);if(pending===slot)pending=null;});
  return slot.promise;
 }
 return Object.freeze({load,clear});
}
const productionController=createSwitch1253ManifestController(
 SWITCH1253_REVIEWED_RELEASE,value=>switch1253PublicItemImageSource.set(value)
);
export function loadSwitch1253PublicItemImageSource(base='',fetchImpl=globalThis.fetch){
 return productionController.load(base,fetchImpl);
}

// One lifecycle per visible document, shared by all mounted ItemThumbs.
// No timers or listeners when compiled media is OFF. On background/BFCache
// entry clear and cancel; when visible/focused revalidate, not a stale replay.
export function attachSwitch1253ManifestLifecycle(controller,base,win,doc,fetchImpl=globalThis.fetch){
 const refresh=()=>{if(doc.visibilityState==='visible')void controller.load(base,fetchImpl,true);
  else controller.clear('DOCUMENT_NOT_VISIBLE');};
 const hide=()=>controller.clear('DOCUMENT_NOT_VISIBLE');
 win.addEventListener('focus',refresh);
 win.addEventListener('pageshow',refresh);
 win.addEventListener('pagehide',hide);
 doc.addEventListener('visibilitychange',refresh);
 const timer=win.setInterval(refresh,SWITCH1253_MANIFEST_REFRESH_MS);
 refresh();
 return ()=>{
  win.clearInterval(timer);win.removeEventListener('focus',refresh);
  win.removeEventListener('pageshow',refresh);win.removeEventListener('pagehide',hide);
  doc.removeEventListener('visibilitychange',refresh);controller.clear('NO_VISIBLE_CONSUMER');
 };
}
let consumers=0,detach=null,consumerBase=null;
export function retainSwitch1253PublicItemImageSource(base=''){
 if(!reviewedReleaseOn(SWITCH1253_REVIEWED_RELEASE)||typeof window==='undefined'||typeof document==='undefined'){
  void loadSwitch1253PublicItemImageSource(base);return ()=>{};
 }
 if(!baseOk(base)||(consumers&&consumerBase!==base)){
  productionController.clear('BASE_OR_FETCH_INVALID');return ()=>{};
 }
 if(consumers===0){
  consumerBase=base;
  detach=attachSwitch1253ManifestLifecycle(productionController,base,window,document);
 }
 consumers++;
 let released=false;
 return ()=>{
  if(released)return;released=true;consumers--;
  if(consumers===0){detach?.();detach=null;consumerBase=null;}
 };
}
