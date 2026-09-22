import {
  MASK_CELL,
  SWARM_APP_NAME,
  SWARM_CHAIN,
  SWARM_DEFAULT_SERVER,
  SWARM_SERVER_PRESETS,
  SWARM_TICKER,
  isSwarmChain,
  maskAmount,
  swarmPresetFor,
  swarmUnreachableMessage,
} from "./swarmNetwork";
import { ServerChainNameEnum } from "../components/appstate";

describe("the project network's identity", () => {
  it("is the chain label the indexer reports", () => {
    expect(SWARM_CHAIN).toBe("swarm-testnet");
    expect(isSwarmChain(SWARM_CHAIN)).toBe(true);
    expect(isSwarmChain(ServerChainNameEnum.testChainName)).toBe(false);
    expect(isSwarmChain("")).toBe(false);
    expect(isSwarmChain(undefined)).toBe(false);
  });

  // SWARM is the project; SWM is what a balance is counted in.
  it("counts balances in SWM", () => {
    expect(SWARM_TICKER).toBe("SWM");
    expect(SWARM_APP_NAME).toBe("SWARM Wallet (Testnet)");
  });
});

describe("the servers offered for this chain", () => {
  it("offers the project server first and a local node second", () => {
    expect(SWARM_SERVER_PRESETS.map((preset) => preset.uri)).toEqual([
      "https://lwd.swarm.green:443",
      "http://127.0.0.1:9067",
    ]);
    expect(SWARM_DEFAULT_SERVER).toBe(SWARM_SERVER_PRESETS[0].uri);
  });

  it("recognises a preset and does not claim a typed address is one", () => {
    expect(swarmPresetFor(SWARM_DEFAULT_SERVER)?.label).toBe("SWARM public server");
    expect(swarmPresetFor("https://somewhere.example:443")).toBeUndefined();
  });

  // It names the host and says what the wallet is doing, and nothing else.
  // It used to announce that the public server "is not running yet" — true
  // when written, false from 2026-09-21, and by then it was telling people the
  // network was down while it was live.
  it("names the host and says the wallet keeps trying", () => {
    const said = swarmUnreachableMessage(SWARM_DEFAULT_SERVER);
    expect(said).toContain("lwd.swarm.green");
    expect(said).toContain("keeps retrying");
    expect(said).not.toMatch(/not running|not deployed|not live/i);
  });

  it("points someone on their own node at their own indexer", () => {
    const said = swarmUnreachableMessage(SWARM_SERVER_PRESETS[1].uri);
    expect(said).toContain("127.0.0.1");
    expect(said).toContain("indexer is running");
  });

  it("names a typed server rather than a preset that does not exist", () => {
    expect(swarmUnreachableMessage("http://127.0.0.1:1234")).toContain("127.0.0.1");
  });

  // Every preset's note has to stay true as the network changes around it.
  it("promises nothing about a server being absent", () => {
    for (const preset of SWARM_SERVER_PRESETS) {
      expect(preset.note).not.toMatch(/not running|not deployed|not live/i);
    }
  });
});

describe("masked amounts", () => {
  it("hides every digit and keeps the shape of the number", () => {
    expect(maskAmount("1240.50")).toBe(`${MASK_CELL.repeat(4)}.${MASK_CELL.repeat(2)} SWM`);
    expect(maskAmount("0.00000001")).toBe(`${MASK_CELL}.${MASK_CELL.repeat(8)} SWM`);
  });

  it("leaves no digit behind", () => {
    expect(maskAmount("1,240.50")).not.toMatch(/\d/);
  });
});
