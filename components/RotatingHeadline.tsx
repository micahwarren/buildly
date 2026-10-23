export const headlineEndings = [
  "a backyard deck.",
  "a shady pergola.",
  "a place to gather.",
  "a plan to build.",
];

export function RotatingHeadline({ paused }: { paused: boolean }) {
  return (
    <h1
      className={`rotating-headline${paused ? " is-paused" : ""}`}
      aria-label="Buildly turns ‘what if’ into a plan to build."
    >
      <span aria-hidden="true">
        Buildly turns
        <br />
        “what if” into
      </span>
      <span className="headline-endings" aria-hidden="true">
        {headlineEndings.map((ending, index) => (
          <em key={ending} style={{ animationDelay: `${index * 5}s` }}>
            {ending}
          </em>
        ))}
      </span>
    </h1>
  );
}
