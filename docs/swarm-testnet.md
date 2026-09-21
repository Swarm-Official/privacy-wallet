# SWARM Wallet (Testnet)

This fork keeps Zingo PC's desktop application and Zingolib's wallet and cryptographic implementation unchanged. What it adds is a network profile: `swarm-testnet`, the SwarmTestnet chain, which uses standard Zcash testnet address encodings and an explicitly pinned genesis. It is not the public Zcash testnet, and its coins — shown as `SWARM` — have no market value and no fiat price.

## The genesis hash does not exist yet

SwarmTestnet's genesis block has not been generated. The pinned SDK therefore carries `SWARM_TESTNET_GENESIS_PLACEHOLDER` (the ASCII text `SWARMTESTNETGENESISPLACEHOLDER!!` in hex), which no block can hash to. Every build made before the real hash lands is a development build and will refuse to talk to any indexer.

`sdk/swarm-sdk-pin.json` records which SDK revision this repository compiles and which genesis that revision targets. `scripts/check-swarm-sdk-pin.js` reads the pinned SDK's own `config.rs` and refuses the build if the two disagree. Passing `--require-real-genesis` — which the workflow does when its `release` input is set — refuses any build that still carries the placeholder.

When the hash arrives: set `SWARM_TESTNET_GENESIS` in the SDK, push that SDK commit, update the `rev` in `native/Cargo.toml`, the seven `source =` lines in `native/Cargo.lock`, the `ref:` in the workflow and `sdk/swarm-sdk-pin.json`. Nothing else holds the hash.

## Servers

The public lightwalletd registry has nothing for this chain and never will: `servers:fetchList` answers an empty list for it and `fetchServerList` does not ask. "Automatic" is therefore not offered on this network — it could only ever fail — and the server selection is `custom` with an endpoint prefilled, from the moment the Add a New Wallet screen opens and after every change of network, in all four creation types and on the change-server screen.

Two presets, plus a free-text field:

| Preset | Endpoint | State |
| --- | --- | --- |
| SWARM public server (default) | `https://lwd.swarm.green:443` | not deployed yet |
| My own node | `http://127.0.0.1:19767` | a SwarmTestnet indexer running on this computer |

The default does not answer yet, so creating a wallet asks the chosen server whether it is there first and says what is wrong in words rather than failing at the transport.

All of this lives in `src/utils/swarmNetwork.ts`. `public/electron.js` keeps its own copy of the chain label and default endpoint, because the main process runs before any renderer module is loaded.

## Where the data goes

Nothing is shared with the retired Privacy Testnet wallet.

- Electron profile: whatever `--user-data-dir` the launcher passes; the project launcher uses `.runtime\apps\wallet-swarm\profile-swarm`.
- Wallet files: `SWARM_WALLET_DIR` if set, otherwise the SDK's own `swarm-testnet` directory. The launcher sets it to `.runtime\apps\wallet-swarm\keys\swarm-testnet`.
- Wallet-file chain tag: 5. A wallet file written by the Privacy Testnet build (tag 3) is refused by name rather than opened against the wrong chain.
- Keychain entry: `SWARM Wallet (Testnet)`.

## Suppressed for this chain

Public server discovery, the ZEC price fetch and the mixnet-price notice, public block-explorer links for transactions and addresses, and the `zcash:` protocol handler — the packaged build never registers itself as the machine's handler for public Zcash payment links.

## Build

The `SWARM wallet Windows test build` workflow produces a portable, unsigned Windows x64 ZIP. It does not publish a release and does not sign the executable.

The SDK is a pinned Git revision of `brs-holding/privacy-zingolib` in `native/Cargo.toml` and `native/Cargo.lock`, not a patch snapshot: the previous mechanism reconstructed the SDK from a patch applied to an upstream base, and there is nothing left to reconstruct now that the fork has its own branch. Everything cheap that can refuse the build — packaging configuration, the SDK pin, the lockfile, types, the network and server-selection tests — runs before the hour of compilation, not after it.

The artifact carries the wallet source commit, `native/Cargo.lock`, the ZIP's checksum and `sdk-integration.json`, which names the exact SDK commit and the genesis that was verified at build time.

Removed with the patch mechanism: the repackage workflow and `scripts/restore-privacy-compiled.py`, which were pinned to a specific Privacy Testnet run and artifact and could not be reused here.

## Icon

`resources/swarm/icon.png` and `resources/swarm/icon.ico` are a placeholder, rendered by `scripts/make-swarm-icon.js` from the hex-bee mark in the website's `assets/logo-mark.svg`. The owner has not chosen a final logo. Replacing it means replacing those two files; nothing else refers to the artwork.
