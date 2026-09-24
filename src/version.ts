/**
 * The version this application shows.
 *
 * It is the SWARM Wallet's own, not upstream's: "v2.0.26 (188)" is Zingo PC's
 * release number and means nothing about which SWARM build a user is running.
 * Upstream's version keeps its place in the About box beside the licence,
 * which is where the attribution belongs.
 *
 * `bin/prep-release.js` rewrites this file from package.json on an upstream
 * release; it is not part of the build, so this value stands until a SWARM
 * release changes it deliberately.
 */
const APP_VERSION = "0.1.0-testnet.6";

/** Upstream's release, for the About box. */
export const UPSTREAM_VERSION = "2.0.26 (188)";

export default APP_VERSION;
