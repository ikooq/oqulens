// Генератор синтетических демо-данных: алгебра, 7 класс, Жамбылская область.
// Данные ВЫМЫШЛЕННЫЕ. В них специально заложены закономерности, которые
// платформа должна найти сама (см. README → «Что заложено в демо-данные»).

import { Dataset, DemoTruth, Row } from "./types";
import { clamp, rng, sigmoid } from "./stats";

interface SectionSpec {
  name: string;
  planned: number; // часов по долгосрочному плану
  difficulty: number; // чем больше, тем труднее
  hoursSensitivity: number; // отдача от дополнительных часов
  maxScore: number; // максимальный балл СОР
  schoolVariation: number; // насколько результат зависит от школы/учителя
}

export const DEMO_SECTIONS: SectionSpec[] = [
  { name: "Степень с целым показателем", planned: 14, difficulty: -0.55, hoursSensitivity: 0.15, maxScore: 15, schoolVariation: 0.12 },
  { name: "Многочлены", planned: 16, difficulty: -0.15, hoursSensitivity: 0.5, maxScore: 18, schoolVariation: 0.12 },
  { name: "Формулы сокращённого умножения", planned: 18, difficulty: 0.25, hoursSensitivity: 1.5, maxScore: 20, schoolVariation: 0.12 },
  { name: "Алгебраические дроби", planned: 18, difficulty: 0.6, hoursSensitivity: 2.3, maxScore: 20, schoolVariation: 0.12 },
  { name: "Функция. Линейная функция", planned: 18, difficulty: 0.05, hoursSensitivity: 0.6, maxScore: 18, schoolVariation: 0.5 },
  { name: "Элементы статистики", planned: 12, difficulty: -0.75, hoursSensitivity: 0.1, maxScore: 15, schoolVariation: 0.12 },
];

// Перенос «недоученного» из раздела-пререквизита в зависимый раздел.
const PREREQ: Record<number, [number, number]> = {
  1: [0, 0.25], // Многочлены ← Степень
  2: [1, 0.3], // ФСУ ← Многочлены
  3: [2, 0.6], // Алгебраические дроби ← ФСУ
};

const TEXTBOOKS = ["Учебник А", "Учебник Б", "Учебник В"];

// Истинные эффекты учебников (логит-шкала): общий + по разделам.
const TB_EFFECT: Record<string, { all: number; bySection?: Record<number, number> }> = {
  "Учебник А": { all: 0 },
  "Учебник Б": { all: 0.22, bySection: { 4: 0.15 } },
  "Учебник В": { all: 0.05, bySection: { 3: -0.6 } },
};

const DISTRICTS: { name: string; schools: number; urbanFirst: boolean; rusShare: number }[] = [
  { name: "г. Тараз", schools: 16, urbanFirst: true, rusShare: 0.4 },
  { name: "Байзакский район", schools: 5, urbanFirst: false, rusShare: 0.15 },
  { name: "Жамбылский район", schools: 5, urbanFirst: false, rusShare: 0.2 },
  { name: "Жуалынский район", schools: 4, urbanFirst: false, rusShare: 0.1 },
  { name: "Кордайский район", schools: 6, urbanFirst: false, rusShare: 0.45 },
  { name: "Меркенский район", schools: 5, urbanFirst: false, rusShare: 0.2 },
  { name: "Мойынкумский район", schools: 4, urbanFirst: false, rusShare: 0.1 },
  { name: "Сарысуский район", schools: 4, urbanFirst: true, rusShare: 0.25 },
  { name: "Таласский район", schools: 5, urbanFirst: true, rusShare: 0.2 },
  { name: "Район Т. Рыскулова", schools: 4, urbanFirst: false, rusShare: 0.15 },
  { name: "Шуский район", schools: 5, urbanFirst: true, rusShare: 0.35 },
];

