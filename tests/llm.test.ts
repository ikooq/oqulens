// ИИ-модуль: выбор провайдера по ключам, сжатие сводки, отсутствие ключей в тексте ошибок.
import { test } from "node:test";
import assert from "node:assert/strict";
import { activeProvider, cleanKey, compactSummary, safeDetail } from "../src/lib/llm";

const KEYS = ["ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "GROQ_API_KEY", "GEMINI_API_KEY", "GOOGLE_API_KEY", "AI_PROVIDER"];

function withEnv(env: Record<string, string>, fn: () => void) {
  const saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));
  for (const k of KEYS) delete process.env[k];
  Object.assign(process.env, env);
  try {
    fn();
  } finally {
    for (const k of KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  }
}

test("провайдер выбирается по ключам: Claude → Groq → Gemini", () => {
  withEnv({}, () => assert.equal(activeProvider(), null));
  withEnv({ GEMINI_API_KEY: "g" }, () => assert.equal(activeProvider(), "gemini"));
  withEnv({ GEMINI_API_KEY: "g", GROQ_API_KEY: "q" }, () => assert.equal(activeProvider(), "groq"));
  withEnv({ GEMINI_API_KEY: "g", GROQ_API_KEY: "q", ANTHROPIC_API_KEY: "a" }, () => assert.equal(activeProvider(), "claude"));
  withEnv({ GROQ_API_KEY: "q", ANTHROPIC_API_KEY: "a", AI_PROVIDER: "groq" }, () => assert.equal(activeProvider(), "groq"));
  // Явный выбор без ключа игнорируется
  withEnv({ GROQ_API_KEY: "q", AI_PROVIDER: "gemini" }, () => assert.equal(activeProvider(), "groq"));
  // Ключ из одних пробелов и кавычек не считается
  withEnv({ GROQ_API_KEY: ' " ' }, () => assert.equal(activeProvider(), null));
});

test("ключ очищается от пробелов, переносов и кавычек", () => {
  assert.equal(cleanKey('  "gsk_abc"\n'), "gsk_abc");
  assert.equal(cleanKey(undefined), "");
});

test("в текст ошибки не попадает ключ", () => {
  const d = safeDetail("PERMISSION_DENIED", "bad key AIzaSyA1234567890abcdef and gsk_ABCDEFGHIJKLMNOP");
  assert.ok(!d.includes("AIzaSy") && !d.includes("gsk_ABC"), d);
  assert.ok(d.startsWith("PERMISSION_DENIED: "));
  assert.ok(safeDetail(undefined, "x".repeat(1000)).length <= 220);
});

test("сжатая сводка для бесплатных моделей короче и без лишних полей", () => {
  const summary = {
    key_findings: ["a", "b"],
    textbooks: { method: "long text", rows: [1] },
    schools: { method: "m", below_expected: Array.from({ length: 12 }, (_, i) => i), above_expected: [1, 2] },
    hours: { sections: [{ name: "x", reason: "long" }] },
    sections: [{ name: "s", schools_below_expected: [1, 2, 3, 4] }],
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c = compactSummary(summary) as any;
  assert.equal(c.key_findings, undefined);
  assert.equal(c.textbooks.method, undefined);
  assert.equal(c.schools.below_expected.length, 5);
  assert.equal(c.hours.sections[0].reason, undefined);
  assert.equal(c.sections[0].schools_below_expected.length, 2);
  // Исходник не изменился
  assert.equal(summary.key_findings.length, 2);
});
