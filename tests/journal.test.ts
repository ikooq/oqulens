// Импорт «как в журнале»: ученики × СОР, ФИО → коды, несколько файлов сразу.
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCsv, mergeDatasets } from "../src/lib/csv";
import { parseSorHeader } from "../src/lib/journal";
import { analyze } from "../src/lib/analytics";

test("заголовки СОР: номер, раздел, максимальный балл", () => {
  assert.deepEqual(parseSorHeader("СОР 1. Многочлены (макс 18)"), { col: "СОР 1. Многочлены (макс 18)", order: 1, section: "Многочлены", max: 18 });
  assert.equal(parseSorHeader("СОР2 / 15")?.max, 15);
  assert.equal(parseSorHeader("БЖБ 3 Көпмүшелер (15 балл)")?.section, "Көпмүшелер");
  assert.equal(parseSorHeader("СОР №4 из 20")?.max, 20);
  assert.equal(parseSorHeader("СОР 5")?.max, undefined);
  assert.equal(parseSorHeader("СОР 5")?.section, "СОР 5");
  assert.equal(parseSorHeader("Учебник"), null);
});

const journal = `Школа;Класс;ФИО;Учебник;СОР 1. Степень (макс 15);СОР 2. Многочлены (макс 18)
Школа 7;7А;Ахметов А.;Учебник А;12;14
Школа 7;7А;Иванова Б.;Учебник А;9;н
Школа 7;7А;Ким С.;Учебник А;15;18
`;

test("журнал разворачивается, ФИО заменяются кодами", () => {
  const res = parseCsv(journal, "7А.csv");
  assert.deepEqual(res.errors, []);
  const rows = res.dataset!.rows;
  assert.equal(rows.length, 5, "«н» (не писал) пропускается");
  assert.ok(rows.every((r) => /^S-[0-9A-Z]{7}$/.test(r.studentId)));
  assert.ok(!JSON.stringify(rows).includes("Ахметов"), "имён нет в данных");
  const r = rows.find((x) => x.section === "Многочлены" && x.score === 14)!;
  assert.equal(r.maxScore, 18);
  assert.equal(r.sectionOrder, 2);
  assert.equal(r.textbook, "Учебник А");
  const checks = res.dataset!.quality!.checks.map((c) => c.text).join(" ");
  assert.match(checks, /распознана как журнал/);
  assert.match(checks, /обезличенными кодами/);
});

test("максимум из строки «макс», школа и класс из имени файла", () => {
  const text = `ФИО,СОР 1,СОР 2\nМакс. балл,15,18\nАхметов А.,10,9\nКим С.,15,17\n`;
  const res = parseCsv(text, "Школа 3 7Б.csv");
  assert.deepEqual(res.errors, []);
  const rows = res.dataset!.rows;
  assert.equal(rows.length, 4);
  assert.ok(rows.every((r) => r.school === "Школа 3 7Б" && r.classId === "Школа 3 7Б"));
  assert.deepEqual([...new Set(rows.map((r) => r.maxScore))].sort(), [15, 18]);
});

test("нет максимального балла — понятная ошибка", () => {
  const res = parseCsv(`ФИО,СОР 1,СОР 2\nАхметов А.,10,9\n`, "x.csv");
  assert.equal(res.dataset, undefined);
  assert.match(res.errors[0], /максимальный балл/);
});

test("один и тот же ученик в двух файлах получает один код; файлы объединяются", () => {
  const a = parseCsv(journal, "a.csv").dataset!;
  const b = parseCsv(journal.replace(/7А/g, "7Б"), "b.csv").dataset!;
  const again = parseCsv(journal, "a2.csv").dataset!;
  assert.equal(a.rows[0].studentId, again.rows[0].studentId);
  assert.notEqual(a.rows[0].studentId, b.rows[0].studentId, "однофамильцы из разных классов не склеиваются");
  const m = mergeDatasets([
    { file: "a.csv", dataset: a },
    { file: "b.csv", dataset: b },
  ]);
  assert.equal(m.rows.length, a.rows.length + b.rows.length);
  assert.match(m.quality!.checks[0].text, /Объединено файлов: 2/);
  assert.ok(analyze(m.rows), "объединённые данные анализируются");
});

test("обычная «длинная» таблица не принимается за журнал", () => {
  const res = parseCsv("school,class_id,student_id,textbook,section,score,max_score\nA,1,U1,T,X,5,10\nA,1,U1,T,Y,6,10\n", "long.csv");
  assert.deepEqual(res.errors, []);
  assert.equal(res.dataset!.rows[0].studentId, "U1");
});
