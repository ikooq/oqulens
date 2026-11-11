// Сквозная проверка метода: на синтетических данных платформа должна найти
// ровно те закономерности, что заложены в генератор (на нескольких seed).
import { test } from "node:test";
import assert from "node:assert/strict";
import { generateDemo } from "../src/lib/generator";
import { analyze, applyFilters } from "../src/lib/analytics";
import { validateDemo } from "../src/lib/validation";
import { buildReport } from "../src/lib/memo";
import { buildSummary, ReportContext } from "../src/lib/report";

for (const seed of [2026, 7, 42]) {
  test(`метод находит заложенные закономерности (seed ${seed})`, () => {
    const ds = generateDemo(seed);
    const a = analyze(ds.rows);
    assert.ok(a, "анализ построен");
    const failed = validateDemo(a!, ds.truth!).filter((c) => !c.ok);
    assert.deepEqual(failed.map((c) => `${c.title}: заложено ${c.planted}, найдено ${c.found}`), []);
  });
}

test("рекомендация по часам сохраняет общий объём часов и улучшает прогноз", () => {
  const ds = generateDemo(2026);
  const a = analyze(ds.rows)!;
  const h = a.hours;
  assert.ok(h.ok);
  const planned = h.sections.reduce((s, x) => s + x.planned, 0);
  const recommended = h.sections.reduce((s, x) => s + x.recommended, 0);
  assert.equal(recommended, planned, "часы только перераспределяются");
  assert.equal(planned, h.totalPlanned);
  assert.ok(h.meanAfter >= h.meanBefore, "прогноз не хуже текущего");
  assert.ok(h.meanAfterConservative <= h.meanAfter + 1e-9, "осторожный прогноз не выше точечного");
  // Прогноз на текущих часах совпадает с базой
  const base = a.forecast(h.sections.map((x) => x.planned));
  assert.ok(Math.abs(base.mean - h.meanBefore) < 0.5);
});

test("учебники сравниваются с поправкой на состав школ", () => {
  const ds = generateDemo(2026);
  const a = analyze(ds.rows)!;
  assert.equal(a.textbooks.adjustedRank[0], ds.truth!.bestTextbook);
  // Городские школы чаще берут учебник А: «сырое» сравнение завышает его
  const tA = a.textbooks.rows.find((r) => r.name.endsWith("А"))!;
  assert.ok(tA.naive.mean - tA.adjusted.mean > 1, "наивная оценка учебника А завышена");
});

test("фильтры и пустые данные", () => {
  const ds = generateDemo(2026);
  assert.equal(analyze([]), null);
  const taraz = applyFilters(ds.rows, { district: "г. Тараз", locality: "all", language: "all" });
  assert.ok(taraz.length > 0 && taraz.every((r) => r.district === "г. Тараз"));
  const rural = applyFilters(ds.rows, { district: "all", locality: "село", language: "all" });
  assert.ok(rural.every((r) => r.locality === "село"));
  assert.equal(applyFilters(ds.rows, { district: "all", locality: "all", language: "all" }).length, ds.rows.length);
});

test("анализ не зависит от языка интерфейса", () => {
  const ru = analyze(generateDemo(2026, "ru").rows)!;
  const kk = analyze(generateDemo(2026, "kk").rows)!;
  assert.equal(ru.overall.mean, kk.overall.mean);
  assert.deepEqual(
    ru.hours.sections.map((s) => s.recommended),
    kk.hours.sections.map((s) => s.recommended),
  );
  assert.ok(validateDemo(kk, generateDemo(2026, "kk").truth!, "kk").every((c) => c.ok));
});

test("записка и сводка для ИИ не содержат данных учеников", () => {
  const ds = generateDemo(2026);
  const a = analyze(ds.rows)!;
  const ctx: ReportContext = { title: ds.name, scope: "Вся область", synthetic: true, date: "11.11.2026" };
  const summary = JSON.stringify(buildSummary(a, ctx));
  assert.ok(!/U\d{5}/.test(summary), "в сводке нет ID учеников");
  for (const lang of ["ru", "kk"] as const) {
    const memo = buildReport(a, ctx, lang);
    assert.ok(memo.length > 1500, `записка (${lang}) не пустая`);
    assert.ok(!/U\d{5}/.test(memo));
  }
});
