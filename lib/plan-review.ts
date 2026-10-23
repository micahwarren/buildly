import type { Project } from "./project";
export const reviewChecks = [
  "Site dimensions and heights measured",
  "Structural connections and foundations reviewed",
  "Local permits, utilities and drainage checked",
  "Product sizes, quantities and compatibility checked",
];
export function reviewFindings(project: Project) {
  const findings: string[] = [];
  if (project.planStatus !== "design-based")
    findings.push(
      "A plan based on the actual request and design is still needed.",
    );
  if (!project.details?.height)
    findings.push("Structure / platform height has not been recorded.");
  if (!project.details?.location)
    findings.push(
      "City / region has not been recorded; local requirements are unresolved.",
    );
  if (!project.details?.attachment)
    findings.push(
      "House attachment or freestanding construction has not been confirmed.",
    );
  if (project.planQuestions?.length)
    findings.push(
      `${project.planQuestions.length} planning questions still need review. Update project details and rebuild the plan when answered.`,
    );
  const unknown = project.materials.filter((m) => !m.quantity || !m.unitCost);
  if (unknown.length)
    findings.push(
      `${unknown.length} materials have an unconfirmed quantity or reference price.`,
    );
  for (const material of project.materials)
    if (!project.steps.some((step) => step.materials?.includes(material.item)))
      findings.push(`No detailed step references ${material.item}.`);
  const requested = `${project.description} ${project.details?.material || ""}`;
  if (
    /wooden?\s+(patio|platform)|timber\s+(patio|platform)/i.test(requested) &&
    !/paver|stone patio|brick patio/i.test(requested) &&
    project.materials.some((m) => /paver|polymeric|bedding sand/i.test(m.item))
  )
    findings.push(
      "Possible scope mismatch: a wooden surface was requested but paving materials are listed. Resolve this before purchasing.",
    );
  if (project.steps.some((s) => !s.actions?.length || !s.checks?.length))
    findings.push("Some steps lack detailed actions or completion checks.");
  return findings;
}
const escape = (text: unknown) =>
  String(text ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
export function reviewPacket(project: Project) {
  const list = (items: string[] = []) =>
    `<ul>${items.map((item) => `<li>${escape(item)}</li>`).join("")}</ul>`;
  const photo = (src: string) =>
    /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(src)
      ? `<img alt="Project reference" src="${src}" style="max-width:100%;max-height:500px">`
      : "<p>No exportable project photo.</p>";
  return `<!doctype html><html><head><meta charset="utf-8"><title>Buildly review packet</title><style>body{max-width:900px;margin:40px auto;font:16px/1.6 system-ui;padding:20px}td,th{border:1px solid #ccc;padding:8px;text-align:left}table{border-collapse:collapse;width:100%}img{object-fit:contain}h2{margin-top:2em}@media print{article{break-inside:avoid}}</style></head><body><h1>${escape(project.title)}</h1><p>Review packet exported ${escape(new Date().toISOString())}. AI-generated concept, not certified drawings. Review findings and verify specifications before construction.</p><h2>Requested scope</h2><p>${escape(project.description)}</p><p>${project.width} × ${project.length} ft; ${escape(project.experienceLevel)}</p>${list(Object.entries(project.details || {}).map(([k, v]) => `${k}: ${v}`))}<h2>Original site</h2>${photo(project.originalImage)}<h2>Concept</h2>${photo(project.generatedImage)}<h2>Plan summary</h2><p>${escape(project.planSummary)}</p><h2>Automated review findings</h2>${list(reviewFindings(project))}<h2>Questions to resolve</h2>${list(project.planQuestions)}<h2>Materials</h2><table><tr><th>Material</th><th>Quantity / units</th><th>Purpose and basis</th></tr>${project.materials.map((m) => `<tr><td>${escape(m.item)}</td><td>${escape(m.quantity || "Verify")} ${escape(m.quantityUnit || m.dimensions)}</td><td>${escape(m.purpose)}<br>${escape(m.quantityBasis)}</td></tr>`).join("")}</table><h2>Instructions</h2>${project.steps.map((s, i) => `<article><h3>${i + 1}. ${escape(s.title)}</h3><p>${escape(s.text)}</p>${list(s.actions)}<h4>Materials / tools</h4>${list([...(s.materials || []), ...(s.tools || [])])}<h4>Checks</h4>${list(s.checks)}<h4>Stop conditions</h4>${list(s.stopConditions)}</article>`).join("")}<h2>Assumptions and warnings</h2>${list([...project.assumptions, ...project.warnings])}<h2>Review notes recorded by the user</h2>${project.review ? `<p>${escape(project.review.reviewer)} · ${escape(project.review.recordedAt)}</p><p>${escape(project.review.notes)}</p>${list(project.review.checks)}` : "<p>No review recorded. This app has not arranged or verified a professional review.</p>"}</body></html>`;
}
