import React from "react";

type HiveBeeProps = {
  /** Rendered width and height in pixels. The mark is square. */
  size?: number;
  /**
   * What the stripes are cut out of. They take the background colour, always,
   * so the mark has to be told what it is sitting on (style guide, section 02).
   */
  background?: string;
  /**
   * The ambient float: wings at 1s, body at 4s. Idle screens only, and a
   * reduced-motion preference stops it — `Global.css` neutralises every
   * animation, and this one is decoration by definition.
   */
  animated?: boolean;
};

/**
 * The SWARM mark: a hive bee.
 *
 * A hexagonal body — one cell of the hive — with two stripes and honey wings.
 * The geometry is the style guide's, unchanged; the same shapes are rendered
 * to the application icon by scripts/make-swarm-icon.js.
 *
 * Drawn rather than loaded as an image so it stays sharp at any size and so
 * the stripes can take whichever surface it is placed on.
 */
const HiveBee: React.FC<HiveBeeProps> = ({ size = 64, background = "var(--swarm-surface-deep)", animated = false }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 64 64"
    fill="none"
    role="img"
    aria-label="SWARM"
    style={animated ? { animation: "swarmhover 4s ease-in-out infinite" } : undefined}
  >
    <ellipse
      cx="21"
      cy="17"
      rx="12"
      ry="6.5"
      transform="rotate(-28 21 17)"
      fill="var(--swarm-honey)"
      style={animated ? { transformOrigin: "21px 17px", animation: "swarmwingleft 1s ease-in-out infinite" } : undefined}
    />
    <ellipse
      cx="43"
      cy="17"
      rx="12"
      ry="6.5"
      transform="rotate(28 43 17)"
      fill="var(--swarm-honey)"
      style={
        animated ? { transformOrigin: "43px 17px", animation: "swarmwingright 1s ease-in-out infinite" } : undefined
      }
    />
    <path d="M32 22 L46 30 L46 48 L32 56 L18 48 L18 30 Z" fill="var(--swarm-orange)" />
    <rect x="18" y="35" width="28" height="4" fill={background} />
    <rect x="18" y="44" width="28" height="4" fill={background} />
  </svg>
);

export default HiveBee;
