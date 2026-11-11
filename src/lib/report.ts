// Методическая записка: детерминированная версия (работает без ИИ)
// и компактная сводка, которая уходит в ИИ (только агрегаты, без данных учеников).
import { Analysis } from "./analytics";
import { Dynamics, dynamicsHighlights } from "./dynamics";


export interface ReportContext {
  title: string;
  scope: string;
  synthetic: boolean;
  date: string;
}

const r1 = (x: number) => (Number.isFinite(x) ? Math.round(x * 10) / 10 : null);

/** Динамика год к году для ИИ: только агрегаты по разделам и школам. */
export function dynamicsSummary(a: Analysis, d: Dynamics) {
  const hs = dynamicsHighlights(d, (n) => a.hours.sections.find((h) => h.name === n)?.perHour);
  return {
    periods: [d.prev, d.cur],
    note: "Основной анализ выше — по последнему году. Здесь — сравнение двух лет: результаты выровнены по стартовому уровню; эффект часа оценён по школам (изменение результата против изменения часов на раздел).",
    mean_pct: [r1(d.overall.meanPrev), r1(d.overall.meanCur)],
    change_equal_start_pp: r1(d.overall.change.est),
    change_ci95: [r1(d.overall.change.lo), r1(d.overall.change.hi)],
    change_significant: d.overall.change.significant,
    sections: hs.map(({ section: s, forecast, verdict }) => ({
      name: s.name,
      avg_hours: [r1(s.hoursPrev), r1(s.hoursCur)],
      change_pp: r1(s.change.est),
      forecast_pp_per_hour: forecast !== undefined ? r1(forecast) : null,
      actual_pp_per_hour: s.slope ? r1(s.slope.est) : null,
      actual_ci95: s.slope ? [r1(s.slope.lo), r1(s.slope.hi)] : null,
      verdict,
      schools_added_2h: s.added ? { n: s.added.n, change_pp: r1(s.added.delta) } : null,
      schools_unchanged: s.same ? { n: s.same.n, change_pp: r1(s.same.delta) } : null,
    })),
    verdict_legend: "confirmed — оценки совместимы; weaker — оценки различаются; not_confirmed — связь не выявлена; low_return — недостаточно оснований для вывода; no_data — данных недостаточно",
    schools_rose: d.schools.filter((s) => s.flag === "up").slice(0, 5).map((s) => ({ school: s.school, district: s.district, vs_all_pp: r1(s.vsAll.est) })),
    schools_fell: d.schools.filter((s) => s.flag === "down").reverse().slice(0, 5).map((s) => ({ school: s.school, district: s.district, vs_all_pp: r1(s.vsAll.est) })),
  };
}

export function buildSummary(a: Analysis, ctx: ReportContext, dyn?: Dynamics | null) {
  return {
    title: ctx.title,
    scope: ctx.scope,
    synthetic_demo_data: ctx.synthetic,
    coverage: { students: a.meta.nStudents, schools: a.meta.nSchools, classes: a.meta.nClasses, districts: a.meta.nDistricts },
    overall: { mean_pct: r1(a.overall.mean), share_below_40_pct: r1(100 * a.overall.lowShare) },
    sections: a.sections.map((s) => ({
      order: s.order,
      name: s.name,
      planned_hours: s.planned,
      mean_pct: r1(s.mean),
      ci95: [r1(s.ciLo), r1(s.ciHi)],
      share_below_40_pct: r1(100 * s.lowShare),
      status: s.status,
      systemic_problem: s.systemic,
      depends_on_school: s.uneven,
      schools_below_expected: s.worstSchools.map((w) => ({ school: w.school, district: w.district, gap_pp: r1(w.residual) })),
      schools_above_expected: s.bestSchools.map((w) => ({ school: w.school, district: w.district, gap_pp: r1(w.residual) })),
    })),
    prerequisite_links: a.prereqs.map((l) => ({
      from: l.from,
      to: l.to,
      fail_rate_in_to_if_from_weak_pct: r1(100 * l.failIfWeak),
      fail_rate_in_to_if_from_mastered_pct: r1(100 * l.failIfStrong),
    })),
    textbooks: {
      method: "OLS: результат ~ учебник + стартовый уровень + город/село + язык обучения; ошибки кластеризованы по школам",
      rows: a.textbooks.rows.map((r) => ({
        name: r.name,
        schools: r.nSchools,
        students: r.nStudents,
        urban_share_pct: r1(100 * r.urbanShare),
        mean_baseline_pct: r1(r.meanBaseline),
        raw_mean_pct: r1(r.naive.mean),
        adjusted_mean_pct: r1(r.adjusted.mean),
        adjusted_ci95: [r1(r.adjusted.lo), r1(r.adjusted.hi)],
        enough_data: r.enough,
      })),
      raw_ranking: a.textbooks.naiveRank,
      adjusted_ranking: a.textbooks.adjustedRank,
      leader_margin_pp: r1(a.textbooks.bestMargin),
      leader_significant: a.textbooks.bestSignificant,
      weak_chapters: a.textbooks.lags.map((l) => ({ textbook: l.textbook, section: l.section, behind_best_pp: r1(l.diffVsBest) })),
    },
    hours: a.hours.ok
      ? {
          total_hours_unchanged: a.hours.totalPlanned,
          moved_hours: a.hours.movedHours,
          mean_pct_before: r1(a.hours.meanBefore),
          mean_pct_after: r1(a.hours.meanAfter),
          mean_pct_after_conservative: r1(a.hours.meanAfterConservative),
          share_below_40_before_pct: r1(100 * a.hours.lowBefore),
          share_below_40_after_pct: r1(100 * a.hours.lowAfter),
          sections: a.hours.sections.map((h) => ({
            name: h.name,
            planned: h.planned,
            recommended: h.recommended,
            gain_pp_per_extra_hour: r1(h.perHour),
            expected_change_pp: r1(h.gain),
            reason: h.reason,
          })),
        }
      : null,
    schools: {
      method:
        "Результат школы относительно ожидаемого при её составе учеников (стартовый уровень, город/село, учебник); оценки небольших школ сдвинуты к среднему (эмпирический Байес)",
      below_expected: schoolList(a, "below").map(schoolBrief),
      above_expected: schoolList(a, "above").map(schoolBrief),
    },
    key_findings: a.insights.map((i) => `${i.title}. ${i.text}`),
    ...(dyn ? { dynamics_year_over_year: dynamicsSummary(a, dyn) } : {}),
  };
}

export function schoolList(a: Analysis, flag: "below" | "above") {
  const xs = a.schools.filter((p) => p.vaFlag === flag);
  return (flag === "below" ? xs.reverse() : xs).slice(0, 8);
}

function schoolBrief(p: Analysis["schools"][number]) {
  return {
    school: p.school,
    district: p.district,
    mean_pct: r1(p.mean),
    vs_expected_pp: r1(p.valueAdded),
    sections_below_expected: p.sections.filter((s) => s.flag === "below").map((s) => s.section),
    sections_above_expected: p.sections.filter((s) => s.flag === "above").map((s) => s.section),
  };
}

