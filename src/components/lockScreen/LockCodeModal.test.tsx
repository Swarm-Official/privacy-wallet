import React from "react";
import { fireEvent, render, screen, waitFor } from "../../test-utils";

const mockInvoke = jest.fn();

Object.defineProperty(window, "electronAPI", {
  configurable: true,
  writable: true,
  value: { ipcRenderer: { invoke: mockInvoke } },
});

beforeAll(() => {
  const div = document.createElement("div");
  div.setAttribute("id", "root");
  document.body.appendChild(div);
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require("react-modal").setAppElement("#root");
});

// eslint-disable-next-line @typescript-eslint/no-require-imports
const LockCodeModal = require("./LockCodeModal").default;

describe("LockCodeModal", () => {
  beforeEach(() => {
    mockInvoke.mockReset();
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === "lock:status") return Promise.resolve({ hasCode: false, minLength: 6, maxLength: 12 });
      return Promise.resolve({ ok: true });
    });
  });

  it("says what the code does and does not protect, before it is set", async () => {
    render(<LockCodeModal isOpen={true} onClose={jest.fn()} onCodeChanged={jest.fn()} />);

    expect(screen.getByText("Wallet code")).toBeInTheDocument();
    expect(await screen.findByText(/does not encrypt the wallet file/)).toBeInTheDocument();
    expect(screen.getByText(/cannot be recovered/)).toBeInTheDocument();
  });

  it("refuses a code that is too short without asking main", async () => {
    render(<LockCodeModal isOpen={true} onClose={jest.fn()} onCodeChanged={jest.fn()} />);
    await waitFor(() => expect(mockInvoke).toHaveBeenCalledWith("lock:status"));

    fireEvent.change(screen.getByLabelText("New code"), { target: { value: "12345" } });
    fireEvent.click(screen.getByRole("button", { name: "Set code" }));

    expect(await screen.findByText("Use at least 6 digits.")).toBeInTheDocument();
    expect(mockInvoke).not.toHaveBeenCalledWith("lock:set", expect.anything(), expect.anything());
  });

  it("refuses two different codes typed for the same field", async () => {
    render(<LockCodeModal isOpen={true} onClose={jest.fn()} onCodeChanged={jest.fn()} />);
    await waitFor(() => expect(mockInvoke).toHaveBeenCalledWith("lock:status"));

    fireEvent.change(screen.getByLabelText("New code"), { target: { value: "123456" } });
    fireEvent.change(screen.getByLabelText("New code again"), { target: { value: "123457" } });
    fireEvent.click(screen.getByRole("button", { name: "Set code" }));

    expect(await screen.findByText("The two codes are not the same.")).toBeInTheDocument();
    expect(mockInvoke).not.toHaveBeenCalledWith("lock:set", expect.anything(), expect.anything());
  });

  it("sets the code in main, and tells the application a code is now set", async () => {
    const onCodeChanged = jest.fn();
    render(<LockCodeModal isOpen={true} onClose={jest.fn()} onCodeChanged={onCodeChanged} />);
    await waitFor(() => expect(mockInvoke).toHaveBeenCalledWith("lock:status"));

    fireEvent.change(screen.getByLabelText("New code"), { target: { value: "123456" } });
    fireEvent.change(screen.getByLabelText("New code again"), { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: "Set code" }));

    await waitFor(() => expect(mockInvoke).toHaveBeenCalledWith("lock:set", "123456", ""));
    await waitFor(() => expect(onCodeChanged).toHaveBeenCalledWith(true));
  });

  it("asks for the current code before changing or removing one", async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === "lock:status") return Promise.resolve({ hasCode: true, minLength: 6, maxLength: 12 });
      return Promise.resolve({ ok: true });
    });
    const onCodeChanged = jest.fn();
    render(<LockCodeModal isOpen={true} onClose={jest.fn()} onCodeChanged={onCodeChanged} />);
    expect(await screen.findByLabelText("Current code")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Remove code" }));
    expect(await screen.findByText("Enter your current code first.")).toBeInTheDocument();
    expect(mockInvoke).not.toHaveBeenCalledWith("lock:clear", expect.anything());

    fireEvent.change(screen.getByLabelText("Current code"), { target: { value: "654321" } });
    fireEvent.click(screen.getByRole("button", { name: "Remove code" }));

    await waitFor(() => expect(mockInvoke).toHaveBeenCalledWith("lock:clear", "654321"));
    await waitFor(() => expect(onCodeChanged).toHaveBeenCalledWith(false));
  });

  it("repeats what main said when it refuses", async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === "lock:status") return Promise.resolve({ hasCode: false });
      if (channel === "lock:set") return Promise.resolve({ ok: false, reason: "Use digits only." });
      return Promise.resolve(null);
    });
    render(<LockCodeModal isOpen={true} onClose={jest.fn()} onCodeChanged={jest.fn()} />);
    await waitFor(() => expect(mockInvoke).toHaveBeenCalledWith("lock:status"));

    fireEvent.change(screen.getByLabelText("New code"), { target: { value: "123456" } });
    fireEvent.change(screen.getByLabelText("New code again"), { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: "Set code" }));

    expect(await screen.findByText("Use digits only.")).toBeInTheDocument();
  });
});
