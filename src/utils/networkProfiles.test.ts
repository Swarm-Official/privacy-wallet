import { ServerChainNameEnum } from "../components/appstate";
import {
  SWARM_MAINNET_GENESIS,
  SWARM_MAINNET_PROFILE,
  SWARM_NETWORK_PROFILES,
  SWARM_TESTNET_PROFILE,
  SwarmProfileIdEnum,
  chainHintFor,
  isProfileSelectable,
  selectableChainOrFallback,
  selectableSwarmProfiles,
  swarmProfileFor,
  unselectableReason,
  withGenesis,
} from "./networkProfiles";
import { SWARM_ACTIVATION_HEIGHT, SWARM_CHAIN, SWARM_DEFAULT_SERVER, SWARM_TICKER } from "./swarmNetwork";

const CEREMONY = "a".repeat(64);

describe("the SWARM testnet profile is exactly what this build already ships", () => {
  // The whole point of collecting these into a profile was that not one of
  // them may change in the process. This test is the promise that they did not.
  it("keeps every value the wallet used before the profiles existed", () => {
    expect(SWARM_TESTNET_PROFILE.chainLabel).toBe("swarm-testnet");
    expect(SWARM_TESTNET_PROFILE.chainLabel).toBe(SWARM_CHAIN);
    expect(SWARM_TESTNET_PROFILE.defaultServer).toBe(SWARM_DEFAULT_SERVER);
    expect(SWARM_TESTNET_PROFILE.ticker).toBe(SWARM_TICKER);
    expect(SWARM_TESTNET_PROFILE.activationHeight).toBe(SWARM_ACTIVATION_HEIGHT);
    expect(SWARM_TESTNET_PROFILE.unifiedHrp).toBe("swarm");
    expect(SWARM_TESTNET_PROFILE.legacyUnifiedHrps).toEqual(["utest"]);
    expect(SWARM_TESTNET_PROFILE.transparentPrefixes).toEqual(["tm", "t2"]);
    expect(SWARM_TESTNET_PROFILE.grpcPort).toBe(9067);
    expect(SWARM_TESTNET_PROFILE.sdkChainType).toBe("CustomTestnet");
  });

  it("is the genesis the SDK pin and the network manifest both record", () => {
    expect(SWARM_TESTNET_PROFILE.genesis).toBe(
      "045993f5c91ea160c7ebda573dd97b0016816bca68d395bfff202779b88e2a28",
    );
  });

  it("sends the addon the bare label it has always been sent", () => {
    expect(chainHintFor(SWARM_TESTNET_PROFILE)).toBe("swarm-testnet");
  });
});

describe("the SWARM mainnet profile", () => {
  it("is the identity the owner confirmed", () => {
    expect(SWARM_MAINNET_PROFILE.chainLabel).toBe("swarm-mainnet");
    expect(SWARM_MAINNET_PROFILE.displayName).toBe("SWARM Mainnet");
    expect(SWARM_MAINNET_PROFILE.unifiedHrp).toBe("swm");
    expect(SWARM_MAINNET_PROFILE.transparentPrefixes).toEqual(["s1", "s3"]);
    expect(SWARM_MAINNET_PROFILE.grpcPort).toBe(9068);
    expect(SWARM_MAINNET_PROFILE.ticker).toBe("SWM");
  });

  it("names the SDK variant that is not upstream Zcash", () => {
    expect(SWARM_MAINNET_PROFILE.sdkChainType).toBe("SwarmMainnet");
    // Neither profile may name `Mainnet`. That variant decodes u1/zs1/t1/t3.
    for (const profile of SWARM_NETWORK_PROFILES) {
      expect(profile.sdkChainType).not.toBe("Mainnet");
    }
  });

  it("carries a server placeholder that is marked as not live", () => {
    expect(SWARM_MAINNET_PROFILE.defaultServer).toBe("lwd-main.swarm.green:8443");
    expect(SWARM_MAINNET_PROFILE.serverIsLive).toBe(false);
  });

  it("accepts no legacy address encodings, having no history", () => {
    expect(SWARM_MAINNET_PROFILE.legacyUnifiedHrps).toEqual([]);
  });
});

