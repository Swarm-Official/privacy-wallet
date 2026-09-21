# Bundled fonts

The style guide sets three faces: **Sora** for display, **Manrope** for reading, **JetBrains Mono** for anything that is a number, a hash or an address.

They are named in `--font-display`, `--font-text` and `--font-mono` in `src/components/common/Global.css`, and they are never fetched from the network — this application must not make a request for a font. Roboto is already bundled the same way, as the `typeface-roboto` package.

The font files are not in this repository yet. Until they are, the fallbacks in those three variables render instead: Segoe UI for display and text, Cascadia Mono or Consolas for mono. The type *roles* are already in place everywhere, so adding the files changes the faces and nothing else.

## Adding them

All three are open licensed — Sora and Manrope under the SIL Open Font License 1.1, JetBrains Mono under the SIL OFL 1.1 as well. Either vendor the `.woff2` files here, or add the `@fontsource/sora`, `@fontsource/manrope` and `@fontsource/jetbrains-mono` packages and import them from `src/index.css` the way `typeface-roboto` is imported.

If the files are vendored into this directory, add their `@font-face` rules to `src/index.css` with `src: url("./assets/fonts/<file>.woff2") format("woff2")` and `font-display: swap`, and ship each family's `OFL.txt` alongside it — the licence requires the copyright notice to travel with the font.

Weights the guide uses: Sora 400/500/600/700, Manrope 400/500/600, JetBrains Mono 400/500.
