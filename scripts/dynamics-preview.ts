// Динамика год к году на демо-данных: сработало ли перераспределение часов в пилоте.
import { generateDemo } from "../src/lib/generator";
import { analyze } from "../src/lib/analytics";
import { analyzeDynamics, verdict } from "../src/lib/dynamics";

const f = (x: number, d = 1) => (Number.isFinite(x) ? x.toFixed(d) : "—");
for (const seed of [2026, 7, 42]) {
  const ds = generateDemo(seed);
  const t0 = Date.now();
  const d = analyzeDynamics(ds.rows)!;
  const a = analyze(ds.rows)!;
  console.log(`\n== seed ${seed} ${d.prev} → ${d.cur}  ${Date.now() - t0} ms; students ${d.nPrev}/${d.nCur}; schools ${d.nSchools}`);
  console.log(`overall ${f(d.overall.meanPrev)} → ${f(d.overall.meanCur)}  adj ${f(d.overall.change.est)} [${f(d.overall.change.lo)}; ${f(d.overall.change.hi)}]`);
  for (const s of d.sections) {
    const fc = a.hours.sections.find((h) => h.name === s.name)?.perHour;
    console.log(
      `  ${s.name.padEnd(32)} h ${f(s.hoursPrev)}→${f(s.hoursCur)} chg ${f(s.change.est)}±${f(s.change.se)} | slope ${s.slope ? `${f(s.slope.est, 2)} [${f(s.slope.lo, 2)}; ${f(s.slope.hi, 2)}]` : "—"} fc ${f(fc ?? NaN, 2)} | +${s.added?.n ?? 0}:${f(s.added?.delta ?? NaN)} =${s.same?.n ?? 0}:${f(s.same?.delta ?? NaN)} -${s.cut?.n ?? 0}:${f(s.cut?.delta ?? NaN)} did ${s.did ? `${f(s.did.est)} [${f(s.did.lo)}; ${f(s.did.hi)}]` : "—"} → ${verdict(s, fc)}`,
    );
  }
  const up = d.schools.filter((s) => s.flag === "up").length;
  const down = d.schools.filter((s) => s.flag === "down").length;
  const pilot = new Set(ds.truth!.dynamics!.pilotSchools);
  console.log(`schools up ${up} (pilot ${d.schools.filter((s) => s.flag === "up" && pilot.has(s.school)).length}), down ${down}; top: ${d.schools.slice(0, 3).map((s) => `${s.school} ${f(s.vsAll.est)} moved ${f(s.hoursMoved)}`).join(", ")}`);
}
