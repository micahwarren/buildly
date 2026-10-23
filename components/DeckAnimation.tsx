"use client";
import { Pause, Play } from "lucide-react";

// Isometric illustration: dimensions are visual, not construction specifications.
const point = (x: number, y: number, z: number) =>
  `${320 + (x - y) * 0.84},${245 + (x + y) * 0.38 - z}`;
const polygon = (points: number[][]) =>
  points.map(([x, y, z]) => point(x, y, z)).join(" ");
function Block({
  x,
  y,
  z,
  w,
  d,
  h,
  color,
  side,
  front,
}: {
  x: number;
  y: number;
  z: number;
  w: number;
  d: number;
  h: number;
  color: string;
  side: string;
  front: string;
}) {
  return (
    <g stroke="#183b32" strokeWidth=".8" strokeLinejoin="round">
      <polygon
        points={polygon([
          [x, y + d, z],
          [x + w, y + d, z],
          [x + w, y + d, z + h],
          [x, y + d, z + h],
        ])}
        fill={front}
      />
      <polygon
        points={polygon([
          [x + w, y, z],
          [x + w, y + d, z],
          [x + w, y + d, z + h],
          [x + w, y, z + h],
        ])}
        fill={side}
      />
      <polygon
        points={polygon([
          [x, y, z + h],
          [x + w, y, z + h],
          [x + w, y + d, z + h],
          [x, y + d, z + h],
        ])}
        fill={color}
      />
    </g>
  );
}
const timber = { color: "#dbb381", side: "#a97547", front: "#bd8d5b" };
const frame = { color: "#b88b59", side: "#795333", front: "#966d43" };
const concrete = { color: "#aab5a4", side: "#738575", front: "#8e9b89" };
const pieces = [
  ...[20, 210].flatMap((x) =>
    [15, 160].map((y) => ({
      x: x - 5,
      y: y - 5,
      z: -5,
      w: 28,
      d: 28,
      h: 10,
      ...concrete,
    })),
  ),
  ...[20, 210].flatMap((x) =>
    [15, 160].map((y) => ({ x, y, z: 0, w: 18, d: 18, h: 47, ...frame })),
  ),
  ...[10, 51, 92, 133, 174].map((y) => ({
    x: 0,
    y,
    z: 42,
    w: 250,
    d: 10,
    h: 16,
    ...frame,
  })),
  ...Array.from({ length: 12 }, (_, i) => ({
    x: i * 21,
    y: 0,
    z: 58,
    w: 20,
    d: 195,
    h: 7,
    ...timber,
  })),
  { x: 75, y: 195, z: 0, w: 100, d: 44, h: 20, ...frame },
  { x: 75, y: 195, z: 20, w: 100, d: 24, h: 20, ...timber },
  ...[0, 120, 240].map((x) => ({
    x,
    y: 0,
    z: 65,
    w: 9,
    d: 9,
    h: 65,
    ...frame,
  })),
  ...Array.from({ length: 14 }, (_, i) => ({
    x: 16 + i * 16,
    y: 2,
    z: 65,
    w: 4,
    d: 4,
    h: 58,
    ...frame,
  })),
  { x: 0, y: 0, z: 73, w: 250, d: 8, h: 5, ...timber },
  { x: 0, y: 0, z: 125, w: 250, d: 12, h: 6, ...timber },
];
const cycleSeconds = 36;
const startAt = (index: number) => 5 + index * (70 / pieces.length);
const workerPosition = (index: number) => {
  const p = pieces[index];
  const x = p.x + p.w / 2,
    y = p.y + p.d / 2;
  return `${320 + (x - y) * 0.84 - 26}px,${245 + (x + y) * 0.38 - p.z - p.h + 42}px`;
};
const hammerKeyframes = pieces
  .map((_, index) => {
    const start = startAt(index);
    return `${start}%,${start + 0.3}%{transform:rotate(-12deg)}${start + 0.9}%{transform:rotate(62deg)}${start + 1.3}%{transform:rotate(0deg)}`;
  })
  .join("");
