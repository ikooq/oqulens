// Серверный модуль ИИ: один интерфейс для двух провайдеров.
// 1) Claude (Anthropic) — если задан ANTHROPIC_API_KEY;
// 2) Gemini (Google) — бесплатный тариф, если задан GEMINI_API_KEY.
// Провайдера можно выбрать явно переменной AI_PROVIDER=claude|gemini.
// В модель всегда уходят только агрегированные показатели, без данных учеников.
import Anthropic from "@anthropic-ai/sdk";

export type Provider = "claude" | "gemini";
export type Turn = { role: "user" | "assistant"; text: string };

export interface LlmRequest {
  /** Инструкции (неизменная часть) */
  system: string;
  /** Длинный общий контекст (сводка анализа): кешируется у Claude */
  context?: string;
  turns: Turn[];
  maxTokens: number;
  /** Насколько глубоко думать: чат — low, записка — medium */
  effort: "low" | "medium";
}

export interface LlmResult {
  text: string;
  provider: Provider;
  model: string;
  truncated: boolean;
}

export class LlmError extends Error {
  constructor(
    public code: "no_key" | "auth" | "rate_limit" | "refusal" | "empty" | "api",
    message: string,
    public status?: number,
    /** Короткое объяснение от провайдера — для диагностики (без ключа) */
    public detail?: string,
  ) {
    super(message);
  }
}

/** Ключ из переменной окружения: без пробелов, переносов строк и кавычек по краям. */
const cleanKey = (v: string | undefined) => (v ?? "").trim().replace(/^["']+|["']+$/g, "").trim();

/** Текст ошибки провайдера без чего-либо похожего на ключ. */
const safeDetail = (status: string | undefined, msg: string | undefined) =>
  `${status ?? ""}${status && msg ? ": " : ""}${msg ?? ""}`.replace(/AIza[0-9A-Za-z_\-]{10,}/g, "[key]").slice(0, 220);

const GEMINI_DEFAULT = "gemini-3.8-flash";
const GEMINI_FALLBACK = "gemini-3.5-flash-lite";

export function activeProvider(): Provider | null {
  const hasClaude = !!(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
  const hasGemini = !!(cleanKey(process.env.GEMINI_API_KEY) || cleanKey(process.env.GOOGLE_API_KEY));
  const forced = process.env.AI_PROVIDER;
  if (forced === "gemini" && hasGemini) return "gemini";
  if (forced === "claude" && hasClaude) return "claude";
  if (hasClaude) return "claude";
  if (hasGemini) return "gemini";
  return null;
}

export async function complete(req: LlmRequest): Promise<LlmResult> {
  const provider = activeProvider();
  if (!provider) throw new LlmError("no_key", "no AI key configured");
  return provider === "claude" ? claude(req) : gemini(req);
}

// ---------------------------------------------------------------- Claude

async function claude(req: LlmRequest): Promise<LlmResult> {
  const client = new Anthropic();
  const messages: Anthropic.Beta.BetaMessageParam[] = req.turns.map((t) => ({ role: t.role, content: t.text }));
  try {
    const response = await client.beta.messages.create({
      model: "claude-opus-5-5",
      max_tokens: req.maxTokens,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      thinking: { type: "adaptive" },
      output_config: { effort: req.effort },
      system: [
        { type: "text", text: req.system },
        ...(req.context ? [{ type: "text" as const, text: req.context, cache_control: { type: "ephemeral" as const } }] : []),
      ],
      messages,
    });
    if (response.stop_reason === "refusal") throw new LlmError("refusal", "refusal");
    const text = response.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
    if (!text) throw new LlmError("empty", "empty response");
    return { text, provider: "claude", model: response.model, truncated: response.stop_reason === "max_tokens" };
  } catch (error) {
    if (error instanceof LlmError) throw error;
    if (error instanceof Anthropic.AuthenticationError) throw new LlmError("auth", "invalid key");
    if (error instanceof Anthropic.RateLimitError) throw new LlmError("rate_limit", "rate limit");
    if (error instanceof Anthropic.APIError) throw new LlmError("api", "api error", error.status);
    throw new LlmError("api", "network error");
  }
}

// ---------------------------------------------------------------- Gemini (бесплатный тариф)

type GeminiPart = { text?: string; thought?: boolean };
type GeminiResponse = {
  candidates?: { content?: { parts?: GeminiPart[] }; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
  modelVersion?: string;
  error?: { code?: number; message?: string; status?: string };
};

async function gemini(req: LlmRequest): Promise<LlmResult> {
  const key = cleanKey(process.env.GEMINI_API_KEY) || cleanKey(process.env.GOOGLE_API_KEY);
  const primary = process.env.GEMINI_MODEL || GEMINI_DEFAULT;
  const models = [...new Set([primary, GEMINI_FALLBACK])];
  const body = {
    systemInstruction: { parts: [{ text: req.context ? `${req.system}\n\n${req.context}` : req.system }] },
    contents: req.turns.map((t) => ({ role: t.role === "assistant" ? "model" : "user", parts: [{ text: t.text }] })),
    // В лимит входят и «размышления» модели, поэтому берём с запасом
    generationConfig: { maxOutputTokens: Math.max(req.maxTokens, 8192), temperature: 0.4 },
  };

  let lastError: LlmError = new LlmError("api", "no model answered");
  for (const model of models) {
    let res: Response;
    try {
      res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(55_000),
      });
    } catch {
      lastError = new LlmError("api", "network error");
      continue;
    }
    const data = (await res.json().catch(() => ({}))) as GeminiResponse;
    if (!res.ok) {
      const msg = data.error?.message ?? "";
      const detail = safeDetail(data.error?.status, msg);
      console.error(`[gemini] ${model}: HTTP ${res.status} ${detail}`);
      if (res.status === 400 && /api key/i.test(msg)) throw new LlmError("auth", "invalid key", 400, detail);
      if (res.status === 401 || res.status === 403) throw new LlmError("auth", "invalid key", res.status, detail);
      // Лимит бесплатного тарифа, перегрузка или модель недоступна — пробуем запасную модель
      lastError =
        res.status === 429 ? new LlmError("rate_limit", "rate limit", 429, detail) : new LlmError("api", msg || "api error", res.status, detail);
      if ([404, 429, 500, 503].includes(res.status)) continue;
      throw lastError;
    }
    if (data.promptFeedback?.blockReason) throw new LlmError("refusal", data.promptFeedback.blockReason);
    const cand = data.candidates?.[0];
    const text = (cand?.content?.parts ?? [])
      .filter((p) => !p.thought && typeof p.text === "string")
      .map((p) => p.text)
      .join("")
      .trim();
    if (!text) {
      if (cand?.finishReason === "SAFETY") throw new LlmError("refusal", "safety");
      lastError = new LlmError("empty", "empty response");
      continue;
    }
    return { text, provider: "gemini", model: data.modelVersion || model, truncated: cand?.finishReason === "MAX_TOKENS" };
  }
  throw lastError;
}
