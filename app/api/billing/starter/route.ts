import { authenticatedUser } from "@/lib/billing/server";
import { claimStarter } from "@/lib/starter/claim";
import { DesignError } from "@/lib/services/image-design";
export const maxDuration = 60;
export async function POST(req: Request) {
  const headers = { "Cache-Control": "no-store" };
  try {
    const { db, user } = await authenticatedUser(req);
    const text = await req.text();
    if (text.length > 16_384)
      throw new DesignError("Invalid starter verification.", 400);
    let body;
    try {
      body = JSON.parse(text);
    } catch {
      throw new DesignError("Invalid starter verification.", 400);
    }
    if (
      !body ||
      typeof body.deviceToken !== "string" ||
      !/^[A-Za-z0-9+/=]{40,15000}$/.test(body.deviceToken)
    )
      throw new DesignError(
        "Update Site AI on your iPhone to verify the starter token.",
        400,
      );
    return Response.json(await claimStarter(db, user, body.deviceToken), {
      headers,
    });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof DesignError
            ? error.message
            : "The starter token check could not finish.",
      },
      { status: error instanceof DesignError ? error.status : 503, headers },
    );
  }
}
