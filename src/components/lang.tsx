"use client";

import { createContext, useContext } from "react";
import { Lang, tr } from "@/lib/i18n";
import { makeFmt } from "@/lib/format";

export const LangContext = createContext<Lang>("ru");

export const useLang = () => useContext(LangContext);

/** t("по-русски", "қазақша") */
export function useT() {
  const lang = useLang();
  return (ru: string, kk: string) => tr(lang, ru, kk);
}

/** Форматтеры с учётом языка: п.п. / п.т., склонения счётных слов. */
export function useFmt() {
  return makeFmt(useLang());
}
