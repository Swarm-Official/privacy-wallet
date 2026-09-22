/**
 * Builds the review harness with the application's own webpack configuration.
 *
 * The point of borrowing the real config rather than writing a second one is
 * that the screens are then compiled by the same loaders that compile them for
 * the packaged app — same CSS-module name mangling, same Babel targets — so a
 * screenshot taken here is a picture of what the build produces, not of a
 * lookalike assembled by different tooling.
 *
 *   node tools/build-harness.js [outdir]
 *
 * Nothing about the application build changes: the entry is swapped in memory,
 * the output goes to a directory of its own, and the type checker and linter
 * are switched off because this is a viewer, not a gate.
 */
process.env.NODE_ENV = "production";
process.env.BABEL_ENV = process.env.NODE_ENV;
process.env.DISABLE_ESLINT_PLUGIN = "true";
process.env.GENERATE_SOURCEMAP = "false";
process.env.PUBLIC_URL = "";

const path = require("path");
const fs = require("fs");
const webpack = require("webpack");

const root = path.resolve(__dirname, "..");
const outDir = path.resolve(root, process.argv[2] || "../_review/harness-build");

const configFactory = require(path.join(root, "config/webpack.config.js"));
const config = configFactory("production");

config.devtool = false;
config.entry = path.join(root, "src/devHarness/index.tsx");
config.output = {
  ...config.output,
  path: outDir,
  filename: "harness.js",
  chunkFilename: "[name].chunk.js",
  publicPath: "./",
};
config.optimization = {
  ...config.optimization,
  minimize: false,
  runtimeChunk: false,
  splitChunks: { cacheGroups: { default: false } },
};

// Drop the checkers and the dev-only refresh plugin: this build exists to be
// looked at, and a type error is the type checker's business, not this one's.
const DROP = ["ForkTsCheckerWebpackPlugin", "ESLintWebpackPlugin", "ReactRefreshPlugin", "HotModuleReplacementPlugin"];
config.plugins = config.plugins.filter((p) => p && !DROP.includes(p.constructor.name));

fs.mkdirSync(outDir, { recursive: true });

webpack(config, (err, stats) => {
  if (err) {
    console.error(err.stack || err);
    process.exit(1);
  }
  const info = stats.toJson({ errors: true, warnings: false });
  if (stats.hasErrors()) {
    info.errors.slice(0, 8).forEach((e) => console.error(e.message || e));
    process.exit(1);
  }
  // The config's HtmlWebpackPlugin writes index.html from public/index.html,
  // which carries the app's CSP meta tag. Left as it is: if a screen needs an
  // inline style the policy forbids, the harness should fail the same way the
  // application would.
  console.log("harness built ->", outDir);
});
