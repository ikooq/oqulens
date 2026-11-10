// Небольшая статистическая библиотека без зависимостей:
// описательные статистики, МНК с кластерно-устойчивыми ошибками, ГСЧ с seed.

export const mean = (a: number[]): number =>
  a.length ? a.reduce((s, x) => s + x, 0) / a.length : NaN;

export const variance = (a: number[]): number => {
  if (a.length < 2) return 0;
  const m = mean(a);
  return a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1);
};

export const sd = (a: number[]): number => Math.sqrt(variance(a));

export const clamp = (x: number, lo: number, hi: number): number =>
  Math.max(lo, Math.min(hi, x));

export const sigmoid = (x: number): number => 1 / (1 + Math.exp(-x));

export function groupBy<T>(items: T[], key: (t: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const it of items) {
    const k = key(it);
    const arr = m.get(k);
    if (arr) arr.push(it);
    else m.set(k, [it]);
  }
  return m;
}

export function correlation(x: number[], y: number[]): number {
  const mx = mean(x);
  const my = mean(y);
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < x.length; i++) {
    sxy += (x[i] - mx) * (y[i] - my);
    sxx += (x[i] - mx) ** 2;
    syy += (y[i] - my) ** 2;
  }
  return sxx > 0 && syy > 0 ? sxy / Math.sqrt(sxx * syy) : 0;
}

/** Нормальная функция распределения (Abramowitz–Stegun). */
export function normCdf(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp((-z * z) / 2);
  const p =
    d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z > 0 ? 1 - p : p;
}

// ---------- ГСЧ с фиксированным seed (воспроизводимые демо-данные) ----------

export function rng(seed: number) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  let spare: number | null = null;
  const normal = (mu = 0, sigma = 1) => {
    if (spare !== null) {
      const v = spare;
      spare = null;
      return mu + sigma * v;
    }
    let u = 0;
    let v = 0;
    while (u === 0) u = next();
    while (v === 0) v = next();
    const r = Math.sqrt(-2 * Math.log(u));
    spare = r * Math.sin(2 * Math.PI * v);
    return mu + sigma * r * Math.cos(2 * Math.PI * v);
  };
  const binomial = (n: number, p: number) => {
    let k = 0;
    for (let i = 0; i < n; i++) if (next() < p) k++;
    return k;
  };
  const pick = <T,>(arr: T[]): T => arr[Math.floor(next() * arr.length)];
  const weighted = <T,>(items: [T, number][]): T => {
    const total = items.reduce((s, [, w]) => s + w, 0);
    let r = next() * total;
    for (const [it, w] of items) {
      r -= w;
      if (r <= 0) return it;
    }
    return items[items.length - 1][0];
  };
  return { next, normal, binomial, pick, weighted };
}

// ---------- Линейная алгебра для маленьких матриц ----------

type Mat = number[][];

function invert(A: Mat): Mat | null {
  const n = A.length;
  const M = A.map((row, i) => [...row, ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))]);
  for (let c = 0; c < n; c++) {
    let piv = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[piv][c])) piv = r;
    if (Math.abs(M[piv][c]) < 1e-10) return null;
    [M[c], M[piv]] = [M[piv], M[c]];
    const d = M[c][c];
    for (let j = 0; j < 2 * n; j++) M[c][j] /= d;
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = M[r][c];
      if (f === 0) continue;
      for (let j = 0; j < 2 * n; j++) M[r][j] -= f * M[c][j];
    }
  }
  return M.map((row) => row.slice(n));
}

function matMul(A: Mat, B: Mat): Mat {
  return A.map((row) =>
    B[0].map((_, j) => row.reduce((s, a, k) => s + a * B[k][j], 0)),
  );
}

export interface OlsResult {
  beta: number[];
  se: number[];
  cov: Mat;
  n: number;
  r2: number;
  ok: boolean;
}

/**
 * МНК. Если переданы кластеры (например, школы), ошибки считаются
 * кластерно-устойчивыми (CR1) — ученики одной школы не независимы.
 */
export function ols(X: Mat, y: number[], clusters?: string[]): OlsResult {
  const n = X.length;
  const k = X[0]?.length ?? 0;
  const empty: OlsResult = { beta: Array(k).fill(NaN), se: Array(k).fill(NaN), cov: [], n, r2: NaN, ok: false };
  if (n <= k + 1) return empty;
  const XtX: Mat = Array.from({ length: k }, () => Array(k).fill(0));
  const Xty: number[] = Array(k).fill(0);
  for (let i = 0; i < n; i++) {
    const xi = X[i];
    for (let a = 0; a < k; a++) {
      Xty[a] += xi[a] * y[i];
      for (let b = a; b < k; b++) XtX[a][b] += xi[a] * xi[b];
    }
  }
  for (let a = 0; a < k; a++) for (let b = 0; b < a; b++) XtX[a][b] = XtX[b][a];
  const inv = invert(XtX);
  if (!inv) return empty;
  const beta = inv.map((row) => row.reduce((s, v, j) => s + v * Xty[j], 0));
  const resid = y.map((yi, i) => yi - X[i].reduce((s, v, j) => s + v * beta[j], 0));
  const my = mean(y);
  const sst = y.reduce((s, v) => s + (v - my) ** 2, 0);
  const sse = resid.reduce((s, v) => s + v * v, 0);

  let cov: Mat;
  if (clusters) {
    const groups = new Map<string, number[]>();
    clusters.forEach((g, i) => {
      const arr = groups.get(g);
      if (arr) arr.push(i);
      else groups.set(g, [i]);
    });
    const G = groups.size;
    const meat: Mat = Array.from({ length: k }, () => Array(k).fill(0));
    for (const idx of groups.values()) {
      const s = Array(k).fill(0);
      for (const i of idx) for (let a = 0; a < k; a++) s[a] += X[i][a] * resid[i];
      for (let a = 0; a < k; a++) for (let b = 0; b < k; b++) meat[a][b] += s[a] * s[b];
    }
    const c = G > 1 ? (G / (G - 1)) * ((n - 1) / (n - k)) : 1;
    cov = matMul(matMul(inv, meat), inv).map((row) => row.map((v) => v * c));
  } else {
    const s2 = sse / (n - k);
    cov = inv.map((row) => row.map((v) => v * s2));
  }
  const se = cov.map((row, i) => Math.sqrt(Math.max(0, row[i])));
  return { beta, se, cov, n, r2: sst > 0 ? 1 - sse / sst : NaN, ok: true };
}

/** Дисперсия линейной комбинации c'β. */
export function linCombVar(cov: Mat, c: number[]): number {
  let v = 0;
  for (let i = 0; i < c.length; i++) for (let j = 0; j < c.length; j++) v += c[i] * c[j] * cov[i][j];
  return Math.max(0, v);
}

/** Коэффициент внутриклассовой корреляции (ANOVA-оценка): доля разброса «между группами». */
export function icc(groups: number[][]): number {
  const gs = groups.filter((g) => g.length > 0);
  const N = gs.reduce((s, g) => s + g.length, 0);
  const a = gs.length;
  if (a < 2 || N <= a) return 0;
  const grand = mean(gs.flat());
  let ssb = 0;
  let ssw = 0;
  for (const g of gs) {
    const m = mean(g);
    ssb += g.length * (m - grand) ** 2;
    for (const x of g) ssw += (x - m) ** 2;
  }
  const msb = ssb / (a - 1);
  const msw = ssw / (N - a);
  const n0 = (N - gs.reduce((s, g) => s + g.length ** 2, 0) / N) / (a - 1);
  const v = (msb - msw) / (msb + (n0 - 1) * msw);
  return clamp(v, 0, 1);
}
