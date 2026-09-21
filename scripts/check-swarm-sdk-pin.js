// Checks that this build compiles the exact SDK revision it claims to, and
// that the network that revision targets is the one recorded here.
//
// It replaces the patch-snapshot mechanism the Privacy build used. There is no
// patch to digest any more: native/Cargo.toml names a git revision, the
// lockfile names the same one, and the SDK's own source is read at that
// revision to see which chain and genesis it was compiled for.
//
// Usage:
//   node scripts/check-swarm-sdk-pin.js <path to a checkout of the pinned SDK>
//   node scripts/check-swarm-sdk-pin.js <path> --require-real-genesis
//   node scripts/check-swarm-sdk-pin.js <path> --manifest <network manifest>
//
// `--require-real-genesis` is the release gate: a build carrying the SDK's
// genesis placeholder is refused outright.
//
// `--manifest` points at `network/swarm-testnet/manifest.json`, the network's
// own definition and the authority on what SwarmTestnet is. That file is not
// in this repository — the pin carries a copy of the fields that matter — so
// when the real one is reachable it is read and compared, and the copy is
// checked against it rather than trusted.
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const root = path.resolve(__dirname, "..");
const argv = process.argv.slice(2);
const flags = argv.filter((argument) => argument.startsWith("--"));
const positional = argv.filter((argument, index) => !argument.startsWith("--") && !argv[index - 1]?.startsWith("--manifest"));
const [sdkPath = path.join(root, "sdk-source")] = positional;
const requireRealGenesis = flags.includes("--require-real-genesis");
const manifestPath = argv[argv.indexOf("--manifest") + 1];

const pin = JSON.parse(fs.readFileSync(path.join(root, "sdk/swarm-sdk-pin.json"), "utf8"));
const fail = (message) => {
  throw new Error(message);
};

if (!/^[0-9a-f]{40}$/.test(pin.commit)) fail("The SDK pin does not name an exact revision.");

// 0. The network's own definition, when it is reachable. The manifest is the
//    authority: the pin's copy of it must agree, field for field.
if (manifestPath) {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const expected = {
    networkName: manifest.identity?.network_name,
    lightWalletChainLabel: manifest.identity?.light_wallet_chain_label,
    genesisHash: manifest.genesis?.hash,
    genesisBlockSha256: manifest.genesis?.block_sha256,
    lightWalletGrpcPort: manifest.ports?.lightwallet_grpc,
    generatorCommit: manifest.genesis?.generator?.commit,
    reproductions: manifest.genesis?.generator?.reproductions,
  };
  for (const [field, value] of Object.entries(expected)) {
    if (value === undefined) fail(`The network manifest does not state ${field}.`);
    if (pin.manifest?.[field] !== value) {
      fail(`The pin says ${field}=${JSON.stringify(pin.manifest?.[field])}, the manifest says ${JSON.stringify(value)}.`);
    }
  }
  if (pin.genesis !== expected.genesisHash) fail("The pinned genesis is not the manifest's genesis.");
  if (pin.chainName !== expected.lightWalletChainLabel) fail("The pinned chain label is not the manifest's.");

  // A genesis block stamped in the future cannot be built on: the chain
  // produces no block 1 until that time arrives, and a wallet pinned to it
  // would sit on an empty chain with nothing wrong that it could report. The
  // first generated genesis had this fault, which cost a rebuild; it is
  // cheaper to refuse the pin than to find out from a silent wallet.
  const genesisTime = manifest.genesis?.time_unix;
  if (typeof genesisTime !== "number") fail("The network manifest does not state genesis.time_unix.");
  const now = Math.floor(Date.now() / 1000);
  if (genesisTime > now) {
    fail(
      `The manifest's genesis is stamped ${manifest.genesis.time_utc ?? genesisTime}, which is ` +
        `${Math.round((genesisTime - now) / 3600)} hour(s) in the future. The chain cannot produce ` +
        `block 1 until then, so there is nothing for a wallet to sync.`,
    );
  }
  console.log(
    `Network manifest checked: ${expected.networkName} at ${expected.genesisHash}, ` +
      `stamped ${manifest.genesis.time_utc ?? genesisTime}.`,
  );
} else if (pin.manifest?.genesisHash !== pin.genesis || pin.manifest?.lightWalletChainLabel !== pin.chainName) {
  fail("The pin's copy of the network manifest disagrees with the pin itself.");
}

