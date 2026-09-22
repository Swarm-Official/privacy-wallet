const fs = require("fs");
const path = require("path");

const upstream = require("../package.json").build;

// The version every artifact is named after, read from the single place the
// application already states it. package.json still carries upstream's
// 2.0.26, which is how the first packages came out named "2.0.26" — a number
// that says nothing about which SWARM build someone downloaded.
const versionSource = fs.readFileSync(path.join(__dirname, "../src/version.ts"), "utf8");
const VERSION = /const APP_VERSION = "([^"]+)"/.exec(versionSource)[1];

// Packaging for the SwarmTestnet wallet: unsigned, portable test builds for
// Windows, Linux and macOS. It changes identity, artwork and what the
// installer touches — never behaviour.
//
// `productName` carries the parentheses because that is the product's name;
// `executableName` does not, so the file on disk, the process name the
// launcher looks for and the window's own title stay easy to quote.
//
// The icons are the style guide's hive bee, rendered by
// scripts/make-swarm-icon.js. Changing the mark means re-running that script.
//
// Nothing here registers a `zcash:` handler on any platform. This is not a
// wallet for the public Zcash network and must not become the machine's
// default for its payment links.

const PRODUCT = "SWARM Wallet (Testnet)";
const EXECUTABLE = "SWARM Wallet Testnet";

// Both MIT licences travel with every binary. The SDK's comes from the
// pinned-revision checkout the workflow makes for scripts/check-swarm-sdk-pin.js,
// so the text shipped is the text of the revision that was compiled.
const licences = [
  { from: "LICENSE", to: "licenses/Zingo-PC-LICENSE.txt" },
  { from: "sdk-source/LICENSE", to: "licenses/Zingolib-LICENSE.txt" },
];

module.exports = {
  ...upstream,
  productName: PRODUCT,
  executableName: EXECUTABLE,
  appId: "green.swarm.wallet.testnet",
  artifactName: "SWARM-Wallet-${version}-${arch}.${ext}",
  extraMetadata: {
    version: VERSION,
    main: "build/electron.js",
    name: "swarm-wallet-testnet",
    productName: PRODUCT,
    description: "Wallet for the SwarmTestnet network. Test coins with no value.",
  },
  // Upstream's hooks exist to sign and notarise for the App Store. There is
  // no Apple account behind this build, so they are removed rather than left
  // to fail.
  afterSign: null,
  afterAllArtifactBuild: null,
  win: {
    ...upstream.win,
    icon: "./resources/swarm/icon.ico",
    target: ["zip", "nsis"],
    azureSignOptions: null,
    // True so electron-builder rewrites the executable's version resource —
    // without it the file's Properties dialog keeps Electron's own
    // ProductName and FileDescription. Editing the resource is rcedit's job
    // and pulls in no signing: `signExts: []` and the null Azure options are
    // what keep the signing pipeline out, and CSC_IDENTITY_AUTO_DISCOVERY is
    // false in the workflow.
    signAndEditExecutable: true,
    signExts: [],
    protocols: [],
    extraResources: [...upstream.win.extraResources, ...licences],
  },
  // A single file a person double-clicks. The portable zip stays — it is
  // what someone who will not run an unsigned installer can still inspect
  // and unpack — but unzipping eighty files of Chromium runtime and being
  // asked to find the right .exe among them is not an installation.
  //
  // Per-user, so there is no administrator prompt on top of the SmartScreen
  // one; no directory chooser, because oneClick means there are no
  // questions; and the wallet is left alone on uninstall, because the
  // application is replaceable and the coins are not.
  nsis: {
    oneClick: true,
    perMachine: false,
    allowToChangeInstallationDirectory: false,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    shortcutName: PRODUCT,
    runAfterFinish: true,
    deleteAppDataOnUninstall: false,
    artifactName: "SWARM-Wallet-${version}-win-x64-setup.${ext}",
  },
  linux: {
    ...upstream.linux,
    icon: "./resources/swarm/icons",
    target: ["AppImage", "deb"],
    category: "Office;Finance",
    // Upstream ships a polkit policy, an AppArmor profile and a `zcash:` URI
    // wrapper, all named and pathed for Zingo PC. The first two are rewritten
    // for this product's install path — a copy would match nothing and the
    // crashes they prevent on Ubuntu 22.04+ and 24.04+ would come back. The
    // third is dropped with the protocol handler.
    extraResources: [
      { from: "resources/nym-proxy", to: "nym-proxy" },
      { from: "resources/swarm/linux/green.swarm.wallet.policy", to: "green.swarm.wallet.policy" },
      { from: "resources/swarm/linux/apparmor/swarm-wallet", to: "apparmor-swarm-wallet" },
      ...licences,
    ],
    mimeTypes: [],
    desktop: {
      entry: {
        Name: PRODUCT,
        Comment: "Wallet for the SwarmTestnet network",
        GenericName: "Wallet",
        Type: "Application",
        StartupNotify: true,
        Categories: "Office;Finance;",
        Keywords: "swarm;wallet;testnet;",
      },
    },
  },
  deb: {
    ...upstream.deb,
    afterInstall: "scripts/swarm-deb-postinstall.sh",
    afterRemove: "scripts/swarm-deb-postremove.sh",
    artifactName: "SWARM-Wallet-${version}-${arch}.${ext}",
  },
  appImage: {
    ...upstream.appImage,
    artifactName: "SWARM-Wallet-${version}-${arch}.${ext}",
  },
  mac: {
    ...upstream.mac,
    // electron-builder converts this to an icns on the runner, which is the
    // only place the conversion tooling exists.
    icon: "./resources/swarm/icon-1024.png",
    target: ["dmg", "zip"],
    // Unsigned and un-notarised: there is no Apple account. `identity: null`
    // stops electron-builder hunting the keychain for one, and the hardened
    // runtime is turned off because it only means anything to a signed
    // binary and its entitlements file is written for signing.
    identity: null,
    hardenedRuntime: false,
    gatekeeperAssess: false,
    notarize: false,
    entitlements: null,
    entitlementsInherit: null,
    protocols: [],
    extendInfo: {
      ITSAppUsesNonExemptEncryption: false,
      NSCameraUsageDescription:
        "SWARM Wallet uses the camera only to read payment QR codes. Images are processed on this device and never stored or sent.",
    },
    extraResources: [{ from: "resources/nym-proxy", to: "nym-proxy" }, ...licences],
  },
  dmg: {
    ...upstream.dmg,
    artifactName: "SWARM-Wallet-${version}-${arch}.${ext}",
  },
  // The App Store target has no meaning without an Apple account, and leaving
  // it configured invites an accidental `--mas` build that fails late.
  mas: undefined,
};
