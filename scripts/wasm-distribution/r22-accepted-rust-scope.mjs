// R22 exact accepted-source maintenance scope. NOT an acceptance issuer,
// merge authority, public Writer permission, or a generic Rust exception.
// Fixed reviewed Source1372 + approved Cargo pin (ACT1020/1023/1030).
// ACT1100 adds only Source1422 exact4 after the accepted common Core tree.
// Must first be accepted by independent 04QR-S and sole09INT on protected main.
// A candidate cannot introduce or modify this gate to authorize itself.
import {execFileSync} from 'node:child_process';
import {inspectSelection} from '../int-selection-preflight.mjs';

const APPROVED_ANCESTOR='2ec84d06a24d5fe964c7e8b8186a6b442650593b';
const SHA=/^[0-9a-f]{40}$/;
const entries=[
  {
    "path": ".github/workflows/core-product-session-boundary.yml",
    "before": {
      "mode": "100644",
      "blob": "1995e60e584f7ed144ab73b1ddeec87bd293fb13"
    },
    "after": {
      "mode": "100644",
      "blob": "93c4244c053dfeabcf27b0817b6a2e81a5fb905d"
    }
  },
  {
    "path": "crates/ddv-save-core/Cargo.toml",
    "before": {
      "mode": "100644",
      "blob": "27cc74609bc818741ff068bdd00c0b7d430aa257"
    },
    "after": {
      "mode": "100644",
      "blob": "0939c989984ff49aff466da35e427289758d8d4f"
    }
  },
  {
    "path": "crates/ddv-save-core/data/steam626-amount-dependency-projection.json",
    "before": null,
    "after": {
      "mode": "100644",
      "blob": "81571df377231f06496165530bb3b079897da769"
    }
  },
  {
    "path": "crates/ddv-save-core/data/steam626-amount-layout-reference.jsonl",
    "before": null,
    "after": {
      "mode": "100644",
      "blob": "82b9e1c3f53ffce85f2277a81d0cab195be1aff8"
    }
  },
  {
    "path": "crates/ddv-save-core/data/steam626-amount-packaged-candidates.json",
    "before": null,
    "after": {
      "mode": "100644",
      "blob": "5ed37e479b1c797bbe86df5857e8469e30978b0e"
    }
  },
  {
    "path": "crates/ddv-save-core/src/lib.rs",
    "before": {
      "mode": "100644",
      "blob": "6e47eb5d2d2c829c0b0fe6a741db550b1faf70e5"
    },
    "after": {
      "mode": "100644",
      "blob": "9cc0dfdde15399d2797f30c861684f530635c4ef"
    }
  },
  {
    "path": "crates/ddv-save-core/src/native_reference_slice.rs",
    "before": {
      "mode": "100644",
      "blob": "84c010a851bd1324d1ba716e3ac20ee7ff97e69e"
    },
    "after": {
      "mode": "100644",
      "blob": "061df02b8d8a8b9ed8c4d0ccd549ed4ea5ab3a2c"
    }
  },
  {
    "path": "crates/ddv-save-core/src/private_collection_read.rs",
    "before": {
      "mode": "100644",
      "blob": "dd4364c14004e4b577b63b20138e0b366c4d67fb"
    },
    "after": {
      "mode": "100644",
      "blob": "934662f1f68dfc8dbde67d90dd00a190d11a33f0"
    }
  },
  {
    "path": "crates/ddv-save-core/src/product_amount_scoped.rs",
    "before": null,
    "after": {
      "mode": "100644",
      "blob": "d62bccfcd2f13a184dbe9b3061cda3e616b21ad7"
    }
  },
  {
    "path": "crates/ddv-save-core/src/product_session.rs",
    "before": {
      "mode": "100644",
      "blob": "4958dc920ad3450aa01757502fafc1f4205da403"
    },
    "after": {
      "mode": "100644",
      "blob": "ac17f7a736f6c61152b4a7fd032f711b3fbec7cf"
    }
  },
  {
    "path": "crates/ddv-save-core/src/reference_span_walk.rs",
    "before": null,
    "after": {
      "mode": "100644",
      "blob": "f12edf8eed2d6575bb0c581679e038658f126692"
    }
  },
  {
    "path": "crates/ddv-save-core/src/semantic_writer.rs",
    "before": {
      "mode": "100644",
      "blob": "f7ffe74e3bb11610430cae3b8e9a1924554e3ef9"
    },
    "after": {
      "mode": "100644",
      "blob": "c23187216e12ec79da32ced511d41768bec91fe5"
    }
  },
  {
    "path": "crates/ddv-save-core/src/wasm_worker.rs",
    "before": {
      "mode": "100644",
      "blob": "387afcb5bc151942fcc7f5848e3d9d5722b90de5"
    },
    "after": {
      "mode": "100644",
      "blob": "98e630acad496de9df94a83fc839f1bc382aa403"
    }
  },
  {
    "path": "crates/ddv-save-core/src/worker_session.rs",
    "before": {
      "mode": "100644",
      "blob": "d84fcd08849c9eaae046aeaa16d217b77d0b3b0d"
    },
    "after": {
      "mode": "100644",
      "blob": "6d6fad2fa9494bfdc732ad8bf2f82ab047528812"
    }
  },
  {
    "path": "scripts/wasm-distribution/protected-release-inputs.json",
    "before": {
      "mode": "100644",
      "blob": "c90840cf2b759f933b20577a6b6dcb67cf1b3c25"
    },
    "after": {
      "mode": "100644",
      "blob": "d5e20db31ce4302964989d65355d1e26a61e22ec"
    }
  }
];
const switch626ChestEntries=[
  {
    "path": "crates/ddv-save-core/src/product_amount_scoped.rs",
    "before": {
      "mode": "100644",
      "blob": "d62bccfcd2f13a184dbe9b3061cda3e616b21ad7"
    },
    "after": {
      "mode": "100644",
      "blob": "a5e774917e5d5d43cca2493e2c74a2cf07f45e53"
    }
  },
  {
    "path": "crates/ddv-save-core/src/product_switch626_chest.rs",
    "before": null,
    "after": {
      "mode": "100644",
      "blob": "fd3fad8d8fcfac9ca417eb2185cd0e6cfde22293"
    }
  },
  {
    "path": "crates/ddv-save-core/src/wasm_worker.rs",
    "before": {
      "mode": "100644",
      "blob": "98e630acad496de9df94a83fc839f1bc382aa403"
    },
    "after": {
      "mode": "100644",
      "blob": "0fcdac70758ca09675fa28c4b854e4c1885e681b"
    }
  },
  {
    "path": "crates/ddv-save-core/src/worker_session.rs",
    "before": {
      "mode": "100644",
      "blob": "6d6fad2fa9494bfdc732ad8bf2f82ab047528812"
    },
    "after": {
      "mode": "100644",
      "blob": "3aee4b593a4d62c3ff233c678095bf09cd0474bd"
    }
  }
];
const switch626ChestFeatureEntries=[
  {
    "path": "crates/ddv-save-core/Cargo.toml",
    "before": {
      "mode": "100644",
      "blob": "0939c989984ff49aff466da35e427289758d8d4f"
    },
    "after": {
      "mode": "100644",
      "blob": "70e9a9b32ff4cafc2efa9f2dc7caada82224b8b7"
    }
  },
  {
    "path": "crates/ddv-save-core/src/wasm_worker.rs",
    "before": {
      "mode": "100644",
      "blob": "0fcdac70758ca09675fa28c4b854e4c1885e681b"
    },
    "after": {
      "mode": "100644",
      "blob": "cd141f4eff59d92333026316a5cb6f144ddfaa19"
    }
  },
  {
    "path": "scripts/wasm-distribution/protected-release-inputs.json",
    "before": {
      "mode": "100644",
      "blob": "d5e20db31ce4302964989d65355d1e26a61e22ec"
    },
    "after": {
      "mode": "100644",
      "blob": "502fd7b446c04b943ce624e830a846428d1ec213"
    }
  }
];
const steam626ChestAtomicEntries=[
  {
    "path": "crates/ddv-save-core/Cargo.toml",
    "before": {
      "mode": "100644",
      "blob": "70e9a9b32ff4cafc2efa9f2dc7caada82224b8b7"
    },
    "after": {
      "mode": "100644",
      "blob": "00226c1e27b511da4e543b08430f99b6f1dd9088"
    }
  },
  {
    "path": "crates/ddv-save-core/src/product_amount_scoped.rs",
    "before": {
      "mode": "100644",
      "blob": "a5e774917e5d5d43cca2493e2c74a2cf07f45e53"
    },
    "after": {
      "mode": "100644",
      "blob": "864792dae67657462c74c0f4d7d0996d1d78941a"
    }
  },
  {
    "path": "crates/ddv-save-core/src/wasm_worker.rs",
    "before": {
      "mode": "100644",
      "blob": "cd141f4eff59d92333026316a5cb6f144ddfaa19"
    },
    "after": {
      "mode": "100644",
      "blob": "9db54faf767734ded719b556e2ef2c76d15f36c5"
    }
  },
  {
    "path": "scripts/wasm-distribution/protected-release-inputs.json",
    "before": {
      "mode": "100644",
      "blob": "502fd7b446c04b943ce624e830a846428d1ec213"
    },
    "after": {
      "mode": "100644",
      "blob": "99877a799c26b9b1fdd3944178c6a86ec290eb6c"
    }
  }
];
const steam626Sr03CumulativeEntries=[
  {
    "path": ".github/workflows/core-product-session-boundary.yml",
    "before": {
      "mode": "100644",
      "blob": "93c4244c053dfeabcf27b0817b6a2e81a5fb905d"
    },
    "after": {
      "mode": "100644",
      "blob": "b571028748521edbb5ee3d17e548305f15793d56"
    }
  },
  {
    "path": "crates/ddv-save-core/Cargo.toml",
    "before": {
      "mode": "100644",
      "blob": "00226c1e27b511da4e543b08430f99b6f1dd9088"
    },
    "after": {
      "mode": "100644",
      "blob": "262c19374fdfd47e8bd4ebf68fa292aff3c1f26c"
    }
  },
  {
    "path": "crates/ddv-save-core/data/steam626-placement-applicable-supplement.json",
    "before": null,
    "after": {
      "mode": "100644",
      "blob": "a8f5110f00d47eaa1e0e322becceed11aba17d75"
    }
  },
  {
    "path": "crates/ddv-save-core/src/comp03_installed_geometry.rs",
    "before": null,
    "after": {
      "mode": "100644",
      "blob": "645e6e6a64664088997df46954cd1d8bb4a2995a"
    }
  },
  {
    "path": "crates/ddv-save-core/src/comp03_product_target.rs",
    "before": null,
    "after": {
      "mode": "100644",
      "blob": "4a9d917e2ca1ff07b82a726fe151eb91ff230556"
    }
  },
  {
    "path": "crates/ddv-save-core/src/grid_append.rs",
    "before": null,
    "after": {
      "mode": "100644",
      "blob": "cfc7486f864f3d096282f65c7fc448c9f2a83215"
    }
  },
  {
    "path": "crates/ddv-save-core/src/placement_applicable.rs",
    "before": null,
    "after": {
      "mode": "100644",
      "blob": "bc1619cb5fbb402e0c9f8547465092c51cd578f0"
    }
  },
  {
    "path": "crates/ddv-save-core/src/placement_saved_refs.rs",
    "before": null,
    "after": {
      "mode": "100644",
      "blob": "cfce44352cda8d431628ff3a22b3fd9330fce44f"
    }
  },
  {
    "path": "crates/ddv-save-core/src/product_amount_scoped.rs",
    "before": {
      "mode": "100644",
      "blob": "864792dae67657462c74c0f4d7d0996d1d78941a"
    },
    "after": {
      "mode": "100644",
      "blob": "fdc64b525f945298cd1e6f739599faab7721d463"
    }
  },
  {
    "path": "crates/ddv-save-core/src/road_mixed_shape.rs",
    "before": null,
    "after": {
      "mode": "100644",
      "blob": "f93a44572e2bb74b47bb003c47793212b34519dd"
    }
  },
  {
    "path": "crates/ddv-save-core/src/semantic_writer.rs",
    "before": {
      "mode": "100644",
      "blob": "c23187216e12ec79da32ced511d41768bec91fe5"
    },
    "after": {
      "mode": "100644",
      "blob": "0501f49616fb6e86447db34f4dcc6a954dae91d4"
    }
  },
  {
    "path": "crates/ddv-save-core/src/sr03_installed_geometry.rs",
    "before": null,
    "after": {
      "mode": "100644",
      "blob": "21d4fb71f73be5492a29562e4d6fd1c20bbe366f"
    }
  },
  {
    "path": "crates/ddv-save-core/src/sr03_product_target.rs",
    "before": null,
    "after": {
      "mode": "100644",
      "blob": "7851ea08d32f846c43d326939b70b2c0f932ab73"
    }
  },
  {
    "path": "crates/ddv-save-core/src/switch624_road_rm01.rs",
    "before": {
      "mode": "100644",
      "blob": "1473ccbba5e46658d6cdb61904de7344a1c99706"
    },
    "after": {
      "mode": "100644",
      "blob": "c859c98807c649ec86d9200de210c3fd12d2750c"
    }
  },
  {
    "path": "crates/ddv-save-core/src/wasm_worker.rs",
    "before": {
      "mode": "100644",
      "blob": "9db54faf767734ded719b556e2ef2c76d15f36c5"
    },
    "after": {
      "mode": "100644",
      "blob": "a40e2c11188c256c184cf515c929f886f0ede5ea"
    }
  },
  {
    "path": "crates/ddv-save-core/src/worker_session.rs",
    "before": {
      "mode": "100644",
      "blob": "3aee4b593a4d62c3ff233c678095bf09cd0474bd"
    },
    "after": {
      "mode": "100644",
      "blob": "9639a7dae9a9379b76066b9650587db4bd3b103c"
    }
  },
  {
    "path": "crates/ddv-save-core/tests/semantic_inventory_writer_dev.rs",
    "before": {
      "mode": "100644",
      "blob": "da4f2c380caaef54dc300aa5b97fef60a8b0264b"
    },
    "after": {
      "mode": "100644",
      "blob": "1d38be62e18f05af87d216c55aad6f509925fc39"
    }
  },
  {
    "path": "scripts/wasm-distribution/protected-release-inputs.json",
    "before": {
      "mode": "100644",
      "blob": "99877a799c26b9b1fdd3944178c6a86ec290eb6c"
    },
    "after": {
      "mode": "100644",
      "blob": "ac82abac187157f26b850868b1af93bc50842b1e"
    }
  }
];
const switch626Rm01CumulativeEntries=[
  {
    "path": ".github/workflows/core-product-session-boundary.yml",
    "before": {
      "mode": "100644",
      "blob": "b571028748521edbb5ee3d17e548305f15793d56"
    },
    "after": {
      "mode": "100644",
      "blob": "297ff95a150d1417ba0d0507780eeb9f69b892f4"
    }
  },
  {
    "path": "crates/ddv-save-core/Cargo.toml",
    "before": {
      "mode": "100644",
      "blob": "262c19374fdfd47e8bd4ebf68fa292aff3c1f26c"
    },
    "after": {
      "mode": "100644",
      "blob": "0694cf00071368d00f8626350bdda7cd9a8b5f85"
    }
  },
  {
    "path": "crates/ddv-save-core/data/steam626-placement-applicable-supplement.json",
    "before": {
      "mode": "100644",
      "blob": "a8f5110f00d47eaa1e0e322becceed11aba17d75"
    },
    "after": {
      "mode": "100644",
      "blob": "f71033ddd264362fd5333dff33703cebddefe5e1"
    }
  },
  {
    "path": "crates/ddv-save-core/src/comp03_product_target.rs",
    "before": {
      "mode": "100644",
      "blob": "4a9d917e2ca1ff07b82a726fe151eb91ff230556"
    },
    "after": {
      "mode": "100644",
      "blob": "7ced0c7020a130461e6e3ce916a70ce4451e1d1a"
    }
  },
  {
    "path": "crates/ddv-save-core/src/placement_applicable.rs",
    "before": {
      "mode": "100644",
      "blob": "bc1619cb5fbb402e0c9f8547465092c51cd578f0"
    },
    "after": {
      "mode": "100644",
      "blob": "9f013ccc7b7f951a3072ff65bc8adfa68bb685b3"
    }
  },
  {
    "path": "crates/ddv-save-core/src/product_amount_scoped.rs",
    "before": {
      "mode": "100644",
      "blob": "fdc64b525f945298cd1e6f739599faab7721d463"
    },
    "after": {
      "mode": "100644",
      "blob": "e6e360f5326b9a5cf6884600a4c9ecf642aa12fa"
    }
  },
  {
    "path": "crates/ddv-save-core/src/semantic_writer.rs",
    "before": {
      "mode": "100644",
      "blob": "0501f49616fb6e86447db34f4dcc6a954dae91d4"
    },
    "after": {
      "mode": "100644",
      "blob": "4e2d9e9c64d9096d03c8515f791706f2cc7f458a"
    }
  },
  {
    "path": "crates/ddv-save-core/src/sr03_installed_geometry.rs",
    "before": {
      "mode": "100644",
      "blob": "21d4fb71f73be5492a29562e4d6fd1c20bbe366f"
    },
    "after": {
      "mode": "100644",
      "blob": "b8a90450543e984d71a1f4e96198a149ac5c98c2"
    }
  },
  {
    "path": "crates/ddv-save-core/src/sr03_product_target.rs",
    "before": {
      "mode": "100644",
      "blob": "7851ea08d32f846c43d326939b70b2c0f932ab73"
    },
    "after": {
      "mode": "100644",
      "blob": "4af0dcf34272e3413c6b05d14abf400781837585"
    }
  },
  {
    "path": "crates/ddv-save-core/src/switch626_crop_filter.rs",
    "before": null,
    "after": {
      "mode": "100644",
      "blob": "e3ba5c7a071c336a1d5bce78212f80da8e87661f"
    }
  },
  {
    "path": "crates/ddv-save-core/src/wasm_worker.rs",
    "before": {
      "mode": "100644",
      "blob": "a40e2c11188c256c184cf515c929f886f0ede5ea"
    },
    "after": {
      "mode": "100644",
      "blob": "fc48943b815f9ee9a1fd74bc3249ae65da6319b4"
    }
  },
  {
    "path": "crates/ddv-save-core/src/worker_session.rs",
    "before": {
      "mode": "100644",
      "blob": "9639a7dae9a9379b76066b9650587db4bd3b103c"
    },
    "after": {
      "mode": "100644",
      "blob": "3419766834cea085f61b267a406fe91432b39c79"
    }
  },
  {
    "path": "crates/ddv-save-core/tests/semantic_inventory_writer_dev.rs",
    "before": {
      "mode": "100644",
      "blob": "1d38be62e18f05af87d216c55aad6f509925fc39"
    },
    "after": {
      "mode": "100644",
      "blob": "fc7fbbadf4a9084bbe9293cbf87338d9899cf1ba"
    }
  },
  {
    "path": "scripts/wasm-distribution/protected-release-inputs.json",
    "before": {
      "mode": "100644",
      "blob": "ac82abac187157f26b850868b1af93bc50842b1e"
    },
    "after": {
      "mode": "100644",
      "blob": "636955805479ed9794896c0d06acbf991c10bf14"
    }
  }
];
const steam626AppearanceCumulativeEntries=[
  {
    "path": ".github/workflows/core-product-session-boundary.yml",
    "before": {
      "mode": "100644",
      "blob": "297ff95a150d1417ba0d0507780eeb9f69b892f4"
    },
    "after": {
      "mode": "100644",
      "blob": "825c0e92d7c9f5a1e86900d3a67ccff57b15babf"
    }
  },
  {
    "path": "crates/ddv-save-core/Cargo.toml",
    "before": {
      "mode": "100644",
      "blob": "0694cf00071368d00f8626350bdda7cd9a8b5f85"
    },
    "after": {
      "mode": "100644",
      "blob": "6e3102f66faa31174e110c2fe760a9c9ef38d10c"
    }
  },
  {
    "path": "crates/ddv-save-core/data/steam626-appearance-definition-join.json",
    "before": null,
    "after": {
      "mode": "100644",
      "blob": "5b5f2ab5d1d9bcd91e45ec481c113c404d92b1a3"
    }
  },
  {
    "path": "crates/ddv-save-core/data/steam626-fixed-skin-catalog-projection.json",
    "before": null,
    "after": {
      "mode": "100644",
      "blob": "47f0cb6ef12887ff031d24e08628ac9cbbd5d833"
    }
  },
  {
    "path": "crates/ddv-save-core/src/appearance_applicable.rs",
    "before": null,
    "after": {
      "mode": "100644",
      "blob": "f135d760dc8be064528b540aa70ea6dceef9228d"
    }
  },
  {
    "path": "crates/ddv-save-core/src/appearance_observer.rs",
    "before": null,
    "after": {
      "mode": "100644",
      "blob": "6e7d1247f65a5c3b320446fb1b8dae5764b7cb9d"
    }
  },
  {
    "path": "crates/ddv-save-core/src/indexed_read.rs",
    "before": {
      "mode": "100644",
      "blob": "a214ef65f3f4a149337a50d0c7f4e6245962c421"
    },
    "after": {
      "mode": "100644",
      "blob": "38e7f27c486acc2058895bc48356832b27f87555"
    }
  },
  {
    "path": "crates/ddv-save-core/src/product_hair_target.rs",
    "before": null,
    "after": {
      "mode": "100644",
      "blob": "58c7277c1ea31e3cd2240d3ab1a414dd28ed0a2f"
    }
  },
  {
    "path": "crates/ddv-save-core/src/product_skin_target.rs",
    "before": null,
    "after": {
      "mode": "100644",
      "blob": "d4b0bbde04b55b22ddee11e8cf6cb3471968ce28"
    }
  },
  {
    "path": "crates/ddv-save-core/src/semantic_writer.rs",
    "before": {
      "mode": "100644",
      "blob": "4e2d9e9c64d9096d03c8515f791706f2cc7f458a"
    },
    "after": {
      "mode": "100644",
      "blob": "281eb155d91b572a69ea5e844b3880eac2660f78"
    }
  },
  {
    "path": "crates/ddv-save-core/src/wasm_worker.rs",
    "before": {
      "mode": "100644",
      "blob": "fc48943b815f9ee9a1fd74bc3249ae65da6319b4"
    },
    "after": {
      "mode": "100644",
      "blob": "0a8d533f1ba8d7b7a35322a9ac8459287e09481c"
    }
  },
  {
    "path": "crates/ddv-save-core/src/worker_session.rs",
    "before": {
      "mode": "100644",
      "blob": "3419766834cea085f61b267a406fe91432b39c79"
    },
    "after": {
      "mode": "100644",
      "blob": "f155092b4fa406cd0db946033ec81071f1496cba"
    }
  },
  {
    "path": "crates/ddv-save-core/tests/semantic_inventory_writer_dev.rs",
    "before": {
      "mode": "100644",
      "blob": "fc7fbbadf4a9084bbe9293cbf87338d9899cf1ba"
    },
    "after": {
      "mode": "100644",
      "blob": "6d5bd159dd37425f8f72f5697c20558baf7952a7"
    }
  },
  {
    "path": "scripts/wasm-distribution/protected-release-inputs.json",
    "before": {
      "mode": "100644",
      "blob": "636955805479ed9794896c0d06acbf991c10bf14"
    },
    "after": {
      "mode": "100644",
      "blob": "dd59264c1c20325c66e6aecc3413e91d10fc72ed"
    }
  }
];
// 09P-CODE ACT1491/1493 fixed R22 source closure, not product release authority.
const fd01Fe01PostFrpMain6abEntries=[
  {
    "path": ".github/workflows/core-product-session-boundary.yml",
    "before": {
      "mode": "100644",
      "blob": "825c0e92d7c9f5a1e86900d3a67ccff57b15babf"
    },
    "after": {
      "mode": "100644",
      "blob": "6237ca727129e0f933d6f2040ac993530d1b66e7"
    }
  },
  {
    "path": "crates/ddv-save-core/Cargo.toml",
    "before": {
      "mode": "100644",
      "blob": "6e3102f66faa31174e110c2fe760a9c9ef38d10c"
    },
    "after": {
      "mode": "100644",
      "blob": "effccf08990c8c1bc0626e5b0342fc68f6baf811"
    }
  },
  {
    "path": "crates/ddv-save-core/src/fence_product_geometry.rs",
    "before": null,
    "after": {
      "mode": "100644",
      "blob": "71957aae82a384ec17f0f36667a31fd2c0915151"
    }
  },
  {
    "path": "crates/ddv-save-core/src/fence_product_target.rs",
    "before": null,
    "after": {
      "mode": "100644",
      "blob": "6de331b47f6b71bc17eeb34c41dfd38ea55f020f"
    }
  },
  {
    "path": "crates/ddv-save-core/src/placement_saved_refs.rs",
    "before": {
      "mode": "100644",
      "blob": "cfce44352cda8d431628ff3a22b3fd9330fce44f"
    },
    "after": {
      "mode": "100644",
      "blob": "78ad4f9f704fc701c31e93c1525edac4a722db13"
    }
  },
  {
    "path": "crates/ddv-save-core/src/semantic_writer.rs",
    "before": {
      "mode": "100644",
      "blob": "281eb155d91b572a69ea5e844b3880eac2660f78"
    },
    "after": {
      "mode": "100644",
      "blob": "fe914df7b69f168ba94889d5761d4b10667f7531"
    }
  },
  {
    "path": "crates/ddv-save-core/src/sr03_installed_geometry.rs",
    "before": {
      "mode": "100644",
      "blob": "b8a90450543e984d71a1f4e96198a149ac5c98c2"
    },
    "after": {
      "mode": "100644",
      "blob": "e3139d1c987dd0e2483d529c640d98ee118cee8f"
    }
  },
  {
    "path": "crates/ddv-save-core/src/sr03_product_target.rs",
    "before": {
      "mode": "100644",
      "blob": "4af0dcf34272e3413c6b05d14abf400781837585"
    },
    "after": {
      "mode": "100644",
      "blob": "20f306356908288cc8ff26bb126d28f087595697"
    }
  },
  {
    "path": "crates/ddv-save-core/src/switch624_fence_fe01.rs",
    "before": {
      "mode": "100644",
      "blob": "dbf46307c49e633b10656e0f1d1286148b57d5e6"
    },
    "after": {
      "mode": "100644",
      "blob": "65e4e7a0ae70001c935fbbd90e2da05727c8a07d"
    }
  },
  {
    "path": "crates/ddv-save-core/src/wasm_switch626_fd01.rs",
    "before": null,
    "after": {
      "mode": "100644",
      "blob": "5a5f6fe40c88d5a7f81c6a9d912f8b4e42b580b8"
    }
  },
  {
    "path": "crates/ddv-save-core/src/wasm_switch626_fe01.rs",
    "before": null,
    "after": {
      "mode": "100644",
      "blob": "26384cd66a7aa513dda15a4b00e3d6c1a2ee4abe"
    }
  },
  {
    "path": "crates/ddv-save-core/src/wasm_worker.rs",
    "before": {
      "mode": "100644",
      "blob": "0a8d533f1ba8d7b7a35322a9ac8459287e09481c"
    },
    "after": {
      "mode": "100644",
      "blob": "59264164dcb6f04f3d33de9c053bb00061d10669"
    }
  },
  {
    "path": "crates/ddv-save-core/src/worker_session.rs",
    "before": {
      "mode": "100644",
      "blob": "f155092b4fa406cd0db946033ec81071f1496cba"
    },
    "after": {
      "mode": "100644",
      "blob": "914bd8e6a45a6d26f5011a9f4c95a4f459d0f498"
    }
  },
  {
    "path": "crates/ddv-save-core/src/worker_switch626_fd01.rs",
    "before": null,
    "after": {
      "mode": "100644",
      "blob": "50e1f9a82e429d1a7092217b2928d0c6b9aca97e"
    }
  },
  {
    "path": "crates/ddv-save-core/src/worker_switch626_fe01.rs",
    "before": null,
    "after": {
      "mode": "100644",
      "blob": "d5ebae15c1f13e16080f60a21905c4205528c47f"
    }
  }
];
// ACT-20261117-09INT-STEAM626-SINGLEFENCE-MAIN63C-GATE-ONLY.
// Exactly one previously scoped pure 27-line Fence shape source hunk.
// This tuple is a source selector, never Merge/Writer/entitlement authority.
const steam626SingleFencePostFd01Fe01Main63cEntries=[
 {path:"crates/ddv-save-core/src/fence_add_shape.rs",
  before:{mode:'100644',blob:'ab4b9aefde13523f6740dfe147e4e78668e9096e'},
  after:{mode:'100644',blob:'6805c67f525829744dde2fe32b31668b5c401e12'}},
 {path:".github/workflows/pages.yml",
  before:{mode:'100644',blob:'98465fbf4612b60382f70fe10c37c7131c51fae4'},
  after:{mode:'100644',blob:'d7f1bde3a54c4160c734d261999dd154bc28868e'}},
 {path:"tests/scoped-collection-proof-workflow.test.mjs",
  before:{mode:'100644',blob:'7acb7a44105ed4d8e99717f8942b95ac97d54332'},
  after:{mode:'100644',blob:'55907be6ee4717e3c00f84c0f022b12256ef8c34'}},
 {path:"tests/scoped-sr03-spatial-proof-workflow.test.mjs",
  before:{mode:'100644',blob:'2461489ebb017377a3b2de7ca2cf3330647ff2bd'},
  after:{mode:'100644',blob:'8fc8dfc2678d434df60a6d84d3a093f37f3918a0'}},
 {path:"tests/scoped-steam-chest-proof-workflow.test.mjs",
  before:{mode:'100644',blob:'e9c8bba3c9c1fea3a955ab72bf6db32d92b324e5'},
  after:{mode:'100644',blob:'115d0301aea69e7af8c9513c9aee0257b62d0db7'}},
 {path:"tests/scoped-switch-chest-proof-workflow.test.mjs",
  before:{mode:'100644',blob:'fe3070464a2a7b039da1af79bae0b6488e7c6065'},
  after:{mode:'100644',blob:'9e747f2bc4e60ce29451f4309e760a9cc3f14aaa'}}
];
// ACT-20261117-09PCODE-STEAM626-SINGLEFENCE-READONLY-TARGET-R22-GATE.
// Only three previously accepted 01B read-only target source leaves on the
// independently accepted 01C SingleFence Core. Never Stage/Writer/rights.
// Before/after Git blobs and modes are pinned to protected main eaba5d43.
const steam626SingleFenceReadOnlyTargetAfterShapeEntries=[
 {path:"crates/ddv-save-core/src/sr03_installed_geometry.rs",
  before:{mode:'100644',blob:'e3139d1c987dd0e2483d529c640d98ee118cee8f'},
  after:{mode:'100644',blob:'843b9189047995d3bdce94b31190ebb17b0f8458'}},
 {path:"crates/ddv-save-core/src/sr03_product_target.rs",
  before:{mode:'100644',blob:'20f306356908288cc8ff26bb126d28f087595697'},
  after:{mode:'100644',blob:'679475ec3fab8e8ec9f1e8ca3e91cde435ac6f5f'}},
 {path:"crates/ddv-save-core/src/steam_single_fence_product_target.rs",
  before:null,
  after:{mode:'100644',blob:'dd71dddccb4e961952529905dc7ac6f54f38cea5'}}
];
// ACT-20261117-09PCODE-APPEARANCE-FOUR-OPS-AFTER-FENCE-TARGET-R22-EXACT7.
// Six fixed accepted PR1952 Rust/CI leaves plus one Cargo pin-only release
// input, on current main7a7d after accepted 01B SingleFence Target exact3.
// No new Stage/Writer/rights/issuer/Lock/Pages flag or wildcard authority.
// The protected config can change only cargoTomlGitBlob to the reviewed
// Cargo.toml post Git blob; its independent Security L2 remains mandatory.
const appearanceFourAfterFenceTargetExact7Entries=[
  {path:'.github/workflows/core-product-session-boundary.yml',before:{mode:'100644',blob:'6237ca727129e0f933d6f2040ac993530d1b66e7'},after:{mode:'100644',blob:'a33bb679f4d22a6b0a1b64dafaa78300277adcc5'}},
  {path:'crates/ddv-save-core/Cargo.toml',before:{mode:'100644',blob:'effccf08990c8c1bc0626e5b0342fc68f6baf811'},after:{mode:'100644',blob:'a5bdd2af0a3f33b827fb55f87d6e0637ef50fd67'}},
  {path:'crates/ddv-save-core/src/indexed_read.rs',before:{mode:'100644',blob:'38e7f27c486acc2058895bc48356832b27f87555'},after:{mode:'100644',blob:'47b8b07e013f357fceee51cbc0ce676b271fb207'}},
  {path:'crates/ddv-save-core/src/semantic_writer.rs',before:{mode:'100644',blob:'fe914df7b69f168ba94889d5761d4b10667f7531'},after:{mode:'100644',blob:'20a63726d78e1d00a0c1cc854f5c22cc325cb0ef'}},
  {path:'crates/ddv-save-core/src/product_makeup_color1.rs',before:null,after:{mode:'100644',blob:'cc79ca8e87c2b6c82e84fc9c84636faf01df1455'}},
  {path:'crates/ddv-save-core/src/product_eyeball_color2.rs',before:null,after:{mode:'100644',blob:'c33c032d21ee91d0f4d341e44b00efb606e4e327'}},
  {path:'scripts/wasm-distribution/protected-release-inputs.json',before:{mode:'100644',blob:'7afda02936b28335d6ceec7f75a649e3aef067f2'},after:{mode:'100644',blob:'44e639fc5219bf41f61d22fbbc0b34383df8cd6a'}}
];
// ACT-20261117-09PCODE-FIVEFENCE-MAIN7F-COMPOSED-EXACT12-R22.
// Five accepted Switch626 Fence ADD operations from PR1921, current Appearance
// and SingleFence Core preserved. Seven immutable source leaves; four
// scoped non-clobbering shared additions MUST receive current Core/ABI QA.
// Exactly one protected input change: Cargo TOML Git blob; Writer/rights OFF.
// All original pre/post Git blobs and source order/mode are immutable.
// This profile is NOT an integration or product/permission authorization.
const switch626FiveFenceComposedMain7fExact12Entries=[
  {path:'.github/workflows/core-product-session-boundary.yml',before:{mode:'100644',blob:'a33bb679f4d22a6b0a1b64dafaa78300277adcc5'},after:{mode:'100644',blob:'6c5e9e7ca1a7caeb6b66e88d0f3a3d532f2216c3'}},
  {path:'crates/ddv-save-core/Cargo.toml',before:{mode:'100644',blob:'a5bdd2af0a3f33b827fb55f87d6e0637ef50fd67'},after:{mode:'100644',blob:'2f8452ee3c7a45bab9bb6cb7ab62010120e37c44'}},
  {path:'crates/ddv-save-core/src/fence_product_geometry.rs',before:{mode:'100644',blob:'71957aae82a384ec17f0f36667a31fd2c0915151'},after:{mode:'100644',blob:'62e18579c4ea99cf1c4b97608f23ba4054f9106e'}},
  {path:'crates/ddv-save-core/src/fence_product_target.rs',before:{mode:'100644',blob:'6de331b47f6b71bc17eeb34c41dfd38ea55f020f'},after:{mode:'100644',blob:'15858ed0da6a7dd4df45e9a34c4c91c5c40661e4'}},
  {path:'crates/ddv-save-core/src/semantic_writer.rs',before:{mode:'100644',blob:'20a63726d78e1d00a0c1cc854f5c22cc325cb0ef'},after:{mode:'100644',blob:'21cb91a48f6697f464df82eb7443d795b5a50716'}},
  {path:'crates/ddv-save-core/src/sr03_installed_geometry.rs',before:{mode:'100644',blob:'843b9189047995d3bdce94b31190ebb17b0f8458'},after:{mode:'100644',blob:'69ded024dfe186da025b5a270854050ddbd42061'}},
  {path:'crates/ddv-save-core/src/switch624_fence_fe01.rs',before:{mode:'100644',blob:'65e4e7a0ae70001c935fbbd90e2da05727c8a07d'},after:{mode:'100644',blob:'b4de9324dd2426c365a87933516144f5a0f69be6'}},
  {path:'crates/ddv-save-core/src/wasm_switch626_fixed_fence_add.rs',before:null,after:{mode:'100644',blob:'887b076f1593fb0337e3b817d464369b4dfea367'}},
  {path:'crates/ddv-save-core/src/wasm_worker.rs',before:{mode:'100644',blob:'59264164dcb6f04f3d33de9c053bb00061d10669'},after:{mode:'100644',blob:'fa47aae53ecf0d242b234a1ede67dd210ae8c67b'}},
  {path:'crates/ddv-save-core/src/worker_session.rs',before:{mode:'100644',blob:'914bd8e6a45a6d26f5011a9f4c95a4f459d0f498'},after:{mode:'100644',blob:'b89295b6d665e191e3872a50924a9091bf9d35d7'}},
  {path:'crates/ddv-save-core/src/worker_switch626_fixed_fence_add.rs',before:null,after:{mode:'100644',blob:'708494849861b95c478fbe66500e6af884cc2f40'}},
  {path:'scripts/wasm-distribution/protected-release-inputs.json',before:{mode:'100644',blob:'44e639fc5219bf41f61d22fbbc0b34383df8cd6a'},after:{mode:'100644',blob:'f81df4334a4d75760f33607eeca4385adffc966c'}}
];
// 09P-CODE 2026-11-17 fixed Steam626 active Male Makeup slot1 ColorIndex1.
// Original PR2006 exact seven typed Source leaves and one Cargo-only protected
// input; unrelated Core, Build, rights, Secret, Export, Writer and ON denied.
const steam626MakeupGeneratedAfterFiveFenceExact8Entries=[
 {path:'.github/workflows/core-product-session-boundary.yml',before:{mode:'100644',blob:'6c5e9e7ca1a7caeb6b66e88d0f3a3d532f2216c3'},after:{mode:'100644',blob:'c83fb6ba5b874048ce59e8221ef309222252af0b'}},
 {path:'crates/ddv-save-core/Cargo.toml',before:{mode:'100644',blob:'2f8452ee3c7a45bab9bb6cb7ab62010120e37c44'},after:{mode:'100644',blob:'d66296a76c6c380fb4475c70b20e3ebb00adc7eb'}},
 {path:'crates/ddv-save-core/src/product_makeup_color1.rs',before:{mode:'100644',blob:'cc79ca8e87c2b6c82e84fc9c84636faf01df1455'},after:{mode:'100644',blob:'952fa70789192f3207df6e4fcdf49d028d62a4d0'}},
 {path:'crates/ddv-save-core/src/wasm_steam626_makeup_color1.rs',before:null,after:{mode:'100644',blob:'e9b98a46b18b099e6ab0601a2a3171e52c4ca0c2'}},
 {path:'crates/ddv-save-core/src/wasm_worker.rs',before:{mode:'100644',blob:'fa47aae53ecf0d242b234a1ede67dd210ae8c67b'},after:{mode:'100644',blob:'f43e5809473be8b68b50342c5efff2221e83f97f'}},
 {path:'crates/ddv-save-core/src/worker_session.rs',before:{mode:'100644',blob:'b89295b6d665e191e3872a50924a9091bf9d35d7'},after:{mode:'100644',blob:'857262786d8426c8d5fb9926c93ab7d293711eaf'}},
 {path:'crates/ddv-save-core/src/worker_steam626_makeup_color1.rs',before:null,after:{mode:'100644',blob:'4c2c4741253c82d61faf8e2cc2d6e2fdef3eddb4'}},
 {path:'scripts/wasm-distribution/protected-release-inputs.json',before:{mode:'100644',blob:'f81df4334a4d75760f33607eeca4385adffc966c'},after:{mode:'100644',blob:'f70ddb4e88900d12fa426519ea7315c2e0812ba2'}}
];
const switch624FrpMain838Exact14Entries=[
  {
    "path": "crates/ddv-save-core/Cargo.toml",
    "before": {
      "mode": "100644",
      "blob": "d66296a76c6c380fb4475c70b20e3ebb00adc7eb"
    },
    "after": {
      "mode": "100644",
      "blob": "cfd550b690e42e93a48b913457c35a5ea0cb7bc7"
    }
  },
  {
    "path": "crates/ddv-save-core/src/frp624_product_geometry.rs",
    "before": null,
    "after": {
      "mode": "100644",
      "blob": "6b676bf797e45825f6fd86dd69b9b92812db24af"
    }
  },
  {
    "path": "crates/ddv-save-core/src/frp624_product_stage.rs",
    "before": null,
    "after": {
      "mode": "100644",
      "blob": "4450172a472d2364e4d2fd38c02bfca835e9349c"
    }
  },
  {
    "path": "crates/ddv-save-core/src/frp624_product_target.rs",
    "before": null,
    "after": {
      "mode": "100644",
      "blob": "1885c46e3224a70439d5883b4cc48f1083034eb4"
    }
  },
  {
    "path": "crates/ddv-save-core/src/placement_saved_refs.rs",
    "before": {
      "mode": "100644",
      "blob": "78ad4f9f704fc701c31e93c1525edac4a722db13"
    },
    "after": {
      "mode": "100644",
      "blob": "2ad0d925cebfcb19bb39b2afe5ff6404966ad849"
    }
  },
  {
    "path": "crates/ddv-save-core/src/product_session.rs",
    "before": {
      "mode": "100644",
      "blob": "ac17f7a736f6c61152b4a7fd032f711b3fbec7cf"
    },
    "after": {
      "mode": "100644",
      "blob": "6c7cf61f41a8b985ae5ccbd7d84c0aa475040f28"
    }
  },
  {
    "path": "crates/ddv-save-core/src/semantic_writer.rs",
    "before": {
      "mode": "100644",
      "blob": "21cb91a48f6697f464df82eb7443d795b5a50716"
    },
    "after": {
      "mode": "100644",
      "blob": "9472a792277f15e69d64118919835b12bed129f1"
    }
  },
  {
    "path": "crates/ddv-save-core/src/sr03_installed_geometry.rs",
    "before": {
      "mode": "100644",
      "blob": "69ded024dfe186da025b5a270854050ddbd42061"
    },
    "after": {
      "mode": "100644",
      "blob": "d4210353815073ea871f18c8e8bc432cff653e89"
    }
  },
  {
    "path": "crates/ddv-save-core/src/sr03_product_target.rs",
    "before": {
      "mode": "100644",
      "blob": "679475ec3fab8e8ec9f1e8ca3e91cde435ac6f5f"
    },
    "after": {
      "mode": "100644",
      "blob": "8d5d168413ac7a93d1fc3ef168d8da98b1701c61"
    }
  },
  {
    "path": "crates/ddv-save-core/src/wasm_switch624_frp01.rs",
    "before": null,
    "after": {
      "mode": "100644",
      "blob": "b60f40a3c87d97f21332fc6d8f005e100c4fd7fa"
    }
  },
  {
    "path": "crates/ddv-save-core/src/wasm_worker.rs",
    "before": {
      "mode": "100644",
      "blob": "f43e5809473be8b68b50342c5efff2221e83f97f"
    },
    "after": {
      "mode": "100644",
      "blob": "e7da141bc3525f234b999b0febc47540d95e1560"
    }
  },
  {
    "path": "crates/ddv-save-core/src/worker_session.rs",
    "before": {
      "mode": "100644",
      "blob": "857262786d8426c8d5fb9926c93ab7d293711eaf"
    },
    "after": {
      "mode": "100644",
      "blob": "c30662b61b08c52179c027f53a1a96f7be4d2bd9"
    }
  },
  {
    "path": "crates/ddv-save-core/src/worker_switch624_frp01.rs",
    "before": null,
    "after": {
      "mode": "100644",
      "blob": "8081180b5be4578067eaca7d4fee8d6f61a6a300"
    }
  },
  {
    "path": "scripts/wasm-distribution/protected-release-inputs.json",
    "before": {
      "mode": "100644",
      "blob": "f70ddb4e88900d12fa426519ea7315c2e0812ba2"
    },
    "after": {
      "mode": "100644",
      "blob": "865aa54e99d11029250478ba6583bdec226dfa6d"
    }
  }
];

