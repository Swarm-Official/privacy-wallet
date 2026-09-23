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

// The code lock, added because the owner reported there was no way to sign out
// or lock the wallet once it was open. These assert the two halves of that:
// the code screen asks for a code and the comparison happens in the main
// process, and signing out is reachable even from a locked wallet, because
// that is the only way out of a code nobody remembers.
const LockScreenWithMode = LockScreen as unknown as React.FC<{
  onUnlock: () => void;
  mode?: "code" | "device";
  onSignOut?: () => void;
}>;

describe("the lock screen with a code", () => {
  it("asks for the code, and says what the code protects and what it does not", () => {
    render(<LockScreenWithMode onUnlock={jest.fn()} mode="code" />);

    expect(screen.getByText("Enter your code to use this wallet.")).toBeInTheDocument();
    expect(screen.getByLabelText("Lock code")).toBeInTheDocument();
    expect(screen.queryByText(/Device authentication is required/)).toBeNull();
    expect(screen.getByText(/does not encrypt the wallet file/)).toBeInTheDocument();
  });

  it("sends the code to the main process, which is the only place it is compared", async () => {
    invoke.mockResolvedValue({ ok: true });
    const onUnlock = jest.fn();
    render(<LockScreenWithMode onUnlock={onUnlock} mode="code" />);

    fireEvent.change(screen.getByLabelText("Lock code"), { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: "Unlock" }));

    await waitFor(() => expect(invoke).toHaveBeenCalledWith("lock:verify", "123456"));
    await waitFor(() => expect(onUnlock).toHaveBeenCalled());
  });

  it("stays locked, repeats what main said, and clears the field when the code is wrong", async () => {
    invoke.mockResolvedValue({ ok: false, reason: "Wrong code. 4 tries left." });
    const onUnlock = jest.fn();
    render(<LockScreenWithMode onUnlock={onUnlock} mode="code" />);

    fireEvent.change(screen.getByLabelText("Lock code"), { target: { value: "000000" } });
    fireEvent.click(screen.getByRole("button", { name: "Unlock" }));

    expect(await screen.findByText("Wrong code. 4 tries left.")).toBeInTheDocument();
    expect(onUnlock).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Lock code")).toHaveValue("");
  });

  it("does not ask main anything when nothing was typed", async () => {
    render(<LockScreenWithMode onUnlock={jest.fn()} mode="code" />);

    fireEvent.click(screen.getByRole("button", { name: "Unlock" }));

    expect(await screen.findByText("Enter your code.")).toBeInTheDocument();
    expect(invoke).not.toHaveBeenCalled();
  });

  it("offers signing out from the locked screen, which is the way out of a forgotten code", () => {
    const onSignOut = jest.fn();
    render(<LockScreenWithMode onUnlock={jest.fn()} mode="code" onSignOut={onSignOut} />);

    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));

    expect(onSignOut).toHaveBeenCalledTimes(1);
  });

  it("keeps the device-authentication path working when no code is set", async () => {
    invoke.mockResolvedValue({ success: true });
    const onUnlock = jest.fn();
    render(<LockScreenWithMode onUnlock={onUnlock} mode="device" />);

    fireEvent.click(screen.getByRole("button", { name: "Unlock" }));

    await waitFor(() => expect(invoke).toHaveBeenCalledWith("auth:verify", `Unlock ${SWARM_APP_NAME}`));
    await waitFor(() => expect(onUnlock).toHaveBeenCalled());
  });
});

