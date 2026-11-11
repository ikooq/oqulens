// Серверный модуль ИИ: один интерфейс для нескольких провайдеров.
// 1) Claude (Anthropic) — если задан ANTHROPIC_API_KEY;
// 2) Groq — бесплатный план без карты, если задан GROQ_API_KEY;
// 3) Gemini (Google) — бесплатный тариф, если задан GEMINI_API_KEY.
// Провайдера можно выбрать явно переменной AI_PROVIDER=claude|groq|gemini.
// В модель всегда уходят только агрегированные показатели, без данных учеников.
import Anthropic from "@anthropic-ai/sdk";

export type Provider = "claude" | "groq" | "gemini";
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
export const cleanKey = (v: string | undefined) => (v ?? "").trim().replace(/^["']+|["']+$/g, "").trim();

/** Текст ошибки провайдера без чего-либо похожего на ключ. */
export const safeDetail = (status: string | undefined, msg: string | undefined) =>
  `${status ?? ""}${status && msg ? ": " : ""}${msg ?? ""}`
    .replace(/AIza[0-9A-Za-z_\-]{10,}/g, "[key]")
    .replace(/gsk_[0-9A-Za-z]{10,}/g, "[key]")
    .slice(0, 220);

const GEMINI_DEFAULT = "gemini-3.8-flash";
const GEMINI_FALLBACK = "gemini-3.5-flash-lite";
// Бесплатный план Groq: у каждой модели свой лимит, поэтому при упоре в лимит переходим к следующей
const GROQ_MODELS = ["openai/gpt-oss-120b", "qwen/qwen3.8-27b", "openai/gpt-oss-20b"];

const keys = () => ({
  claude: !!(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN),
  groq: !!cleanKey(process.env.GROQ_API_KEY),
  gemini: !!(cleanKey(process.env.GEMINI_API_KEY) || cleanKey(process.env.GOOGLE_API_KEY)),
});

export function activeProvider(): Provider | null {
  const has = keys();
  const forced = process.env.AI_PROVIDER as Provider | undefined;
  if (forced && has[forced]) return forced;
  if (has.claude) return "claude";
  if (has.groq) return "groq";
  if (has.gemini) return "gemini";
  return null;
}

/** Бесплатные модели работают с небольшим лимитом токенов: убираем из сводки повторы и длинные пояснения. */
export function compactSummary(summary: unknown): unknown {
  if (!summary || typeof summary !== "object") return summary;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c: any = structuredClone(summary);
  delete c.key_findings;
  if (c.textbooks) delete c.textbooks.method;
  if (c.schools) {
    delete c.schools.method;
    if (Array.isArray(c.schools.below_expected)) c.schools.below_expected = c.schools.below_expected.slice(0, 5);
    if (Array.isArray(c.schools.above_expected)) c.schools.above_expected = c.schools.above_expected.slice(0, 5);
  }
  if (Array.isArray(c.hours?.sections)) for (const h of c.hours.sections) delete h.reason;
  if (c.dynamics_year_over_year) delete c.dynamics_year_over_year.verdict_legend;
  if (Array.isArray(c.sections))
    for (const s of c.sections) {
      if (Array.isArray(s.schools_below_expected)) s.schools_below_expected = s.schools_below_expected.slice(0, 2);
      if (Array.isArray(s.schools_above_expected)) s.schools_above_expected = s.schools_above_expected.slice(0, 2);
    }
  return c;
}

export async function complete(req: LlmRequest): Promise<LlmResult> {
  const provider = activeProvider();
  if (!provider) throw new LlmError("no_key", "no AI key configured");
  return provider === "claude" ? claude(req) : provider === "groq" ? groq(req) : gemini(req);
}

// ---------------------------------------------------------------- Groq (бесплатный план)

type GroqResponse = {
  choices?: { message?: { content?: string | null }; finish_reason?: string }[];
  model?: string;
  error?: { message?: string; type?: string; code?: string };
};

async function groq(req: LlmRequest): Promise<LlmResult> {
  const key = cleanKey(process.env.GROQ_API_KEY);
  const models = [...new Set([process.env.GROQ_MODEL || GROQ_MODELS[0], ...GROQ_MODELS])];
  const messages = [
    { role: "system", content: req.context ? `${req.system}\n\n${req.context}` : req.system },
    ...req.turns.map((t) => ({ role: t.role, content: t.text })),
  ];

  let lastError: LlmError = new LlmError("api", "no model answered");
  for (const model of models) {
    const gptOss = model.startsWith("openai/gpt-oss");
    let res: Response;
    try {
      res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model,
          messages,
          temperature: 0.4,
          // Лимит бесплатного плана — 8000 токенов в минуту, поэтому ответ ограничиваем
          max_completion_tokens: Math.min(req.maxTokens, req.effort === "low" ? 1500 : 3000),
          reasoning_effort: gptOss ? "low" : "none",
          include_reasoning: false,
        }),
        signal: AbortSignal.timeout(55_000),
      });
    } catch {
      lastError = new LlmError("api", "network error");
      continue;
    }
    const data = (await res.json().catch(() => ({}))) as GroqResponse;
    if (!res.ok) {
      const detail = safeDetail(data.error?.code ?? data.error?.type, data.error?.message);
      console.error(`[groq] ${model}: HTTP ${res.status} ${detail}`);
      if (res.status === 401 || res.status === 403) throw new LlmError("auth", "invalid key", res.status, detail);
      lastError =
        res.status === 429 ? new LlmError("rate_limit", "rate limit", 429, detail) : new LlmError("api", "api error", res.status, detail);
      // Лимит, слишком большой запрос, недоступная модель или сбой — пробуем следующую модель
      if ([400, 404, 413, 429, 498, 500, 502, 503].includes(res.status)) continue;
      throw lastError;
    }
    const choice = data.choices?.[0];
    const text = (choice?.message?.content ?? "").replace(/<think>[\s\S]*?<\/think>/g, "").trim();
    if (!text) {
      lastError = new LlmError("empty", "empty response");
      continue;
    }
    return { text, provider: "groq", model: data.model || model, truncated: choice?.finish_reason === "length" };
  }
  throw lastError;
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
