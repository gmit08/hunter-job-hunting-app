const URL_SOURCE = "https?:\\/\\/[^\\s<>\"']+";

const DIRECT_APPLY_PHRASES = [
  "apply directly",
  "apply yourself",
  "manual apply",
  "couldn't submit",
  "could not submit",
  "blocked",
  "captcha",
  "security check",
  "can't get past",
  "cannot get past",
  "please submit on the company site",
];

const POSTING_LABEL_AT_END =
  /\b(?:(?:the|a)\s+)?(?:job\s+)?posting(?:\s+is)?\s*:?\s*$|\b(?:the\s+)?(?:link|url)\s+is\s*$/i;

const APPLY_LABEL_AT_END =
  /\b(?:apply\s+page|application\s+page|apply\s+link|application\s+link|apply)\s*:\s*$/i;

const ATS_HOST = /(?:^|\.)(?:ashbyhq\.com|greenhouse\.io|lever\.co|myworkdayjobs\.com|workday\.com)$/i;

export const APPLY_LINK_LABEL = "Apply on company site";

export function isApplicationLinkField(header: string): boolean {
  const key = header.trim().toLowerCase();
  return key === "application link" || key === "posting link" || key === "apply link" || key === "job link";
}

function normalizeCopy(text: string): string {
  return text.replace(/\u00a0/g, " ").replace(/[\u2018\u2019\u2032]/g, "'");
}

function trimUrl(url: string): string {
  return url.replace(/[),.;]+$/g, "");
}

export function firstUrl(text: string): string | null {
  const match = normalizeCopy(text).match(new RegExp(URL_SOURCE, "i"));
  if (!match) return null;
  return trimUrl(match[0]);
}

function isAtsApplyUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (ATS_HOST.test(parsed.hostname)) return true;
    return /\/application\/?$/i.test(parsed.pathname);
  } catch {
    return false;
  }
}

type UrlHit = {
  start: number;
  end: number;
  url: string;
  kind: "posting" | "apply" | "plain";
};

function urlHits(text: string): UrlHit[] {
  const hits: UrlHit[] = [];
  for (const match of text.matchAll(new RegExp(URL_SOURCE, "gi"))) {
    const raw = match[0];
    const urlStart = match.index ?? 0;
    const urlEnd = urlStart + raw.length;
    const before = text.slice(0, urlStart);
    const posting = before.match(POSTING_LABEL_AT_END);
    const applyLabel = before.match(APPLY_LABEL_AT_END);
    const url = trimUrl(raw);
    let kind: UrlHit["kind"] = "plain";
    let start = urlStart;
    if (posting && posting.index != null) {
      kind = "posting";
      start = posting.index;
    } else if ((applyLabel && applyLabel.index != null) || isAtsApplyUrl(url)) {
      kind = "apply";
      if (applyLabel && applyLabel.index != null) start = applyLabel.index;
    }
    let end = urlEnd;
    const trail = text.slice(urlEnd).match(/^\s+\./);
    if (trail) end += trail[0].length;
    hits.push({ start, end, url, kind });
  }
  return hits;
}

export function asksForDirectApply(text: string): boolean {
  const normalized = normalizeCopy(text);
  return DIRECT_APPLY_PHRASES.some((phrase) => {
    const pattern = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`\\b${pattern}\\b`, "i").test(normalized);
  });
}

function tidyStrippedText(text: string): string {
  return text
    .replace(/\b(?:(?:the|a)\s+)?(?:job\s+)?posting(?:\s+is)?\s*:\s*/gi, "")
    .replace(/\b(?:the\s+)?(?:link|url)\s+is\s*/gi, "")
    .replace(/\b(?:apply\s+page|application\s+page|apply\s+link|application\s+link)\s*:\s*/gi, "")
    .replace(/\s+([?.!,;:])/g, "$1")
    .replace(/([.?!])(?:\s*[.?!])+/g, "$1")
    .replace(/\s{2,}/g, " ")
    .replace(/^\s*[.?!]\s*/, "")
    .trim();
}

function textWithoutUrls(text: string, hits: UrlHit[]): string {
  const ordered = [...hits].sort((left, right) => right.start - left.start);
  let out = text;
  for (const hit of ordered) {
    out = `${out.slice(0, hit.start)} ${out.slice(hit.end)}`;
  }
  return tidyStrippedText(out);
}

export function splitDisplayText(text: string): { text: string; applyHref: string | null } {
  const normalized = normalizeCopy(text);
  const hits = urlHits(normalized);
  if (hits.length === 0) return { text: normalized.trim(), applyHref: null };
  const applyHit = hits.find((hit) => hit.kind === "apply");
  const plainHit = hits.find((hit) => hit.kind === "plain");
  const applyHref = asksForDirectApply(normalized) ? (applyHit?.url ?? plainHit?.url ?? null) : null;
  return { text: textWithoutUrls(normalized, hits), applyHref };
}

export function presentQuestionText(
  text: string,
  link?: string | null,
): { text: string; applyHref: string | null } {
  const display = splitDisplayText(text);
  if (!asksForDirectApply(text)) return { text: display.text, applyHref: null };
  const columnHref = firstUrl(link ?? "");
  if (columnHref) return { text: display.text, applyHref: columnHref };
  return display;
}
