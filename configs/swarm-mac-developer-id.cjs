"use strict";

// The SWARM-specific config is the source of truth for app ID, version,
// artwork, licences and storage. Only the direct-download Mac signing path is
// overridden here; the generic upstream/MAS configuration is never used.
const base = require("./swarm-testnet-builder.cjs");
const developerIdIdentity = require("../scripts/mac-distribution-identity.cjs");
const arch = process.env.SWARM_MAC_ARCH || "arm64";
if (!["arm64", "x64"].includes(arch)) throw new Error(`Unsupported SWARM_MAC_ARCH: ${arch}`);

module.exports = {
  ...base,
  directories: { ...base.directories, output: arch === "x64" ? "dist-mac-signed-x64" : "dist-mac-signed" },
  afterSign: "./scripts/verify-mac-signed-app.cjs",
  mac: {
    ...base.mac,
    target: [{ target: "dmg", arch: [arch] }, { target: "zip", arch: [arch] }],
    // electron-builder selects the Developer ID certificate type itself and
    // rejects the "Developer ID Application:" prefix in an explicit identity.
    identity: developerIdIdentity().replace(/^Developer ID Application:\s*/, ""),
    hardenedRuntime: true,
    gatekeeperAssess: true,
    entitlements: "./configs/entitlements.swarm-mac.plist",
    entitlementsInherit: "./configs/entitlements.swarm-mac.plist",
    binaries: ["Contents/Resources/nym-proxy"],
    notarize: true,
  },
};
