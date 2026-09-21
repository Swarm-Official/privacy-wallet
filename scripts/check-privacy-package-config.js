const { getConfig, validateConfiguration } = require("app-builder-lib/out/util/config/config");
const { DebugLogger } = require("builder-util");

(async () => {
  const config = await getConfig(process.cwd(), "configs/privacy-testnet-builder.cjs", null);
  await validateConfiguration(config, new DebugLogger(false));
  if (config.win.azureSignOptions || config.afterSign || config.afterAllArtifactBuild) {
    throw new Error("Unsigned integration build unexpectedly enables signing hooks");
  }
  if (config.extraMetadata.name !== "privacy-wallet-testnet" || config.win.protocols.length !== 0) {
    throw new Error("Project identity or protocol registration is incorrect");
  }
  console.log("Privacy Windows packaging configuration is valid.");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
