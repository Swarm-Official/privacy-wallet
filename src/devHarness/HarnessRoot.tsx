import React, { useMemo } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ContextAppProvider } from "../context/ContextAppState";
import { SwarmShell } from "../components/swarm/SwarmShell";
import { SwarmUiProvider } from "../components/swarm/SwarmUiContext";
import { OverviewScreen } from "../components/swarm/screens/OverviewScreen";
import { SettingsScreen } from "../components/swarm/screens/SettingsScreen";
import routes from "../constants/routes.json";
import { scenarioById } from "./mockAppState";

/**
 * The SWARM screens, rendered against invented state.
 *
 * Driven entirely by the query string so a screenshot run can ask for one
 * screen in one state without clicking anything:
 *
 *   ?screen=overview&scenario=offline&hidden=1
 *
 * There is no wallet behind this, no keychain, no native module and no
 * network. That is the point: every picture in the review folder was taken
 * from here.
 */

const SCREENS: Record<string, React.FC> = {
  overview: OverviewScreen,
  settings: SettingsScreen,
};

export const HarnessRoot: React.FC = () => {
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const screen = params.get("screen") ?? "overview";
  const scenario = scenarioById(params.get("scenario") ?? "synced");
  const startHidden = params.get("hidden") === "1";

  const route = screen === "settings" ? routes.SETTINGS : routes.DASHBOARD;
  const Screen = SCREENS[screen] ?? OverviewScreen;

  return (
    <ContextAppProvider value={scenario.state}>
      <MemoryRouter initialEntries={[route]}>
        <SwarmUiProvider>
          <HiddenPrimer hidden={startHidden} />
          <SwarmShell onRetry={() => undefined}>
            <Routes>
              <Route path={route} element={<Screen />} />
            </Routes>
          </SwarmShell>
        </SwarmUiProvider>
      </MemoryRouter>
    </ContextAppProvider>
  );
};

/**
 * Clicks "Hide balances" once, on mount, when the URL asked for it.
 *
 * The switch is deliberately not persisted (see SwarmUiContext), so a
 * screenshot of the hidden state has to arrive at it the same way a person
 * does — by pressing the button.
 */
const HiddenPrimer: React.FC<{ hidden: boolean }> = ({ hidden }) => {
  React.useEffect(() => {
    if (!hidden) return;
    const button = Array.from(document.querySelectorAll("button")).find((b) =>
      (b.textContent ?? "").includes("Hide balances"),
    );
    button?.click();
  }, [hidden]);
  return null;
};

export default HarnessRoot;
