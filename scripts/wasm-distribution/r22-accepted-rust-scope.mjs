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
const switch626AppearanceCumulativeEntries=[
  {
    "path": ".github/workflows/core-product-session-boundary.yml",
    "before": {
      "mode": "100644",
      "blob": "825c0e92d7c9f5a1e86900d3a67ccff57b15babf"
    },
    "after": {
      "mode": "100644",
      "blob": "dc1ac0ab2b4a9fb5773139f2c0f96e055ac99023"
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
      "blob": "9022a94a61f0234fde9bce442e35e5db30f83164"
    }
  },
  {
    "path": "crates/ddv-save-core/src/appearance_applicable.rs",
    "before": {
      "mode": "100644",
      "blob": "f135d760dc8be064528b540aa70ea6dceef9228d"
    },
    "after": {
      "mode": "100644",
      "blob": "9aacfc15ad587fef37e87f3c3ce27f2c9b677645"
    }
  },
  {
    "path": "crates/ddv-save-core/src/appearance_observer.rs",
    "before": {
      "mode": "100644",
      "blob": "6e7d1247f65a5c3b320446fb1b8dae5764b7cb9d"
    },
    "after": {
      "mode": "100644",
      "blob": "b94641c3adedfe66e693b82248f637a5cb14f93d"
    }
  },
  {
    "path": "crates/ddv-save-core/src/product_hair_target.rs",
    "before": {
      "mode": "100644",
      "blob": "58c7277c1ea31e3cd2240d3ab1a414dd28ed0a2f"
    },
    "after": {
      "mode": "100644",
      "blob": "5e49ef435602a7872febf997599ec6daff1a65d2"
    }
  },
  {
    "path": "crates/ddv-save-core/src/product_skin_target.rs",
    "before": {
      "mode": "100644",
      "blob": "d4b0bbde04b55b22ddee11e8cf6cb3471968ce28"
    },
    "after": {
      "mode": "100644",
      "blob": "7fe8e025ac32cd1336a2978bf0ce5d02103d9f76"
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
      "blob": "a11aeccfc13e462bf338ebfee319001cc193b379"
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
      "blob": "4ada588c340d7619d6df5803d5519726128dc60d"
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
      "blob": "71058d0493920bc0b1b5cf02eee667c76453497e"
    }
  },
  {
    "path": "scripts/wasm-distribution/protected-release-inputs.json",
    "before": {
      "mode": "100644",
      "blob": "dd59264c1c20325c66e6aecc3413e91d10fc72ed"
    },
    "after": {
      "mode": "100644",
      "blob": "0e54f4da3b1f14c18f63b6c199c59077eae97f73"
    }
  }
];
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
 const result=verifyExactScopeEntries(cwd,base,source,profile.entries);
 if(result.entries.length!==profile.count)deny('FIXED_SCOPE_COUNT');
 return {status:'R22_EXACT_ACCEPTED_SOURCE_SCOPE_MATCH_ONLY',
  ...profile.metadata,candidateHead:source,base,entryCount:profile.count,
  mergeAuthorized:false,writerAuthorized:false};
}

// This is a fixed source selector, not an authority grant. Neither a caller
// nor a candidate can supply the allowed paths/trees or change protected gate
// identity. Unknown Core pairs and mixed old/new pairs fail closed.
function selectAcceptedCorePair(baseCore,sourceCore){
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
 if(baseCore==='fa7aeef5dc1459104564bf1eb9704d315ab7c415'){
  if(sourceCore!=='1f61f3058f31b35e6db9cf424d4147fcde9c3905')deny('CANDIDATE_CORE_TREE');
  return {entries:switch626AppearanceCumulativeEntries,count:10,metadata:{
   sourcePr:1734,sourceHead:'86a213d15e898846f4610dbe088690ca2c162f5f',
   sourceTree:'0eb841d2c9cf982dd82759c0f203091c40b47269'}};
 }
 deny('BASE_CORE_TREE');
}