export function generateDemo(seed = 2026): Dataset {
  const r = rng(seed);
  const rows: Row[] = [];
  const schoolEffect: DemoTruth["schoolEffect"] = {};
  let schoolNo = 0;
  let studentNo = 0;

  for (const d of DISTRICTS) {
    for (let s = 0; s < d.schools; s++) {
      schoolNo++;
      const urban = d.name === "г. Тараз" || (d.urbanFirst && s === 0);
      const locality: Row["locality"] = urban ? "город" : "село";
      const language: Row["language"] = r.next() < d.rusShare ? "рус" : "каз";
      // Самоотбор: городские школы чаще выбирают учебник А, сельские — Б.
      const textbook = urban
        ? r.weighted<string>([["Учебник А", 0.6], ["Учебник Б", 0.22], ["Учебник В", 0.18]])
        : r.weighted<string>([["Учебник А", 0.15], ["Учебник Б", 0.55], ["Учебник В", 0.3]]);
      const schoolAbility = -0.2 + (urban ? 0.55 : 0) + r.normal(0, 0.28);
      const schoolTeach = r.normal(0, 0.15);
      const schoolSectionTeach = DEMO_SECTIONS.map((sec) => r.normal(0, sec.schoolVariation));
      const school = `Школа ${String(schoolNo).padStart(2, "0")}`;
      schoolEffect[school] = {
        overall: schoolTeach + schoolSectionTeach.reduce((a, b) => a + b, 0) / schoolSectionTeach.length,
        bySection: Object.fromEntries(DEMO_SECTIONS.map((sec, i) => [sec.name, schoolTeach + schoolSectionTeach[i]])),
      };
      const nClasses = urban ? (r.next() < 0.6 ? 3 : 2) : r.next() < 0.3 ? 1 : 2;

      for (let c = 0; c < nClasses; c++) {
        const classId = `${school} · 7${"АБВ"[c]}`;
        const hours = DEMO_SECTIONS.map((sec) =>
          clamp(sec.planned + Math.round(r.normal(0, 2.3)), sec.planned - 5, sec.planned + 5),
        );
        const classTeach = DEMO_SECTIONS.map(() => r.normal(0, 0.1));
        const nStudents = urban ? 20 + Math.floor(r.next() * 9) : 12 + Math.floor(r.next() * 11);

        for (let k = 0; k < nStudents; k++) {
          studentNo++;
          const studentId = `U${String(studentNo).padStart(5, "0")}`;
          const theta = schoolAbility + r.normal(0, 0.85);
          const baselinePct = Math.round(clamp(100 * sigmoid(0.35 + 0.95 * theta + r.normal(0, 0.4)), 8, 100));
          const comp: number[] = [];
          DEMO_SECTIONS.forEach((sec, i) => {
            const tb = TB_EFFECT[textbook];
            const tbEff = tb.all + (tb.bySection?.[i] ?? 0);
            const hoursEff = sec.hoursSensitivity * Math.log(hours[i] / sec.planned);
            let c_i = tbEff + schoolTeach + schoolSectionTeach[i] + classTeach[i] + hoursEff + r.normal(0, 0.55);
            const pre = PREREQ[i];
            if (pre) c_i += pre[1] * comp[pre[0]];
            comp.push(c_i);
          });
          DEMO_SECTIONS.forEach((sec, i) => {
            const p = sigmoid(0.3 + theta + comp[i] - sec.difficulty);
            rows.push({
              district: d.name,
              school,
              locality,
              language,
              classId,
              studentId,
              textbook,
              section: sec.name,
              sectionOrder: i + 1,
              plannedHours: sec.planned,
              actualHours: hours[i],
              score: r.binomial(sec.maxScore, p),
              maxScore: sec.maxScore,
              baselinePct,
            });
          });
        }
      }
    }
  }

  return {
    name: "Демо: Алгебра, 7 класс — Жамбылская область",
    subject: "Алгебра",
    grade: "7 класс",
    region: "Жамбылская область",
    synthetic: true,
    rows,
    truth: {
      hardest: DEMO_SECTIONS[3].name,
      prereqs: Object.entries(PREREQ).map(([to, [from, strength]]) => ({
        from: DEMO_SECTIONS[from].name,
        to: DEMO_SECTIONS[Number(to)].name,
        strength,
      })),
      bestTextbook: "Учебник Б",
      lag: { textbook: "Учебник В", section: DEMO_SECTIONS[3].name },
      hoursPriority: [...DEMO_SECTIONS]
        .sort((a, b) => b.hoursSensitivity - a.hoursSensitivity)
        .slice(0, 2)
        .map((s) => s.name),
      uneven: DEMO_SECTIONS[4].name,
      schoolEffect,
    },
  };
}

export { TEXTBOOKS };
