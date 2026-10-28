import { dispatchAnswerPings } from "@/lib/answer-pings";
import { json, requireUser } from "@/lib/http";
import { isDemoMode } from "@/lib/mode";
import { loadQuestions } from "@/lib/sheets";
import { QUESTIONS_UPDATED_TOAST, THREE_DAY_CHECK_ERROR_TOAST } from "@/lib/three-day-check";

export async function POST() {
  const denied = await requireUser();
  if (denied) return denied;
  if (isDemoMode()) return json({ ok: true, message: QUESTIONS_UPDATED_TOAST });
  try {
    const questions = await loadQuestions();
    const result = await dispatchAnswerPings({ questions });
    if (!result.ok) return json({ ok: false, message: THREE_DAY_CHECK_ERROR_TOAST }, 502);
    return json({ ok: true, message: QUESTIONS_UPDATED_TOAST });
  } catch {
    return json({ ok: false, message: THREE_DAY_CHECK_ERROR_TOAST }, 502);
  }
}
