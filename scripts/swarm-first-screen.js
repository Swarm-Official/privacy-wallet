// Reads the packaged wallet's first screen over the DevTools protocol, and
// says everything it can when that fails.
//
// Two lessons are built into this file.
//
// The first: "the process started" is not the question. Defect W-5 shipped a
// build that started perfectly and told its first user "No server configured"
// when a server was configured. Only the words on the screen catch that.
//
// The second: the readiness signal must be something the app is *observed* to
// produce, not something inferred. The first version of this waited for a line
// in the app's own startup.log at a path computed from the product name, and
// on Linux and macOS that file never appeared where it was expected — so the
// check timed out after ninety seconds having never once spoken to the app,
// even though DevTools was listening the whole time. DevTools is now the
// signal, because DevTools is what was demonstrably there.
//
// Node 22 has a WebSocket client built in, so this needs no dependency.
const fs = require("fs");
const path = require("path");

const ATTACH_TIMEOUT_MS = 60_000;
const CALL_TIMEOUT_MS = 20_000;

/** A minimal DevTools protocol client over one page target. */
class Devtools {
  constructor(socket) {
    this.socket = socket;
    this.nextId = 1;
    this.pending = new Map();
    this.events = [];
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (message.id && this.pending.has(message.id)) {
        const { resolve, reject } = this.pending.get(message.id);
        this.pending.delete(message.id);
        message.error ? reject(new Error(JSON.stringify(message.error))) : resolve(message.result);
        return;
      }
      if (message.method) this.events.push(message);
    });
  }

  static async attach(port, deadline = Date.now() + ATTACH_TIMEOUT_MS) {
    for (;;) {
      try {
        const response = await fetch(`http://127.0.0.1:${port}/json/list`);
        const targets = await response.json();
        const page = targets.find((t) => t.type === "page" && t.webSocketDebuggerUrl);
        if (page) {
          const socket = new WebSocket(page.webSocketDebuggerUrl);
          await new Promise((resolve, reject) => {
            socket.addEventListener("open", resolve, { once: true });
            socket.addEventListener("error", () => reject(new Error("DevTools socket failed")), { once: true });
          });
          return new Devtools(socket);
        }
      } catch {
        /* the port is not up yet */
      }
      if (Date.now() > deadline) throw new Error(`no DevTools page target on port ${port}`);
      await new Promise((resolve) => setTimeout(resolve, 400));
    }
  }

  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`${method} did not answer within ${CALL_TIMEOUT_MS / 1000}s`));
      }, CALL_TIMEOUT_MS);
      this.pending.set(id, {
        resolve: (value) => {
          clearTimeout(timer);
          resolve(value);
        },
        reject: (error) => {
          clearTimeout(timer);
          reject(error);
        },
      });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate(expression) {
    const { result } = await this.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    return result?.value;
  }

  close() {
    try {
      this.socket.close();
    } catch {
      /* already closed */
    }
  }
}

/**
 * Waits until the page has loaded and has text on it, then returns that text.
 *
 * Collects console output and uncaught exceptions from the moment it attaches,
 * so a renderer that throws on a fresh profile is reported rather than being
 * indistinguishable from one that is merely slow.
 */
async function waitForFirstScreen(port, timeoutMs = 90_000) {
  const devtools = await Devtools.attach(port);
  await devtools.send("Runtime.enable").catch(() => {});
  await devtools.send("Log.enable").catch(() => {});
  await devtools.send("Page.enable").catch(() => {});

  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const state = await devtools.evaluate("document.readyState").catch(() => null);
    const text = await devtools.evaluate("document.body ? document.body.innerText : ''").catch(() => "");
    if (state === "complete" && typeof text === "string" && text.trim().length > 0) {
      return { devtools, text: text.replace(/\n{2,}/g, "\n").trim(), readyState: state };
    }
    if (Date.now() > deadline) {
      return { devtools, text: typeof text === "string" ? text : "", readyState: state, timedOut: true };
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
}

/**
 * Everything worth having when this goes wrong, written where CI can upload
 * it: what was on screen, what the renderer said, and the profile the app
 * actually used. The next failure should cost one look, not another build.
 */
async function writeDiagnostics(devtools, outDir, extra = {}) {
  fs.mkdirSync(outDir, { recursive: true });
  const write = (name, body) => {
    try {
      fs.writeFileSync(path.join(outDir, name), body);
    } catch (error) {
      console.error(`could not write ${name}: ${error.message}`);
    }
  };

  for (const [name, value] of Object.entries(extra)) write(name, String(value));

  if (!devtools) return;
  try {
    const shot = await devtools.send("Page.captureScreenshot", { format: "png" });
    if (shot?.data) write("first-screen.png", Buffer.from(shot.data, "base64"));
  } catch (error) {
    write("first-screen.png.error.txt", error.message);
  }
  const consoleLines = devtools.events
    .filter((e) => e.method === "Runtime.consoleAPICalled" || e.method === "Log.entryAdded" || e.method === "Runtime.exceptionThrown")
    .map((e) => JSON.stringify(e));
  write("renderer-console.log", consoleLines.join("\n") || "(nothing)");
  try {
    const html = await devtools.evaluate("document.documentElement.outerHTML");
    if (typeof html === "string") write("first-screen.html", html);
  } catch {
    /* the page is gone */
  }
}

/** A recursive listing of a directory, for finding where the profile went. */
function listTree(root, limit = 400) {
  const lines = [];
  const walk = (dir, depth) => {
    if (lines.length >= limit || depth > 6) return;
    let entries = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (lines.length >= limit) return;
      const full = path.join(dir, entry.name);
      lines.push(entry.isDirectory() ? `${full}${path.sep}` : full);
      if (entry.isDirectory()) walk(full, depth + 1);
    }
  };
  walk(root, 0);
  return lines.join("\n") || "(empty)";
}

