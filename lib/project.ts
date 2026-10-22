export const brand = {
  name: "Buildly",
  tagline: "A little vision. A lot of possibility.",
};
export type Project = {
  id: string;
  title: string;
  projectType: string;
  description: string;
  originalImage: string;
  generatedImage: string;
  width: number;
  length: number;
  budget: string;
  experienceLevel: string;
  estimatedCostLow: number;
  estimatedCostHigh: number;
  estimatedHours: string;
  difficulty: string;
  materials: Material[];
  tools: string[];
  steps: { title: string; text: string }[];
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
  const area = w * l;
  const catalogs: Record<string, Material[]> = {
    Pergola: [
      {
        item: "Pressure-treated posts",
        quantity: 6,
        dimensions: "6 × 6 × 10 ft",
        unitCost: 68,
      },
      {
        item: "Beams",
        quantity: 4,
        dimensions: `2 × 10 × ${l} ft`,
        unitCost: 58,
      },
      {
        item: "Rafters",
        quantity: Math.ceil(l),
        dimensions: `2 × 8 × ${w} ft`,
        unitCost: 32,
      },
      {
        item: "Post bases (allowance)",
        quantity: 6,
        dimensions: "Engineer to specify",
        unitCost: 42,
      },
      {
        item: "Structural hardware allowance",
        quantity: 1,
        dimensions: "Per approved design",
        unitCost: 240,
      },
      {
        item: "Concrete allowance",
        quantity: 18,
        dimensions: "80 lb bags; verify footing design",
        unitCost: 8,
      },
    ],
    Deck: [
      {
        item: "Decking boards allowance",
        quantity: Math.ceil(area / 4),
        dimensions: "5/4 × 6 × 8 ft",
        unitCost: 14,
      },
      {
        item: "Framing lumber allowance",
        quantity: Math.ceil(area / 10),
        dimensions: "Final sizes to be designed",
        unitCost: 35,
      },
      {
        item: "Footings and connectors allowance",
        quantity: 1,
        dimensions: "Professional design required",
        unitCost: 650,
      },
    ],
    Patio: [
      {
        item: "Pavers",
        quantity: Math.ceil(area * 1.1),
        dimensions: "1 sq ft equivalent",
        unitCost: 4,
      },
      {
        item: "Compacted base allowance",
        quantity: Math.ceil(area / 40),
        dimensions: "Cubic yards; verify depth",
        unitCost: 65,
      },
      {
        item: "Bedding sand allowance",
        quantity: Math.ceil(area / 100),
        dimensions: "Cubic yards",
        unitCost: 55,
      },
      {
        item: "Edging and joint sand",
        quantity: 1,
        dimensions: "Project allowance",
        unitCost: 180,
      },
    ],
    Fence: [
      {
        item: "Fence panels",
        quantity: Math.ceil(l / 8),
        dimensions: "6 × 8 ft",
        unitCost: 95,
      },
      {
        item: "Posts",
        quantity: Math.ceil(l / 8) + 1,
        dimensions: "4 × 4 × 10 ft; verify",
        unitCost: 28,
      },
      {
        item: "Hardware and footing allowance",
        quantity: 1,
        dimensions: "Verify local requirements",
        unitCost: 200,
      },
    ],
    Shed: [
      {
        item: "Framing and roof allowance",
        quantity: 1,
        dimensions: `${w} × ${l} ft concept`,
        unitCost: area * 12,
      },
      {
        item: "Siding and trim allowance",
        quantity: 1,
        dimensions: "Verify openings",
        unitCost: area * 6,
      },
      {
        item: "Foundation allowance",
        quantity: 1,
        dimensions: "Professional specification",
        unitCost: area * 5,
      },
    ],
  };
  const materials = catalogs[type] || [
    {
      item: "Preliminary materials allowance",
      quantity: 1,
      dimensions: "Scope and design to be established",
      unitCost: area * 10,
    },
  ];
  const total = materials.reduce((s, m) => s + m.quantity * m.unitCost, 0);
  return {
    id: crypto.randomUUID(),
    title: `My backyard ${type.toLowerCase()}`,
    projectType: type,
    description: "",
    originalImage: "",
    generatedImage: photos.pergola,
    budget: "Not sure",
    experienceLevel: "Beginner",
    estimatedCostLow: Math.round(total * 0.9),
    estimatedCostHigh: Math.round(total * 1.25),
    estimatedHours: "2–4 weekends",
    difficulty: type === "Patio" ? "Moderate" : "Experienced help recommended",
    materials,
    tools: [
      "Tape measure",
      "Level",
      "Safety glasses and hearing protection",
      "Work gloves",
      ...(type === "Patio"
        ? ["Plate compactor (rent)", "Rubber mallet"]
        : ["Circular saw", "Impact driver", "Clamps"]),
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
    assumptions: [
      "Dimensions are entered by you, not measured from the photo.",
      "Costs are illustrative US material allowances; labor, delivery, tax, and permits excluded.",
      "A level, accessible site is assumed.",
    ],
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
