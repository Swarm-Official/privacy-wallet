/**
 * The version this application shows.
 *
 * It is the SWARM Wallet's own, not upstream's: "v2.0.26 (188)" is Zingo PC's
 * release number and means nothing about which SWARM build a user is running.
 * Upstream's version keeps its place in the About box beside the licence,
 * which is where the attribution belongs.
 *
 * There is one version per network the wallet is packaged for, because the two
 * packages are two applications on a machine — different app ids, installed
 * side by side — and a single number could not say which of them you have.
 * The numbers live in `src/buildProfile.json` with the rest of that build's
 * identity, so electron-builder names the installer exactly what the About box
 * displays; the file is read here rather than restated, or the two would drift.
 *
 * `bin/prep-release.js` rewrites this file from package.json on an upstream
 * release; it is not part of the build, so these values stand until a SWARM
 * release changes them deliberately.
 */
import { BUILD_IDENTITY } from "./utils/buildIdentity";

const APP_VERSION: string = BUILD_IDENTITY.version;

/** Upstream's release, for the About box. */
export const UPSTREAM_VERSION = "2.0.26 (188)";

export default APP_VERSION;
