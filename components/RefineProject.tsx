import { useState } from "react";
import type { Project } from "@/lib/project";
import { ProjectDetailsForm } from "./ProjectDetailsForm";
export function RefineProject({
  project,
  busy,
  onRefine,
  onReplan,
}: {
  project: Project;
  busy: boolean;
  onRefine: (change: string, details: Project["details"]) => void;
  onReplan: (details: Project["details"]) => void;
}) {
  const [change, setChange] = useState("");
  const [details, setDetails] = useState(project.details || {});
  return (
    <section className="panel">
      <details>
        <summary>Refine this project</summary>
        <p>
          Describe your changes. We’ll save a new version and keep the original.
        </p>
        <label className="field">
          What would you like to change?
          <textarea
            maxLength={1000}
            value={change}
            onChange={(e) => setChange(e.target.value)}
            placeholder="Make the platform two feet wider, use cedar for the pergola, and keep everything else."
          />
        </label>
        <details>
          <summary>Update site details or answer planning questions</summary>
          <ProjectDetailsForm
            value={details}
            onChange={setDetails}
            prefix="refinement"
          />
          <button
            className="secondary"
            disabled={busy}
            onClick={() => onReplan(details)}
          >
            Update details and rebuild plan only
          </button>
          <p className="muted">
            Keeps your image. Replaces the plan and clears progress, quotes, and
            review notes.
          </p>
        </details>
        <button
          className="primary"
          disabled={busy || !change.trim()}
          onClick={() => onRefine(change, details)}
        >
          {busy ? "Updating your project…" : "Create revised design and plan"}
        </button>
        <p className="muted">
          Uses a new AI image and planning requests. Describe dimensional
          changes explicitly. Structural changes still need qualified review.
        </p>
      </details>
    </section>
  );
}
