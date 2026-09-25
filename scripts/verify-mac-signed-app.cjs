"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { execFileSync, spawnSync } = require("node:child_process");

function assertDeveloperId(file) {
  execFileSync("codesign", ["--verify", "--strict", "--verbose=2", file], { stdio: "inherit" });
  const details = spawnSync("codesign", ["-dv", "--verbose=4", file], { encoding: "utf8" });
  if (details.status !== 0 || !/Authority=Developer ID Application:/.test(details.stderr)) {
    throw new Error(`Missing Developer ID Application signature: ${file}`);
  }
}

module.exports = async function verifyMacSignedApp(context) {
  if (context.electronPlatformName !== "darwin") throw new Error("Expected a macOS app");
  const app = path.join(context.appOutDir, "SWARM Wallet Testnet.app");
  const resources = path.join(app, "Contents/Resources");
  const nym = path.join(resources, "nym-proxy");
  if (!fs.existsSync(nym)) throw new Error("The pinned Nym helper was not packaged");
  assertDeveloperId(nym);

  const unpacked = path.join(resources, "app.asar.unpacked");
  const addons = [];
  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile() && entry.name.endsWith(".node")) addons.push(full);
    }
  }
  walk(unpacked);
  if (!addons.some((file) => file.endsWith("/build/native.node"))) throw new Error("The SWARM Rust native addon was not packaged");
  for (const addon of addons) assertDeveloperId(addon);
  execFileSync("codesign", ["--verify", "--deep", "--strict", "--verbose=2", app], { stdio: "inherit" });
  const outer = spawnSync("codesign", ["-dv", "--verbose=4", app], { encoding: "utf8" });
  if (outer.status !== 0 || !/Authority=Developer ID Application:/.test(outer.stderr)) {
    throw new Error("Outer app lacks a Developer ID Application signature");
  }
  console.log(`Verified Developer ID signatures for Nym and ${addons.length} native addon(s)`);
};
