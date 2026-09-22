import React from "react";
import styles from "./Swarm.module.css";
import { SwarmIcon } from "./SwarmIcons";
import { SwarmProblem as Problem } from "./swarmStatus";

type SwarmProblemBarProps = {
  problem: Problem | null;
  /** Runs the same refresh the app would do on its own, sooner. */
  onRetry?: () => void;
  retrying?: boolean;
};

/**
 * A failure, shown the way a failure should be: a sentence, an action, and the
 * original text one click away.
 *
 * The expander is a plain `<details>` so it is keyboard-operable and
 * announced as a disclosure without any of it being re-implemented, and the
 * raw text inside is never edited — a person reporting a bug has to be able to
 * copy exactly what the wallet said.
 */
export const SwarmProblemBar: React.FC<SwarmProblemBarProps> = ({ problem, onRetry, retrying }) => {
  if (!problem) return null;

  return (
    <div className={styles.problem} role="status" aria-live="polite">
      <span className={styles.problemIcon}>
        <SwarmIcon name="warning" size={18} />
      </span>
      <div className={styles.problemBody}>
        <div className={styles.problemHeadline}>{problem.headline}</div>
        <div className={styles.problemText}>{problem.body}</div>
        {/* The role is stated rather than left implicit: `details` only
            maps to `group` in newer ARIA-in-HTML, and a screen reader that
            has not caught up would announce this as nothing at all. */}
        <details className={styles.details} role="group" aria-label="Technical details">
          <summary className={styles.detailsSummary}>Technical details</summary>
          <pre className={styles.detailsBody}>{problem.technical}</pre>
        </details>
      </div>
      {problem.retryable && onRetry && (
        <div className={styles.problemActions}>
          <button type="button" className={`${styles.btn} ${styles.btnSmall}`} onClick={onRetry} disabled={retrying}>
            {retrying ? "Retrying…" : "Retry"}
          </button>
        </div>
      )}
    </div>
  );
};

export default SwarmProblemBar;
