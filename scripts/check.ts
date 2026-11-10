// Проверка аналитики на демо-данных: находит ли платформа то, что заложено в генератор.
import { generateDemo } from "../src/lib/generator";
import { analyze, applyFilters } from "../src/lib/analytics";

const f = (x: number, d = 1) => (Number.isFinite(x) ? x.toFixed(d) : "—");

for (const seed of [2026, 7, 42]) {
  const ds = generateDemo(seed);
  const t0 = Date.now();
  const a = analyze(ds.rows)!;
  console.log(`\n===== seed ${seed}: ${ds.rows.length} rows, ${a.meta.nStudents} students, ${a.meta.nSchools} schools, ${a.meta.nClasses} classes, ${Date.now() - t0} ms`);
  console.log(`overall mean ${f(a.overall.mean)}  low ${f(100 * a.overall.lowShare)}%`);
  for (const s of a.sections)
    console.log(`  ${s.name.padEnd(32)} mean ${f(s.mean)} [${f(s.ciLo)}–${f(s.ciHi)}] low ${f(100 * s.lowShare)}% icc ${f(s.icc, 3)} ${s.status}${s.uneven ? " UNEVEN" : ""}${s.systemic ? " SYSTEMIC" : ""}`);
  console.log("prereqs:");
  for (const l of a.prereqs)
    console.log(`  ${l.from} → ${l.to}: pc ${f(l.partialCorr, 3)} gamma ${f(l.gamma, 2)} fail weak ${f(100 * l.failIfWeak)}% strong ${f(100 * l.failIfStrong)}%`);
  console.log("textbooks:");
  for (const r of a.textbooks.rows)
    console.log(`  ${r.name}: schools ${r.nSchools} urban ${f(100 * r.urbanShare)}% base ${f(r.meanBaseline)} naive ${f(r.naive.mean)} adj ${f(r.adjusted.mean)} [${f(r.adjusted.lo)}–${f(r.adjusted.hi)}]`);
  console.log(`  naive ${a.textbooks.naiveRank.join(" > ")} | adjusted ${a.textbooks.adjustedRank.join(" > ")} | margin ${f(a.textbooks.bestMargin)} sig ${a.textbooks.bestSignificant}`);
  for (const l of a.textbooks.lags) console.log(`  LAG ${l.textbook} @ ${l.section}: ${f(l.diffVsBest)} z ${f(l.z, 2)}`);
  console.log("hours:");
  for (const h of a.hours.sections)
    console.log(`  ${h.name.padEnd(32)} beta ${f(h.beta)} se ${f(h.se)} perHour ${f(h.perHour, 2)} ${h.planned} → ${h.recommended} (${h.delta >= 0 ? "+" : ""}${h.delta}) gain ${f(h.gain, 2)}`);
  console.log(`  mean ${f(a.hours.meanBefore)} → ${f(a.hours.meanAfter)} (cons ${f(a.hours.meanAfterConservative)}), low ${f(100 * a.hours.lowBefore)}% → ${f(100 * a.hours.lowAfter)}%`);
  console.log("insights:");
  for (const i of a.insights) console.log(`  [${i.tone}] ${i.title} — ${i.text}`);
  if (seed === 2026) {
    const sub = analyze(applyFilters(ds.rows, { district: "г. Тараз", locality: "all", language: "all" }));
    console.log(`filter Taraz: students ${sub?.meta.nStudents}, textbooks ok ${sub?.textbooks.ok}, hours ok ${sub?.hours.ok}`);
    const rural = analyze(applyFilters(ds.rows, { district: "all", locality: "село", language: "all" }));
    console.log(`filter rural: students ${rural?.meta.nStudents}, adj rank ${rural?.textbooks.adjustedRank.join(">")}`);
  }
}
