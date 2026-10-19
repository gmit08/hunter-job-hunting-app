export class SignInRequired extends Error {
  constructor() {
    super("Please sign in again.");
    this.name = "SignInRequired";
  }
}

export async function postJson<T extends { message?: string }>(url: string, body: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error("The dashboard could not reach the server. Check your connection and try again.");
  }

  const payload = (await response.json().catch(() => null)) as ({ ok?: boolean; message?: string } & T) | null;
  if (response.status === 401) {
    throw new SignInRequired();
  }
  if (!response.ok || payload?.ok === false) {
    throw new Error(payload?.message || "That did not work. Try again.");
  }
  return (payload ?? { message: "" }) as T;
}
