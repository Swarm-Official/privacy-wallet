import React from "react";

/**
 * The things a screen can ask the application to do that are not wallet state.
 *
 * Every one of these already existed and was reachable only from the native
 * menu, which is where a user looks last and a new user never looks. Settings
 * is where a person goes to change how the application behaves, so the same
 * actions are offered there too — the same calls, from a second place.
 *
 * Provided by `Routes`, which owns the modals and the RPC handle. Defaults do
 * nothing, so a screen rendered outside the application (the review harness)
 * renders its buttons rather than crashing on them.
 */
export type SwarmActions = {
  /** Device-authentication settings (Windows Hello / Touch ID). */
  openSecurity: () => void;
  /** Pick a folder and offer to import another installation's data. */
  openImport: () => void;
  /** Re-read the chain from the wallet's birthday. Asks for confirmation. */
  rescan: () => void;
  /** Re-run the ordinary sync now. */
  retrySync: () => void;
};

export const SwarmActionsContext = React.createContext<SwarmActions>({
  openSecurity: () => {},
  openImport: () => {},
  rescan: () => {},
  retrySync: () => {},
});

export default SwarmActionsContext;
