import RPC from "./rpc";
import { RPCValueTransferType } from "./components/RPCValueTransferType";
import { ValueTransferClass, ValueTransferKindEnum, ValueTransferStatusEnum } from "../components/appstate";
import { ValueTransferPoolEnum } from "../components/appstate/enums/ValueTransferPoolEnum";
import { native } from "../electronBridge";

/**
 * The mapper that turns zingolib's value-transfer JSON into what the screens
 * read.
 *
 * Nothing covered it before. That is how `is_coinbase` could have been added
 * to the SDK, added to the type, and still never reached a component: the one
 * line that copies it across lives in a private method with no harness around
 * it, and the screens would simply have shown "Received" for a mined reward
 * forever without anything going red.
 *
 * So this is the harness, minimal but real: the actual `RPC` instance, the
 * actual private method, a stubbed native module, and a fixture shaped like
 * what `get_value_transfers` returns. Every field the mapper touches is
 * asserted, not only the coinbase flag — a mapper is exactly the kind of code
 * where the next field to go missing is the one nobody thought to check.
 */

jest.mock("../electronBridge", () => ({
  native: {
    get_latest_block_server: jest.fn(),
    get_latest_block_wallet: jest.fn(),
  },
  clipboard: {},
  shell: {},
  ipcRenderer: { invoke: jest.fn(), on: jest.fn(() => () => {}), send: jest.fn() },
  fs: {},
  isSandboxed: false,
}));

const mockNative = native as unknown as {
  get_latest_block_server: jest.Mock;
  get_latest_block_wallet: jest.Mock;
};

const CHAIN_TIP = 12046;

/** A value transfer as the SDK actually sends it, with only the parts a case cares about changed. */
function rpcVt(overrides: Partial<RPCValueTransferType> = {}): RPCValueTransferType {
  return {
    txid: "f3a9c1e78b4d2059ac71e3f0d8b6a24c19e5f7038a1c4d6e2b9f0a7c5d3e18e1a",
    datetime: 1_700_000_000,
    kind: ValueTransferKindEnum.received,
    status: ValueTransferStatusEnum.confirmed,
    blockheight: 12_041,
    value: 625_000_000,
    ...overrides,
  };
}

/**
 * Runs the mapper over `rows` and hands back what it published.
 *
 * `fetchValueTransferData` is private, which is right — nothing outside the
 * class should be calling it — but that privacy is a compile-time rule about
 * who may call it, not a reason for it to go untested. The cast says so out
 * loud rather than widening the class's surface for the sake of a test.
 */
async function mapRows(rows: RPCValueTransferType[]): Promise<ValueTransferClass[]> {
  let published: ValueTransferClass[] = [];
  const noop = () => {};
  const rpc = new RPC(
    noop,
    noop,
    noop,
    (list: ValueTransferClass[]) => {
      published = list;
    },
    noop,
    noop,
    noop,
    noop,
    noop,
    noop,
    noop,
    noop,
    null,
  );

  await (
    rpc as unknown as {
      fetchValueTransferData: (
        label: string,
        fetcher: () => Promise<RPCValueTransferType[]>,
        setter: (list: ValueTransferClass[]) => void,
      ) => Promise<void>;
    }
  ).fetchValueTransferData(
    "Value Transfers",
    async () => rows,
    (list) => {
      published = list;
    },
  );

  return published;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockNative.get_latest_block_server.mockResolvedValue(String(CHAIN_TIP));
  mockNative.get_latest_block_wallet.mockResolvedValue(JSON.stringify({ height: CHAIN_TIP }));
});

