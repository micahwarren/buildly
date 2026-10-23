"use client";
import { useState } from "react";
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
const pieces = [
  ...[20, 210].flatMap((x) =>
    [15, 160].map((y) => ({ x, y, z: 0, w: 18, d: 18, h: 47, ...frame })),
  ),
  ...[10, 92, 174].map((y) => ({
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
  { x: 0, y: 0, z: 125, w: 250, d: 12, h: 6, ...timber },
];
export function DeckAnimation() {
  const [paused, setPaused] = useState(false);
  return (
    <div className={`deck-scene${paused ? " is-paused" : ""}`}>
      <div className="scene-top">
        <span>
          <i /> A LITTLE VISION. PIECE BY PIECE.
        </span>
        <button
          onClick={() => setPaused(!paused)}
          aria-label={paused ? "Play deck animation" : "Pause deck animation"}
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
          Supports, framing, deck boards, steps and a back railing assemble in a
          repeating illustrated sequence. This is a concept, not a construction
          guide.
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
          </g>
        ))}
        <path
          d="M110 398 L310 489 M326 484 L540 387"
          stroke="#93b49c"
          strokeDasharray="3 7"
          opacity=".5"
        />
        <text x="62" y="426" fill="#a7c1ae" fontSize="10" letterSpacing="2">
          THE POSSIBILITIES START HERE
        </text>
      </svg>
      <div className="scene-bottom">
        <div>
          <span className="scene-number">01 — 03</span>
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
            const start = 4 + i * 2.5;
            return `@keyframes deck-piece-${i}{0%,${start}%{opacity:0;transform:translateY(-35px)}${start + 5}%,86%{opacity:1;transform:translateY(0)}94%,100%{opacity:0;transform:translateY(0)}}`;
          })
          .join("\n")}
      </style>
    </div>
  );
}
