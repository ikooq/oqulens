// Защита ИИ-эндпоинтов от злоупотреблений: лимит запросов с одного адреса
// и проверка, что запрос пришёл с нашего же сайта.
// Счётчики живут в памяти экземпляра сервера — для хакатона и пилота этого достаточно;
// для нескольких регионов счётчик переносится в общее хранилище (Redis / KV).

export interface Limit {
  /** Сколько запросов разрешено за окно */
  max: number;
  /** Длина окна, мс */
  windowMs: number;
}

type Bucket = { count: number; reset: number };
const buckets = new Map<string, Bucket>();

export interface LimitResult {
  ok: boolean;
  /** Через сколько секунд можно повторить */
  retryAfter: number;
  remaining: number;
}

export function hit(key: string, limits: Limit[], now = Date.now()): LimitResult {
  // Сначала проверяем все окна, потом списываем — чтобы отказ не «съедал» попытку
  let retryAfter = 0;
  let remaining = Infinity;
  const states = limits.map((l) => {
    const k = `${key}|${l.windowMs}`;
    let b = buckets.get(k);
    if (!b || b.reset <= now) b = { count: 0, reset: now + l.windowMs };
    if (b.count >= l.max) retryAfter = Math.max(retryAfter, Math.ceil((b.reset - now) / 1000));
    remaining = Math.min(remaining, l.max - b.count - 1);
    return [k, b] as const;
  });
  if (retryAfter > 0) return { ok: false, retryAfter, remaining: 0 };
  for (const [k, b] of states) {
    b.count++;
    buckets.set(k, b);
  }
  // Не даём карте расти бесконечно
  if (buckets.size > 5000) for (const [k, b] of buckets) if (b.reset <= now) buckets.delete(k);
  return { ok: true, retryAfter: 0, remaining: Math.max(0, remaining) };
}

export function clientIp(req: Request): string {
  const h = req.headers;
  return (h.get("x-real-ip") || h.get("x-forwarded-for")?.split(",")[0] || "local").trim();
}

/** Запрос со стороннего сайта (браузер всегда присылает Origin для POST). */
export function foreignOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return false; // серверные клиенты и тесты
  try {
    const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
    return new URL(origin).host !== host;
  } catch {
    return true;
  }
}

export const LIMITS = {
  /** Чат: 10 вопросов в минуту и 150 в сутки с одного адреса */
  ask: [
    { max: 10, windowMs: 60_000 },
    { max: 150, windowMs: 86_400_000 },
  ],
  /** ИИ-записка тяжелее: 3 в минуту и 30 в сутки */
  report: [
    { max: 3, windowMs: 60_000 },
    { max: 30, windowMs: 86_400_000 },
  ],
  /** Общий предохранитель на экземпляр сервера — бережёт бесплатную квоту */
  global: [{ max: 60, windowMs: 60_000 }],
} satisfies Record<string, Limit[]>;

/** Ответ 429 / 403 на языке интерфейса или null, если запрос можно выполнять. */
export function guard(req: Request, kind: "ask" | "report", lang: "ru" | "kk"): Response | null {
  const t = (ru: string, kk: string) => (lang === "kk" ? kk : ru);
  if (foreignOrigin(req))
    return Response.json({ error: "forbidden", message: t("Запрос с чужого сайта отклонён.", "Бөгде сайттан келген сұраныс қабылданбады.") }, { status: 403 });
  const g = hit("global", LIMITS.global);
  const r = g.ok ? hit(`${kind}:${clientIp(req)}`, LIMITS[kind]) : g;
  if (r.ok) return null;
  return Response.json(
    {
      error: "rate_limit",
      message: t(
        `Слишком много запросов к ИИ. Повторите через ${r.retryAfter} с. Готовые вопросы и автоматическая записка работают без ограничений.`,
        `ИИ-ге сұраныстар тым көп. ${r.retryAfter} с кейін қайталаңыз. Дайын сұрақтар мен автоматты жазба шектеусіз жұмыс істейді.`,
      ),
    },
    { status: 429, headers: { "Retry-After": String(r.retryAfter) } },
  );
}
