import React, { useContext } from "react";
import { useNavigate } from "react-router-dom";
import styles from "../Swarm.module.css";
import { SwarmIcon } from "../SwarmIcons";
import { serverHost } from "../swarmStatus";
import { ContextApp } from "../../../context/ContextAppState";
import routes from "../../../constants/routes.json";
import APP_VERSION, { UPSTREAM_VERSION } from "../../../version";
import { SWARM_NETWORK_LABEL, SWARM_TICKER } from "../../../utils/swarmNetwork";

/**
 * Settings, gathered from the places the old app kept them — a native menu,
 * a sidebar button, and three modals.
 *
 * This is the first pass: it states what is true of the running wallet and
 * routes to the existing screens that change it. The editable rows arrive with
 * the rest of Settings.
 */
export const SettingsScreen: React.FC = () => {
  const navigate = useNavigate();
  const { info, currentWallet, readOnly, birthday } = useContext(ContextApp);

  const rows: { title: string; rows: { k: string; d: string; v: string }[]; icon: "globe" | "lock" | "key" }[] = [
    {
      title: "Network",
      icon: "globe",
      rows: [
        { k: "Network", d: "The chain this wallet is on", v: SWARM_NETWORK_LABEL },
        { k: "Server", d: "The indexer this wallet talks to", v: serverHost(info.serverUri) || "not set" },
        { k: "Block height", d: "Last height the server reported", v: info.latestBlock ? `#${info.latestBlock}` : "—" },
        { k: "Coin", d: "What balances are counted in", v: SWARM_TICKER },
      ],
    },
    {
      title: "Wallet",
      icon: "key",
      rows: [
        { k: "Name", d: "A local label only", v: currentWallet?.alias ?? "—" },
        { k: "Created", d: "How this wallet was made", v: currentWallet?.creationType ?? "—" },
        { k: "Birthday", d: "The height it starts scanning from", v: birthday ? `#${birthday}` : "—" },
        { k: "Mode", d: "Whether it can spend", v: readOnly ? "Watch-only" : "Can send" },
      ],
    },
    {
      title: "About",
      icon: "lock",
      rows: [
        { k: "SWARM Wallet", d: "This application", v: APP_VERSION },
        { k: "Built on", d: "Upstream release this fork tracks", v: UPSTREAM_VERSION },
      ],
    },
  ];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, alignContent: "start" }}>
      {rows.map((group) => (
        <section key={group.title} className={styles.panel}>
          <div className={styles.panelHead}>
            <span style={{ color: "var(--swarm-orange)", display: "flex" }}>
              <SwarmIcon name={group.icon} />
            </span>
            <div className={styles.panelTitle} style={{ flex: 1 }}>
              {group.title}
            </div>
          </div>
          <div className={styles.panelBody}>
            {group.rows.map((r) => (
              <div key={r.k} className={styles.rowItem} style={{ cursor: "default" }}>
                <span className={styles.rowMain}>
                  <span className={styles.rowTitle}>{r.k}</span>
                  <span className={styles.statNote}>{r.d}</span>
                </span>
                <span className={`${styles.mono} ${styles.muted}`} style={{ fontSize: 12 }}>
                  {r.v}
                </span>
              </div>
            ))}
          </div>
        </section>
      ))}

      <section className={styles.panel}>
        <div className={styles.panelHead}>
          <div className={styles.panelTitle}>Wallets</div>
        </div>
        <div className={styles.panelPad}>
          <div className={styles.statNote}>
            Add another wallet, or restore one from its recovery phrase. Switching between wallets is in the menu at the
            top of the rail.
          </div>
          <button
            type="button"
            className={styles.btn}
            onClick={() => navigate(routes.ADDNEWWALLET, { state: { mode: "addnew", newWalletType: "new" } })}
          >
            Add a new wallet…
          </button>
          <button
            type="button"
            className={styles.btn}
            onClick={() => navigate(routes.ADDNEWWALLET, { state: { mode: "addnew", newWalletType: "seed" } })}
          >
            Restore a wallet…
          </button>
        </div>
      </section>
    </div>
  );
};

export default SettingsScreen;
