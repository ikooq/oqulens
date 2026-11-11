"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Award, Check, Copy, Info, Lightbulb, Search, Target, TrendingDown, TrendingUp, Users } from "lucide-react";
import { Analysis, Flag, SchoolProfile } from "@/lib/analytics";
import { schoolActions, SchoolAction } from "@/lib/schools";
import { Badge, Card, Kpi, Note, Segmented } from "./ui";
import { useFmt, useLang, useT } from "./lang";

const FLAG_COLOR: Record<Flag, string> = { below: "#dc2626", above: "#0f8a6c", none: "#94a3b8" };
const LANG_RU: Record<SchoolProfile["language"], string> = { каз: "казахский язык", рус: "русский язык", смеш: "два языка обучения", неизвестно: "язык неизвестен" };
const LANG_KK: Record<SchoolProfile["language"], string> = { каз: "қазақ тілі", рус: "орыс тілі", смеш: "екі оқыту тілі", неизвестно: "тілі белгісіз" };

export function defaultSchool(a: Analysis): string | undefined {
  const ranked = a.schools.filter((p) => p.rank > 0);
  return (ranked[ranked.length - 1] ?? a.schools[0])?.school;
}

export default function SchoolsTab({ a, school, onSelect }: { a: Analysis; school?: string; onSelect: (s: string) => void }) {
  const t = useT();
  const { pct } = useFmt();
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
      <div data-tour="caterpillar">
        <Card
          title={t("Школы: результат относительно ожидаемого", "Мектептер: күтілгенге қатысты нәтиже")}
          subtitle={t(
            "С учётом стартового уровня учеников, города/села и учебника. Точка — оценка, линия — 95% интервал. Нажмите на точку, чтобы открыть школу.",
            "Оқушылардың бастапқы деңгейін, қала/ауылды және оқулықты ескергенде. Нүкте — баға, сызық — 95% аралық. Мектепті ашу үшін нүктені басыңыз.",
          )}
        >
          <div className="scroll-thin -mx-1 overflow-x-auto px-1">
            <div className="min-w-[680px]">
              <Caterpillar schools={a.schools} selected={current?.school} onSelect={onSelect} />
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[12.5px] text-muted">
            <Legend color={FLAG_COLOR.below} label={t(`Ниже ожидаемого: ${counts.below}`, `Күтілгеннен төмен: ${counts.below}`)} />
            <Legend color={FLAG_COLOR.none} label={t(`В пределах ожидаемого: ${counts.none}`, `Күтілген шекте: ${counts.none}`)} />
            <Legend color={FLAG_COLOR.above} label={t(`Выше ожидаемого: ${counts.above}`, `Күтілгеннен жоғары: ${counts.above}`)} />
          </div>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
        <Card title={t("Список школ", "Мектептер тізімі")} className="xl:sticky xl:top-[92px] xl:self-start">
          <div className="space-y-3">
            <label className="flex h-9 items-center gap-2 rounded-lg border border-line bg-white px-2.5 focus-within:border-brand">
              <Search size={15} className="text-muted" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("Школа или район", "Мектеп немесе аудан")}
                className="w-full bg-transparent text-[13px] outline-none"
              />
            </label>
            <Segmented
              value={only}
              onChange={setOnly}
              options={[
                { value: "all", label: t("Все", "Барлығы") },
                { value: "below", label: t("Ниже", "Төмен") },
                { value: "above", label: t("Выше", "Жоғары") },
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
              {list.length === 0 && <p className="px-3 py-2 text-[12.5px] text-muted">{t("Ничего не найдено.", "Ештеңе табылмады.")}</p>}
            </div>
          </div>
        </Card>

        {current ? <SchoolCard a={a} p={current} /> : <Card>{t("Нет данных по школам.", "Мектептер бойынша дерек жоқ.")}</Card>}
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
  const t = useT();
  const { pp } = useFmt();
  if (!Number.isFinite(p.valueAdded)) return <Badge>{t("мало данных", "дерек аз")}</Badge>;
  return <Badge tone={p.vaFlag === "below" ? "red" : p.vaFlag === "above" ? "green" : "gray"}>{pp(p.valueAdded)}</Badge>;
}

function Caterpillar({ schools, selected, onSelect }: { schools: SchoolProfile[]; selected?: string; onSelect: (s: string) => void }) {
  const t = useT();
  const { pp, pct } = useFmt();
  const pts = schools.filter((p) => Number.isFinite(p.valueAdded)).sort((x, y) => x.valueAdded - y.valueAdded);
  if (pts.length === 0) return <p className="text-[13px] text-muted">{t("Недостаточно данных.", "Дерек жеткіліксіз.")}</p>;
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
  const ticks = [-10, -5, 0, 5, 10].filter((tk) => tk >= lo && tk <= hi);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={t("Результат школ относительно ожидаемого", "Мектептердің күтілгенге қатысты нәтижесі")}>
      {ticks.map((tk) => (
        <g key={tk}>
          <line x1={padL} x2={W - padR} y1={y(tk)} y2={y(tk)} stroke={tk === 0 ? "#64748b" : "#e2e8f0"} strokeDasharray={tk === 0 ? "" : "3 4"} />
          <text x={padL - 8} y={y(tk) + 4} textAnchor="end" fontSize="12" fill="#64748b">
            {tk > 0 ? `+${tk}` : tk === 0 ? "0" : `−${-tk}`}
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
            <title>{t(`${p.school} (${p.district}): ${pp(p.valueAdded)} к ожидаемому, средний ${pct(p.mean)}`, `${p.school} (${p.district}): күтілгенге қатысты ${pp(p.valueAdded)}, орташа ${pct(p.mean)}`)}</title>
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
  const lang = useLang();
  const t = useT();
  const f = useFmt();
  const actions = useMemo(() => schoolActions(a, p, lang), [a, p, lang]);
  const [copied, setCopied] = useState(false);
  const total = a.schools.filter((s) => s.rank > 0).length;

  const copy = async () => {
    const lines = [
      `${p.school} (${p.district})`,
      t(`Средний результат ${f.pct(p.mean)}, относительно ожидаемого ${f.pp(p.valueAdded)}.`, `Орташа нәтиже ${f.pct(p.mean)}, күтілгенге қатысты ${f.pp(p.valueAdded)}.`),
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
              {p.district} · {p.urban === null ? t("местность неизвестна", "елді мекен белгісіз") : p.urban ? t("город", "қала") : t("село", "ауыл")} · {(lang === "kk" ? LANG_KK : LANG_RU)[p.language]} · {p.textbooks.join(", ")} ·{" "}
              {f.nStudents(p.nStudents)} · {f.nClasses(p.nClasses)}
            </p>
          </div>
          {p.rank > 0 && (
            <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-[12.5px] font-semibold text-slate-700">
              {t(`Место ${p.rank} из ${total}`, `${total} мектептің ішінде ${p.rank}-орын`)}
            </span>
          )}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi icon={<Target size={15} />} label={t("Средний результат", "Орташа нәтиже")} value={f.pct(p.mean)} sub={t(`ожидалось ${f.pct(p.expected)}`, `күтілгені ${f.pct(p.expected)}`)} />
          <Kpi
            icon={p.valueAdded >= 0 ? <TrendingUp size={15} /> : <TrendingDown size={15} />}
            label={t("К ожидаемому", "Күтілгенге қатысты")}
            value={
              Number.isFinite(p.valueAdded) ? (
                <>
                  {f.pp(p.valueAdded).replace(` ${f.unit}`, "")}
                  <span className="ml-1 text-[14px] font-bold text-muted">{f.unit}</span>
                </>
              ) : (
                "—"
              )
            }
            sub={Number.isFinite(p.vaLo) ? t(`интервал ${f.pp(p.vaLo)} … ${f.pp(p.vaHi)}`, `аралық ${f.pp(p.vaLo)} … ${f.pp(p.vaHi)}`) : t("мало данных", "дерек аз")}
          />
          <Kpi
            icon={<TrendingDown size={15} />}
            label={t("Ниже 40%", "40%-дан төмен")}
            value={f.share(p.lowShare)}
            sub={t("доля работ с низким уровнем", "төмен деңгейлі жұмыстар үлесі")}
          />
          <Kpi icon={<Users size={15} />} label={t("Стартовый уровень", "Бастапқы деңгей")} value={f.pct(p.baseline)} sub={t("итог прошлого года", "өткен жылдың қорытындысы")} />
        </div>
      </Card>

      <Card
        title={t("Разделы", "Бөлімдер")}
        subtitle={t("Результат школы и ожидаемый результат для её учеников; полоса — отклонение", "Мектеп нәтижесі және оның оқушылары үшін күтілетін нәтиже; жолақ — ауытқу")}
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-[13px]">
            <thead>
              <tr className="border-b border-line text-left text-[12px] text-muted">
                <th className="py-2 pr-3 font-semibold">{t("Раздел", "Бөлім")}</th>
                <th className="py-2 pr-3 font-semibold">{t("Школа", "Мектеп")}</th>
                <th className="py-2 pr-3 font-semibold">{t("Ожидалось", "Күтілгені")}</th>
                <th className="py-2 pr-3 font-semibold">{t("Отклонение", "Ауытқу")}</th>
                <th className="py-2 font-semibold">{t("Часы: факт / план", "Сағат: нақты / жоспар")}</th>
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
                    <td className="tabular py-2.5 pr-3 text-[14px] font-bold text-slate-900">{f.pct(s.mean)}</td>
                    <td className="tabular py-2.5 pr-3 text-slate-600">{f.pct(s.expected)}</td>
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

      <div data-tour="school-actions">
        <Card
          title={t("Что делать", "Не істеу керек")}
          subtitle={t("Рекомендации для методиста и администрации школы", "Әдіскер мен мектеп әкімшілігіне арналған ұсыныстар")}
          actions={
            <button
              onClick={copy}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line bg-white px-3 text-[12.5px] font-semibold text-slate-700 hover:border-brand hover:text-brand"
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? t("Скопировано", "Көшірілді") : t("Скопировать", "Көшіру")}
            </button>
          }
        >
          <div className="space-y-3">
            {actions.map((x, i) => {
              const tone = ACTION_TONE[x.tone];
              return (
                <div key={i} className="flex gap-3 rounded-xl border border-line p-4">
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${tone.chip}`}>{tone.icon}</span>
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
              {t(
                "Ожидаемый результат — средний результат таких же учеников (стартовый уровень, город/село, учебник) по всей выборке. Отклонения небольших школ осторожно сдвигаются к нулю, чтобы случайность не выглядела как проблема. Это инструмент поддержки и обмена опытом, а не рейтинг для наказаний.",
                "Күтілетін нәтиже — бүкіл іріктемедегі осындай оқушылардың (бастапқы деңгей, қала/ауыл, оқулық) орташа нәтижесі. Шағын мектептердің ауытқулары кездейсоқтық мәселе болып көрінбеуі үшін нөлге қарай сақтықпен жылжытылады. Бұл — жазалауға арналған рейтинг емес, қолдау және тәжірибе алмасу құралы.",
              )}
            </Note>
          </div>
        </Card>
      </div>
    </div>
  );
}

function DevBar({ value, flag }: { value: number; flag: Flag }) {
  const { pp } = useFmt();
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
            background: FLAG_COLOR[flag],
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
