// Методическая записка: детерминированная версия (работает без ИИ)
// и компактная сводка, которая уходит в ИИ (только агрегаты, без данных учеников).
import { Analysis } from "./analytics";
import { fmt1, nClasses, nSchools, nStudents, pct, pp, share, signed } from "./format";

export interface ReportContext {
  title: string;
  scope: string;
  synthetic: boolean;
  date: string;
}

const r1 = (x: number) => (Number.isFinite(x) ? Math.round(x * 10) / 10 : null);

export function buildSummary(a: Analysis, ctx: ReportContext) {
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
    key_findings: a.insights.map((i) => `${i.title}. ${i.text}`),
  };
}

export function buildReport(a: Analysis, ctx: ReportContext): string {
  const L: string[] = [];
  L.push(`# Методическая записка`);
  L.push(`**${ctx.title}** · ${ctx.scope} · ${ctx.date}`);
  L.push(
    `Охват: ${nStudents(a.meta.nStudents)}, ${nSchools(a.meta.nSchools)}, ${nClasses(a.meta.nClasses)}. Источник: результаты суммативного оценивания за раздел (СОР).` +
      (ctx.synthetic ? " *Расчёт выполнен на синтетических демо-данных.*" : ""),
  );

  L.push(`## 1. Главное`);
  for (const i of a.insights) L.push(`- **${i.title.replace(/\.$/, "")}.** ${i.text.trim()}`);

  L.push(`## 2. Трудные для усвоения разделы`);
  const risky = a.sections.filter((s) => s.status !== "ok").sort((x, y) => x.mean - y.mean);
  if (!risky.length) L.push(`Все разделы освоены на приемлемом уровне.`);
  for (const s of risky) {
    const diag = s.systemic
      ? "проблема системная: раздел проседает во всех школах"
      : s.uneven
        ? "результат сильно зависит от школы — вопрос качества преподавания"
        : "требует внимания";
    L.push(
      `- **${s.name}** — средний результат ${pct(s.mean)} (95% ДИ ${pct(s.ciLo)}–${pct(s.ciHi)}), ниже 40% — у ${share(s.lowShare)} учащихся; ${diag}.`,
    );
  }
  for (const l of a.prereqs.filter((l) => a.sections.find((s) => s.name === l.to)?.status !== "ok")) {
    L.push(
      `- Связь «${l.from}» → «${l.to}»: среди не освоивших «${l.from}» провалили «${l.to}» ${share(l.failIfWeak)} учащихся, среди освоивших — ${share(l.failIfStrong)}.`,
    );
  }

  L.push(`## 3. Эффективность учебников`);
  const tb = a.textbooks;
  if (!tb.ok) L.push(`Недостаточно данных для сравнения учебников (нужно минимум 2 учебника, на каждый — от 3 школ).`);
  else {
    for (const r of [...tb.rows].sort((x, y) => y.adjusted.mean - x.adjusted.mean))
      L.push(
        `- **${r.name}**: ${nSchools(r.nSchools)}, сырой средний балл ${pct(r.naive.mean)}, с поправкой на состав учеников — ${pct(r.adjusted.mean)} (95% ДИ ${pct(r.adjusted.lo)}–${pct(r.adjusted.hi)}).`,
      );
    if (tb.rankChanged)
      L.push(
        `Рейтинг по сырым баллам (${tb.naiveRank.join(" > ")}) отличается от рейтинга с поправкой (${tb.adjustedRank.join(" > ")}): учебники используются в школах с разным стартовым уровнем учеников.`,
      );
    L.push(
      tb.bestSignificant
        ? `Лидер — «${tb.best}», отрыв ${pp(tb.bestMargin)} статистически надёжен.`
        : `Отрыв лидера («${tb.best}», ${pp(tb.bestMargin)}) в пределах погрешности — менять учебник только на этом основании не рекомендуется.`,
    );
    for (const l of tb.lags)
      L.push(`- Слабая глава: «${l.textbook}» в разделе «${l.section}» — ${pp(l.diffVsBest)} к лучшему учебнику при равном составе учеников.`);
  }

  L.push(`## 4. Рекомендации по распределению учебных часов`);
  const h = a.hours;
  if (!h.ok) L.push(`Нет данных о фактических часах по классам — рекомендации по часам недоступны.`);
  else {
    L.push(`Общий объём (${h.totalPlanned} ч) сохраняется, перераспределяется ${h.movedHours} ч:`);
    for (const s of h.sections.filter((s) => s.delta !== 0))
      L.push(`- **${s.name}**: ${s.planned} → ${s.recommended} ч (${signed(s.delta)}). ${s.reason}`);
    L.push(
      `Ожидаемый эффект: средний результат ${pct(h.meanBefore)} → ${fmt1(h.meanAfter)}% (${pp(h.meanAfter - h.meanBefore)}; по консервативной оценке ${pp(
        h.meanAfterConservative - h.meanBefore,
      )}), доля результатов ниже 40% — с ${share(h.lowBefore)} до ${share(h.lowAfter)}.`,
    );
  }

  L.push(`## 5. План действий на следующую четверть`);
  let n = 1;
  const root = a.prereqs.find((l) => a.sections.find((s) => s.name === l.to)?.status === "hard");
  if (root)
    L.push(`${n++}. Перед изучением «${root.to}» провести диагностический срез по «${root.from}» и 1–2 урока повторения для учащихся с результатом ниже 40%.`);
  for (const l of tb.lags.slice(0, 2))
    L.push(`${n++}. Школам, работающим по «${l.textbook}», подготовить дополнительные материалы к разделу «${l.section}».`);
  const uneven = a.sections.find((s) => s.uneven);
  if (uneven && uneven.bestSchools.length)
    L.push(
      `${n++}. По разделу «${uneven.name}» организовать методический семинар с участием ${uneven.bestSchools
        .slice(0, 2)
        .map((s) => `«${s.school}» (${s.district})`)
        .join(" и ")} для школ с результатом ниже ожидаемого: ${uneven.worstSchools
        .slice(0, 3)
        .map((s) => `«${s.school}»`)
        .join(", ")}.`,
    );
  if (h.ok && h.movedHours > 0)
    L.push(`${n++}. Апробировать новое распределение часов в 5–10 школах и сравнить результаты следующего СОР с остальными школами.`);
  L.push(`${n++}. Повторить анализ после следующего СОР и отследить динамику.`);

  L.push(`## 6. Ограничения`);
  L.push(
    `- Учебники выбираются школами не случайно. Мы учитываем стартовый уровень учеников, тип местности и язык обучения, но другие различия между школами могут влиять на результат.`,
  );
  L.push(`- Эффект часов оценён по естественным различиям между классами; прогноз нужно подтвердить пилотом.`);
  if (ctx.synthetic) L.push(`- Все цифры получены на синтетических демо-данных и не описывают реальные школы.`);
  return L.join("\n\n");
}
