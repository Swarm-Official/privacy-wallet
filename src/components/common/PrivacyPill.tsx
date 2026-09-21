import React from "react";
import cstyles from "./Common.module.css";

/**
 * The privacy of something, as a state pill (style guide, section 07).
 *
 * The verdicts are the wallet's own — `Private`, `Amount Revealed`,
 * `Deshielded`, computed in SendConfirmModal from the pools the transaction
 * actually draws on and the kind of address it pays. Nothing is invented here:
 * this only decides which pill says them.
 *
 * Shielded wears the brand colour, because private is what this wallet looks
 * like. Anything less wears Clear Blue, which appears nowhere else — a
 * revealed transaction must not be able to look like a normal one.
 */
export const SHIELDED = "Private";

export type PrivacyPillProps = {
  /** The wallet's verdict. `-` or `…` mean it has not reached one. */
  level: string;
};

const PrivacyPill: React.FC<PrivacyPillProps> = ({ level }) => {
  if (!level || level === "-" || level === "…") {
    return <span className={cstyles.sublight}>{level || "-"}</span>;
  }
  const shielded = level === SHIELDED;
  // The pill says what the wallet says. The style guide's mockup labels its
  // pills SHIELDED and REVEALED, but those are a mockup's words: "Amount
  // Revealed" and "Deshielded" are the verdicts this wallet actually reaches,
  // they are more specific, and the colour already carries the state. What is
  // adopted here is the pill — its shape, its dot, and orange against Clear
  // Blue — not a vaguer label than the one the user can be given.
  return (
    <span
      className={shielded ? cstyles.pillshielded : cstyles.pillrevealed}
      data-testid="privacy-pill"
      data-state={shielded ? "shielded" : "revealed"}
    >
      {level}
    </span>
  );
};

export default PrivacyPill;
