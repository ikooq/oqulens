// Аналитическое ядро OquLens. Работает целиком в браузере:
// данные учеников не покидают компьютер методиста.

import { Filters, Level, Row } from "./types";
import { clamp, correlation, groupBy, icc, linCombVar, mean, ols, sd, variance } from "./stats";
import { isRegionCenter } from "./generator";
import { Lang, tr } from "./i18n";

export const LEVEL_ORDER: Level[] = ["low", "mid", "good", "high"];
export const LEVEL_LABEL: Record<Level, string> = {
  low: "Низкий (<40%)",
  mid: "Ниже среднего (40–64%)",
  good: "Хороший (65–84%)",
  high: "Высокий (≥85%)",
};
const LEVEL_LABEL_KK: Record<Level, string> = {
  low: "Төмен (<40%)",
  mid: "Орташадан төмен (40–64%)",
  good: "Жақсы (65–84%)",
  high: "Жоғары (≥85%)",
};
export const levelLabel = (l: Level, lang: Lang) => (lang === "kk" ? LEVEL_LABEL_KK[l] : LEVEL_LABEL[l]);
export const levelOf = (pct: number): Level =>
  pct < 40 ? "low" : pct < 65 ? "mid" : pct < 85 ? "good" : "high";

const Z = 1.96;

// ---------------------------------------------------------------- типы

export interface SectionInfo {
  name: string;
  order: number;
  planned: number;
}

interface Student {
  id: string;
  classId: string;
  school: string;
  district: string;
  urban: number;
  rus: number;
  textbook: string;
  baseline: number;
  pct: Record<string, number>;
}

interface ClassInfo {
  id: string;
  school: string;
  urban: number;
  rus: number;
  textbook: string;
  hours: Record<string, number>;
  students: Student[];
}

export interface SchoolDeviation {
  school: string;
  district: string;
  mean: number;
  residual: number; // насколько выше/ниже ожидаемого по стартовому уровню, п.п.
  n: number;
}

export interface SectionStat extends SectionInfo {
  n: number;
  mean: number;
  ciLo: number;
  ciHi: number;
  levels: Record<Level, number>;
  lowShare: number;
  icc: number;
  status: "hard" | "watch" | "ok";
  uneven: boolean;
  systemic: boolean;
  worstSchools: SchoolDeviation[];
  bestSchools: SchoolDeviation[];
}

export interface PrereqLink {
  from: string;
  to: string;
  partialCorr: number;
  gamma: number;
  failIfWeak: number; // доля «<40%» в зависимом разделе среди не освоивших пререквизит
  failIfStrong: number; // ... среди освоивших (≥65%)
  nWeak: number;
  nStrong: number;
}

export interface Estimate {
  mean: number;
  lo: number;
  hi: number;
}

export interface TextbookRow {
  name: string;
  nSchools: number;
  nStudents: number;
  urbanShare: number;
  meanBaseline: number;
  naive: Estimate;
  adjusted: Estimate;
  enough: boolean;
}

export interface TextbookCell {
  textbook: string;
  section: string;
  adjMean: number;
  diffVsBest: number;
  /** отставание сверх обычного для этого учебника (медиана по разделам), п.п. */
  excess: number;
  z: number;
  flag: "best" | "lag" | "none";
}

export interface TextbookAnalysis {
  ok: boolean;
  rows: TextbookRow[];
  naiveRank: string[];
  adjustedRank: string[];
  rankChanged: boolean;
  best: string | null;
  bestMargin: number;
  bestSignificant: boolean;
  matrix: TextbookCell[];
  lags: TextbookCell[];
}

export interface HoursSection extends SectionInfo {
  beta: number;
  se: number;
  perHour: number; // п.п. за +1 час (точечная оценка)
  significant: boolean;
  lo: number;
  hi: number;
  recommended: number;
  delta: number;
  gain: number; // ожидаемое изменение результата раздела с учётом пререквизитов, п.п.
  dependents: string[];
  reason: string;
  reasonKk: string;
}

export const hoursReason = (h: HoursSection, lang: Lang) => (lang === "kk" ? h.reasonKk : h.reason);

export interface HoursPlan {
  ok: boolean;
  nClasses: number;
  sections: HoursSection[];
  totalPlanned: number;
  meanBefore: number;
  meanAfter: number;
  meanAfterConservative: number;
  lowBefore: number;
  lowAfter: number;
  movedHours: number;
}

export interface HeatCell {
  mean: number;
  n: number;
}

export type Flag = "below" | "above" | "none";

export interface SchoolSection {
  section: string;
  n: number;
  mean: number;
  /** ожидаемый результат при таком составе учеников и учебнике */
  expected: number;
  /** отклонение от ожидаемого после осторожного сдвига к среднему (п.п.) */
  residual: number;
  sd: number;
  flag: Flag;
  /** фактические часы на раздел (в среднем по классам школы) */
  hours: number;
}

export interface SchoolMentor {
  school: string;
  district: string;
  residual: number;
  sameDistrict: boolean;
  sameTextbook: boolean;
}

export interface SchoolProfile {
  school: string;
  district: string;
  urban: boolean | null;
  language: "каз" | "рус" | "смеш" | "неизвестно";
  textbooks: string[];
  nStudents: number;
  nClasses: number;
  mean: number;
  expected: number;
  lowShare: number;
  baseline: number;
  /** результат относительно ожидаемого по всем разделам (п.п.) */
  valueAdded: number;
  vaLo: number;
  vaHi: number;
  vaFlag: Flag;
  rank: number;
  sections: SchoolSection[];
  /** раздел → школы, у которых этот раздел получается лучше ожидаемого */
  mentors: Record<string, SchoolMentor[]>;
}

export interface Insight {
  tab: "sections" | "textbooks" | "hours";
  tone: "risk" | "info" | "good";
  title: string;
  text: string;
}

export interface Analysis {
  meta: {
    nStudents: number;
    nSchools: number;
    nClasses: number;
    nDistricts: number;
    sections: SectionInfo[];
    textbooks: string[];
    districts: string[];
  };
  overall: { mean: number; lowShare: number; highShare: number; levels: Record<Level, number> };
  sections: SectionStat[];
  heat: {
    byDistrict: { columns: string[]; cells: Record<string, Record<string, HeatCell>> };
    bySchool: { columns: string[]; cells: Record<string, Record<string, HeatCell>> };
  };
  prereqs: PrereqLink[];
  textbooks: TextbookAnalysis;
  hours: HoursPlan;
  schools: SchoolProfile[];
  insights: Insight[];
  /** для симулятора «что если» */
  forecast: (hours: number[]) => { perSection: number[]; mean: number; lowShare: number };
}

