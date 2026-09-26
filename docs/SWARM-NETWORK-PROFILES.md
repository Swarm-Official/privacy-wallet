# SWARM network profiles

How this application decides which network a wallet is on, and what a release
has to fill in before SWARM production can be selected.

Source of truth: `src/utils/networkProfiles.ts`. Everything below is that file
restated; where the two disagree, the file is right.

## The two profiles

| Field | `swarm-testnet` | `swarm-mainnet` |
| --- | --- | --- |
| `chainLabel` | `swarm-testnet` | `swarm-mainnet` |
| `displayName` | SWARM Testnet | SWARM Mainnet |
| `ticker` | SWM | SWM |
| `unifiedHrp` | `swarm` → `swarm1…` | `swm` → `swm1…` |
| `legacyUnifiedHrps` | `utest` → `utest1…` | none |
| `texHrp` | `textest` | `texswm` |
| `transparentPrefixes` | `tm…` (0x1d25), `t2…` (0x1cba) | `s1…` (0x1c28), `s3…` (0x1c2d) |
| `defaultServer` | `https://lwd.swarm.green:443` | `lwd-main.swarm.green:8443` |
| `serverIsLive` | `true` | `true` — deployed at the launch ceremony, 2026-09-26 |
| `grpcPort` | 9067 | 9068 (behind TLS) |
| `genesis` | `045993f5…8e2a28` | `01c34428…2c39afdd` — the launch ceremony's |
| `sdkChainType` | `ChainType::CustomTestnet` | `ChainType::SwarmMainnet(SwarmMainnetGenesis)` |
| `activationHeight` | 1 | 1 |
| `distinctivePrefixes` | `swarm1` | `swm1`, `s1`, `s3` |

`distinctivePrefixes` is the subset of a network's encodings that belong to it
alone. SwarmTestnet's `utest1…`, `tm…` and `t2…` are not in it: this build's
vendored `zcash_protocol` renamed only the *unified* HRP, so those three are
upstream testnet's encodings too and name two chains at once. Anything that has
to pick a chain from an address string alone may only use this list.

## Two rules the profiles exist to enforce

**The word "mainnet" never reaches a SWARM network.** `main` is upstream Zcash —
in the SDK (`ChainType::Mainnet`), in the vendored address crates, and in the
addon, where it still decodes `u1…`, `zs1…`, `t1…` and `t3…`. `swarmProfileFor`
resolves the two SWARM labels and nothing else: not `main`, not `mainnet`, not
`test`, not `regtest`, and it never falls back.

**A profile with no genesis is not selectable.** A wallet that cannot name a
chain's first block cannot tell that chain's indexer from any other, and one
that synced the wrong chain would write that chain's state over the right one.
So a profile whose `genesis` is `null` is refused everywhere: `isProfileSelectable`
is false, `chainHintFor` throws rather than handing the addon something it might
act on, `selectableChainOrFallback` rewrites the stored label back to a network
this build can serve, and `RPC.checkServer` refuses to sync or send whatever the
server says.

SWARM production held `null` until the launch ceremony of **2026-09-26**. It now
carries genesis `01c34428b9e67cdd8345e0b365aaa37dd8d2d65d3869e0e5d77d567f2c39afdd`
and is selectable; the testnet is still selectable beside it, and both are
offered. The unlaunched behaviour is still asserted, against
`withoutGenesis(SWARM_MAINNET_PROFILE)`, so it did not have to be deleted to
make the launch commit.

## What a build is branded as

A build carries **both** network definitions. Which one it is *packaged for* is
a separate fact, and it lives in `src/buildProfile.json`:

```json
{ "profile": "swarm-testnet", "profiles": { "swarm-testnet": { … }, "swarm-mainnet": { … } } }
```

| | `swarm-testnet` | `swarm-mainnet` |
| --- | --- | --- |
| version | `0.1.0-testnet.9` | `0.1.0-mainnet.2` |
| product name | SWARM Wallet (Testnet) | SWARM Wallet |
| executable | `SWARM Wallet Testnet` | `SWARM Wallet` |
| app id | `green.swarm.wallet.testnet` | `green.swarm.wallet` |
| package name | `swarm-wallet-testnet` | `swarm-wallet-mainnet` |
| Windows installer | `SWARM-Wallet-0.1.0-testnet.9-win-x64-setup.exe` | `SWARM-Wallet-0.1.0-mainnet.2-win-x64-setup.exe` |
| starts on | `https://lwd.swarm.green:443` | `https://lwd-main.swarm.green:8443` |

