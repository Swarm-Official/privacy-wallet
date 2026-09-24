"use strict";

// The SWARM-specific config is the source of truth for app ID, version,
// artwork, licences and storage. Only the direct-download Mac signing path is
// overridden here; the generic upstream/MAS configuration is never used.
const base = require("./swarm-testnet-builder.cjs");
const developerIdIdentity = require("../scripts/mac-distribution-identity.cjs");

module.exports = {
  ...base,
  directories: { ...base.directories, output: "dist-mac-signed" },
  afterSign: "./scripts/verify-mac-signed-app.cjs",
  mac: {
    ...base.mac,
    target: [{ target: "dmg", arch: ["arm64"] }, { target: "zip", arch: ["arm64"] }],
    identity: developerIdIdentity(),
    hardenedRuntime: true,
    gatekeeperAssess: true,
    entitlements: "./configs/entitlements.swarm-mac.plist",
    entitlementsInherit: "./configs/entitlements.swarm-mac.plist",
    binaries: ["Contents/Resources/nym-proxy"],
    notarize: true,
  },
};
