// Proves a packaged macOS application is built for the architecture it claims.
//
// The Intel build used to run on an Intel runner, where "the host compiles for
// itself" made the question uninteresting. That runner pool (macos-13) stopped
// picking up jobs, so the Intel build is now cross-compiled on an arm64 host —
// and on a cross-build, "the host compiles for itself" is exactly the bug. A
// single arm64 native.node inside an otherwise-x64 app produces a package that
// installs cleanly, launches, and dies the moment it touches the wallet.
//
// Nobody on this project has an Intel Mac to find that out on, and Rosetta is
// not documented as present on the arm64 runners, so the cross-built app may
// never be started before a user starts it. This is what stands in for that:
// every Mach-O file in the bundle is asked what it is, and the answer has to be
// the architecture the build was for.
//
// Extra slices are reported but allowed — a universal system stub is fine. What
// fails is a Mach-O that does not contain the expected architecture at all,
// which is the only shape the cross-compile mistake takes.
const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const EXPECTED = { "mac-x64": "x86_64", "mac-arm64": "arm64" };

const platform = process.argv[2];
const expected = EXPECTED[platform];
if (!expected) {
  console.error(`usage: check-swarm-macho-arch.js <${Object.keys(EXPECTED).join("|")}>`);
  process.exit(2);
}
if (process.platform !== "darwin") {
  console.error("check-swarm-macho-arch: this only runs on macOS, where lipo and file exist.");
  process.exit(2);
}

const dist = path.resolve(__dirname, "../dist");

const findApp = (root) => {
  if (!fs.existsSync(root)) return null;
  const queue = [root];
  while (queue.length > 0) {
    const dir = queue.shift();
    let entries = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (full.endsWith(".app")) return full;
        queue.push(full);
      }
    }
  }
  return null;
};

const app = findApp(dist);
if (!app) {
  console.error(`check-swarm-macho-arch: no .app under ${dist}`);
  process.exit(1);
}
console.log(`Checking every Mach-O in ${path.relative(dist, app)} is ${expected}.\n`);

/** Every regular file in the bundle, symlinks not followed. */
const files = [];
const walk = (dir) => {
  let entries = [];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) walk(full);
    else if (entry.isFile()) files.push(full);
  }
};
walk(app);

const run = (cmd, args) => {
  try {
    return execFileSync(cmd, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  } catch {
    return null;
  }
};

const wrong = [];
const fat = [];
let checked = 0;

for (const file of files) {
  // `file` is the cheap filter: most of a bundle is JavaScript, icons and
  // JSON, and lipo on those is an error rather than an answer.
  const kind = run("file", ["-b", file]);
  if (!kind || !/Mach-O/.test(kind)) continue;

  checked += 1;
  const archs = run("lipo", ["-archs", file]);
  const list = archs ? archs.split(/\s+/).filter(Boolean) : [];
  const rel = path.relative(app, file);

  if (list.length === 0) {
    wrong.push({ rel, archs: `lipo could not read it (${kind})` });
    continue;
  }
  if (!list.includes(expected)) {
    wrong.push({ rel, archs: list.join(", ") });
    continue;
  }
  if (list.length > 1) fat.push({ rel, archs: list.join(", ") });
}

if (checked === 0) {
  console.error("check-swarm-macho-arch: found no Mach-O files at all, which cannot be right for a macOS app.");
  process.exit(1);
}

if (fat.length > 0) {
  console.log(`${fat.length} universal file(s), which is allowed:`);
  for (const f of fat) console.log(`  ${f.rel}: ${f.archs}`);
  console.log("");
}

if (wrong.length > 0) {
  console.error(`${wrong.length} of ${checked} Mach-O file(s) are not ${expected}:\n`);
  for (const w of wrong) console.error(`  ${w.rel}: ${w.archs}`);
  console.error(
    `\nThis is a ${platform} package, so every binary in it must contain ${expected}. A file built for ` +
      `the host architecture instead of the target is what a cross-compile gets wrong, and it produces a ` +
      `package that launches and then fails as soon as it loads that file.`,
  );
  process.exit(1);
}

console.log(`All ${checked} Mach-O file(s) contain ${expected}.`);
