import { NextResponse } from "next/server";
import { planProject } from "@/lib/services/project-planning";
const types = ["Deck", "Pergola", "Patio", "Fence", "Shed", "Something else"];
export async function POST(req: Request) {
  try {
    if (Number(req.headers.get("content-length")) > 4_000_000)
      return NextResponse.json(
        { error: "Please use a smaller photo." },
        { status: 413 },
      );
    const data = await req.json();
    if (
      typeof data.originalImage !== "string" ||
      !/^data:image\/(jpeg|png|webp);base64,/.test(data.originalImage) ||
      data.originalImage.length > 3_500_000 ||
      typeof data.description !== "string" ||
      !data.description.trim() ||
      data.description.length > 2000 ||
      !types.includes(data.projectType)
    ) {
      return NextResponse.json(
        {
          error:
            "Please add a valid photo, choose a project, and describe your idea.",
        },
        { status: 400 },
      );
    }
    if (
      !Number.isFinite(data.width) ||
      !Number.isFinite(data.length) ||
      data.width < 1 ||
      data.width > 100 ||
      data.length < 1 ||
      data.length > 200
    )
      return NextResponse.json(
        {
          error:
            "Please enter width from 1–100 feet and length from 1–200 feet.",
        },
        { status: 400 },
      );
    return NextResponse.json(
      await planProject({
        projectType: data.projectType,
        description: data.description.trim(),
        originalImage: data.originalImage,
        width: data.width,
        length: data.length,
        budget:
          typeof data.budget === "string"
            ? data.budget.slice(0, 100)
            : "Not sure",
        experienceLevel:
          typeof data.experienceLevel === "string"
            ? data.experienceLevel.slice(0, 100)
            : "Beginner",
      }),
    );
  } catch {
    return NextResponse.json(
      { error: "We could not prepare that plan. Please try again." },
      { status: 400 },
    );
  }
}
