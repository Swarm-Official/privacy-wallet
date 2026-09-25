import { SWARM_MAINNET_PROFILE, SWARM_TESTNET_PROFILE } from "./networkProfiles";
import {
  AddressRefusalEnum,
  addressRefusalMessage,
  bech32Shape,
  checkAddressForChain,
  checkAddressForProfile,
} from "./swarmAddress";

/**
 * The vectors.
 *
 * `SWARM_T_P2PKH` and `SWARM_T_P2SH` are the production transparent forms of
 * the version bytes the identity proposal fixes (0x1c28 and 0x1c2d); `TESTNET_T`
 * is a SwarmTestnet P2SH, from upstream testnet's 0x1cba, which this build's
 * vendored protocol crate leaves alone.
 *
 * `TESTNET_UA` is real: it is the SwarmTestnet unified address the URI suite
 * already pays, and it satisfies bech32m.
 *
 * `MAINNET_UA` is well-formed but not real. SWARM production has no wallet and
 * no golden unified-address vector yet — the SDK's own production test asserts
 * only `starts_with("swm1")` — and a valid `swm1…` cannot be derived from the
 * testnet one, because ZIP 316 f4jumbles the payload with the HRP as padding.
 * So this vector carries a correct `swm` bech32m checksum over an arbitrary
 * body: enough to exercise everything this layer decides (HRP, charset,
 * checksum) and no more. Whether the payload is a unified address is the
 * addon's question, and it is still asked afterwards.
 */
const SWARM_T_P2PKH = "s1MCkDhVejM4RqDyRR1rEJkudd26FVWipPD";
const SWARM_T_P2SH = "s3Mtm9Ez6HFNovPfrY7WpjPGZmYNxztrxbb";
const TESTNET_T = "t2DGVURG5tAyXXSkj85JV5xbvTobYv7H99n";
const TESTNET_UA =
  "swarm12flymdvahre66el73vpyej6nva55s0lhxhp97ujv7k0vrhgvdgmsfp2xtccadctpqaku2uvw8jqm4w5py66mml9yxf600eluzumd473r";
const MAINNET_UA =
  "swm12flymdvahre66el73vpyej6nva55s0lhxhp97ujv7k0vrhgvdgmsfp2xtccadctpqaku2uvw8jqm4w5py66mml9yxf600eluzumd473rh7pkxc";
const TESTNET_LEGACY_UA =
  "utest18z7h64gzyjgfpuch39v2dd3g766scdzc0qdsa9qj5tawzd0n6d88dl3vyyx6elk6mcemdd6wtkd3unnvutd3sdpd3jjvgs7lz4uas7rv25d26pnryp6tczmfapqze6ggdy7645kkevh8r980zxzcyj6d9dsplukx0htsym5xsqtwaka4";

const UPSTREAM_T_P2PKH = "t1RwbKka9nbxDPvbKPM7zbXdsPYBqR6rL2C";
const UPSTREAM_T_P2SH = "t3Vz22vK5z2LcKEdg16Yv4FFneEL1zg9ojd";
// Upstream shapes. Only their HRP and version prefix matter here — the rule
// refuses a Zcash address before anything decodes it — so these carry valid
// charsets and no claim to be spendable anywhere.
const UPSTREAM_UA =
  "u1qqqsqpe6ywp0shr9tvpqr3zvgw2u5zjcgkyv3qlqx3x9crfxksmpwqqpqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq";
const UPSTREAM_SAPLING = "zs1lxfl9zavecn6ke76lsqnvyvj3lwsqjujdsgtn5rl3gjg5c3n2dkzhnhl0pkzfxuelcvzds4n7w9";

describe("bech32 shapes", () => {
  it("reads the HRP from the last separator and checks the checksum", () => {
    expect(bech32Shape(TESTNET_UA)).toEqual({ hrp: "swarm", encoding: "bech32m" });
    expect(bech32Shape(MAINNET_UA)).toEqual({ hrp: "swm", encoding: "bech32m" });
  });

  it("notices a damaged body", () => {
    const damaged = `${TESTNET_UA.slice(0, -1)}${TESTNET_UA.endsWith("r") ? "p" : "r"}`;
    expect(bech32Shape(damaged)).toEqual({ hrp: "swarm", encoding: null });
  });

  it("is not fooled by strings that are not bech32 at all", () => {
    expect(bech32Shape(SWARM_T_P2PKH)).toBeUndefined();
    expect(bech32Shape("")).toBeUndefined();
    expect(bech32Shape("swarm1")).toBeUndefined();
  });
});

