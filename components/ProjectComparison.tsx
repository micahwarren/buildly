"use client";
/* eslint-disable @next/next/no-img-element */
import { useState } from "react";
import { MoveHorizontal } from "lucide-react";
export function ProjectComparison({
  originalImage,
  generatedImage,
}: {
  originalImage: string;
  generatedImage: string;
}) {
  const [position, setPosition] = useState(50);
  return (
    <div className="comparison">
      <img
        src={generatedImage}
        alt="Sample outdoor inspiration, not a generated edit of your space"
      />
      <div className="before-image" style={{ width: `${position}%` }}>
        <img src={originalImage} alt="Your original project photo" />
      </div>
      <span className="before-label">Your photo</span>
      <span className="after-label">Sample inspiration</span>
      <div className="divider" style={{ left: `${position}%` }}>
        <span>
          <MoveHorizontal size={23} />
        </span>
      </div>
      <input
        aria-label="Compare your photo and sample inspiration"
        type="range"
        min="0"
        max="100"
        value={position}
        onChange={(e) => setPosition(+e.target.value)}
      />
    </div>
  );
}
