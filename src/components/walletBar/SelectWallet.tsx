import React, { useContext } from "react";
import { useNavigate } from "react-router-dom";
import cstyles from "../common/Common.module.css";
import { ContextApp } from "../../context/ContextAppState";
import { WalletType } from "../appstate";
import { ADD_NEW, RESTORE, chooseWallet, groupWallets } from "./walletSwitching";

type SelectWalletProps = {
  navigateToLoadingScreenChangingWallet: () => void;
};

/**
 * The wallet bar's switcher.
 *
 * The listing rule and the switch itself live in `walletSwitching`, shared
 * with the SWARM rail's menu, so the two controls cannot disagree about which
 * wallets exist — which is how this one came to render zero options on a chain
 * it had not been told about.
 */
const SelectWallet = ({ navigateToLoadingScreenChangingWallet }: SelectWalletProps) => {
  const context = useContext(ContextApp);
  const { currentWallet, wallets, openErrorModal } = context;
  const navigate = useNavigate();

  if (currentWallet === null) return null;

  const groups = groupWallets(wallets);

  const onChange = (value: string) =>
    chooseWallet(value, {
      currentWalletId: currentWallet.id,
      navigate,
      openErrorModal,
      reopenWallet: navigateToLoadingScreenChangingWallet,
    });

  return (
    <select
      className={cstyles.fieldselect}
      aria-label="Wallet"
      value={currentWallet.id}
      onChange={(e) => void onChange(e.target.value)}
    >
      {groups.map((group) => (
        <optgroup key={group.chain} label={group.label}>
          {group.wallets.map((w: WalletType) => (
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
