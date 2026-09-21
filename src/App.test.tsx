import React from "react";
import { render, screen } from "@testing-library/react";
import App from "./App";
import APP_VERSION from "./version";
import { SWARM_APP_NAME } from "./utils/swarmNetwork";

test("renders without crashing", () => {
  render(<App />);
});

test("displays app version string", () => {
  render(<App />);
  expect(screen.getByText(`${SWARM_APP_NAME} v${APP_VERSION}`)).toBeInTheDocument();
});
