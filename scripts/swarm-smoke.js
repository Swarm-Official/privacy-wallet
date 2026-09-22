// Starts the packaged wallet once, on the machine that built it, and asks one
// question: does it actually run here?
//
// A build that packages cleanly can still be dead on arrival — a native module
// for the wrong architecture, a missing system library, an Electron sandbox
// that the runner's kernel refuses. None of that shows up in a green
// packaging step, and on Linux and macOS nobody on this project has a machine
// to try it on. The runner does.
//
// What it waits for is not "the process is still alive" — a hung window is
// still alive. The packaged app writes a startup log into its own user-data
// directory, and `did-finish-load` in that log means the native module
// loaded, the renderer was served and the first screen rendered. That screen
// is the unlock screen, which is exactly as far as anything here should go:
// no wallet is created, no key material exists, and HOME is a throwaway
// directory that is discarded with the runner.
const { spawnSync, spawn } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const PRODUCT = "SWARM Wallet (Testnet)";
const EXECUTABLE = "SWARM Wallet Testnet";
const READY = "did-finish-load";
const TIMEOUT_MS = 90_000;
const POLL_MS = 500;

const platform = process.argv[2];
if (!["linux", "mac"].includes(platform)) {
  throw new Error("usage: swarm-smoke.js <linux|mac>");
}

const dist = path.resolve(__dirname, "../dist");

/** The first path under `dist` matching `predicate`, breadth-first. */
const findUnder = (root, predicate) => {
  const queue = [root];
  while (queue.length > 0) {
    const dir = queue.shift();
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (predicate(full, entry)) return full;
      if (entry.isDirectory()) queue.push(full);
    }
  }
  return null;
};

// A throwaway HOME, so the launch cannot touch anything the runner already has
// and the whole profile disappears with the directory.
const home = fs.mkdtempSync(path.join(os.tmpdir(), "swarm-smoke-"));
const userData =
  platform === "linux"
    ? path.join(home, ".config", PRODUCT)
    : path.join(home, "Library", "Application Support", PRODUCT);
const startupLog = path.join(userData, "startup.log");

let command;
let args = [];
if (platform === "linux") {
  const appImage = findUnder(dist, (full) => full.endsWith(".AppImage"));
  if (!appImage) throw new Error("no AppImage in dist");
  fs.chmodSync(appImage, 0o755);
  console.log(`Starting ${path.basename(appImage)} under Xvfb.`);
  // --no-sandbox: the runner's kernel restricts unprivileged user namespaces
  // and an AppImage cannot install the SUID helper or the AppArmor profile
  // that the .deb does. This is a property of running an AppImage on a
  // locked-down host, not of this build, and it is what the README tells a
  // user on 24.04 to do.
  command = "xvfb-run";
  args = ["-a", appImage, "--no-sandbox"];
} else {
  const app = findUnder(dist, (full, entry) => entry.isDirectory() && full.endsWith(".app"));
  if (!app) throw new Error("no .app in dist");
  const binary = path.join(app, "Contents", "MacOS", EXECUTABLE);
  if (!fs.existsSync(binary)) throw new Error(`no executable at ${binary}`);
  console.log(`Starting ${path.basename(app)}.`);
  command = binary;
}

const child = spawn(command, args, {
  env: { ...process.env, HOME: home, ELECTRON_ENABLE_LOGGING: "1" },
  stdio: ["ignore", "pipe", "pipe"],
});

let output = "";
child.stdout.on("data", (chunk) => (output += chunk));
child.stderr.on("data", (chunk) => (output += chunk));

let exited = null;
child.on("exit", (code, signal) => (exited = { code, signal }));

const started = Date.now();
const finish = (ok, why) => {
  try {
    child.kill("SIGTERM");
  } catch {
    /* already gone */
  }
  // macOS keeps the app alive under its own launch services in some setups.
  if (platform === "mac") spawnSync("pkill", ["-f", EXECUTABLE]);
  const tail = output.trim().split("\n").slice(-25).join("\n");
  if (ok) {
    console.log(`\n${why}`);
    process.exit(0);
  }
  console.error(`\n${why}`);
  if (tail) console.error(`\nLast output:\n${tail}`);
  if (fs.existsSync(startupLog)) console.error(`\nStartup log:\n${fs.readFileSync(startupLog, "utf8")}`);
  process.exit(1);
};

const poll = () => {
  if (fs.existsSync(startupLog)) {
    const log = fs.readFileSync(startupLog, "utf8");
    if (log.includes(READY)) {
      finish(true, `The packaged wallet started and rendered its first screen.\n${log.trim()}`);
      return;
    }
  }
  if (exited) {
    finish(false, `The packaged wallet exited before rendering (code ${exited.code}, signal ${exited.signal}).`);
    return;
  }
  if (Date.now() - started > TIMEOUT_MS) {
    finish(false, `The packaged wallet did not render within ${TIMEOUT_MS / 1000}s.`);
    return;
  }
  setTimeout(poll, POLL_MS);
};

poll();
