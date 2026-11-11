// Юнит-тесты статистической библиотеки: проверяем на данных с известным ответом.
import { test } from "node:test";
import assert from "node:assert/strict";
import { clamp, correlation, icc, mean, normCdf, ols, rng, sd, variance } from "../src/lib/stats";

const near = (a: number, b: number, tol: number, msg?: string) =>
  assert.ok(Math.abs(a - b) <= tol, `${msg ?? ""} ожидалось ${b} ± ${tol}, получено ${a}`);

test("описательные статистики", () => {
  assert.equal(mean([1, 2, 3, 4]), 2.5);
  assert.ok(Number.isNaN(mean([])));
  near(variance([2, 4, 4, 4, 5, 5, 7, 9]), 32 / 7, 1e-12);
  near(sd([2, 4, 4, 4, 5, 5, 7, 9]), Math.sqrt(32 / 7), 1e-12);
  assert.equal(variance([5]), 0);
  assert.equal(clamp(12, 0, 10), 10);
  assert.equal(clamp(-1, 0, 10), 0);
});

test("корреляция: знак и границы", () => {
  near(correlation([1, 2, 3, 4], [2, 4, 6, 8]), 1, 1e-12);
  near(correlation([1, 2, 3, 4], [8, 6, 4, 2]), -1, 1e-12);
  assert.equal(correlation([1, 1, 1], [1, 2, 3]), 0);
});

test("нормальное распределение", () => {
  near(normCdf(0), 0.5, 1e-6);
  near(normCdf(1.96), 0.975, 1e-3);
  near(normCdf(-1.96), 0.025, 1e-3);
});

test("ГСЧ воспроизводим при одинаковом seed", () => {
  const a = rng(42);
  const b = rng(42);
  const xs = Array.from({ length: 5 }, () => a.next());
  const ys = Array.from({ length: 5 }, () => b.next());
  assert.deepEqual(xs, ys);
  assert.notDeepEqual(xs, Array.from({ length: 5 }, rng(43).next));
  const r = rng(1);
  const z = Array.from({ length: 20000 }, () => r.normal(3, 2));
  near(mean(z), 3, 0.05, "среднее нормальной выборки");
  near(sd(z), 2, 0.05, "СКО нормальной выборки");
});

test("МНК восстанавливает заложенные коэффициенты", () => {
  const r = rng(7);
  const X: number[][] = [];
  const y: number[] = [];
  for (let i = 0; i < 4000; i++) {
    const x1 = r.normal(0, 1);
    const x2 = r.normal(0, 1);
    X.push([1, x1, x2]);
    y.push(2 + 1.5 * x1 - 0.7 * x2 + r.normal(0, 1));
  }
  const fit = ols(X, y);
  assert.ok(fit.ok);
  near(fit.beta[0], 2, 0.08, "свободный член");
  near(fit.beta[1], 1.5, 0.08, "β1");
  near(fit.beta[2], -0.7, 0.08, "β2");
  // Ошибка ≈ 1/√n
  near(fit.se[1], 1 / Math.sqrt(4000), 0.004, "SE β1");
});

test("кластерные ошибки шире, когда наблюдения внутри кластера похожи", () => {
  const r = rng(11);
  const X: number[][] = [];
  const y: number[] = [];
  const cl: string[] = [];
  for (let g = 0; g < 40; g++) {
    const gx = r.normal(0, 1); // признак на уровне кластера (как учебник у школы)
    const gu = r.normal(0, 1); // общий шум кластера
    for (let i = 0; i < 30; i++) {
      X.push([1, gx]);
      y.push(gx * 0.5 + gu + r.normal(0, 1));
      cl.push(`g${g}`);
    }
  }
  const naive = ols(X, y);
  const clustered = ols(X, y, cl);
  assert.ok(clustered.se[1] > 2 * naive.se[1], `кластерная SE ${clustered.se[1]} vs обычная ${naive.se[1]}`);
});

test("ICC: около нуля без групповых эффектов и высокий при сильных", () => {
  const r = rng(3);
  const flat = Array.from({ length: 50 }, () => Array.from({ length: 20 }, () => r.normal(0, 1)));
  const grouped = Array.from({ length: 50 }, () => {
    const u = r.normal(0, 2);
    return Array.from({ length: 20 }, () => u + r.normal(0, 1));
  });
  assert.ok(Math.abs(icc(flat)) < 0.05, `ICC без эффектов ${icc(flat)}`);
  near(icc(grouped), 0.8, 0.1, "ICC при σ²_группы = 4, σ²_ученика = 1");
});