// 09P-CODE exact Steam626 SingleFence isolated Reader source8 + protected Cargo-only pin.
// No generic Writer/Stage, issuer grant, Sign, Deploy or Feature auto-enable.
const steam626SingleFenceReaderMain2c9Exact9Entries=[
  {
    "path": ".github/workflows/core-product-session-boundary.yml",
    "before": {
      "mode": "100644",
      "blob": "c83fb6ba5b874048ce59e8221ef309222252af0b"
    },
    "after": {
      "mode": "100644",
      "blob": "4e23432fb4dbcebdda43843047b2bb54ed07d2a0"
    }
  },
  {
    "path": "crates/ddv-save-core/Cargo.toml",
    "before": {
      "mode": "100644",
      "blob": "cfd550b690e42e93a48b913457c35a5ea0cb7bc7"
    },
    "after": {
      "mode": "100644",
      "blob": "f7c3b723804f9f3e11ffcbcd0f786d23e4e540bd"
    }
  },
  {
    "path": "crates/ddv-save-core/src/product_session.rs",
    "before": {
      "mode": "100644",
      "blob": "6c7cf61f41a8b985ae5ccbd7d84c0aa475040f28"
    },
    "after": {
      "mode": "100644",
      "blob": "e7d919bdd36a0f6930f5d9ca4f5e9c21f8f42e54"
    }
  },
  {
    "path": "crates/ddv-save-core/src/steam_single_fence_product_target.rs",
    "before": {
      "mode": "100644",
      "blob": "dd71dddccb4e961952529905dc7ac6f54f38cea5"
    },
    "after": {
      "mode": "100644",
      "blob": "32e74beb57b49e9187d82a7ff229d460ac246974"
    }
  },
  {
    "path": "crates/ddv-save-core/src/steam_single_fence_readonly.rs",
    "before": null,
    "after": {
      "mode": "100644",
      "blob": "6fe5d55a605ec8f66d6ba1df2432f962f9ea6b50"
    }
  },
  {
    "path": "crates/ddv-save-core/src/wasm_steam_single_fence_readonly.rs",
    "before": null,
    "after": {
      "mode": "100644",
      "blob": "a4255e51db6a7168d045888e08c53c241ff4010d"
    }
  },
  {
    "path": "crates/ddv-save-core/src/wasm_worker.rs",
    "before": {
      "mode": "100644",
      "blob": "e7da141bc3525f234b999b0febc47540d95e1560"
    },
    "after": {
      "mode": "100644",
      "blob": "fbf791896a49ccee89d7149caca8fd2115e58438"
    }
  },
  {
    "path": "crates/ddv-save-core/src/worker_session.rs",
    "before": {
      "mode": "100644",
      "blob": "c30662b61b08c52179c027f53a1a96f7be4d2bd9"
    },
    "after": {
      "mode": "100644",
      "blob": "a25d249564570f0845772efa7e465aa86dd6b7f9"
    }
  },
  {
    "path": "scripts/wasm-distribution/protected-release-inputs.json",
    "before": {
      "mode": "100644",
      "blob": "865aa54e99d11029250478ba6583bdec226dfa6d"
    },
    "after": {
      "mode": "100644",
      "blob": "53db0a9f23c3345056d87d2fcc98f8e7097501ea"
    }
  }
];
// ACT1581 exact protected Source tree selector only. Not Writer, signing, or merge grant.
const switch626MakeupMain107eExact8Entries=Object.freeze([
  {
    "path": ".github/workflows/core-product-session-boundary.yml",
    "before": {
      "mode": "100644",
      "blob": "f2c23679e1c663bb244888b63a5633ab53abcc12"
    },
    "after": {
      "mode": "100644",
      "blob": "8de94431af1e6d58e216fa06bf91a1329a7f7063"
    }
  },
  {
    "path": "crates/ddv-save-core/Cargo.toml",
    "before": {
      "mode": "100644",
      "blob": "aa6b1dd771da305bf7a21c6101fb4620a8b74b93"
    },
    "after": {
      "mode": "100644",
      "blob": "751a73da41d8b58f7de70643f50b97722a3c1260"
    }
  },
  {
    "path": "crates/ddv-save-core/src/product_makeup_color1.rs",
    "before": {
      "mode": "100644",
      "blob": "952fa70789192f3207df6e4fcdf49d028d62a4d0"
    },
    "after": {
      "mode": "100644",
      "blob": "749831d8c41a24585a490b5ed23640fc8d50fc3d"
    }
  },
  {
    "path": "crates/ddv-save-core/src/worker_session.rs",
    "before": {
      "mode": "100644",
      "blob": "a5b7c93bf66e6d48c4b7bef392777b8b7beb615e"
    },
    "after": {
      "mode": "100644",
      "blob": "254af029304f6a357c8c0a0e7a1376b80313d038"
    }
  },
  {
    "path": "crates/ddv-save-core/src/wasm_worker.rs",
    "before": {
      "mode": "100644",
      "blob": "bf7ef74754921b29ca1229a1519019f9105ac800"
    },
    "after": {
      "mode": "100644",
      "blob": "5fbb1f3d393df127da67f1eafe9796fbb7ce3a56"
    }
  },
  {
    "path": "crates/ddv-save-core/src/worker_switch626_makeup_color1.rs",
    "before": null,
    "after": {
      "mode": "100644",
      "blob": "945d6dee10f62396d894ea631e40c3fe26e6d0f0"
    }
  },
  {
    "path": "crates/ddv-save-core/src/wasm_switch626_makeup_color1.rs",
    "before": null,
    "after": {
      "mode": "100644",
      "blob": "b8a24a1e288f763349355bd05bf3b7cfd51b0b4a"
    }
  },
  {
    "path": "scripts/wasm-distribution/protected-release-inputs.json",
    "before": {
      "mode": "100644",
      "blob": "5d2b35f6bc9f0b8544fc52f25a35614b59913d96"
    },
    "after": {
      "mode": "100644",
      "blob": "30551c7cc566614f64c8ba04748c3aef44b419bb"
    }
  }
]);
// ACT1581 / W-CORE-004: pending 01A exact ONE leaf BattlePass reference
// safety repair, never a generic Core/Security/Writer/Op authorization.
// Protected-main Gate-first Security L2 and sole 09INT are prerequisites.
const steam626AmountOngoingBattlePassExact1Entries=Object.freeze([{
 path:'crates/ddv-save-core/src/product_amount_scoped.rs',
 before:{mode:'100644',blob:'e6e360f5326b9a5cf6884600a4c9ecf642aa12fa'},
 after:{mode:'100644',blob:'13d861165bea3fb37f79d7bbc4cb9ab51669fa78'}
}]);
// ACT1581 W-CORE-004: exact THREE original 01A PR2267 private-only
// Rust native V2 bridge leaves, following accepted PR2263 one-leaf Core.
// No general private writer authorization, no public browser/Op/Pages grant.
const steam626AmountPrivateBridgeExact3Entries=Object.freeze([
 {path:'.github/workflows/01a-private-product-amount-v2-bridge.yml',
  before:null,
  after:{mode:'100644',blob:'77f8bfa29f55f28d348892086c684af9c52011bd'}},
 {path:'crates/ddv-save-core/src/bin/wand-local-rust-v2-noop.rs',
  before:{mode:'100644',blob:'052219d4d8078c1ed0ad4fc4a02843423de8ee6c'},
  after:{mode:'100644',blob:'9f783e64ec44fdc2d863a4634f3d334a89cf7f62'}},
 {path:'crates/ddv-save-core/src/semantic_writer.rs',
  before:{mode:'100644',blob:'9472a792277f15e69d64118919835b12bed129f1'},
  after:{mode:'100644',blob:'f11c68ca214853c762788ae032710fc4683dd472'}}
]);
// ACT1581 W-CORE-004: exact one Windows SHA-stable Steam626 pack
// DATA/.gitattributes GitBlob. Its path is inside crate and changes Core
// Tree, without editing actual Rust bytes/codec/public rights/flags.
const steam626WindowsLfPackExact1Entries=Object.freeze([{
 path:'crates/ddv-save-core/data/.gitattributes',
 before:null,
 after:{mode:'100644',blob:'f67de2e4316397b93f95088c379f724ea81e9399'}
}]);
// ACT1581 / original 01A PR2278 signed real saved Mannequin map:
// exact ONE semantic Rust leaf, QRC changed semantic QA2281 10POS32NEG.
// This selector alone is NOT permission to edit/export any Owner P1G.
const steam626MannequinRealMapExact1Entries=Object.freeze([{
 path:'crates/ddv-save-core/src/product_amount_scoped.rs',
 before:{mode:'100644',blob:'13d861165bea3fb37f79d7bbc4cb9ab51669fa78'},
 after:{mode:'100644',blob:'522e8e8d6beec597b2e5e176cfbe8a6d8e38a124'}
}]);
// DRAFT 09P ACT1581: the ONLY candidate Source2 is 01A PR2318.
// 05QR-C PR2324 actual Rust heap QA is not product V2 or Writer permission.
const steam626PendingRustHeapScrubExact2Entries=Object.freeze([
 {path:'crates/ddv-save-core/src/wasm_worker.rs',
  before:{mode:'100644',blob:'5fbb1f3d393df127da67f1eafe9796fbb7ce3a56'},
  after:{mode:'100644',blob:'6432275d2909e6bc6d39265ae70cc7176fc37106'}},
 {path:'tests/01a-wasm-pending-decoded-buffer-wipe.test.mjs',
  before:null,after:{mode:'100644',blob:'8fb7d761d145a4f64ea1b97470c57cf16db5bb79'}}
]);
// 09P-CODE ACT1581 GATE-FIRST: exact Steam626 Inventory0 Source15 only.
// This gate must be merged to protected main by sole 09INT BEFORE a product
// candidate. It does not enroll a signer, update Cargo pin, grant Writer,
// publish Pages or accept the five candidate-owned file SHAs by self-claim.
// Original Owner encrypted Product V2 + independent 04 QR-S remain separate.
const steam626Inventory0GateFirstExact15Entries=Object.freeze([
  {
    "path": ".github/workflows/01a-steam626-inventory0-dedicated-rust-source.yml",
    "before": null,
    "after": {
      "mode": "100644",
      "blob": "19d7f0c532badecc86f8d36ff89eed1ba0e28bf2"
    }
  },
  {
    "path": "crates/ddv-save-core/Cargo.toml",
    "before": {
      "mode": "100644",
      "blob": "751a73da41d8b58f7de70643f50b97722a3c1260"
    },
    "after": {
      "mode": "100644",
      "blob": "b3455c36d9d60b4a0e415026a095e47fe577644d"
    }
  },
  {
    "path": "crates/ddv-save-core/src/wasm_worker.rs",
    "before": {
      "mode": "100644",
      "blob": "6432275d2909e6bc6d39265ae70cc7176fc37106"
    },
    "after": {
      "mode": "100644",
      "blob": "775a2766f237d44ae77fa5347e9adf430c8580d2"
    }
  },
  {
    "path": "src/lib/ddv/core/save/p1g-rust-worker-readonly-bridge.mjs",
    "before": {
      "mode": "100644",
      "blob": "f76418235f302c2cdcc52de7f4b771e4c6f193f6"
    },
    "after": {
      "mode": "100644",
      "blob": "3b61beb6288826c57ab9d029b214cee614dfafc5"
    }
  },
  {
    "path": "src/lib/ddv/core/save/product-scoped-amount-local-adapter.mjs",
    "before": {
      "mode": "100644",
      "blob": "334a8dc69485981598773923c265e97f16296fb1"
    },
    "after": {
      "mode": "100644",
      "blob": "5a9ae08833f11d03fe1986bd679438591842b76e"
    }
  },
  {
    "path": "src/lib/ddv/core/save/product-scoped-amount-transport.mjs",
    "before": {
      "mode": "100644",
      "blob": "16cfcda06614be2536b877872b15f7ff85bc0f2b"
    },
    "after": {
      "mode": "100644",
      "blob": "0312afdd91cb07d377a233f454ff07894de6eec5"
    }
  },
  {
    "path": "src/lib/ddv/core/save/product-wasm-read-owner.mjs",
    "before": {
      "mode": "100644",
      "blob": "17c3daf6eaa529745c9c48775d677e1289955872"
    },
    "after": {
      "mode": "100644",
      "blob": "81cd04b906f6cab7b1ea1749fb7fc981003a3b03"
    }
  },
  {
    "path": "tests/01a-steam626-catalog0-product-worker-port.test.mjs",
    "before": null,
    "after": {
      "mode": "100644",
      "blob": "0b3c1a8d8a75ac2cbe1a87555d08e75f0deddc6b"
    }
  },
  {
    "path": "tests/01a-steam626-inventory0-exclusive-rust-feature.test.mjs",
    "before": null,
    "after": {
      "mode": "100644",
      "blob": "0594a05690faf4902e761831887b6a31ae39d89a"
    }
  },
  {
    "path": "tests/product-steam626-catalog0-local-adapter.test.mjs",
    "before": null,
    "after": {
      "mode": "100644",
      "blob": "4e7f7afe825d7cabb9469385b33322e98ad7aa2b"
    }
  },
  {
    "path": ".github/workflows/09p-r22-inventory0-product-source.yml",
    "before": null,
    "after": {
      "mode": "100644",
      "blob": "0b6c58d29ab40dbc017ed8492d06758832575e0d"
    }
  },
  {
    "path": "scripts/wasm-distribution/r22-inventory0-product-source.mjs",
    "before": null,
    "after": {
      "mode": "100644",
      "blob": "36aedda6b8bdb67a7c34e8581ff7d2d58761b14e"
    }
  },
  {
    "path": "tests/09p-r22-inventory0-product-source.test.mjs",
    "before": null,
    "after": {
      "mode": "100644",
      "blob": "258fda117459de485867b4a49a34e22033676195"
    }
  },
  {
    "path": "scripts/wasm-distribution/r22-inventory0-unsigned-pair.mjs",
    "before": null,
    "after": {
      "mode": "100644",
      "blob": "221ad641af096b28544e781c663be2379aa67897"
    }
  },
  {
    "path": "tests/09p-r22-inventory0-unsigned-pair.test.mjs",
    "before": null,
    "after": {
      "mode": "100644",
      "blob": "e54438b84ced80fc5f12f50bb709074e16c152c1"
    }
  }
]);