// ---------------------------------------------------------------- фильтры

/** Учебные годы/периоды в данных по возрастанию (пусто, если столбца нет). */
export function periodsOf(rows: Row[]): string[] {
  const set = new Set<string>();
  for (const r of rows) if (r.period) set.add(r.period);
  return [...set].sort((a, b) => a.localeCompare(b, "ru", { numeric: true }));
}

/** Строки последнего периода; строки без периода считаются текущими. */
export function latestPeriodRows(rows: Row[]): Row[] {
  const ps = periodsOf(rows);
  if (ps.length < 2) return rows;
  const last = ps[ps.length - 1];
  return rows.filter((r) => !r.period || r.period === last);
}

export function applyFilters(rows: Row[], f: Filters): Row[] {
  return rows.filter(
    (r) =>
      (f.district === "all" || r.district === f.district) &&
      (f.locality === "all" || r.locality === f.locality) &&
      (f.language === "all" || r.language === f.language),
  );
}

// ---------------------------------------------------------------- вспомогательное

function mode(a: number[]): number {
  const c = new Map<number, number>();
  for (const x of a) c.set(x, (c.get(x) ?? 0) + 1);
  let best = a[0];
  let bc = 0;
  for (const [k, v] of c) if (v > bc) [best, bc] = [k, v];
  return best;
}

function residualsOn(y: number[], xsAll: number[][]): number[] {
  const xs = xsAll.filter((col) => hasVariance(col));
  const X = y.map((_, i) => [1, ...xs.map((col) => col[i])]);
  const fit = ols(X, y);
  if (!fit.ok) return y.map((v) => v - mean(y));
  return y.map((v, i) => v - X[i].reduce((s, x, j) => s + x * fit.beta[j], 0));
}

function levelsOf(values: number[]): Record<Level, number> {
  const out: Record<Level, number> = { low: 0, mid: 0, good: 0, high: 0 };
  for (const v of values) out[levelOf(v)]++;
  const n = values.length || 1;
  for (const l of LEVEL_ORDER) out[l] /= n;
  return out;
}

function clusterMeanCI(values: { v: number; g: string }[]): Estimate {
  const m = mean(values.map((x) => x.v));
  const groups = [...groupBy(values, (x) => x.g).values()].map((g) => mean(g.map((x) => x.v)));
  const se = groups.length > 1 ? sd(groups) / Math.sqrt(groups.length) : NaN;
  return { mean: m, lo: m - Z * se, hi: m + Z * se };
}

const hasVariance = (a: number[]) => a.length > 1 && variance(a) > 1e-9;

// ---------------------------------------------------------------- главный расчёт

/** Различаем одинаковые названия школ в разных районах. */
export function disambiguateSchools(rows: Row[]): Row[] {
  const districts = new Map<string, Set<string>>();
  for (const r of rows) {
    const d = districts.get(r.school) ?? new Set<string>();
    d.add(r.district);
    districts.set(r.school, d);
  }
  return rows.map((r) => (districts.get(r.school)!.size > 1 ? { ...r, school: `${r.school} (${r.district})` } : r));
}

