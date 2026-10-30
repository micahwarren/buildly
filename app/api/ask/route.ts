import { generationUser } from "@/lib/production/access";
import { reservePurchase } from "@/lib/billing/server";
import { answerProjectQuestion } from "@/lib/services/project-qa";
import { NextResponse } from "next/server";
import { parseProjectBackup } from "@/lib/project-backup";
import { DesignError } from "@/lib/services/image-design";
import { checkChatLimit } from "@/lib/chat-rate-limit";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(req: Request) {
  try {
    const account = await generationUser(req, true);
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
    const { ownedProject } = await import("@/lib/production/projects");
    await ownedProject(account.db, account.user.id, project.id);
    const jobId = crypto.randomUUID();
    const claim = await account.db.rpc("buildly_claim_job", {
      p_user: account.user.id,
      p_id: jobId,
      p_kind: "plan",
      p_source: project.id,
      p_hash: jobId,
      p_daily: 20,
      p_global: 50,
    });
    if (claim.error) {
      const { jobError } = await import("@/lib/production/errors");
      throw jobError(claim.error.message);
    }
    try {
      const access = await reservePurchase(req, "chat", project.id);
      try {
        const answer = await answerProjectQuestion(question, project);
        await access.finish(true);
        await account.db
          .from("buildly_jobs")
          .update({ state: "complete" })
          .eq("id", jobId)
          .eq("user_id", account.user.id);
        return NextResponse.json({ answer, demo: false });
      } catch (error) {
        await access.finish(false);
        throw error;
      }
    } catch (error) {
      await account.db
        .from("buildly_jobs")
        .update({ state: "failed" })
        .eq("id", jobId)
        .eq("user_id", account.user.id);
      throw error;
    }
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
