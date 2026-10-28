const URL_PATTERN = /https?:\/\/[^\s<>"']+/gi;

const APPLY_PROMPT =
  /\b(apply directly|apply yourself|apply on (their|the|company) site|manual apply|please apply|apply here|could not submit|couldn'?t submit|would not submit|won'?t submit|submit (it |this )?yourself)\b/i;

export const APPLY_LINK_LABEL = "Apply on company site";

export function isApplicationLinkField(header: string): boolean {
  const key = header.trim().toLowerCase();
  return key === "application link" || key === "posting link" || key === "apply link" || key === "job link";
}

export function firstUrl(text: string): string | null {
  const match = text.match(/https?:\/\/[^\s<>"']+/i);
  if (!match) return null;
  return match[0].replace(/[),.;]+$/, "");
}

function tidyStrippedText(text: string): string {
  return text
    .replace(/\b(the posting is|posting is|the link is|link is|the url is|url is)\s*[.?!]*/gi, "")
    .replace(/\s+([?.!,;:])/g, "$1")
    .replace(/([.?!])(?:\s*[.?!])+/g, "$1")
    .replace(/\s{2,}/g, " ")
    .replace(/^\s*[.?!]\s*/, "")
    .trim();
}

export function splitDisplayText(text: string): { text: string; applyHref: string | null } {
  const href = firstUrl(text);
  if (!href) return { text: text.trim(), applyHref: null };
  const applyHref = APPLY_PROMPT.test(text) ? href : null;
  const stripped = tidyStrippedText(text.replace(URL_PATTERN, " "));
  return { text: stripped, applyHref };
}
