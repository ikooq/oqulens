export const fmt1 = (x: number) => (Number.isFinite(x) ? x.toFixed(1).replace(".", ",") : "—");
export const pct = (x: number) => (Number.isFinite(x) ? `${Math.round(x)}%` : "—");
export const share = (x: number) => (Number.isFinite(x) ? `${Math.round(100 * x)}%` : "—");
export const share1 = (x: number) => (Number.isFinite(x) ? `${fmt1(100 * x)}%` : "—");
export const pp = (x: number) =>
  Number.isFinite(x) ? `${x > 0.05 ? "+" : x < -0.05 ? "−" : ""}${fmt1(Math.abs(x))} п.п.` : "—";
export const int = (x: number) => x.toLocaleString("ru-RU");
export function plural(n: number, forms: [string, string, string]): string {
  const a = Math.abs(n) % 100;
  const b = a % 10;
  if (a > 10 && a < 20) return forms[2];
  if (b > 1 && b < 5) return forms[1];
  if (b === 1) return forms[0];
  return forms[2];
}
export const nStudents = (n: number) => `${int(n)} ${plural(n, ["учащийся", "учащихся", "учащихся"])}`;
export const nSchools =(n: number) => `${n} ${plural(n, ["школа", "школы", "школ"])}`;
export const nClasses = (n: number) => `${n} ${plural(n, ["класс", "класса", "классов"])}`;
export const nSections = (n: number) => `${n} ${plural(n, ["раздел", "раздела", "разделов"])}`;
export const nDistricts = (n: number) => `${n} ${plural(n, ["район", "района", "районов"])}`;
export const signed =(x: number) => (x > 0 ? `+${x}` : x < 0 ? `−${Math.abs(x)}` : "0");

/** Цвет ячейки тепловой карты: красный → янтарный → зелёный. */
export function heatColor(v: number): string {
  if (!Number.isFinite(v)) return "transparent";
  const stops: [number, [number, number, number]][] = [
    [30, [220, 64, 70]],
    [45, [240, 132, 72]],
    [58, [246, 196, 86]],
    [70, [146, 200, 110]],
    [82, [56, 160, 105]],
  ];
  if (v <= stops[0][0]) return `rgb(${stops[0][1].join(",")})`;
  for (let i = 1; i < stops.length; i++) {
    const [x1, c1] = stops[i];
    const [x0, c0] = stops[i - 1];
    if (v <= x1) {
      const t = (v - x0) / (x1 - x0);
      const c = c0.map((a, k) => Math.round(a + (c1[k] - a) * t));
      return `rgb(${c.join(",")})`;
    }
  }
  return `rgb(${stops[stops.length - 1][1].join(",")})`;
}

export const heatText = (v: number) => (v < 40 || v > 76 ? "#fff" : "#1f2937");
