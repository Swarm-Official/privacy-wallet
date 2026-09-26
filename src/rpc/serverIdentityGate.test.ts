import RPC from "./rpc";
import { native } from "../electronBridge";
import { ServerChainNameEnum, WalletType } from "../components/appstate";
import { SWARM_MAINNET_PROFILE } from "../utils/networkProfiles";

jest.mock("../electronBridge", () => ({
  native: {
    info_server: jest.fn(),
    run_sync: jest.fn(),
    run_rescan: jest.fn(),
    send: jest.fn(),
    confirm: jest.fn(),
    poll_sync: jest.fn(),
  },
  ipcRenderer: { invoke: jest.fn(), on: jest.fn(() => () => {}), send: jest.fn() },
  clipboard: {},
  shell: {},
  fs: {},
  isSandboxed: false,
}));

/**
 * The gate itself: before a block is scanned and before a payment is built, the
 * wallet asks the indexer which chain it serves and refuses if the answer is
 * not the chain this wallet is on.
 */

const wallet = (chain: ServerChainNameEnum, uri = "https://lwd.swarm.green:443"): WalletType =>
  ({ id: 1, name: "w", fileName: "w.dat", chain_name: chain, uri }) as unknown as WalletType;

function client(current: WalletType | null) {
  const error = jest.fn();
  const noop = () => {};
  const rpc = new RPC(noop, noop, noop, noop, noop, noop, noop, noop, noop, error, noop, noop, current);
  return { rpc, error };
}

const info = (chain: string, genesis?: string) =>
  JSON.stringify({
    chain_name: chain,
    server_uri: "https://lwd.swarm.green:443/",
    latest_block_height: 10,
    ...(genesis ? { genesis_hash: genesis } : {}),
  });

// Whether SWARM production is reachable at all is a property of the build, not
// of the gate: before the launch ceremony `SWARM_MAINNET_GENESIS` is null and
// every production server is refused; afterwards the gate behaves like any
// other chain. Both are asserted, so the launch commit rewrites no test here.
const MAINNET_LAUNCHED = SWARM_MAINNET_PROFILE.genesis !== null;
const whileUnlaunched = MAINNET_LAUNCHED ? it.skip : it;
const onceLaunched = MAINNET_LAUNCHED ? it : it.skip;
const mainnetInfo = () => info("swarm-mainnet", SWARM_MAINNET_PROFILE.genesis ?? undefined);

beforeEach(() => {
  jest.clearAllMocks();
  (native.run_sync as jest.Mock).mockResolvedValue("sync launched");
});