describe("on SWARM Mainnet", () => {
  const verdict = (address: string) => checkAddressForProfile(address, SWARM_MAINNET_PROFILE);

  it.each([SWARM_T_P2PKH, SWARM_T_P2SH, MAINNET_UA])("accepts %s", (address) => {
    expect(verdict(address)).toEqual({ accepted: true });
  });

  it.each([
    ["the SwarmTestnet unified address", TESTNET_UA],
    ["the legacy SwarmTestnet unified address", TESTNET_LEGACY_UA],
    ["the SwarmTestnet transparent address", TESTNET_T],
    ["a tm… SwarmTestnet address", "tmEZhbWHTpdKMw5it8YDspUXSMGQyFwovpU"],
  ])("refuses %s and says which network it belongs to", (_label, address) => {
    const answer = verdict(address);
    expect(answer.accepted).toBe(false);
    if (answer.accepted) return;
    expect(answer.reason).toBe(AddressRefusalEnum.otherSwarmNetwork);
    expect(answer.message).toContain("SWARM Testnet");
    expect(answer.message).toContain("SWARM Mainnet");
  });

  it.each([
    ["a Zcash unified address", UPSTREAM_UA],
    ["a Zcash sapling address", UPSTREAM_SAPLING],
    ["a Zcash t1 address", UPSTREAM_T_P2PKH],
    ["a Zcash t3 address", UPSTREAM_T_P2SH],
  ])("refuses %s as upstream Zcash", (_label, address) => {
    const answer = verdict(address);
    expect(answer.accepted).toBe(false);
    if (answer.accepted) return;
    expect(answer.reason).toBe(AddressRefusalEnum.upstream);
    expect(answer.message).toMatch(/Zcash/);
  });

  it("refuses a swm1 address whose checksum does not hold", () => {
    const damaged = `${MAINNET_UA.slice(0, -1)}p`;
    const answer = verdict(damaged);
    expect(answer.accepted).toBe(false);
    if (answer.accepted) return;
    expect(answer.reason).toBe(AddressRefusalEnum.corrupt);
  });
});

describe("on SWARM Testnet", () => {
  const verdict = (address: string) => checkAddressForProfile(address, SWARM_TESTNET_PROFILE);

  it.each([TESTNET_UA, TESTNET_LEGACY_UA, TESTNET_T, "tmEZhbWHTpdKMw5it8YDspUXSMGQyFwovpU"])(
    "accepts %s, exactly as this build already does",
    (address) => {
      expect(verdict(address)).toEqual({ accepted: true });
    },
  );

  it.each([
    ["the production unified address", MAINNET_UA],
    ["the production s1 address", SWARM_T_P2PKH],
    ["the production s3 address", SWARM_T_P2SH],
  ])("refuses %s, which belongs to the other SWARM network", (_label, address) => {
    const answer = verdict(address);
    expect(answer.accepted).toBe(false);
    if (answer.accepted) return;
    expect(answer.reason).toBe(AddressRefusalEnum.otherSwarmNetwork);
    expect(answer.message).toContain("SWARM Mainnet");
  });

  it.each([UPSTREAM_UA, UPSTREAM_SAPLING, UPSTREAM_T_P2PKH, UPSTREAM_T_P2SH])(
    "refuses the upstream Zcash address %s",
    (address) => {
      const answer = verdict(address);
      expect(answer.accepted).toBe(false);
      if (answer.accepted) return;
      expect(answer.reason).toBe(AddressRefusalEnum.upstream);
    },
  );
});

describe("from a chain label", () => {
  it("has no opinion about the upstream chains", () => {
    expect(checkAddressForChain(UPSTREAM_UA, "main")).toBeUndefined();
    expect(checkAddressForChain(TESTNET_UA, "test")).toBeUndefined();
    expect(checkAddressForChain(TESTNET_UA, "regtest")).toBeUndefined();
    expect(checkAddressForChain(TESTNET_UA, undefined)).toBeUndefined();
    expect(addressRefusalMessage(UPSTREAM_UA, "main")).toBe("");
  });

  it("answers for both SWARM chains", () => {
    expect(checkAddressForChain(TESTNET_UA, "swarm-testnet")?.accepted).toBe(true);
    expect(checkAddressForChain(TESTNET_UA, "swarm-mainnet")?.accepted).toBe(false);
    expect(addressRefusalMessage(SWARM_T_P2PKH, "swarm-testnet")).toContain("SWARM Mainnet");
    expect(addressRefusalMessage(SWARM_T_P2PKH, "swarm-mainnet")).toBe("");
  });

  it("refuses an empty address rather than accepting it by default", () => {
    expect(checkAddressForChain("", "swarm-mainnet")?.accepted).toBe(false);
    expect(checkAddressForChain("   ", "swarm-mainnet")?.accepted).toBe(false);
  });

  it("refuses something that is no address at all", () => {
    const answer = checkAddressForChain("hello world", "swarm-mainnet");
    expect(answer?.accepted).toBe(false);
    if (!answer || answer.accepted) return;
    expect(answer.reason).toBe(AddressRefusalEnum.unrecognised);
    expect(answer.message).toContain("swm1…");
  });
});
