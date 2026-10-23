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
          Ask for changes in plain language. The revised image, materials and
          instructions are saved as a new project version; your previous version
          stays in My projects.
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
            Keeps the image. Updates this project’s materials and steps, resets
            step progress, and clears old quotes and review notes. Uses AI
            planning.
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
