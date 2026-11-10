"use client";

import { useState } from "react";
import { ArrowDown, Info } from "lucide-react";
import { Analysis } from "@/lib/analytics";
import { heatColor, heatText } from "@/lib/format";
import { Badge, Card, Note, Segmented, StatusBadge } from "./ui";
import { useFmt, useT } from "./lang";

export default function SectionsTab({ a, onSchool }: { a: Analysis; onSchool: (s: string) => void }) {
  const t = useT();
  const { pct, share } = useFmt();
  const [mode, setMode] = useState<"district" | "school">("district");
  const defaultFocus = a.sections.find((s) => s.uneven)?.name ?? [...a.sections].sort((x, y) => x.mean - y.mean)[0]?.name;
  const [focus, setFocus] = useState(defaultFocus);
  const heat = mode === "district" ? a.heat.byDistrict : a.heat.bySchool;
  const focusStat = a.sections.find((s) => s.name === focus) ?? a.sections[0];
  const dependentsOf = (name: string) => a.prereqs.filter((l) => l.from === name).map((l) => l.to);
  const shortDistrict = (c: string) => c.replace(" район", "").replace("Район ", "").replace(" ауданы", "");
  const shortSchool = (c: string) => c.replace("Школа ", "").replace("Мектеп ", "");

  return (
    <div className="space-y-6">
      <div data-tour="diagnosis">
        <Card
          title={t("Диагностика разделов", "Бөлімдер диагностикасы")}
          subtitle={t("Средний результат СОР, 95% доверительный интервал и характер проблемы", "БЖБ орташа нәтижесі, 95% сенім аралығы және мәселенің сипаты")}
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-[13px]">
              <thead>
                <tr className="border-b border-line text-left text-[12px] text-muted">
                  <th className="py-2 pr-3 font-semibold">{t("Раздел", "Бөлім")}</th>
                  <th className="py-2 pr-3 font-semibold">{t("Средний %", "Орташа %")}</th>
                  <th className="py-2 pr-3 font-semibold">{t("Ниже 40%", "40%-дан төмен")}</th>
                  <th className="py-2 pr-3 font-semibold">{t("Статус", "Мәртебе")}</th>
                  <th className="py-2 font-semibold">{t("Диагноз", "Диагноз")}</th>
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
                          {s.systemic && <Badge tone="red">{t("Системная проблема", "Жүйелі мәселе")}</Badge>}
                          {s.uneven && <Badge tone="violet">{t("Зависит от школы", "Мектепке тәуелді")}</Badge>}
                          {deps.length > 0 && (
                            <Badge tone="blue">{t(`Фундамент для «${deps.join("», «")}»`, `«${deps.join("», «")}» үшін негіз`)}</Badge>
                          )}
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
              {t(
                "«Системная проблема» — раздел проседает почти во всех школах: дело в программе, учебнике или часах. «Зависит от школы» — разброс между школами велик даже при равном уровне учеников и одинаковом учебнике: дело в преподавании, помогает адресная методическая работа.",
                "«Жүйелі мәселе» — бөлім барлық дерлік мектепте төмен: мәселе бағдарламада, оқулықта немесе сағаттарда. «Мектепке тәуелді» — оқушылар деңгейі мен оқулық бірдей болғанда да мектептер арасындағы алшақтық үлкен: мәселе оқытуда, атаулы әдістемелік жұмыс көмектеседі.",
              )}
            </Note>
          </div>
        </Card>
      </div>

      <Card
        title={t("Тепловая карта результатов", "Нәтижелердің жылу картасы")}
        subtitle={
          mode === "district"
            ? t("Средний % по разделам в каждом районе", "Әр аудандағы бөлімдер бойынша орташа %")
            : t("Средний % по разделам в каждой школе — нажмите на ячейку, чтобы открыть школу", "Әр мектептегі бөлімдер бойынша орташа % — мектепті ашу үшін ұяшықты басыңыз")
        }
        actions={
          <Segmented
            value={mode}
            onChange={setMode}
            options={[
              { value: "district", label: t("Районы", "Аудандар") },
              { value: "school", label: t("Школы", "Мектептер") },
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
                    {mode === "district" ? shortDistrict(c) : shortSchool(c)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {a.sections.map((s) => (
                <tr key={s.name}>
                  <td
                    className="sticky left-0 z-10 max-w-[200px] truncate bg-white pr-3 text-[12.5px] font-semibold whitespace-nowrap text-slate-700 sm:max-w-[290px]"
                    title={s.name}
                  >
                    {s.order}. {s.name}
                  </td>
                  {heat.columns.map((c) => {
                    const cell = heat.cells[s.name][c];
                    return (
                      <td
                        key={c}
                        title={`${s.name} · ${c}: ${pct(cell.mean)} (n=${cell.n})`}
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
        <div data-tour="prereqs">
          <Card
            title={t("Цепочки трудностей", "Қиындықтар тізбегі")}
            subtitle={t(
              "Какой ранее изученный раздел тянет за собой следующий (с учётом общего уровня ученика)",
              "Бұрын оқылған қай бөлім келесісін төмен тартады (оқушының жалпы деңгейін ескергенде)",
            )}
          >
            {a.prereqs.length === 0 && (
              <p className="text-[13px] text-muted">{t("Устойчивых связей между разделами не найдено.", "Бөлімдер арасында тұрақты байланыс табылмады.")}</p>
            )}
            <div className="space-y-4">
              {[...a.prereqs]
                .sort((x, y) => y.partialCorr - x.partialCorr)
                .map((l) => (
                  <div key={l.from + l.to} className="rounded-xl border border-line p-4">
                    <div className="flex flex-col gap-1 text-[13px] font-semibold text-slate-800">
                      <span>{l.from}</span>
                      <span className="flex items-center gap-1.5 text-[11.5px] font-medium text-muted">
                        <ArrowDown size={13} />{" "}
                        {l.partialCorr >= 0.3 ? t("сила связи высокая", "байланыс күші жоғары") : t("сила связи умеренная", "байланыс күші орташа")}
                      </span>
                      <span>{l.to}</span>
                    </div>
                    <div className="mt-3 space-y-2 text-[12.5px]">
                      <FailBar
                        label={t(`Не освоили «${short(l.from)}» (<40%)`, `«${short(l.from)}» меңгермегендер (<40%)`)}
                        value={l.failIfWeak}
                        n={l.nWeak}
                        tone="bg-lvl-low"
                      />
                      <FailBar
                        label={t(`Освоили «${short(l.from)}» (≥65%)`, `«${short(l.from)}» меңгергендер (≥65%)`)}
                        value={l.failIfStrong}
                        n={l.nStrong}
                        tone="bg-lvl-high"
                      />
                    </div>
                    <p className="mt-2 text-[12px] text-muted">
                      {t(`Доля учащихся, получивших ниже 40% за «${short(l.to)}»`, `«${short(l.to)}» бойынша 40%-дан төмен алған оқушылар үлесі`)}
                    </p>
                  </div>
                ))}
            </div>
          </Card>
        </div>

        <Card
          title={t("Где раздел проседает сильнее ожидаемого", "Бөлім қай жерде күтілгеннен төмен")}
          subtitle={t(
            "Отклонение школы от прогноза с учётом стартового уровня учеников, типа местности и учебника",
            "Оқушылардың бастапқы деңгейін, елді мекен түрін және оқулықты ескергендегі мектептің болжамнан ауытқуы",
          )}
          actions={
            <select
              value={focusStat?.name}
              onChange={(e) => setFocus(e.target.value)}
              aria-label={t("Раздел", "Бөлім")}
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
              <SchoolList title={t("Ниже ожидаемого", "Күтілгеннен төмен")} items={focusStat.worstSchools} tone="red" onSchool={onSchool} />
              <SchoolList
                title={t("Выше ожидаемого — опыт для тиражирования", "Күтілгеннен жоғары — таратуға лайық тәжірибе")}
                items={focusStat.bestSchools}
                tone="green"
                onSchool={onSchool}
              />
            </div>
          )}
          <div className="mt-4">
            <Note icon={<Info size={14} />}>
              {t(
                "Школа сравнивается не со средним по области, а с тем, что можно ожидать при её составе учеников и учебнике. Так видно качество работы с разделом, а не «сильный набор».",
                "Мектеп облыстық ортамен емес, оның оқушылар құрамы мен оқулығы кезінде күтілетін нәтижемен салыстырылады. Осылайша «күшті оқушылар» емес, бөліммен жұмыс сапасы көрінеді.",
              )}
            </Note>
          </div>
        </Card>
      </div>
    </div>
  );
}

const short = (s: string) => (s.length > 28 ? s.slice(0, 26) + "…" : s);

function FailBar({ label, value, n, tone }: { label: string; value: number; n: number; tone: string }) {
  const t = useT();
  const { share } = useFmt();
  return (
    <div>
      <div className="mb-1 flex justify-between gap-3">
        <span className="text-slate-600">
          {label} <span className="text-muted">· {n} {t("уч.", "оқ.")}</span>
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
  const t = useT();
  const { pct, pp } = useFmt();
  return (
    <div>
      <h4 className="mb-2 text-[12.5px] font-bold text-slate-700">{title}</h4>
      <div className="space-y-2">
        {items.map((s) => (
          <button
            key={s.school}
            onClick={() => onSchool(s.school)}
            title={t("Открыть карточку школы", "Мектеп карточкасын ашу")}
            className="flex w-full items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2 text-left transition hover:bg-slate-100"
          >
            <div className="min-w-0">
              <div className="truncate text-[13px] font-semibold text-slate-800">{s.school}</div>
              <div className="truncate text-[11.5px] text-muted">
                {s.district} · {t("средний", "орташа")} {pct(s.mean)}
              </div>
            </div>
            <Badge tone={tone}>{pp(s.residual)}</Badge>
          </button>
        ))}
        {items.length === 0 && (
          <p className="text-[12.5px] text-muted">{t("Нет школ с достаточным числом учеников.", "Оқушылар саны жеткілікті мектептер жоқ.")}</p>
        )}
      </div>
    </div>
  );
}
