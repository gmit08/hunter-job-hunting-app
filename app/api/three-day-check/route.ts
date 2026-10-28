import { json, requireUser } from "@/lib/http";
import { readThreeDayCheckCompletedAt } from "@/lib/sheets";
import { answersStatus, triggerThreeDayCheck } from "@/lib/webhook";

export async function GET() {
  const denied = await requireUser();
  if (denied) return denied;
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
  const result = await triggerThreeDayCheck();
  return json({ ok: result.ok, message: result.message }, answersStatus(result));
}