const workerKeyframes = pieces
  .map(
    (_, index) =>
      `${startAt(index) - 0.5}%,${startAt(index) + 0.7}%{transform:translate(${workerPosition(index)})}`,
  )
  .join("");
export function DeckAnimation({
  paused,
  onToggle,
}: {
  paused: boolean;
  onToggle: () => void;
}) {
  return (
    <div className={`deck-scene${paused ? " is-paused" : ""}`}>
      <div className="scene-top">
        <span>
          <i /> A LITTLE VISION. PIECE BY PIECE.
        </span>
        <button
          onClick={onToggle}
          aria-label={paused ? "Play animations" : "Pause animations"}
        >
          {paused ? <Play size={16} /> : <Pause size={16} />}
        </button>
      </div>
      <svg
        viewBox="0 0 640 490"
        role="img"
        aria-labelledby="deck-title deck-desc"
      >
        <title id="deck-title">Watch a wooden deck come together</title>
        <desc id="deck-desc">
          A small builder in a hard hat moves around the site, installing
          footings, framing, deck boards, stairs and railing over a 36-second
          loop. This is an illustrated concept, not a construction guide.
        </desc>
        <defs>
          <pattern
            id="deck-grid"
            width="32"
            height="32"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 32 0 L 0 0 0 32"
              fill="none"
              stroke="#ffffff"
              strokeOpacity=".055"
            />
          </pattern>
          <radialGradient id="deck-glow">
            <stop stopColor="#74977a" stopOpacity=".28" />
            <stop offset="1" stopColor="#143a30" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="640" height="490" fill="url(#deck-grid)" />
        <ellipse cx="320" cy="280" rx="290" ry="210" fill="url(#deck-glow)" />
        <polygon
          points={polygon([
            [-35, -30, -6],
            [290, -30, -6],
            [290, 265, -6],
            [-35, 265, -6],
          ])}
          fill="#37604c"
          stroke="#7b9c7b"
          strokeOpacity=".3"
        />
        <polygon
          points={polygon([
            [0, 0, 0],
            [252, 0, 0],
            [252, 195, 0],
            [0, 195, 0],
          ])}
          fill="#102e26"
          opacity=".45"
        />
        {pieces.map((p, i) => (
          <g
            key={i}
            className="deck-piece"
            style={{ animationName: `deck-piece-${i}` }}
          >
            <Block {...p} />
            {p.z === 58 && (
              <g stroke="#8e633e" strokeWidth=".65" opacity=".55">
                <polyline
                  points={polygon([
                    [p.x + 5, 9, 65.2],
                    [p.x + 6, 70, 65.2],
                    [p.x + 4, 130, 65.2],
                    [p.x + 5, 187, 65.2],
                  ])}
                  fill="none"
                />
                {[12, 178].map((y) => (
                  <ellipse
                    key={y}
                    cx={320 + (p.x + 10 - y) * 0.84}
                    cy={245 + (p.x + 10 + y) * 0.38 - 65.2}
                    rx="1.5"
                    ry=".8"
                    fill="#604e3c"
                    stroke="none"
                  />
                ))}
              </g>
            )}
          </g>
        ))}
        <path
          d="M110 398 L310 489 M326 484 L540 387"
          stroke="#93b49c"
          strokeDasharray="3 7"
          opacity=".5"
        />
        <g transform="translate(133 393)">
          <ellipse cx="4" cy="11" rx="27" ry="9" fill="#0c2d24" opacity=".3" />
          <path
            d="M-19-10 H22 V10 H-19Z"
            fill="#c96339"
            stroke="#233e32"
            strokeWidth="1.5"
          />
          <path d="M-19-10 L-12-17 H28 L22-10Z" fill="#e48954" />
          <path d="M22-10 L28-17 V3 L22 10Z" fill="#964d31" />
          <path
            d="M-4-17 V-23 H10 V-17"
            fill="none"
            stroke="#c5c9aa"
            strokeWidth="3"
          />
          <path d="M-1-8 V-2 H4 V-8" fill="#e7ca87" />
        </g>
        <g
          className="builder-travel"
          style={{ animationName: "builder-route" }}
        >
          <ellipse cx="0" cy="1" rx="17" ry="6" fill="#0a291f" opacity=".3" />
          <g className="builder-body">
            <path
              d="M-8-23 L-9-4 M6-23 L9-4"
              stroke="#364d61"
              strokeWidth="9"
              strokeLinecap="round"
            />
            <path
              d="M-10-3 H-16 M8-3 H15"
              stroke="#252f2d"
              strokeWidth="7"
              strokeLinecap="round"
            />
            <path
              d="M-10-45 Q0-50 10-44 L11-24 Q0-20-11-25Z"
              fill="#e58c39"
              stroke="#b8682d"
              strokeWidth="1"
            />
            <path
              d="M-6-45 V-28 M6-45 V-28 M-10-31 H10"
              stroke="#f5df9d"
              strokeWidth="2.5"
            />
            <path d="M-11-24 H11" stroke="#695139" strokeWidth="4" />
            <rect x="-9" y="-26" width="6" height="8" rx="1" fill="#957149" />
            <path
              d="M-10-41 L-17-28 L-5-26"
              fill="none"
              stroke="#e8b488"
              strokeWidth="6"
              strokeLinecap="round"
            />
            <g className="builder-arm">
              <path
                d="M8-41 L20-35 L30-48"
                fill="none"
                stroke="#e8b488"
                strokeWidth="6"
                strokeLinecap="round"
              />
              <path d="M30-48 L35-61" stroke="#b78b55" strokeWidth="3.5" />
              <path
                d="M29-63 L41-59"
                stroke="#c8d0ca"
                strokeWidth="6"
                strokeLinecap="round"
              />
            </g>
            <circle cx="1" cy="-55" r="10" fill="#e8b488" />
            <path
              d="M-11-57 Q-11-72 1-72 Q14-71 13-57Z"
              fill="#f3c34e"
              stroke="#c89c34"
            />
            <path
              d="M-14-57 H16 M0-71 V-60"
              stroke="#ffe095"
              strokeWidth="3"
              strokeLinecap="round"
            />
            <circle cx="6" cy="-54" r="1.2" fill="#3a3c31" />
            <path
              d="M4-49 Q7-47 9-50"
              fill="none"
              stroke="#a57050"
              strokeWidth="1"
            />
          </g>
          <g
            className="builder-taps"
            stroke="#f5cd82"
            strokeWidth="1.5"
            strokeLinecap="round"
          >
            <path d="M35-26 L40-22 M39-32 H45 M32-22 V-17" />
          </g>
        </g>
      </svg>
      <div className="scene-bottom">
        <div>
          <span className="scene-number">FROM THE GROUND UP</span>
          <strong>A space worth building.</strong>
        </div>
        <span className="scene-caption">
          Animated concept
          <br />
          Your project comes next.
        </span>
      </div>
      <style>
        {pieces
          .map((_, i) => {
            const start = startAt(i);
            return `@keyframes deck-piece-${i}{0%,${start}%{opacity:0;transform:translateY(-12px)}${start + 1.2}%,88%{opacity:1;transform:translateY(0)}96%,100%{opacity:0;transform:translateY(0)}}`;
          })
          .join("\n") +
          `@keyframes builder-work{0%{transform:rotate(0deg)}${hammerKeyframes}80%,100%{transform:rotate(0deg)}} .deck-scene .builder-arm{animation-name:builder-work;animation-duration:${cycleSeconds}s;} @keyframes builder-route{0%,3%{opacity:0;transform:translate(${workerPosition(0)})}4%{opacity:1}${workerKeyframes}80%,89%{opacity:1;transform:translate(430px,420px)}96%,100%{opacity:0;transform:translate(470px,420px)}} .deck-scene .deck-piece,.deck-scene .builder-travel{animation-duration:${cycleSeconds}s;}`}
      </style>
    </div>
  );
}
