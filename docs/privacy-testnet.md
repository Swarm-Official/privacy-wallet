# Privacy engineering testnet wallet

This fork retains Zingo PC's desktop application and Zingolib's wallet and cryptographic implementation. The new `privacy-testnet` profile is a distinct local engineering chain, using standard Zcash testnet address encodings and an explicitly pinned genesis. It is not the public Zcash testnet and its coins have no market valuation.

## Connection

The packaged **Privacy Wallet Testnet** build starts with the custom server `http://127.0.0.1:19767`. Run the project's Zebra node and Zaino indexer first. You can change the indexer endpoint in wallet settings; the SDK verifies the chain identity before opening an online wallet, synchronizing, or submitting a transaction.

Expected chain name: `privacy-testnet`.

Expected genesis: `01d6e85dd3c1c128941a849c5025cd2e437258811a2551b82aefd68686c982e1` (PrivacyTestnetV2).

Upgrade activations through NU6.3 are at height 1. The wallet's birthday floor is 1. Addresses use the testnet encoding, so an address alone cannot prove which test chain a recipient uses: confirm the recipient's chain separately.

The custom profile does not fetch a public server list, select a public fallback, value balances using ZEC pricing, or open public Zcash explorers. Supply an appropriate custom explorer explicitly. Mixnet routing is disabled for this profile until that transport supports a verified private-chain destination; transactions use the selected indexer connection. Public Zcash network profiles retain their existing behavior.

If you stop or restart your node, open the project wallet launcher again. It starts the node if needed and restarts its own indexer when the node's RPC authentication cookie changes, preserving node and wallet files. An already open wallet window is reused. If that window was deliberately put in Offline Mode, reconnect from its server settings.

## Files and authentication

The project launcher sets `PRIVACY_WALLET_DIR` to a dedicated folder under `D:\privacy\.runtime\apps\wallet-testnet`. Without that override, the SDK uses its separate `privacy-testnet` wallet directory. The launcher also supplies a dedicated Electron profile directory. Preserve wallet data and backups when updating the application.

Device authentication remains enabled by default. Unlock through Windows yourself. The fork has its own keychain service identity so its preference does not alter the official Zingo PC installation.

## Building

The `Privacy wallet Windows test build` GitHub Actions workflow builds a portable, unsigned Windows x64 ZIP. Its integration SDK is reconstructed from the exact upstream revision and patch digest in `patches/privacy-sdk-v2.json`. When first dispatched, separate SDK feature and benchmark checks were still pending. The artifact includes that original manifest, the wallet source commit, dependency lockfile and ZIP checksum. It does not publish a release or sign the executable. The unsigned development artifact is distinct from the signed official upstream wallet used for the earlier Regtest compatibility exercise.

After that snapshot was dispatched, SDK validation completed and the checked source was published as [privacy-zingolib a29f8364](https://github.com/brs-holding/privacy-zingolib/commit/a29f8364614164b123c19d715dadeb46e0bb83b0). Its production library matches the recorded snapshot. Later differences affect CLI guards, tests and validation documentation, without changing the native wallet integration. The artifact manifest preserves its original build inputs and their status at dispatch.

Use this engineering build only for the project test chain. Genesis, activation and network integration changes do not amount to a security audit; no cryptographic primitives are changed here.
