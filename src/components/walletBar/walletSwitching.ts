import { WalletType } from "../appstate";
import { ipcRenderer } from "../../electronBridge";
import Utils from "../../utils/utils";
import routes from "../../constants/routes.json";

/**
 * What the wallet switcher does, apart from how it looks.
 *
 * Two controls need this now — the `<select>` in the wallet bar and the menu
 * in the SWARM rail — and the bug they exist to be free of was a listing rule
 * written down twice. The old select hard-coded three chain groups, mainnet,
 * testnet and regtest; a wallet on this project's chain matched none of them,
 * so the control rendered with no options and the owner clicked a button that
 * did nothing (defect W-4). Grouping by the chains the wallets are actually on
 * is the fix, and it is here so that neither control can drift from it.
 */

/** The two entries that do something other than switch wallet. */
export const ADD_NEW = "swarm:add-new";
export const RESTORE = "swarm:restore";

export type WalletGroup = {
  chain: string;
  /** Heading for the group, upper-cased. */
  label: string;
  wallets: WalletType[];
};

/**
 * Wallets grouped by the chain each one is on, in a stable order.
 *
 * `chainDisplayName` knows the chains this build ships; anything else keeps
 * its own name rather than vanishing. That fallback is the whole point.
 */
export function groupWallets(wallets: WalletType[]): WalletGroup[] {
  // A copy: the array in context is shared, and the control this replaces
  // sorted it where it lay.
  const sorted = [...(wallets ?? [])]
    .filter((w) => !!w)
    .sort((a, b) => {
      const byChain = String(a.chain_name).localeCompare(String(b.chain_name));
      return byChain !== 0 ? byChain : a.id - b.id;
    });

  const groups: WalletGroup[] = [];
  for (const wallet of sorted) {
    const chain = String(wallet.chain_name);
    const existing = groups.find((g) => g.chain === chain);
    if (existing) existing.wallets.push(wallet);
    else groups.push({ chain, label: (Utils.chainDisplayName(chain) || chain).toUpperCase(), wallets: [wallet] });
  }
  return groups;
}

export type WalletSwitchDeps = {
  currentWalletId: number | undefined;
  navigate: (to: string, options?: { state: unknown }) => void;
  openErrorModal: (title: string, body: string) => void;
  /** Reopens the application against whichever id was just recorded. */
  reopenWallet: () => void;
};

/**
 * Acts on a choice from either control.
 *
 * Switching is two steps — record the choice, then reopen — because opening a
 * wallet is the loading screen's job, and a switcher that did it differently
 * would be a second way into the same state.
 */
export async function chooseWallet(value: string, deps: WalletSwitchDeps): Promise<void> {
  const { currentWalletId, navigate, openErrorModal, reopenWallet } = deps;

  if (value === ADD_NEW) {
    navigate(routes.ADDNEWWALLET, { state: { mode: "addnew" } });
    return;
  }
  if (value === RESTORE) {
    // The same screen: its "Type of Wallet creation" picker is where seed,
    // viewing key and file live, so restoring is that screen with the user one
    // choice further in rather than a second screen saying the same.
    navigate(routes.ADDNEWWALLET, { state: { mode: "addnew", restore: true } });
    return;
  }

  const id = Number(value);
  if (!Number.isFinite(id) || id === currentWalletId) return;

  openErrorModal("Change Wallet", "Opening the new active Wallet selected");
  await ipcRenderer.invoke("saveSettings", { key: "currentwalletid", value: id });
  reopenWallet();
}