`scripts/set-build-profile.js` is the only thing that writes the selection, from
`SWARM_NETWORK_PROFILE` — the `network_profile` input both build workflows take,
defaulting to `swarm-testnet` so a tag push still produces exactly what it
produced before. Four things then read that one record: `src/version.ts` and
`src/utils/swarmNetwork.ts` (the About box, the window's own name, the network
a fresh profile starts on), `configs/swarm-builder.cjs` (product name, app id,
installer file name, and the `swarmNetworkProfile` key it writes into the
packaged `package.json`), `public/electron.js` (the window title, the keychain
entry, and the chain a fresh settings file gets — read from that packaged
`package.json`, because the main process runs before any renderer module), and
`scripts/check-swarm-package-config.js`, which refuses a build whose packaging
does not match the record.

**The app ids are deliberately different, so the two install side by side.**
`green.swarm.wallet` and `green.swarm.wallet.testnet` are two applications to
Windows, macOS and Linux alike: separate uninstall entries, separate shortcuts,
separate keychain entries, separate `%APPDATA%`/`~/.config` directories. A
mainnet installer therefore does **not** replace an existing testnet install —
it appears beside it. That is intended: one id would have let the mainnet build
silently take over a testnet install whose wallet files it cannot open.

Why this file exists at all: the first mainnet build, `b6174f2d` on 2026-09-26,
carried the real mainnet genesis and still called itself "SWARM Wallet
(Testnet)" version `0.1.0-testnet.9`, because those facts were four literals in
four files and only the genesis had been moved.

`0.1.0-mainnet.1` was withdrawn the same day: it could not create a wallet at
all. See "The chain hint" below.

## The chain hint

The addon's first argument is a chain **hint**, not a chain label, and for
SWARM production the two differ: `ChainType::SwarmMainnet` carries the genesis
and the SDK gives it no default, so the hint is
`swarm-mainnet:01c34428…2c39afdd`. For `main`, `test`, `regtest` and
`swarm-testnet` the hint and the label are the same string.

`nativeChainHint` in `src/utils/networkProfiles.ts` is the one place a label
becomes a hint, and every `native.wallet_exists`, `init_new`,
`init_from_seed`, `init_from_ufvk`, `init_from_b64` and `delete_wallet` call
goes through it. `src/utils/nativeChainHint.test.ts` reads the source of all
fifteen call sites and fails the build if any of them passes anything else.

That test exists because `chainHintFor` was written, documented and tested
first, and nothing called it. Every call site passed `wallet.chain_name`
straight through, and `src/native.node.d.ts` typed the parameter
`ServerChainNameEnum`, so the compiler agreed. `0.1.0-mainnet.1` shipped, and
the owner pressed Create:

    initializing wallet: 'swarm-mainnet' does not name a network. The SWARM
    production network is opened as 'swarm-mainnet:<genesis>'

The parameter is now typed `SwarmChainHint` — a plain string — so nobody can
believe the compiler is checking it.

## The servers this application offers

Three presets, and no others anywhere in the build:

| Preset | URI | Network |
| --- | --- | --- |
| SWARM Mainnet | `https://lwd-main.swarm.green:8443` | `swarm-mainnet` |
| SWARM Testnet (coins have no value) | `https://lwd.swarm.green:443` | `swarm-testnet` |
| My own testnet node | `http://127.0.0.1:9067` | `swarm-testnet` |

`src/utils/serverUrisList.ts` is derived from that list, so the static list, the
rotation candidates, the server picker and the create-a-wallet screen all see
the same three. Upstream's twenty lightwalletd endpoints — `zec.rocks`,
`lightwalletd.com`, `zcash-infra.com` — are **gone from the build**, and the
Network dropdown offers only the two SWARM chains.

That is not tidying. On 2026-09-26 an owner installed the first mainnet build,
picked "Mainnet" from a Network dropdown that still listed upstream Zcash's
chains, took a server from the list beside it, pressed Create, and the Receive
screen showed him a `u1…` address: a real Zcash mainnet wallet, created by a
SWARM wallet, from a recovery phrase he had written down for SWARM. Four things
now stand between a person and that outcome, and each is tested:

1. the Network dropdown offers `swarm-mainnet` and `swarm-testnet` and nothing
   else, and no upstream endpoint exists to be offered beside them;
2. creating a wallet refuses any chain that is not a SWARM network;
3. after `init_*` and before the wallet is registered, the server is asked which
   chain it serves, and a mismatch throws the wallet away — this is what checks
   an address typed under "Another server";
4. `RPC.checkServer` refuses to sync or send a wallet that is not on a SWARM
   chain, saying "This is not a SWARM wallet", and the Receive screen refuses to
   draw an address that does not belong to the wallet's own network — no QR
   code, no copy button.

## What a release fills in

Two constants in `src/utils/networkProfiles.ts`, in one commit, from the network
manifest produced at the ceremony:

1. `SWARM_MAINNET_GENESIS` — the 64 lowercase hex characters of the genesis
   block hash, in the order a node prints it.
2. `SWARM_MAINNET_SERVER` — the production indexer, once it is deployed, and
   `serverIsLive: true` with it.

