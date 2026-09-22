import React, { useContext } from "react";
import { useNavigate } from "react-router-dom";
import cstyles from "../common/Common.module.css";
import { ContextApp } from "../../context/ContextAppState";
import { WalletType } from "../appstate";
import { ipcRenderer } from "../../electronBridge";
import Utils from "../../utils/utils";
import routes from "../../constants/routes.json";

type SelectWalletProps = {
  navigateToLoadingScreenChangingWallet: () => void;
};

/** The two entries at the foot of the list that do something other than switch. */
const ADD_NEW = "swarm:add-new";
const RESTORE = "swarm:restore";

/**
 * The heading for a group of wallets on one chain.
 *
 * `chainDisplayName` knows the chains this build ships; anything else gets its
 * own name rather than vanishing. That fallback is the point. This control used
 * to hard-code three groups — mainnet, testnet, regtest — and a wallet on any
 * other chain matched none of them, so it was not listed at all. With one
 * SWARM wallet the select rendered zero options: the owner clicked it and
 * nothing happened, because there was nothing in it.
 */
const groupLabel = (chain: string): string => (Utils.chainDisplayName(chain) || chain).toUpperCase();

const SelectWallet = ({ navigateToLoadingScreenChangingWallet }: SelectWalletProps) => {
  const context = useContext(ContextApp);
  const { currentWallet, wallets, openErrorModal } = context;
  const navigate = useNavigate();

  if (currentWallet === null) return null;

  // Sorted by chain then by id, and grouped in that order, so the headings come
  // out stable and a wallet always lands under the chain it is actually on.
  const walletsSorted = [...wallets].sort((a, b) => {
    const chainCmp = a.chain_name.localeCompare(b.chain_name);
    return chainCmp !== 0 ? chainCmp : a.id - b.id;
  });
  const chains: string[] = [];
  for (const wallet of walletsSorted) {
    if (!chains.includes(wallet.chain_name)) chains.push(wallet.chain_name);
  }

  const onChange = async (value: string) => {
    if (value === ADD_NEW) {
      navigate(routes.ADDNEWWALLET, { state: { mode: "addnew" } });
      return;
    }
    if (value === RESTORE) {
      // The same screen: its "Type of Wallet creation" picker is where seed,
      // viewing key and file live, so restoring is that screen with the user
      // one choice further in rather than a second screen saying the same.
      navigate(routes.ADDNEWWALLET, { state: { mode: "addnew", restore: true } });
      return;
    }
    const id = Number(value);
    if (!Number.isFinite(id) || id === currentWallet.id) return;
    openErrorModal("Change Wallet", "Opening the new active Wallet selected");
    await ipcRenderer.invoke("saveSettings", { key: "currentwalletid", value: id });
    navigateToLoadingScreenChangingWallet();
  };

  return (
    <select
      className={cstyles.fieldselect}
      aria-label="Wallet"
      value={currentWallet.id}
      onChange={(e) => void onChange(e.target.value)}
    >
      {chains.map((chain) => (
        <optgroup key={chain} label={groupLabel(chain)}>
          {walletsSorted
            .filter((w: WalletType) => w.chain_name === chain)
            .map((w: WalletType) => (
              <option key={w.id} value={w.id}>
                {w.alias + " - [" + w.creationType + "]" + (w.id === currentWallet.id ? " ✔" : "")}
              </option>
            ))}
        </optgroup>
      ))}
      <optgroup label="MORE">
        <option value={ADD_NEW}>Add a new wallet…</option>
        <option value={RESTORE}>Restore a wallet…</option>
      </optgroup>
    </select>
  );
};

export default SelectWallet;
