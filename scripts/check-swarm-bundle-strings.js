// Refuses a build whose packaged application still shows the user upstream's
// name.
//
// This exists because a build shipped that said "Zingo PC is locked" on its
// unlock screen. Every check that ran beforehand looked at package metadata —
// the product name, the app id, the chain label — and all of them passed,
// because the string that was wrong lived in a renderer chunk inside
// app.asar. Nobody looked at the screen, correctly, and nothing looked at the
// bundle. This looks at the bundle.
//
// Two passes, because they need different instruments:
//
//   --asar <file>      Exact phrases a user could read, scanned across the
//                      whole packaged archive. Narrow enough that a source
//                      comment cannot trip it.
//
//   --renderer <dir>   Every remaining "Zingo" in the built renderer chunks.
//                      Blunt on purpose, and it can afford to be: the
//                      production build is minified, so comments are gone and
//                      what is left is what a user can be shown.
//
// Attribution is not a defect. The About box must say what this is built on,
// and the MIT licence requires the copyright notice to travel with the code,
// so those exact sentences are allowed by name — nothing broader, or the
// check would pass the thing it exists to catch.
const fs = require("fs");
const path = require("path");

const argv = process.argv.slice(2);
const valueOf = (flag) => {
  const at = argv.indexOf(flag);
  return at === -1 ? undefined : argv[at + 1];
};
const asarPath = valueOf("--asar");
const rendererDir = valueOf("--renderer");
if (!asarPath && !rendererDir) {
  throw new Error("give --asar <app.asar> and/or --renderer <build/static/js>");
}

// Sentences the licence and honest attribution require.
const ALLOWED = [
  "Based on Zingo PC ",
  "by ZingoLabs, under the MIT licence below.",
  "Built with Electron. Copyright (c) 2026, ZingoLabs.",
  "The MIT License (MIT) Copyright (c) 2026 ZingoLabs",
  // The wallet reports which SDK it runs; the SDK is called Zingolib.
  "Wallet SDK (Zingolib)",
];

// What must never reach a user's screen, wherever it is packaged.
const FORBIDDEN = [
  "Zingo PC is locked",
  "Unlock Zingo PC",
  "About Zingo PC",
  "Hide Zingo PC",
  "ZingoPC",
  "zingolabs.org",
  "github.com/zingolabs",
  "Thanks for supporting Zingo",
  "Zingo PC is taking too long",
  "Zingo PC could not start",
];

/** Every index at which `needle` occurs in `haystack`. */
const occurrences = (haystack, needle) => {
  const found = [];
  let at = haystack.indexOf(needle);
  while (at !== -1) {
    found.push(at);
    at = haystack.indexOf(needle, at + needle.length);
  }
  return found;
};

const problems = [];

/** `--asar` may name the file or the directory electron-builder wrote it under. */
const resolveAsar = (given) => {
  if (fs.existsSync(given) && fs.statSync(given).isFile()) return given;
  const roots = fs.existsSync(given) && fs.statSync(given).isDirectory() ? [given] : [];
  for (const root of roots) {
    const stack = [root];
    while (stack.length > 0) {
      const dir = stack.pop();
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) stack.push(full);
        else if (entry.name === "app.asar") return full;
      }
    }
  }
  throw new Error(`no packaged application at ${given}`);
};

if (asarPath) {
  const found = resolveAsar(asarPath);
  if (found !== asarPath) console.log(`Found the packaged application at ${found}.`);
  // Read as latin1 so every byte maps to one character and offsets stay true;
  // the asar is a prologue, a JSON index, then the files end to end.
  const packaged = fs.readFileSync(found, "latin1");
  for (const forbidden of FORBIDDEN) {
    const hits = occurrences(packaged, forbidden);
    if (hits.length > 0) problems.push(`app.asar: ${hits.length} x ${JSON.stringify(forbidden)}`);
  }
  console.log(`Scanned ${path.basename(found)} for ${FORBIDDEN.length} forbidden phrases.`);
}

if (rendererDir) {
  if (!fs.existsSync(rendererDir)) throw new Error(`no renderer bundle at ${rendererDir}`);
  const chunks = fs.readdirSync(rendererDir).filter((name) => name.endsWith(".js"));
  if (chunks.length === 0) throw new Error(`no .js chunks in ${rendererDir}`);
  let allowedKept = 0;
  for (const chunk of chunks) {
    const text = fs.readFileSync(path.join(rendererDir, chunk), "latin1");
    const allowedRanges = ALLOWED.flatMap((phrase) =>
      occurrences(text, phrase).map((at) => [at, at + phrase.length]),
    );
    allowedKept += allowedRanges.length;
    // Checked by position, so one allowed sentence cannot excuse a stray
    // occurrence elsewhere in the same chunk.
    const strays = occurrences(text, "Zingo").filter(
      (at) => !allowedRanges.some(([from, to]) => at >= from && at < to),
    );
    if (strays.length > 0) {
      const samples = strays
        .slice(0, 5)
        .map((at) => JSON.stringify(text.slice(Math.max(0, at - 50), at + 50)));
      problems.push(`${chunk}: ${strays.length} unexcused "Zingo"\n    ${samples.join("\n    ")}`);
    }
  }
  console.log(`Scanned ${chunks.length} renderer chunk(s); kept ${allowedKept} allowed attribution occurrence(s).`);
}

if (problems.length > 0) {
  console.error(`\nThe packaged application still shows upstream's name.\n  - ${problems.join("\n  - ")}`);
  process.exitCode = 1;
} else {
  console.log("No user-visible upstream naming in the packaged application.");
}
