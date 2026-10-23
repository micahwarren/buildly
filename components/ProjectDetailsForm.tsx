import { detailFields, type ProjectDetails } from "@/lib/project-details";
export function ProjectDetailsForm({
  value,
  onChange,
  prefix = "details",
}: {
  value: ProjectDetails;
  onChange: (value: ProjectDetails) => void;
  prefix?: string;
}) {
  return (
    <div className="project-details-form">
      <h3>A few things that change your plan</h3>
      <p>
        Answer what you know. Blank answers stay unresolved—the planner should
        not invent them.
      </p>
      {detailFields.map(({ key, label, hint, options }) => (
        <label className="field" key={key} htmlFor={`${prefix}-${key}`}>
          {label}
          {options ? (
            <select
              id={`${prefix}-${key}`}
              value={value[key] || ""}
              onChange={(e) => onChange({ ...value, [key]: e.target.value })}
            >
              <option value="">Not sure yet</option>
              {options.map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>
          ) : (
            <input
              id={`${prefix}-${key}`}
              value={value[key] || ""}
              maxLength={1000}
              placeholder="Not sure yet"
              onChange={(e) => onChange({ ...value, [key]: e.target.value })}
            />
          )}
          <small>{hint}</small>
        </label>
      ))}
    </div>
  );
}
