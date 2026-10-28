export type WebhookEnv = {
  url?: string;
  key?: string;
  header?: string;
  scheme?: string;
  bodyField?: string;
  production?: boolean;
  action?: string;
  source?: string;
  urlLabel?: string;
  keyLabel?: string;
  missingMessage?: string;
};

export type WebhookRequest = {
  url: string;
  headers: Record<string, string>;
  body: Record<string, string>;
};

export type WebhookFailure = { ok: false; message: string; code?: "unconfigured" };

const DEFAULT_HEADER = "Authorization";
const DEFAULT_SCHEME = "Bearer";

function clean(value: string | undefined): string {
  return value?.trim() ?? "";
}

export function buildWebhookRequest(env: WebhookEnv): { ok: true; request: WebhookRequest } | WebhookFailure {
  const url = clean(env.url);
  const key = env.key?.trim() ?? "";
  const urlLabel = env.urlLabel ?? "WEBHOOK_URL";
  const keyLabel = env.keyLabel ?? "WEBHOOK_KEY";
  if (!url || !key) {
    return {
      ok: false,
      code: "unconfigured",
      message:
        env.missingMessage ??
        `Run backlog is not set up yet. Add ${urlLabel} and ${keyLabel} on the server, then try again.`,
    };
  }
  if (/[\r\n]/.test(key)) {
    return { ok: false, message: `${keyLabel} cannot contain a line break.` };
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { ok: false, message: `${urlLabel} is not a valid web address.` };
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return { ok: false, message: `${urlLabel} must start with https://.` };
  }
  if (env.production && parsed.protocol !== "https:") {
    return { ok: false, message: `${urlLabel} must use https:// once the dashboard is deployed.` };
  }

  const headerName = clean(env.header) || DEFAULT_HEADER;
  const scheme = env.scheme === undefined ? DEFAULT_SCHEME : env.scheme.trim();
  const bodyField = clean(env.bodyField);
  if (/[\r\n]/.test(headerName) || /[\r\n]/.test(bodyField)) {
    return { ok: false, message: "The webhook header settings cannot contain a line break." };
  }

  const skipHeader = headerName.toLowerCase() === "none";
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  const body: Record<string, string> = {
    action: env.action ?? "run-backlog",
    source: env.source ?? "job-hunt-dashboard",
  };

  if (!skipHeader) {
    const rawKey = !scheme || scheme.toLowerCase() === "raw" || scheme.toLowerCase() === "none";
    headers[headerName] = rawKey ? key : `${scheme} ${key}`;
  }

  const includeBody = bodyField !== "" && bodyField.toLowerCase() !== "none";
  if (includeBody) body[bodyField] = key;

  if (skipHeader && !includeBody) {
    return {
      ok: false,
      message: "Choose where the webhook key goes. Set WEBHOOK_KEY_HEADER, or set WEBHOOK_KEY_BODY_FIELD.",
    };
  }

  return { ok: true, request: { url: parsed.toString(), headers, body } };
}

export function webhookConfigured(): boolean {
  return Boolean(process.env.WEBHOOK_URL?.trim() && process.env.WEBHOOK_KEY?.trim());
}

export async function triggerBacklog(): Promise<{ ok: true; message: string } | { ok: false; message: string }> {
  const built = buildWebhookRequest({
    url: process.env.WEBHOOK_URL,
    key: process.env.WEBHOOK_KEY,
    header: process.env.WEBHOOK_KEY_HEADER,
    scheme: process.env.WEBHOOK_KEY_SCHEME,
    bodyField: process.env.WEBHOOK_KEY_BODY_FIELD,
    production: process.env.NODE_ENV === "production",
  });
  if (!built.ok) return built;

  try {
    const response = await fetch(built.request.url, {
      method: "POST",
      headers: built.request.headers,
      body: JSON.stringify(built.request.body),
      cache: "no-store",
      redirect: "follow",
      signal: AbortSignal.timeout(25000),
    });
    if (!response.ok) {
      return {
        ok: false,
        message: `The routine did not start. The webhook replied with status ${response.status}. Check the URL and the key.`,
      };
    }
    return { ok: true, message: "The backlog routine was started." };
  } catch {
    return { ok: false, message: "The routine did not start. The webhook could not be reached." };
  }
}

const ANSWERS_MISSING =
  "Send all answers is not set up yet. Add ANSWERS_WEBHOOK_URL and ANSWERS_WEBHOOK_KEY on the server, then try again.";

const THREE_DAY_CHECK_MISSING =
  "The 3-day check is not configured. Add THREEDAYCHECK_WEBHOOK_URL and THREEDAYCHECK_WEBHOOK_KEY on the server, then try again.";

export type WebhookPingResult = { ok: true; message: string } | { ok: false; message: string; unconfigured?: boolean };

export type AnswersResult = WebhookPingResult;

type PingMessages = {
  success: string;
  rejected: (status: number) => string;
  unreachable: string;
};

async function deliverWebhook(
  built: { ok: true; request: WebhookRequest } | WebhookFailure,
  fetchImpl: typeof fetch,
  messages: PingMessages,
): Promise<WebhookPingResult> {
  if (!built.ok) {
    return { ok: false, message: built.message, unconfigured: built.code === "unconfigured" };
  }

  try {
    const response = await fetchImpl(built.request.url, {
      method: "POST",
      headers: built.request.headers,
      body: JSON.stringify(built.request.body),
      cache: "no-store",
      redirect: "follow",
      signal: AbortSignal.timeout(25000),
    });
    if (!response.ok) {
      return { ok: false, message: messages.rejected(response.status) };
    }
    return { ok: true, message: messages.success };
  } catch {
    return { ok: false, message: messages.unreachable };
  }
}

