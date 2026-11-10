// Двуязычный интерфейс: русский и казахский.
// Строки задаются парой прямо в месте использования: tr(lang, "по-русски", "қазақша").

export type Lang = "ru" | "kk";

export const tr = (lang: Lang, ru: string, kk: string) => (lang === "kk" ? kk : ru);

export const LANGS: { value: Lang; label: string }[] = [
  { value: "ru", label: "Рус" },
  { value: "kk", label: "Қаз" },
];
