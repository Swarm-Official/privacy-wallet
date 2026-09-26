import {
  SwarmNetworkProfile,
  isProfileSelectable,
  swarmProfileFor,
  unselectableReason,
} from "./networkProfiles";
import { serverHost } from "./swarmNetwork";

/**
 * Is the indexer on the other end of this connection serving the chain the
 * wallet thinks it is on?
 *
 * A light wallet has no peers and no chain of its own: it believes whatever its
 * one indexer tells it. Pointed at the wrong one it will sync someone else's
 * blocks into this wallet's state, show a balance that is not the user's, and —
 * the part that is not recoverable — build and broadcast a payment against the
 * wrong consensus rules. Two SWARM networks make that a live possibility rather
 * than a theoretical one, so the wallet asks before it syncs and before it
 * sends, and refuses rather than guessing.
 *
 * What it checks is what `GetLightdInfo` actually carries: the chain label. The
 * genesis hash is not in that response, so when the caller can supply one — a
 * profile that has launched, and an indexer that reports one — it is compared
 * too, and a mismatch is refused on the same terms. A profile with no genesis
 * is refused outright: it cannot hold any server to anything.
 */

/** The fields of `GetLightdInfo` this check reads. */
export type ServerIdentity = {
  /** The chain label the indexer reports. */
  chain_name?: string;
  /** The server it says it is. Used only in the message. */
  server_uri?: string;
  /**
   * The genesis block hash, when the indexer states one. Not part of upstream's
   * `GetLightdInfo`; read when present and ignored when absent, so this check
   * works against a stock lightwalletd and tightens against one that says more.
   */
  genesis_hash?: string;
};

export enum ServerRefusalEnum {
  /** The profile cannot be used at all: no genesis to hold a server to. */
  profileNotLaunched = "profile-not-launched",
  /** The indexer said nothing about which chain it serves. */
  silent = "silent",
  /** The indexer serves a different chain. */
  wrongChain = "wrong-chain",
  /** Right label, different chain: the genesis does not match. */
  wrongGenesis = "wrong-genesis",
};

export type ServerVerdict =
  | { ok: true }
  | { ok: false; reason: ServerRefusalEnum; message: string };

const OK: ServerVerdict = { ok: true };

/**
 * The verdict for a wallet that is not on a SWARM network at all.
 *
 * There should be no such wallet: nothing in this build offers upstream Zcash's
 * chains or its servers any more. But the build of 2026-09-26 offered both, an
 * owner created a real Zcash mainnet wallet with it — a `u1…` receive address —
 * and that wallet is still in his wallet list. It is named for what it is and
 * otherwise left alone: not synced, not sent from, and not silently moved onto
 * a SWARM chain, because its recovery phrase is the only thing that opens it
 * and moving it would hide that.
 */
export const notASwarmWallet = (chain: string | undefined | null): ServerVerdict => {
  const named = chain ? `"${chain}"` : "a network it does not name";
  const whose =
    chain === "main"
      ? "upstream Zcash's mainnet"
      : chain === "test"
        ? "upstream Zcash's testnet"
        : chain === "regtest"
          ? "a local Zcash regtest chain"
          : "not a network this wallet serves";
  return {
    ok: false,
    reason: ServerRefusalEnum.wrongChain,
    message:
      `This is not a SWARM wallet. It was created on ${named}, which is ${whose}, so it is not ` +
      `synced here and nothing can be sent from it. Its recovery phrase still opens it in a ` +
      `wallet for that network. To use SWARM, create a new wallet.`,
  };
};

/**
 * Whether the wallet may sync or send against `identity` while on `profile`.
 *
 * Pure: it performs no I/O and holds no state, so the refusal it returns is a
 * decision a test can read and a caller can put straight on screen.
 */
export function checkServerIdentity(
  profile: SwarmNetworkProfile | undefined,
  identity: ServerIdentity | undefined | null,
  chain?: string,
): ServerVerdict {
  if (!profile) return notASwarmWallet(chain);

  if (!isProfileSelectable(profile)) {
    return { ok: false, reason: ServerRefusalEnum.profileNotLaunched, message: unselectableReason(profile) };
  }

  const reported = identity?.chain_name?.trim() ?? "";
  const where = serverHost(identity?.server_uri) || "the server";

  if (!reported) {
    return {
      ok: false,
      reason: ServerRefusalEnum.silent,
      message:
        `${where} did not say which chain it serves, so the wallet cannot tell it apart from a ` +
        `server for another network. Nothing was synced or sent.`,
    };
  }

  if (reported !== profile.chainLabel) {
    const theirs = swarmProfileFor(reported);
    const named = theirs ? theirs.displayName : `the chain "${reported}"`;
    return {
      ok: false,
      reason: ServerRefusalEnum.wrongChain,
      message:
        `${where} serves ${named}, and this wallet is on ${profile.displayName}. ` +
        `The wallet will not sync or send against it. Choose a ${profile.displayName} server.`,
    };
  }

  const theirGenesis = identity?.genesis_hash?.trim().toLowerCase() ?? "";
  if (theirGenesis && theirGenesis !== profile.genesis) {
    return {
      ok: false,
      reason: ServerRefusalEnum.wrongGenesis,
      message:
        `${where} calls itself ${profile.displayName}, but its first block is not ` +
        `${profile.displayName}'s. It is a different chain under the same name, and the wallet ` +
        `will not sync or send against it.`,
    };
  }

  return OK;
}

/** The same check from a chain label, for callers that carry one. */
export function checkServerIdentityForChain(
  chain: string | undefined,
  identity: ServerIdentity | undefined | null,
): ServerVerdict {
  return checkServerIdentity(swarmProfileFor(chain), identity, chain);
}
