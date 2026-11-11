// Динамика год к году: на демо-данных пилотные школы перенесли часы,
// и платформа должна подтвердить эффект — независимо от прогноза по одному году.
import { test } from "node:test";
import assert from "node:assert/strict";
import { generateDemo, DEMO_PERIODS } from "../src/lib/generator";
import { analyze, latestPeriodRows, periodsOf } from "../src/lib/analytics";
import { analyzeDynamics, verdict } from "../src/lib/dynamics";
import { validateDemo } from "../src/lib/validation";

test("основной анализ идёт по последнему учебному году", () => {
  const ds = generateDemo(2026);
  assert.deepEqual(periodsOf(ds.rows), [...DEMO_PERIODS]);
  const cur = latestPeriodRows(ds.rows);
  assert.ok(cur.length < ds.rows.length && cur.every((r) => r.period === DEMO_PERIODS[1]));
  assert.equal(analyze(ds.rows)!.overall.mean, analyze(cur)!.overall.mean);
});

test("один год в данных — динамики нет", () => {
  const ds = generateDemo(2026);
  assert.equal(analyzeDynamics(latestPeriodRows(ds.rows)), null);
  assert.equal(analyzeDynamics(ds.rows.map(({ period: _p, ...r }) => r)), null);
});

for (const seed of [2026, 7, 42]) {
  test(`перенос часов в пилоте подтверждается год к году (seed ${seed})`, () => {
    const ds = generateDemo(seed);
    const a = analyze(ds.rows)!;
    const d = analyzeDynamics(ds.rows)!;
    assert.equal(d.prev, DEMO_PERIODS[0]);
    assert.equal(d.cur, DEMO_PERIODS[1]);
    for (const name of ds.truth!.dynamics!.moreHours) {
      const s = d.sections.find((x) => x.name === name)!;
      const fc = a.hours.sections.find((h) => h.name === name)!.perHour;
      assert.equal(verdict(s, fc), "confirmed", `${name}: факт ${s.slope?.est}, прогноз ${fc}`);
      assert.ok(s.hoursCur > s.hoursPrev, "часов на раздел стало больше");
      assert.ok(s.did && s.did.est > 0, "школы, добавившие часы, выросли сильнее остальных");
    }
    // Там, где часы почти не влияют, отдача от часа заметно ниже, чем в пилотных разделах
    const minMore = Math.min(...ds.truth!.dynamics!.moreHours.map((n) => d.sections.find((x) => x.name === n)!.slope!.est));
    for (const name of ds.truth!.dynamics!.fewerHours) {
      const s = d.sections.find((x) => x.name === name)!;
      assert.ok(s.slope!.est < minMore, `${name}: ${s.slope!.est} против ${minMore}`);
    }
    // Общий рост в данных есть (заложен), и он отделён от эффекта часов
    assert.ok(d.overall.change.significant && d.overall.change.est > 0);
    const checks = validateDemo(a, ds.truth!, "ru", d);
    assert.equal(checks.length, 8);
    assert.ok(checks.every((c) => c.ok), checks.filter((c) => !c.ok).map((c) => c.title).join(", "));
  });
}

test("готовый ответ «Сработали ли изменения?» и сводка для ИИ", async () => {
  const { answer } = await import("../src/lib/answers");
  const { buildSummary } = await import("../src/lib/report");
  const { compactSummary } = await import("../src/lib/llm");
  const ds = generateDemo(2026);
  const a = analyze(ds.rows)!;
  const d = analyzeDynamics(ds.rows)!;
  for (const lang of ["ru", "kk"] as const) {
    const ans = answer("dynamics", a, lang, undefined, d);
    assert.equal(ans.tab, "dynamics");
    for (const name of ds.truth!.dynamics!.moreHours) assert.ok(ans.text.includes(name), `${lang}: в ответе есть ${name}`);
  }
  // Без второго года — подсказка, как загрузить
  assert.match(answer("dynamics", a, "ru", undefined, null).text, /учебный_год/);

  const ctx = { title: ds.name, scope: "Вся область", synthetic: true, date: "11.11.2026" };
  const s = buildSummary(a, ctx, d) as { dynamics_year_over_year?: { sections: { verdict: string; name: string }[] } };
  const dy = s.dynamics_year_over_year!;
  assert.ok(dy, "в сводке есть динамика");
  assert.equal(dy.sections[0].verdict, "confirmed");
  assert.ok(!/U\d{5}/.test(JSON.stringify(s)), "без ID учеников");
  assert.equal((buildSummary(a, ctx) as Record<string, unknown>).dynamics_year_over_year, undefined);
  // Сжатая сводка для бесплатного Groq (лимит ~8K токенов в минуту) остаётся компактной
  const compact = JSON.stringify(compactSummary(s));
  assert.ok(compact.length < 11_000, `сжатая сводка ${compact.length} символов`);
});
