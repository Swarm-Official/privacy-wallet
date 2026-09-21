import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import APP_VERSION from "../../version";
import { SWARM_APP_NAME } from "../../utils/swarmNetwork";

// The unlock screen is the first thing a user sees and the last thing anyone
// looked at: build ec77dc96 shipped saying "Zingo PC is locked" under a window
// titled "SWARM Wallet (Testnet)". These assert what is on it.
//
// LockScreen destructures `window.electronAPI` as its module loads — the
// preload provides it in the real application — so the stub has to be in place
// before the module is required, which a static import would be too late for.
const invoke = jest.fn();
Object.defineProperty(window, "electronAPI", {
  value: { ipcRenderer: { invoke } },
  writable: true,
});
// eslint-disable-next-line @typescript-eslint/no-require-imports
const LockScreen = require("./LockScreen").default as React.FC<{ onUnlock: () => void }>;

beforeEach(() => {
  invoke.mockReset().mockResolvedValue({ success: true });
});

describe("the unlock screen", () => {
  it("names this application, not the one it is built on", () => {
    render(<LockScreen onUnlock={jest.fn()} />);

    expect(screen.getByText(`${SWARM_APP_NAME} is locked`)).toBeInTheDocument();
    expect(screen.queryByText(/Zingo/)).toBeNull();
  });

  // Upstream's release number says nothing about which SWARM build is running.
  it("shows this build's version, not upstream's", () => {
    render(<LockScreen onUnlock={jest.fn()} />);

    expect(screen.getByText(`v${APP_VERSION}`)).toBeInTheDocument();
    expect(screen.queryByText(/2\.0\.26/)).toBeNull();
  });

  // The reason travels to Windows Hello and is shown in the system prompt, so
  // it names the application the user is unlocking.
  it("asks the operating system to unlock this application by name", async () => {
    render(<LockScreen onUnlock={jest.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Unlock" }));

    await waitFor(() => expect(invoke).toHaveBeenCalledWith("auth:verify", `Unlock ${SWARM_APP_NAME}`));
  });

  it("unlocks when the device authentication succeeds", async () => {
    const onUnlock = jest.fn();
    render(<LockScreen onUnlock={onUnlock} />);

    fireEvent.click(screen.getByRole("button", { name: "Unlock" }));

    await waitFor(() => expect(onUnlock).toHaveBeenCalled());
  });

  it("stays locked, and says so, when it does not", async () => {
    invoke.mockResolvedValue({ success: false });
    const onUnlock = jest.fn();
    render(<LockScreen onUnlock={onUnlock} />);

    fireEvent.click(screen.getByRole("button", { name: "Unlock" }));

    expect(await screen.findByText(/Authentication was not completed/)).toBeInTheDocument();
    expect(onUnlock).not.toHaveBeenCalled();
  });
});
