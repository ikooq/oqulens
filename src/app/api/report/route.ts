// ИИ-записка методиста. В модель уходят только агрегированные показатели
// (без данных отдельных учеников). Без ключа API возвращает 503,
// и интерфейс показывает детерминированную записку.
import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";
export const maxDuration = 120;

const SYSTEM_RU = `Ты — опытный методист управления образования Казахстана. Тебе дают JSON со сводкой анализа результатов суммативного оценивания за раздел (СОР) по одному предмету и классу.

Напиши методическую записку для методистов и завучей.

Правила:
- Используй ТОЛЬКО цифры из JSON. Ничего не придумывай и не округляй иначе, чем до целых процентов или одного знака после запятой.
- Если synthetic_demo_data = true, один раз в начале укажи, что расчёт сделан на синтетических демо-данных.
- Пиши простым деловым языком без статистического жаргона: вместо «коэффициент» — «связь», вместо «доверительный интервал» — «с учётом погрешности».
- Различай «системную проблему» (раздел проседает везде: программа, учебник, часы) и «зависит от школы» (дело в преподавании).
- При сравнении учебников объясни, почему сырые баллы могут вводить в заблуждение, если рейтинги различаются.
- Рекомендации по часам формулируй как корректировку долгосрочного/календарно-тематического плана в рамках утверждённого объёма часов.
- Заверши конкретным планом действий на следующую четверть (нумерованный список, 4–6 пунктов, с адресатами) и коротким разделом об ограничениях.

Формат: Markdown. Заголовок «# Методическая записка», затем разделы «##». Списки через «- » или «1. ». Таблицы не используй. Объём — 450–700 слов.`;

const SYSTEM_KK = `Сен — Қазақстан білім басқармасының тәжірибелі әдіскерісің. Саған бір пән мен сынып бойынша бөлім бойынша жиынтық бағалау (БЖБ) нәтижелерін талдаудың JSON-қорытындысы беріледі.

Әдіскерлер мен оқу ісінің меңгерушілеріне арналған әдістемелік жазба жаз.

Ережелер:
- JSON-дағы сандарды ҒАНА қолдан. Ештеңе ойдан қоспа.
- Егер synthetic_demo_data = true болса, басында бір рет есеп синтетикалық демо-деректер бойынша жасалғанын көрсет.
- Статистикалық терминдерсіз, қарапайым іскерлік тілде жаз.
- «Жүйелі мәселе» (бөлім барлық мектепте төмен) мен «мектепке байланысты» (оқыту сапасы) жағдайларын ажырат.
- Оқулықтарды салыстырғанда, рейтингтер өзгерсе, шикі балдардың неге адастыратынын түсіндір.
- Сағаттар бойынша ұсыныстарды бекітілген сағат көлемі шегінде ұзақ мерзімді/күнтізбелік-тақырыптық жоспарды түзету ретінде жаз.
- Соңында келесі тоқсанға нақты іс-шаралар жоспары (нөмірленген тізім, 4–6 тармақ) және шектеулер туралы қысқа бөлім бер.
- Бөлім атауларын қазақша жаз (JSON-дағы бөлім атаулары орысша болса, оларды мағынасын сақтап қазақшаға аудар).

Пішім: Markdown. «# Әдістемелік жазба» тақырыбы, одан кейін «##» бөлімдері. Кестелер қолданба. Көлемі — 450–700 сөз.`;

export async function POST(req: Request) {
  const hasCredentials = !!(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
  if (!hasCredentials) {
    return Response.json({ error: "no_key", message: "ИИ-модуль не настроен: задайте ANTHROPIC_API_KEY на сервере." }, { status: 503 });
  }

  let body: { summary?: unknown; lang?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "bad_request", message: "Некорректный запрос." }, { status: 400 });
  }
  if (!body.summary || typeof body.summary !== "object") {
    return Response.json({ error: "bad_request", message: "Нет сводки анализа." }, { status: 400 });
  }
  const lang = body.lang === "kk" ? "kk" : "ru";
  const summaryJson = JSON.stringify(body.summary);
  if (summaryJson.length > 60_000) {
    return Response.json({ error: "too_large", message: "Сводка слишком большая." }, { status: 413 });
  }

  const client = new Anthropic();
  try {
    const response = await client.beta.messages.create({
      model: "claude-opus-5-5",
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium" },
      system: lang === "kk" ? SYSTEM_KK : SYSTEM_RU,
      messages: [
        {
          role: "user",
          content: `Сводка анализа (JSON):\n\n${summaryJson}`,
        },
      ],
    });

    if (response.stop_reason === "refusal") {
      return Response.json({ error: "refusal", message: "Модель не смогла подготовить записку для этих данных." }, { status: 422 });
    }
    const text = response.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
    if (!text) return Response.json({ error: "empty", message: "Модель вернула пустой ответ." }, { status: 502 });
    return Response.json({ text, model: response.model, truncated: response.stop_reason === "max_tokens" });
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError)
      return Response.json({ error: "auth", message: "Неверный ключ API на сервере." }, { status: 502 });
    if (error instanceof Anthropic.RateLimitError)
      return Response.json({ error: "rate_limit", message: "Превышен лимит запросов к ИИ — попробуйте через минуту." }, { status: 429 });
    if (error instanceof Anthropic.APIError)
      return Response.json({ error: "api", message: `Ошибка ИИ-сервиса (${error.status ?? "сеть"}).` }, { status: 502 });
    return Response.json({ error: "unknown", message: "Не удалось получить ответ ИИ." }, { status: 500 });
  }
}
