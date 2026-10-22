import type { Project } from "../project";
/** Receives full project context and conversation; replace sample logic with a server AI adapter. */
export async function answerProjectQuestion(
  question: string,
  project: Project,
) {
  const q = question.toLowerCase();
  let answer = `For your ${project.width} × ${project.length} ft ${project.projectType.toLowerCase()}, start with the assumptions in Project Details. This is sample guidance, not an AI assessment of your site.`;
  if (/wider|larger|feet|size/.test(q))
    answer =
      "Changing dimensions can affect spans, loads, foundations, and material quantities. Create a new concept with your new dimensions and have structural details checked before building.";
  else if (/level|slope|soil/.test(q))
    answer =
      "A sloping or uneven site changes drainage and foundation requirements. Do not simply level it by eye. Have the site and drainage checked before choosing a foundation or base.";
  else if (/cedar|wood|material/.test(q))
    answer =
      "Cedar can be a finish choice, but species and grades affect strength, durability, fastener compatibility, and price. Have substitutions checked against your approved design.";
  else if (/screw|fastener/.test(q))
    answer =
      "Structural connections need the exact fastener and connector specified by the approved design and manufacturer. Ordinary deck screws are not a substitute for structural fasteners.";
  return answer;
}
