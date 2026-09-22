import React, { useContext, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import styles from "./Swarm.module.css";
import menuStyles from "./SwarmWalletMenu.module.css";
import { ContextApp } from "../../context/ContextAppState";
import { ADD_NEW, RESTORE, chooseWallet, groupWallets } from "../walletBar/walletSwitching";

/**
 * Which wallet is open, and the way to open a different one.
 *
 * The control this replaces was a `<select>` whose options were built from
 * three hard-coded chain groups — mainnet, testnet, regtest. A wallet on this
 * project's chain matched none of them, so the element rendered with no
 * options at all: it opened, showed nothing, and closed again. That is defect
 * W-4, and the owner reported it as "this button is not working. As well there
 * is no way to switch in between those wallets."
 *
 * The listing rule and the switch are not this file's: they live in
 * `walletBar/walletSwitching`, shared with the `<select>` in the wallet bar,
 * so the two controls cannot disagree about which wallets exist. What is this
 * file's is the presentation — a menu that is useful with one wallet, showing
 * that wallet plus the two things you might want to do next.
 */

type SwarmWalletMenuProps = {
  /** Reopens the app against whichever wallet id was just recorded. */
  reopenWallet: () => void;
};

export const SwarmWalletMenu: React.FC<SwarmWalletMenuProps> = ({ reopenWallet }) => {
  const navigate = useNavigate();
  const { currentWallet, wallets, openErrorModal } = useContext(ContextApp);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // A menu that stays open after you have clicked past it is a menu in the
  // way. Pointer-down rather than click, so it closes before whatever was
  // underneath reacts.
  useEffect(() => {
    if (!open) return undefined;
    const onAway = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onAway);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onAway);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const activeId = currentWallet?.id;
  const groups = groupWallets(wallets ?? []);

  const choose = async (value: string) => {
    if (busy) return;
    setBusy(true);
    try {
      setOpen(false);
      await chooseWallet(value, {
        currentWalletId: activeId,
        navigate,
        openErrorModal,
        reopenWallet,
      });
    } catch (error) {
      openErrorModal("Switch wallet", `That wallet could not be opened. ${String(error)}`);
    } finally {
      setBusy(false);
    }
  };

  const name = currentWallet?.alias || currentWallet?.fileName || "No wallet";

  return (
    <div className={menuStyles.root} ref={rootRef}>
      <button
        type="button"
        className={menuStyles.trigger}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span className={menuStyles.triggerText}>
          <span className={menuStyles.triggerKicker}>WALLET</span>
          <span className={menuStyles.triggerName}>{name}</span>
        </span>
        <span className={menuStyles.chevron} aria-hidden="true">
          ▾
        </span>
      </button>

      {open && (
        <div className={menuStyles.menu} role="menu" aria-label="Wallets">
          {groups.length === 0 && <div className={menuStyles.groupEmpty}>No wallets yet</div>}

          {groups.map((group) => (
            <div key={group.chain}>
              {/* The chain heading earns its place only when there is more than
                  one: on this network every wallet is on SWARM Testnet, and a
                  heading that is true of every row below it is noise. */}
              {groups.length > 1 && <div className={menuStyles.groupLabel}>{group.label}</div>}
              {group.wallets.map((w) => (
                <button
                  key={w.id}
                  type="button"
                  role="menuitemradio"
                  aria-checked={w.id === activeId}
                  className={`${menuStyles.item} ${w.id === activeId ? menuStyles.itemActive : ""}`}
                  onClick={() => void choose(String(w.id))}
                  disabled={busy}
                >
                  <span className={menuStyles.tick} aria-hidden="true">
                    {w.id === activeId ? "✓" : ""}
                  </span>
                  <span className={menuStyles.itemMain}>
                    <span className={menuStyles.itemName}>{w.alias || w.fileName}</span>
                    <span className={menuStyles.itemNote}>{w.creationType}</span>
                  </span>
                </button>
              ))}
            </div>
          ))}

          <div className={menuStyles.sep} />
          <button type="button" role="menuitem" className={menuStyles.item} onClick={() => void choose(ADD_NEW)}>
            <span className={menuStyles.tick} aria-hidden="true">
              +
            </span>
            <span className={menuStyles.itemMain}>
              <span className={menuStyles.itemName}>Add a new wallet…</span>
            </span>
          </button>
          <button type="button" role="menuitem" className={menuStyles.item} onClick={() => void choose(RESTORE)}>
            <span className={menuStyles.tick} aria-hidden="true">
              ↺
            </span>
            <span className={menuStyles.itemMain}>
              <span className={menuStyles.itemName}>Restore a wallet…</span>
            </span>
          </button>
        </div>
      )}
      <span className={styles.srOnly} aria-live="polite">
        {busy ? "Opening wallet" : ""}
      </span>
    </div>
  );
};

export default SwarmWalletMenu;
