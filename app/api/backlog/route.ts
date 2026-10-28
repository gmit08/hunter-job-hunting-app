import { requireUser, json } from "@/lib/http";
import { isDemoMode } from "@/lib/mode";
import { triggerBacklog } from "@/lib/webhook";

export async function POST() {
  const denied = await requireUser();
  if (denied) return denied;
  if (isDemoMode()) return json({ ok: true, message: "The backlog routine was started." });
  const result = await triggerBacklog();
  return json(result, result.ok ? 200 : 502);
}
