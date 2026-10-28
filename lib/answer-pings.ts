import { isAnsweredStatus, questionSourceLabel } from "./applications";
import { triggerAnswers, triggerLinkedInAnswers, type AnswersResult } from "./webhook";

export type AnswerRow = {
  status: string;
  source: string;
};

export function sourcesWithAnswers(questions: AnswerRow[]): { zipRecruiter: boolean; linkedIn: boolean } {
  let zipRecruiter = false;
  let linkedIn = false;
  for (const question of questions) {
    if (!isAnsweredStatus(question.status)) continue;
    const source = questionSourceLabel(question.source);
    if (source === "ZipRecruiter") zipRecruiter = true;
    if (source === "LinkedIn") linkedIn = true;
  }
  return { zipRecruiter, linkedIn };
}

type PingEnv = {
  ANSWERS_WEBHOOK_URL?: string;
  ANSWERS_WEBHOOK_KEY?: string;
  LINKEDIN_ANSWERS_WEBHOOK_URL?: string;
  LINKEDIN_ANSWERS_WEBHOOK_KEY?: string;
  WEBHOOK_KEY_HEADER?: string;
  WEBHOOK_KEY_SCHEME?: string;
  WEBHOOK_KEY_BODY_FIELD?: string;
};

function linkedInConfigured(env: PingEnv): boolean {
  return Boolean(env.LINKEDIN_ANSWERS_WEBHOOK_URL?.trim() && env.LINKEDIN_ANSWERS_WEBHOOK_KEY?.trim());
}

function callFailed(result: AnswersResult): boolean {
  return !result.ok && !result.unconfigured;
}

export async function dispatchAnswerPings(options: {
  questions: AnswerRow[];
  fetchImpl?: typeof fetch;
  env?: PingEnv;
  production?: boolean;
} = { questions: [] }): Promise<{ ok: boolean }> {
  const env = options.env ?? process.env;
  const needed = sourcesWithAnswers(options.questions);
  let failed = false;

  if (needed.zipRecruiter) {
    const result = await triggerAnswers({
      fetchImpl: options.fetchImpl,
      env,
      production: options.production,
    });
    if (!result.ok) failed = true;
  }

  if (needed.linkedIn && linkedInConfigured(env)) {
    const result = await triggerLinkedInAnswers({
      fetchImpl: options.fetchImpl,
      env,
      production: options.production,
    });
    if (callFailed(result)) failed = true;
  }

  return { ok: !failed };
}
