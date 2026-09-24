# Apple-silicon direct-download build

This path uses the SWARM-specific wallet config, version
`0.1.0-testnet.7`, and the pinned SDK at
`ef08aa252ec55f411dc937045548cd4f3f3dc664`. It does not touch existing
profiles or recovery material and does not upload a release.

Prerequisites: native arm64 macOS, Node.js 24, Yarn 1.22.22, Rust 1.96.0,
protobuf, and Xcode command-line tools. Install a **Developer ID Application**
identity and private key in the owner's Keychain. Create a `notarytool`
Keychain profile locally with
`xcrun notarytool store-credentials SWARM-notary`; enter credentials only in
the secure prompt. Apple Development and iOS distribution certificates are
not direct-download Mac identities.

```sh
git clone https://github.com/Swarm-Official/privacy-zingolib.git sdk-source
git -C sdk-source checkout ef08aa252ec55f411dc937045548cd4f3f3dc664
export RUSTUP_TOOLCHAIN=1.96.0
export RUSTFLAGS='--cfg zcash_unstable="nu6.3"'
export CARGO_PROFILE_RELEASE_DEBUG=0
export CARGO_PROFILE_RELEASE_LTO=false
export CARGO_INCREMENTAL=0
export CARGO_NET_GIT_FETCH_WITH_CLI=true
yarn install --frozen-lockfile
node scripts/check-swarm-sdk-pin.js sdk-source --require-real-genesis
cargo fetch --locked --manifest-path native/Cargo.toml
node scripts/generate-swapkit-secrets.js
yarn tsc --noEmit
yarn neon-mac-arm64
node scripts/check-swarm-prefix-native.js
node scripts/stage-nym-proxy.js --strict-rev --target aarch64-apple-darwin
yarn script:build
APPLE_KEYCHAIN_PROFILE=SWARM-notary node scripts/build-mac-distribution.js
```

The distribution config keeps the app ID, name, network, SDK attribution and
licences from `configs/swarm-testnet-builder.cjs`. Electron signs the native
addon, Nym helper, frameworks and app using hardened runtime; the build hook
checks their Developer ID signatures. Electron-builder notarizes and staples
the app before packaging, and the script notarizes and staples the final DMG,
then rebuilds the ZIP from the stapled app. Output is in `dist-mac-signed/out/`
with SHA256 checksums and a release manifest. The script refuses to overwrite
an existing signed output directory.

Before release, install a **fresh browser download** with default Gatekeeper
settings and verify `codesign --verify --deep --strict`, `spctl --assess`, and
`xcrun stapler validate`. Test launch and sync, existing-profile preservation,
`swarm1` receive addresses and acceptance of legacy `utest1` addresses. Use a
disposable wallet for transfers. Keep the unsigned `dist/` packages as local
development artifacts only. Coordinate publication with the release owner.
