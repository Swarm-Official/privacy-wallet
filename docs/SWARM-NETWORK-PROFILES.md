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
| `serverIsLive` | `true` | `false` — the name is reserved, the service is not deployed |
| `grpcPort` | 9067 | 9068 (behind TLS) |
| `genesis` | `045993f5…8e2a28` | **`null`** — see below |
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

**A profile with no genesis is not selectable.** SWARM production has no genesis
until the launch ceremony generates one. A wallet that cannot name a chain's
first block cannot tell that chain's indexer from any other, and one that synced
the wrong chain would write that chain's state over the right one. So:

- `SWARM_MAINNET_GENESIS` is `null`. There is no default and no placeholder,
  here or in the SDK, where `ChainType::try_from("swarm-mainnet")` is an error
  for the same reason.
- `isProfileSelectable` is false, `selectableSwarmProfiles()` returns testnet
  alone, and `unselectableReason` says why in a sentence.
- `chainHintFor` throws rather than handing the addon something it might act on.
- `selectableChainOrFallback` rewrites a stored `swarm-mainnet` label back to
  `swarm-testnet` at startup (`public/electron.js`), because a settings file
  survives downgrades and hand-editing.
- `RPC.checkServer` refuses to sync or send, whatever the server says.

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
