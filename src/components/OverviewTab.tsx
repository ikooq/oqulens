import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  FlaskConical,
  Info,
  Lightbulb,
  School,
  Target,
  TrendingDown,
  Users,
  XCircle,
} from "lucide-react";
import { Analysis, buildInsights, Insight } from "@/lib/analytics";
import { int } from "@/lib/format";
import { DataQuality, DemoTruth } from "@/lib/types";
import { validateDemo } from "@/lib/validation";
import { Dynamics } from "@/lib/dynamics";
import { Card, Kpi, LevelBar, LevelLegend, StatusBadge } from "./ui";
import { useFmt, useLang, useT } from "./lang";
import type { Tab } from "./App";

const TONE: Record<Insight["tone"], { icon: React.ReactNode; ring: string; chip: string }> = {
  risk: { icon: <AlertTriangle size={17} />, ring: "ring-red-100", chip: "bg-red-50 text-red-600" },
  info: { icon: <Lightbulb size={17} />, ring: "ring-sky-100", chip: "bg-sky-50 text-sky-600" },
  good: { icon: <CheckCircle2 size={17} />, ring: "ring-emerald-100", chip: "bg-emerald-50 text-emerald-600" },
};

const TAB_LABEL: Record<Insight["tab"], [string, string]> = {
  sections: ["К разделам", "Бөлімдерге"],
  textbooks: ["К учебникам", "Оқулықтарға"],
  hours: ["К часам", "Сағаттарға"],
};

