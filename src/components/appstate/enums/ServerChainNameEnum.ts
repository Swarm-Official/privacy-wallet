export enum ServerChainNameEnum {
  mainChainName = "main",
  testChainName = "test",
  regtestChainName = "regtest",
  swarmTestnetChainName = "swarm-testnet",
  // SWARM production. A separate chain from `main`, which is and stays upstream
  // Zcash: the addon decodes `u1…`/`zs1…`/`t1…`/`t3…` for that one, and nothing
  // in this application may let the word "mainnet" arrive here by itself. See
  // src/utils/networkProfiles.ts.
  swarmMainnetChainName = "swarm-mainnet",
}
