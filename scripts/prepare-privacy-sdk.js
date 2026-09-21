// Apply the reviewed SDK integration snapshot to its exact upstream base.
// This is a test artifact input, not a claim that SDK release gates passed.
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { execFileSync } = require("child_process");

const root = path.resolve(__dirname, "..");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "patches/privacy-sdk-v2.json"), "utf8"));
const patch = path.join(root, "patches/privacy-sdk-v2.patch");
const checkout = path.join(root, "vendor/zingolib");
const hash = crypto.createHash("sha256").update(fs.readFileSync(patch)).digest("hex");
if (hash !== manifest.patchSha256) throw new Error("SDK patch digest mismatch");
const head = execFileSync("git", ["rev-parse", "HEAD"], { cwd: checkout, encoding: "utf8" }).trim();
if (head !== manifest.baseRevision) throw new Error("SDK base revision mismatch");
const dirty = execFileSync("git", ["status", "--porcelain"], { cwd: checkout, encoding: "utf8" }).trim();
if (dirty) throw new Error("SDK checkout is not clean; preserve its changes and use a fresh checkout");
execFileSync("git", ["apply", "--check", patch], { cwd: checkout, stdio: "inherit" });
execFileSync("git", ["apply", patch], { cwd: checkout, stdio: "inherit" });
console.log(`Prepared SDK integration snapshot ${hash} on ${head}.`);