export function analyze(allRows: Row[]): Analysis | null {
  // Если в данных несколько учебных лет, основной анализ — по последнему (динамика — в dynamics.ts)
  const rows = latestPeriodRows(disambiguateSchools(allRows));
  if (rows.length === 0) return null;
  const baselineAvailable = rows.every((r) => !r.baselineMissing && Number.isFinite(r.baselinePct));

  // Разделы учебной программы
  const secGroups = groupBy(rows, (r) => r.section);
  const sections: SectionInfo[] = [...secGroups.entries()]
    .map(([name, rs]) => ({
      name,
      order: mode(rs.map((r) => r.sectionOrder)),
      planned: mode(rs.map((r) => r.plannedHours)),
    }))
    .sort((a, b) => a.order - b.order);
  const secNames = sections.map((s) => s.name);

  // Ученики и классы
  const students = new Map<string, Student>();
  const classes = new Map<string, ClassInfo>();
  const classHours = new Map<string, Map<string, number[]>>();
  for (const r of rows) {
    const studentKey = `${r.school}\0${r.classId}\0${r.studentId}`;
    const classKey = `${r.school}\0${r.classId}`;
    let st = students.get(studentKey);
    if (!st) {
      st = {
        id: studentKey,
        classId: classKey,
        school: r.school,
        district: r.district,
        urban: r.locality === "город" ? 1 : r.locality === "село" ? 0 : 0.5,
        rus: r.language === "рус" ? 1 : r.language === "каз" ? 0 : 0.5,
        textbook: r.textbook,
        baseline: baselineAvailable ? r.baselinePct : 50,
        pct: {},
      };
      students.set(studentKey, st);
    }
    st.pct[r.section] = r.maxScore > 0 ? (100 * r.score) / r.maxScore : NaN;
    let ch = classHours.get(classKey);
    if (!ch) classHours.set(classKey, (ch = new Map()));
    const h = ch.get(r.section);
    if (h) h.push(r.actualHours);
    else ch.set(r.section, [r.actualHours]);
  }
  for (const st of students.values()) {
    let c = classes.get(st.classId);
    if (!c) {
      const hoursMap = classHours.get(st.classId)!;
      const hours: Record<string, number> = {};
      for (const [sec, hs] of hoursMap) hours[sec] = mode(hs);
      c = { id: st.classId, school: st.school, urban: st.urban, rus: st.rus, textbook: st.textbook, hours, students: [] };
      classes.set(st.classId, c);
    }
    c.students.push(st);
  }
  const studentList = [...students.values()];
  const classList = [...classes.values()];
  const schoolDistrict = new Map(studentList.map((s) => [s.school, s.district]));
  const textbooks = [...new Set(studentList.map((s) => s.textbook))].sort((a, b) => a.localeCompare(b, "ru"));
  const districts = [...new Set(studentList.map((s) => s.district))].sort((a, b) =>
    isRegionCenter(a) ? -1 : isRegionCenter(b) ? 1 : a.localeCompare(b, "ru"),
  );

  // ---- Общая картина
  const allPct: number[] = [];
  for (const st of studentList) for (const s of secNames) if (Number.isFinite(st.pct[s])) allPct.push(st.pct[s]);
  const overallLevels = levelsOf(allPct);

  // ---- Статистика по разделам
  const schoolSecRaw = new Map<string, Map<string, { pct: number[]; res: number[] }>>();
  const studentRes = new Map<string, number[]>();
  const sectionStats: SectionStat[] = sections.map((sec) => {
    const sts = studentList.filter((st) => Number.isFinite(st.pct[sec.name]));
    const vals = sts.map((st) => st.pct[sec.name]);
    const ci = clusterMeanCI(sts.map((st) => ({ v: st.pct[sec.name], g: st.school })));
    // Остатки после учёта стартового уровня, типа местности и учебника:
    // разброс между школами, который не объясняется ни составом учеников, ни учебником
    const resid = residualsOn(vals, [
      sts.map((st) => st.baseline),
      sts.map((st) => st.urban),
      sts.map((st) => st.urban === 0.5 ? 1 : 0),
      ...textbooks.slice(1).map((t) => sts.map((st) => (st.textbook === t ? 1 : 0))),
    ]);
    sts.forEach((st, i) => {
      let m = schoolSecRaw.get(st.school);
      if (!m) schoolSecRaw.set(st.school, (m = new Map()));
      let e = m.get(sec.name);
      if (!e) m.set(sec.name, (e = { pct: [], res: [] }));
      e.pct.push(st.pct[sec.name]);
      e.res.push(resid[i]);
      const sr = studentRes.get(st.id);
      if (sr) sr.push(resid[i]);
      else studentRes.set(st.id, [resid[i]]);
    });
    const bySchool = groupBy(
      sts.map((st, i) => ({ st, r: resid[i] })),
      (x) => x.st.school,
    );
    const schoolDev: SchoolDeviation[] = [...bySchool.entries()]
      .filter(([, xs]) => xs.length >= 10)
      .map(([school, xs]) => ({
        school,
        district: schoolDistrict.get(school) ?? "",
        mean: mean(xs.map((x) => x.st.pct[sec.name])),
        residual: mean(xs.map((x) => x.r)),
        n: xs.length,
      }))
      .sort((a, b) => a.residual - b.residual);
    const levels = levelsOf(vals);
    return {
      ...sec,
      n: vals.length,
      mean: ci.mean,
      ciLo: ci.lo,
      ciHi: ci.hi,
      levels,
      lowShare: levels.low,
      icc: icc([...bySchool.values()].map((xs) => xs.map((x) => x.r))),
      status: "ok",
      uneven: false,
      systemic: false,
      worstSchools: schoolDev.slice(0, 3),
      bestSchools: schoolDev.slice(-3).reverse(),
    };
  });
  const medianIcc = [...sectionStats.map((s) => s.icc)].sort((a, b) => a - b)[Math.floor(sectionStats.length / 2)] ?? 0;
  for (const s of sectionStats) {
    s.status = s.mean < 50 || s.lowShare >= 0.35 ? "hard" : s.mean < 62 || s.lowShare >= 0.2 ? "watch" : "ok";
    s.uneven = s.icc >= Math.max(0.1, 1.6 * medianIcc);
    s.systemic = s.status === "hard" && !s.uneven;
  }

  // ---- Тепловые карты
  const heatFor = (key: (st: Student) => string, columns: string[]) => {
    const cells: Record<string, Record<string, HeatCell>> = {};
    for (const sec of secNames) {
      cells[sec] = {};
      const g = groupBy(
        studentList.filter((st) => Number.isFinite(st.pct[sec])),
        key,
      );
      for (const col of columns) {
        const xs = g.get(col) ?? [];
        cells[sec][col] = { mean: xs.length ? mean(xs.map((st) => st.pct[sec])) : NaN, n: xs.length };
      }
    }
    return { columns, cells };
  };
  const schoolsSorted = [...new Set(studentList.map((s) => s.school))].sort((a, b) => {
    const da = districts.indexOf(schoolDistrict.get(a) ?? "");
    const db = districts.indexOf(schoolDistrict.get(b) ?? "");
    return da - db || a.localeCompare(b, "ru");
  });

  // ---- Пререквизиты: какой ранее изученный раздел «тянет вниз» следующий
  const prereqs: PrereqLink[] = [];
  for (let j = 1; j < sections.length; j++) {
    const to = sections[j].name;
    let best: PrereqLink | null = null;
    for (let i = 0; i < j; i++) {
      const from = sections[i].name;
      const others = secNames.filter((s) => s !== from && s !== to);
      const sts = studentList.filter((st) => Number.isFinite(st.pct[from]) && Number.isFinite(st.pct[to]));
      if (sts.length < 60) continue;
      const ability = sts.map((st) => {
        const o = others.map((s) => st.pct[s]).filter(Number.isFinite);
        return o.length ? mean(o) : st.baseline;
      });
      const ctrl = [sts.map((st) => st.baseline), ability];
      const rp = residualsOn(sts.map((st) => st.pct[from]), ctrl);
      const rs = residualsOn(sts.map((st) => st.pct[to]), ctrl);
      const pc = correlation(rp, rs);
      const vp = variance(rp);
      const gamma = vp > 0 ? mean(rp.map((x, k) => x * rs[k])) / vp : 0;
      const weak = sts.filter((st) => st.pct[from] < 40);
      const strong = sts.filter((st) => st.pct[from] >= 65);
      const link: PrereqLink = {
        from,
        to,
        partialCorr: pc,
        gamma: clamp(gamma, 0, 1),
        failIfWeak: weak.length ? weak.filter((st) => st.pct[to] < 40).length / weak.length : NaN,
        failIfStrong: strong.length ? strong.filter((st) => st.pct[to] < 40).length / strong.length : NaN,
        nWeak: weak.length,
        nStrong: strong.length,
      };
      if (!best || link.partialCorr > best.partialCorr) best = link;
    }
    if (best && best.partialCorr >= 0.15 && best.gamma > 0.05) prereqs.push(best);
  }

  // ---- Учебники: «сырое» сравнение и сравнение с поправкой на состав учеников
  const textbookAnalysis = analyzeTextbooks(studentList, classList, sections, textbooks);

  // ---- Учебные часы
  const { plan: hoursPlan, forecast } = planHours(studentList, classList, sections, sectionStats, prereqs, textbooks);

  // ---- Профили школ: результат относительно ожидаемого при их составе учеников
  const schools = buildSchoolProfiles(studentList, classList, sections, schoolSecRaw, studentRes, schoolDistrict);
  if (!baselineAvailable) {
    for (const school of schools) school.baseline = NaN;
    for (const textbook of textbookAnalysis.rows) textbook.meanBaseline = NaN;
  }

  const analysis: Analysis = {
    meta: {
      nStudents: studentList.length,
      nSchools: new Set(studentList.map((s) => s.school)).size,
      nClasses: classList.length,
      nDistricts: districts.length,
      sections,
      textbooks,
      districts,
    },
    overall: {
      mean: mean(allPct),
      lowShare: overallLevels.low,
      highShare: overallLevels.high,
      levels: overallLevels,
    },
    sections: sectionStats,
    heat: {
      byDistrict: heatFor((st) => st.district, districts),
      bySchool: heatFor((st) => st.school, schoolsSorted),
    },
    prereqs,
    textbooks: textbookAnalysis,
    hours: hoursPlan,
    schools,
    insights: [],
    forecast,
  };
  analysis.insights = buildInsights(analysis);
  return analysis;
}

