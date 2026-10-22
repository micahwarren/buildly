"use client";
/* eslint-disable @next/next/no-img-element */
import { useState } from "react";
import { MoveHorizontal } from "lucide-react";
export function ProjectComparison({
  originalImage,
  generatedImage,
  live = false,
}: {
  originalImage: string;
  generatedImage: string;
  live?: boolean;
}) {
  const [position, setPosition] = useState(50),
    [aspect, setAspect] = useState(1.5),
    [mode, setMode] = useState<"design" | "original" | "compare">("design");
  if (!live)
    return (
      <div className="sample-images">
        <figure>
          <img src={originalImage} alt="Your original project photo" />
          <figcaption>Your photo · no design has been generated</figcaption>
        </figure>
        <figure>
          <img
            src={generatedImage}
            alt="Generic illustrated sample, not your property"
          />
          <figcaption>
            Separate sample illustration · not a preview of your yard
          </figcaption>
        </figure>
      </div>
    );
  return (
    <section aria-label="Your project visualization">
      <div
        className="visualization-controls"
        role="group"
        aria-label="Photo view"
      >
        {(
          [
            { key: "design", label: "Your design" },
            { key: "original", label: "Original photo" },
            { key: "compare", label: "Compare before & after" },
          ] as const
        ).map((item) => (
          <button
            key={item.key}
            aria-pressed={mode === item.key}
            onClick={() => setMode(item.key)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div
        className={"comparison " + (mode !== "compare" ? "full-design" : "")}
        style={{ aspectRatio: aspect }}
      >
        <img
          src={mode === "original" ? originalImage : generatedImage}
          onLoad={(e) =>
            setAspect(
              e.currentTarget.naturalWidth / e.currentTarget.naturalHeight,
            )
          }
          alt={
            mode === "original"
              ? "Your original project photo"
              : "AI concept showing your requested project in your uploaded space"
          }
        />
        {mode === "compare" && (
          <>
            <div
              className="before-image"
              style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}
            >
              <img src={originalImage} alt="Your original project photo" />
            </div>
            <span className="before-label">Before</span>
            <span className="after-label">AI design concept</span>
            <div className="divider" style={{ left: `${position}%` }}>
              <span>
                <MoveHorizontal size={23} />
              </span>
            </div>
            <input
              aria-label="Compare your photo and AI design"
              type="range"
              min="0"
              max="100"
              value={position}
              onChange={(e) => setPosition(+e.target.value)}
            />
          </>
        )}
      </div>
      <p className="muted">
        AI visualization, not a measured or engineered design. Details and scale
        may differ from reality.
      </p>
    </section>
  );
}