const gatePaths=['scripts/wasm-distribution/verify-protected-release.mjs',
 'scripts/wasm-distribution/r22-accepted-rust-scope.mjs','scripts/int-selection-preflight.mjs'];
const git=(cwd,...args)=>execFileSync('git',args,{cwd,encoding:'utf8',maxBuffer:16*1024*1024,
 env:{...process.env,GIT_NO_REPLACE_OBJECTS:'1'},stdio:['ignore','pipe','pipe']}).trim();
const same=(a,b)=>a===null||b===null?a===b:a.mode===b.mode&&a.blob===b.blob;
const deny=m=>{throw Error('R22_ACCEPTED_SCOPE_'+m)};

// Shared existing exact-selection verifier: every candidate path and both
// regular-file blob/mode endpoints must match. No partial or superset permit.
export function verifyExactScopeEntries(cwd,base,source,approved){
 if(!Array.isArray(approved)||approved.length===0)deny('EMPTY');
 const selected=inspectSelection(cwd,{base,source,main:base,paths:approved.map(e=>e.path)});
 if(selected.entries.length!==approved.length)deny('COUNT');
 const byPath=new Map(approved.map(e=>[e.path,e]));
 for(const e of selected.entries){
  const pin=byPath.get(e.path);
  if(!pin||!same(e.before,pin.before)||!same(e.after,pin.after))deny('BLOB_OR_MODE');
 }
 return selected;
}

