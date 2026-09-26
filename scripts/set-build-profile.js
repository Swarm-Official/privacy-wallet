// Record which SWARM network this build is packaged for, INSIDE the build.
//
//   SWARM_NETWORK_PROFILE=swarm-mainnet node scripts/set-build-profile.js
//   node scripts/set-build-profile.js swarm-mainnet
//   node scripts/set-build-profile.js --check          (prints, writes nothing)
//
// WHY THIS EXISTS. A wallet build carries every network definition it has, and
// the user picks one. Which network the build was MADE for was recorded
// nowhere inside it, so the mainnet build of 2026-09-26 shipped the real
// mainnet genesis under the name "SWARM Wallet (Testnet)", version
// 0.1.0-testnet.9, opening on the testnet server. Four separate places have to
// agree about that answer — the renderer's branding, the main process's window
// title, electron-builder's identity and the version string — and the only way
// they can is to read it from one file.
//
// The value is validated against the closed list in src/buildProfile.json, so
// this can never write a network the application does not know, and it can
// never write upstream Zcash's `main`.
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const dest = path.join(root, "src", "buildProfile.json");

const args = process.argv.slice(2).filter((a) => a !== "--check");
const check = process.argv.slice(2).includes("--check");

const file = JSON.parse(fs.readFileSync(dest, "utf8"));
const known = Object.keys(file.profiles);
const wanted = args[0] || process.env.SWARM_NETWORK_PROFILE || file.profile;

if (!known.includes(wanted)) {
  console.error(`'${wanted}' is not a SWARM network this application knows. On offer: ${known.join(", ")}.`);
  process.exit(1);
}

const identity = file.profiles[wanted];
console.log(
  `build profile: ${wanted} — ${identity.productName} ${identity.version}, ` +
    `app id ${identity.appId}, package ${identity.packageName}`,
);

if (check) {
  console.log(`(--check: src/buildProfile.json left at '${file.profile}')`);
  process.exit(0);
}

if (file.profile === wanted) {
  console.log("src/buildProfile.json already says that; nothing written.");
  process.exit(0);
}

fs.writeFileSync(dest, JSON.stringify({ ...file, profile: wanted }, null, 2) + "\n");
console.log(`wrote src/buildProfile.json: ${file.profile} -> ${wanted}`);
