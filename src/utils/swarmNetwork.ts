// Straight from the enum's own file rather than the appstate barrel: this
// module is imported by utils, which the barrel's own members import, and the
// barrel would close that loop.
import { ServerChainNameEnum } from "../components/appstate/enums/ServerChainNameEnum";

/**
 * Everything about SwarmTestnet that more than one screen needs, in one place.
 *
 * The project chain is not the public Zcash testnet and has no public server
 * registry: `servers:fetchList` answers an empty list for it on purpose, and
 * `fetchServerList` never asks. That is the whole reason this file exists —
 * every screen that offers a server has to know that "let the wallet pick one"
 * cannot work here, and has to offer the endpoints the project actually runs
 * instead.
 */

/**
 * What this application is called, everywhere it names itself.
 *
 * Unconditional, not per-network: the fork is packaged only as this product,
 * and a wallet the user has put on mainnet is still running this application.
 * Upstream's authorship stays where it belongs, in the licences the build
 * ships and in the repository.
 */
export const SWARM_APP_NAME = "SWARM Wallet (Testnet)";

/** The light-wallet chain label this network's indexer reports. */
export const SWARM_CHAIN: ServerChainNameEnum = ServerChainNameEnum.swarmTestnetChainName;

/** What the network is called on screen. */
export const SWARM_NETWORK_LABEL = "SWARM Testnet";

/**
 * The coin these balances are counted in — the ticker, not the project name.
 * Test coins: there is no market and no fiat price for them.
 */
export const SWARM_TICKER = "SWM";

export type SwarmServerPreset = {
  readonly label: string;
  readonly uri: string;
  readonly note: string;
};

/**
 * The endpoints offered for the project chain, in the order they are shown.
 *
 * The public one is first and is what a fresh profile starts on. It does not
 * answer yet — the server is not deployed — so everything that dials it has to
 * fail with a sentence rather than a stack trace.
 */
export const SWARM_SERVER_PRESETS: readonly SwarmServerPreset[] = [
  {
    label: "SWARM public server",
    uri: "https://lwd.swarm.green:443",
    note: "The project's hosted indexer. It is not running yet.",
  },
  {
    // 9067 is the light-wallet gRPC port in network/swarm-testnet/manifest.json,
    // which is Zaino's conventional one. Not 19767: that belongs to the
    // retired Privacy Testnet's indexer, and pointing this build at it would
    // dial a node serving a different genesis.
    label: "My own node",
    uri: "http://127.0.0.1:9067",
    note: "A SwarmTestnet indexer you run on this computer.",
  },
];

/** Where a wallet on this chain starts when nothing else has been chosen. */
export const SWARM_DEFAULT_SERVER: string = SWARM_SERVER_PRESETS[0].uri;

/** The network's first block, and so the earliest birthday a wallet can have. */
export const SWARM_ACTIVATION_HEIGHT = 1;

/**
 * Why "Automatic" is not offered on this chain. Shown where the radio would
 * have been, so the absence reads as a decision rather than a missing control.
 */
export const SWARM_NO_AUTOMATIC_REASON =
  `${SWARM_NETWORK_LABEL} has no public server directory, so the wallet cannot pick a server for you. ` +
  `Choose one below.`;

/** Whether `chain` is the project chain. */
export const isSwarmChain = (chain: ServerChainNameEnum | "" | undefined): boolean => chain === SWARM_CHAIN;

/** The preset `uri` belongs to, or undefined when it was typed by hand. */
export const swarmPresetFor = (uri: string): SwarmServerPreset | undefined =>
  SWARM_SERVER_PRESETS.find((preset) => preset.uri === uri);

/**
 * The cell a hidden digit folds into (style guide, section 07: masked values).
 * A hexagon rather than an asterisk — the value goes back into the hive.
 */
export const MASK_CELL = "⬢";

/**
 * An amount with its digits hidden, for when balances are not to be read over
 * someone's shoulder. The shape of the number survives — separators stay where
 * they were — so a masked figure still looks like the figure it is hiding.
 */
export const maskAmount = (amount: string, ticker: string = SWARM_TICKER): string => {
  const masked = amount.replace(/\d/g, MASK_CELL);
  return ticker ? `${masked} ${ticker}` : masked;
};

/**
 * What to say when a server on this chain does not answer.
 *
 * The default preset is the case worth naming: `lwd.swarm.green` is the
 * address the project will host at and does not host at yet, so a fresh
 * install dials something that cannot answer. A transport error would leave
 * the user thinking their wallet is broken; this says what is actually true
 * and what the alternative is.
 */
export const swarmUnreachableMessage = (uri: string): string => {
  const preset = swarmPresetFor(uri);
  if (preset && preset.uri === SWARM_DEFAULT_SERVER) {
    return (
      `${preset.label} (${uri}) did not answer. The project's public server is not running yet. ` +
      `Choose "My own node" if you are running a ${SWARM_NETWORK_LABEL} indexer on this computer, ` +
      `or type another address below.`
    );
  }
  if (preset) {
    return (
      `${preset.label} (${uri}) did not answer. Start your ${SWARM_NETWORK_LABEL} node and indexer, ` +
      `then try again.`
    );
  }
  return `${uri} did not answer. Check the address, or choose one of the listed servers.`;
};