// ---------------------------------------------------------------- школы

/**
 * Осторожная оценка отклонений: у небольших школ случайный разброс велик,
 * поэтому их отклонение сдвигается к нулю пропорционально надёжности
 * (эмпирический Байес). Возвращает оценку и её погрешность.
 */
function shrink(items: { raw: number; se: number }[]) {
  const ok = items.filter((x) => Number.isFinite(x.raw) && Number.isFinite(x.se) && x.se > 0);
  const tau2 = ok.length > 2 ? Math.max(0, variance(ok.map((x) => x.raw)) - mean(ok.map((x) => x.se ** 2))) : 0;
  return items.map((x) => {
    if (!Number.isFinite(x.raw) || !Number.isFinite(x.se) || x.se <= 0) return { est: NaN, sd: NaN };
    const b = tau2 / (tau2 + x.se ** 2);
    return { est: b * x.raw, sd: Math.sqrt(b) * x.se };
  });
}

const flagOf = (est: number, sd: number, min: number): Flag =>
  !Number.isFinite(est) || !Number.isFinite(sd)
    ? "none"
    : est <= -min && est + Z * sd < 0
      ? "below"
      : est >= min && est - Z * sd > 0
        ? "above"
        : "none";

function buildSchoolProfiles(
  students: Student[],
  classes: ClassInfo[],
  sections: SectionInfo[],
  raw: Map<string, Map<string, { pct: number[]; res: number[] }>>,
  studentRes: Map<string, number[]>,
  schoolDistrict: Map<string, string>,
): SchoolProfile[] {
  const secNames = sections.map((s) => s.name);
  const bySchool = groupBy(students, (s) => s.school);
  const classesBySchool = groupBy(classes, (c) => c.school);
  const names = [...bySchool.keys()];

  // Отклонения по разделам, с осторожным сдвигом к среднему внутри каждого раздела
  const secEst = new Map<string, Map<string, { raw: number; est: number; sd: number; n: number; mean: number }>>();
  for (const sec of secNames) {
    const items = names.map((sch) => {
      const e = raw.get(sch)?.get(sec);
      if (!e || e.res.length < 5) return { sch, raw: NaN, se: NaN, n: e?.res.length ?? 0, mean: e ? mean(e.pct) : NaN };
      return { sch, raw: mean(e.res), se: sd(e.res) / Math.sqrt(e.res.length), n: e.res.length, mean: mean(e.pct) };
    });
    const sh = shrink(items);
    items.forEach((it, i) => {
      let m = secEst.get(it.sch);
      if (!m) secEst.set(it.sch, (m = new Map()));
      m.set(sec, { raw: it.raw, est: sh[i].est, sd: sh[i].sd, n: it.n, mean: it.mean });
    });
  }

  // Общий результат относительно ожидаемого (по всем разделам)
  const vaItems = names.map((sch) => {
    const per = bySchool
      .get(sch)!
      .map((st) => studentRes.get(st.id) ?? [])
      .filter((r) => r.length > 0)
      .map((r) => mean(r));
    return per.length >= 5 ? { raw: mean(per), se: sd(per) / Math.sqrt(per.length) } : { raw: NaN, se: NaN };
  });
  const vaSh = shrink(vaItems);

  const profiles: SchoolProfile[] = names.map((sch, i) => {
    const sts = bySchool.get(sch)!;
    const cls = classesBySchool.get(sch) ?? [];
    const overall = sts
      .map((st) => {
        const v = secNames.map((s) => st.pct[s]).filter(Number.isFinite);
        return v.length ? mean(v) : NaN;
      })
      .filter(Number.isFinite);
    const allVals = sts.flatMap((st) => secNames.map((s) => st.pct[s]).filter(Number.isFinite));
    const rusShare = mean(sts.map((st) => st.rus));
    const schoolMean = mean(overall);
    return {
      school: sch,
      district: schoolDistrict.get(sch) ?? "",
      urban: sts.some((st) => st.urban === 0.5) ? null : mean(sts.map((st) => st.urban)) >= 0.5,
      language: sts.some((st) => st.rus === 0.5) ? "неизвестно" : rusShare >= 0.95 ? "рус" : rusShare <= 0.05 ? "каз" : "смеш",
      textbooks: [...new Set(sts.map((st) => st.textbook))].sort((a, b) => a.localeCompare(b, "ru")),
      nStudents: sts.length,
      nClasses: cls.length,
      mean: schoolMean,
      expected: Number.isFinite(vaItems[i].raw) ? schoolMean - vaItems[i].raw : NaN,
      lowShare: allVals.length ? allVals.filter((v) => v < 40).length / allVals.length : NaN,
      baseline: mean(sts.map((st) => st.baseline)),
      valueAdded: vaSh[i].est,
      vaLo: vaSh[i].est - Z * vaSh[i].sd,
      vaHi: vaSh[i].est + Z * vaSh[i].sd,
      vaFlag: flagOf(vaSh[i].est, vaSh[i].sd, 3),
      rank: 0,
      sections: sections.map((sec) => {
        const e = secEst.get(sch)?.get(sec.name);
        const hs = cls.map((c) => c.hours[sec.name]).filter(Number.isFinite);
        return {
          section: sec.name,
          n: e?.n ?? 0,
          mean: e?.mean ?? NaN,
          expected: e && Number.isFinite(e.raw) ? e.mean - e.raw : NaN,
          residual: e?.est ?? NaN,
          sd: e?.sd ?? NaN,
          flag: e ? flagOf(e.est, e.sd, 5) : "none",
          hours: hs.length ? mean(hs) : NaN,
        };
      }),
      mentors: {},
    };
  });

  // Место по результату относительно ожидаемого
  [...profiles]
    .filter((p) => Number.isFinite(p.valueAdded))
    .sort((a, b) => b.valueAdded - a.valueAdded)
    .forEach((p, k) => (p.rank = k + 1));

  // Школы-наставники: у кого «проседающий» раздел получается лучше ожидаемого
  for (const p of profiles) {
    for (const s of p.sections) {
      if (s.flag !== "below") continue;
      const cands = profiles
        .filter((q) => q !== p)
        .map((q) => ({ q, s: q.sections.find((x) => x.section === s.section)! }))
        .filter((x) => x.s.flag === "above");
      p.mentors[s.section] = cands
        .map(({ q, s: qs }) => ({
          school: q.school,
          district: q.district,
          residual: qs.residual,
          sameDistrict: q.district === p.district,
          sameTextbook: q.textbooks.some((t) => p.textbooks.includes(t)),
        }))
        .sort(
          (a, b) =>
            Number(b.sameDistrict) - Number(a.sameDistrict) ||
            Number(b.sameTextbook) - Number(a.sameTextbook) ||
            b.residual - a.residual,
        )
        .slice(0, 3);
    }
  }

  return profiles.sort((a, b) => (a.rank || 1e9) - (b.rank || 1e9));
}

