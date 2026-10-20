import { json, requireUser } from "@/lib/http";
import { answersStatus, triggerAnswers } from "@/lib/webhook";

export async function POST() {
  const denied = await requireUser();
  if (denied) return denied;
  const result = await triggerAnswers();
  return json({ ok: result.ok, message: result.message }, answersStatus(result));
}
