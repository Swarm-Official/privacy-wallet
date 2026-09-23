import React from "react";
// The mark itself is a vector file, and the same one the app icons are cut
// from: scripts/brand/install_app_brand.py installs this file and every icon
// together, so a screen cannot show an older shape than the taskbar does.
// Repeating the paths here is what let the bee and the icon drift apart.
import markUrl from "../../assets/img/swarm-mark.svg";

type SwarmMarkProps = {
  /** Rendered width in pixels. The mark is about 2.14:1, so the height follows. */
  size?: number;
  /**
   * The ambient float, for idle screens only. Reduced motion stops it —
   * `Global.css` neutralises every animation, and this one is decoration by
   * definition (style guide, section 02).
   */
  animated?: boolean;
};

/**
 * The SWARM mark: an amber chevron over the hive's two eyes.
 *
 * Replaces the earlier hive-bee drawing (owner's new mark, 2026-09-22 16:44).
 * The bee cut its stripes out in the colour of whatever it sat on, which is why
 * the old component needed to be told its background; this mark has no cut-outs
 * and needs no such thing, so that prop is gone rather than ignored.
 */
const SwarmMark: React.FC<SwarmMarkProps> = ({ size = 64, animated = false }) => (
  <img
    src={markUrl}
    alt="SWARM"
    width={size}
    height={Math.round(size * 0.468)}
    style={animated ? { animation: "swarmhover 4s ease-in-out infinite" } : undefined}
  />
);

export default SwarmMark;