describe("a mainnet with no genesis is not selectable", () => {
  it("ships no genesis and no placeholder", () => {
    expect(SWARM_MAINNET_GENESIS).toBeNull();
    expect(SWARM_MAINNET_PROFILE.genesis).toBeNull();
  });

  it("is not offered", () => {
    expect(isProfileSelectable(SWARM_MAINNET_PROFILE)).toBe(false);
    expect(isProfileSelectable(SWARM_TESTNET_PROFILE)).toBe(true);
    expect(selectableSwarmProfiles()).toEqual([SWARM_TESTNET_PROFILE]);
  });

  it("says why, naming the ceremony rather than reading as a bug", () => {
    const why = unselectableReason(SWARM_MAINNET_PROFILE);
    expect(why).toContain("SWARM Mainnet");
    expect(why).toContain("genesis");
    expect(unselectableReason(SWARM_TESTNET_PROFILE)).toBe("");
  });

  it("refuses to produce a chain hint the addon could act on", () => {
    expect(() => chainHintFor(SWARM_MAINNET_PROFILE)).toThrow(/genesis/);
  });

  it("falls back to the chain this build can serve when settings hold it", () => {
    expect(selectableChainOrFallback("swarm-mainnet")).toBe("swarm-testnet");
    expect(selectableChainOrFallback("swarm-testnet")).toBe("swarm-testnet");
    // Upstream chains are not this function's business.
    expect(selectableChainOrFallback("main")).toBe("main");
    expect(selectableChainOrFallback("test")).toBe("test");
    expect(selectableChainOrFallback(undefined)).toBe("");
  });
});

describe("a launched mainnet", () => {
  const launched = withGenesis(SWARM_MAINNET_PROFILE, CEREMONY);

  it("becomes selectable once a release ships the hash", () => {
    expect(isProfileSelectable(launched)).toBe(true);
    // And the shipped profile is untouched by having built one.
    expect(SWARM_MAINNET_PROFILE.genesis).toBeNull();
  });

  it("puts the genesis in the addon's chain hint, because the SDK needs it", () => {
    expect(chainHintFor(launched)).toBe(`swarm-mainnet:${CEREMONY}`);
  });

  it("refuses a hash that is not a block hash", () => {
    expect(() => withGenesis(SWARM_MAINNET_PROFILE, "045993F5")).toThrow(/block hash/);
    expect(() => withGenesis(SWARM_MAINNET_PROFILE, CEREMONY.toUpperCase())).toThrow(/block hash/);
  });
});

describe("the word mainnet never reaches a SWARM profile", () => {
  it.each(["main", "mainnet", "Mainnet", "test", "testnet", "regtest", "", "swarm", undefined, null])(
    "does not resolve %s to a SWARM network",
    (chain) => {
      expect(swarmProfileFor(chain as string)).toBeUndefined();
    },
  );

  it("resolves only the two SWARM labels, to themselves", () => {
    expect(swarmProfileFor("swarm-testnet")?.id).toBe(SwarmProfileIdEnum.testnet);
    expect(swarmProfileFor("swarm-mainnet")?.id).toBe(SwarmProfileIdEnum.mainnet);
    expect(swarmProfileFor(ServerChainNameEnum.mainChainName)).toBeUndefined();
  });

  it("keeps the two SWARM networks' encodings disjoint", () => {
    const testnet = SWARM_TESTNET_PROFILE;
    const mainnet = SWARM_MAINNET_PROFILE;
    expect(testnet.unifiedHrp).not.toBe(mainnet.unifiedHrp);
    expect(testnet.chainLabel).not.toBe(mainnet.chainLabel);
    for (const prefix of mainnet.transparentPrefixes) {
      expect(testnet.transparentPrefixes).not.toContain(prefix);
    }
    for (const prefix of mainnet.distinctivePrefixes) {
      expect(testnet.distinctivePrefixes).not.toContain(prefix);
    }
  });
});
