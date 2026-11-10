"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Award, Check, Copy, Info, Lightbulb, Search, Target, TrendingDown, TrendingUp, Users } from "lucide-react";
import { Analysis, Flag, SchoolProfile } from "@/lib/analytics";
import { schoolActions, SchoolAction } from "@/lib/schools";
import { nClasses, nStudents, pct, pp, share } from "@/lib/format";
import { Badge, Card, Kpi, Note, Segmented } from "./ui";

const FLAG_COLOR: Record<Flag, string> = { below: "#dc2626", above: "#0f8a6c", none: "#94a3b8" };
const LANG: Record<SchoolProfile["language"], string> = { каз: "казахский язык", рус: "русский язык", смеш: "два языка обучения" };

export function defaultSchool(a: Analysis): string | undefined {
  const ranked = a.schools.filter((p) => p.rank > 0);
  return (ranked[ranked.length - 1] ?? a.schools[0])?.school;
}

export default function SchoolsTab({ a, school, onSelect }: { a: Analysis; school?: string; onSelect: (s: string) => void }) {
  const [query, setQuery] = useState("");
  const [only, setOnly] = useState<"all" | Flag>("all");
  const current = a.schools.find((p) => p.school === school) ?? a.schools.find((p) => p.school === defaultSchool(a));

  const list = useMemo(() => {
    const qq = query.trim().toLowerCase();
    return a.schools.filter(
      (p) =>
        (only === "all" || p.vaFlag === only) &&
        (!qq || p.school.toLowerCase().includes(qq) || p.district.toLowerCase().includes(qq)),
    );
  }, [a.schools, query, only]);

  const counts = { below: 0, above: 0, none: 0 } as Record<Flag, number>;
  for (const p of a.schools) counts[p.vaFlag]++;

  return (
    <div className="space-y-6">
      <Card
        title="Школы: результат относительно ожидаемого"
        subtitle="С учётом стартового уровня учеников, города/села и учебника. Точка — оценка, линия — 95% интервал. Нажмите на точку, чтобы открыть школу."
      >
        <div className="scroll-thin -mx-1 overflow-x-auto px-1">
          <div className="min-w-[680px]">
            <Caterpillar schools={a.schools} selected={current?.school} onSelect={onSelect} />
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[12.5px] text-muted">
          <Legend color={FLAG_COLOR.below} label={`Ниже ожидаемого: ${counts.below}`} />
          <Legend color={FLAG_COLOR.none} label={`В пределах ожидаемого: ${counts.none}`} />
          <Legend color={FLAG_COLOR.above} label={`Выше ожидаемого: ${counts.above}`} />
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
        <Card title="Список школ" className="xl:sticky xl:top-[92px] xl:self-start">
          <div className="space-y-3">
            <label className="flex h-9 items-center gap-2 rounded-lg border border-line bg-white px-2.5 focus-within:border-brand">
              <Search size={15} className="text-muted" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Школа или район"
                className="w-full bg-transparent text-[13px] outline-none"
              />
            </label>
            <Segmented
              value={only}
              onChange={setOnly}
              options={[
                { value: "all", label: "Все" },
                { value: "below", label: "Ниже" },
                { value: "above", label: "Выше" },
              ]}
            />
            <div className="scroll-thin -mx-1 max-h-[520px] space-y-1 overflow-y-auto px-1">
              {list.map((p) => (
                <button
                  key={p.school}
                  onClick={() => onSelect(p.school)}
                  className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left transition ${
                    p.school === current?.school ? "bg-brand-50 ring-1 ring-brand/30" : "hover:bg-slate-50"
                  }`}
                >
                  <div className="min-w-0">
                    <div className="truncate text-[13px] font-semibold text-slate-800">
                      {p.rank > 0 && <span className="tabular mr-1.5 text-muted">{p.rank}.</span>}
                      {p.school}
                    </div>
                    <div className="truncate text-[11.5px] text-muted">
                      {p.district} · {pct(p.mean)}
                    </div>
                  </div>
                  <VaBadge p={p} />
                </button>
              ))}
              {list.length === 0 && <p className="px-3 py-2 text-[12.5px] text-muted">Ничего не найдено.</p>}
            </div>
          </div>
        </Card>

        {current ? <SchoolCard a={a} p={current} /> : <Card>Нет данных по школам.</Card>}
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}

function VaBadge({ p }: { p: SchoolProfile }) {
  if (!Number.isFinite(p.valueAdded)) return <Badge>мало данных</Badge>;
  return <Badge tone={p.vaFlag === "below" ? "red" : p.vaFlag === "above" ? "green" : "gray"}>{pp(p.valueAdded)}</Badge>;
}

function Caterpillar({ schools, selected, onSelect }: { schools: SchoolProfile[]; selected?: string; onSelect: (s: string) => void }) {
  const pts = schools.filter((p) => Number.isFinite(p.valueAdded)).sort((x, y) => x.valueAdded - y.valueAdded);
  if (pts.length === 0) return <p className="text-[13px] text-muted">Недостаточно данных.</p>;
  const W = 1000;
  const H = 210;
  const padL = 44;
  const padR = 10;
  const padT = 12;
  const padB = 14;
  const lo = Math.min(-4, ...pts.map((p) => p.vaLo));
  const hi = Math.max(4, ...pts.map((p) => p.vaHi));
  const y = (v: number) => padT + ((hi - v) / (hi - lo)) * (H - padT - padB);
  const step = (W - padL - padR) / pts.length;
  const x = (i: number) => padL + step * (i + 0.5);
  const ticks = [-10, -5, 0, 5, 10].filter((t) => t >= lo && t <= hi);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Результат школ относительно ожидаемого">
      {ticks.map((t) => (
        <g key={t}>
          <line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} stroke={t === 0 ? "#64748b" : "#e2e8f0"} strokeDasharray={t === 0 ? "" : "3 4"} />
          <text x={padL - 8} y={y(t) + 4} textAnchor="end" fontSize="12" fill="#64748b">
            {t > 0 ? `+${t}` : t === 0 ? "0" : `−${-t}`}
          </text>
        </g>
      ))}
      {pts.map((p, i) => {
        const sel = p.school === selected;
        const c = FLAG_COLOR[p.vaFlag];
        return (
          <g key={p.school} onClick={() => onSelect(p.school)} className="cursor-pointer">
            <rect x={x(i) - step / 2} y={padT} width={step} height={H - padT - padB} fill={sel ? "#ecfdf5" : "transparent"} />
            <line x1={x(i)} x2={x(i)} y1={y(p.vaLo)} y2={y(p.vaHi)} stroke={c} strokeOpacity={0.45} strokeWidth={2} />
            <circle cx={x(i)} cy={y(p.valueAdded)} r={sel ? 6 : 3.6} fill={c} stroke={sel ? "#0c1a2b" : "none"} strokeWidth={2} />
            <title>
              {`${p.school} (${p.district}): ${pp(p.valueAdded)} к ожидаемому, средний ${pct(p.mean)}`}
            </title>
          </g>
        );
      })}
    </svg>
  );
}

const ACTION_TONE: Record<SchoolAction["tone"], { icon: React.ReactNode; chip: string }> = {
  risk: { icon: <AlertTriangle size={16} />, chip: "bg-red-50 text-red-600" },
  info: { icon: <Lightbulb size={16} />, chip: "bg-sky-50 text-sky-600" },
  good: { icon: <Award size={16} />, chip: "bg-emerald-50 text-emerald-600" },
};

function SchoolCard({ a, p }: { a: Analysis; p: SchoolProfile }) {
  const actions = useMemo(() => schoolActions(a, p), [a, p]);
  const [copied, setCopied] = useState(false);
  const total = a.schools.filter((s) => s.rank > 0).length;

  const copy = async () => {
    const lines = [
      `${p.school} (${p.district})`,
      `Средний результат ${pct(p.mean)}, относительно ожидаемого ${pp(p.valueAdded)}.`,
      "",
      ...actions.map((x) => `• ${x.title}. ${x.text}`),
    ];
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* буфер обмена недоступен */
    }
  };

  return (
    <div className="min-w-0 space-y-6">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-[20px] font-extrabold text-slate-900">{p.school}</h2>
            <p className="mt-0.5 text-[13px] text-muted">
              {p.district} · {p.urban ? "город" : "село"} · {LANG[p.language]} · {p.textbooks.join(", ")} · {nStudents(p.nStudents)} ·{" "}
              {nClasses(p.nClasses)}
            </p>
          </div>
          {p.rank > 0 && (
            <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-[12.5px] font-semibold text-slate-700">
              Место {p.rank} из {total}
            </span>
          )}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi icon={<Target size={15} />} label="Средний результат" value={pct(p.mean)} sub={`ожидалось ${pct(p.expected)}`} />
          <Kpi
            icon={p.valueAdded >= 0 ? <TrendingUp size={15} /> : <TrendingDown size={15} />}
            label="К ожидаемому"
            value={
              Number.isFinite(p.valueAdded) ? (
                <>
                  {pp(p.valueAdded).replace(" п.п.", "")}
                  <span className="ml-1 text-[14px] font-bold text-muted">п.п.</span>
                </>
              ) : (
                "—"
              )
            }
            sub={Number.isFinite(p.vaLo) ? `интервал ${pp(p.vaLo)} … ${pp(p.vaHi)}` : "мало данных"}
          />
          <Kpi icon={<TrendingDown size={15} />} label="Ниже 40%" value={share(p.lowShare)} sub="доля работ с низким уровнем" />
          <Kpi icon={<Users size={15} />} label="Стартовый уровень" value={pct(p.baseline)} sub="итог прошлого года" />
        </div>
      </Card>

      <Card title="Разделы" subtitle="Результат школы и ожидаемый результат для её учеников; полоса — отклонение">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-[13px]">
            <thead>
              <tr className="border-b border-line text-left text-[12px] text-muted">
                <th className="py-2 pr-3 font-semibold">Раздел</th>
                <th className="py-2 pr-3 font-semibold">Школа</th>
                <th className="py-2 pr-3 font-semibold">Ожидалось</th>
                <th className="py-2 pr-3 font-semibold">Отклонение</th>
                <th className="py-2 font-semibold">Часы: факт / план</th>
              </tr>
            </thead>
            <tbody>
              {p.sections.map((s) => {
                const sec = a.meta.sections.find((x) => x.name === s.section);
                const shortH = sec && Number.isFinite(s.hours) && sec.planned - s.hours >= 2;
                return (
                  <tr key={s.section} className="border-b border-line/70 last:border-0">
                    <td className="max-w-[260px] py-2.5 pr-3 font-semibold text-slate-800">
                      <span className="text-muted">{sec?.order}.</span> {s.section}
                    </td>
                    <td className="tabular py-2.5 pr-3 text-[14px] font-bold text-slate-900">{pct(s.mean)}</td>
                    <td className="tabular py-2.5 pr-3 text-slate-600">{pct(s.expected)}</td>
                    <td className="py-2.5 pr-3">
                      <DevBar value={s.residual} flag={s.flag} />
                    </td>
                    <td className={`tabular py-2.5 ${shortH ? "font-semibold text-amber-700" : "text-slate-600"}`}>
                      {Number.isFinite(s.hours) ? (Math.round(s.hours * 10) / 10).toString().replace(".", ",") : "—"} / {sec?.planned ?? "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Card
        title="Что делать"
        subtitle="Рекомендации для методиста и администрации школы"
        actions={
          <button
            onClick={copy}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line bg-white px-3 text-[12.5px] font-semibold text-slate-700 hover:border-brand hover:text-brand"
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? "Скопировано" : "Скопировать"}
          </button>
        }
      >
        <div className="space-y-3">
          {actions.map((x, i) => {
            const t = ACTION_TONE[x.tone];
            return (
              <div key={i} className="flex gap-3 rounded-xl border border-line p-4">
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${t.chip}`}>{t.icon}</span>
                <div>
                  <h3 className="text-[14px] leading-snug font-bold text-slate-900">{x.title}</h3>
                  <p className="mt-1 text-[13px] leading-relaxed text-slate-600">{x.text}</p>
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-4">
          <Note icon={<Info size={14} />}>
            <b>Ожидаемый результат</b> — средний результат таких же учеников (стартовый уровень, город/село, учебник) по всей выборке. Отклонения небольших школ
            осторожно сдвигаются к нулю, чтобы случайность не выглядела как проблема. Это инструмент поддержки и обмена опытом, а не рейтинг для наказаний.
          </Note>
        </div>
      </Card>
    </div>
  );
}

function DevBar({ value, flag }: { value: number; flag: Flag }) {
  if (!Number.isFinite(value)) return <span className="text-muted">—</span>;
  const max = 20;
  const w = (Math.min(Math.abs(value), max) / max) * 50;
  return (
    <div className="flex items-center gap-2.5">
      <div className="relative h-2.5 w-[120px] rounded-full bg-slate-100">
        <div className="absolute top-[-3px] left-1/2 h-4 w-px bg-slate-400" />
        <div
          className="absolute top-0 h-full rounded-full"
          style={{
            background: FLAG_COLOR[flag === "none" ? "none" : flag],
            left: value >= 0 ? "50%" : `${50 - w}%`,
            width: `${w}%`,
          }}
        />
      </div>
      <span
        className={`tabular w-[74px] text-[12.5px] font-semibold ${
          flag === "below" ? "text-red-600" : flag === "above" ? "text-emerald-700" : "text-slate-500"
        }`}
      >
        {pp(value)}
      </span>
    </div>
  );
}
