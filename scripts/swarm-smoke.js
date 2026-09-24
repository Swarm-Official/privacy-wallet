// Starts the packaged wallet once, on the machine that built it, with a
// throwaway profile and no arguments a user would not have — and reads what it
// puts on screen.
//
// A build that packages cleanly can still be dead on arrival: a native module
// for the wrong architecture, a missing system library, a renderer that throws
// on a profile with nothing in it. None of that shows in a green packaging
// step, and nobody on this project has a Linux box or a Mac to try it on. The
// runner does.
//
// Readiness comes from DevTools, not from the app's own log file. An earlier
// version waited for a line in startup.log at a path computed from the product
// name; on Linux and macOS that file never appeared there, so the check timed
// out after ninety seconds having never spoken to the app, while DevTools sat
// listening the whole time. Where the profile actually landed is now something
// this reports rather than assumes.
//
// It goes only as far as the first settled screen: no wallet is created, no
// key material exists, and HOME is a directory thrown away with the runner.
const { spawn } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const {
  waitForFirstScreen,
  waitForSettledScreen,
  writeDiagnostics,
  listTree,
  assertLandingScreen,
} = require("./swarm-first-screen");

const PRODUCT = "SWARM Wallet (Testnet)";
const EXECUTABLE = "SWARM Wallet Testnet";
const DEVTOOLS_PORT = 9333;
const RENDER_TIMEOUT_MS = 120_000;

const platform = process.argv[2];
if (!["linux", "mac"].includes(platform)) throw new Error("usage: swarm-smoke.js <linux|mac>");

const dist = path.resolve(process.env.SWARM_DIST || path.join(__dirname, "../dist"));
const diagnostics = path.join(dist, "smoke-diagnostics");

const findUnder = (root, predicate) => {
  if (!fs.existsSync(root)) return null;
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

const home = fs.mkdtempSync(path.join(os.tmpdir(), "swarm-smoke-"));

let command;
let args = [`--remote-debugging-port=${DEVTOOLS_PORT}`];
if (platform === "linux") {
  const appImage = findUnder(dist, (full) => full.endsWith(".AppImage"));
  if (!appImage) throw new Error("no AppImage in dist");
  fs.chmodSync(appImage, 0o755);
  console.log(`Starting ${path.basename(appImage)} under Xvfb.`);
  // --no-sandbox: the runner's kernel restricts unprivileged user namespaces
  // and an AppImage cannot install the SUID helper or the AppArmor profile the
  // .deb does. A property of running an AppImage on a locked-down host, not of
  // this build, and what the README tells a user on 24.04 to do.
  args = ["-a", appImage, "--no-sandbox", ...args];
  command = "xvfb-run";
} else {
  const app = findUnder(dist, (full, entry) => entry.isDirectory() && full.endsWith(".app"));
  if (!app) throw new Error("no .app in dist");
  command = path.join(app, "Contents", "MacOS", EXECUTABLE);
  if (!fs.existsSync(command)) throw new Error(`no executable at ${command}`);
  console.log(`Starting ${path.basename(app)}.`);
}

const child = spawn(command, args, {
  env: { ...process.env, HOME: home, ELECTRON_ENABLE_LOGGING: "1" },
  stdio: ["ignore", "pipe", "pipe"],
});
let output = "";
child.stdout.on("data", (chunk) => (output += chunk));
child.stderr.on("data", (chunk) => (output += chunk));

const stop = () => {
  try {
    child.kill("SIGTERM");
  } catch {
    /* already gone */
  }
};

(async () => {
  let devtools = null;
  let settledForDiagnostics = null;
  try {
    const result = await waitForFirstScreen(DEVTOOLS_PORT, RENDER_TIMEOUT_MS);
    devtools = result.devtools;

    if (result.timedOut) {
      throw new Error(
        `the page never finished loading within ${RENDER_TIMEOUT_MS / 1000}s ` +
          `(document.readyState = ${result.readyState ?? "unknown"}, body text ${result.text.length} chars)`,
      );
    }

    // The landing screen, not the first paint. The app renders, then decides
    // where a profile with no wallet belongs and navigates there; capturing at
    // the first words on the page caught the dashboard mid-flight and reported
    // it as where a new user lands (defect W-6).
    const settled = await waitForSettledScreen(devtools);
    settledForDiagnostics = settled;
    console.log(`\n--- landing screen ---\n${settled}\n----------------------`);

    // Written before the assertion, so the evidence exists whether it passes
    // or fails — and `screen.txt` holds the landing screen, which is the thing
    // being judged, rather than the first paint on the way to it.
    await writeDiagnostics(devtools, diagnostics, {
      "process-output.log": output.trim() || "(nothing)",
      "throwaway-home.txt": listTree(home),
      "screen.txt": settled || "(empty)",
      "first-paint.txt": result.text || "(empty)",
    });

    // Device authentication depends on actual enrollment, not the operating
    // system. A Mac without Touch ID enrolled correctly reaches onboarding.
    // Ask the packaged app through its own IPC bridge before judging the gate.
    const auth = await devtools.evaluate(`Promise.all([
      window.electronAPI.ipcRenderer.invoke("auth:check"),
      window.electronAPI.ipcRenderer.invoke("loadSettings")
    ]).then(([availability, settings]) => ({
      availability,
      required: settings && settings.requireDeviceAuth === true
    }))`);
    if (!auth || typeof auth.availability !== "string" || typeof auth.required !== "boolean") {
      throw new Error("Could not read device-authentication state from the packaged wallet");
    }
    fs.writeFileSync(path.join(diagnostics, "auth-check.txt"), JSON.stringify(auth, null, 2) + "\n");
    const seen = assertLandingScreen(settled, { deviceAuth: auth.required && auth.availability === "available" });
    console.log(
      seen.screen === "lock"
        ? "\nThe packaged wallet started and stopped at its device-authentication lock screen, named correctly."
        : "\nThe packaged wallet started and a profile with no wallet landed on the onboarding welcome.",
    );
    devtools.close();
    stop();
    process.exit(0);
  } catch (error) {
    await writeDiagnostics(devtools, diagnostics, {
      "process-output.log": output.trim() || "(nothing)",
      "throwaway-home.txt": listTree(home),
      "screen.txt": settledForDiagnostics || "(never settled)",
      "failure.txt": String(error && error.stack ? error.stack : error),
    });
    if (devtools) devtools.close();
    stop();
    console.error(`\n${error.message}`);
    console.error(`\nDiagnostics written to ${diagnostics} and uploaded with the build artifacts.`);
    console.error(`\nLast output:\n${output.trim().split("\n").slice(-30).join("\n")}`);
    process.exit(1);
  }
})();
