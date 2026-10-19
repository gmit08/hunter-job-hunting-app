export type WebhookEnv = {
  url?: string;
  key?: string;
  header?: string;
  scheme?: string;
  bodyField?: string;
  production?: boolean;
};

export type WebhookRequest = {
  url: string;
  headers: Record<string, string>;
  body: Record<string, string>;
};

const DEFAULT_HEADER = "Authorization";
const DEFAULT_SCHEME = "Bearer";

function clean(value: string | undefined): string {
  return value?.trim() ?? "";
}

export function buildWebhookRequest(env: WebhookEnv): { ok: true; request: WebhookRequest } | { ok: false; message: string } {
  const url = clean(env.url);
  const key = env.key?.trim() ?? "";
  if (!url || !key) {
    return {
      ok: false,
      message: "Run backlog is not set up yet. Add WEBHOOK_URL and WEBHOOK_KEY on the server, then try again.",
    };
  }
  if (/[\r\n]/.test(key)) {
    return { ok: false, message: "WEBHOOK_KEY cannot contain a line break." };
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { ok: false, message: "WEBHOOK_URL is not a valid web address." };
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return { ok: false, message: "WEBHOOK_URL must start with https://." };
  }
  if (env.production && parsed.protocol !== "https:") {
    return { ok: false, message: "WEBHOOK_URL must use https:// once the dashboard is deployed." };
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
    action: "run-backlog",
    source: "job-hunt-dashboard",
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
