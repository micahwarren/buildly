export type ProjectDetails = {
  location?: string;
  height?: string;
  material?: string;
  attachment?: string;
  access?: string;
  ground?: string;
  notes?: string;
};
export const detailFields: {
  key: keyof ProjectDetails;
  label: string;
  hint: string;
  options?: string[];
}[] = [
  {
    key: "location",
    label: "City / region",
    hint: "Helps identify questions about climate and permits; no street address needed.",
  },
  {
    key: "height",
    label: "Height above the ground",
    hint: "For platforms: finished floor height. For other structures: overall height. Include units.",
  },
  {
    key: "material",
    label: "Preferred building materials",
    hint: "For example: cedar pergola, pressure-treated platform, composite decking, or pavers.",
  },
  {
    key: "attachment",
    label: "Connection to the house",
    hint: "Attachment changes structural connections and weatherproofing.",
    options: ["Freestanding", "Attached to the house", "Not applicable"],
  },
  {
    key: "access",
    label: "Stairs, railings, gates or openings",
    hint: "Describe what you want. Required guards and other code details still need verification.",
  },
  {
    key: "ground",
    label: "Ground conditions",
    hint: "Foundation and drainage depend on the actual site.",
    options: [
      "Mostly level soil / lawn",
      "Sloping ground",
      "Existing concrete slab",
      "Existing deck or patio",
      "Other — describe below",
    ],
  },
  {
    key: "notes",
    label: "Other site details",
    hint: "Known measurements, drainage issues, what stays, what gets removed, or answers to the plan's questions.",
  },
];
export function parseDetails(value: unknown): ProjectDetails {
  if (value === undefined) return {};
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw Error("Please check the project details.");
  const result: ProjectDetails = {};
  for (const { key } of detailFields) {
    const text = (value as Record<string, unknown>)[key];
    if (text !== undefined) {
      if (typeof text !== "string" || text.length > 1000)
        throw Error("Keep each project detail under 1,000 characters.");
      if (text.trim()) result[key] = text.trim();
    }
  }
  return result;
}
