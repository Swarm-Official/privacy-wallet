import React from "react";
import { fireEvent, waitFor } from "@testing-library/react";
import { render, screen } from "../../test-utils";
import { ipcRenderer } from "../../electronBridge";
import SelectWallet from "./SelectWallet";
import {
  WalletType,
  ServerChainNameEnum,
  CreationTypeEnum,
  PerformanceLevelEnum,
  ServerSelectionEnum,
} from "../appstate";

jest.mock("../../electronBridge");

const makeWallet = (id: number, alias: string, chain_name: ServerChainNameEnum): WalletType => ({
  id,
  alias,
  chain_name,
  uri: "https://server",
  fileName: "wallet.dat",
  creationType: CreationTypeEnum.Seed,
  performanceLevel: PerformanceLevelEnum.High,
  selection: ServerSelectionEnum.auto,
});

const currentWallet = makeWallet(1, "Main wallet", ServerChainNameEnum.mainChainName);

describe("SelectWallet", () => {
  it("renders no select when currentWallet is null", () => {
    render(<SelectWallet navigateToLoadingScreenChangingWallet={jest.fn()} />, {
      contextOverrides: { currentWallet: null },
    });
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("renders a select dropdown when currentWallet is set", () => {
    render(<SelectWallet navigateToLoadingScreenChangingWallet={jest.fn()} />, {
      contextOverrides: { currentWallet, wallets: [currentWallet] },
    });
    expect(screen.getByRole("combobox")).toBeInTheDocument();
  });

  it("shows a MAINNET optgroup with the wallet alias", () => {
    render(<SelectWallet navigateToLoadingScreenChangingWallet={jest.fn()} />, {
      contextOverrides: { currentWallet, wallets: [currentWallet] },
    });
    expect(screen.getByRole("option", { name: /main wallet/i })).toBeInTheDocument();
  });

  it("shows wallets from multiple chains in their respective optgroups", () => {
    const testWallet = makeWallet(2, "Test wallet", ServerChainNameEnum.testChainName);
    render(<SelectWallet navigateToLoadingScreenChangingWallet={jest.fn()} />, {
      contextOverrides: { currentWallet, wallets: [currentWallet, testWallet] },
    });
    expect(screen.getByRole("option", { name: /main wallet/i })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /test wallet/i })).toBeInTheDocument();
  });
});

// Defect W-4. The groups were hard-coded — mainnet, testnet, regtest — so a
// wallet on any other chain matched none of them and was not listed. With one
// SWARM wallet the control rendered zero options: the owner clicked it and
// nothing happened, because there was nothing in it to open.
describe("SelectWallet on the project chain", () => {
  const swarm = (id: number, alias: string) => makeWallet(id, alias, ServerChainNameEnum.swarmTestnetChainName);

  it("lists a lone SWARM wallet, under its own heading, ticked", () => {
    const only = swarm(1, "My SWARM wallet");
    render(<SelectWallet navigateToLoadingScreenChangingWallet={jest.fn()} />, {
      contextOverrides: { currentWallet: only, wallets: [only] },
    });

    const option = screen.getByRole("option", { name: /My SWARM wallet/ });
    expect(option).toBeInTheDocument();
    expect(option.textContent).toContain("✔");
    expect(screen.getByRole("combobox").querySelector('optgroup[label="SWARM TESTNET"]')).not.toBeNull();
  });

  it("lists three wallets and ticks only the open one", () => {
    const [one, two, three] = [swarm(1, "Mining"), swarm(2, "Spending"), swarm(3, "Cold")];
    render(<SelectWallet navigateToLoadingScreenChangingWallet={jest.fn()} />, {
      contextOverrides: { currentWallet: two, wallets: [one, two, three] },
    });

    for (const alias of ["Mining", "Spending", "Cold"]) {
      expect(screen.getByRole("option", { name: new RegExp(alias) })).toBeInTheDocument();
    }
    const ticked = screen.getAllByRole("option").filter((o) => o.textContent?.includes("✔"));
    expect(ticked).toHaveLength(1);
    expect(ticked[0].textContent).toContain("Spending");
  });

  it("switches to the wallet that was picked", async () => {
    const [one, two] = [swarm(1, "Mining"), swarm(2, "Spending")];
    const navigateToLoadingScreenChangingWallet = jest.fn();
    render(<SelectWallet navigateToLoadingScreenChangingWallet={navigateToLoadingScreenChangingWallet} />, {
      contextOverrides: { currentWallet: one, wallets: [one, two] },
    });

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "2" } });

    await waitFor(() =>
      expect(ipcRenderer.invoke).toHaveBeenCalledWith("saveSettings", { key: "currentwalletid", value: 2 }),
    );
    expect(navigateToLoadingScreenChangingWallet).toHaveBeenCalled();
  });

  // The list is also the way to a second wallet: the only other route in this
  // build is the menu bar, and the Dashboard's button appears only when there
  // are no wallets at all.
  it("offers adding and restoring a wallet, and opens that screen instead of switching", async () => {
    const only = swarm(1, "Mining");
    const navigateToLoadingScreenChangingWallet = jest.fn();
    render(<SelectWallet navigateToLoadingScreenChangingWallet={navigateToLoadingScreenChangingWallet} />, {
      contextOverrides: { currentWallet: only, wallets: [only] },
    });

    expect(screen.getByRole("option", { name: /Add a new wallet/ })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Restore a wallet/ })).toBeInTheDocument();

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "swarm:add-new" } });

    expect(navigateToLoadingScreenChangingWallet).not.toHaveBeenCalled();
    expect(ipcRenderer.invoke).not.toHaveBeenCalledWith(
      "saveSettings",
      expect.objectContaining({ key: "currentwalletid" }),
    );
  });

  // A chain this build has never heard of still has to appear, or the control
  // goes empty again the next time a network is added.
  it("gives a chain it does not know a heading of its own rather than dropping it", () => {
    const stranger = makeWallet(9, "Future net", "some-future-net" as ServerChainNameEnum);
    render(<SelectWallet navigateToLoadingScreenChangingWallet={jest.fn()} />, {
      contextOverrides: { currentWallet: stranger, wallets: [stranger] },
    });

    expect(screen.getByRole("option", { name: /Future net/ })).toBeInTheDocument();
    expect(screen.getByRole("combobox").querySelector('optgroup[label="SOME-FUTURE-NET"]')).not.toBeNull();
  });
});
