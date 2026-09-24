import React from "react";
import { render, screen, fireEvent } from "../../test-utils";
import ErrorModal from "./ErrorModal";
import { ErrorModalClass } from "../appstate";

beforeAll(() => {
  const div = document.createElement("div");
  div.setAttribute("id", "root");
  document.body.appendChild(div);
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require("react-modal").setAppElement("#root");
});

const openModal = new ErrorModalClass();
openModal.title = "Something went wrong";
openModal.body = "Please try again later.";
openModal.modalIsOpen = true;

describe("ErrorModal", () => {
  it("does not offer cancellation or close on Escape while the native payment is active", () => {
    const closeModal = jest.fn();
    const pending = { ...openModal, title: "Computing Transaction" };
    render(<ErrorModal closeModal={closeModal} />, { contextOverrides: { errorModal: pending } });
    expect(screen.queryByRole("button", { name: /cancel/i })).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Wait for a result");
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape", code: "Escape", keyCode: 27 });
    expect(closeModal).not.toHaveBeenCalled();
  });
  it("renders the title when open", () => {
    render(<ErrorModal closeModal={jest.fn()} />, {
      contextOverrides: { errorModal: openModal },
    });
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
  });

  it("renders the body when open", () => {
    render(<ErrorModal closeModal={jest.fn()} />, {
      contextOverrides: { errorModal: openModal },
    });
    expect(screen.getByText("Please try again later.")).toBeInTheDocument();
  });

  it("calls closeModal when Cancel button is clicked", () => {
    const closeModal = jest.fn();
    render(<ErrorModal closeModal={closeModal} />, {
      contextOverrides: { errorModal: openModal },
    });
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(closeModal).toHaveBeenCalledTimes(1);
  });

  it("does not render content when closed", () => {
    const closed = new ErrorModalClass();
    closed.modalIsOpen = false;
    render(<ErrorModal closeModal={jest.fn()} />, {
      contextOverrides: { errorModal: closed },
    });
    expect(screen.queryByText("Something went wrong")).not.toBeInTheDocument();
  });
});
