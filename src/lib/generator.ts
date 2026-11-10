// Генератор синтетических демо-данных: алгебра, 7 класс, Жамбылская область.
// Данные ВЫМЫШЛЕННЫЕ. В них специально заложены закономерности, которые
// платформа должна найти сама (см. README → «Что заложено в демо-данные»).

import { Dataset, DemoTruth, Row } from "./types";
import type { Lang } from "./i18n";
import { clamp, rng, sigmoid } from "./stats";

interface SectionSpec {
  name: string;
  nameKk: string;
  planned: number; // часов по долгосрочному плану
  difficulty: number; // чем больше, тем труднее
  hoursSensitivity: number; // отдача от дополнительных часов
  maxScore: number; // максимальный балл СОР
  schoolVariation: number; // насколько результат зависит от школы/учителя
}

export const DEMO_SECTIONS: SectionSpec[] = [
  { name: "Степень с целым показателем", nameKk: "Бүтін көрсеткішті дәреже", planned: 14, difficulty: -0.55, hoursSensitivity: 0.15, maxScore: 15, schoolVariation: 0.12 },
  { name: "Многочлены", nameKk: "Көпмүшелер", planned: 16, difficulty: -0.15, hoursSensitivity: 0.5, maxScore: 18, schoolVariation: 0.12 },
  { name: "Формулы сокращённого умножения", nameKk: "Қысқаша көбейту формулалары", planned: 18, difficulty: 0.25, hoursSensitivity: 1.5, maxScore: 20, schoolVariation: 0.12 },
  { name: "Алгебраические дроби", nameKk: "Алгебралық бөлшектер", planned: 18, difficulty: 0.6, hoursSensitivity: 2.3, maxScore: 20, schoolVariation: 0.12 },
  { name: "Функция. Линейная функция", nameKk: "Функция. Сызықтық функция", planned: 18, difficulty: 0.05, hoursSensitivity: 0.6, maxScore: 18, schoolVariation: 0.5 },
  { name: "Элементы статистики", nameKk: "Статистика элементтері", planned: 12, difficulty: -0.75, hoursSensitivity: 0.1, maxScore: 15, schoolVariation: 0.12 },
];

// Перенос «недоученного» из раздела-пререквизита в зависимый раздел.
const PREREQ: Record<number, [number, number]> = {
  1: [0, 0.25], // Многочлены ← Степень
  2: [1, 0.3], // ФСУ ← Многочлены
  3: [2, 0.6], // Алгебраические дроби ← ФСУ
};


// Истинные эффекты учебников (логит-шкала): общий + по разделам.
const TB_EFFECT: Record<string, { all: number; bySection?: Record<number, number> }> = {
  А: { all: 0 },
  Б: { all: 0.22, bySection: { 4: 0.15 } },
  В: { all: 0.05, bySection: { 3: -0.6 } },
};

const DISTRICTS: { name: string; nameKk: string; schools: number; urbanFirst: boolean; rusShare: number }[] = [
  { name: "г. Тараз", nameKk: "Тараз қ.", schools: 16, urbanFirst: true, rusShare: 0.4 },
  { name: "Байзакский район", nameKk: "Байзақ ауданы", schools: 5, urbanFirst: false, rusShare: 0.15 },
  { name: "Жамбылский район", nameKk: "Жамбыл ауданы", schools: 5, urbanFirst: false, rusShare: 0.2 },
  { name: "Жуалынский район", nameKk: "Жуалы ауданы", schools: 4, urbanFirst: false, rusShare: 0.1 },
  { name: "Кордайский район", nameKk: "Қордай ауданы", schools: 6, urbanFirst: false, rusShare: 0.45 },
  { name: "Меркенский район", nameKk: "Меркі ауданы", schools: 5, urbanFirst: false, rusShare: 0.2 },
  { name: "Мойынкумский район", nameKk: "Мойынқұм ауданы", schools: 4, urbanFirst: false, rusShare: 0.1 },
  { name: "Сарысуский район", nameKk: "Сарысу ауданы", schools: 4, urbanFirst: true, rusShare: 0.25 },
  { name: "Таласский район", nameKk: "Талас ауданы", schools: 5, urbanFirst: true, rusShare: 0.2 },
  { name: "Район Т. Рыскулова", nameKk: "Т. Рысқұлов ауданы", schools: 4, urbanFirst: false, rusShare: 0.15 },
  { name: "Шуский район", nameKk: "Шу ауданы", schools: 5, urbanFirst: true, rusShare: 0.35 },
];

/** Областной центр показываем первым в списках районов. */
export const isRegionCenter = (d: string) => d === "г. Тараз" || d === "Тараз қ.";

const tbName = (key: string, lang: Lang) => (lang === "kk" ? `${key} оқулығы` : `Учебник ${key}`);

export function generateDemo(seed = 2026, lang: Lang = "ru"): Dataset {
  const kk = lang === "kk";
  const secName = (s: SectionSpec) => (kk ? s.nameKk : s.name);
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
        ? r.weighted<string>([["А", 0.6], ["Б", 0.22], ["В", 0.18]])
        : r.weighted<string>([["А", 0.15], ["Б", 0.55], ["В", 0.3]]);
      const schoolAbility = -0.2 + (urban ? 0.55 : 0) + r.normal(0, 0.28);
      const schoolTeach = r.normal(0, 0.15);
      const schoolSectionTeach = DEMO_SECTIONS.map((sec) => r.normal(0, sec.schoolVariation));
      const school = `${kk ? "Мектеп" : "Школа"} ${String(schoolNo).padStart(2, "0")}`;
      schoolEffect[school] = {
        overall: schoolTeach + schoolSectionTeach.reduce((a, b) => a + b, 0) / schoolSectionTeach.length,
        bySection: Object.fromEntries(DEMO_SECTIONS.map((sec, i) => [secName(sec), schoolTeach + schoolSectionTeach[i]])),
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
              district: kk ? d.nameKk : d.name,
              school,
              locality,
              language,
              classId,
              studentId,
              textbook: tbName(textbook, lang),
              section: secName(sec),
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
    name: kk ? "Демо: Алгебра, 7-сынып — Жамбыл облысы" : "Демо: Алгебра, 7 класс — Жамбылская область",
    subject: "Алгебра",
    grade: kk ? "7-сынып" : "7 класс",
    region: kk ? "Жамбыл облысы" : "Жамбылская область",
    synthetic: true,
    rows,
    truth: {
      hardest: secName(DEMO_SECTIONS[3]),
      prereqs: Object.entries(PREREQ).map(([to, [from, strength]]) => ({
        from: secName(DEMO_SECTIONS[from]),
        to: secName(DEMO_SECTIONS[Number(to)]),
        strength,
      })),
      bestTextbook: tbName("Б", lang),
      lag: { textbook: tbName("В", lang), section: secName(DEMO_SECTIONS[3]) },
      hoursPriority: [...DEMO_SECTIONS]
        .sort((a, b) => b.hoursSensitivity - a.hoursSensitivity)
        .slice(0, 2)
        .map(secName),
      uneven: secName(DEMO_SECTIONS[4]),
      schoolEffect,
    },
  };
}

