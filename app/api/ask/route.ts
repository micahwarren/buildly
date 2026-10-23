import { answerProjectQuestion } from "@/lib/services/project-qa";
import { NextResponse } from "next/server";
import { parseProjectBackup } from "@/lib/project-backup";
import { DesignError } from "@/lib/services/image-design";
import { checkChatLimit } from "@/lib/chat-rate-limit";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(req: Request) {
  try {
    const raw = await req.text();
    if (raw.length > 150000)
      throw new DesignError(
        "This conversation is too large. Please start a shorter question from your saved project.",
        413,
      );
    let question, project;
    try {
      const data = JSON.parse(raw);
      question = data.question;
      project = parseProjectBackup(
        JSON.stringify({
          format: "buildly-project-v1",
          project: {
            ...data.project,
            originalImage: "/images/before.svg",
            generatedImage: "/images/deck.svg",
          },
        }),
      );
    } catch {
      throw new DesignError(
        "Please open a valid saved project and enter a question.",
        400,
      );
    }
    if (
      typeof question !== "string" ||
      !question.trim() ||
      question.length > 1000
    )
      throw new DesignError(
        "Please enter a question under 1,000 characters.",
        400,
      );
    checkChatLimit(req);
    return NextResponse.json({
      answer: await answerProjectQuestion(question, project),
      demo: false,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof DesignError
            ? error.message
            : "The assistant could not answer. Please try again.",
      },
      { status: error instanceof DesignError ? error.status : 500 },
    );
  }
}
