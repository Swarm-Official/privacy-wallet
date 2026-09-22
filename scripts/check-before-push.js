// Everything CI checks that can be checked here, in the order CI checks it.
//
// Written after swarm-build-5 and swarm-unix-2 failed on all three platforms
// at the same step, for a lint error: an import placed below other statements.
// `tsc` was clean and 1463 tests passed, because neither of them runs eslint —
// only the production webpack build does, and it treats a lint error as fatal.
// Three platform builds were spent discovering a one-line fault that this
// catches in about a minute.
//
// `yarn neon` is the one thing not attempted: it needs a Rust toolchain for
// this platform, which this machine does not have, so `scripts/build.js`
// always ends by reporting a missing native module. That specific failure is
// expected here and is not treated as one.
const { spawnSync } = require("child_process");
const path = require("path");

const root = path.resolve(__dirname, "..");
const NATIVE_MISSING = "src/native.node not found";

const steps = [
  { name: "packaging configuration", command: "node", args: ["scripts/check-swarm-package-config.js"] },
  { name: "types", command: "npx", args: ["tsc", "--noEmit"] },
  {
    name: "tests",
    command: "node",
    args: ["scripts/test.js", "--watchAll=false", "--silent"],
    env: { CI: "true" },
    // One suite, src/utils/uris.test.js, loads the compiled native module to
    // exercise real address parsing, so it cannot run on a machine without a
    // Rust toolchain. Tolerated only when that is the whole story: every test
    // that did run passed, and the only suite that did not is that one for
    // that reason. A genuine test failure still stops the push.
    tolerate: (output) =>
      /Tests:\s+\d+ passed, \d+ total/.test(output) &&
      !/Tests:.*failed/.test(output) &&
      /Test Suites:\s+1 failed/.test(output) &&
      output.includes("Cannot find module '../native.node'"),
  },
  {
    name: "production build (lint is fatal here, and nowhere else)",
    command: "node",
    args: ["scripts/build.js"],
    env: { CI: "" },
    // The renderer compiling is the whole point; the missing native module is
    // this machine's limitation, not the build's.
    tolerate: (output) => output.includes("Compiled successfully") && output.includes(NATIVE_MISSING),
  },
  { name: "no upstream naming in the renderer", command: "node", args: ["scripts/check-swarm-bundle-strings.js", "--renderer", "build/static/js"] },
];

let failed = 0;
for (const step of steps) {
  process.stdout.write(`\n── ${step.name}\n`);
  const result = spawnSync(step.command, step.args, {
    cwd: root,
    encoding: "utf8",
    shell: process.platform === "win32",
    env: { ...process.env, ...(step.env ?? {}) },
  });
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  const ok = result.status === 0 || (step.tolerate ? step.tolerate(output) : false);
  if (ok) {
    if (step.tolerate && result.status !== 0) {
      console.log("   ok (tolerated: this machine has no Rust toolchain, so the native module is absent)");
    } else {
      console.log("   ok");
    }
    continue;
  }
  failed += 1;
  console.error(output.trim().split("\n").slice(-30).join("\n"));
  console.error(`   FAILED: ${step.name}`);
}

if (failed > 0) {
  console.error(`\n${failed} check(s) failed. Do not push.`);
  process.exitCode = 1;
} else {
  console.log("\nAll local checks passed. Note that the native module and the packaged");
  console.log("application are still only verified in CI.");
}