// ---------------------------------------------------------------- учебники

function designMatrix(
  items: { baseline: number; urban: number; rus: number; textbook: string; extra?: number[] }[],
  textbooks: string[],
  ref: string,
) {
  type Item = (typeof items)[number];
  const cols: { name: string; get: (x: Item, tb: string) => number }[] = [{ name: "const", get: () => 1 }];
  const mb = mean(items.map((x) => x.baseline));
  if (hasVariance(items.map((x) => x.baseline))) cols.push({ name: "baseline", get: (x) => x.baseline - mb });
  if (hasVariance(items.map((x) => x.urban))) cols.push({ name: "urban", get: (x) => x.urban });
  if (hasVariance(items.map((x) => Number(x.urban === 0.5)))) cols.push({ name: "urban_missing", get: (x) => Number(x.urban === 0.5) });
  if (hasVariance(items.map((x) => x.rus))) cols.push({ name: "rus", get: (x) => x.rus });
  if (hasVariance(items.map((x) => Number(x.rus === 0.5)))) cols.push({ name: "language_missing", get: (x) => Number(x.rus === 0.5) });
  const nExtra = items[0]?.extra?.length ?? 0;
  for (let k = 0; k < nExtra; k++)
    if (hasVariance(items.map((x) => x.extra![k]))) cols.push({ name: `extra${k}`, get: (x) => x.extra![k] });
  for (const t of textbooks.filter((t) => t !== ref)) cols.push({ name: `tb:${t}`, get: (_, tb) => (tb === t ? 1 : 0) });
  const row = (x: Item, tb: string) => cols.map((c) => c.get(x, tb));
  const X = items.map((x) => row(x, x.textbook));
  const index = (name: string) => cols.findIndex((c) => c.name === name);
  const tbIndex = (t: string) => (t === ref ? -1 : index(`tb:${t}`));
  // «Средний» профиль учеников, к которому приводятся все учебники
  const avgProfile = (tb: string) => {
    const k = X[0].length;
    const c = Array(k).fill(0);
    for (const x of items) {
      const r = row(x, tb);
      for (let j = 0; j < k; j++) c[j] += r[j] / items.length;
    }
    return c;
  };
  return { X, tbIndex, avgProfile, index };
}

function analyzeTextbooks(
  students: Student[],
  classes: ClassInfo[],
  sections: SectionInfo[],
  textbooks: string[],
): TextbookAnalysis {
  const empty: TextbookAnalysis = {
    ok: false,
    rows: [],
    naiveRank: [],
    adjustedRank: [],
    rankChanged: false,
    best: null,
    bestMargin: 0,
    bestSignificant: false,
    matrix: [],
    lags: [],
  };
  if (textbooks.length < 2) return empty;
  const secNames = sections.map((s) => s.name);
  const items = students
    .map((st) => {
      const v = secNames.map((s) => st.pct[s]).filter(Number.isFinite);
      return { ...st, overall: v.length ? mean(v) : NaN };
    })
    .filter((x) => Number.isFinite(x.overall));
  const counts = new Map(textbooks.map((t) => [t, items.filter((x) => x.textbook === t).length]));
  const ref = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
  const { X, tbIndex, avgProfile } = designMatrix(items, textbooks, ref);
  const fit = ols(
    X,
    items.map((x) => x.overall),
    items.map((x) => x.school),
  );
  if (!fit.ok) return empty;

  const rows: TextbookRow[] = textbooks.map((t) => {
    const its = items.filter((x) => x.textbook === t);
    const c = avgProfile(t);
    const m = c.reduce((s, v, j) => s + v * fit.beta[j], 0);
    const se = Math.sqrt(linCombVar(fit.cov, c));
    const nSchools = new Set(its.map((x) => x.school)).size;
    return {
      name: t,
      nSchools,
      nStudents: its.length,
      urbanShare: mean(its.map((x) => x.urban)),
      meanBaseline: mean(its.map((x) => x.baseline)),
      naive: clusterMeanCI(its.map((x) => ({ v: x.overall, g: x.school }))),
      adjusted: { mean: m, lo: m - Z * se, hi: m + Z * se },
      enough: nSchools >= 3 && its.length >= 40,
    };
  });
  const valid = rows.filter((r) => r.enough);
  const naiveRank = [...valid].sort((a, b) => b.naive.mean - a.naive.mean).map((r) => r.name);
  const adjustedRank = [...valid].sort((a, b) => b.adjusted.mean - a.adjusted.mean).map((r) => r.name);

  // Значимость отрыва лидера от второго места
  let bestSignificant = false;
  let bestMargin = 0;
  if (adjustedRank.length >= 2) {
    const [b1, b2] = adjustedRank;
    const c = Array(X[0].length).fill(0);
    if (tbIndex(b1) >= 0) c[tbIndex(b1)] += 1;
    if (tbIndex(b2) >= 0) c[tbIndex(b2)] -= 1;
    const diff = c.reduce((s, v, j) => s + v * fit.beta[j], 0);
    const se = Math.sqrt(linCombVar(fit.cov, c));
    bestMargin = diff;
    bestSignificant = se > 0 && diff / se > Z;
  }

  // Матрица «учебник × раздел» с поправкой на состав учеников и фактические часы
  const classById = new Map(classes.map((c) => [c.id, c]));
  const matrix: TextbookCell[] = [];
  for (const sec of sections) {
    const its = students
      .filter((st) => Number.isFinite(st.pct[sec.name]))
      .map((st) => {
        const h = classById.get(st.classId)?.hours[sec.name] ?? sec.planned;
        return { ...st, y: st.pct[sec.name], extra: [sec.planned > 0 ? Math.log(Math.max(1, h) / sec.planned) : 0] };
      });
    const present = textbooks.filter((t) => valid.some((v) => v.name === t) && its.some((x) => x.textbook === t));
    if (present.length < 2) continue;
    const secRef = present.includes(ref) ? ref : present[0];
    const sub = its.filter((x) => present.includes(x.textbook));
    const dm = designMatrix(sub, present, secRef);
    const f = ols(
      dm.X,
      sub.map((x) => x.y),
      sub.map((x) => x.school),
    );
    if (!f.ok) continue;
    const adj = present.map((t) => {
      const c = dm.avgProfile(t);
      return { t, m: c.reduce((s, v, j) => s + v * f.beta[j], 0) };
    });
    const best = adj.reduce((a, b) => (b.m > a.m ? b : a));
    for (const a of adj) {
      const c = Array(dm.X[0].length).fill(0);
      if (dm.tbIndex(a.t) >= 0) c[dm.tbIndex(a.t)] += 1;
      if (dm.tbIndex(best.t) >= 0) c[dm.tbIndex(best.t)] -= 1;
      const se = Math.sqrt(linCombVar(f.cov, c));
      const diff = a.m - best.m;
      const z = se > 0 ? diff / se : 0;
      matrix.push({
        textbook: a.t,
        section: sec.name,
        adjMean: a.m,
        diffVsBest: diff,
        excess: 0,
        z,
        flag: a.t === best.t ? "best" : "none",
      });
    }
  }
  // «Слабая глава»: учебник отстаёт в разделе заметно сильнее, чем обычно отстаёт в остальных
  for (const t of textbooks) {
    const cells = matrix.filter((c) => c.textbook === t);
    if (cells.length < 3) continue;
    const ds = cells.map((c) => c.diffVsBest).sort((x, y) => x - y);
    const med = ds[Math.floor(ds.length / 2)];
    for (const c of cells) {
      c.excess = c.diffVsBest - med;
      if (c.flag !== "best" && c.excess <= -6 && c.z <= -Z) c.flag = "lag";
    }
  }

  return {
    ok: valid.length >= 2,
    rows,
    naiveRank,
    adjustedRank,
    rankChanged: naiveRank.join("|") !== adjustedRank.join("|"),
    best: adjustedRank[0] ?? null,
    bestMargin,
    bestSignificant,
    matrix,
    lags: matrix.filter((c) => c.flag === "lag").sort((a, b) => a.excess - b.excess),
  };
}