// 1. The manifest names that revision, for every crate it takes from the SDK.
const manifest = fs.readFileSync(path.join(root, "native/Cargo.toml"), "utf8");
for (const crate of ["zingolib", "pepper-sync", "zingo-netutils"]) {
  const line = manifest.split("\n").find((l) => l.startsWith(`${crate} = `));
  if (!line) fail(`native/Cargo.toml does not declare ${crate}.`);
  if (!line.includes(`git = "${pin.repository}"`)) fail(`${crate} does not come from ${pin.repository}.`);
  if (!line.includes(`rev = "${pin.commit}"`)) fail(`${crate} is not pinned to ${pin.commit}.`);
  if (line.includes("path =")) fail(`${crate} still resolves through a local path.`);
}

// 2. The lockfile agrees, so `--locked` compiles that revision and no other.
const lock = fs.readFileSync(path.join(root, "native/Cargo.lock"), "utf8");
const expectedSource = `source = "git+${pin.repository}?rev=${pin.commit}#${pin.commit}"`;
const sdkSources = lock.split("\n").filter((line) => line.includes(pin.repository.replace("https://", "")));
if (sdkSources.length === 0) fail("The lockfile resolves nothing to the project SDK.");
for (const line of sdkSources) {
  if (line.trim() !== expectedSource) fail(`Lockfile source is not the pinned revision: ${line.trim()}`);
}

// 3. The checkout handed to us is that revision.
const head = execFileSync("git", ["rev-parse", "HEAD"], { cwd: sdkPath, encoding: "utf8" }).trim();
if (head !== pin.commit) fail(`The SDK checkout is ${head}, not the pinned ${pin.commit}.`);

// 4. The network that revision targets is the one recorded here. Read from the
//    SDK's own source rather than trusted from this repository, because the
//    constant in the SDK is what the compiled binary will actually enforce.
const config = fs.readFileSync(path.join(sdkPath, "zingolib/src/config.rs"), "utf8");
const constant = (name) => {
  const match = config.match(new RegExp(`${name}: &str =\\s*([^;]+);`));
  if (!match) fail(`The pinned SDK does not define ${name}.`);
  return match[1].trim().replace(/^"|"$/g, "");
};
const chainName = constant("SWARM_TESTNET_NAME");
const placeholder = constant("SWARM_TESTNET_GENESIS_PLACEHOLDER");
const declared = constant("SWARM_TESTNET_GENESIS");
// The genesis constant is either a literal hash or an alias for the placeholder.
const genesis = declared === "SWARM_TESTNET_GENESIS_PLACEHOLDER" ? placeholder : declared;

if (chainName !== pin.chainName) fail(`The pinned SDK targets chain "${chainName}", not "${pin.chainName}".`);
if (!/^[0-9a-f]{64}$/.test(genesis)) fail(`The pinned SDK's genesis is not a 64-character hash: ${genesis}`);
if (genesis !== pin.genesis) fail(`The pinned SDK's genesis is ${genesis}, not the recorded ${pin.genesis}.`);

const isPlaceholder = genesis === placeholder;
if (isPlaceholder !== !!pin.genesisIsPlaceholder) {
  fail(`The pin says genesisIsPlaceholder=${!!pin.genesisIsPlaceholder}, the SDK says ${isPlaceholder}.`);
}
if (requireRealGenesis && isPlaceholder) {
  fail(
    "This build still carries SWARM_TESTNET_GENESIS_PLACEHOLDER. SwarmTestnet's genesis block " +
      "does not exist yet, so there is no release to make. Set SWARM_TESTNET_GENESIS in the SDK, " +
      "re-pin sdk/swarm-sdk-pin.json, and run again.",
  );
}

fs.writeFileSync(
  path.join(root, "sdk-integration.json"),
  JSON.stringify({ ...pin, verifiedGenesis: genesis, verifiedChainName: chainName }, null, 2) + "\n",
);
console.log(
  `SDK pin verified: ${pin.commit} targets ${chainName} at ${genesis}` +
    `${isPlaceholder ? " (placeholder — not a release build)" : ""}.`,
);
