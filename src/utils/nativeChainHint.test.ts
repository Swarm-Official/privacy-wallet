import fs from "fs";
import path from "path";
import { SWARM_MAINNET_PROFILE, SWARM_TESTNET_PROFILE, nativeChainHint } from "./networkProfiles";
import { ServerChainNameEnum } from "../components/appstate";

/**
 * The addon takes a chain HINT, and for SWARM production the hint is not the
 * chain label.
 *
 * `ChainType::SwarmMainnet` carries the genesis hash and the SDK gives it no
 * default, so `swarm-mainnet` on its own is an error there, deliberately — the
 * hint has to be `swarm-mainnet:<64 hex>`. `chainHintFor` had said so since the
 * profile was written, in a documented and tested function that nothing called:
 * every `native.wallet_exists` / `init_*` / `delete_wallet` call site passed
 * `wallet.chain_name` straight through, and the type declaration said that was
 * fine because for the other four chains the hint and the label are the same
 * string. The owner found out by pressing Create on the mainnet build:
 *
 *   initializing wallet: 'swarm-mainnet' does not name a network. The SWARM
 *   production network is opened as 'swarm-mainnet:<genesis>'
 *
 * The first half of this file tests the builder. The second half reads the
 * source of every call site, because a builder nobody calls is what failed
 * here — a unit test of `nativeChainHint` alone would have passed on the build
 * the owner could not create a wallet with.
 */

describe("the chain hint the addon is given", () => {
  it("carries the genesis for SWARM production, because the SDK has no default for it", () => {
    expect(nativeChainHint("swarm-mainnet")).toBe(`swarm-mainnet:${SWARM_MAINNET_PROFILE.genesis}`);
    expect(nativeChainHint("swarm-mainnet")).toMatch(/^swarm-mainnet:[0-9a-f]{64}$/);
  });

  it("is the bare label for SwarmTestnet, which is what the addon has always been sent", () => {
    expect(nativeChainHint("swarm-testnet")).toBe("swarm-testnet");
    expect(SWARM_TESTNET_PROFILE.chainLabel).toBe("swarm-testnet");
  });

  // A legacy wallet on one of upstream's chains still has to be found on disk
  // so it can be named and deleted, so its label passes through untouched.
  it("leaves upstream Zcash's chains exactly as they were", () => {
    expect(nativeChainHint(ServerChainNameEnum.mainChainName)).toBe("main");
    expect(nativeChainHint(ServerChainNameEnum.testChainName)).toBe("test");
    expect(nativeChainHint(ServerChainNameEnum.regtestChainName)).toBe("regtest");
    expect(nativeChainHint(undefined)).toBe("");
  });
});

/**
 * Every argument list of every native call that takes a chain hint, read out
 * of the source.
 */
const NATIVES: Record<string, number> = {
  wallet_exists: 1,
  init_new: 1,
  init_from_seed: 3,
  init_from_ufvk: 3,
  init_from_b64: 1,
  delete_wallet: 1,
};

const sourceFiles = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    if (!/\.tsx?$/.test(entry.name)) return [];
    if (/\.test\.tsx?$/.test(entry.name) || entry.name === "native.node.d.ts") return [];
    return [full];
  });

/** The text between the parentheses of the call whose `(` is at `open`. */
const argumentsAt = (text: string, open: number): string => {
  let depth = 0;
  for (let i = open; i < text.length; i += 1) {
    if (text[i] === "(") depth += 1;
    else if (text[i] === ")") {
      depth -= 1;
      if (depth === 0) return text.slice(open + 1, i);
    }
  }
  throw new Error("unbalanced call");
};

/** Split an argument list on its top-level commas. */
const splitArguments = (text: string): string[] => {
  const out: string[] = [];
  let depth = 0;
  let current = "";
  for (const ch of text) {
    if ("([{".includes(ch)) depth += 1;
    if (")]}".includes(ch)) depth -= 1;
    if (ch === "," && depth === 0) {
      out.push(current);
      current = "";
    } else current += ch;
  }
  out.push(current);
  return out;
};

type CallSite = { file: string; fn: string; chainArgument: string };

const callSites = (): CallSite[] => {
  const found: CallSite[] = [];
  for (const file of sourceFiles(path.join(__dirname, ".."))) {
    const text = fs.readFileSync(file, "utf8");
    for (const [fn, position] of Object.entries(NATIVES)) {
      const pattern = new RegExp(`native\\.${fn}\\(`, "g");
      let match = pattern.exec(text);
      while (match !== null) {
        const args = splitArguments(argumentsAt(text, match.index + match[0].length - 1));
        if (args.length > position) {
          found.push({ file: path.relative(path.join(__dirname, "../.."), file), fn, chainArgument: args[position].trim() });
        }
        match = pattern.exec(text);
      }
    }
  }
  return found;
};

describe("every native call that takes a chain hint builds one", () => {
  it("finds the call sites at all, so an empty sweep cannot pass", () => {
    expect(callSites().length).toBeGreaterThanOrEqual(15);
  });

  it("passes nativeChainHint(...) and never a bare chain label", () => {
    const offenders = callSites().filter((site) => !site.chainArgument.startsWith("nativeChainHint("));

    expect(
      offenders.map((o) => `${o.file}: native.${o.fn}(… ${o.chainArgument} …)`),
    ).toEqual([]);
  });
});
