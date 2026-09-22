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
const { waitForFirstScreen, waitForSettledScreen, writeDiagnostics, listTree, assertLandingScreen } = require("./swarm-first-screen");
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
const diagnostics = path.join(dist, "smoke-diagnostics");
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

// Which stage the script is in. A smoke run has five of them and they fail in
// very different ways — a landing screen that is wrong is a defect in the
// application, a missing installer is a packaging mistake — so the failure
// names the stage rather than leaving the next reader to infer it from the job
// log.
let stage = "starting";
const at = (next) => {
  stage = next;
  console.log(`\n== ${next} ==`);
};

const fail = (why, extra) => {
  // Top level, beside the per-run subdirectories: the first thing somebody
  // opening the diagnostics artifact should see is which stage stopped it.
  try {
    fs.mkdirSync(diagnostics, { recursive: true });
    fs.writeFileSync(
      path.join(diagnostics, "failure.txt"),
      `stage: ${stage}\n\n${why}\n${extra ? `\n${extra}\n` : ""}`,
    );
  } catch (error) {
    console.error(`could not write failure.txt: ${error.message}`);
  }
  console.error(`\n[${stage}] ${why}`);
  if (extra) console.error(extra);
  process.exit(1);
};

/**
 * Starts `exe`, waits for the renderer's first paint, and answers with the
 * user-data directory the application chose — which is the directory its own
 * startup log turned up in.
 */
/**
 * Starts `exe`, waits for its first screen over DevTools, and answers with
 * the user-data directory the application chose.
 *
 * The directory is found, not assumed: the app writes startup.log into
 * `app.getPath('userData')`, so searching the throwaway profile for that file
 * is what tells us where it went. Computing the path from the product name is
 * what made the Linux and macOS runs time out having never spoken to the app.
 */
const startAndFindUserData = async (exe, label) => {
  at(`${label} smoke`);
  const port = devtoolsPort++;
  console.log(`\n${label}: starting ${exe}`);
  const child = spawn(exe, [`--remote-debugging-port=${port}`], { env, stdio: ["ignore", "pipe", "pipe"] });
  let output = "";
  child.stdout.on("data", (c) => (output += c));
  child.stderr.on("data", (c) => (output += c));

  let devtools = null;
  try {
    const result = await waitForFirstScreen(port, TIMEOUT_MS);
    devtools = result.devtools;
    await writeDiagnostics(devtools, path.join(diagnostics, label), {
      "process-output.log": output.trim() || "(nothing)",
      "throwaway-profile.txt": listTree(sandbox),
      "screen.txt": result.text || "(empty)",
    });
    if (result.timedOut) {
      throw new Error(
        `the page never finished loading within ${TIMEOUT_MS / 1000}s ` +
          `(document.readyState = ${result.readyState ?? "unknown"})`,
      );
    }
    console.log(`\n--- ${label}: first paint ---\n${result.text}\n------------------------------`);
    // A GitHub Windows runner has no Windows Hello enrolled, so the gate
    // succeeds silently and the app routes on to where a profile with no wallet
    // belongs. The owner's PC does have Hello and will correctly stop at the
    // lock screen instead — which is why `deviceAuth` is false only here.
    //
    // The landing screen, not the first paint: the first words on the page
    // caught the dashboard mid-flight and reported it as where a new user lands
    // (defect W-6).
    const settled = await waitForSettledScreen(devtools);
    console.log(`\n--- ${label}: landing screen ---\n${settled}\n--------------------------------`);
    // Into this run's own subdirectory: this function runs twice, and the
    // portable run's evidence must survive the installed one.
    await writeDiagnostics(devtools, path.join(diagnostics, label), {
      "screen.txt": settled || "(empty)",
      "first-paint.txt": result.text || "(empty)",
    });
    assertLandingScreen(settled, { deviceAuth: false });

    const startupLog = findUnder(sandbox, (full) => path.basename(full) === "startup.log");
    const userData = startupLog ? path.dirname(startupLog) : null;
    console.log(`${label}: userData = ${userData ?? "(no startup.log found under the throwaway profile)"}`);

    devtools.close();
    try {
      child.kill();
    } catch {
      /* already gone */
    }
    spawnSync("taskkill", ["/IM", EXECUTABLE, "/F"], { stdio: "ignore" });
    return { userData, screen: settled };
  } catch (error) {
    await writeDiagnostics(devtools, path.join(diagnostics, label), {
      "process-output.log": output.trim() || "(nothing)",
      "throwaway-profile.txt": listTree(sandbox),
      "failure.txt": String(error && error.stack ? error.stack : error),
    });
    if (devtools) devtools.close();
    spawnSync("taskkill", ["/IM", EXECUTABLE, "/F"], { stdio: "ignore" });
    fail(`${label}: ${error.message}`, output.trim().split("\n").slice(-25).join("\n"));
  }
};
(async () => {
  // 1. The portable build, exactly as somebody unzipping would run it.
  at("locating the portable build");
  const portable = path.join(dist, "win-unpacked", EXECUTABLE);
  if (!fs.existsSync(portable)) fail(`no portable build at ${portable}`);
  const fromZip = await startAndFindUserData(portable, "portable");

  // 2. The installer, silently.
  at("locating the one-click installer");
  const setup = findUnder(dist, (full) => full.endsWith("-setup.exe"));
  if (!setup) fail("no one-click installer in dist");
  console.log(`\ninstaller: running ${path.basename(setup)} /S`);
  at("installer /S");
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

  at("userData comparison");
  if (!fromZip.userData || !fromInstaller.userData) {
    fail(
      "could not find startup.log under the throwaway profile for one of the builds, so the two " +
        "could not be compared:\n" +
        `  portable  ${fromZip.userData ?? "(not found)"}\n  installed ${fromInstaller.userData ?? "(not found)"}`,
    );
  }
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
  at("uninstall /S");
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