Both belong to the same release as the SDK pin bump described below. Shipping
the genesis without the pin would make the profile selectable against an addon
that cannot open it.

### The one command

The manifest is the one the launch ceremony produces — the same file the node
app embeds, rendered by `D:/privacy/scripts/swarm/render_mainnet_manifest.py`
from the ceremony's five values:

```sh
node scripts/set-swarm-mainnet-launch.js D:/privacy/network/swarm-mainnet/manifest.json
yarn test:run
```

`--check` prints what it would write and writes nothing. The script sets
`SWARM_MAINNET_GENESIS`, `SWARM_MAINNET_SERVER` and the production record's
`serverIsLive`, and records the same values with their provenance in
`sdk/swarm-sdk-pin.json`. It touches nothing else — not the SDK commit, not the
testnet profile, not an address rule.

It refuses rather than guesses: a manifest that is not SWARM production
(`identity.network_name` `SwarmMainnet`, `identity.network_kind`
`SwarmProduction`, chain label `swarm-mainnet`), a genesis that is not 64
lower-case hex characters, a genesis belonging to upstream Zcash or to the SWARM
testnet, a `light_wallet_servers[0]` that is not the reserved
`lwd-main.swarm.green:8443`, or a source file whose two lines are not where it
expects them — each is an error, and nothing is written.

**No test changes go in that commit.** The unlaunched behaviour is asserted
against `withoutGenesis(SWARM_MAINNET_PROFILE)`, so it holds either way, and
what the build currently ships is one explicit assertion —
"is either wholly unlaunched or wholly launched, never half" in
`src/utils/networkProfiles.test.ts` — which simply takes its other branch. A
release step that has to rewrite its own tests is a release step nobody can
review.

Rehearsed on 2026-09-26 with the disposable rehearsal network's values
(`D:/privacy/network/swarm-rehearsal-main/manifest.json`, genesis
`007e6673…ce65`, three throwaway `s3…` addresses): the script set both
constants, and the whole suite — **117 suites, 1589 tests** — passed both with
the values applied and after they were reverted. They are not committed.

## The addon contract

The addon's chain hint is the single string that decides the network. Today:

| Hint | `ChainType` |
| --- | --- |
| `main` | `Mainnet` (upstream Zcash) |
| `test` | `Testnet` (upstream Zcash) |
| `regtest` | `Regtest` |
| `swarm-testnet` | `CustomTestnet` |
| `swarm-mainnet…` | **refused**, with a message saying this build's SDK has no production profile |

SWARM production's hint carries the genesis — `swarm-mainnet:<64 hex>` — because
`ChainType::SwarmMainnet` holds the hash and the SDK gives it no default.
`chainHintFor` already produces that form; `native/src/lib.rs` refuses it and
carries the arm that replaces the refusal, commented, next to it.

That arm cannot be written until the addon's SDK pin moves to a revision with
`ChainType::SwarmMainnet` — `codex/mainnet-sdk-identity-20260925` at `d9f1a5b8`
or later. That bump is not a pin change alone: cargo ignores a dependency's own
`[patch]` table, so the four crates the SDK vendors for SWARM production
(`zcash_protocol`, `zcash_address`, `zcash_primitives`, `zcash_transparent`) have
to be vendored here too, and this repo's `zcash_protocol` is 0.10.5 against the
SDK's 0.10.4. That is its own slice of work, not a side effect of this one.

## Address rules

`src/utils/swarmAddress.ts` decides, from the address string alone, whether an
address may be paid on the profile the wallet is on: HRP and checksum for
bech32/bech32m forms, version prefix for Base58Check. It sits in front of the
addon in `Utils.getAddressKind`, and it only ever *refuses* — an address it
admits is still decoded by the addon afterwards.

It has to exist because the addon cannot answer this question. The vendored
protocol crate gives upstream *testnet*'s constants SwarmTestnet's HRPs, so the
addon reports chain `test` for a `swarm1…` address and `Utils.sameAddressNetwork`
treats that as SwarmTestnet on purpose. That aliasing is correct for testnet and
must not extend to production.

On each profile: its own encodings are accepted, the other SWARM network's are
refused by name, and upstream Zcash's are refused on both.

## Server identity

`src/utils/serverIdentity.ts` checks the indexer against the profile before the
wallet syncs and again before it sends — the second time because a transaction
built against the wrong consensus rules and broadcast cannot be taken back.

It reads `chain_name` from `GetLightdInfo` (the addon's `info_server`). The
genesis is not in that response; when a server does state one (`genesis_hash`),
it is compared too, and its absence is not read as a mismatch. A profile that has
not launched is refused outright, and a server that does not answer at all is
left to the existing unreachability surfaces rather than accused of being the
wrong server.

The answer is cached per wallet-and-server pair while it is yes, so the sync
cycle does not pay a round trip per pass; a refusal is re-asked every time, and
switching wallet or server clears it.