export function verifyAcceptedRustScope(cwd,base,source){
 if(!SHA.test(base??'')||!SHA.test(source??''))deny('SHA');
 // The old R22 historical ancestor remains checked by the caller. The
 // specific accepted composition additionally requires its reviewed base
 // lineage and the trusted gate already on the live protected base.
 git(cwd,'merge-base','--is-ancestor',APPROVED_ANCESTOR,base);
 for(const path of gatePaths){
  const pre=git(cwd,'rev-parse','--verify',base+':'+path);
  const post=git(cwd,'rev-parse','--verify',source+':'+path);
  if(!SHA.test(pre)||pre!==post)deny('PROTECTED_GATE_NOT_IDENTICAL');
 }
 // Exact changed paths alone do not constrain unchanged Core files.
 // Bind the complete reviewed Core trees; unrelated non-Core main changes
 // may proceed, but any cumulative Core drift requires new acceptance.
 const corePath='crates/ddv-save-core';
 const baseCore=git(cwd,'rev-parse','--verify',base+':'+corePath);
 const sourceCore=git(cwd,'rev-parse','--verify',source+':'+corePath);
 const profile=selectAcceptedCorePair(baseCore,sourceCore);
 // New Inventory0 source is accepted only as ONE direct child of the
 // already-reviewed protected Gate; no second parent, old-base stack or
 // candidate-supplied self-accepting verifier. Historical profiles unchanged.
 if(profile.metadata.inventory0GateFirstSourceOnly===true){
  const parents=git(cwd,'rev-list','--parents','-n','1',source).split(/\s+/);
  if(parents.length!==2||parents[1]!==base)
   deny('INVENTORY0_EXACT_ONE_PROTECTED_PARENT_REQUIRED');
 }
 const result=verifyExactScopeEntries(cwd,base,source,profile.entries);
 if(result.entries.length!==profile.count)deny('FIXED_SCOPE_COUNT');
 // The pre-Gate projection has a different root from the Gate+product commit.
 // Never embed the post-Gate Git tree SHA inside the Gate script itself:
 // doing so would make its own blob/tree identity self-referential.
 // Derive it from the exact validated candidate commit at verification time.
 const postGateProductTree=(profile.metadata.sourcePr===2012||profile.metadata.sourcePr===2034)
  ?git(cwd,'rev-parse','--verify',source+'^{tree}'):undefined;
 if(postGateProductTree!==undefined&&!SHA.test(postGateProductTree))
  deny('PRODUCT_TREE');
 return {status:'R22_EXACT_ACCEPTED_SOURCE_SCOPE_MATCH_ONLY',
  ...profile.metadata,
  ...(postGateProductTree?{
   postGateProductTree,postGateProductTreeFromValidatedSourceCommit:true
  }:{}),
  candidateHead:source,base,entryCount:profile.count,
  mergeAuthorized:false,writerAuthorized:false};
}

