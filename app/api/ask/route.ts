import { answerProjectQuestion } from "@/lib/services/project-qa";
import { NextResponse } from "next/server";
export async function POST(req: Request) {
  try {
    const { question, project } = await req.json();
    if (
      typeof question !== "string" ||
      !question.trim() ||
      question.length > 1000 ||
      !project ||
      typeof project.projectType !== "string" ||
      !Number.isFinite(project.width) ||
      !Number.isFinite(project.length)
    )
      return NextResponse.json(
        { error: "Please enter a question." },
        { status: 400 },
      );
    const answer = await answerProjectQuestion(question, project);
    return NextResponse.json({ answer, demo: true });
  } catch {
    return NextResponse.json(
      { error: "Please try your question again." },
      { status: 400 },
    );
  }
}
