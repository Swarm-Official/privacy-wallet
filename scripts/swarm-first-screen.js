// Reads the text of the packaged wallet's first screen, and checks the header
// says something true on a profile that has never been used.
//
// "The process started" is not the question. Defect W-5 shipped a build that
// started perfectly and told its first user "No server configured" when a
// server was configured — nothing that watched for a running process or a
// rendered window would have caught it. So this reads what is actually on the
// screen, over the DevTools protocol, and asserts on the words.
//
// Node 22 has a WebSocket client built in, so talking to the protocol needs no
// dependency. The app is started with --remote-debugging-port by the caller.
const EVALUATE_TIMEOUT_MS = 20_000;

/** The DevTools page target for a running Electron app. */
async function pageTarget(port) {
  const deadline = Date.now() + EVALUATE_TIMEOUT_MS;
  for (;;) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/list`);
      const targets = await response.json();
      const page = targets.find((t) => t.type === "page" && t.webSocketDebuggerUrl);
      if (page) return page;
    } catch {
      /* the port is not up yet */
    }
    if (Date.now() > deadline) throw new Error(`no DevTools page on port ${port}`);
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
}

/** `document.body.innerText` of the running app. */
async function readScreen(port) {
  const target = await pageTarget(port);
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  try {
    await new Promise((resolve, reject) => {
      socket.addEventListener("open", resolve, { once: true });
      socket.addEventListener("error", () => reject(new Error("DevTools socket failed")), { once: true });
    });
    const text = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("DevTools did not answer")), EVALUATE_TIMEOUT_MS);
      socket.addEventListener("message", (event) => {
        const message = JSON.parse(event.data);
        if (message.id !== 1) return;
        clearTimeout(timer);
        const result = message.result?.result;
        if (!result || typeof result.value !== "string") {
          reject(new Error(`unexpected evaluate result: ${JSON.stringify(message)}`));
          return;
        }
        resolve(result.value);
      });
      socket.send(
        JSON.stringify({
          id: 1,
          method: "Runtime.evaluate",
          params: { expression: "document.body.innerText", returnByValue: true },
        }),
      );
    });
    return text;
  } finally {
    try {
      socket.close();
    } catch {
      /* already closed */
    }
  }
}

/**
 * Checks the first screen of a never-used profile and returns its text.
 *
 * Throws with the screen's own words when it says the thing W-5 was.
 */
async function checkFirstScreen(port) {
  const screen = await readScreen(port);
  const shown = screen.replace(/\n{2,}/g, "\n").trim();
  console.log("\n--- first screen ---\n" + shown + "\n--------------------");

  if (/No server configured/i.test(screen)) {
    throw new Error(
      "The first screen says 'No server configured'. A fresh profile is configured with the SWARM " +
        "server on first run, so this is the defect W-5 regression.",
    );
  }
  if (!/lwd\.swarm\.green/.test(screen)) {
    throw new Error("The first screen does not name the server the profile is configured for.");
  }
  return shown;
}

module.exports = { readScreen, checkFirstScreen };
