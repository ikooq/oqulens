import { AlertTriangle, ArrowRight, CheckCircle2, Lightbulb, School, Target, TrendingDown, Users } from "lucide-react";
import { Analysis, Insight } from "@/lib/analytics";
import { int, nClasses, nDistricts, pct, share } from "@/lib/format";
import { Card, Kpi, LevelBar, LevelLegend, StatusBadge } from "./ui";
import type { Tab } from "./App";

const TONE: Record<Insight["tone"], { icon: React.ReactNode; ring: string; chip: string }> = {
  risk: { icon: <AlertTriangle size={17} />, ring: "ring-red-100", chip: "bg-red-50 text-red-600" },
  info: { icon: <Lightbulb size={17} />, ring: "ring-sky-100", chip: "bg-sky-50 text-sky-600" },
  good: { icon: <CheckCircle2 size={17} />, ring: "ring-emerald-100", chip: "bg-emerald-50 text-emerald-600" },
};

const TAB_LABEL: Record<Insight["tab"], string> = {
  sections: "К разделам",
  textbooks: "К учебникам",
  hours: "К часам",
};

export default function OverviewTab({ a, go }: { a: Analysis; go: (t: Tab) => void }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi icon={<Users size={15} />} label="Учащихся" value={int(a.meta.nStudents)} sub={nClasses(a.meta.nClasses)} />
        <Kpi icon={<School size={15} />} label="Школ" value={a.meta.nSchools} sub={nDistricts(a.meta.nDistricts)} />
        <Kpi icon={<Target size={15} />} label="Средний результат СОР" value={pct(a.overall.mean)} sub={`высокий уровень (≥85%): ${share(a.overall.highShare)}`} />
        <Kpi
          icon={<TrendingDown size={15} />}
          label="Результатов ниже 40%"
          value={share(a.overall.lowShare)}
          sub="доля работ с низким уровнем"
        />
      </div>

      <div>
        <h2 className="mb-3 text-[15px] font-bold text-slate-900">Главные выводы</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {a.insights.map((ins, i) => {
            const t = TONE[ins.tone];
            return (
              <div key={i} className={`flex flex-col rounded-2xl bg-white p-5 ring-1 ${t.ring}`}>
                <div className="flex items-start gap-3">
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${t.chip}`}>{t.icon}</span>
                  <div>
                    <h3 className="text-[14.5px] leading-snug font-bold text-slate-900">{ins.title}</h3>
                    <p className="mt-1.5 text-[13px] leading-relaxed text-slate-600">{ins.text}</p>
                  </div>
                </div>
                <button
                  onClick={() => go(ins.tab)}
                  className="mt-3 ml-11 inline-flex items-center gap-1 self-start text-[12.5px] font-semibold text-brand hover:underline"
                >
                  {TAB_LABEL[ins.tab]} <ArrowRight size={13} />
                </button>
              </div>
            );
          })}
          {a.insights.length === 0 && <p className="text-[13px] text-muted">Недостаточно данных для автоматических выводов.</p>}
        </div>
      </div>

      <Card title="Уровни освоения по разделам" subtitle="Доля учащихся на каждом уровне по результатам СОР, в порядке изучения" actions={<LevelLegend />}>
        <div className="space-y-3.5">
          {a.sections.map((s) => (
            <div key={s.name} className="grid grid-cols-[minmax(0,260px)_1fr_auto] items-center gap-4">
              <div className="min-w-0">
                <div className="truncate text-[13.5px] font-semibold text-slate-800" title={s.name}>
                  <span className="text-muted">{s.order}.</span> {s.name}
                </div>
                <div className="text-[12px] text-muted">{s.planned} ч по плану</div>
              </div>
              <LevelBar levels={s.levels} height="h-4" />
              <div className="flex w-[130px] items-center justify-end gap-2.5">
                <span className="tabular text-[15px] font-bold text-slate-900">{pct(s.mean)}</span>
                <StatusBadge status={s.status} />
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
