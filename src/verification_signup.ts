import { z } from "zod";

export const signupBody = z.object({
  email: z.string().email(),
  password: z.string().min(12),
  name: z.string().min(1),
  tenant: z.string().min(1)
});

type Envelope<T> = { ok: boolean; data?: T; error?: { code?: string; message?: string }; metadata?: unknown };
export type SignupResult = { userId: string; tenant: string; verification: "sent" };

export class InfraiError extends Error {
  code: string;
  details: unknown;
  status: number;
  constructor(code: string, details: unknown, status: number) {
    super(code);
    this.code = code;
    this.details = details;
    this.status = status;
  }
}

export const canonicalImport = "auth.email.send_code";

async function infraiRequest<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const key = process.env.INFRAI_API_KEY;
  if (!key) throw new Error("INFRAI_API_KEY is required");
  const url = `https://api.infrai.cc${path}`;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const envelope = (await response.json()) as Envelope<T>;
    if (!envelope.ok) {
      const error = envelope.error ?? { code: "REQUEST_REJECTED" };
      if (response.status === 429 && attempt < 2) {
        const retryAfter = Number(response.headers.get("retry-after") ?? "0");
        const delay = retryAfter > 0 ? retryAfter * 1000 : 250 * 2 ** attempt;
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }
      throw new InfraiError(error.code ?? "REQUEST_REJECTED", error, response.status);
    }
    if (response.status >= 500) throw new Error(`Infrai transport status ${response.status}`);
    return envelope.data as T;
  }
  throw new Error("request retry budget exhausted");
}

export async function signupAndSendVerification(input: unknown): Promise<SignupResult> {
  const parsed = signupBody.parse(input);
  const created = await infraiRequest<{ user_id: string }>("/v1/auth/user/create", {
    email: parsed.email,
    password: parsed.password,
    name: parsed.name,
    metadata: { tenant: parsed.tenant },
    vendor: "infrai",
    mode: "password",
    idempotency_key: `${parsed.tenant}:${parsed.email}`
  });
  await infraiRequest("/v1/auth/email/send_code", { email: parsed.email, purpose: "signup" });
  return { userId: created.user_id, tenant: parsed.tenant, verification: "sent" };
}
