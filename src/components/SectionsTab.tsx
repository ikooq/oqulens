"use client";

import { useState } from "react";
import { ArrowDown, Info } from "lucide-react";
import { Analysis } from "@/lib/analytics";
import { heatColor, heatText, pct, pp, share } from "@/lib/format";
import { Badge, Card, Note, Segmented, StatusBadge } from "./ui";

export default function SectionsTab({ a, onSchool }: { a: Analysis; onSchool: (s: string) => void }) {
  const [mode, setMode] = useState<"district" | "school">("district");
  const defaultFocus = a.sections.find((s) => s.uneven)?.name ?? [...a.sections].sort((x, y) => x.mean - y.mean)[0]?.name;
  const [focus, setFocus] = useState(defaultFocus);
  const heat = mode === "district" ? a.heat.byDistrict : a.heat.bySchool;
  const focusStat = a.sections.find((s) => s.name === focus) ?? a.sections[0];
  const dependentsOf = (name: string) => a.prereqs.filter((l) => l.from === name).map((l) => l.to);

  return (
    <div className="space-y-6">
      <Card title="Диагностика разделов" subtitle="Средний результат СОР, 95% доверительный интервал и характер проблемы">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-[13px]">
            <thead>
              <tr className="border-b border-line text-left text-[12px] text-muted">
                <th className="py-2 pr-3 font-semibold">Раздел</th>
                <th className="py-2 pr-3 font-semibold">Средний %</th>
                <th className="py-2 pr-3 font-semibold">Ниже 40%</th>
                <th className="py-2 pr-3 font-semibold">Статус</th>
                <th className="py-2 font-semibold">Диагноз</th>
              </tr>
            </thead>
            <tbody>
              {a.sections.map((s) => {
                const deps = dependentsOf(s.name);
                return (
                  <tr key={s.name} className="border-b border-line/70 last:border-0">
                    <td className="py-3 pr-3">
                      <div className="font-semibold text-slate-800">
                        <span className="text-muted">{s.order}.</span> {s.name}
                      </div>
                    </td>
                    <td className="tabular py-3 pr-3">
                      <span className="text-[14px] font-bold text-slate-900">{pct(s.mean)}</span>
                      <span className="ml-1.5 text-[11.5px] text-muted">
                        {pct(s.ciLo)}–{pct(s.ciHi)}
                      </span>
                    </td>
                    <td className="tabular py-3 pr-3 font-semibold text-slate-700">{share(s.lowShare)}</td>
                    <td className="py-3 pr-3">
                      <StatusBadge status={s.status} />
                    </td>
                    <td className="py-3">
                      <div className="flex flex-wrap gap-1.5">
                        {s.systemic && <Badge tone="red">Системная проблема</Badge>}
                        {s.uneven && <Badge tone="violet">Зависит от школы</Badge>}
                        {deps.length > 0 && <Badge tone="blue">Фундамент для «{deps.join("», «")}»</Badge>}
                        {!s.systemic && !s.uneven && deps.length === 0 && <span className="text-muted">—</span>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="mt-4">
          <Note icon={<Info size={14} />}>
            <b>Системная проблема</b> — раздел проседает почти во всех школах: дело в программе, учебнике или часах. <b>Зависит от школы</b> — разброс между
            школами велик даже при равном уровне учеников и одинаковом учебнике: дело в преподавании, помогает адресная методическая работа.
          </Note>
        </div>
      </Card>

      <Card
        title="Тепловая карта результатов"
        subtitle={mode === "district" ? "Средний % по разделам в каждом районе" : "Средний % по разделам в каждой школе"}
        actions={
          <Segmented
            value={mode}
            onChange={setMode}
            options={[
              { value: "district", label: "Районы" },
              { value: "school", label: "Школы" },
            ]}
          />
        }
      >
        <div className="scroll-thin overflow-x-auto pb-2">
          <table className="border-separate border-spacing-[3px] text-[12px]">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 bg-white" />
                {heat.columns.map((c) => (
                  <th
                    key={c}
                    title={c}
                    className={`align-bottom font-semibold text-muted ${mode === "district" ? "w-[78px] px-1 pb-1 text-[11.5px] leading-tight" : "w-[30px] pb-1 text-[10.5px]"}`}
                  >
                    {mode === "district" ? c.replace(" район", "").replace("Район ", "") : c.replace("Школа ", "")}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {a.sections.map((s) => (
                <tr key={s.name}>
                  <td className="sticky left-0 z-10 max-w-[290px] truncate bg-white pr-3 text-[12.5px] font-semibold whitespace-nowrap text-slate-700" title={s.name}>
                    {s.order}. {s.name}
                  </td>
                  {heat.columns.map((c) => {
                    const cell = heat.cells[s.name][c];
                    return (
                      <td
                        key={c}
                        title={`${s.name} · ${c}: ${pct(cell.mean)} (n=${cell.n})${mode === "school" ? " — нажмите, чтобы открыть школу" : ""}`}
                        onClick={mode === "school" ? () => onSchool(c) : undefined}
                        className={`tabular rounded-md text-center font-bold ${mode === "district" ? "h-10" : "h-8 cursor-pointer text-[10.5px] hover:outline-2 hover:outline-ink"}`}
                        style={{ background: heatColor(cell.mean), color: heatText(cell.mean) }}
                      >
                        {Number.isFinite(cell.mean) ? Math.round(cell.mean) : ""}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card title="Цепочки трудностей" subtitle="Какой ранее изученный раздел тянет за собой следующий (с учётом общего уровня ученика)">
          {a.prereqs.length === 0 && <p className="text-[13px] text-muted">Устойчивых связей между разделами не найдено.</p>}
          <div className="space-y-4">
            {[...a.prereqs]
              .sort((x, y) => y.partialCorr - x.partialCorr)
              .map((l) => (
                <div key={l.from + l.to} className="rounded-xl border border-line p-4">
                  <div className="flex flex-col gap-1 text-[13px] font-semibold text-slate-800">
                    <span>{l.from}</span>
                    <span className="flex items-center gap-1.5 text-[11.5px] font-medium text-muted">
                      <ArrowDown size={13} /> сила связи {l.partialCorr >= 0.3 ? "высокая" : "умеренная"}
                    </span>
                    <span>{l.to}</span>
                  </div>
                  <div className="mt-3 space-y-2 text-[12.5px]">
                    <FailBar label={`Не освоили «${short(l.from)}» (<40%)`} value={l.failIfWeak} n={l.nWeak} tone="bg-lvl-low" />
                    <FailBar label={`Освоили «${short(l.from)}» (≥65%)`} value={l.failIfStrong} n={l.nStrong} tone="bg-lvl-high" />
                  </div>
                  <p className="mt-2 text-[12px] text-muted">Доля учащихся, получивших ниже 40% за «{short(l.to)}»</p>
                </div>
              ))}
          </div>
        </Card>

        <Card
          title="Где раздел проседает сильнее ожидаемого"
          subtitle="Отклонение школы от прогноза с учётом стартового уровня учеников, типа местности и учебника"
          actions={
            <select
              value={focusStat?.name}
              onChange={(e) => setFocus(e.target.value)}
              className="h-9 max-w-[240px] rounded-lg border border-line bg-white px-2 text-[12.5px] font-medium"
            >
              {a.sections.map((s) => (
                <option key={s.name} value={s.name}>
                  {s.order}. {s.name}
                </option>
              ))}
            </select>
          }
        >
          {focusStat && (
            <div className="grid gap-5 sm:grid-cols-2">
              <SchoolList title="Ниже ожидаемого" items={focusStat.worstSchools} tone="red" onSchool={onSchool} />
              <SchoolList title="Выше ожидаемого — опыт для тиражирования" items={focusStat.bestSchools} tone="green" onSchool={onSchool} />
            </div>
          )}
          <div className="mt-4">
            <Note icon={<Info size={14} />}>
              Школа сравнивается не со средним по области, а с тем, что можно ожидать при её составе учеников и учебнике. Так видно качество работы с разделом,
              а не «сильный набор».
            </Note>
          </div>
        </Card>
      </div>
    </div>
  );
}

const short = (s: string) => (s.length > 28 ? s.slice(0, 26) + "…" : s);

function FailBar({ label, value, n, tone }: { label: string; value: number; n: number; tone: string }) {
  return (
    <div>
      <div className="mb-1 flex justify-between gap-3">
        <span className="text-slate-600">
          {label} <span className="text-muted">· {n} уч.</span>
        </span>
        <span className="tabular font-bold text-slate-900">{share(value)}</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${100 * (Number.isFinite(value) ? value : 0)}%` }} />
      </div>
    </div>
  );
}

function SchoolList({
  title,
  items,
  tone,
  onSchool,
}: {
  title: string;
  items: { school: string; district: string; mean: number; residual: number; n: number }[];
  tone: "red" | "green";
  onSchool: (s: string) => void;
}) {
  return (
    <div>
      <h4 className="mb-2 text-[12.5px] font-bold text-slate-700">{title}</h4>
      <div className="space-y-2">
        {items.map((s) => (
          <button
            key={s.school}
            onClick={() => onSchool(s.school)}
            title="Открыть карточку школы"
            className="flex w-full items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2 text-left transition hover:bg-slate-100"
          >
            <div className="min-w-0">
              <div className="truncate text-[13px] font-semibold text-slate-800">{s.school}</div>
              <div className="truncate text-[11.5px] text-muted">
                {s.district} · средний {pct(s.mean)}
              </div>
            </div>
            <Badge tone={tone}>{pp(s.residual)}</Badge>
          </button>
        ))}
        {items.length === 0 && <p className="text-[12.5px] text-muted">Нет школ с достаточным числом учеников.</p>}
      </div>
    </div>
  );
}
