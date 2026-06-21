/**
 * Concentric ripple field — ambient hero animation.
 *
 * Adapted from the `motion` repo's zen sketch (aifashionartists.com/zen), but
 * rebuilt with pure CSS keyframes instead of Framer Motion: zero JS, zero
 * bundle cost, GPU-only (transform/opacity), and honors prefers-reduced-motion.
 *
 * Themed for SmartLine as voice/call ripples emanating outward — the rings
 * breathe continuously and cascade in on load. Renders as a server component;
 * it is decorative only (aria-hidden, pointer-events-none at the call site).
 */
const VIEW = 600;
const CENTER = VIEW / 2;

export interface RippleFieldProps {
  /** Number of concentric rings. */
  count?: number;
  /** Largest ring radius in viewBox units. */
  maxRadius?: number;
  /** Innermost ring radius. */
  minRadius?: number;
  /** Continuous breathing loop period, in seconds. */
  breathPeriod?: number;
  className?: string;
}

export function RippleField({
  count = 18,
  maxRadius = 288,
  minRadius = 10,
  breathPeriod = 7,
  className,
}: RippleFieldProps) {
  const step = (maxRadius - minRadius) / Math.max(count - 1, 1);
  const rings = Array.from({ length: count }, (_, i) => minRadius + i * step);

  return (
    <svg
      aria-hidden
      role="presentation"
      viewBox={`0 0 ${VIEW} ${VIEW}`}
      className={className}
      preserveAspectRatio="xMidYMid meet"
    >
      <g transform={`translate(${CENTER} ${CENTER})`}>
        {/* Inner group breathes; rings cascade in via per-ring delay. */}
        <g
          className="ripple-breathe"
          style={{ animationDuration: `${breathPeriod}s` }}
        >
          {rings.map((r, i) => (
            <circle
              key={r}
              cx={0}
              cy={0}
              r={r}
              fill="none"
              stroke={
                i % 6 === 5
                  ? "rgba(0, 102, 255, 0.22)"
                  : "rgba(0, 102, 255, 0.10)"
              }
              strokeWidth={i === 0 ? 1.4 : 0.9}
              className="ripple-ring"
              style={{ animationDelay: `${i * 0.05}s` }}
            />
          ))}
        </g>
      </g>
    </svg>
  );
}
