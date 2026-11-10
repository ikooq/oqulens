"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, Info, RotateCcw, Sparkles } from "lucide-react";
import { Analysis } from "@/lib/analytics";
import { downloadXlsx } from "@/lib/xlsxWriter";
import { fmt1, nClasses, pct, pp, share, signed } from "@/lib/format";
import { Card, Kpi, Note } from "./ui";

export default function HoursTab({ a }: { a: Analysis }) {
  const h = a.hours;
  const recommended = useMemo(() => h.sections.map((s) => s.recommended), [h]);
  const planned = useMemo(() => h.sections.map((s) => s.planned), [h]);
  const [sim, setSim] = useState<number[]>(recommended);
  useEffect(() => setSim(recommended), [recommended]);
  const fc = useMemo(() => a.forecast(sim), [a, sim]);
  const simTotal = sim.reduce((x, y) => x + y, 0);

  if (!h.ok)
    return (
      <Card title="Учебные часы">
        <p className="text-[13.5px] text-slate-600">
          Для рекомендаций нужны плановые и фактические часы по разделам минимум для 15 классов (столбцы planned_hours и actual_hours).
        </p>
      </Card>
    );

  const exportPlan = () => {
    downloadXlsx(
      [
        {
          name: "План часов",
          widths: [6, 36, 12, 14, 10, 18, 90],
          rows: [
            ["№", "Раздел", "Часы по плану", "Рекомендуется", "Изменение", "Ожидаемый эффект, п.п.", "Обоснование"],
            ...h.sections.map((s) => [s.order, s.name, s.planned, s.recommended, s.delta, Math.round(s.gain * 10) / 10, s.reason]),
            [null, "Итого", h.totalPlanned, h.sections.reduce((x, s) => x + s.recommended, 0), 0, null, "Общий объём часов не меняется"],
          ],
        },
      ],
      "oqulens_plan_chasov.xlsx",
    );
  };
  const maxH = Math.max(...h.sections.map((s) => Math.max(s.planned, s.recommended)));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi label="Перераспределяется" value={`${h.movedHours} ч`} sub={`из ${h.totalPlanned} ч — общий объём не меняется`} />
        <Kpi
          label="Средний результат"
          value={<span className="text-brand">{pp(h.meanAfter - h.meanBefore)}</span>}
          sub={`${fmt1(h.meanBefore)}% → ${fmt1(h.meanAfter)}% · консерв. ${pp(h.meanAfterConservative - h.meanBefore)}`}
        />
        <Kpi label="Результатов ниже 40%" value={`${share(h.lowBefore)} → ${share(h.lowAfter)}`} sub="доля работ с низким уровнем" />
        <Kpi label="Основание" value={nClasses(h.nClasses)} sub="сравнение фактических часов и результатов" />
      </div>

      <Card
        title="Рекомендуемое распределение часов"
        subtitle="По разделам долгосрочного плана; перенос только между разделами одного предмета"
        actions={
          <button
            onClick={exportPlan}
            className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-[12.5px] font-semibold text-slate-700 hover:bg-slate-50"
          >
            <Download size={14} /> Скачать план (Excel)
          </button>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-[13px]">
            <thead>
              <tr className="border-b border-line text-left text-[12px] text-muted">
                <th className="py-2 pr-3 font-semibold">Раздел</th>
                <th className="w-[240px] py-2 pr-3 font-semibold">План → рекомендация</th>
                <th className="py-2 pr-3 font-semibold">+1 час даёт</th>
                <th className="py-2 pr-3 font-semibold">Эффект</th>
                <th className="py-2 font-semibold">Обоснование</th>
              </tr>
            </thead>
            <tbody>
              {h.sections.map((s) => (
                <tr key={s.name} className="border-b border-line/70 align-top last:border-0">
                  <td className="py-3 pr-3 font-semibold text-slate-800">
                    <span className="text-muted">{s.order}.</span> {s.name}
                  </td>
                  <td className="py-3 pr-3">
                    <div className="flex items-center gap-2">
                      <span className="tabular w-6 text-right text-muted">{s.planned}</span>
                      <span className="text-muted">→</span>
                      <span className="tabular w-6 font-bold text-slate-900">{s.recommended}</span>
                      <span
                        className={`tabular rounded-md px-1.5 py-0.5 text-[11.5px] font-bold ${
                          s.delta > 0 ? "bg-emerald-100 text-emerald-800" : s.delta < 0 ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {signed(s.delta)}
                      </span>
                    </div>
                    <div className="mt-2 h-1.5 w-[180px] rounded-full bg-slate-100">
                      <div
                        className={`h-full rounded-full ${s.delta > 0 ? "bg-brand" : s.delta < 0 ? "bg-amber-400" : "bg-slate-300"}`}
                        style={{ width: `${(100 * s.recommended) / maxH}%` }}
                      />
                    </div>
                  </td>
                  <td className="tabular py-3 pr-3">
                    <span className={s.significant ? "font-semibold text-slate-800" : "text-muted"}>{pp(s.perHour)}</span>
                    {!s.significant && <div className="text-[11px] text-muted">не доказано</div>}
                  </td>
                  <td className="tabular py-3 pr-3 font-semibold whitespace-nowrap">
                    <span className={s.gain > 0.05 ? "text-emerald-700" : s.gain < -0.05 ? "text-amber-700" : "text-muted"}>{pp(s.gain)}</span>
                  </td>
                  <td className="py-3 text-[12.5px] leading-relaxed text-slate-600">{s.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card
        title="Симулятор «что если»"
        subtitle="Двигайте часы и смотрите прогноз. Прогноз учитывает перенос эффекта через разделы-пререквизиты"
        actions={
          <div className="flex gap-2">
            <button
              onClick={() => setSim(recommended)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-50 px-3 py-1.5 text-[12.5px] font-semibold text-brand hover:bg-emerald-100"
            >
              <Sparkles size={14} /> Рекомендация
            </button>
            <button
              onClick={() => setSim(planned)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-[12.5px] font-semibold text-slate-700 hover:bg-slate-50"
            >
              <RotateCcw size={14} /> Как в плане
            </button>
          </div>
        }
      >
        <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <div className="space-y-4">
            {h.sections.map((s, i) => (
              <div key={s.name}>
                <div className="mb-1 flex items-baseline justify-between gap-3 text-[12.5px]">
                  <span className="truncate font-semibold text-slate-700">
                    {s.order}. {s.name}
                  </span>
                  <span className="tabular shrink-0">
                    <b className="text-slate-900">{sim[i]} ч</b>
                    <span className="ml-2 text-muted">{pp(fc.perSection[i])}</span>
                  </span>
                </div>
                <input
                  type="range"
                  className="w-full"
                  min={Math.round(s.planned * 0.6)}
                  max={Math.round(s.planned * 1.5)}
                  value={sim[i] ?? s.planned}
                  onChange={(e) => setSim((cur) => cur.map((v, j) => (j === i ? Number(e.target.value) : v)))}
                />
              </div>
            ))}
          </div>
          <div className="space-y-3">
            <div className={`rounded-xl p-4 ring-1 ${simTotal === h.totalPlanned ? "bg-slate-50 ring-slate-200" : "bg-amber-50 ring-amber-200"}`}>
              <div className="text-[12.5px] text-muted">Всего часов</div>
              <div className="tabular text-[22px] font-extrabold text-slate-900">
                {simTotal} <span className="text-[14px] font-semibold text-muted">/ {h.totalPlanned}</span>
              </div>
              {simTotal !== h.totalPlanned && (
                <div className="mt-1 text-[12px] text-amber-800">
                  {simTotal > h.totalPlanned ? `Превышение на ${simTotal - h.totalPlanned} ч — таких часов нет в учебном плане` : `Не распределено ${h.totalPlanned - simTotal} ч`}
                </div>
              )}
            </div>
            <div className="rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200">
              <div className="text-[12.5px] text-muted">Прогноз среднего результата</div>
              <div className="tabular text-[22px] font-extrabold text-slate-900">
                {fmt1(fc.mean)}% <span className="text-[14px] font-bold text-brand">{pp(fc.mean - h.meanBefore)}</span>
              </div>
            </div>
            <div className="rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200">
              <div className="text-[12.5px] text-muted">Прогноз доли результатов ниже 40%</div>
              <div className="tabular text-[22px] font-extrabold text-slate-900">
                {share(fc.lowShare)} <span className="text-[14px] font-semibold text-muted">сейчас {share(h.lowBefore)}</span>
              </div>
            </div>
          </div>
        </div>
      </Card>

      <Note icon={<Info size={14} />}>
        <b>Как считается.</b> В разных классах на один и тот же раздел фактически тратят разное число часов. Мы сравниваем результаты таких классов при равном
        стартовом уровне, учебнике и типе местности и оцениваем, сколько процентных пунктов даёт дополнительный час (с убывающей отдачей). Часы переносятся по одному,
        только если выигрыш больше потерь даже в пессимистичном сценарии. Разделы со средним результатом ниже 55% часы не отдают, а если влияние часов на раздел доказано,
        его сокращают не более чем на 10%. Прогноз ориентировочный, рекомендуется пилот в 5–10 школах. Средний результат до изменений: {pct(h.meanBefore)}.
      </Note>
    </div>
  );
}
