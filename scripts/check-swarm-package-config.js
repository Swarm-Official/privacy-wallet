const { getConfig, validateConfiguration } = require("app-builder-lib/out/util/config/config");
const { DebugLogger } = require("builder-util");

(async () => {
  const config = await getConfig(process.cwd(), "configs/swarm-builder.cjs", null);
  await validateConfiguration(config, new DebugLogger(false));
  if (config.win.azureSignOptions || config.afterSign || config.afterAllArtifactBuild) {
    throw new Error("Unsigned integration build unexpectedly enables signing hooks");
  }
  // The identity is per network now, so the check is that the config says
  // exactly what src/buildProfile.json says for the profile this build selected
  // — not a literal, which is how a build carrying the mainnet genesis passed
  // every check while calling itself "SWARM Wallet (Testnet)" 0.1.0-testnet.9.
  const buildProfile = require("../src/buildProfile.json");
  const identity = buildProfile.profiles[buildProfile.profile];
  if (!identity) {
    throw new Error(`src/buildProfile.json selects '${buildProfile.profile}', which it does not describe`);
  }
  if (config.extraMetadata.name !== identity.packageName || config.win.protocols.length !== 0) {
    throw new Error("Project identity or protocol registration is incorrect");
  }
  if (config.productName !== identity.productName || config.extraMetadata.productName !== config.productName) {
    throw new Error(`The packaged product is not named ${identity.productName}`);
  }
  if (config.appId !== identity.appId) {
    throw new Error(`The packaged app id is ${config.appId}, not ${identity.appId}`);
  }
  if (config.extraMetadata.version !== identity.version) {
    throw new Error(`The packaged version is ${config.extraMetadata.version}, not ${identity.version}`);
  }
  if (config.extraMetadata.swarmNetworkProfile !== buildProfile.profile) {
    throw new Error("The package does not record which SWARM network it was built for");
  }
  if (!config.win.icon.includes("resources/swarm/")) {
    throw new Error("The Windows build does not use the SWARM icon");
  }
  console.log(`SWARM packaging configuration is valid: ${identity.productName} ${identity.version} (${buildProfile.profile}), app id ${identity.appId}.`);
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
