import { useState } from "react";
import type { Project } from "@/lib/project";
import { reviewChecks, reviewFindings, reviewPacket } from "@/lib/plan-review";
export function PlanReview({
  project,
  onChange,
}: {
  project: Project;
  onChange: (project: Project) => void;
}) {
  const [reviewer, setReviewer] = useState(project.review?.reviewer || "");
  const [notes, setNotes] = useState(project.review?.notes || "");
  const [checks, setChecks] = useState<string[]>(project.review?.checks || []);
  const findings = reviewFindings(project);
  return (
    <section className="plan-review">
      <h2>Review before purchasing or building</h2>
      <p>
        Automated checks look for missing information and internal
        inconsistencies. They do not certify structural safety, code compliance
        or quantities.
      </p>
      {findings.length ? (
        <ul>
          {findings.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
      ) : (
        <p>
          No issues found by these limited checks. Professional review has not
          been verified.
        </p>
      )}
      <button
        className="secondary"
        onClick={() => {
          const url = URL.createObjectURL(
            new Blob([reviewPacket(project)], { type: "text/html" }),
          );
          const a = document.createElement("a");
          a.href = url;
          a.download = "buildly-review-packet.html";
          a.click();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        }}
      >
        Download builder review packet
      </button>
      <p>
        Includes both photos, scope, quantities, instructions and unresolved
        questions. Share it with your builder or inspector; open it in a browser
        to print.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onChange({
            ...project,
            review: {
              reviewer: reviewer.trim(),
              notes: notes.trim(),
              checks,
              recordedAt: new Date().toISOString(),
            },
          });
        }}
      >
        <h3>Record review notes</h3>
        <p>
          This is your record, not a professional approval issued by Buildly.
        </p>
        <label className="field">
          Reviewer name / role
          <input
            required
            maxLength={200}
            value={reviewer}
            onChange={(e) => setReviewer(e.target.value)}
          />
        </label>
        {reviewChecks.map((check) => (
          <label className="tool" key={check}>
            <input
              type="checkbox"
              checked={checks.includes(check)}
              onChange={(e) =>
                setChecks(
                  e.target.checked
                    ? [...checks, check]
                    : checks.filter((c) => c !== check),
                )
              }
            />
            {check}
          </label>
        ))}
        <label className="field">
          Findings and changes required
          <textarea
            required
            maxLength={3000}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </label>
        <button
          className="secondary"
          disabled={!reviewer.trim() || !notes.trim()}
        >
          Save review notes
        </button>
      </form>
      {project.review && (
        <p role="status">
          Review notes saved · {project.review.reviewer}. Recorded by you; not
          independently verified.
        </p>
      )}
    </section>
  );
}
