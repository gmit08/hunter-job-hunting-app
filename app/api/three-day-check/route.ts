import { json, requireUser } from "@/lib/http";
import { isDemoMode } from "@/lib/mode";
import { readThreeDayCheckCompletedAt } from "@/lib/sheets";
import { QUESTIONS_UPDATED_TOAST } from "@/lib/three-day-check";
import { answersStatus, triggerThreeDayCheck } from "@/lib/webhook";

export async function GET() {
  const denied = await requireUser();
  if (denied) return denied;
  if (isDemoMode()) {
    return json({ ok: true, completedAt: new Date(Date.now() + 60_000).toISOString() });
  }
  try {
    const result = await readThreeDayCheckCompletedAt();
    return json({ ok: true, completedAt: result.completedAt });
  } catch {
    return json({ ok: false, message: "The 3-day check status could not be read." }, 502);
  }
}

export async function POST() {
  const denied = await requireUser();
  if (denied) return denied;
  if (isDemoMode()) return json({ ok: true, message: QUESTIONS_UPDATED_TOAST });
  const result = await triggerThreeDayCheck();
  return json({ ok: result.ok, message: result.message }, answersStatus(result));
}
