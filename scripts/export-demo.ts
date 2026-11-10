// Выгружает демо-данные в CSV (public/demo) и проверяет, что импорт CSV
// даёт тот же результат анализа, что и данные в памяти.
import { mkdirSync, writeFileSync } from "node:fs";
import { generateDemo } from "../src/lib/generator";
import { parseCsv, toCsv } from "../src/lib/csv";
import { analyze } from "../src/lib/analytics";

const ds = generateDemo(2026);
const csv = toCsv(ds.rows);
mkdirSync("public/demo", { recursive: true });
writeFileSync("public/demo/oqulens_demo_algebra7_zhambyl.csv", "﻿" + csv, "utf8");

// Русские заголовки и «;» как разделитель — как в Excel
const ruHeader = "район;школа;местность;язык;класс;ученик;учебник;раздел;номер_раздела;часы_план;часы_факт;балл;макс_балл;стартовый_уровень";
const ruCsv = [ruHeader, ...csv.split(/\r?\n/).slice(1).map((l) => l.replace(/,/g, ";"))].join("\n");

const a0 = analyze(ds.rows)!;
for (const [label, text] of [
  ["en-header CSV", "﻿" + csv],
  ["ru-header ; CSV", ruCsv],
] as const) {
  const res = parseCsv(text, "test.csv");
  if (!res.dataset) throw new Error(`${label}: ${res.errors.join("; ")}`);
  const a1 = analyze(res.dataset.rows)!;
  const same =
    a1.meta.nStudents === a0.meta.nStudents &&
    Math.abs(a1.overall.mean - a0.overall.mean) < 1e-9 &&
    a1.textbooks.adjustedRank.join() === a0.textbooks.adjustedRank.join() &&
    a1.hours.sections.map((s) => s.recommended).join() === a0.hours.sections.map((s) => s.recommended).join();
  console.log(`${label}: rows ${res.dataset.rows.length}, warnings ${res.warnings.length}, identical analysis: ${same}`);
}

// Минимальный файл: только обязательные столбцы
const minimal = ["school,class_id,student_id,textbook,section,score,max_score", "S1,S1-7A,1,A,Тема 1,10,20", "S1,S1-7A,1,A,Тема 2,5,20"].join("\n");
const m = parseCsv(minimal, "min.csv");
console.log(`minimal CSV: ok=${!!m.dataset}, warnings=${m.warnings.length}, analysis=${!!analyze(m.dataset!.rows)}`);
const broken = parseCsv("foo,bar\n1,2", "bad.csv");
console.log(`broken CSV errors: ${broken.errors.length}`);
