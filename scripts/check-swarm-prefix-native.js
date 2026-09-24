// A public address from a disposable zero-balance old-build wallet. No keys.
const assert = require("assert/strict");
const path = require("path");
const native = require(path.resolve(process.argv[2] || "src/native.node"));
const legacy = "utest18z7h64gzyjgfpuch39v2dd3g766scdzc0qdsa9qj5tawzd0n6d88dl3vyyx6elk6mcemdd6wtkd3unnvutd3sdpd3jjvgs7lz4uas7rv25d26pnryp6tczmfapqze6ggdy7645kkevh8r980zxzcyj6d9dsplukx0htsym5xsqtwaka4";
(async () => {
  const old = JSON.parse(await native.parse_address(legacy));
  assert.equal(old.status, "success");
  assert.equal(old.chain_name, "test");
  assert(old.only_orchard_ua.startsWith("swarm1"));
  const canonical = JSON.parse(await native.parse_address(old.only_orchard_ua));
  assert.equal(canonical.status, "success");
  assert.equal(canonical.only_orchard_ua, old.only_orchard_ua);
  assert.deepEqual(canonical.receivers_available, ["orchard"]);
  for (const invalid of [old.only_orchard_ua.replace("swarm", "SwarM"), old.only_orchard_ua.slice(0, -1) + (old.only_orchard_ua.endsWith("q") ? "p" : "q")]) {
    assert.notEqual(JSON.parse(await native.parse_address(invalid)).status, "success");
  }
  console.log("Native prefix checks passed: legacy decode, canonical SWARM encoding, mixed-case/checksum rejection.");
})().catch((error) => { console.error(error); process.exitCode = 1; });
