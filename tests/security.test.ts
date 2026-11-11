// Защита ИИ-эндпоинтов: лимиты запросов и отказ запросам с чужих сайтов.
import { test } from "node:test";
import assert from "node:assert/strict";
import { foreignOrigin, guard, hit } from "../src/lib/rateLimit";

test("лимит в окне и сброс после окна", () => {
  const lim = [{ max: 3, windowMs: 1000 }];
  const t0 = 1_000_000;
  assert.ok(hit("k1", lim, t0).ok);
  assert.ok(hit("k1", lim, t0 + 1).ok);
  assert.ok(hit("k1", lim, t0 + 2).ok);
  const r = hit("k1", lim, t0 + 3);
  assert.equal(r.ok, false);
  assert.ok(r.retryAfter >= 1);
  assert.ok(hit("k2", lim, t0 + 3).ok, "другой адрес не затронут");
  assert.ok(hit("k1", lim, t0 + 1001).ok, "после окна снова можно");
});

test("отказ в длинном окне не списывает попытку из короткого", () => {
  const lim = [
    { max: 5, windowMs: 1000 },
    { max: 2, windowMs: 100_000 },
  ];
  const t0 = 2_000_000;
  assert.ok(hit("k3", lim, t0).ok);
  assert.ok(hit("k3", lim, t0 + 1).ok);
  assert.equal(hit("k3", lim, t0 + 2).ok, false);
  assert.equal(hit("k3", lim, t0 + 2000).ok, false, "суточный лимит держится");
});

const req = (headers: Record<string, string>) => new Request("https://oqulens.vercel.app/api/ask", { method: "POST", headers });

test("запросы с чужого сайта отклоняются", () => {
  assert.equal(foreignOrigin(req({ host: "oqulens.vercel.app", origin: "https://oqulens.vercel.app" })), false);
  assert.equal(foreignOrigin(req({ host: "oqulens.vercel.app", origin: "https://evil.example" })), true);
  assert.equal(foreignOrigin(req({ host: "oqulens.vercel.app" })), false);
  const res = guard(req({ host: "oqulens.vercel.app", origin: "https://evil.example" }), "ask", "ru");
  assert.equal(res?.status, 403);
});

test("после 10 вопросов в минуту с одного адреса — 429 с понятным текстом", async () => {
  const h = { host: "oqulens.vercel.app", origin: "https://oqulens.vercel.app", "x-real-ip": "203.0.113.7" };
  for (let i = 0; i < 10; i++) assert.equal(guard(req(h), "ask", "ru"), null, `запрос ${i + 1}`);
  const res = guard(req(h), "ask", "kk")!;
  assert.equal(res.status, 429);
  assert.ok(Number(res.headers.get("Retry-After")) > 0);
  const body = await res.json();
  assert.match(body.message, /ИИ-ге сұраныстар тым көп/);
  assert.equal(guard(req({ ...h, "x-real-ip": "203.0.113.8" }), "ask", "ru"), null, "другой адрес работает");
});
