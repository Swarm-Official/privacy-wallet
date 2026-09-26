import buildProfileFile from "../buildProfile.json";

/**
 * Which SWARM network this build was packaged for, and the identity it was
 * packaged under.
 *
 * One file, read by four things that must agree: this module (the renderer's
 * name and version), `public/electron.js` (the window title and the keychain
 * entry, which reach it through the packaged package.json that
 * electron-builder writes from the same record), `configs/swarm-builder.cjs`
 * (product name, app id, installer file name) and the workflows (which artifact
 * a run uploads). The build of 2026-09-26 is why: it carried the real mainnet
 * genesis and called itself "SWARM Wallet (Testnet)" 0.1.0-testnet.9, because
 * those four facts lived in four places and only the genesis had been moved.
 *
 * `scripts/set-build-profile.js` is the only thing that writes the selection,
 * from `SWARM_NETWORK_PROFILE` — the same workflow input that decides which
 * artifact comes out. Nothing here can name a network the file does not list,
 * so upstream Zcash's `main` cannot arrive by way of this route either.
 */
export type BuildIdentity = {
  /** The version this build shows and is named after. */
  readonly version: string;
  /** What the installed application is called. */
  readonly productName: string;
  /** The executable's own name — no parentheses, so it can be quoted. */
  readonly executableName: string;
  /**
   * The Windows/macOS/Linux application id. Distinct per network on purpose:
   * two different ids are two different applications, so the mainnet wallet
   * installs BESIDE a testnet one rather than over it, and neither uninstall
   * entry removes the other.
   */
  readonly appId: string;
  /** The `name` electron-builder writes into the packaged package.json. */
  readonly packageName: string;
  readonly description: string;
  /** What a CI artifact of this build is called. */
  readonly artifactSuffix: string;
};

/** Every identity this repository can be packaged under, by network. */
export const BUILD_IDENTITIES: Readonly<Record<string, BuildIdentity>> = buildProfileFile.profiles;

/** The network label this build was packaged for. */
export const BUILD_PROFILE_ID: string = buildProfileFile.profile;

/**
 * The identity for a network label, or an error naming what is on offer.
 *
 * It throws rather than falling back, because every fallback here is a build
 * that says one thing and does another.
 */
export const buildIdentityFor = (profileId: string): BuildIdentity => {
  const identity = BUILD_IDENTITIES[profileId];
  if (!identity) {
    throw new Error(
      `'${profileId}' is not a network this application can be built for. ` +
        `On offer: ${Object.keys(BUILD_IDENTITIES).join(", ")}.`,
    );
  }
  return identity;
};

/** The identity THIS build carries. */
export const BUILD_IDENTITY: BuildIdentity = buildIdentityFor(BUILD_PROFILE_ID);