export default function OverviewTab({
  a,
  go,
  truth,
  quality,
  dyn,
}: {
  a: Analysis;
  go: (t: Tab) => void;
  truth?: DemoTruth;
  quality?: DataQuality;
  dyn?: Dynamics | null;
}) {
  const lang = useLang();
  const t = useT();
  const f = useFmt();
  const insights = buildInsights(a, lang);
  return (
    <div className="space-y-6">
      {quality && <QualityCard q={quality} />}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi icon={<Users size={15} />} label={t("Учащихся", "Оқушылар")} value={int(a.meta.nStudents)} sub={f.nClasses(a.meta.nClasses)} />
        <Kpi icon={<School size={15} />} label={t("Школ", "Мектептер")} value={a.meta.nSchools} sub={f.nDistricts(a.meta.nDistricts)} />
        <Kpi
          icon={<Target size={15} />}
          label={t("Средний результат СОР", "БЖБ орташа нәтижесі")}
          value={f.pct(a.overall.mean)}
          sub={t(`высокий уровень (≥85%): ${f.share(a.overall.highShare)}`, `жоғары деңгей (≥85%): ${f.share(a.overall.highShare)}`)}
        />
        <Kpi
          icon={<TrendingDown size={15} />}
          label={t("Результатов ниже 40%", "40%-дан төмен нәтижелер")}
          value={f.share(a.overall.lowShare)}
          sub={t("доля работ с низким уровнем", "төмен деңгейлі жұмыстар үлесі")}
        />
      </div>

      <div data-tour="insights">
        <h2 className="mb-3 text-[15px] font-bold text-slate-900">{t("Главные выводы", "Негізгі қорытындылар")}</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {insights.map((ins, i) => {
            const tone = TONE[ins.tone];
            return (
              <div key={i} className={`flex flex-col rounded-2xl bg-white p-5 ring-1 ${tone.ring}`}>
                <div className="flex items-start gap-3">
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${tone.chip}`}>{tone.icon}</span>
                  <div>
                    <h3 className="text-[14.5px] leading-snug font-bold text-slate-900">{ins.title}</h3>
                    <p className="mt-1.5 text-[13px] leading-relaxed text-slate-600">{ins.text}</p>
                  </div>
                </div>
                <button
                  onClick={() => go(ins.tab)}
                  className="mt-3 ml-11 inline-flex items-center gap-1 self-start text-[12.5px] font-semibold text-brand hover:underline"
                >
                  {t(...TAB_LABEL[ins.tab])} <ArrowRight size={13} />
                </button>
              </div>
            );
          })}
          {insights.length === 0 && (
            <p className="text-[13px] text-muted">{t("Недостаточно данных для автоматических выводов.", "Автоматты қорытындылар үшін дерек жеткіліксіз.")}</p>
          )}
        </div>
      </div>

      <Card
        title={t("Уровни освоения по разделам", "Бөлімдер бойынша меңгеру деңгейлері")}
        subtitle={t(
          "Доля учащихся на каждом уровне по результатам СОР, в порядке изучения",
          "БЖБ нәтижелері бойынша әр деңгейдегі оқушылар үлесі, оқу ретімен",
        )}
        actions={<LevelLegend />}
      >
        <div className="space-y-3.5">
          {a.sections.map((s) => (
            <div key={s.name} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1.5 sm:grid-cols-[minmax(0,260px)_1fr_auto]">
              <div className="min-w-0">
                <div className="truncate text-[13.5px] font-semibold text-slate-800" title={s.name}>
                  <span className="text-muted">{s.order}.</span> {s.name}
                </div>
                <div className="text-[12px] text-muted">{t(`${s.planned} ч по плану`, `жоспар бойынша ${s.planned} сағ`)}</div>
              </div>
              <div className="order-last col-span-2 sm:order-none sm:col-span-1">
                <LevelBar levels={s.levels} height="h-4" />
              </div>
              <div className="flex w-[130px] items-center justify-end gap-2.5">
                <span className="tabular text-[15px] font-bold text-slate-900">{f.pct(s.mean)}</span>
                <StatusBadge status={s.status} />
              </div>
            </div>
          ))}
        </div>
      </Card>

      {truth && <ValidationCard a={a} truth={truth} dyn={dyn} />}
    </div>
  );
}

function QualityCard({ q }: { q: DataQuality }) {
  const t = useT();
  const warn = q.checks.filter((c) => c.level === "warn").length;
  return (
    <Card
      title={
        <span className="inline-flex items-center gap-2">
          <ClipboardCheck size={17} className="text-brand" /> {t("Качество данных", "Деректер сапасы")}
        </span>
      }
      subtitle={
        warn
          ? t(`Замечаний: ${warn}. Анализ выполнен, но учтите их при чтении выводов.`, `Ескертулер: ${warn}. Талдау орындалды, бірақ қорытындыларды оқығанда оларды ескеріңіз.`)
          : t("Файл прочитан без замечаний.", "Файл ескертусіз оқылды.")
      }
    >
      <ul className="space-y-2">
        {q.checks.map((c, i) => (
          <li key={i} className="flex items-start gap-2.5 text-[13px] leading-relaxed text-slate-700">
            {c.level === "ok" ? (
              <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-600" />
            ) : c.level === "warn" ? (
              <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-600" />
            ) : (
              <Info size={16} className="mt-0.5 shrink-0 text-sky-600" />
            )}
            {c.text}
          </li>
        ))}
      </ul>
    </Card>
  );
}

function ValidationCard({ a, truth, dyn }: { a: Analysis; truth: DemoTruth; dyn?: Dynamics | null }) {
  const lang = useLang();
  const t = useT();
  const checks = validateDemo(a, truth, lang, dyn);
  const ok = checks.filter((c) => c.ok).length;
  return (
    <div data-tour="validation">
      <Card
        title={
          <span className="inline-flex items-center gap-2">
            <FlaskConical size={17} className="text-brand" /> {t("Проверка метода на известном ответе", "Әдісті белгілі жауап бойынша тексеру")}
          </span>
        }
        subtitle={t(
          `В демо-данные заранее заложены закономерности. Платформа ищет их сама, не зная ответа: найдено ${ok} из ${checks.length}.`,
          `Демо-деректерге заңдылықтар алдын ала салынған. Платформа оларды жауапты білмей-ақ өзі іздейді: ${checks.length}-тің ${ok}-і табылды.`,
        )}
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-[13px]">
            <thead>
              <tr className="border-b border-line text-left text-[12px] text-muted">
                <th className="py-2 pr-3 font-semibold">{t("Что проверяем", "Не тексеріледі")}</th>
                <th className="py-2 pr-3 font-semibold">{t("Заложено в данные", "Деректерге салынған")}</th>
                <th className="py-2 font-semibold">{t("Нашла платформа", "Платформа тапқаны")}</th>
              </tr>
            </thead>
            <tbody>
              {checks.map((c) => (
                <tr key={c.title} className="border-b border-line/70 last:border-0">
                  <td className="py-2.5 pr-3 font-semibold text-slate-800">
                    <span className="inline-flex items-center gap-2">
                      {c.ok ? <CheckCircle2 size={16} className="shrink-0 text-emerald-600" /> : <XCircle size={16} className="shrink-0 text-red-600" />}
                      {c.title}
                    </span>
                  </td>
                  <td className="py-2.5 pr-3 text-slate-600">{c.planted}</td>
                  <td className="py-2.5 text-slate-800">{c.found}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
