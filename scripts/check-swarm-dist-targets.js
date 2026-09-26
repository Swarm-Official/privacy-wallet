// Checks that packaging actually produced every target the config declares.
//
// The config said win.target = ["zip", "nsis"] and the workflow ran
// `electron-builder --win zip`. Naming targets on the command line overrides
// the config, so the one-click installer was never built on any run — and the
// only thing that ever noticed was the Windows smoke test, two steps later,
// with "no one-click installer in dist". Every other platform would have lost
// a target silently.
//
// Cheap, immediate, and it compares the two things that drifted: what the
// config asks for, and what is on disk.
const fs = require("fs");
const path = require("path");

const config = require("../configs/swarm-builder.cjs");
const dist = path.resolve(__dirname, "../dist");

// One extension per electron-builder target that this project builds. A target
// missing from here is a target this check cannot vouch for, so it says so
// rather than passing.
const EXTENSIONS = {
  zip: [".zip"],
  nsis: [".exe"],
  AppImage: [".AppImage"],
  deb: [".deb"],
  dmg: [".dmg"],
};

const platform = process.argv[2];
if (!["win", "linux", "mac"].includes(platform)) {
  console.error("usage: check-swarm-dist-targets.js <win|linux|mac>");
  process.exit(2);
}

const declared = config[platform]?.target;
if (!Array.isArray(declared) || declared.length === 0) {
  console.error(`check-swarm-dist-targets: the config declares no targets for ${platform}.`);
  process.exit(1);
}

if (!fs.existsSync(dist)) {
  console.error(`check-swarm-dist-targets: there is no ${dist} to check.`);
  process.exit(1);
}

// Top level only: electron-builder writes its artifacts there, and the
// unpacked directories below are full of .exe and .zip files that would
// otherwise answer for a target that was never built.
const produced = fs.readdirSync(dist, { withFileTypes: true }).filter((e) => e.isFile()).map((e) => e.name);

const missing = [];
const unknown = [];
const found = [];

for (const target of declared) {
  const extensions = EXTENSIONS[target];
  if (!extensions) {
    unknown.push(target);
    continue;
  }
  // nsis and zip both end in a common extension, so the installer is matched
  // by the name the config gives it rather than by ".exe" alone.
  const match = produced.find((name) => {
    if (target === "nsis") return name.toLowerCase().endsWith("setup.exe");
    return extensions.some((ext) => name.toLowerCase().endsWith(ext.toLowerCase()));
  });
  if (match) found.push(`${target}: ${match}`);
  else missing.push(target);
}

console.log(`Config declares ${declared.length} ${platform} target(s): ${declared.join(", ")}\n`);
for (const line of found) console.log(`  ok  ${line}`);

if (unknown.length > 0) {
  console.error(`\ncheck-swarm-dist-targets: no known file extension for ${unknown.join(", ")}.`);
  console.error("Add it to EXTENSIONS rather than leaving a target nothing checks.");
  process.exit(1);
}

if (missing.length > 0) {
  console.error(`\n${missing.length} declared target(s) were not produced: ${missing.join(", ")}`);
  console.error(`\nWhat is in ${path.basename(dist)}:`);
  for (const name of produced) console.error(`  ${name}`);
  console.error(
    "\nThe usual cause is a target list on the electron-builder command line, which overrides the " +
      "config rather than adding to it. Let the config decide, and pass only the platform and arch.",
  );
  process.exit(1);
}

console.log(`\nAll ${declared.length} declared ${platform} target(s) were produced.`);
