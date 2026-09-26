import React, { ReactNode, useContext, useState } from "react";
import { useLocation } from "react-router-dom";
import styles from "../Swarm.module.css";
import { SwarmIcon } from "../SwarmIcons";
import SwarmMark from "../../logo/SwarmMark";
import { ContextApp } from "../../../context/ContextAppState";
import { SWARM_COINS_ARE_TEST_COINS, SWARM_NETWORK_LABEL, SWARM_TICKER } from "../../../utils/swarmNetwork";

/**
 * The first thing someone sees, and the frame around making a wallet.
 *
 * The mockup's onboarding is seven phone screens. Four of them — the recovery
 * phrase, verifying it, the passcode, and "ready" — are steps this desktop
 * application does not have as screens: zingolib generates the phrase during
 * creation and the wallet menu shows it afterwards, and the device's own
 * authentication stands in for a passcode. Reimplementing them here would mean
 * rewriting wallet creation, which is the one flow in this application where a
 * presentation change must not go.
 *
 * So what this adds is the part that was genuinely missing: a welcome that
 * says what this is, a choice between creating and restoring that actually
 * lands in the right place, and the warning about the recovery phrase *before*
 * the phrase exists rather than after.
 *
 * Nothing here ever touches a recovery phrase. It is not displayed, not held,
 * not logged, and not pre-filled — the form below owns that, as it did.
 */

type OnboardingScreenProps = {
  /** The application's own create/restore form. */
  children: ReactNode;
};

const STEPS = [
  { n: 1, label: "WELCOME" },
  { n: 2, label: "NAME & NETWORK" },
  { n: 3, label: "RECOVERY PHRASE" },
  { n: 4, label: "READY" },
];

export const OnboardingScreen: React.FC<OnboardingScreenProps> = ({ children }) => {
  const location = useLocation();
  const { wallets, currentWallet } = useContext(ContextApp);

  const state = (location.state ?? {}) as { restore?: boolean };
  const firstRun = (wallets?.length ?? 0) === 0 && !currentWallet?.id;

  // The welcome is shown to someone who has no wallet at all. A user who came
  // here from the rail's menu has already made their choice, and a screen
  // asking it again would be a step backwards.
  const [welcomed, setWelcomed] = useState(!firstRun);
  const restoring = state.restore === true;

  if (!welcomed) {
    return (
      <div className={styles.onboardWrap}>
        <div className={styles.onboardCard}>
          <div className={styles.onboardBee} aria-hidden="true">
            <SwarmMark size={72} animated />
          </div>
          <div className={styles.kicker}>{SWARM_NETWORK_LABEL}</div>
          <h2 className={styles.onboardTitle}>Private money, on your computer.</h2>
          <p className={styles.onboardBody}>
            SWARM shields every payment by default. Nobody can see your balance or who you pay — not the server this
            wallet talks to, and not anyone reading the chain.
          </p>
          {/*
            Two networks, two different true sentences. Telling someone on
            SWARM Mainnet that their coins "have no market and no value" would
            be false about their money, and telling someone on the testnet the
            opposite would be worse. The sentence follows the build's network.
          */}
          {SWARM_COINS_ARE_TEST_COINS ? (
            <p className={styles.onboardBody}>
              These are test coins. {SWARM_TICKER} on {SWARM_NETWORK_LABEL} has no market and no value; it is here so
              the network can be tried before it carries anything real.
            </p>
          ) : (
            <p className={styles.onboardBody}>
              This is the live network. {SWARM_TICKER} on {SWARM_NETWORK_LABEL} is real: a payment cannot be reversed,
              and the recovery phrase below is the only way back to it.
            </p>
          )}

          <div className={styles.onboardWarn}>
            <span className={styles.problemIcon}>
              <SwarmIcon name="key" size={18} />
            </span>
            <div>
              <strong>Before you start: have a pen and paper.</strong> Creating a wallet produces a recovery phrase.
              Written on paper it is the only way back to your coins if this computer is lost. Typed into a phone, a
              password manager or a chat window, it is the only way someone else gets to them.
            </div>
          </div>

          <div className={styles.onboardActions}>
            <button
              type="button"
              className={`${styles.btn} ${styles.btnPrimary} ${styles.btnWide}`}
              onClick={() => setWelcomed(true)}
            >
              Create a new wallet
            </button>
            <button type="button" className={`${styles.btn} ${styles.btnWide}`} onClick={() => setWelcomed(true)}>
              I already have a recovery phrase
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.onboardFrame}>
      <div className={styles.onboardHead}>
        <div className={styles.brand}>
          <SwarmMark size={26} />
          <div className={styles.brandName}>SWARM</div>
        </div>
        <div>
          <div className={styles.kicker}>{restoring ? "RESTORE A WALLET" : "NEW WALLET"}</div>
          <div className={styles.screenTitle}>{restoring ? "Restore from your phrase" : "Create a wallet"}</div>
        </div>
        <ol className={styles.stepRail} aria-label="Steps">
          {STEPS.map((s, i) => (
            <li key={s.n} className={`${styles.step} ${i === 1 ? styles.stepActive : ""}`}>
              <span className={styles.stepDot}>{s.n}</span>
              {s.label}
            </li>
          ))}
        </ol>
      </div>

      <div className={styles.onboardNote}>
        <SwarmIcon name="key" size={14} />
        {restoring
          ? "Type your phrase exactly as you wrote it down. It is never sent anywhere — the wallet is rebuilt from it on this computer."
          : "The recovery phrase appears once the wallet is made. Write it on paper before you do anything else."}
      </div>

      <div className={styles.onboardForm}>{children}</div>
    </div>
  );
};

export default OnboardingScreen;
