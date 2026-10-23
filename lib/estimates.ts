import type { Material, Project } from "./project";

/** Preliminary quantity takeoff, not a structural design or a supplier quote. */
export function estimateProject(
  input: Pick<Project, "projectType" | "width" | "length" | "experienceLevel">,
) {
  const { projectType: type, width: w, length: l, experienceLevel } = input;
  const area = w * l,
    perimeter = 2 * (w + l);
  const materials: Material[] = [];
  const add = (
    item: string,
    quantity: number,
    dimensions: string,
    unitCost: number,
  ) =>
    materials.push({
      item,
      quantity: Math.ceil(quantity),
      dimensions,
      unitCost,
    });
  const assumptions = [
    "Preliminary quantity takeoff using entered dimensions, not measurements from the photo or an engineered design.",
    "Reference USD unit prices are budgeting inputs, not current supplier quotes. Range is 80–140% of the itemized subtotal; labor, tax, delivery, permits, rentals and disposal are excluded.",
    "Level, accessible site; no demolition, utility relocation or difficult excavation. Custom features in your description are not automatically quantified.",
  ];
  let hours = 0,
    difficulty = "Advanced",
    crew = 2;
  if (type === "Deck") {
    const joists = Math.ceil(l / (16 / 12)) + 1;
    const supports = (Math.ceil(w / 8) + 1) * (Math.ceil(l / 8) + 1);
    add(
      "Pressure-treated decking",
      (area * 1.1) / (5.5 / 12),
      "Linear ft; 5.5-inch actual face, 10% cutting waste",
      2.2,
    );
    add(
      "Joist framing allowance",
      joists * w * 1.1,
      "Linear ft; 16-inch layout for budgeting only; size/spans TBD",
      3.2,
    );
    add(
      "Rim framing allowance",
      perimeter * 1.1,
      "Linear ft; size and connection design TBD",
      3.2,
    );
    add(
      "Beam lumber allowance",
      (Math.ceil(w / 8) + 1) * l * 2 * 1.1,
      "Linear ft; double-ply allowance, engineer to verify",
      4,
    );
    add(
      "Support posts allowance",
      supports,
      "Each; height, section and support layout TBD",
      65,
    );
    add(
      "Footing concrete allowance",
      supports * 4,
      "80 lb bag (0.6 cu ft); 4 bags/support is budget only, not footing sizing",
      8,
    );
    add(
      "Post bases and anchors",
      supports,
      "Compatible base + concrete anchor set; verify uplift and corrosion rating",
      55,
    );
    add(
      "Post-to-beam connectors",
      supports,
      "Approved connector set; verify connection design",
      35,
    );
    add(
      "Joist hangers allowance",
      joists * 2,
      "Each; match joist size and approved framing layout",
      5,
    );
    add(
      "Connector nails / structural connector screws",
      joists * 2 * 12 + supports * 24,
      "Individual fasteners; 12/hanger + 24/support allowance; manufacturer schedule governs",
      0.25,
    );
    add(
      "Exterior decking screws",
      Math.ceil(w / (5.5 / 12)) * joists * 2 * 1.1,
      "Individual screws; two per board/joist intersection + 10%; match treatment",
      0.12,
    );
    add(
      "Structural framing screws / bolts",
      supports * 8 + joists * 4,
      "Individual fasteners allowance; approved connection schedule required",
      1.5,
    );
    add(
      "Joist protection tape",
      (joists * w + perimeter) / 50,
      "50 ft roll",
      28,
    );
    add(
      "End-cut preservative",
      perimeter / 200,
      "Quart; follow treated-lumber instructions",
      22,
    );
    add(
      "Exterior wood finish",
      (area * 1.1) / 200,
      "Gallon; one coat at assumed 200 sq ft/gal, verify product",
      45,
    );
    hours = 20 + area * 0.28 + supports * 1.5;
    assumptions.push(
      "Freestanding rectangular wood deck; stairs, guards, handrails and house ledger/flashing are NOT included. Height and local rules determine whether they are required. Do not purchase from this allowance alone.",
      "Support grid and framing quantities are budgeting assumptions, not approved spans or footing specifications.",
    );
  } else if (type === "Pergola") {
    const posts = (Math.ceil(l / 8) + 1) * 2;
    const rafters = Math.ceil(l / 2) + 1;
    add(
      "Pergola posts allowance",
      posts,
      "Each; length and structural section TBD",
      75,
    );
    add(
      "Beam lumber allowance",
      l * 4 * 1.1,
      "Linear ft; two double-ply beam lines, size/spans TBD",
      4,
    );
    add(
      "Rafter lumber allowance",
      rafters * (w + 2) * 1.1,
      "Linear ft; 24-inch layout and 1 ft overhang each end assumed, size TBD",
      3.5,
    );
    add(
      "Shade slats allowance",
      (Math.ceil(w / 1) + 1) * (l + 2) * 1.1,
      "Linear ft; 12-inch layout assumed",
      1.5,
    );
    add(
      "Brace lumber allowance",
      posts * 2 * 3,
      "Linear ft; two 3 ft braces/post allowance, design TBD",
      3.5,
    );
    add(
      "Footing concrete allowance",
      posts * 5,
      "80 lb bag; budget only, soil/frost/uplift design required",
      8,
    );
    add(
      "Post bases and anchors",
      posts,
      "Approved uplift-rated set, verify design",
      65,
    );
    add(
      "Post-to-beam connector sets",
      posts,
      "Each; manufacturer-specified connection",
      45,
    );
    add("Rafter ties", rafters * 2, "Each; verify uplift design", 6);
    add(
      "Connector nails / approved connector screws",
      rafters * 2 * 10 + posts * 24,
      "Individual fasteners allowance; follow connector schedule",
      0.25,
    );
    add(
      "Structural bolts / screws",
      posts * 16,
      "Individual fasteners allowance for beams and braces; design TBD",
      2,
    );
    add(
      "Exterior slat screws",
      (Math.ceil(w) + 1) * rafters * 2 * 1.1,
      "Individual screws; two/intersection + 10%",
      0.12,
    );
    add(
      "Exterior finish",
      ((l * 4 + rafters * (w + 2) + posts * 10) * 2) / 200,
      "Gallon; approximate exposed surfaces, verify coats and coverage",
      45,
    );
    hours = 18 + area * 0.16 + posts * 2;
    crew = 3;
    assumptions.push(
      "Freestanding open-slat pergola, no solid roof or house attachment. Wind uplift, bracing, timber spans and footing design require site-specific verification. Extra-wide spans can require a different design.",
    );
  } else if (type === "Patio") {
    add("Pavers", area * 1.1, "Sq ft; 10% cuts/waste", 4);
    add(
      "Aggregate base",
      ((area * (6 / 12)) / 27) * 1.2 * 10,
      "0.1 cubic yard; 6-inch compacted base + 20% loose-volume allowance",
      7,
    );
    add(
      "Bedding sand",
      (area / 12 / 27) * 1.1 * 10,
      "0.1 cubic yard; 1-inch bed + 10% waste",
      6,
    );
    add(
      "Geotextile allowance",
      area * 1.15,
      "Sq ft; overlaps included, verify suitability with soil/base supplier",
      0.4,
    );
    add(
      "Edge restraint",
      perimeter * 1.1,
      "Linear ft; full perimeter + 10%",
      2,
    );
    add(
      "Edging spikes",
      perimeter + 4,
      "Each; 12-inch spacing allowance, manufacturer governs",
      1.3,
    );
    add(
      "Polymeric joint sand",
      area / 60,
      "50 lb bag; assumes 60 sq ft/bag, varies with paver/joint geometry",
      35,
    );
    hours = 12 + area * 0.23;
    difficulty =
      area > 200
        ? "Hard — heavy excavation and compaction"
        : "Intermediate — physically demanding";
    assumptions.push(
      "Pedestrian rectangular paver patio. Assumed base depths must be adjusted for soil, frost and drainage; no retaining wall, steps or vehicle loading. Screws/nails are not used for pavers; edging spikes are included.",
    );
  } else if (type === "Fence") {
    const panels = Math.ceil(l / 8),
      posts = panels + 1;
    add("Fence panels", panels, "6 × 8 ft nominal; cut end panel to fit", 95);
    add("Fence posts", posts, "Each; size/length and embedment TBD", 35);
    add(
      "Post concrete allowance",
      posts * 3,
      "80 lb bag; actual holes/soil/frost depth determine quantity",
      8,
    );
    add(
      "Drainage gravel allowance",
      posts,
      "0.5 cu ft bag; verify post detail",
      6,
    );
    add("Panel brackets", panels * 4, "Each; four/panel allowance", 5);
    add(
      "Exterior structural screws",
      panels * 24 * 1.1,
      "Individual fasteners; 24/panel + 10%, verify bracket schedule",
      0.35,
    );
    add("Post caps", posts, "Each; match post dimensions", 7);
    add(
      "Exterior finish",
      (l * 6 * 2) / 200,
      "Gallon; both faces, one coat at 200 sq ft/gal",
      45,
    );
    hours = 8 + panels * 2.5 + posts * 1.5;
    difficulty = "Intermediate–hard — post setting and alignment";
    assumptions.push(
      "One straight 6 ft high fence run using LENGTH only; width does not affect quantities. No gates, corners, slope changes or demolition included.",
    );
  } else if (type === "Shed") {
    add(
      "Foundation allowance",
      area,
      "Sq ft; foundation type/loads require design",
      5,
    );
    add("Floor framing allowance", area, "Sq ft; structural layout TBD", 4);
    add(
      "Floor sheathing",
      (area * 1.1) / 32,
      "4 × 8 ft sheet; thickness per design",
      45,
    );
    add(
      "Wall framing allowance",
      perimeter * 8,
      "Sq ft of 8 ft tall walls; openings/layout TBD",
      3,
    );
    add(
      "Roof framing allowance",
      area * 1.2,
      "Sq ft; simple roof allowance, pitch/loads TBD",
      4,
    );
    add(
      "Roof sheathing",
      (area * 1.2 * 1.1) / 32,
      "4 × 8 ft sheet; thickness per design",
      35,
    );
    add(
      "Siding",
      (perimeter * 8 * 1.1) / 32,
      "4 × 8 ft sheet equivalent; no opening deductions",
      55,
    );
    add(
      "Roof shingles",
      (area * 1.2 * 1.1) / 33.3,
      "Bundle covering 33.3 sq ft; verify selected product",
      40,
    );
    add("Roof underlayment", (area * 1.2) / 400, "400 sq ft roll", 85);
    add(
      "Drip edge / flashing allowance",
      perimeter * 1.2,
      "Linear ft; actual roof geometry TBD",
      3,
    );
    add(
      "Framing nails",
      (perimeter * 8 + area * 2) / 100,
      "5 lb box allowance; final nailing schedule governs",
      22,
    );
    add(
      "Sheathing / siding fasteners",
      (perimeter * 8 + area * 2.2) / 100,
      "1 lb box allowance; select nails/screws per panel instructions",
      10,
    );
    add(
      "Roofing nails",
      (area * 1.2) / 100,
      "1 lb box allowance; verify manufacturer schedule",
      8,
    );
    add(
      "Structural connectors and anchors",
      area,
      "Sq ft budget allowance; individual schedule needs approved design",
      2,
    );
    add(
      "Door and hinges / latch",
      1,
      "Basic door and hardware set allowance",
      300,
    );
    add("Trim and sealant", perimeter, "Linear ft budget allowance", 4);
    add(
      "Exterior paint / finish",
      (perimeter * 8 * 2) / 300,
      "Gallon; two coats at 300 sq ft/gal",
      40,
    );
    hours = 35 + area * 0.65;
    assumptions.push(
      "Simple uninsulated shed with 8 ft walls and one door; no windows, electrical, plumbing or interior finish. Roof geometry, openings and engineered connections must be specified before ordering.",
    );
  } else {
    return {
      materials,
      estimatedCostLow: 0,
      estimatedCostHigh: 0,
      estimatedHours: "Scope review needed",
      difficulty: "Not assessed",
      recommendedCrew: "To be determined",
      assumptions: [
        ...assumptions,
        "Custom projects need a defined design and quantity takeoff before cost or time can be estimated.",
      ],
    };
  }
  const factor =
    experienceLevel === "Experienced"
      ? 1
      : experienceLevel === "Some experience"
        ? 1.2
        : 1.5;
  const low = Math.ceil((hours * factor) / 4) * 4;
  const high = Math.ceil((hours * factor * 1.6) / 4) * 4;
  const total = materials.reduce((sum, m) => sum + m.quantity * m.unitCost, 0);
  assumptions.push(
    `Time is a planning allowance: ${low}–${high} total person-hours for ${experienceLevel.toLowerCase()} builders; a ${crew}-person crew working 6 productive hours/day takes roughly ${Math.ceil(low / (crew * 6))}–${Math.ceil(high / (crew * 6))} workdays. Excludes permits, inspections, concrete curing, weather and material lead times. Crew efficiency varies.`,
  );
  return {
    materials,
    estimatedCostLow: Math.round(total * 0.8),
    estimatedCostHigh: Math.round(total * 1.4),
    estimatedHours: `${low}–${high} person-hours`,
    difficulty,
    recommendedCrew: `${crew} people total`,
    assumptions,
  };
}
