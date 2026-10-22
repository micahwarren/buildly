import { Check } from "lucide-react";
export function ProgressSteps({ step }: { step: number }) {
  return (
    <div className="progress" aria-label="Project creation progress">
      {["Photo", "Project", "Details", "Design", "Plan"].map((s, i) => (
        <div
          className={i <= step ? "active" : ""}
          key={s}
          aria-current={i === step ? "step" : undefined}
        >
          <span>{i < step ? <Check size={16} /> : i + 1}</span>
          {s}
        </div>
      ))}
    </div>
  );
}
