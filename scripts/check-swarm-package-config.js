const { getConfig, validateConfiguration } = require("app-builder-lib/out/util/config/config");
const { DebugLogger } = require("builder-util");

(async () => {
  const config = await getConfig(process.cwd(), "configs/swarm-testnet-builder.cjs", null);
  await validateConfiguration(config, new DebugLogger(false));
  if (config.win.azureSignOptions || config.afterSign || config.afterAllArtifactBuild) {
    throw new Error("Unsigned integration build unexpectedly enables signing hooks");
  }
  if (config.extraMetadata.name !== "swarm-wallet-testnet" || config.win.protocols.length !== 0) {
    throw new Error("Project identity or protocol registration is incorrect");
  }
  if (config.productName !== "SWARM Wallet (Testnet)" || config.extraMetadata.productName !== config.productName) {
    throw new Error("The packaged product is not named SWARM Wallet (Testnet)");
  }
  if (!config.win.icon.includes("resources/swarm/")) {
    throw new Error("The Windows build does not use the SWARM icon");
  }
  console.log("SWARM Windows packaging configuration is valid.");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
