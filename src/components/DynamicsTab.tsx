"use client";

import { ArrowDownRight, ArrowUpRight, CheckCircle2, Info, Minus, TrendingUp } from "lucide-react";
import { Analysis } from "@/lib/analytics";
import { DynSection, Dynamics, Verdict, verdict } from "@/lib/dynamics";
import { Badge, Card, Kpi, Note } from "./ui";
import { useFmt, useT } from "./lang";

export default function DynamicsTab({ a, d, onSchool }: { a: Analysis; d: Dynamics | null; onSchool: (s: string) => void }) {
  const t = useT();
  const { fmt1, pp, nStudents, nSchools } = useFmt();

  if (!d)
    return (
      <Card title={t("Динамика по годам", "Жылдар бойынша динамика")}>
        <div className="space-y-3 text-[13.5px] leading-relaxed text-slate-600">
          <p>
            {t(
              "В загруженных данных один учебный год. Чтобы проверить, сработали ли изменения (перенос часов, смена учебника, работа с отстающими школами), загрузите результаты СОР за два года в одном файле и добавьте столбец «учебный_год» — например, 2024–2025 и 2025–2026.",
              "Жүктелген деректерде бір оқу жылы бар. Өзгерістердің (сағатты ауыстыру, оқулықты ауыстыру, артта қалған мектептермен жұмыс) нәтиже бергенін тексеру үшін екі жылдың БЖБ нәтижелерін бір файлда жүктеп, «оқу_жылы» бағанын қосыңыз — мысалы, 2024–2025 және 2025–2026.",
            )}
          </p>
          <p className="text-muted">
            {t("В демо-данных уже есть два года — откройте демо, чтобы увидеть пример.", "Демо-деректерде екі жыл бар — мысалды көру үшін демоны ашыңыз.")}
          </p>
        </div>
      </Card>
    );

  const forecast = (name: string) => a.hours.sections.find((h) => h.name === name)?.perHour;
  const rows = d.sections.map((s) => ({ s, fc: forecast(s.name), v: verdict(s, forecast(s.name)) }));
  const confirmed = rows.filter((r) => r.v === "confirmed");
  const best = [...rows].filter((r) => r.s.did).sort((x, y) => y.s.did!.est - x.s.did!.est)[0];
  const up = d.schools.filter((s) => s.flag === "up");
  const down = [...d.schools].reverse().filter((s) => s.flag === "down");
  const ch = d.overall.change;

  return (
    <div className="space-y-6" data-tour="dynamics">
      <div className="space-y-6" data-tour="dyn-check">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi
          label={t("Средний результат", "Орташа нәтиже")}
          value={`${fmt1(d.overall.meanPrev)}% → ${fmt1(d.overall.meanCur)}%`}
          sub={`${d.prev} → ${d.cur}`}
        />
        <Kpi
          label={d.hasBaseline ? t("Изменение при равном старте", "Тең бастаудағы өзгеріс") : t("Изменение без поправки на старт", "Бастапқы деңгейді ескермеген өзгеріс")}
          value={<span className={ch.est >= 0 ? "text-brand" : "text-red-600"}>{pp(ch.est)}</span>}
          sub={t(`95% ДИ: ${pp(ch.lo)} … ${pp(ch.hi)}`, `95% СА: ${pp(ch.lo)} … ${pp(ch.hi)}`)}
        />
        <Kpi
          label={t("Оценки совместимы", "Бағалар үйлесімді")}
          value={`${confirmed.length} ${t("из", "/")} ${rows.filter((r) => r.v !== "low_return" && r.v !== "no_data").length}`}
          sub={t("разделов с заметной отдачей", "қайтарымы байқалатын бөлім")}
        />
        <Kpi
          label={t("Школы с заметным ростом / спадом", "Айтарлықтай өскен / төмендеген мектептер")}
          value={
            <span>
              <span className="text-brand">{up.length}</span> / <span className="text-red-600">{down.length}</span>
            </span>
          }
          sub={t(`из ${nSchools(d.nSchools)}, сверх общей динамики`, `${nSchools(d.nSchools)} ішінен, жалпы динамикадан тыс`)}
        />
      </div>

      {best?.s.did && best.s.added && best.s.same && best.s.did.significant && (
        <div className="rounded-2xl bg-ink p-5 text-white">
          <div className="flex items-start gap-3">
            <TrendingUp size={22} className="mt-0.5 shrink-0 text-emerald-300" />
            <div>
              <p className="text-[15px] font-bold">
                {t(
                  `Изменения часов и результатов: «${best.s.name}»`,
                  `Сағат пен нәтиже өзгерістері: «${best.s.name}»`,
                )}
              </p>
              <p className="mt-1.5 text-[13.5px] leading-relaxed text-slate-300">
                {t(
                  `В ${best.s.added.n} школах, где на раздел дали на 2+ часа больше, чем год назад, результат вырос на ${pp(best.s.added.delta)}. В ${best.s.same.n} школах без изменений — на ${pp(best.s.same.delta)}. Разница ${pp(best.s.did.est)} (95% ДИ ${pp(best.s.did.lo)} … ${pp(best.s.did.hi)}).`,
                  `Бөлімге былтырғыдан 2+ сағат көп берілген ${best.s.added.n} мектепте нәтиже ${pp(best.s.added.delta)} өсті. Өзгеріссіз ${best.s.same.n} мектепте — ${pp(best.s.same.delta)}. Айырма ${pp(best.s.did.est)} (95% СА ${pp(best.s.did.lo)} … ${pp(best.s.did.hi)}).`,
                )}
                {best.s.slope && best.fc !== undefined && (
                  <>
                    {" "}
                    {t(
                      `Модельная связь: один час соответствует ${pp(best.s.slope.est)} — модель OquLens по данным одного года прогнозировала ${pp(best.fc)}.`,
                      `Модельдегі байланыс: бір сағатқа ${pp(best.s.slope.est)} сәйкес; модель бағасы ${pp(best.fc)}.`,
                    )}
                  </>
                )}
              </p>
            </div>
          </div>
        </div>
      )}
      </div>

      <Card
        title={t("Сопоставление оценок часов и результатов", "Сағат пен нәтиже бағаларын салыстыру")}
        subtitle={t(
          "Сравниваем школы между собой: где часы на раздел изменились сильнее, там должен сильнее измениться результат. Общий рост по области на это не влияет.",
          "Мектептерді өзара салыстырамыз: бөлімге сағат көбірек өзгерген жерде нәтиже де көбірек өзгеруі керек. Облыс бойынша жалпы өсу бұған әсер етпейді.",
        )}
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-[13px]">
            <thead>
              <tr className="border-b border-line text-left text-[12px] text-muted">
                <th className="py-2 pr-3 font-semibold">{t("Раздел", "Бөлім")}</th>
                <th className="py-2 pr-3 font-semibold">{t("Часы (в среднем)", "Сағат (орташа)")}</th>
                <th className="py-2 pr-3 font-semibold">{t("Результат", "Нәтиже")}</th>
                <th className="py-2 pr-3 font-semibold">{t("Прогноз: +1 час", "Болжам: +1 сағат")}</th>
                <th className="py-2 pr-3 font-semibold">{t("Связь: +1 час", "Байланыс: +1 сағат")}</th>
                <th className="py-2 font-semibold">{t("Вывод", "Қорытынды")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ s, fc, v }) => (
                <tr key={s.name} className="border-b border-line/70 last:border-0">
                  <td className="py-2.5 pr-3 font-semibold text-slate-800">{s.name}</td>
                  <td className="py-2.5 pr-3 whitespace-nowrap text-slate-600">
                    {fmt1(s.hoursPrev)} → {fmt1(s.hoursCur)}
                  </td>
                  <td className="py-2.5 pr-3 whitespace-nowrap">
                    <Change s={s} />
                  </td>
                  <td className="py-2.5 pr-3 whitespace-nowrap text-slate-600">{fc !== undefined ? pp(fc) : "—"}</td>
                  <td className="py-2.5 pr-3 whitespace-nowrap text-slate-800">
                    {s.slope ? (
                      <>
                        <b>{pp(s.slope.est)}</b>
                        <span className="block text-[11px] text-muted">
                          [{pp(s.slope.lo)} … {pp(s.slope.hi)}]
                        </span>
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="py-2.5">
                    <VerdictBadge v={v} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4">
          <Note icon={<Info size={15} />}>
            {t(
              "Прогноз — оценка отдачи от часа по данным текущего года (вкладка «Учебные часы»). Факт — по изменениям между годами в одних и тех же школах. Оценки используют пересекающиеся данные и не являются независимой проверкой. Для проверки нужен последующий период и пилот.",
              "Болжам — ағымдағы жыл деректері бойынша бір сағаттың қайтарымы («Оқу сағаттары» қойындысы). Факт — сол мектептердегі жылдар арасындағы өзгерістер бойынша. Бағалар ортақ деректерді пайдаланады және тәуелсіз тексеру емес. Болашақ кезеңдегі пилот қажет.",
            )}
          </Note>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <SchoolList
          title={t("Заметный рост сверх общей динамики", "Жалпы динамикадан тыс айтарлықтай өсу")}
          hint={t("Стоит изучить и распространить их опыт.", "Олардың тәжірибесін зерттеп, тарату керек.")}
          items={up}
          up
          onSchool={onSchool}
          empty={t("Таких школ нет.", "Ондай мектеп жоқ.")}
        />
        <SchoolList
          title={t("Заметный спад", "Айтарлықтай төмендеу")}
          hint={t("Нужна методическая поддержка в первую очередь.", "Ең алдымен әдістемелік қолдау қажет.")}
          items={down}
          onSchool={onSchool}
          empty={t("Таких школ нет.", "Ондай мектеп жоқ.")}
        />
      </div>

      <Note icon={<Info size={15} />}>
        {t(
          `Как считаем. Ученики в разных годах разные (${nStudents(d.nPrev)} и ${nStudents(d.nCur)}), поэтому результаты выравниваются по стартовому уровню. Эффект часов оценивается по школам: изменение результата школы в разделе против изменения часов на этот раздел (95% доверительные интервалы). Школа отмечается, только если её изменение выходит за пределы случайного разброса.`,
          `Қалай есептейміз. Әр жылдағы оқушылар әртүрлі (${nStudents(d.nPrev)} және ${nStudents(d.nCur)}), сондықтан нәтижелер бастапқы деңгей бойынша теңестіріледі. Сағат әсері мектептер бойынша бағаланады: мектептің бөлімдегі нәтижесінің өзгерісі осы бөлімге берілген сағаттың өзгерісімен салыстырылады (95% сенім аралықтары). Мектеп өзгерісі кездейсоқ ауытқудан асқанда ғана белгіленеді.`,
        )}
      </Note>
    </div>
  );
}

function Change({ s }: { s: DynSection }) {
  const { pp } = useFmt();
  const c = s.change;
  const Icon = !c.significant ? Minus : c.est > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={`inline-flex items-center gap-1 font-semibold ${!c.significant ? "text-slate-500" : c.est > 0 ? "text-emerald-700" : "text-red-600"}`}>
      <Icon size={14} />
      {pp(c.est)}
    </span>
  );
}

function VerdictBadge({ v }: { v: Verdict }) {
  const t = useT();
  switch (v) {
    case "confirmed":
      return (
        <Badge tone="green">
          <CheckCircle2 size={12} /> {t("оценки совместимы", "бағалар үйлесімді")}
        </Badge>
      );
    case "weaker":
      return <Badge tone="amber">{t("эффект слабее прогноза", "әсер болжамнан әлсіз")}</Badge>;
    case "not_confirmed":
      return <Badge tone="red">{t("не подтвердилось", "расталмады")}</Badge>;
    case "low_return":
      return <Badge tone="gray">{t("нет достаточных оснований", "сағат әсері аз")}</Badge>;
    default:
      return <Badge tone="gray">{t("часы не менялись", "сағат өзгермеді")}</Badge>;
  }
}

function SchoolList({
  title,
  hint,
  items,
  up = false,
  onSchool,
  empty,
}: {
  title: string;
  hint: string;
  items: Dynamics["schools"];
  up?: boolean;
  onSchool: (s: string) => void;
  empty: string;
}) {
  const { pp } = useFmt();
  return (
    <Card title={title} subtitle={hint}>
      {items.length === 0 ? (
        <p className="text-[13px] text-muted">{empty}</p>
      ) : (
        <ul className="divide-y divide-line/70">
          {items.slice(0, 6).map((s) => (
            <li key={s.school}>
              <button onClick={() => onSchool(s.school)} className="flex w-full items-center justify-between gap-3 py-2 text-left hover:bg-slate-50">
                <span>
                  <span className="text-[13px] font-semibold text-slate-800">{s.school}</span>
                  <span className="ml-2 text-[12px] text-muted">{s.district}</span>
                </span>
                <span className={`text-[13px] font-bold whitespace-nowrap ${up ? "text-emerald-700" : "text-red-600"}`}>{pp(s.vsAll.est)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
