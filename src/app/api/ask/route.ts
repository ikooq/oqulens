// ИИ-ассистент методиста: отвечает на вопросы по результатам анализа.
// В модель уходят только агрегированные показатели (без данных отдельных учеников).
// Без ключа API возвращает 503, и интерфейс предлагает готовые вопросы с ответами из расчётов.
import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";
export const maxDuration = 60;

const SYSTEM_RU = `Ты — ИИ-ассистент OquLens, помощник методиста управления образования Казахстана. У тебя есть JSON со сводкой анализа результатов суммативного оценивания за раздел (СОР): разделы, связи между разделами, школы относительно ожидаемого, учебники с поправкой на состав учеников, рекомендации по часам.

Правила:
- Отвечай ТОЛЬКО на основе JSON. Не придумывай цифры, школы и причины, которых там нет. Если данных для ответа нет — так и скажи и подскажи, где в OquLens это можно посмотреть.
- Пиши по-русски, коротко и по делу: 2–6 предложений или короткий список. Без статистического жаргона.
- Если synthetic_demo_data = true и пользователь спрашивает о реальных школах, напомни, что данные демонстрационные.
- Школы обсуждай как адресную поддержку и обмен опытом, а не как рейтинг для наказаний.
- Где уместно, назови вкладку OquLens с подробностями: «Трудные разделы», «Школы», «Учебники», «Учебные часы», «Методическая записка».
- Формат: обычный текст; для списка используй строки, начинающиеся с «- »; жирный — **так**. Без заголовков и таблиц.`;

const SYSTEM_KK = `Сен — OquLens ИИ-көмекшісісің, Қазақстан білім басқармасы әдіскерінің көмекшісі. Сенде бөлім бойынша жиынтық бағалау (БЖБ) нәтижелерін талдаудың JSON-қорытындысы бар: бөлімдер, бөлімдер арасындағы байланыстар, мектептердің күтілгенге қатысты нәтижесі, оқушылар құрамы ескерілген оқулықтар, сағат бойынша ұсыныстар.

Ережелер:
- ТЕК JSON негізінде жауап бер. Онда жоқ сандарды, мектептерді және себептерді ойдан шығарма. Жауап беруге дерек болмаса, соны айт және OquLens-тің қай жерінен көруге болатынын көрсет.
- Қазақ тілінде, қысқа әрі нақты жаз: 2–6 сөйлем немесе қысқа тізім. Статистикалық терминдерсіз.
- Егер synthetic_demo_data = true болса және пайдаланушы нақты мектептер туралы сұраса, деректердің демонстрациялық екенін еске сал.
- Мектептер туралы рейтинг немесе жаза ретінде емес, атаулы қолдау және тәжірибе алмасу ретінде айт.
- Қажет болса, толығырақ ақпарат бар OquLens қойындысын ата: «Қиын бөлімдер», «Мектептер», «Оқулықтар», «Оқу сағаттары», «Әдістемелік жазба».
- JSON-дағы атаулар орысша болса, мағынасын сақтап қазақшаға аудар.
- Пішім: қарапайым мәтін; тізім үшін «- » деп басталатын жолдар; жуан — **осылай**. Тақырыптар мен кестелерсіз.`;

type Turn = { role: "user" | "assistant"; text: string };

export async function POST(req: Request) {
  let body: { summary?: unknown; question?: unknown; history?: unknown; lang?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "bad_request", message: "Некорректный запрос." }, { status: 400 });
  }
  const lang = body.lang === "kk" ? "kk" : "ru";
  const t = (ru: string, kk: string) => (lang === "kk" ? kk : ru);

  if (!(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN)) {
    return Response.json(
      { error: "no_key", message: t("ИИ-модуль не настроен: на сервере нет ключа ANTHROPIC_API_KEY.", "ИИ-модуль бапталмаған: серверде ANTHROPIC_API_KEY кілті жоқ.") },
      { status: 503 },
    );
  }
  const question = typeof body.question === "string" ? body.question.trim().slice(0, 1000) : "";
  if (!question || !body.summary || typeof body.summary !== "object") {
    return Response.json({ error: "bad_request", message: t("Нет вопроса или сводки анализа.", "Сұрақ немесе талдау қорытындысы жоқ.") }, { status: 400 });
  }
  const summaryJson = JSON.stringify(body.summary);
  if (summaryJson.length > 60_000) {
    return Response.json({ error: "too_large", message: t("Сводка слишком большая.", "Қорытынды тым үлкен.") }, { status: 413 });
  }

  // Последние реплики диалога; первая должна быть от пользователя
  const history: Turn[] = Array.isArray(body.history)
    ? (body.history as Turn[])
        .filter((m) => (m?.role === "user" || m?.role === "assistant") && typeof m.text === "string" && m.text.trim())
        .slice(-8)
        .map((m) => ({ role: m.role, text: m.text.slice(0, 4000) }))
    : [];
  while (history.length && history[0].role !== "user") history.shift();
  const messages: Anthropic.Beta.BetaMessageParam[] = [];
  for (const m of history) {
    const last = messages[messages.length - 1];
    if (last && last.role === m.role) last.content = `${last.content as string}\n\n${m.text}`;
    else messages.push({ role: m.role, content: m.text });
  }
  if (messages.length && messages[messages.length - 1].role === "user") messages.pop();
  messages.push({ role: "user", content: question });

  const client = new Anthropic();
  try {
    const response = await client.beta.messages.create({
      model: "claude-opus-5-5",
      max_tokens: 4000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      thinking: { type: "adaptive" },
      output_config: { effort: "low" },
      system: [
        { type: "text", text: lang === "kk" ? SYSTEM_KK : SYSTEM_RU },
        // Сводка одинакова для всех вопросов сессии — кешируем её
        { type: "text", text: `Сводка анализа (JSON):\n\n${summaryJson}`, cache_control: { type: "ephemeral" } },
      ],
      messages,
    });

    if (response.stop_reason === "refusal") {
      return Response.json({ error: "refusal", message: t("Модель не смогла ответить на этот вопрос.", "Модель бұл сұраққа жауап бере алмады.") }, { status: 422 });
    }
    const text = response.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
    if (!text) return Response.json({ error: "empty", message: t("Модель вернула пустой ответ.", "Модель бос жауап қайтарды.") }, { status: 502 });
    return Response.json({ text, model: response.model });
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError)
      return Response.json({ error: "auth", message: t("Неверный ключ API на сервере.", "Сервердегі API кілті қате.") }, { status: 502 });
    if (error instanceof Anthropic.RateLimitError)
      return Response.json(
        { error: "rate_limit", message: t("Превышен лимит запросов к ИИ — попробуйте через минуту.", "ИИ сұраныстарының шегі асты — бір минуттан кейін қайталаңыз.") },
        { status: 429 },
      );
    if (error instanceof Anthropic.APIError)
      return Response.json({ error: "api", message: t(`Ошибка ИИ-сервиса (${error.status ?? "сеть"}).`, `ИИ-сервис қатесі (${error.status ?? "желі"}).`) }, { status: 502 });
    return Response.json({ error: "unknown", message: t("Не удалось получить ответ ИИ.", "ИИ жауабын алу мүмкін болмады.") }, { status: 500 });
  }
}
