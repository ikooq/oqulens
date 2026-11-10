// Проверка метода на демо-данных: в генератор заложены известные закономерности,
// и здесь мы сверяем, нашёл ли их анализ сам, не зная ответа.

import { Analysis } from "./analytics";
import { DemoTruth } from "./types";
import { correlation } from "./stats";
import { makeFmt } from "./format";
import { Lang, tr } from "./i18n";

export interface Check {
  title: string;
  planted: string;
  found: string;
  ok: boolean;
}

const q = (s: string) => `«${s}»`;

export function validateDemo(a: Analysis, t: DemoTruth, lang: Lang = "ru"): Check[] {
  const L = (ru: string, kk: string) => tr(lang, ru, kk);
  const { pp } = makeFmt(lang);
  const out: Check[] = [];

  const hardest = [...a.sections].sort((x, y) => x.mean - y.mean)[0];
  out.push({
    title: L("Самый трудный раздел", "Ең қиын бөлім"),
    planted: q(t.hardest),
    found: hardest ? `${q(hardest.name)}, ${Math.round(hardest.mean)}%` : "—",
    ok: hardest?.name === t.hardest,
  });

  const strongest = [...t.prereqs].sort((x, y) => y.strength - x.strength)[0];
  const foundLink = a.prereqs.find((l) => l.to === strongest.to);
  out.push({
    title: L("Корень проблемы", "Мәселенің түбірі"),
    planted: `${q(strongest.from)} → ${q(strongest.to)}`,
    found: foundLink ? `${q(foundLink.from)} → ${q(foundLink.to)}` : L("связь не найдена", "байланыс табылмады"),
    ok: foundLink?.from === strongest.from,
  });

  const tb = a.textbooks;
  out.push({
    title: L("Лучший учебник при равных условиях", "Тең жағдайдағы ең жақсы оқулық"),
    planted: q(t.bestTextbook),
    found: tb.best
      ? `${q(tb.best)}${
          tb.naiveRank[0] && tb.naiveRank[0] !== tb.best
            ? L(`, хотя по сырым баллам лидирует ${q(tb.naiveRank[0])}`, `, ал шикі балл бойынша ${q(tb.naiveRank[0])} алда`)
            : ""
        }`
      : "—",
    ok: tb.best === t.bestTextbook,
  });

  const lag = tb.lags.find((l) => l.textbook === t.lag.textbook && l.section === t.lag.section);
  out.push({
    title: L("Слабая глава учебника", "Оқулықтың әлсіз тарауы"),
    planted: L(`${q(t.lag.textbook)} в ${q(t.lag.section)}`, `${q(t.lag.textbook)}, ${q(t.lag.section)}`),
    found: lag
      ? L(`${q(lag.textbook)} в ${q(lag.section)}, ${pp(lag.diffVsBest)}`, `${q(lag.textbook)}, ${q(lag.section)}, ${pp(lag.diffVsBest)}`)
      : L("не найдена", "табылмады"),
    ok: !!lag,
  });

  const plus = a.hours.sections.filter((h) => h.delta > 0).map((h) => h.name);
  out.push({
    title: L("Где часы дают наибольшую отдачу", "Сағат қай жерде көп қайтарым береді"),
    planted: t.hoursPriority.map(q).join(", "),
    found: plus.length ? plus.map(q).join(", ") : L("перенос не предложен", "ауыстыру ұсынылмады"),
    ok: t.hoursPriority.every((s) => plus.includes(s)) && plus.length === t.hoursPriority.length,
  });

  const uneven = a.sections.filter((s) => s.uneven).map((s) => s.name);
  out.push({
    title: L("Раздел, зависящий от школы", "Мектепке тәуелді бөлім"),
    planted: q(t.uneven),
    found: uneven.length ? uneven.map(q).join(", ") : L("не найден", "табылмады"),
    ok: uneven.includes(t.uneven),
  });

  // Качество работы школы: сравниваем оценку с истинным вкладом школы
  const pairs = a.schools
    .filter((p) => Number.isFinite(p.valueAdded) && t.schoolEffect[p.school])
    .map((p) => [p.valueAdded, t.schoolEffect[p.school].overall] as const);
  const r = pairs.length > 5 ? correlation(pairs.map((x) => x[0]), pairs.map((x) => x[1])) : NaN;
  const rs = Number.isFinite(r) ? r.toFixed(2).replace(".", ",") : "";
  out.push({
    title: L("Сильные и слабые школы", "Күшті және әлсіз мектептер"),
    planted: L("вклад каждой школы в результат", "әр мектептің нәтижеге қосқан үлесі"),
    found: Number.isFinite(r) ? L(`корреляция оценки с истинным вкладом r = ${rs}`, `бағаның шын үлеспен корреляциясы r = ${rs}`) : "—",
    ok: r >= 0.6,
  });

  return out;
}
