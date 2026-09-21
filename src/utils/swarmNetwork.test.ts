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
      "http://127.0.0.1:19767",
    ]);
    expect(SWARM_DEFAULT_SERVER).toBe(SWARM_SERVER_PRESETS[0].uri);
  });

  it("recognises a preset and does not claim a typed address is one", () => {
    expect(swarmPresetFor(SWARM_DEFAULT_SERVER)?.label).toBe("SWARM public server");
    expect(swarmPresetFor("https://somewhere.example:443")).toBeUndefined();
  });

  // The default is an address the project will host at and does not host at
  // yet, so this is the first thing a new install meets when it cannot reach
  // it. It has to say that, not "connection refused".
  it("says the public server is not running rather than blaming the wallet", () => {
    const said = swarmUnreachableMessage(SWARM_DEFAULT_SERVER);
    expect(said).toContain("public server is not running yet");
    expect(said).toContain("My own node");
    expect(said).toContain(SWARM_DEFAULT_SERVER);
  });

  it("tells someone running their own node to start it", () => {
    const said = swarmUnreachableMessage(SWARM_SERVER_PRESETS[1].uri);
    expect(said).toContain("Start your SWARM Testnet node and indexer");
  });

  it("names a typed server rather than a preset that does not exist", () => {
    expect(swarmUnreachableMessage("http://127.0.0.1:1234")).toContain("http://127.0.0.1:1234");
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
