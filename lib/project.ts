import type { ProjectDetails } from "./project-details";
import type { ShoppingEntry } from "./shopping";
import { estimateProject } from "./estimates";
export const brand = {
  name: "Buildly",
  tagline: "A little vision. A lot of possibility.",
};
export type Project = {
  id: string;
  title: string;
  projectType: string;
  description: string;
  details?: ProjectDetails;
  shopping?: ShoppingEntry[];
  parentProjectId?: string;
  review?: {
    reviewer: string;
    notes: string;
    recordedAt: string;
    checks: string[];
  };
  originalImage: string;
  generatedImage: string;
  visualizationMode?: "ai" | "demo";
  width: number;
  length: number;
  budget: string;
  experienceLevel: string;
  estimatedCostLow: number;
  estimatedCostHigh: number;
  estimatedHours: string;
  recommendedCrew?: string;
  planStatus?: "design-based" | "unavailable";
  planSummary?: string;
  planQuestions?: string[];
  difficulty: string;
  materials: Material[];
  tools: string[];
  steps: {
    title: string;
    text: string;
    actions?: string[];
    materials?: string[];
    tools?: string[];
    checks?: string[];
    stopConditions?: string[];
  }[];
  assumptions: string[];
  warnings: string[];
  completed: number;
  createdAt: string;
  updatedAt: string;
  status: string;
  demo: boolean;
  conversation: { role: string; text: string }[];
};
export type Material = {
  item: string;
  quantity: number;
  dimensions: string;
  unitCost: number;
  purpose?: string;
  quantityBasis?: string;
  quantityUnit?: string;
  purchase?: { label: string; coverage: number; notes: string };
};
export const photos = {
  hero: "/images/hero.svg",
  before: "/images/before.svg",
  pergola: "/images/pergola.svg",
  deck: "/images/deck.svg",
  patio: "/images/patio.svg",
  fence: "/images/fence.svg",
  shed: "/images/shed.svg",
};
export function makeDemo(input: Partial<Project>): Project {
  const type = input.projectType || "Pergola";
  const w = Number(input.width) || 12,
    l = Number(input.length) || 16;
  const estimate = estimateProject({
    projectType: type,
    width: w,
    length: l,
    experienceLevel: input.experienceLevel || "Beginner",
  });
  return {
    id: crypto.randomUUID(),
    title: `My backyard ${type.toLowerCase()}`,
    projectType: type,
    description: "",
    originalImage: "",
    generatedImage: photos.pergola,
    budget: "Not sure",
    experienceLevel: "Beginner",
    estimatedCostLow: estimate.estimatedCostLow,
    estimatedCostHigh: estimate.estimatedCostHigh,
    estimatedHours: estimate.estimatedHours,
    difficulty: estimate.difficulty,
    recommendedCrew: estimate.recommendedCrew,
    materials: estimate.materials,
    tools: [
      "Tape measure",
      "Level",
      "Safety glasses and hearing protection",
      "Work gloves",
      ...(type === "Patio"
        ? [
            "Plate compactor (rent)",
            "Rubber mallet",
            "Shovel",
            "Wheelbarrow",
            "Screed rails and board",
            "Masonry saw with dust control (rent)",
          ]
        : [
            "Circular saw",
            "Drill and bits",
            "Impact driver",
            "Clamps",
            "Socket wrench set",
            "Framing square",
            "Post-hole digger / auger (rent)",
            "Shovel",
            "Wheelbarrow",
            "Concrete mixing equipment",
            ...(type === "Pergola" || type === "Shed"
              ? ["Suitable ladders / work platforms"]
              : []),
          ]),
    ],
    steps: [
      {
        title: "Confirm your plan",
        text: "Measure your space, confirm property lines, and check local permits and setbacks. Have structural details reviewed by a qualified professional before buying materials.",
      },
      {
        title: "Check what is underground",
        text: "Before excavation, contact your local utility locating service (811 in the US). Wait for clearance and follow their marking and digging instructions.",
      },
      {
        title: "Finalize the materials list",
        text: "Use your approved, site-specific design to confirm every material, connector, and quantity. This sample list is an estimate, not an engineered specification.",
      },
      {
        title: "Prepare your work area",
        text: "Clear loose objects, establish a safe work zone, and mark the layout using verified measurements. Read tool manuals and wear suitable protective equipment.",
      },
      {
        title: "Prepare the base or foundation",
        text: "Follow your locally approved footing or base design. Depth, drainage, frost conditions, soil, and loads must be checked for your site. Arrange inspections where required.",
      },
      {
        title: "Assemble using your approved design",
        text: "Follow the approved design and manufacturer instructions for spacing, fasteners, and connections. Get experienced help for heavy lifting and structural work.",
      },
      {
        title: "Inspect and finish",
        text: "Check the completed work with your professional or inspector as required. Apply suitable finishes following manufacturer instructions and clean up the work area.",
      },
    ],
    assumptions: estimate.assumptions,
    warnings: [
      "Concept only — not construction-ready engineering.",
      "Verify measurements, local codes, permits, utilities, soil, and structural requirements before building.",
    ],
    completed: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: "concept",
    demo: true,
    conversation: [],
    ...input,
    width: w,
    length: l,
  };
}
