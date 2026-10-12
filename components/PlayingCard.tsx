import type { Card, Suit } from "@/lib/euchre";

const SUIT_PATHS: Record<Suit, React.ReactNode> = {
  H: <path d="M12 22C5 16 2 12 2 8.2A5 5 0 0 1 12 6a5 5 0 0 1 10 2.2C22 12 19 16 12 22Z" />,
  D: <path d="M12 1 21.5 12 12 23 2.5 12Z" />,
  S: (
    <path d="M12 1C12 1 3 8 3 14a4.5 4.5 0 0 0 8 2.5C11 19 10 21 8 23h8c-2-2-3-4-3-6.5A4.5 4.5 0 0 0 21 14C21 8 12 1 12 1Z" />
  ),
  C: (
    <>
      <circle cx="12" cy="7" r="4.6" />
      <circle cx="6.6" cy="14" r="4.6" />
      <circle cx="17.4" cy="14" r="4.6" />
      <path d="M12 11c0 6-1 8-3.5 12h7C13 19 12 17 12 11Z" />
    </>
  ),
};

export function suitColor(suit: Suit, fourColor = false): string {
  if (fourColor) {
    return suit === "H" ? "#c8312b" : suit === "D" ? "#1f6fd0" : suit === "C" ? "#1f8a3b" : "#1b1f2a";
  }
  return suit === "H" || suit === "D" ? "#c8312b" : "#1b1f2a";
}

/** Standalone suit glyph (inline svg) for UI chrome. */
export function SuitIcon({
  suit,
  size = 16,
  fourColor = false,
  color,
  className,
}: {
  suit: Suit;
  size?: number;
  fourColor?: boolean;
  color?: string;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill={color ?? suitColor(suit, fourColor)}
      className={className}
      aria-hidden
    >
      {SUIT_PATHS[suit]}
    </svg>
  );
}

function Glyph({ suit, x, y, s, fill, flip }: { suit: Suit; x: number; y: number; s: number; fill: string; flip?: boolean }) {
  const k = s / 24;
  return (
    <g
      transform={`translate(${x - s / 2} ${y - s / 2}) ${flip ? `rotate(180 ${s / 2} ${s / 2})` : ""} scale(${k})`}
      fill={fill}
    >
      {SUIT_PATHS[suit]}
    </g>
  );
}

const PIPS_9: [number, number][] = [
  [27, 25], [43, 25], [27, 39], [43, 39], [35, 50], [27, 61], [43, 61], [27, 75], [43, 75],
];
const PIPS_10: [number, number][] = [
  [27, 25], [43, 25], [35, 33], [27, 40], [43, 40], [27, 60], [43, 60], [35, 67], [27, 75], [43, 75],
];

export function PlayingCard({ card, fourColor = false }: { card: Card; fourColor?: boolean }) {
  const col = suitColor(card.suit, fourColor);
  const { rank, suit } = card;
  const face = rank === "J" || rank === "Q" || rank === "K";
  const idx = (
    <>
      <text
        x="10"
        y="21"
        textAnchor="middle"
        fontFamily="var(--font-display), Georgia, serif"
        fontWeight="800"
        fontSize={rank === "10" ? 17 : 21}
        fill={col}
        letterSpacing={rank === "10" ? -1.5 : 0}
      >
        {rank}
      </text>
      <Glyph suit={suit} x={10} y={31} s={12} fill={col} />
    </>
  );
  return (
    <svg viewBox="0 0 70 100" className="block h-full w-full" role="img" aria-label={`${rank} of ${suit}`}>
      <rect x="0.75" y="0.75" width="68.5" height="98.5" rx="7" fill="#fbf6e9" stroke="#cdbf9b" strokeWidth="1.2" />
      {idx}
      <g transform="rotate(180 35 50)">{idx}</g>
      {rank === "A" && <Glyph suit={suit} x={35} y={51} s={34} fill={col} />}
      {face && (
        <g>
          <rect x="19" y="20" width="32" height="60" rx="4" fill="none" stroke={col} strokeOpacity="0.45" strokeWidth="1.4" />
          <text
            x="35"
            y="59"
            textAnchor="middle"
            fontFamily="var(--font-display), Georgia, serif"
            fontWeight="800"
            fontSize="34"
            fill={col}
          >
            {rank}
          </text>
          <Glyph suit={suit} x={35} y={31} s={11} fill={col} />
          <Glyph suit={suit} x={35} y={69} s={11} fill={col} flip />
        </g>
      )}
      {(rank === "9" || rank === "10") &&
        (rank === "9" ? PIPS_9 : PIPS_10).map(([x, y], i) => (
          <Glyph key={i} suit={suit} x={x} y={y} s={11} fill={col} flip={y > 50} />
        ))}
    </svg>
  );
}

export function CardBack() {
  return (
    <svg viewBox="0 0 70 100" className="block h-full w-full" aria-hidden>
      <defs>
        <pattern id="backpat" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="8" height="8" fill="#0f4430" />
          <path d="M0 4h8M4 0v8" stroke="#e3b94e" strokeOpacity="0.28" strokeWidth="0.7" />
        </pattern>
        <linearGradient id="backgold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fbe9a4" />
          <stop offset="1" stopColor="#b98a22" />
        </linearGradient>
      </defs>
      <rect x="0.75" y="0.75" width="68.5" height="98.5" rx="7" fill="#fbf6e9" stroke="#b9a979" strokeWidth="1.2" />
      <rect x="5" y="5" width="60" height="90" rx="4" fill="url(#backpat)" stroke="url(#backgold)" strokeWidth="1.4" />
      <g transform="translate(35 50)">
        <circle r="17" fill="#082a1f" stroke="url(#backgold)" strokeWidth="1.4" />
        <path d="M-10 6-12-7-5 0 0-10 5 0 12-7 10 6Z" fill="url(#backgold)" />
        <rect x="-10" y="5" width="20" height="4" rx="1.5" fill="url(#backgold)" />
      </g>
    </svg>
  );
}
