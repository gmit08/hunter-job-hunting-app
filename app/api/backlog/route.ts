import { requireUser, json } from "@/lib/http";
import { triggerBacklog } from "@/lib/webhook";

export async function POST() {
  const denied = await requireUser();
  if (denied) return denied;
  const result = await triggerBacklog();
  return json(result, result.ok ? 200 : 502);
}
