// Импорт данных: CSV с заголовками на трёх языках, проверка ошибок и качества файла.
import { test } from "node:test";
import assert from "node:assert/strict";
import Papa from "papaparse";
import { generateDemo } from "../src/lib/generator";
import { parseCsv, toCsv, toSheetRows } from "../src/lib/csv";

const sample = () => generateDemo(1).rows.filter((r) => r.school <= "Школа 03");

test("CSV: экспорт → импорт без потерь", () => {
  const rows = sample();
  const res = parseCsv(toCsv(rows), "demo.csv");
  assert.deepEqual(res.errors, []);
  assert.equal(res.dataset!.rows.length, rows.length);
  assert.deepEqual(res.dataset!.rows[0], rows[0]);
  assert.equal(res.dataset!.name, "demo");
});

for (const lang of ["ru", "kk"] as const) {
  test(`CSV с заголовками на языке «${lang}» и разделителем «;»`, () => {
    const table = toSheetRows(sample(), lang);
    const text = Papa.unparse(table, { delimiter: ";" });
    const res = parseCsv("﻿" + text, "file.csv", lang);
    assert.deepEqual(res.errors, []);
    assert.equal(res.dataset!.rows.length, table.length - 1);
    const r = res.dataset!.rows[0];
    assert.ok(r.locality === "город" || r.locality === "село", "значения местности приведены к единому виду");
    assert.ok(r.language === "каз" || r.language === "рус");
  });
}

test("нет обязательного столбца — понятная ошибка", () => {
  const res = parseCsv("school,class_id,student_id,section,score\nA,1,U1,X,5\n", "bad.csv");
  assert.equal(res.dataset, undefined);
  assert.ok(res.errors.length > 0);
  assert.ok(res.errors.some((e) => /textbook|учебник/i.test(e)), res.errors.join("; "));
});

test("ошибки в баллах попадают в отчёт о качестве", () => {
  const rows = sample();
  const broken = rows.map((r, i) => (i === 0 ? { ...r, score: r.maxScore + 5 } : r));
  const res = parseCsv(toCsv([...broken, broken[1]]), "q.csv");
  const checks = res.dataset?.quality?.checks ?? [];
  assert.ok(checks.some((c) => c.level === "warn"), JSON.stringify(checks));
});
