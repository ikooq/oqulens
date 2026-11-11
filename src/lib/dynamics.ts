// Динамика между учебными годами: что изменилось и сработали ли изменения.
// Сравниваем два последних периода в данных. Ученики в разных годах разные,
// поэтому результаты выравниваем по стартовому уровню, а эффект часов оцениваем
// по школам: насколько изменился результат там, где часы на раздел изменились.

import { Row } from "./types";
import { disambiguateSchools, periodsOf } from "./analytics";
import { groupBy, mean, ols, variance } from "./stats";

const Z = 1.96;

export interface Interval {
  est: number;
  se: number;
  lo: number;
  hi: number;
  significant: boolean;
}

const interval = (est: number, se: number): Interval => ({
  est,
  se,
  lo: est - Z * se,
  hi: est + Z * se,
  significant: Number.isFinite(se) && se > 0 && Math.abs(est) > Z * se,
});

export interface DynGroup {
  n: number;
  delta: number;
}

export interface DynSection {
  name: string;
  order: number;
  meanPrev: number;
  meanCur: number;
  /** Изменение с поправкой на стартовый уровень учеников, п.п. */
  change: Interval;
  hoursPrev: number;
  hoursCur: number;
  /** Сколько школ изменили часы на раздел хотя бы на 2 ч */
  nChanged: number;
  /** Фактическая отдача: +1 час к прошлому году → изменение результата школы, п.п. */
  slope: Interval | null;
  /** Школы, добавившие ≥ 2 ч, против школ, где часы почти не менялись */
  added: DynGroup | null;
  same: DynGroup | null;
  cut: DynGroup | null;
  /** Разница в динамике: «добавили часы» минус «не меняли» */
  did: Interval | null;
}

export interface DynSchool {
  school: string;
  district: string;
  delta: number;
  /** Изменение относительно общей динамики по данным */
  vsAll: Interval;
  flag: "up" | "down" | "none";
  /** Сколько часов школа перенесла между разделами */
  hoursMoved: number;
}

export interface Dynamics {
  hasBaseline: boolean;
  prev: string;
  cur: string;
  nPrev: number;
  nCur: number;
  nSchools: number;
  overall: { meanPrev: number; meanCur: number; change: Interval };
  sections: DynSection[];
  schools: DynSchool[];
}

const pctOf = (r: Row) => (100 * r.score) / r.maxScore;
const CHANGE_H = 2;
const MIN_STUDENTS = 5;