// This is a fixed source selector, not an authority grant. Neither a caller
// nor a candidate can supply the allowed paths/trees or change protected gate
// identity. Unknown Core pairs and mixed old/new pairs fail closed.
function selectAcceptedCorePair(baseCore,sourceCore){
 // Product-specific exact GitBlob/Tree selection, NOT an approved public
 // writer nor the current read-only Bamboo Sigstore profile. The old release
 // config still explicitly denies new Cargo b345, Worker775 and any Writer.
 if(baseCore==='42bebc4aa5a451abc4a9df29f0bc298df92df6a3'){
  if(sourceCore!=='6750ed91920f33be9f2acf180ca1326340d969ed')
   deny('INVENTORY0_RUST_CORE_TREE_DENIED');
  return {entries:steam626Inventory0GateFirstExact15Entries,count:15,metadata:{
   sourcePr:2356,sourceContractPr:2379,
   inventory0GateFirstSourceOnly:true,originalSourceCount:10,
   originalExternalProofCount:5,
   sourceParentRequiresProtectedMain:true,
   oldReaderCargoGitBlob:'751a73da41d8b58f7de70643f50b97722a3c1260',
   newInventory0CargoGitBlob:'b3455c36d9d60b4a0e415026a095e47fe577644d',
   newInventory0WorkerGitBlob:'775a2766f237d44ae77fa5347e9adf430c8580d2',
   originalEncryptedSaveV2:'NOT_RUN',
   independentProductSignerSecurityL2:'NOT_RUN',
   sourceQaNotProductAuthorization:true,
   signerAuthorized:false,writerAuthorized:false,operationOn:false,
   productSignedBuild:false,mergeAuthorized:false}};
 }

 if(baseCore==='7de35a07df55bdf7f439caac6e4d734dd91fe9ba'){
  if(sourceCore!=='ca1ef1772b53ff535618fc8263cd647f757f3dad')deny('CANDIDATE_CORE_TREE');
  return {entries,count:15,metadata:{
   sourcePr:1372,sourceHead:'7c280ca740bda68cd69ceb46337fd75bf3e133bc',
   sourceTree:'06b31f58c383ca59e981248f2a23f7d6c41d0eef',
   historicalCandidateHead:'eaeafb84b55d522f1f6eab6e84d879780fc1d031'}};
 }
 if(baseCore==='ca1ef1772b53ff535618fc8263cd647f757f3dad'){
  if(sourceCore!=='2b50d1208e830433bd86bb9506b8cf67228d518d')deny('CANDIDATE_CORE_TREE');
  return {entries:switch626ChestEntries,count:4,metadata:{
   sourcePr:1422,sourceHead:'5a5ce7eab0e5922d15e50b9ed699c44570c23f30',
   sourceTree:'a73f5b6da2856b2329cee3b158c6e1e74b097d3c'}};
 }
 if(baseCore==='2b50d1208e830433bd86bb9506b8cf67228d518d'){
  if(sourceCore!=='aceda9d906c3137d717824a3079e84165ab5f62e')deny('CANDIDATE_CORE_TREE');
  return {entries:switch626ChestFeatureEntries,count:3,metadata:{
   sourcePr:1458,sourceHead:'d2f903e43f84bb11e1133c2e3933fce9977dc122',
   sourceTree:'9b0b7dacdd40ddcfd5f86aa1143b6b795cede583'}};
 }
 if(baseCore==='aceda9d906c3137d717824a3079e84165ab5f62e'){
  if(sourceCore!=='e5c863b756e9593afcfe4f3c24f122c91a4c4b6f')deny('CANDIDATE_CORE_TREE');
  return {entries:steam626ChestAtomicEntries,count:4,metadata:{
   sourcePr:1527,sourceHead:'c0a12d3f3dc177c3370864aeb1c5c65457b29b9f',
   sourceTree:'48290d289cb2a96c369c3adc1f7645737d0c8a4d'}};
 }
 if(baseCore==='e5c863b756e9593afcfe4f3c24f122c91a4c4b6f'){
  if(sourceCore!=='c93264e1c060fa1dacba71ad2cd72628ef6dbbc4')deny('CANDIDATE_CORE_TREE');
  return {entries:steam626Sr03CumulativeEntries,count:18,metadata:{
   sourcePr:1639,sourceHead:'9bb806ae6f137f7ba7fa7bd673f3c336a875d14d',
   sourceTree:'8b9f02a6dbc4992a4fa545fb206e5a5863725b93'}};
 }
 if(baseCore==='c93264e1c060fa1dacba71ad2cd72628ef6dbbc4'){
  if(sourceCore!=='f942165161b98cf7f9de16a1f7459cf3d337dc61')deny('CANDIDATE_CORE_TREE');
  return {entries:switch626Rm01CumulativeEntries,count:14,metadata:{
   sourcePr:1649,sourceHead:'6e73a255b021b20099506c989947594f88a46c97',
   sourceTree:'c1af61e8899985c72d8bb4f6d5bde715a1222354'}};
 }
 if(baseCore==='f942165161b98cf7f9de16a1f7459cf3d337dc61'){
  if(sourceCore!=='fa7aeef5dc1459104564bf1eb9704d315ab7c415')deny('CANDIDATE_CORE_TREE');
  return {entries:steam626AppearanceCumulativeEntries,count:14,metadata:{
   sourcePr:1699,sourceHead:'06adf0c44a77e3ba653a62a14160207a7a9d91be',
   sourceTree:'dfe419896223d4f3fed14e63bb5aaf1abb573a47'}};
 }
 if(baseCore==='63d1b9f88a07c79c54cb433f4d1cbd9cf1e1ed4b'){
  if(sourceCore!=='a506951b125b2f492f4d75293234574263342e90')deny('CANDIDATE_CORE_TREE');
  return {entries:fd01Fe01PostFrpMain6abEntries,count:15,metadata:{
   sourcePr:1914,sourceHead:'49c6db828b12ddb86a7a639bf7cb106c987e165c',
   sourceTree:'c93c06aa476e9eaca9996106328cf75f2cf86f2f',
   acceptedAncestorPr:1895,acceptedAncestorHead:'fa71e802269f688d804304d3cc0966f1a3c27f10'}};
 }
 if(baseCore==='a506951b125b2f492f4d75293234574263342e90'){
  if(sourceCore!=='681177d588b7bfba04f2497dff81e36163a3350e')deny('CANDIDATE_CORE_TREE');
  return {entries:steam626SingleFencePostFd01Fe01Main63cEntries,count:6,metadata:{
   sourcePr:1861,sourceHead:'9017266e795ded11dc0e1c40eb52425e8d999a6b',
   acceptedAncestorPr:1931,acceptedAncestorHead:'49c6db828b12ddb86a7a639bf7cb106c987e165c',
   independentSourceQa:'REQUIRED_CURRENT_CORE_RELEASE_PROFILE_L2_NOT_RUN'}};
 }
 if(baseCore==='681177d588b7bfba04f2497dff81e36163a3350e'){
  if(sourceCore!=='7068b711eb70c074edfc9a81c542e310fa9bb691')deny('CANDIDATE_CORE_TREE');
  return {entries:steam626SingleFenceReadOnlyTargetAfterShapeEntries,count:3,metadata:{
   sourcePr:1938,sourceHead:'01bccbf3dfb948b732fcb7c8e7be9e510c9a11a4',
   projectedRootBeforeGate:'d1ba48232832889d3c96d293cc6dbe316a1d007a',
   fixedSourceQaPr:1949,
   independentNewReleaseProfileL2:'NOT_RUN'}};
 }
 if(baseCore==='7068b711eb70c074edfc9a81c542e310fa9bb691'){
  if(sourceCore!=='bfea42aa4f2097deffe73d2016de62b1103c0723')deny('CANDIDATE_CORE_TREE');
  return {entries:appearanceFourAfterFenceTargetExact7Entries,count:7,metadata:{
   sourcePr:1952,sourceHead:'91c5c2a3da3c2a287c9210f3b2330c1f858cfb6a',
   productSourceExact6:true,protectedCargoPinOnly:true,
   protectedCargoBefore:'effccf08990c8c1bc0626e5b0342fc68f6baf811',
   protectedCargoAfter:'a5bdd2af0a3f33b827fb55f87d6e0637ef50fd67',
   immutableSourceProjectionCore:'bfea42aa4f2097deffe73d2016de62b1103c0723',
   independentSecurityL2Required:true}};
 }
 if(baseCore==='bfea42aa4f2097deffe73d2016de62b1103c0723'){
  if(sourceCore!=='fa23c80199225e20639be7da80c8236b4b82a013')deny('CANDIDATE_CORE_TREE');
  return {entries:switch626FiveFenceComposedMain7fExact12Entries,count:12,metadata:{
   inheritedSourcePr:1921,inheritedSourceHead:'88c1b08464201b85a90880c442ec2526bd2dda05',
   inheritedOnlyGitLeaves:7,composedCurrentSharedLeaves:4,
   acceptedOriginalOldR22Pr:1957,acceptedOriginalOldR22QaPr:1961,
   protectedInputOnlyCargoBlobPin:true,
   composedCurrentSourceRoot:'2e865ef598565f86c2fb14dde7624683b1e04d7d',
   securityL2NotInferred:true,currentCoreAbiQaNotInherited:true,
   writerAuthorized:false}}; 
 }
 if(baseCore==='fa23c80199225e20639be7da80c8236b4b82a013'){
  if(sourceCore!=='82d9500795262b9475160285a2778333d91603ea')deny('CANDIDATE_CORE_TREE');
  return {entries:steam626MakeupGeneratedAfterFiveFenceExact8Entries,count:8,metadata:{
   sourcePr:2006,sourceHead:'8abad34033967b524e88d7be3c19ca259f081437',
   sourceLeafCount:7,protectedInputOnlyCargoBlobPin:true,
   protectedCargoBefore:'2f8452ee3c7a45bab9bb6cb7ab62010120e37c44',
   protectedCargoAfter:'d66296a76c6c380fb4475c70b20e3ebb00adc7eb',
   currentAbiL2NotInferred:true,securityL2Required:true,
   privateOriginalSaveV2:'NOT_RUN',writerAuthorized:false}};
 }
 if(baseCore==='82d9500795262b9475160285a2778333d91603ea'){
  if(sourceCore!=='b454aeef4455408b73aaafd6d3629dfdeb7ae63c')deny('CANDIDATE_CORE_TREE');
  return {entries:switch624FrpMain838Exact14Entries,count:14,metadata:{
   sourcePr:2012,sourceHead:'18cf476873a8c6b469748372604004e86f41e31b',
   schema:624,exactSwitchBid:'52BD625D9B4E0053',
   sourceLeafCount:13,acceptedHistoricalSourcePr:1934,
   protectedConfigBefore:'f70ddb4e88900d12fa426519ea7315c2e0812ba2',
   protectedConfigAfter:'865aa54e99d11029250478ba6583bdec226dfa6d',
   approvedCargoBlobBefore:'d66296a76c6c380fb4475c70b20e3ebb00adc7eb',
   approvedCargoBlobAfter:'cfd550b690e42e93a48b913457c35a5ea0cb7bc7',
   preGateExact14ProjectionTree:'93e0776f1f1f11ba1550a3ba9e3ff521c194b391',
   independentNewAbiL2Required:true,independentSecurityL2Required:true,
   realEncryptedOriginalP1gV2:'NOT_RUN',writerAuthorized:false,opOn:false}};
 }
 if(baseCore==='b454aeef4455408b73aaafd6d3629dfdeb7ae63c'){
  if(sourceCore!=='821d4609dcf93ace38feb00193dfaf6d8d9b363f')deny('CANDIDATE_CORE_TREE');
  return {entries:steam626SingleFenceReaderMain2c9Exact9Entries,count:9,metadata:{
   sourcePr:2034,sourceHead:'fe9baeb82b4bb61b31e1d0e66d93dd31076d8891',
   sourceTree:'85d92e1b21e93934e1dc20fb49ebaef37d599aad',
   exactSteamBuild:'releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22',
   sourceLeafCount:8,protectedCargoBefore:'865aa54e99d11029250478ba6583bdec226dfa6d',
   protectedCargoAfter:'53db0a9f23c3345056d87d2fcc98f8e7097501ea',
   cargoBlobBefore:'cfd550b690e42e93a48b913457c35a5ea0cb7bc7',
   cargoBlobAfter:'f7c3b723804f9f3e11ffcbcd0f786d23e4e540bd',
   readerOnly:true,generatedAbiL2Required:true,independentSecurityL2Required:true,
   realEncryptedOriginalP1gV2:'NOT_RUN',writerAuthorized:false,operationOn:false}};
 }
 if(baseCore==='b5416aa726caea9d311075599ac606e11285b295'){
  if(sourceCore!=='42086449f9deef26ed48b21d7edab0f5685da7c2')deny('CANDIDATE_CORE_TREE');
  return {entries:switch626MakeupMain107eExact8Entries,count:8,metadata:{
   sourcePr:2217,sourceHead:'b2735bc63884049a5f3d16423e5970553f168766',
   acceptedProtectedParent:'d37a774a8ce2ac08ef05389f0d14d3442063edeb',
   coreBefore:'b5416aa726caea9d311075599ac606e11285b295',
   coreAfter:'42086449f9deef26ed48b21d7edab0f5685da7c2',
   cargoBefore:'aa6b1dd771da305bf7a21c6101fb4620a8b74b93',
   cargoAfter:'751a73da41d8b58f7de70643f50b97722a3c1260',
   r22InputBefore:'5d2b35f6bc9f0b8544fc52f25a35614b59913d96',
   r22InputAfter:'30551c7cc566614f64c8ba04748c3aef44b419bb',
   exactBuild:'Switch626 BID9A239D3DB569756D',exactTarget:'Male Makeup slot1 Item140100014 ColorIndex1 53to60',
   inheritedOldSourcePr:1954,independentCurrentAbiL2Required:true,
   independentReleaseL2Required:true,sourceOnly:true,
   mergeAuthorized:false,writerAuthorized:false,operationOn:false}};
 }
 if(baseCore==='42086449f9deef26ed48b21d7edab0f5685da7c2'){
  if(sourceCore!=='36be23f81c4558eafd3557c85ac71ea56a1e3459')
   deny('CANDIDATE_CORE_TREE');
  return {entries:steam626AmountOngoingBattlePassExact1Entries,count:1,metadata:{
   sourcePr:2263,sourceHead:'906606344b17604fa4eee55e8b0482a5bec40335',
   originalProtectedBase:'f62d591006c6244123283e0d2b100dd0ce68af8c',
   coreBefore:'42086449f9deef26ed48b21d7edab0f5685da7c2',
   coreAfter:'36be23f81c4558eafd3557c85ac71ea56a1e3459',
   exactChangedPath:'crates/ddv-save-core/src/product_amount_scoped.rs',
   exactOldBlob:'e6e360f5326b9a5cf6884600a4c9ecf642aa12fa',
   exactNewBlob:'13d861165bea3fb37f79d7bbc4cb9ab51669fa78',
   cargoUnchanged:'751a73da41d8b58f7de70643f50b97722a3c1260',
   r22InputUnchanged:'30551c7cc566614f64c8ba04748c3aef44b419bb',
   independentRustRefQAL2Required:true,independentSecurityL2Required:true,
   genuineEncryptedOriginalV2:'NOT_RUN',mergeAuthorized:false,
   writerAuthorized:false,operationOn:false}};
 }
 if(baseCore==='36be23f81c4558eafd3557c85ac71ea56a1e3459'){
  if(sourceCore!=='10e9e9bff19ef38c4a3d16def95c0b9448ce1d7c')
   deny('CANDIDATE_CORE_TREE');
  return {entries:steam626AmountPrivateBridgeExact3Entries,count:3,metadata:{
   sourcePr:2267,sourceHead:'f6e789694323750d0c055a8434718116dba11fc7',
   originalProtectedBase:'9a5c72ebafe45987b762a8fcb6ecaa198e7a7fd9',
   coreBefore:'36be23f81c4558eafd3557c85ac71ea56a1e3459',
   coreAfter:'10e9e9bff19ef38c4a3d16def95c0b9448ce1d7c',
   fixedNativePre:'052219d4d8078c1ed0ad4fc4a02843423de8ee6c',
   fixedNativeAfter:'9f783e64ec44fdc2d863a4634f3d334a89cf7f62',
   fixedSemanticWriterPre:'9472a792277f15e69d64118919835b12bed129f1',
   fixedSemanticWriterAfter:'f11c68ca214853c762788ae032710fc4683dd472',
   fixedPrivateWorkflowAfter:'77f8bfa29f55f28d348892086c684af9c52011bd',
   cargoUnchanged:'751a73da41d8b58f7de70643f50b97722a3c1260',
   r22InputUnchanged:'30551c7cc566614f64c8ba04748c3aef44b419bb',
   privateNativeOnly:true,publicConsumerEnabled:false,
   independentRustAndSecurityL2Required:true,
   genuineEncryptedOriginalP1gV2:'NOT_RUN',
   mergeAuthorized:false,writerAuthorized:false,operationOn:false}};
 }
 if(baseCore==='2f712d047e99bc024672e4d7a488baa6276e06f4'){
  if(sourceCore!=='7ce60a4e95988cc9d8f33ed54453882e4198e7c5')deny('CANDIDATE_CORE_TREE');
  return {entries:steam626PendingRustHeapScrubExact2Entries,count:2,metadata:{
   sourcePr:2318,sourceHead:'040e1eabfab0251b214514399a53517102c03c6b',
   coreBefore:'2f712d047e99bc024672e4d7a488baa6276e06f4',coreAfter:'7ce60a4e95988cc9d8f33ed54453882e4198e7c5',
   exactRustWorkerBefore:'5fbb1f3d393df127da67f1eafe9796fbb7ce3a56',exactRustWorkerAfter:'6432275d2909e6bc6d39265ae70cc7176fc37106',
   exactAddedRustGuardTest:'8fb7d761d145a4f64ea1b97470c57cf16db5bb79',
   cargoUnchanged:'751a73da41d8b58f7de70643f50b97722a3c1260',
   r22InputUnchanged:'30551c7cc566614f64c8ba04748c3aef44b419bb',
   independentRustHeapQaPr:2324,independentSecurityL2Required:true,
   protectedGateOnlyAcceptanceRequired:true,productOfficialV2:'NOT_RUN',
   mergeAuthorized:false,writerAuthorized:false,operationOn:false}};
 }
 const first='10e9e9bff19ef38c4a3d16def95c0b9448ce1d7c';
 const windows='623034400b71179b790ae8eca7b152cd892c898f';
 const mannequin='f67531cef7c812757b246a9aef08febb66782200';
 const both='2f712d047e99bc024672e4d7a488baa6276e06f4';
 const cargo='751a73da41d8b58f7de70643f50b97722a3c1260';
 const json='30551c7cc566614f64c8ba04748c3aef44b419bb';
 const off={independentSecurityL2Required:true,genuineEncryptedOriginalP1gV2:'NOT_RUN',
  mergeAuthorized:false,writerAuthorized:false,operationOn:false};
 const win={sourcePr:2276,sourceHead:'ad210aa3c551615b8c35f8b2970138760a59f5b6',
  exactWindowsDataBlob:'f67de2e4316397b93f95088c379f724ea81e9399',
  windowsByteStableOnly:true,sourcePaths:1,cargoUnchanged:cargo,r22InputUnchanged:json,...off};
 const man={sourcePr:2278,sourceHead:'0778ed44da9b619989a34dde419c686c1934af64',
  exactRustBlob:'522e8e8d6beec597b2e5e176cfbe8a6d8e38a124',
  fixedIndependentQrcPr:2281,independentQrcChangedSemantics:'10POS32NEG',
  realOwnerScopedLinkedChest1:'QA_SCOPED_1POS4NEG_NOT_PUBLIC_V2',
  originalProtectedBase:'a9a87c578c8bc2a9c64284b15d3ed2c5eb39f817',
  sourcePaths:1,cargoUnchanged:cargo,r22InputUnchanged:json,...off};
 if(baseCore===first){
  if(sourceCore===windows)return {entries:steam626WindowsLfPackExact1Entries,count:1,
   metadata:{...win,coreBefore:first,coreAfter:windows}};
  if(sourceCore===mannequin)return {entries:steam626MannequinRealMapExact1Entries,count:1,
   metadata:{...man,coreBefore:first,coreAfter:mannequin}};
  deny('CANDIDATE_CORE_TREE');
 }
 if(baseCore===windows){
  if(sourceCore!==both)deny('CANDIDATE_CORE_TREE');
  return {entries:steam626MannequinRealMapExact1Entries,count:1,
   metadata:{...man,coreBefore:windows,coreAfter:both}};
 }
 if(baseCore===mannequin){
  if(sourceCore!==both)deny('CANDIDATE_CORE_TREE');
  return {entries:steam626WindowsLfPackExact1Entries,count:1,
   metadata:{...win,coreBefore:mannequin,coreAfter:both}};
 }
 deny('BASE_CORE_TREE');
}

