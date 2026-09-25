// Run after the pinned SDK, native module, Nym helper and frontend have been
// built per .github/workflows/swarm-wallet-unix.yml. Developer ID is selected
// from Keychain, and notarization uses a stored notarytool Keychain profile.
// No credentials or recovery material belong in this repo or command line.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const developerIdIdentity = require('./mac-distribution-identity.cjs');

const root = path.resolve(__dirname, '..');
const archFlag = process.argv.indexOf('--arch');
const arch = archFlag < 0 ? 'arm64' : process.argv[archFlag + 1];
if (!['arm64', 'x64'].includes(arch)) throw new Error(`Unsupported Mac architecture: ${arch}`);
const output = path.join(root, arch === 'x64' ? 'dist-mac-signed-x64' : 'dist-mac-signed');
const versionSource = fs.readFileSync(path.join(root, 'src/version.ts'), 'utf8');
const version = /const APP_VERSION = "([^"]+)"/.exec(versionSource)?.[1];
const profile = process.env.APPLE_KEYCHAIN_PROFILE;
const resume = process.argv.includes('--resume');
const app = path.join(output, arch === 'x64' ? 'mac' : 'mac-arm64', 'SWARM Wallet Testnet.app');
const dmgName = `SWARM-Wallet-${version}-${arch}.dmg`;
const zipName = `SWARM-Wallet-${version}-${arch}.zip`;
const dmg = path.join(output, dmgName);
const zip = path.join(output, zipName);
const sha = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

function run(command, args, options = {}) {
  return execFileSync(command, args, { cwd: root, stdio: 'inherit', ...options });
}

function requireCleanSource() {
  const changes = run('git', ['status', '--porcelain', '--untracked-files=normal'],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] }).trim();
  if (changes) throw new Error('Commit and review source changes before signing; HEAD must describe the built source');
}

if (process.platform !== 'darwin' || process.arch !== 'arm64') throw new Error('Build on an Apple-silicon Mac with native arm64 Node.js');
if (process.versions.node.split('.')[0] !== '24') throw new Error('Use Node.js 24 for the wallet');
if (!version) throw new Error('Cannot read the SWARM version from src/version.ts');
if (!profile) throw new Error('Set APPLE_KEYCHAIN_PROFILE to an owner-configured notarytool profile name');
for (const key of ['APPLE_ID', 'APPLE_APP_SPECIFIC_PASSWORD', 'APPLE_API_KEY', 'APPLE_API_KEY_ID', 'APPLE_API_ISSUER']) {
  if (process.env[key]) throw new Error(`Unset ${key}; notarization must use the Keychain profile`);
}
developerIdIdentity();
requireCleanSource();
try {
  run('xcrun', ['notarytool', 'history', '--keychain-profile', profile, '--output-format', 'json'],
    { stdio: ['ignore', 'pipe', 'pipe'] });
} catch {
  throw new Error(`Cannot use notarytool Keychain profile ${profile}; configure it locally before building`);
}
if (resume) {
  for (const file of [app, dmg, zip]) {
    if (!fs.existsSync(file)) throw new Error(`Cannot resume without generated output: ${file}`);
  }
  if (fs.existsSync(path.join(output, 'out'))) throw new Error('Signed release output already finalized');
} else if (fs.existsSync(output)) {
  throw new Error(`${output} exists; archive or remove previous generated output before rebuilding`);
}
for (const file of ['build/electron.js', 'build/native.node', 'resources/nym-proxy', 'sdk-source/LICENSE']) {
  if (!fs.existsSync(path.join(root, file))) throw new Error(`Missing build prerequisite: ${file}`);
}

run('node', ['scripts/check-swarm-sdk-pin.js', 'sdk-source', '--require-real-genesis']);
if (!resume) run('yarn', ['electron-builder', '--mac', `--${arch}`, '--config', 'configs/swarm-mac-developer-id.cjs', '--publish', 'never'],
  { env: { ...process.env, SWARM_MAC_ARCH: arch } });
run('node', ['scripts/check-swarm-macho-arch.js', `mac-${arch}`, output]);
run('codesign', ['--verify', '--deep', '--strict', '--verbose=2', app]);
run('xcrun', ['stapler', 'validate', app]);
run('spctl', ['--assess', '--type', 'execute', '--verbose=4', app]);
if (!process.argv.includes('--skip-smoke')) {
  run('node', ['scripts/swarm-smoke.js', 'mac'], { env: { ...process.env, SWARM_DIST: output } });
}

// electron-builder notarizes/staples the app before writing this DMG. Submit
// the final DMG as well, then staple its own ticket and rebuild the ZIP.
const result = JSON.parse(run('xcrun', [
  'notarytool', 'submit', dmg, '--keychain-profile', profile,
  '--wait', '--output-format', 'json',
], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] }));
if (result.status !== 'Accepted' || !/^[a-f0-9-]{36}$/i.test(result.id || '')) {
  throw new Error(`DMG notarization did not reach Accepted: ${JSON.stringify({ id: result.id, status: result.status })}`);
}
console.log(`DMG notarization accepted: ${result.id}`);
run('xcrun', ['stapler', 'staple', dmg]);
run('xcrun', ['stapler', 'validate', dmg]);
fs.rmSync(zip, { force: true });
run('ditto', ['-c', '-k', '--sequesterRsrc', '--keepParent', app, zip]);

const out = path.join(output, 'out');
fs.mkdirSync(out);
for (const file of [dmg, zip]) fs.copyFileSync(file, path.join(out, path.basename(file)));
const checksums = [dmgName, zipName].sort().map((name) => `${sha(path.join(out, name))} *${name}`).join('\n') + '\n';
fs.writeFileSync(path.join(out, 'SHA256SUMS'), checksums);
const binaries = {
  nym_proxy_sha256: sha(path.join(app, 'Contents/Resources/nym-proxy')),
  native_addon_sha256: sha(path.join(app, 'Contents/Resources/app.asar.unpacked/build/native.node')),
};
const manifest = {
  product: 'SWARM Wallet (Testnet)',
  version,
  app_id: 'green.swarm.wallet.testnet',
  platform: `darwin-${arch}`,
  signed: true,
  notarized: true,
  notary_submission_id: result.id,
  source_commit: run('git', ['rev-parse', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] }).trim(),
  sdk_commit: run('git', ['-C', 'sdk-source', 'rev-parse', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] }).trim(),
  binaries,
  files: [dmgName, zipName].sort().map((name) => ({ name, bytes: fs.statSync(path.join(out, name)).size, sha256: sha(path.join(out, name)) })),
};
fs.writeFileSync(path.join(out, 'release-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(checksums);
console.log(`Signed artifacts and manifest: ${out}`);