type AnswersEnv = {
  ANSWERS_WEBHOOK_URL?: string;
  ANSWERS_WEBHOOK_KEY?: string;
  WEBHOOK_KEY_HEADER?: string;
  WEBHOOK_KEY_SCHEME?: string;
  WEBHOOK_KEY_BODY_FIELD?: string;
  [key: string]: string | undefined;
};

export function answersStatus(result: { ok: boolean; unconfigured?: boolean }): number {
  if (result.ok) return 200;
  return result.unconfigured ? 400 : 502;
}

export async function triggerAnswers(options: {
  fetchImpl?: typeof fetch;
  env?: AnswersEnv;
  production?: boolean;
} = {}): Promise<AnswersResult> {
  const env = options.env ?? process.env;
  const built = buildWebhookRequest({
    url: env.ANSWERS_WEBHOOK_URL,
    key: env.ANSWERS_WEBHOOK_KEY,
    header: env.WEBHOOK_KEY_HEADER,
    scheme: env.WEBHOOK_KEY_SCHEME,
    bodyField: env.WEBHOOK_KEY_BODY_FIELD,
    production: options.production ?? process.env.NODE_ENV === "production",
    action: "answers-ready",
    source: "hunter",
    urlLabel: "ANSWERS_WEBHOOK_URL",
    keyLabel: "ANSWERS_WEBHOOK_KEY",
    missingMessage: ANSWERS_MISSING,
  });
  return deliverWebhook(built, options.fetchImpl ?? fetch, {
    success: "Your assistant was asked to submit the saved answers.",
    rejected: (status) => `Your assistant was not notified. The webhook replied with status ${status}.`,
    unreachable: "Your assistant was not notified. The webhook could not be reached.",
  });
}

type LinkedInAnswersEnv = {
  LINKEDIN_ANSWERS_WEBHOOK_URL?: string;
  LINKEDIN_ANSWERS_WEBHOOK_KEY?: string;
  WEBHOOK_KEY_HEADER?: string;
  WEBHOOK_KEY_SCHEME?: string;
  WEBHOOK_KEY_BODY_FIELD?: string;
  [key: string]: string | undefined;
};

export async function triggerLinkedInAnswers(
  options: {
    fetchImpl?: typeof fetch;
    env?: LinkedInAnswersEnv;
    production?: boolean;
  } = {},
): Promise<AnswersResult> {
  const env = options.env ?? process.env;
  const built = buildWebhookRequest({
    url: env.LINKEDIN_ANSWERS_WEBHOOK_URL,
    key: env.LINKEDIN_ANSWERS_WEBHOOK_KEY,
    header: env.WEBHOOK_KEY_HEADER,
    scheme: env.WEBHOOK_KEY_SCHEME,
    bodyField: env.WEBHOOK_KEY_BODY_FIELD,
    production: options.production ?? process.env.NODE_ENV === "production",
    action: "answers",
    source: "hunter",
    urlLabel: "LINKEDIN_ANSWERS_WEBHOOK_URL",
    keyLabel: "LINKEDIN_ANSWERS_WEBHOOK_KEY",
    missingMessage:
      "LinkedIn answers are not set up yet. Add LINKEDIN_ANSWERS_WEBHOOK_URL and LINKEDIN_ANSWERS_WEBHOOK_KEY on the server, then try again.",
  });
  return deliverWebhook(built, options.fetchImpl ?? fetch, {
    success: "Your assistant was asked to submit the saved answers.",
    rejected: (status) => `Your assistant was not notified. The webhook replied with status ${status}.`,
    unreachable: "Your assistant was not notified. The webhook could not be reached.",
  });
}

type ThreeDayCheckEnv = {
  THREEDAYCHECK_WEBHOOK_URL?: string;
  THREEDAYCHECK_WEBHOOK_KEY?: string;
  WEBHOOK_KEY_HEADER?: string;
  WEBHOOK_KEY_SCHEME?: string;
  WEBHOOK_KEY_BODY_FIELD?: string;
};

export async function triggerThreeDayCheck(
  options: {
    fetchImpl?: typeof fetch;
    env?: ThreeDayCheckEnv;
    production?: boolean;
  } = {},
): Promise<WebhookPingResult> {
  const env = options.env ?? process.env;
  const built = buildWebhookRequest({
    url: env.THREEDAYCHECK_WEBHOOK_URL,
    key: env.THREEDAYCHECK_WEBHOOK_KEY,
    header: env.WEBHOOK_KEY_HEADER,
    scheme: env.WEBHOOK_KEY_SCHEME,
    bodyField: env.WEBHOOK_KEY_BODY_FIELD,
    production: options.production ?? process.env.NODE_ENV === "production",
    action: "3daycheck",
    source: "hunter",
    urlLabel: "THREEDAYCHECK_WEBHOOK_URL",
    keyLabel: "THREEDAYCHECK_WEBHOOK_KEY",
    missingMessage: THREE_DAY_CHECK_MISSING,
  });
  return deliverWebhook(built, options.fetchImpl ?? fetch, {
    success: "3-day check started, results land in your tracker shortly",
    rejected: (status) => `The 3-day check did not start. The webhook replied with status ${status}.`,
    unreachable: "The 3-day check did not start. The webhook could not be reached.",
  });
}