/**
 * Checks where a profile with no wallet lands, in two stages, because that
 * depends on whether the machine has device authentication available and the
 * wallet's security setting requires it.
 *
 * Where it does — a Mac with Touch ID enrolled, or a PC with Windows Hello — the
 * landing screen is the lock screen, and everything else is behind it. Where it
 * does not, the gate succeeds silently and the app routes on: a throwaway
 * profile has no wallet, so it belongs on the onboarding welcome, which says
 * what this is and offers to create or restore one.
 *
 * Stage one applies to both and is where the branding and W-5 regressions would
 * show: this application's own name, never upstream's, and never "No server
 * configured".
 *
 * Stage two is the routing. Before defect W-6 was fixed, the same profile
 * landed on the dashboard — six nav items, a row of zeroes, and no way to make
 * a wallet — so the dashboard appearing here is a failure with a name, not an
 * unrecognised screen. `deviceAuth` says which case the caller is in, so a lock
 * screen where onboarding was expected (or the reverse) is reported rather than
 * quietly accepted. The caller reads availability and the saved requirement
 * from the packaged app, rather than guessing from the operating system.
 *
 * The lock is never passed in CI. There is no device to authenticate with and
 * nothing here should behave as though there were.
 */
function assertLandingScreen(text, { deviceAuth = false } = {}) {
  if (/No server configured/i.test(text)) {
    throw new Error(
      "The landing screen says 'No server configured'. A fresh profile is configured with the SWARM " +
        "server on first run, so this is the defect W-5 regression.",
    );
  }
  if (/\bZingo\b/i.test(text)) {
    throw new Error("The landing screen names Zingo. This application is SWARM Wallet.");
  }
  if (!/\bSWARM\b/.test(text)) {
    throw new Error("The landing screen does not name this application.");
  }

  const locked = /is locked/i.test(text);
  if (locked) {
    if (!/v\d+\.\d+\.\d+/.test(text)) {
      throw new Error("The lock screen does not show a version.");
    }
    if (!deviceAuth) {
      throw new Error(
        "Expected the onboarding screen, but this machine showed the device-authentication lock " +
          "screen. On a runner with no device authentication the gate succeeds silently, so a lock " +
          "screen here means that assumption no longer holds.",
      );
    }
    return { screen: "lock" };
  }

  if (deviceAuth) {
    throw new Error(
      "Expected the device-authentication lock screen on this machine, but the app went straight " +
        "past it. The lock must not be bypassable.",
    );
  }

  // Defect W-6: a profile with no wallet used to land here.
  if (/\bOverview\b/.test(text) && !/Create a new wallet/i.test(text)) {
    throw new Error(
      "A profile with no wallet landed on the dashboard, which shows nothing and offers no way to " +
        "make a wallet. This is defect W-6. The landing screen should be the onboarding welcome.",
    );
  }

  if (!/Create a new wallet/i.test(text) || !/I already have a recovery phrase/i.test(text)) {
    throw new Error(
      "A profile with no wallet did not land on the onboarding welcome: neither 'Create a new " +
        "wallet' nor 'I already have a recovery phrase' is offered (defect W-6).",
    );
  }
  if (!/SWARM Testnet/.test(text)) {
    throw new Error("The onboarding screen does not name the network this build is for.");
  }
  return { screen: "onboarding" };
}


/**
 * The screen once it has stopped changing.
 *
 * The first paint is not the landing screen: the app renders, then decides
 * where a profile with no wallet belongs and navigates there. Capturing at the
 * first words on the page caught the dashboard mid-flight and reported it as
 * where a new user lands (defect W-6). This waits for the text to hold still,
 * so what is asserted is where they actually end up.
 */
async function waitForSettledScreen(devtools, settleMs = 10000, quietMs = 1500) {
  const deadline = Date.now() + settleMs;
  let last = null;
  let lastChange = Date.now();
  for (;;) {
    const text = await devtools.evaluate("document.body ? document.body.innerText : ''").catch(() => null);
    if (typeof text === 'string' && text !== last) {
      last = text;
      lastChange = Date.now();
    }
    if (Date.now() - lastChange >= quietMs || Date.now() > deadline) {
      return (last ?? "").replace(/\n{2,}/g, "\n").trim();
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
}

module.exports = { Devtools, waitForFirstScreen, waitForSettledScreen, writeDiagnostics, listTree, assertLandingScreen };
