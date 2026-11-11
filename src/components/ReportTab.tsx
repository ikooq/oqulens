"use client";

import { useEffect, useMemo, useState } from "react";
import { Copy, Loader2, Printer, ShieldCheck, Sparkles } from "lucide-react";
import { Analysis } from "@/lib/analytics";
import { Dynamics } from "@/lib/dynamics";
import { buildSummary, ReportContext } from "@/lib/report";
import { buildReport } from "@/lib/memo";
import { Lang, LANGS } from "@/lib/i18n";
import { Segmented } from "./ui";
import { useLang, useT } from "./lang";
import Markdown from "./Markdown";

type Source = "rules" | "ai";

export default function ReportTab({ a, ctx, dyn }: { a: Analysis; ctx: ReportContext; dyn?: Dynamics | null }) {
  const uiLang = useLang();
  const t = useT();
  const [lang, setLang] = useState<Lang>(uiLang);
  useEffect(() => setLang(uiLang), [uiLang]);
  const rulesText = useMemo(() => buildReport(a, ctx, lang), [a, ctx, lang]);
  const [ai, setAi] = useState<{ text: string; lang: Lang; provider?: string } | null>(null);
  const [source, setSource] = useState<Source>("rules");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const generate = async () => {
    setLoading(true);
    setError(null);
    const fail = t("Не удалось получить ответ ИИ.", "ИИ жауабын алу мүмкін болмады.");
    try {
      const res = await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ summary: buildSummary(a, ctx, dyn), lang }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          data.error === "no_key"
            ? t(
                "ИИ-модуль ещё не подключён: на сервере нет ключа (подойдёт бесплатный ключ Gemini).",
                "ИИ-модуль әлі қосылмаған: серверде кілт жоқ (тегін Gemini кілті жарайды).",
              )
            : (data.message ?? fail),
        );
      }
      setAi({ text: data.text, lang, provider: data.provider });
      setSource("ai");
    } catch (e) {
      setError(e instanceof Error ? e.message : fail);
    } finally {
      setLoading(false);
    }
  };

  const text = source === "ai" && ai ? ai.text : rulesText;

  return (
    <div className="space-y-5" data-tour="report">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-white p-4 print:hidden">
        <div className="flex flex-wrap items-center gap-3">
          <Segmented
            value={source}
            onChange={(v) => setSource(v)}
            options={[
              { value: "rules", label: t("Автоматическая записка", "Автоматты жазба") },
              ...(ai
                ? [
                    {
                      value: "ai" as Source,
                      label: `${ai.lang === "kk" ? t("ИИ-записка (қаз)", "ИИ-жазба (қаз)") : t("ИИ-записка", "ИИ-жазба (орыс)")} · ${
                        ai.provider === "gemini" ? "Gemini" : ai.provider === "groq" ? "Groq" : "Claude"
                      }`,
                    },
                  ]
                : []),
            ]}
          />
          <span className="hidden h-6 w-px bg-line sm:block" />
          <Segmented value={lang} onChange={setLang} options={LANGS} />
          <button
            onClick={generate}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg bg-brand px-3.5 py-2 text-[13px] font-bold text-white transition hover:bg-brand-600 disabled:opacity-60"
          >
            {loading ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
            {loading
              ? t("ИИ пишет записку…", "ИИ жазба жазып жатыр…")
              : ai
                ? t("Сгенерировать заново", "Қайта жасау")
                : t("Сгенерировать ИИ-записку", "ИИ-жазба жасау")}
          </button>
        </div>
        <div className="flex gap-2">
          <button
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(text);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              } catch {
                /* буфер обмена недоступен */
              }
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-[12.5px] font-semibold text-slate-700 hover:bg-slate-50"
          >
            <Copy size={14} /> {copied ? t("Скопировано", "Көшірілді") : t("Копировать", "Көшіру")}
          </button>
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-[12.5px] font-semibold text-slate-700 hover:bg-slate-50"
          >
            <Printer size={14} /> {t("PDF / печать", "PDF / басып шығару")}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl bg-amber-50 px-4 py-3 text-[13px] text-amber-900 ring-1 ring-amber-200 print:hidden">
          {error}{" "}
          {t(
            "Ниже — автоматическая записка, она собрана из тех же расчётов без ИИ.",
            "Төменде — автоматты жазба, ол ИИ-сыз дәл сол есептеулерден құрастырылған.",
          )}
        </div>
      )}

      <article className="mx-auto max-w-[860px] rounded-2xl border border-line bg-white px-6 py-7 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:px-10 sm:py-9 print:max-w-none print:border-0 print:p-0 print:shadow-none">
        <Markdown text={text} />
      </article>

      <p className="flex items-center justify-center gap-2 text-center text-[12px] text-muted print:hidden">
        <ShieldCheck size={14} className="shrink-0" />
        {t(
          "В ИИ отправляются только агрегированные показатели по разделам, учебникам и школам — без данных отдельных учеников.",
          "ИИ-ге тек бөлімдер, оқулықтар және мектептер бойынша жиынтық көрсеткіштер жіберіледі — жеке оқушылардың деректерінсіз.",
        )}
      </p>
    </div>
  );
}