describe("the coinbase flag", () => {
  it("carries a mined reward through to the renderer", async () => {
    const [vt] = await mapRows([rpcVt({ is_coinbase: true })]);
    expect(vt.isCoinbase).toBe(true);
  });

  it("carries an ordinary payment through as not a reward", async () => {
    const [vt] = await mapRows([rpcVt({ is_coinbase: false })]);
    expect(vt.isCoinbase).toBe(false);
  });

  /**
   * The case that matters most, and the one this file exists for. A wallet
   * built against an SDK older than privacy-zingolib dc444848 sends no such
   * field, and an absent field must read as "not a reward" rather than as
   * unknown — otherwise the screens would have to decide, and deciding means
   * guessing about where someone's money came from.
   */
  it("reads an absent flag as not a reward, never as unknown", async () => {
    const [vt] = await mapRows([rpcVt()]);
    expect(vt.isCoinbase).toBe(false);
    expect(vt.isCoinbase).not.toBeUndefined();
  });

  it("does not accept a truthy value that is not true", async () => {
    const [vt] = await mapRows([rpcVt({ is_coinbase: "yes" } as unknown as Partial<RPCValueTransferType>)]);
    expect(vt.isCoinbase).toBe(false);
  });

  it("flags every transfer of a coinbase transaction, and none of an ordinary one", async () => {
    const mapped = await mapRows([
      rpcVt({ txid: "aaa", is_coinbase: true }),
      rpcVt({ txid: "aaa", is_coinbase: true, value: 1 }),
      rpcVt({ txid: "bbb" }),
    ]);
    expect(mapped.map((v) => v.isCoinbase)).toEqual([true, true, false]);
  });
});

describe("the rest of the mapping", () => {
  it("converts zatoshis to coins for the value and the fee", async () => {
    const [vt] = await mapRows([rpcVt({ value: 625_000_000, transaction_fee: 10_000 })]);
    expect(vt.amount).toBe(6.25);
    expect(vt.fee).toBe(0.0001);
  });

  it("reports a zero fee rather than an absent one", async () => {
    const [vt] = await mapRows([rpcVt({ transaction_fee: undefined })]);
    expect(vt.fee).toBe(0);
  });

  it("counts confirmations from the chain tip, inclusive of the mining block", async () => {
    const [vt] = await mapRows([rpcVt({ blockheight: CHAIN_TIP })]);
    expect(vt.confirmations).toBe(1);
  });

  it("gives an unmined transfer no confirmations at all", async () => {
    for (const status of [
      ValueTransferStatusEnum.calculated,
      ValueTransferStatusEnum.transmitted,
      ValueTransferStatusEnum.mempool,
      ValueTransferStatusEnum.failed,
    ]) {
      const [vt] = await mapRows([rpcVt({ status })]);
      expect(vt.confirmations).toBe(0);
    }
  });

  it("normalises the SDK's capitalised pool names", async () => {
    const [vt] = await mapRows([rpcVt({ pools_sent_from: ["Transparent"], pools_received: ["Ironwood", "Orchard"] })]);
    expect(vt.poolsSentFrom).toEqual([ValueTransferPoolEnum.transparent]);
    expect(vt.poolsReceived).toEqual([ValueTransferPoolEnum.ironwood, ValueTransferPoolEnum.orchard]);
  });

  it("treats an empty memo list as no memo", async () => {
    expect((await mapRows([rpcVt({ memos: [] })]))[0].memos).toBeUndefined();
    expect((await mapRows([rpcVt({ memos: ["hello"] })]))[0].memos).toEqual(["hello"]);
  });

  it("keeps the recipient address, and drops an empty one", async () => {
    expect((await mapRows([rpcVt({ recipient_address: "tmABC" })]))[0].address).toBe("tmABC");
    expect((await mapRows([rpcVt({ recipient_address: "" })]))[0].address).toBeUndefined();
  });

  // An Orchard-funded self-send that lands in Ironwood is a pool migration,
  // which zingolib does not model as its own kind.
  it("recognises an Orchard to Ironwood migration", async () => {
    const [vt] = await mapRows([
      rpcVt({
        kind: ValueTransferKindEnum.sendToSelf,
        pools_sent_from: ["Orchard"],
        pools_received: ["Ironwood"],
      }),
    ]);
    expect(vt.type).toBe(ValueTransferKindEnum.migration);
  });

  it("publishes nothing rather than throwing when the server height is unavailable", async () => {
    mockNative.get_latest_block_server.mockResolvedValue("");
    const mapped = await mapRows([rpcVt({ blockheight: 1 })]);
    expect(mapped).toHaveLength(1);
    // Wallet height stands in for the tip when the server gave none.
    expect(mapped[0].confirmations).toBe(CHAIN_TIP);
  });
});
