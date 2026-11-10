// Проверка метода на демо-данных: в генератор заложены известные закономерности,
// и здесь мы сверяем, нашёл ли их анализ сам, не зная ответа.

import { Analysis } from "./analytics";
import { DemoTruth } from "./types";
import { correlation } from "./stats";
import { pp } from "./format";

export interface Check {
  title: string;
  planted: string;
  found: string;
  ok: boolean;
}

const q = (s: string) => `«${s}»`;

export function validateDemo(a: Analysis, t: DemoTruth): Check[] {
  const out: Check[] = [];

  const hardest = [...a.sections].sort((x, y) => x.mean - y.mean)[0];
  out.push({
    title: "Самый трудный раздел",
    planted: q(t.hardest),
    found: hardest ? `${q(hardest.name)}, ${Math.round(hardest.mean)}%` : "—",
    ok: hardest?.name === t.hardest,
  });

  const strongest = [...t.prereqs].sort((x, y) => y.strength - x.strength)[0];
  const foundLink = a.prereqs.find((l) => l.to === strongest.to);
  out.push({
    title: "Корень проблемы",
    planted: `${q(strongest.from)} → ${q(strongest.to)}`,
    found: foundLink ? `${q(foundLink.from)} → ${q(foundLink.to)}` : "связь не найдена",
    ok: foundLink?.from === strongest.from,
  });

  const tb = a.textbooks;
  out.push({
    title: "Лучший учебник при равных условиях",
    planted: q(t.bestTextbook),
    found: tb.best
      ? `${q(tb.best)}${tb.naiveRank[0] && tb.naiveRank[0] !== tb.best ? `, хотя по сырым баллам лидирует ${q(tb.naiveRank[0])}` : ""}`
      : "—",
    ok: tb.best === t.bestTextbook,
  });

  const lag = tb.lags.find((l) => l.textbook === t.lag.textbook && l.section === t.lag.section);
  out.push({
    title: "Слабая глава учебника",
    planted: `${q(t.lag.textbook)} в ${q(t.lag.section)}`,
    found: lag ? `${q(lag.textbook)} в ${q(lag.section)}, ${pp(lag.diffVsBest)}` : "не найдена",
    ok: !!lag,
  });

  const plus = a.hours.sections.filter((h) => h.delta > 0).map((h) => h.name);
  out.push({
    title: "Где часы дают наибольшую отдачу",
    planted: t.hoursPriority.map(q).join(", "),
    found: plus.length ? plus.map(q).join(", ") : "перенос не предложен",
    ok: t.hoursPriority.every((s) => plus.includes(s)) && plus.length === t.hoursPriority.length,
  });

  const uneven = a.sections.filter((s) => s.uneven).map((s) => s.name);
  out.push({
    title: "Раздел, зависящий от школы",
    planted: q(t.uneven),
    found: uneven.length ? uneven.map(q).join(", ") : "не найден",
    ok: uneven.includes(t.uneven),
  });

  // Качество работы школы: сравниваем оценку с истинным вкладом школы
  const pairs = a.schools
    .filter((p) => Number.isFinite(p.valueAdded) && t.schoolEffect[p.school])
    .map((p) => [p.valueAdded, t.schoolEffect[p.school].overall] as const);
  const r = pairs.length > 5 ? correlation(pairs.map((x) => x[0]), pairs.map((x) => x[1])) : NaN;
  out.push({
    title: "Сильные и слабые школы",
    planted: "вклад каждой школы в результат",
    found: Number.isFinite(r) ? `корреляция оценки с истинным вкладом r = ${r.toFixed(2).replace(".", ",")}` : "—",
    ok: r >= 0.6,
  });

  return out;
}
