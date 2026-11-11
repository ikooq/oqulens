// Выгружает демо-данные в CSV (public/demo) и проверяет, что импорт CSV и Excel
// даёт тот же результат анализа, что и данные в памяти.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { generateDemo } from "../src/lib/generator";
import { columnsHelpRows, parseCsv, toCsv, toSheetRows } from "../src/lib/csv";
import { parseXlsx } from "../src/lib/xlsx";
import { buildXlsx } from "../src/lib/xlsxWriter";
import { analyze, Analysis } from "../src/lib/analytics";

const SURNAMES = ["Ахметов", "Серікова", "Жұмабаев", "Иванова", "Нұрланов", "Бекова", "Ким", "Оспанов", "Сапарова", "Тоқтаров", "Петров", "Әлиева"];

/** Пример «как в журнале»: строки — ученики (вымышленные ФИО), столбцы — СОР с максимальным баллом. */
function journalExample(ds: ReturnType<typeof generateDemo>) {
  const cur = ds.rows.filter((r) => r.period === "2025–2026" && (r.school === "Школа 01" || r.school === "Школа 17"));
  const sections = [...new Map(cur.map((r) => [r.sectionOrder, r])).values()].sort((a, b) => a.sectionOrder - b.sectionOrder);
  const header = ["Школа", "Класс", "ФИО", "Учебник", ...sections.map((s) => `СОР ${s.sectionOrder}. ${s.section} (макс ${s.maxScore})`)];
  const byStudent = new Map<string, typeof cur>();
  for (const r of cur) byStudent.set(r.studentId, [...(byStudent.get(r.studentId) ?? []), r]);
  const rows: (string | number)[][] = [header];
  let i = 0;
  for (const rs of byStudent.values()) {
    const r0 = rs[0];
    const name = `${SURNAMES[i % SURNAMES.length]} ${"АБДЕЖКМНСТ"[(i * 7) % 10]}.`;
    i++;
    rows.push([r0.school, r0.classId.split(" · ")[1], name, r0.textbook, ...sections.map((s) => rs.find((x) => x.sectionOrder === s.sectionOrder)?.score ?? "")]);
  }
  return rows;
}

async function main() {
  const ds = generateDemo(2026);
  {
    const jr = journalExample(ds);
    writeFileSync("public/demo/oqulens_journal_example.xlsx", buildXlsx([{ name: "Журнал СОР", rows: jr, widths: [12, 8, 16, 12, 30, 22, 36, 30, 32, 28] }]));
    const back = await parseXlsx(new Uint8Array(readFileSync("public/demo/oqulens_journal_example.xlsx")).buffer, "journal.xlsx");
    const ids = new Set(back.dataset?.rows.map((r) => r.studentId));
    console.log(`journal example: ${jr.length - 1} students → rows ${back.dataset?.rows.length}, students ${ids.size}, errors ${back.errors.length}, names leaked: ${back.dataset?.rows.some((r) => /Ахметов|Иванова/.test(r.studentId))}`);
  }
  const csv = toCsv(ds.rows);
  mkdirSync("public/demo", { recursive: true });
  writeFileSync("public/demo/oqulens_demo_algebra7_zhambyl.csv", "﻿" + csv, "utf8");

  const a0 = analyze(ds.rows)!;
  const same = (a1: Analysis) =>
    a1.meta.nStudents === a0.meta.nStudents &&
    Math.abs(a1.overall.mean - a0.overall.mean) < 1e-9 &&
    a1.textbooks.adjustedRank.join() === a0.textbooks.adjustedRank.join() &&
    a1.hours.sections.map((s) => s.recommended).join() === a0.hours.sections.map((s) => s.recommended).join() &&
    a1.schools.map((p) => p.school).join() === a0.schools.map((p) => p.school).join();

  // Русские заголовки и «;» как разделитель — как в Excel
  const ruHeader = "район;школа;местность;язык;класс;ученик;учебник;раздел;номер_раздела;часы_план;часы_факт;балл;макс_балл;стартовый_уровень;учебный_год";
  const ruCsv = [ruHeader, ...csv.split(/\r?\n/).slice(1).map((l) => l.replace(/,/g, ";"))].join("\n");

  for (const [label, text] of [
    ["en-header CSV", "﻿" + csv],
    ["ru-header ; CSV", ruCsv],
  ] as const) {
    const res = parseCsv(text, "test.csv");
    if (!res.dataset) throw new Error(`${label}: ${res.errors.join("; ")}`);
    console.log(`${label}: rows ${res.dataset.rows.length}, warnings ${res.warnings.length}, identical analysis: ${same(analyze(res.dataset.rows)!)}`);
  }

  // Excel: полный демо-набор с русскими заголовками
  const xbytes = buildXlsx([
    { name: "Данные", rows: toSheetRows(ds.rows) },
    { name: "Описание", rows: columnsHelpRows() },
  ]);
  writeFileSync("public/demo/oqulens_demo_algebra7_zhambyl.xlsx", xbytes);
  const xres = await parseXlsx(xbytes.buffer.slice(xbytes.byteOffset, xbytes.byteOffset + xbytes.byteLength) as ArrayBuffer, "demo.xlsx");
  if (!xres.dataset) throw new Error(`xlsx: ${xres.errors.join("; ")}`);
  console.log(
    `xlsx (${(xbytes.byteLength / 1e6).toFixed(1)} MB): rows ${xres.dataset.rows.length}, identical analysis: ${same(analyze(xres.dataset.rows)!)}`,
  );
  console.log("quality:", xres.dataset.quality?.checks.map((c) => `[${c.level}] ${c.text}`).join(" | "));

  // Минимальный файл: только обязательные столбцы, с ошибками в данных
  const minimal = [
    "school,class_id,student_id,textbook,section,score,max_score",
    "S1,S1-7A,1,A,Тема 1,10,20",
    "S1,S1-7A,1,A,Тема 2,5,20",
    "S1,S1-7A,1,A,Тема 2,25,20",
    "S1,S1-7A,,A,Тема 2,5,20",
    "S1,S1-7A,2,A,Тема 1,,20",
  ].join("\n");
  const m = parseCsv(minimal, "min.csv");
  console.log(`minimal CSV: ok=${!!m.dataset}, warnings=${m.warnings.length}, analysis=${!!analyze(m.dataset!.rows)}`);
  console.log("quality:", m.dataset?.quality?.checks.map((c) => `[${c.level}] ${c.text}`).join(" | "));
  const broken = parseCsv("foo,bar\n1,2", "bad.csv");
  console.log(`broken CSV errors: ${broken.errors.length}`);
  const notXlsx = await parseXlsx(new TextEncoder().encode("not a zip").buffer as ArrayBuffer, "bad.xlsx");
  console.log(`broken xlsx errors: ${notXlsx.errors.length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
