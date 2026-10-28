import { json, requireUser } from "@/lib/http";
import { answersStatus, triggerThreeDayCheck } from "@/lib/webhook";

export async function POST() {
  const denied = await requireUser();
  if (denied) return denied;
  const result = await triggerThreeDayCheck();
  return json({ ok: result.ok, message: result.message }, answersStatus(result));
}
