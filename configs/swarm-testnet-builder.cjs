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
    signAndEditExecutable: false,
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
