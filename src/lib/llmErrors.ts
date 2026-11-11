// Ответы API при ошибках ИИ — на языке интерфейса.
import { LlmError } from "./llm";

export function errorResponse(error: unknown, lang: "ru" | "kk") {
  const t = (ru: string, kk: string) => (lang === "kk" ? kk : ru);
  const e = error instanceof LlmError ? error : new LlmError("api", "unknown");
  switch (e.code) {
    case "no_key":
      return Response.json(
        {
          error: "no_key",
          message: t(
            "ИИ-модуль не настроен: на сервере нет ключа (GROQ_API_KEY или GEMINI_API_KEY — бесплатно, ANTHROPIC_API_KEY — платно).",
            "ИИ-модуль бапталмаған: серверде кілт жоқ (GROQ_API_KEY немесе GEMINI_API_KEY — тегін, ANTHROPIC_API_KEY — ақылы).",
          ),
        },
        { status: 503 },
      );
    case "auth":
      return Response.json(
        {
          error: "auth",
          message:
            t("Ключ ИИ на сервере не принят.", "Сервердегі ИИ кілті қабылданбады.") + (e.detail ? ` (${e.detail})` : ""),
          detail: e.detail,
        },
        { status: 502 },
      );
    case "rate_limit":
      return Response.json(
        {
          error: "rate_limit",
          message: t(
            "Исчерпан лимит бесплатных запросов к ИИ — попробуйте через минуту.",
            "ИИ-ге тегін сұраныстар шегі таусылды — бір минуттан кейін қайталаңыз.",
          ),
        },
        { status: 429 },
      );
    case "refusal":
      return Response.json({ error: "refusal", message: t("Модель не смогла ответить на этот запрос.", "Модель бұл сұраныққа жауап бере алмады.") }, { status: 422 });
    case "empty":
      return Response.json({ error: "empty", message: t("Модель вернула пустой ответ.", "Модель бос жауап қайтарды.") }, { status: 502 });
    default:
      return Response.json(
        {
          error: "api",
          message:
            t(`Ошибка ИИ-сервиса${e.status ? ` (${e.status})` : ""}.`, `ИИ-сервис қатесі${e.status ? ` (${e.status})` : ""}.`) +
            (e.detail ? ` ${e.detail}` : ""),
          detail: e.detail,
        },
        { status: 502 },
      );
  }
}
