"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Calculator, Loader2, Send, Sparkles, X } from "lucide-react";
import { Analysis } from "@/lib/analytics";
import { answer, QuestionId, QUESTIONS, TabId } from "@/lib/answers";
import { buildSummary, ReportContext } from "@/lib/report";
import { DemoTruth } from "@/lib/types";
import { validateDemo } from "@/lib/validation";
import { useLang, useT } from "./lang";
import Markdown from "./Markdown";

type Msg = {
  role: "user" | "assistant";
  text: string;
  source?: "rules" | "ai" | "notice";
  tab?: TabId;
  school?: string;
  actionLabel?: string;
};

export default function Assistant({
  a,
  ctx,
  truth,
  initialAsk,
  open,
  onOpenChange,
  onNavigate,
}: {
  a: Analysis;
  ctx: ReportContext;
  truth?: DemoTruth;
  initialAsk?: QuestionId;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onNavigate: (tab: TabId, school?: string) => void;
}) {
  const lang = useLang();
  const t = useT();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [asked0, setAsked0] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const validation = useMemo(() => {
    if (!truth) return undefined;
    const checks = validateDemo(a, truth, lang);
    return { ok: checks.filter((c) => c.ok).length, total: checks.length };
  }, [a, truth, lang]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs, busy]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onOpenChange(false);
    window.addEventListener("keydown", onKey);
    setTimeout(() => inputRef.current?.focus(), 50);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  const asked = new Set(msgs.filter((m) => m.role === "user").map((m) => m.text));
  const suggestions = QUESTIONS.filter((qq) => !asked.has(lang === "kk" ? qq.kk : qq.ru));

  const askPreset = (id: QuestionId) => {
    const qq = QUESTIONS.find((x) => x.id === id)!;
    const ans = answer(id, a, lang, validation);
    setMsgs((m) => [...m, { role: "user", text: lang === "kk" ? qq.kk : qq.ru }, { role: "assistant", source: "rules", ...ans }]);
  };

  // Вопрос из ссылки (?ask=schools) задаётся один раз при первом открытии
  useEffect(() => {
    if (open && initialAsk && !asked0) {
      setAsked0(true);
      askPreset(initialAsk);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialAsk, asked0]);

  const askFree = async (text: string) => {
    const question = text.trim();
    if (!question || busy) return;
    const preset = QUESTIONS.find((x) => x.ru.toLowerCase() === question.toLowerCase() || x.kk.toLowerCase() === question.toLowerCase());
    setInput("");
    if (preset) return askPreset(preset.id);
    const history = msgs.filter((m) => m.source !== "notice").map((m) => ({ role: m.role, text: m.text }));
    setMsgs((m) => [...m, { role: "user", text: question }]);
    setBusy(true);
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ summary: buildSummary(a, ctx), question, history, lang }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.text) {
        setMsgs((m) => [...m, { role: "assistant", source: "ai", text: data.text }]);
      } else if (data.error === "no_key") {
        setMsgs((m) => [
          ...m,
          {
            role: "assistant",
            source: "notice",
            text: t(
              "ИИ-модуль пока не подключён на сервере, поэтому свободные вопросы недоступны. Выберите готовый вопрос ниже — ответы на них считаются прямо из данных.",
              "ИИ-модуль серверде әлі қосылмаған, сондықтан еркін сұрақтар қолжетімсіз. Төмендегі дайын сұрақты таңдаңыз — оларға жауап тікелей деректерден есептеледі.",
            ),
          },
        ]);
      } else {
        setMsgs((m) => [
          ...m,
          { role: "assistant", source: "notice", text: data.message ?? t("Не удалось получить ответ ИИ.", "ИИ жауабын алу мүмкін болмады.") },
        ]);
      }
    } catch {
      setMsgs((m) => [...m, { role: "assistant", source: "notice", text: t("Нет связи с сервером.", "Сервермен байланыс жоқ.") }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {!open && (
        <button
          onClick={() => onOpenChange(true)}
          data-tour="assistant"
          className="fixed right-5 bottom-5 z-40 inline-flex items-center gap-2 rounded-full bg-ink px-4 py-3 text-[13.5px] font-bold text-white shadow-xl shadow-slate-900/25 ring-1 ring-white/10 transition hover:-translate-y-0.5 hover:bg-ink-2 print:hidden"
        >
          <Sparkles size={17} className="text-emerald-300" />
          {t("Спросить OquLens", "OquLens-тен сұрау")}
        </button>
      )}
      {open && (
        <div className="fixed inset-0 z-50 flex justify-end print:hidden" role="dialog" aria-label={t("ИИ-ассистент", "ИИ-көмекші")}>
          <button className="absolute inset-0 bg-slate-900/25" onClick={() => onOpenChange(false)} aria-label={t("Закрыть", "Жабу")} />
          <div className="relative flex h-full w-full flex-col bg-white shadow-2xl sm:w-[440px]">
            <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-ink text-emerald-300">
                  <Sparkles size={18} />
                </span>
                <div>
                  <h2 className="text-[15px] font-extrabold text-slate-900">{t("Ассистент OquLens", "OquLens көмекшісі")}</h2>
                  <p className="text-[12px] text-muted">{t("Отвечает по результатам этого анализа", "Осы талдау нәтижелері бойынша жауап береді")}</p>
                </div>
              </div>
              <button onClick={() => onOpenChange(false)} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100" aria-label={t("Закрыть", "Жабу")}>
                <X size={18} />
              </button>
            </div>

            <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto bg-surface px-4 py-4">
              <Bubble role="assistant">
                <p className="text-[13px] leading-relaxed text-slate-700">
                  {t(
                    "Здравствуйте! Спросите о результатах: трудные разделы, школы, учебники, часы. Готовые вопросы считаются мгновенно прямо из данных, свои вопросы обрабатывает ИИ.",
                    "Сәлеметсіз бе! Нәтижелер туралы сұраңыз: қиын бөлімдер, мектептер, оқулықтар, сағаттар. Дайын сұрақтарға жауап деректерден бірден есептеледі, өз сұрақтарыңызды ИИ өңдейді.",
                  )}
                </p>
              </Bubble>
              {msgs.map((m, i) =>
                m.role === "user" ? (
                  <div key={i} className="flex justify-end">
                    <div className="max-w-[85%] rounded-2xl rounded-br-md bg-ink px-3.5 py-2.5 text-[13px] leading-relaxed text-white">{m.text}</div>
                  </div>
                ) : (
                  <Bubble key={i} role="assistant" notice={m.source === "notice"}>
                    <Markdown text={m.text} compact />
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                      {m.source !== "notice" && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted">
                          {m.source === "ai" ? <Sparkles size={12} /> : <Calculator size={12} />}
                          {m.source === "ai" ? t("Ответ ИИ (Claude)", "ИИ жауабы (Claude)") : t("Ответ из расчётов", "Есептеулерден алынған жауап")}
                        </span>
                      )}
                      {m.tab && m.actionLabel && (
                        <button
                          onClick={() => {
                            onNavigate(m.tab!, m.school);
                            onOpenChange(false);
                          }}
                          className="inline-flex items-center gap-1 text-[12px] font-semibold text-brand hover:underline"
                        >
                          {m.actionLabel} <ArrowRight size={12} />
                        </button>
                      )}
                    </div>
                  </Bubble>
                ),
              )}
              {busy && (
                <Bubble role="assistant">
                  <span className="inline-flex items-center gap-2 text-[13px] text-muted">
                    <Loader2 size={14} className="animate-spin" /> {t("Думаю…", "Ойланып жатырмын…")}
                  </span>
                </Bubble>
              )}
            </div>

            <div className="border-t border-line bg-white px-4 pt-3 pb-4">
              {suggestions.length > 0 && (
                <div className="no-scrollbar -mx-1 mb-3 flex gap-1.5 overflow-x-auto px-1 pb-0.5">
                  {suggestions.map((qq) => (
                    <button
                      key={qq.id}
                      onClick={() => askPreset(qq.id)}
                      className="shrink-0 rounded-full bg-brand-50 px-3 py-1.5 text-[12px] font-semibold text-brand ring-1 ring-brand/20 transition hover:bg-brand hover:text-white"
                    >
                      {lang === "kk" ? qq.kk : qq.ru}
                    </button>
                  ))}
                </div>
              )}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  askFree(input);
                }}
                className="flex items-end gap-2"
              >
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      askFree(input);
                    }
                  }}
                  rows={1}
                  placeholder={t("Например: почему Школа 42 отстаёт по функциям?", "Мысалы: 42-мектеп функция бойынша неге артта?")}
                  className="max-h-28 min-h-[42px] flex-1 resize-none rounded-xl border border-line px-3 py-2.5 text-[13px] outline-none focus:border-brand"
                />
                <button
                  type="submit"
                  disabled={busy || !input.trim()}
                  className="flex h-[42px] w-[42px] items-center justify-center rounded-xl bg-brand text-white transition hover:bg-brand-600 disabled:opacity-40"
                  aria-label={t("Отправить", "Жіберу")}
                >
                  <Send size={16} />
                </button>
              </form>
              <p className="mt-2 text-[11px] leading-snug text-muted">
                {t(
                  "В ИИ уходят только сводные показатели по разделам, учебникам и школам — без данных учеников.",
                  "ИИ-ге тек бөлімдер, оқулықтар және мектептер бойынша жиынтық көрсеткіштер жіберіледі — оқушылар деректерінсіз.",
                )}
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Bubble({ children, notice = false }: { role: "assistant"; children: React.ReactNode; notice?: boolean }) {
  return (
    <div className="flex">
      <div
        className={`max-w-[92%] rounded-2xl rounded-bl-md px-3.5 py-2.5 ring-1 ${notice ? "bg-amber-50 ring-amber-200" : "bg-white ring-line"}`}
      >
        {children}
      </div>
    </div>
  );
}