// ---------------------------------------------------------------- учебные часы

function planHours(
  students: Student[],
  classes: ClassInfo[],
  sections: SectionInfo[],
  stats: SectionStat[],
  prereqs: PrereqLink[],
  textbooks: string[],
) {
  const secNames = sections.map((s) => s.name);
  const ref = textbooks[0];

  // 1. Отдача от часов по каждому разделу: сравниваем классы, где на раздел
  //    фактически потратили больше/меньше часов, при равном стартовом уровне.
  const est = sections.map((sec) => {
    const cls = classes
      .map((c) => {
        const vals = c.students.map((st) => st.pct[sec.name]).filter(Number.isFinite);
        const h = c.hours[sec.name];
        return {
          school: c.school,
          urban: c.urban,
          rus: c.rus,
          textbook: c.textbook,
          baseline: mean(c.students.map((st) => st.baseline)),
          y: vals.length ? mean(vals) : NaN,
          extra: [Math.log(Math.max(1, h ?? sec.planned) / sec.planned)],
          n: vals.length,
        };
      })
      .filter((c) => Number.isFinite(c.y) && c.n >= 5);
    if (sec.planned <= 0 || cls.length < 15 || !hasVariance(cls.map((c) => c.extra[0])))
      return { beta: 0, se: Infinity, n: cls.length };
    const tbs = textbooks.filter((t) => cls.some((c) => c.textbook === t));
    const dm = designMatrix(cls, tbs, tbs.includes(ref) ? ref : tbs[0]);
    const f = ols(
      dm.X,
      cls.map((c) => c.y),
      cls.map((c) => c.school),
    );
    const idx = dm.index("extra0");
    if (!f.ok || idx < 0) return { beta: 0, se: Infinity, n: cls.length };
    return { beta: f.beta[idx], se: f.se[idx], n: cls.length };
  });
  const nClasses = Math.max(0, ...est.map((e) => e.n));
  const ok = est.some((e) => Number.isFinite(e.se));

  const planned = sections.map((s) => s.planned);
  // Ограничения: разделы в зоне риска часы не отдают; если влияние часов
  // доказано, сокращаем не более чем на 10%, иначе — не более чем на 20%.
  const lo = sections.map((s, i) => {
    const e = est[i];
    if (stats[i].mean < 55 || !Number.isFinite(e.se)) return s.planned;
    const sig = Number.isFinite(e.se) && e.beta - Z * e.se > 0;
    return Math.round(s.planned * (sig ? 0.9 : 0.8));
  });
  const hi = planned.map((p, i) => Number.isFinite(est[i].se) ? Math.round(p * 1.3) : p);
  const means = stats.map((s) => s.mean);
  const links = prereqs.map((l) => ({ from: secNames.indexOf(l.from), to: secNames.indexOf(l.to), gamma: l.gamma }));

  const betaPoint = est.map((e) => (Number.isFinite(e.se) ? Math.max(0, e.beta) : 0));
  const betaGain = est.map((e) => (Number.isFinite(e.se) ? Math.max(0, e.beta - e.se) : 0));
  const betaLoss = est.map((e) => (Number.isFinite(e.se) ? Math.max(0, e.beta + e.se) : 0));

  const deltas = (hours: number[], conservative: boolean) => {
    const total = Array(sections.length).fill(0);
    for (let i = 0; i < sections.length; i++) {
      const b = conservative ? (hours[i] >= planned[i] ? betaGain[i] : betaLoss[i]) : betaPoint[i];
      let d = planned[i] > 0 ? b * Math.log(Math.max(1, hours[i]) / planned[i]) : 0;
      for (const l of links) if (l.to === i && l.from < i) d += l.gamma * total[l.from];
      total[i] = clamp(d, -means[i], 98 - means[i]);
    }
    return total;
  };
  const objective = (hours: number[]) => mean(deltas(hours, true));

  // 2. Жадное перераспределение: переносим по 1 часу туда, где выигрыш
  //    по консервативной оценке больше потерь, при неизменной сумме часов.
  const hours = [...planned];
  if (ok) {
    for (let iter = 0; iter < 80; iter++) {
      const cur = objective(hours);
      let bestGain = 0.03;
      let move: [number, number] | null = null;
      for (let d = 0; d < hours.length; d++) {
        if (hours[d] - 1 < lo[d]) continue;
        for (let r = 0; r < hours.length; r++) {
          if (r === d || hours[r] + 1 > hi[r]) continue;
          hours[d]--;
          hours[r]++;
          const g = objective(hours) - cur;
          hours[d]++;
          hours[r]--;
          if (g > bestGain) {
            bestGain = g;
            move = [d, r];
          }
        }
      }
      if (!move) break;
      hours[move[0]]--;
      hours[move[1]]++;
    }
  }

  // 3. Прогноз: как изменится результат каждого ученика
  const forecast = (h: number[]) => {
    const dl = deltas(h, false);
    let low = 0;
    let cnt = 0;
    for (const st of students)
      secNames.forEach((s, i) => {
        const v = st.pct[s];
        if (!Number.isFinite(v)) return;
        cnt++;
        if (v + dl[i] < 40) low++;
      });
    return { perSection: dl, mean: mean(means.map((m, i) => m + dl[i])), lowShare: cnt ? low / cnt : 0 };
  };
  const before = forecast(planned);
  const after = forecast(hours);
  const consDl = deltas(hours, true);

  const fmt = (x: number) => x.toFixed(1).replace(".", ",");
  const receiverPerHour = Math.max(
    0,
    ...sections.map((s, i) => (hours[i] > s.planned ? betaPoint[i] * Math.log((s.planned + 1) / s.planned) : 0)),
  );
  const hs: HoursSection[] = sections.map((sec, i) => {
    const e = est[i];
    const perHour = sec.planned > 0 ? betaPoint[i] * Math.log((sec.planned + 1) / sec.planned) : 0;
    const significant = Number.isFinite(e.se) && e.beta - Z * e.se > 0;
    const dependents = prereqs.filter((l) => l.from === sec.name).map((l) => l.to);
    const delta = hours[i] - sec.planned;
    const reasonIn = (lang: Lang) => {
      const t = (ru: string, kk: string) => tr(lang, ru, kk);
      const u = t("п.п.", "п.т.");
      if (!Number.isFinite(e.se) || sec.planned <= 0)
        return t("Недостаточно данных о фактических часах — оставляем по плану.", "Нақты сағаттар туралы дерек жеткіліксіз — жоспар бойынша қалдырамыз.");
      if (delta > 0)
        return (
          t(`Высокая отдача: +1 час ≈ +${fmt(perHour)} ${u} к результату раздела`, `Қайтарымы жоғары: +1 сағат ≈ бөлім нәтижесіне +${fmt(perHour)} ${u}`) +
          (dependents.length
            ? t(
                `; раздел — фундамент для «${dependents.join("», «")}», эффект переносится дальше.`,
                `; бөлім «${dependents.join("», «")}» үшін негіз, әсері әрі қарай беріледі.`,
              )
            : ".")
        );
      if (delta < 0)
        return t(
          `Отдача от часов ниже (+1 час ≈ +${fmt(perHour)} ${u} против +${fmt(receiverPerHour)} ${u} у приоритетных разделов), раздел освоен на ${Math.round(
            stats[i].mean,
          )}% — часть часов можно передать.`,
          `Сағат қайтарымы төмен (+1 сағат ≈ +${fmt(perHour)} ${u}, басым бөлімдерде +${fmt(receiverPerHour)} ${u}), бөлім ${Math.round(
            stats[i].mean,
          )}%-ға меңгерілген — сағаттың бір бөлігін беруге болады.`,
        );
      if (stats[i].mean < 55) return t("Раздел в зоне риска — часы не сокращаем.", "Бөлім тәуекел аймағында — сағаттарды қысқартпаймыз.");
      return significant
        ? t("Часы влияют на результат, но перенос не даёт выигрыша — оставить как есть.", "Сағаттар нәтижеге әсер етеді, бірақ ауыстыру ұтыс бермейді — өзгеріссіз қалдыру.")
        : t("Без изменений.", "Өзгеріссіз.");
    };
    const reason = reasonIn("ru");
    const reasonKk = reasonIn("kk");
    return {
      ...sec,
      beta: e.beta,
      se: e.se,
      perHour,
      significant,
      lo: lo[i],
      hi: hi[i],
      recommended: hours[i],
      delta,
      gain: after.perSection[i],
      dependents,
      reason,
      reasonKk,
    };
  });

  const plan: HoursPlan = {
    ok,
    nClasses,
    sections: hs,
    totalPlanned: planned.reduce((a, b) => a + b, 0),
    meanBefore: before.mean,
    meanAfter: after.mean,
    meanAfterConservative: mean(means.map((m, i) => m + consDl[i])),
    lowBefore: before.lowShare,
    lowAfter: after.lowShare,
    movedHours: hs.reduce((s, h) => s + Math.max(0, h.delta), 0),
  };
  return { plan, forecast };
}

