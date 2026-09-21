const upstream = require("../package.json").build;

// Packaging for the SwarmTestnet wallet: an unsigned, portable Windows test
// build. It changes identity and artwork, never behaviour.
//
// `productName` carries the parentheses because that is the product's name;
// `executableName` does not, so the file on disk, the process name the
// launcher looks for and the window's own title stay easy to quote.
//
// The icon is the style guide's hive bee, rendered by scripts/make-swarm-icon.js
// into resources/swarm. Changing the mark means re-running that script.
module.exports = {
  ...upstream,
  productName: "SWARM Wallet (Testnet)",
  executableName: "SWARM Wallet Testnet",
  appId: "green.swarm.wallet.testnet",
  artifactName: "SWARM-Wallet-Testnet-${version}-${arch}.${ext}",
  extraMetadata: {
    main: "build/electron.js",
    name: "swarm-wallet-testnet",
    productName: "SWARM Wallet (Testnet)",
    description: "Wallet for the SwarmTestnet network. Test coins with no value.",
  },
  afterSign: null,
  afterAllArtifactBuild: null,
  win: {
    ...upstream.win,
    icon: "./resources/swarm/icon.ico",
    target: ["zip"],
    azureSignOptions: null,
    // True so electron-builder rewrites the executable's version resource —
    // without it the file's Properties dialog keeps Electron's own
    // ProductName and FileDescription, which is what it did on build
    // ec77dc96. Editing the resource is rcedit's job and pulls in no signing:
    // `signExts: []` and the null Azure options are what keep the signing
    // pipeline out, and CSC_IDENTITY_AUTO_DISCOVERY is false in the workflow.
    signAndEditExecutable: true,
    signExts: [],
    // No `zcash:` handler: this wallet is not for the public Zcash network and
    // must not become the machine's default for its payment links.
    protocols: [],
    // Both MIT licences travel with the binary. The SDK's comes from the
    // pinned-revision checkout the workflow makes for scripts/check-swarm-sdk-pin.js,
    // so the text shipped is the text of the revision that was compiled.
    extraResources: [
      ...upstream.win.extraResources,
      { from: "LICENSE", to: "licenses/Zingo-PC-LICENSE.txt" },
      { from: "sdk-source/LICENSE", to: "licenses/Zingolib-LICENSE.txt" },
    ],
  },
};
