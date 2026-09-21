"""Restore a verified prior compilation when only the Electron main process changes."""
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import zipfile

BASE = "86f8effa3130859287fbb756c4ccd398e5b65ce1"
RUN = 35551225836
ARTIFACT = 10619082430
DIGEST = "e7906f6eac2f762d2b8587a4a76b3bb63c3a0908507613364eeec5fe4c796fb4"
REPO = "brs-holding/privacy-wallet"

run = json.loads(subprocess.check_output(["gh", "api", f"repos/{REPO}/actions/runs/{RUN}"]))
if run["conclusion"] != "success" or run["head_sha"] != BASE:
    raise RuntimeError("The pinned source compilation did not succeed")
changed = subprocess.check_output(["git", "diff", "--name-only", BASE, "HEAD", "--", "src", "native", "config", "package.json", "yarn.lock", "public", "scripts/build.js", "patches"], text=True).splitlines()
if any(path != "public/electron.js" for path in changed):
    raise RuntimeError(f"Compiled input sources changed: {changed}")
archive = Path("compiled-inputs.zip")
with archive.open("wb") as output:
    subprocess.run(["gh", "api", f"repos/{REPO}/actions/artifacts/{ARTIFACT}/zip"], stdout=output, check=True)
with archive.open("rb") as stream:
    if hashlib.file_digest(stream, "sha256").hexdigest() != DIGEST:
        raise RuntimeError("Compiled artifact digest mismatch")
destination = Path("compiled").resolve()
destination.mkdir(exist_ok=False)
with zipfile.ZipFile(archive) as package:
    for member in package.infolist():
        (destination / member.filename).resolve().relative_to(destination)
    package.extractall(destination)
if (destination / "compile-source-commit.txt").read_text(encoding="utf-8-sig").strip() != BASE:
    raise RuntimeError("Compiled source manifest mismatch")
for relative in ("build", "resources/vcruntime"):
    shutil.copytree(destination / relative, relative, dirs_exist_ok=True)
for relative in ("src/native.node", "resources/nym-proxy.exe", "node_modules/keytar/build/Release/keytar.node"):
    target = Path(relative)
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(destination / relative, target)
if (destination / "native/Cargo.lock").read_bytes() != Path("native/Cargo.lock").read_bytes():
    raise RuntimeError("Native dependency lock differs from compilation")
if (destination / "patches/privacy-sdk-v2.json").read_bytes() != Path("patches/privacy-sdk-v2.json").read_bytes():
    raise RuntimeError("SDK snapshot differs from compilation")
Path("compiled-provenance.json").write_text(json.dumps({"sourceCommit": BASE, "workflowRun": RUN, "artifactId": ARTIFACT, "artifactSha256": DIGEST, "changedRuntimeSource": "public/electron.js", "nativeRecompiled": False}, indent=2) + "\n", encoding="utf-8")
print("Verified compiled modules restored; only the reviewed Electron main process will change.")