export function analyzeDynamics(rows: Row[]): Dynamics | null {
  const periods = periodsOf(rows);
  if (periods.length < 2) return null;
  const prev = periods[periods.length - 2];
  const cur = periods[periods.length - 1];
  const rs = disambiguateSchools(rows).filter((r) => r.period === prev || r.period === cur);
  const isCur = (r: Row) => (r.period === cur ? 1 : 0);
  const baseMean = mean(rs.map((r) => r.baselinePct));

  const hasBaseline = rs.every((r) => !r.baselineMissing && Number.isFinite(r.baselinePct)) && variance(rs.map((r) => r.baselinePct)) > 1e-9;

  const sectionNames = [...groupBy(rs, (r) => r.section).entries()]
    .map(([name, g]) => ({ name, order: mean(g.map((r) => r.sectionOrder)) }))
    .sort((a, b) => a.order - b.order);
  const secIndex = new Map(sectionNames.map((s, i) => [s.name, i]));

  // Общая динамика: балл ~ стартовый уровень + год + разделы, ошибки кластерные по школам
  const k = sectionNames.length;
  const X = rs.map((r) => {
    const row = [1, ...(hasBaseline ? [r.baselinePct - baseMean] : []), isCur(r)];
    for (let j = 1; j < k; j++) row.push(secIndex.get(r.section) === j ? 1 : 0);
    return row;
  });
  const fitAll = ols(
    X,
    rs.map(pctOf),
    rs.map((r) => r.school),
  );
  const overall = {
    meanPrev: mean(rs.filter((r) => !isCur(r)).map(pctOf)),
    meanCur: mean(rs.filter(isCur).map(pctOf)),
    change: interval(fitAll.beta[hasBaseline ? 2 : 1], fitAll.se[hasBaseline ? 2 : 1]),
  };
  const bBase = hasBaseline && fitAll.ok ? fitAll.beta[1] : 0;
  const adj = (r: Row) => pctOf(r) - bBase * (r.baselinePct - baseMean);

  const schoolsBySection = new Map<string, { school: string; delta: number; dh: number; nMin: number }[]>();

  const sections: DynSection[] = sectionNames.map(({ name, order }) => {
    const sr = rs.filter((r) => r.section === name);
    const fit = ols(
      sr.map((r) => [1, ...(hasBaseline ? [r.baselinePct - baseMean] : []), isCur(r)]),
      sr.map(pctOf),
      sr.map((r) => r.school),
    );
    const prevR = sr.filter((r) => !isCur(r));
    const curR = sr.filter(isCur);

    // По школам: изменение выровненного результата и часов
    const per: { school: string; delta: number; dh: number; nMin: number }[] = [];
    for (const [school, g] of groupBy(sr, (r) => r.school)) {
      const a = g.filter((r) => !isCur(r));
      const b = g.filter(isCur);
      if (a.length < MIN_STUDENTS || b.length < MIN_STUDENTS) continue;
      per.push({
        school,
        delta: mean(b.map(adj)) - mean(a.map(adj)),
        dh: mean(b.map((r) => r.actualHours)) - mean(a.map((r) => r.actualHours)),
        nMin: Math.min(a.length, b.length),
      });
    }
    schoolsBySection.set(name, per);

    // Отдача от часа по школам (есть смысл, только если часы заметно менялись)
    let slope: Interval | null = null;
    const dhVar = variance(per.map((p) => p.dh));
    if (per.length >= 8 && dhVar >= 0.5) {
      const f = ols(
        per.map((p) => [1, p.dh]),
        per.map((p) => p.delta),
      );
      if (f.ok) slope = interval(f.beta[1], f.se[1]);
    }

    const grp = (sel: typeof per): DynGroup | null => (sel.length ? { n: sel.length, delta: mean(sel.map((p) => p.delta)) } : null);
    const addedS = per.filter((p) => p.dh >= CHANGE_H);
    const sameS = per.filter((p) => Math.abs(p.dh) < CHANGE_H);
    const cutS = per.filter((p) => p.dh <= -CHANGE_H);
    let did: Interval | null = null;
    if (addedS.length >= 3 && sameS.length >= 3) {
      const d1 = addedS.map((p) => p.delta);
      const d0 = sameS.map((p) => p.delta);
      did = interval(mean(d1) - mean(d0), Math.sqrt(variance(d1) / d1.length + variance(d0) / d0.length));
    }

    return {
      name,
      order,
      meanPrev: mean(prevR.map(pctOf)),
      meanCur: mean(curR.map(pctOf)),
      change: interval(fit.beta[hasBaseline ? 2 : 1], fit.se[hasBaseline ? 2 : 1]),
      hoursPrev: mean(prevR.map((r) => r.actualHours)),
      hoursCur: mean(curR.map((r) => r.actualHours)),
      nChanged: addedS.length + cutS.length,
      slope,
      added: grp(addedS),
      same: grp(sameS),
      cut: grp(cutS),
      did,
    };
  });

  // Школы: средний по разделам выровненный результат ученика, год к году
  const schools: DynSchool[] = [];
  for (const [school, g] of groupBy(rs, (r) => r.school)) {
    const studentAvg = (sel: Row[]) => [...groupBy(sel, (r) => JSON.stringify([r.school, r.classId, r.studentId])).values()].map((s) => mean(s.map(adj)));
    const a = studentAvg(g.filter((r) => !isCur(r)));
    const b = studentAvg(g.filter(isCur));
    if (a.length < MIN_STUDENTS || b.length < MIN_STUDENTS) continue;
    const delta = mean(b) - mean(a);
    const se = Math.sqrt(variance(a) / a.length + variance(b) / b.length);
    const vsAll = interval(delta - overall.change.est, se);
    const moved =
      sectionNames.reduce((s, { name }) => s + Math.abs(schoolsBySection.get(name)?.find((p) => p.school === school)?.dh ?? 0), 0) / 2;
    schools.push({
      school,
      district: g[0].district,
      delta,
      vsAll,
      flag: vsAll.significant ? (vsAll.est > 0 ? "up" : "down") : "none",
      hoursMoved: moved,
    });
  }
  schools.sort((x, y) => y.vsAll.est - x.vsAll.est);

  return {
    hasBaseline,
    prev,
    cur,
    nPrev: new Set(rs.filter((r) => !isCur(r)).map((r) => JSON.stringify([r.school, r.classId, r.studentId]))).size,
    nCur: new Set(rs.filter(isCur).map((r) => JSON.stringify([r.school, r.classId, r.studentId]))).size,
    nSchools: schools.length,
    overall,
    sections,
    schools,
  };
}

export interface DynHighlight {
  section: DynSection;
  forecast?: number;
  verdict: Verdict;
}

/** Разделы с вердиктом; первым — раздел с самым заметным подтверждённым эффектом часов. */
export function dynamicsHighlights(d: Dynamics, perHour: (section: string) => number | undefined): DynHighlight[] {
  const rank: Record<Verdict, number> = { confirmed: 0, weaker: 1, not_confirmed: 2, low_return: 3, no_data: 4 };
  return d.sections
    .map((s) => ({ section: s, forecast: perHour(s.name), verdict: verdict(s, perHour(s.name)) }))
    .sort((x, y) => rank[x.verdict] - rank[y.verdict] || (y.section.slope?.est ?? 0) - (x.section.slope?.est ?? 0));
}

export type Verdict = "confirmed" | "weaker" | "not_confirmed" | "low_return" | "no_data";

/**
 * Сверка с прогнозом модели: подтвердилась ли отдача от часов.
 * forecastPerHour — сколько п.п. обещал +1 час по данным текущего года.
 */
export function verdict(s: DynSection, forecastPerHour: number | undefined): Verdict {
  if (!s.slope) return "no_data";
  if (!s.slope.significant || s.slope.est <= 0) return forecastPerHour !== undefined && forecastPerHour > 1 ? "not_confirmed" : "low_return";
  if (forecastPerHour === undefined) return "confirmed";
  return s.slope.lo <= forecastPerHour && forecastPerHour <= s.slope.hi ? "confirmed" : "weaker";
}