describe("before syncing", () => {
  it("syncs when the server serves this wallet's chain", async () => {
    (native.info_server as jest.Mock).mockResolvedValue(info("swarm-testnet"));
    const { rpc, error } = client(wallet(ServerChainNameEnum.swarmTestnetChainName));
    await rpc.refreshSync();
    expect(native.run_sync).toHaveBeenCalled();
    expect(error).not.toHaveBeenCalledWith("Sync", expect.stringContaining("serves"));
  });

  it("refuses, and does not launch a sync, when the server serves another chain", async () => {
    (native.info_server as jest.Mock).mockResolvedValue(info("main"));
    const { rpc, error } = client(wallet(ServerChainNameEnum.swarmTestnetChainName));
    await rpc.refreshSync();
    expect(native.run_sync).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledWith("Sync", expect.stringContaining("SWARM Testnet"));
  });

  whileUnlaunched("refuses a wallet whose chain this build cannot serve at all", async () => {
    (native.info_server as jest.Mock).mockResolvedValue(mainnetInfo());
    const { rpc, error } = client(wallet(ServerChainNameEnum.swarmMainnetChainName));
    await rpc.refreshSync();
    expect(native.run_sync).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledWith("Sync", expect.stringContaining("genesis"));
  });

  onceLaunched("syncs a mainnet wallet against a mainnet server once this build has launched", async () => {
    (native.info_server as jest.Mock).mockResolvedValue(mainnetInfo());
    const { rpc } = client(wallet(ServerChainNameEnum.swarmMainnetChainName));
    await rpc.refreshSync();
    expect(native.run_sync).toHaveBeenCalled();
  });

  // Until 2026-09-26 this read "leaves an upstream Zcash wallet exactly as it
  // was" and asserted that such a wallet synced untouched. Then the
  // create-a-wallet screen, which still offered upstream's chains and
  // upstream's servers, produced one: a real Zcash mainnet wallet with a `u1…`
  // address, inside a SWARM wallet, from a seed phrase its owner had written
  // down for SWARM. No screen offers those chains now, but the wallet exists on
  // a machine, and syncing it would be this application operating a Zcash
  // wallet it cannot show correctly.
  it("refuses to sync a wallet that is not on a SWARM network, and says what it is", async () => {
    const errors: string[] = [];
    const noop = () => {};
    const rpc = new RPC(
      noop,
      noop,
      noop,
      noop,
      noop,
      noop,
      noop,
      noop,
      noop,
      (_title: string, message: string) => errors.push(message),
      noop,
      noop,
      wallet(ServerChainNameEnum.mainChainName),
    );

    await rpc.refreshSync();

    expect(native.run_sync).not.toHaveBeenCalled();
    expect(errors.join(" ")).toMatch(/not a SWARM wallet/i);
    expect(errors.join(" ")).toMatch(/upstream Zcash's mainnet/);
    // No round trip is spent asking a server about a wallet that could not be
    // on the right chain whatever the answer.
    expect(native.info_server).not.toHaveBeenCalled();
  });

  it("refuses to send from a wallet that is not on a SWARM network", async () => {
    const { rpc } = client(wallet(ServerChainNameEnum.mainChainName));
    await expect(rpc.sendTransaction([{ address: "u1abc", amount: 1 } as never])).rejects.toThrow(
      /not a SWARM wallet/i,
    );
    expect(native.send).not.toHaveBeenCalled();
  });

  it("asks once per wallet-and-server pair rather than on every pass", async () => {
    (native.info_server as jest.Mock).mockResolvedValue(info("swarm-testnet"));
    const { rpc } = client(wallet(ServerChainNameEnum.swarmTestnetChainName));
    await rpc.refreshSync();
    await rpc.refreshSync();
    expect(native.info_server).toHaveBeenCalledTimes(1);
  });

  it("asks again after the wallet is switched", async () => {
    (native.info_server as jest.Mock).mockResolvedValue(info("swarm-testnet"));
    const { rpc } = client(wallet(ServerChainNameEnum.swarmTestnetChainName));
    await rpc.refreshSync();
    rpc.setCurrentWallet(wallet(ServerChainNameEnum.swarmTestnetChainName, "http://127.0.0.1:9067"));
    await rpc.refreshSync();
    expect(native.info_server).toHaveBeenCalledTimes(2);
  });

  // A server that does not answer is unreachable, not wrong, and the wallet
  // already has surfaces that say so.
  it("does not call an unreachable server a wrong one", async () => {
    (native.info_server as jest.Mock).mockRejectedValue(new Error("connection refused"));
    const { rpc } = client(wallet(ServerChainNameEnum.swarmTestnetChainName));
    await rpc.refreshSync();
    expect(native.run_sync).toHaveBeenCalled();
  });
});

describe("before sending", () => {
  it("refuses to build a payment against the wrong chain", async () => {
    (native.info_server as jest.Mock).mockResolvedValue(info("main"));
    const { rpc } = client(wallet(ServerChainNameEnum.swarmTestnetChainName));
    await expect(rpc.sendTransaction([{ address: "tmEZ", amount: 1 } as never])).rejects.toThrow(
      /SWARM Testnet/,
    );
    expect(native.send).not.toHaveBeenCalled();
  });

  whileUnlaunched("refuses to send from a wallet on a network that has not launched", async () => {
    (native.info_server as jest.Mock).mockResolvedValue(mainnetInfo());
    const { rpc } = client(wallet(ServerChainNameEnum.swarmMainnetChainName));
    await expect(rpc.sendTransaction([{ address: "s1MCk", amount: 1 } as never])).rejects.toThrow(/genesis/);
    expect(native.send).not.toHaveBeenCalled();
  });

  // Once launched, the identity gate lets a mainnet wallet past and the send
  // succeeds or fails on its own merits — never for "this network has no
  // genesis", which is the refusal this gate is about.
  onceLaunched("stops refusing the send for want of a genesis once this build has launched", async () => {
    (native.info_server as jest.Mock).mockResolvedValue(mainnetInfo());
    const { rpc } = client(wallet(ServerChainNameEnum.swarmMainnetChainName));
    await expect(rpc.sendTransaction([{ address: "s1MCk", amount: 1 } as never])).rejects.not.toThrow(/genesis/);
  });
});
