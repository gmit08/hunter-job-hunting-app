import { requireUser, json } from "@/lib/http";
import { isDemoMode } from "@/lib/mode";
import { saveAnswer } from "@/lib/sheets";

export async function POST(request: Request) {
  const denied = await requireUser();
  if (denied) return denied;

  const body = (await request.json().catch(() => null)) as {
    row?: unknown;
    question?: unknown;
    answer?: unknown;
  } | null;
  if (!body || typeof body.row !== "number" || typeof body.question !== "string" || typeof body.answer !== "string") {
    return json({ ok: false, message: "The answer could not be read. Try again." }, 400);
  }

  if (isDemoMode()) {
    const answer = body.answer.trim();
    if (!answer) return json({ ok: false, message: "Type an answer first." }, 400);
    if (answer.length > 4000) return json({ ok: false, message: "That answer is too long. Keep it under 4,000 characters." }, 400);
    return json({ ok: true, message: "Answer saved in this demo. It resets when you reload." });
  }

  try {
    const result = await saveAnswer({ row: body.row, question: body.question, answer: body.answer });
    return json({
      ok: true,
      message: result.sample
        ? "Answer saved in this preview only. It was not written to your sheet."
        : "Answer saved. Your assistant will see it on the next run.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The answer did not save.";
    const status = /type an answer|too long|could not be found|changed/i.test(message) ? 400 : 500;
    return json({ ok: false, message }, status);
  }
}
