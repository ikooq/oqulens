import { AlertTriangle, ArrowRight, Info, Scale, Star } from "lucide-react";
import { Analysis } from "@/lib/analytics";
import { heatColor, heatText, nSchools, pct, pp, share } from "@/lib/format";
import { Badge, Card, Note } from "./ui";

export default function TextbooksTab({ a }: { a: Analysis }) {
  const tb = a.textbooks;
  if (!tb.ok)
    return (
      <Card title="Сравнение учебников">
        <p className="text-[13.5px] text-slate-600">
          Для сравнения нужно минимум два учебника, по каждому — не меньше 3 школ и 40 учащихся. Снимите фильтры или загрузите больше данных.
        </p>
      </Card>
    );

  const rows = tb.rows.filter((r) => r.enough);
  const lo = Math.floor((Math.min(...rows.flatMap((r) => [r.naive.lo, r.adjusted.lo])) - 2) / 5) * 5;
  const hi = Math.ceil((Math.max(...rows.flatMap((r) => [r.naive.hi, r.adjusted.hi])) + 2) / 5) * 5;
  const x = (v: number) => `${((v - lo) / (hi - lo)) * 100}%`;
  const ticks = Array.from({ length: Math.floor((hi - lo) / 5) + 1 }, (_, i) => lo + 5 * i);
  const ordered = [...rows].sort((p, q) => q.adjusted.mean - p.adjusted.mean);
  const naiveTop = tb.naiveRank[0];
  const flipped = tb.rankChanged && naiveTop !== tb.best;

  return (
    <div className="space-y-6">
      {/* Вердикт */}
      <div className={`rounded-2xl p-5 ring-1 ${flipped ? "bg-sky-50 ring-sky-200" : "bg-emerald-50 ring-emerald-200"}`}>
        <div className="flex items-start gap-3">
          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${flipped ? "bg-sky-100 text-sky-700" : "bg-emerald-100 text-emerald-700"}`}>
            <Scale size={18} />
          </span>
          <div>
            <h2 className="text-[16px] font-extrabold text-slate-900">
              {flipped ? `Сырые баллы вводят в заблуждение: лучший учебник — «${tb.best}», а не «${naiveTop}»` : `Лучший результат — у «${tb.best}»`}
            </h2>
            <p className="mt-1.5 max-w-[860px] text-[13.5px] leading-relaxed text-slate-700">
              {flipped &&
                `«${naiveTop}» лидирует по средним баллам, потому что им чаще пользуются школы с более сильным составом учеников. Когда мы сравниваем учебники при одинаковом стартовом уровне, типе местности и языке обучения, рейтинг меняется. `}
              {tb.bestSignificant
                ? `Отрыв «${tb.best}» от второго места — ${pp(tb.bestMargin)}, различие статистически надёжно.`
                : `Отрыв лидера (${pp(tb.bestMargin)}) в пределах погрешности: менять учебник только на этом основании не стоит.`}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-[12.5px]">
              <span className="text-muted">Рейтинг по сырым баллам:</span>
              <span className="font-semibold text-slate-700">{tb.naiveRank.join(" > ")}</span>
              <ArrowRight size={14} className="text-muted" />
              <span className="text-muted">с поправкой:</span>
              <span className="font-bold text-slate-900">{tb.adjustedRank.join(" > ")}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.25fr_1fr]">
        <Card title="Сырой балл против честного сравнения" subtitle="Средний результат СОР по учебнику, 95% доверительный интервал">
          <div className="relative">
            <div className="ml-[120px] flex justify-between pb-1 text-[11px] text-muted">
              {ticks.map((t) => (
                <span key={t} className="tabular">
                  {t}%
                </span>
              ))}
            </div>
            <div className="space-y-4">
              {ordered.map((r) => (
                <div key={r.name} className="grid grid-cols-[120px_1fr] items-center">
                  <div>
                    <div className="text-[13.5px] font-bold text-slate-800">{r.name}</div>
                    <div className="text-[11.5px] text-muted">{nSchools(r.nSchools)}</div>
                  </div>
                  <div className="space-y-1.5">
                    <ForestRow est={r.naive} x={x} color="#94a3b8" label="сырой" />
                    <ForestRow est={r.adjusted} x={x} color="#0f8a6c" label="с поправкой" bold />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 flex gap-4 text-[12px] text-muted">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-slate-400" /> Сырой средний балл
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-brand" /> С поправкой на состав учеников
              </span>
            </div>
          </div>
        </Card>

        <Card title="Почему сырые баллы искажают картину" subtitle="Кто учится по каждому учебнику">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-line text-left text-[12px] text-muted">
                <th className="py-2 font-semibold">Учебник</th>
                <th className="py-2 font-semibold">Школ</th>
                <th className="py-2 font-semibold">Городских</th>
                <th className="py-2 font-semibold">Стартовый уровень</th>
              </tr>
            </thead>
            <tbody>
              {tb.rows.map((r) => (
                <tr key={r.name} className="border-b border-line/70 last:border-0">
                  <td className="py-2.5 font-semibold text-slate-800">
                    {r.name}
                    {!r.enough && <span className="ml-1 text-[11px] font-normal text-muted">(мало данных)</span>}
                  </td>
                  <td className="tabular py-2.5">{r.nSchools}</td>
                  <td className="py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-16 overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full bg-sky-500" style={{ width: share(r.urbanShare) }} />
                      </div>
                      <span className="tabular">{share(r.urbanShare)}</span>
                    </div>
                  </td>
                  <td className="tabular py-2.5 font-semibold">{pct(r.meanBaseline)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-4">
            <Note icon={<Info size={14} />}>
              Учебник выбирает школа, а не случай. Если сильные городские школы чаще выбирают один учебник, его средний балл будет выше независимо от его качества.
              Поэтому мы сравниваем учебники «при прочих равных».
            </Note>
          </div>
        </Card>
      </div>

      <Card title="Учебник × раздел" subtitle="Результат с поправкой на состав учеников и фактические часы. Рамкой отмечены «слабые главы»">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-separate border-spacing-[4px] text-[13px]">
            <thead>
              <tr>
                <th className="text-left text-[12px] font-semibold text-muted">Раздел</th>
                {ordered.map((r) => (
                  <th key={r.name} className="text-[12.5px] font-bold text-slate-700">
                    {r.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {a.sections.map((s) => (
                <tr key={s.name}>
                  <td className="pr-3 text-[12.5px] font-semibold text-slate-700">
                    {s.order}. {s.name}
                  </td>
                  {ordered.map((r) => {
                    const c = tb.matrix.find((m) => m.section === s.name && m.textbook === r.name);
                    if (!c) return <td key={r.name} className="text-center text-muted">—</td>;
                    return (
                      <td
                        key={r.name}
                        title={`${r.name} · ${s.name}: ${pct(c.adjMean)}, к лучшему ${pp(c.diffVsBest)}`}
                        className={`tabular h-11 rounded-lg text-center font-bold ${c.flag === "lag" ? "ring-[3px] ring-red-500 ring-inset" : ""}`}
                        style={{ background: heatColor(c.adjMean), color: heatText(c.adjMean) }}
                      >
                        <span className="inline-flex items-center gap-1">
                          {c.flag === "best" && <Star size={12} fill="currentColor" />}
                          {pct(c.adjMean)}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {tb.lags.length > 0 && (
          <div className="mt-4 space-y-2">
            {tb.lags.map((l) => (
              <div key={l.textbook + l.section} className="flex items-start gap-2.5 rounded-xl bg-red-50 px-4 py-3 text-[13px] text-red-900 ring-1 ring-red-100">
                <AlertTriangle size={16} className="mt-0.5 shrink-0 text-red-500" />
                <div>
                  <b>«{l.textbook}» — слабая глава «{l.section}»:</b> {pp(l.diffVsBest)} к лучшему учебнику при равном составе учеников. Менять учебник
                  целиком не обязательно: достаточно дополнительных материалов и заданий к этому разделу.
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          <Badge tone="gray">Модель: результат ~ учебник + стартовый уровень + город/село + язык обучения</Badge>
          <Badge tone="gray">Ошибки кластеризованы по школам</Badge>
          <Badge tone="gray">95% доверительные интервалы</Badge>
        </div>
      </Card>
    </div>
  );
}

function ForestRow({
  est,
  x,
  color,
  label,
  bold = false,
}: {
  est: { mean: number; lo: number; hi: number };
  x: (v: number) => string;
  color: string;
  label: string;
  bold?: boolean;
}) {
  return (
    <div className="relative h-5" title={`${label}: ${pct(est.mean)} (${pct(est.lo)}–${pct(est.hi)})`}>
      <div className="absolute inset-x-0 top-1/2 h-px bg-slate-100" />
      <div className="absolute top-1/2 h-[3px] -translate-y-1/2 rounded-full" style={{ left: x(est.lo), width: `calc(${x(est.hi)} - ${x(est.lo)})`, background: color, opacity: 0.45 }} />
      <div
        className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow"
        style={{ left: x(est.mean), background: color }}
      />
      <span
        className={`tabular absolute top-1/2 -translate-y-1/2 pl-3 text-[12px] ${bold ? "font-bold text-slate-900" : "text-slate-500"}`}
        style={{ left: x(est.hi) }}
      >
        {pct(est.mean)}
      </span>
    </div>
  );
}
