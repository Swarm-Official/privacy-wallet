const upstream = require("../package.json").build;

module.exports = {
  ...upstream,
  productName: "Privacy Wallet Testnet",
  appId: "org.brsholding.privacy.wallet.testnet",
  artifactName: "Privacy-Wallet-Testnet-${version}-${arch}.${ext}",
  extraMetadata: {
    main: "build/electron.js",
    name: "privacy-wallet-testnet",
    productName: "Privacy Wallet Testnet",
    description: "Wallet for the isolated Privacy engineering testnet",
  },
  afterSign: null,
  afterAllArtifactBuild: null,
  win: {
    ...upstream.win,
    target: ["zip"],
    azureSignOptions: null,
    signAndEditExecutable: false,
    signExts: [],
    protocols: null,
  },
};
