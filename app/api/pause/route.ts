import { requireUser, json } from "@/lib/http";
import { setPaused } from "@/lib/sheets";

export async function POST(request: Request) {
  const denied = await requireUser();
  if (denied) return denied;

  const body = (await request.json().catch(() => null)) as { paused?: unknown } | null;
  if (!body || typeof body.paused !== "boolean") {
    return json({ ok: false, message: "The pause switch sent an unexpected value." }, 400);
  }

  try {
    const result = await setPaused(body.paused);
    const message = result.sample
      ? body.paused
        ? "Pause is on in this preview only. Connect the Google Sheet to save it there."
        : "Pause is off in this preview only. Connect the Google Sheet to save it there."
      : body.paused
        ? "Runs are paused. Your assistant will skip the backlog."
        : "Runs can go ahead again.";
    return json({ ok: true, paused: result.paused, message });
  } catch (error) {
    return json(
      { ok: false, message: error instanceof Error ? error.message : "The pause switch did not save." },
      500,
    );
  }
}
