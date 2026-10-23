import type { Project } from "./project";
export function parseProjectBackup(text: string): Project {
  const backup = JSON.parse(text);
  const p = backup?.project;
  const fail = () => {
    throw new Error("That file is not a valid Buildly project backup.");
  };
  if (backup?.format !== "buildly-project-v1" || !p || typeof p !== "object")
    return fail();
  for (const key of [
    "id",
    "title",
    "projectType",
    "description",
    "originalImage",
    "generatedImage",
    "budget",
    "experienceLevel",
    "estimatedHours",
    "difficulty",
    "createdAt",
    "updatedAt",
    "status",
  ])
    if (typeof p[key] !== "string") return fail();
  if (
    !/^[a-zA-Z0-9-]{1,80}$/.test(p.id) ||
    p.description.length > 2000 ||
    p.title.length > 200 ||
    !Number.isFinite(Date.parse(p.createdAt)) ||
    !Number.isFinite(Date.parse(p.updatedAt))
  )
    return fail();
  for (const key of [
    "width",
    "length",
    "estimatedCostLow",
    "estimatedCostHigh",
    "completed",
  ])
    if (typeof p[key] !== "number" || !Number.isFinite(p[key]) || p[key] < 0)
      return fail();
  for (const key of ["originalImage", "generatedImage"])
    if (
      !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(p[key]) &&
      !/^\/images\/[a-z-]+\.svg$/.test(p[key])
    )
      return fail();
  if (
    typeof p.demo !== "boolean" ||
    !Array.isArray(p.materials) ||
    !p.materials.every((m: unknown) => {
      const x = m as Record<string, unknown>;
      return (
        x &&
        typeof x.item === "string" &&
        typeof x.dimensions === "string" &&
        typeof x.quantity === "number" &&
        Number.isFinite(x.quantity) &&
        x.quantity >= 0 &&
        typeof x.unitCost === "number" &&
        Number.isFinite(x.unitCost) &&
        x.unitCost >= 0
      );
    })
  )
    return fail();
  if (
    !Array.isArray(p.steps) ||
    p.steps.length < 1 ||
    !p.steps.every((s: unknown) => {
      const x = s as Record<string, unknown>;
      return x && typeof x.title === "string" && typeof x.text === "string";
    }) ||
    !Number.isInteger(p.completed) ||
    p.completed > p.steps.length
  )
    return fail();
  for (const key of ["tools", "warnings", "assumptions"])
    if (
      !Array.isArray(p[key]) ||
      !p[key].every((s: unknown) => typeof s === "string")
    )
      return fail();
  if (
    !Array.isArray(p.conversation) ||
    !p.conversation.every((s: unknown) => {
      const x = s as Record<string, unknown>;
      return x && typeof x.role === "string" && typeof x.text === "string";
    })
  )
    return fail();
  const optionalStrings = (value: unknown) =>
    value === undefined ||
    (Array.isArray(value) &&
      value.every((item: unknown) => typeof item === "string"));
  if (
    (p.planStatus !== undefined &&
      !["design-based", "unavailable"].includes(p.planStatus)) ||
    (p.planSummary !== undefined && typeof p.planSummary !== "string") ||
    !optionalStrings(p.planQuestions)
  )
    return fail();
  for (const step of p.steps)
    for (const key of [
      "actions",
      "materials",
      "tools",
      "checks",
      "stopConditions",
    ])
      if (!optionalStrings(step[key])) return fail();
  for (const material of p.materials)
    for (const key of ["purpose", "quantityBasis"])
      if (material[key] !== undefined && typeof material[key] !== "string")
        return fail();
  return p as Project;
}
