import React, { ReactNode, useCallback, useMemo, useState } from "react";

/**
 * The bits of UI state that belong to the window rather than to the wallet.
 *
 * "Hide balances" is the whole reason this exists: it has to hold while the
 * user moves between Overview, Send and Activity, and it must never be
 * persisted — it is a "someone is looking over my shoulder" switch, not a
 * preference, and a wallet that reopened with the balances still hidden would
 * be hiding them from the person who owns them.
 */

export type SwarmUiState = {
  hidden: boolean;
  toggleHidden: () => void;
};

export const SwarmUiContext = React.createContext<SwarmUiState>({
  hidden: false,
  toggleHidden: () => {},
});

export const SwarmUiProvider = ({ children }: { children: ReactNode }) => {
  const [hidden, setHidden] = useState(false);
  const toggleHidden = useCallback(() => setHidden((h) => !h), []);
  const value = useMemo(() => ({ hidden, toggleHidden }), [hidden, toggleHidden]);
  return <SwarmUiContext.Provider value={value}>{children}</SwarmUiContext.Provider>;
};

export default SwarmUiContext;