// ---------------------------------------------------------------- выводы

export function buildInsights(a: Analysis, lang: Lang = "ru"): Insight[] {
  const out: Insight[] = [];
  const t = (ru: string, kk: string) => tr(lang, ru, kk);
  const pct = (x: number) => `${Math.round(x)}%`;
  const share = (x: number) => `${Math.round(100 * x)}%`;
  const u = t("п.п.", "п.т.");
  const pp = (x: number) => `${x >= 0 ? "+" : "−"}${Math.abs(x).toFixed(1).replace(".", ",")} ${u}`;

  const hardest = [...a.sections].sort((x, y) => x.mean - y.mean)[0];
  if (hardest && hardest.status !== "ok") {
    out.push({
      tab: "sections",
      tone: "risk",
      title: t(`Самый трудный раздел — «${hardest.name}»`, `Ең қиын бөлім — «${hardest.name}»`),
      text:
        t(
          `Средний результат ${pct(hardest.mean)}, у ${share(hardest.lowShare)} учащихся ниже 40%. `,
          `Орташа нәтиже ${pct(hardest.mean)}, оқушылардың ${share(hardest.lowShare)}-ы 40%-дан төмен. `,
        ) +
        (hardest.systemic
          ? t(
              "Проседает во всех школах — проблема системная (программа, учебник, часы), а не в отдельных учителях.",
              "Барлық мектепте төмен — мәселе жүйелі (бағдарлама, оқулық, сағаттар), жекелеген мұғалімдерде емес.",
            )
          : ""),
    });
  }
  const rootLink = a.prereqs
    .filter((l) => a.sections.find((s) => s.name === l.to)?.status !== "ok")
    .sort((x, y) => y.partialCorr - x.partialCorr)[0];
  if (rootLink && Number.isFinite(rootLink.failIfWeak) && Number.isFinite(rootLink.failIfStrong)) {
    out.push({
      tab: "sections",
      tone: "info",
      title: t(`Возможная связь с разделом «${rootLink.from}»`, `Ықтимал байланыс — «${rootLink.from}»`),
      text: t(
        `Среди не освоивших «${rootLink.from}» ${share(rootLink.failIfWeak)} не справились и с «${rootLink.to}», среди освоивших — только ${share(
          rootLink.failIfStrong,
        )}. Связь стоит проверить с методистом.`,
        `«${rootLink.from}» бөлімін меңгермегендердің ${share(rootLink.failIfWeak)}-ы «${rootLink.to}» бөлімін де орындай алмады, меңгергендердің арасында — тек ${share(
          rootLink.failIfStrong,
        )}. Байланысты әдіскермен бірге тексеру қажет.`,
      ),
    });
  }
  const tb = a.textbooks;
  if (tb.ok && tb.best) {
    const naiveTop = tb.naiveRank[0];
    const bestRow = tb.rows.find((r) => r.name === tb.best)!;
    if (tb.rankChanged && naiveTop !== tb.best) {
      out.push({
        tab: "textbooks",
        tone: "info",
        title: t("Сырые баллы вводят в заблуждение", "Шикі балдар адастырады"),
        text: t(
          `По средним баллам лидирует «${naiveTop}», но им чаще пользуются сильные городские школы. С учётом стартового уровня учеников лучший результат у «${tb.best}» (${pct(
            bestRow.adjusted.mean,
          )}).`,
          `Орташа балл бойынша «${naiveTop}» алда, бірақ оны күшті қалалық мектептер жиі пайдаланады. Оқушылардың бастапқы деңгейін ескергенде ең жақсы нәтиже — «${tb.best}» (${pct(
            bestRow.adjusted.mean,
          )}).`,
        ),
      });
    } else {
      out.push({
        tab: "textbooks",
        tone: "good",
        title: t(`Лучший учебник по результатам — «${tb.best}»`, `Нәтиже бойынша ең жақсы оқулық — «${tb.best}»`),
        text: tb.bestSignificant
          ? t(
              `Отрыв от второго места ${pp(tb.bestMargin)} с учётом стартового уровня учеников — различие статистически надёжно.`,
              `Оқушылардың бастапқы деңгейін ескергенде екінші орыннан айырмасы ${pp(tb.bestMargin)} — айырма статистикалық тұрғыда сенімді.`,
            )
          : t(
              `Но отрыв от второго места (${pp(tb.bestMargin)}) в пределах погрешности — менять учебник только из-за этого не стоит.`,
              `Бірақ екінші орыннан айырмасы (${pp(tb.bestMargin)}) қателік шегінде — тек осы себеппен оқулықты ауыстырудың қажеті жоқ.`,
            ),
      });
    }
  }
  const lag = tb.lags[0];
  if (lag) {
    const gap = `${Math.abs(lag.diffVsBest).toFixed(1).replace(".", ",")} ${u}`;
    out.push({
      tab: "textbooks",
      tone: "risk",
      title: t(`«${lag.textbook}» отстаёт в разделе «${lag.section}»`, `«${lag.textbook}» «${lag.section}» бөлімінде артта қалады`),
      text: t(
        `На ${gap} ниже лучшего учебника при равном составе учеников. Достаточно дополнительных материалов к этой главе, менять учебник целиком не обязательно.`,
        `Оқушылар құрамы бірдей болғанда ең жақсы оқулықтан ${gap} төмен. Осы тарауға қосымша материалдар жеткілікті, оқулықты толық ауыстыру міндетті емес.`,
      ),
    });
  }
  const h = a.hours;
  if (h.ok && h.movedHours > 0) {
    const up = h.sections.filter((s) => s.delta > 0).map((s) => `«${s.name}» +${s.delta}`);
    out.push({
      tab: "hours",
      tone: "good",
      title: t(
        `Модель оценивает эффект ${h.movedHours} ч: ${pp(h.meanAfter - h.meanBefore)}`,
        `${h.movedHours} сағатты қайта бөлу ${pp(h.meanAfter - h.meanBefore)} береді`,
      ),
      text: t(
        `${up.join(", ")} — за счёт разделов с низкой отдачей от часов. Доля результатов ниже 40% снизится с ${share(h.lowBefore)} до ${share(h.lowAfter)}. Общий объём часов не меняется.`,
        `${up.join(", ")} — сағат қайтарымы төмен бөлімдер есебінен. 40%-дан төмен нәтижелер үлесі ${share(h.lowBefore)}-дан ${share(h.lowAfter)}-ға дейін азаяды. Сағаттардың жалпы көлемі өзгермейді.`,
      ),
    });
  }
  const uneven = a.sections.filter((s) => s.uneven).sort((x, y) => y.icc - x.icc)[0];
  if (uneven) {
    out.push({
      tab: "sections",
      tone: "info",
      title: t(`«${uneven.name}» сильно зависит от школы`, `«${uneven.name}» мектепке қатты тәуелді`),
      text: t(
        "Разброс между школами выше, чем по другим разделам, даже с учётом уровня учеников и учебника. Причины различий требуют дополнительной проверки. Нужна адресная методическая помощь школам с низким результатом и обмен опытом с лучшими.",
        "Мектептер арасындағы алшақтық басқа бөлімдерге қарағанда жоғары, тіпті оқушылар деңгейі мен оқулықты ескергенде де. Айырмашылық себептерін қосымша тексеру қажет. Нәтижесі төмен мектептерге атаулы әдістемелік көмек және үздік мектептермен тәжірибе алмасу қажет.",
      ),
    });
  }
  return out;
}
