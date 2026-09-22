// Installs the one-click Windows installer, starts what it installed, proves
// it looks for a wallet in the same place the portable zip does, and uninstalls.
//
// The question worth answering is not "does the installer run" but "does
// somebody who installed it find the wallet they already made with the zip".
// Both builds resolve their user-data directory from the product name, so they
// should agree — but "should" is how the last two defects got shipped. This
// checks it, and the check is direct: the packaged app writes startup.log
// *into* `app.getPath('userData')`, so where that file appears is the answer,
// with no need to modify the application to ask it.
//
// Everything happens inside a throwaway profile. APPDATA, LOCALAPPDATA and
// USERPROFILE are redirected, so the per-user install, its Start-menu entry
// and its desktop shortcut all land in a temporary directory: nothing is
// installed on the machine running this and no shortcut appears on anyone's
// desktop.
const { spawnSync } = require("child_process");
const { checkFirstScreen } = require("./swarm-first-screen");
const { spawn } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const PRODUCT = "SWARM Wallet (Testnet)";
const EXECUTABLE = "SWARM Wallet Testnet.exe";
const READY = "did-finish-load";
const TIMEOUT_MS = 120_000;
// One port per launch, so the portable and installed runs never collide.
let devtoolsPort = 9333;

const dist = path.resolve(__dirname, "../dist");
const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), "swarm-win-smoke-"));
const appData = path.join(sandbox, "AppData", "Roaming");
const localAppData = path.join(sandbox, "AppData", "Local");
for (const dir of [appData, localAppData, path.join(sandbox, "Desktop")]) {
  fs.mkdirSync(dir, { recursive: true });
}
const env = {
  ...process.env,
  APPDATA: appData,
  LOCALAPPDATA: localAppData,
  USERPROFILE: sandbox,
};

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

const fail = (why, extra) => {
  console.error(`\n${why}`);
  if (extra) console.error(extra);
  process.exit(1);
};

/**
 * Starts `exe`, waits for the renderer's first paint, and answers with the
 * user-data directory the application chose — which is the directory its own
 * startup log turned up in.
 */
const startAndFindUserData = (exe, label) =>
  new Promise((resolve) => {
    const expected = path.join(appData, PRODUCT);
    const startupLog = path.join(expected, "startup.log");
    fs.rmSync(expected, { recursive: true, force: true });

    console.log(`\n${label}: starting ${exe}`);
    const port = devtoolsPort++;
    const child = spawn(exe, [`--remote-debugging-port=${port}`], { env, stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    child.stdout.on("data", (c) => (output += c));
    child.stderr.on("data", (c) => (output += c));
    let exited = null;
    child.on("exit", (code) => (exited = code));

    const started = Date.now();
    const poll = () => {
      if (fs.existsSync(startupLog) && fs.readFileSync(startupLog, "utf8").includes(READY)) {
        const log = fs.readFileSync(startupLog, "utf8").trim();
        checkFirstScreen(port).then(
          (screen) => {
            try {
              child.kill();
            } catch {
              /* already gone */
            }
            spawnSync("taskkill", ["/IM", EXECUTABLE, "/F"], { stdio: "ignore" });
            console.log(`${label}: first screen names the configured server`);
            console.log(`${label}: userData = ${expected}`);
            resolve({ userData: expected, log, screen });
          },
          (error) => {
            spawnSync("taskkill", ["/IM", EXECUTABLE, "/F"], { stdio: "ignore" });
            fail(`${label}: the first screen is wrong — ${error.message}`);
          },
        );
        return;
      }
      if (exited !== null && Date.now() - started > 10_000) {
        fail(`${label}: exited (code ${exited}) before rendering`, output.trim().split("\n").slice(-25).join("\n"));
      }
      if (Date.now() - started > TIMEOUT_MS) {
        fail(`${label}: did not render within ${TIMEOUT_MS / 1000}s`, output.trim().split("\n").slice(-25).join("\n"));
      }
      setTimeout(poll, 500);
    };
    poll();
  });

(async () => {
  // 1. The portable build, exactly as somebody unzipping would run it.
  const portable = path.join(dist, "win-unpacked", EXECUTABLE);
  if (!fs.existsSync(portable)) fail(`no portable build at ${portable}`);
  const fromZip = await startAndFindUserData(portable, "portable");

  // 2. The installer, silently.
  const setup = findUnder(dist, (full) => full.endsWith("-setup.exe"));
  if (!setup) fail("no one-click installer in dist");
  console.log(`\ninstaller: running ${path.basename(setup)} /S`);
  const install = spawnSync(setup, ["/S"], { env, stdio: "inherit", timeout: 300_000 });
  if (install.status !== 0) fail(`the installer exited with ${install.status}`);

  const installed = findUnder(localAppData, (full) => path.basename(full) === EXECUTABLE);
  if (!installed) fail("the installer reported success but installed no executable under the sandbox");
  console.log(`installer: installed to ${installed}`);

  // The shortcuts it promised, in the sandbox rather than on a real desktop.
  const shortcut = findUnder(sandbox, (full) => full.endsWith(".lnk"));
  console.log(`installer: shortcut ${shortcut ? path.relative(sandbox, shortcut) : "NONE FOUND"}`);

  // 3. The installed build, and the comparison this whole script exists for.
  const fromInstaller = await startAndFindUserData(installed, "installed");

  if (fromZip.userData !== fromInstaller.userData) {
    fail(
      "the portable build and the installed build look for a wallet in different places:\n" +
        `  portable  ${fromZip.userData}\n  installed ${fromInstaller.userData}\n` +
        "Somebody who installed after using the zip would find an empty wallet.",
    );
  }
  console.log(`\nBoth builds resolve userData to ${fromInstaller.userData} — an existing wallet is found by either.`);

  // 4. Uninstall, silently, and check it took the program away and left the
  //    wallet alone.
  const uninstaller = findUnder(path.dirname(installed), (full) =>
    /^Uninstall .*\.exe$/i.test(path.basename(full)),
  );
  if (!uninstaller) fail(`no uninstaller beside ${installed}`);
  console.log(`\nuninstaller: running ${path.basename(uninstaller)} /S`);
  const remove = spawnSync(uninstaller, ["/S"], { env, stdio: "inherit", timeout: 300_000 });
  if (remove.status !== 0) console.warn(`the uninstaller exited with ${remove.status}`);
  // NSIS returns before it has finished deleting itself.
  const deadline = Date.now() + 60_000;
  while (fs.existsSync(installed) && Date.now() < deadline) {
    spawnSync("powershell", ["-NoProfile", "-Command", "Start-Sleep -Milliseconds 500"], { stdio: "ignore" });
  }
  console.log(`uninstaller: program removed  : ${!fs.existsSync(installed)}`);
  const walletKept = fs.existsSync(path.join(appData, PRODUCT));
  console.log(`uninstaller: user data kept   : ${walletKept}`);
  if (!walletKept) fail("the uninstaller removed the user's data; deleteAppDataOnUninstall must stay false");

  console.log("\nWindows installer smoke test passed.");
})().catch((error) => fail(String(error && error.stack ? error.stack : error)));
