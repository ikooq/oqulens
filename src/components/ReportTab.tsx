"use client";

import { ReactNode, useMemo, useState } from "react";
import { Copy, Loader2, Printer, ShieldCheck, Sparkles } from "lucide-react";
import { Analysis } from "@/lib/analytics";
import { buildReport, buildSummary, ReportContext } from "@/lib/report";
import { Segmented } from "./ui";

type Source = "rules" | "ai";

export default function ReportTab({ a, ctx }: { a: Analysis; ctx: ReportContext }) {
  const rulesText = useMemo(() => buildReport(a, ctx), [a, ctx]);
  const [lang, setLang] = useState<"ru" | "kk">("ru");
  const [ai, setAi] = useState<{ text: string; lang: string } | null>(null);
  const [source, setSource] = useState<Source>("rules");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const generate = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ summary: buildSummary(a, ctx), lang }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Не удалось получить ответ ИИ.");
      setAi({ text: data.text, lang });
      setSource("ai");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось получить ответ ИИ.");
    } finally {
      setLoading(false);
    }
  };

  const text = source === "ai" && ai ? ai.text : rulesText;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-white p-4 print:hidden">
        <div className="flex flex-wrap items-center gap-3">
          <Segmented
            value={source}
            onChange={(v) => setSource(v)}
            options={[
              { value: "rules", label: "Автоматическая записка" },
              ...(ai ? [{ value: "ai" as Source, label: ai.lang === "kk" ? "ИИ-записка (қаз)" : "ИИ-записка" }] : []),
            ]}
          />
          <span className="hidden h-6 w-px bg-line sm:block" />
          <Segmented
            value={lang}
            onChange={setLang}
            options={[
              { value: "ru", label: "Рус" },
              { value: "kk", label: "Қаз" },
            ]}
          />
          <button
            onClick={generate}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg bg-brand px-3.5 py-2 text-[13px] font-bold text-white transition hover:bg-brand-600 disabled:opacity-60"
          >
            {loading ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
            {loading ? "ИИ пишет записку…" : ai ? "Сгенерировать заново" : "Сгенерировать ИИ-записку"}
          </button>
        </div>
        <div className="flex gap-2">
          <button
            onClick={async () => {
              await navigator.clipboard.writeText(text);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-[12.5px] font-semibold text-slate-700 hover:bg-slate-50"
          >
            <Copy size={14} /> {copied ? "Скопировано" : "Копировать"}
          </button>
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-[12.5px] font-semibold text-slate-700 hover:bg-slate-50"
          >
            <Printer size={14} /> PDF / печать
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl bg-amber-50 px-4 py-3 text-[13px] text-amber-900 ring-1 ring-amber-200 print:hidden">
          {error} Ниже — автоматическая записка, она собрана из тех же расчётов без ИИ.
        </div>
      )}

      <article className="mx-auto max-w-[860px] rounded-2xl border border-line bg-white px-10 py-9 shadow-[0_1px_2px_rgba(15,23,42,0.04)] print:max-w-none print:border-0 print:p-0 print:shadow-none">
        <Markdown text={text} />
      </article>

      <p className="flex items-center justify-center gap-2 text-[12px] text-muted print:hidden">
        <ShieldCheck size={14} /> В ИИ отправляются только агрегированные показатели по разделам, учебникам и школам — без данных отдельных учеников.
      </p>
    </div>
  );
}

// ---------- минимальный Markdown-рендерер (заголовки, списки, жирный/курсив) ----------

function inline(s: string): ReactNode[] {
  return s.split(/(\*\*[^*]+\*\*|\*[^*\s][^*]*\*)/g).map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (part.length > 2 && part.startsWith("*") && part.endsWith("*")) return <em key={i}>{part.slice(1, -1)}</em>;
    return part;
  });
}

function Markdown({ text }: { text: string }) {
  const out: ReactNode[] = [];
  let para: string[] = [];
  let list: { type: "ul" | "ol"; items: string[] } | null = null;
  const flush = () => {
    if (para.length) {
      out.push(
        <p key={out.length} className="my-3 text-[14px] leading-relaxed text-slate-700">
          {inline(para.join(" "))}
        </p>,
      );
      para = [];
    }
    if (list) {
      const items = list.items.map((it, i) => (
        <li key={i} className="pl-1">
          {inline(it)}
        </li>
      ));
      out.push(
        list.type === "ul" ? (
          <ul key={out.length} className="my-3 list-disc space-y-1.5 pl-5 text-[14px] leading-relaxed text-slate-700 marker:text-brand">
            {items}
          </ul>
        ) : (
          <ol key={out.length} className="my-3 list-decimal space-y-1.5 pl-5 text-[14px] leading-relaxed text-slate-700 marker:font-bold marker:text-brand">
            {items}
          </ol>
        ),
      );
      list = null;
    }
  };
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) {
      flush();
      continue;
    }
    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) {
      flush();
      const level = h[1].length;
      const cls =
        level === 1
          ? "mb-2 text-[26px] font-extrabold tracking-tight text-slate-900"
          : level === 2
            ? "mt-7 mb-2 border-b border-line pb-1.5 text-[17px] font-bold text-slate-900"
            : "mt-5 mb-1 text-[15px] font-bold text-slate-800";
      out.push(
        level === 1 ? (
          <h1 key={out.length} className={cls}>
            {inline(h[2])}
          </h1>
        ) : level === 2 ? (
          <h2 key={out.length} className={cls}>
            {inline(h[2])}
          </h2>
        ) : (
          <h3 key={out.length} className={cls}>
            {inline(h[2])}
          </h3>
        ),
      );
      continue;
    }
    const ul = line.match(/^[-*•]\s+(.*)$/);
    const ol = line.match(/^\d+[.)]\s+(.*)$/);
    if (ul || ol) {
      const type = ul ? "ul" : "ol";
      if (para.length || (list && list.type !== type)) flush();
      if (!list) list = { type, items: [] };
      list.items.push((ul ?? ol)![1]);
      continue;
    }
    if (/^-{3,}$/.test(line)) {
      flush();
      continue;
    }
    if (list) flush();
    para.push(line);
  }
  flush();
  return <div>{out}</div>;
}
