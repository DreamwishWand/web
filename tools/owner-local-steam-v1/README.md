# Owner-local Steam P1G → single Rust Worker V1 proof (read-only)

**Task:** existing `W-CORE-004 + W-LOCAL-019`, operation `DEV_READY_OWNER_LOCAL_P1G_RUST_V1_READ_ONLY_ATTESTATION_HARNESS`.

This is a **local operator validation tool**, not a product UI, not a Save editor, not a public Worker route, and not a remote upload form. It reuses the accepted Stage A–F single Rust `ProductSession` and existing P1G Codec. The original file is selected with the browser File picker. The app page never decodes it; the trusted Worker reads it in RAM, checks its exact original SHA against a separately supplied value and only then calls the existing Rust read-only pipeline. No writes, backups, overwrite, Edited-copy, Apply or Cloud upload.

## Required prerequisites

- An authorized local machine running Node.js 22+, Chrome/Chromium, Rust stable + `wasm32-unknown-unknown` target, and `wasm-bindgen-cli` **0.2.105**.
- A **local** owner-controlled encrypted `.p1g` source. Keep it **outside this repository**. Never upload personal Save/private Media, keychain, decoded JSON or SHA to GitHub/CI/Pages.
- Independently observed **installed Steam FullVersion**, not a schema guess or `GameInfo.LastSaveDeviceInfo.deviceType`. The only candidate recognized by this build is:
  `releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22` / Steam Windows / schema626. An unrecognized actual installation remains `WAIT_BUILD` and is **not** retagged automatically.
- Independent original-file SHA-256 generated **on this machine from the original encrypted file**. For Windows PowerShell: `Get-FileHash -Algorithm SHA256 -LiteralPath 'C:\path\to\your\save.p1g'` (convert hex to lowercase in the form). On Unix: `sha256sum /path/to/your/save.p1g`. Do not attach results to public issues.

## Compile locally and run in the Owner browser

After toolchains are installed, from the repository root:

```bash
rustup target add wasm32-unknown-unknown
cargo install wasm-bindgen-cli --version 0.2.105 --locked
export CARGO_TARGET_DIR="$(pwd)/.owner-local-rust-target"
cargo build --manifest-path crates/ddv-save-core/Cargo.toml --release --target wasm32-unknown-unknown --features worker-wasm,indexed-read
mkdir -p tests/stage-e/pkg
wasm-bindgen "$CARGO_TARGET_DIR/wasm32-unknown-unknown/release/ddv_save_core.wasm" --out-dir tests/stage-e/pkg --target web --no-typescript
node tools/owner-local-steam-v1/server.mjs
```

In **PowerShell**, instead of `export`, set `$env:CARGO_TARGET_DIR = Join-Path (Get-Location) '.owner-local-rust-target'`. The resulting `tests/stage-e/pkg` directory contains **locally generated uncommitted** executable glue/WASM; it must not be added to the repository.

Open the printed `http://127.0.0.1:<ephemeral-port>/tools/owner-local-steam-v1/index.html` in your local browser. Choose the encrypted P1G, enter the independently observed Steam FullVersion and original SHA-256, explicitly acknowledge the independent observation, and run. The original is not overwritten or exported. To revoke the active Session, click **Close & revoke Session**. You can disconnect from the Internet during the read after building/installing the required tools; the server itself binds only to `127.0.0.1` and allows GET/HEAD of a fixed set of source/WASM files. It has **no POST endpoint**.

The resulting local receipt contains the original SHA+byte length, Rust decoded JSON SHA, SessionID, Revision, IndexGeneration, Schema, read-only flags and caveat `physicalBuildCryptographicallyVerified:false`. It contains **no full decrypted JSON**. Treat this receipt as private. A manually supplied Build claim is not independently authenticated physical installation evidence; strict exact matching only verifies internal consistency and explicitly rejects missing/unknown claims. Cross-save last-device information cannot supply external Steam identity.

## Fail-closed tests and limitations

- Missing/unknown physical FullVersion or missing original SHA → `WAIT_BUILD` / `WAIT_SOURCE_SHA256`. A wrong hash is rejected before P1G decryption; malformed ciphertext/AES/ZIP is denied. Unknown Steam version, Switch BID, schema624, metadata-inferred build and untrusted extra Session/cursor/readset arguments are rejected.
- Input ciphertext is limited to 128MiB and AES-block alignment. Existing P1G Codec parses the whole decoded JSON **in the Worker**, and the existing Rust code receives <=1MiB UTF-8 chunks; this is **not** zero-copy, streaming decryption or proof of real 100–200MiB browser memory suitability.
- A new open or Close revokes previous Rust authority. The Web page receives only a bounded receipt, never decoded bytes/JSON. Memory is cleared for the Worker-owned encrypted byte buffer on completion; JS strings remain managed by the browser GC and cannot be securely zeroized.
- Source-only CI uses a **public synthetic encrypted P1G** and its independently tagged synthetic attestation via a separate CI-only Worker. The normal Owner Worker explicitly **rejects CI-synthetic attestation**. No private user Save is used in Actions.
- This runner does **not** establish full native reference closure, P1G V2 backup→distinct Edited-copy→CAS/atomic diff→fresh-process Reopen, Native V3, device V4, or product operation enablement. A separately authorized **05 QR-L genuine Save** check with actual installed Build evidence is required. ProductReadAccepted, Writer/Apply/OriginalOverwrite/Export, Community/Provider/Cloud/Public/production flags **remain OFF**.

**Independent QA / integration:** new-only 05 QR-C should verify this exact Source HEAD, data locality, external version/SHA negative cases and actual generated WASM browser synthetic positive; 09P only if ABI changes; **09 INT alone** may merge the accepted minimal source after protected cumulative CI/Pages. Rollback remove this owner-local harness, focused tests and CI and the related gitignore entries; preserve the already accepted Stage A–F files and public Pages.
