"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  BookOpen,
  Clock,
  Compass,
  Database,
  Download,
  FileText,
  Layers,
  LayoutDashboard,
  RotateCcw,
  School,
  ShieldCheck,
  TrendingUp,
  Upload,
  X,
} from "lucide-react";
import { analyze, applyFilters } from "@/lib/analytics";
import { analyzeDynamics } from "@/lib/dynamics";
import { columnsHelpRows, downloadText, ParseResult, parseCsv, toCsv, toSheetRows } from "@/lib/csv";
import { parseXlsx } from "@/lib/xlsx";
import { downloadXlsx } from "@/lib/xlsxWriter";
import { generateDemo, isRegionCenter } from "@/lib/generator";
import { int, makeFmt } from "@/lib/format";
import { Lang, LANGS, tr } from "@/lib/i18n";
import { Dataset, Filters } from "@/lib/types";
import { ReportContext } from "@/lib/report";
import { LangContext } from "./lang";
import { Segmented } from "./ui";
import Welcome from "./Welcome";
import OverviewTab from "./OverviewTab";
import SectionsTab from "./SectionsTab";
import SchoolsTab from "./SchoolsTab";
import TextbooksTab from "./TextbooksTab";
import HoursTab from "./HoursTab";
import DynamicsTab from "./DynamicsTab";
import ReportTab from "./ReportTab";
import Assistant from "./Assistant";
import { QuestionId, QUESTIONS } from "@/lib/answers";
import Tour from "./Tour";

export type Tab = "overview" | "sections" | "schools" | "textbooks" | "hours" | "dynamics" | "report";
const TABS: Tab[] = ["overview", "sections", "schools", "textbooks", "hours", "dynamics", "report"];

const NAV: { id: Tab; ru: string; kk: string; icon: React.ReactNode }[] = [
  { id: "overview", ru: "Обзор", kk: "Шолу", icon: <LayoutDashboard size={18} /> },
  { id: "sections", ru: "Трудные разделы", kk: "Қиын бөлімдер", icon: <Layers size={18} /> },
  { id: "schools", ru: "Школы", kk: "Мектептер", icon: <School size={18} /> },
  { id: "textbooks", ru: "Учебники", kk: "Оқулықтар", icon: <BookOpen size={18} /> },
  { id: "hours", ru: "Учебные часы", kk: "Оқу сағаттары", icon: <Clock size={18} /> },
  { id: "dynamics", ru: "Динамика по годам", kk: "Жылдар динамикасы", icon: <TrendingUp size={18} /> },
  { id: "report", ru: "Методическая записка", kk: "Әдістемелік жазба", icon: <FileText size={18} /> },
];

const ALL: Filters = { district: "all", locality: "all", language: "all" };
const isAll = (f: Filters) => f.district === "all" && f.locality === "all" && f.language === "all";
const DEMO_SEED = 2026;

const templateRows = (lang: Lang) => generateDemo(1, lang).rows.filter((r) => r.studentId <= "U00002");

export function downloadTemplate(lang: Lang = "ru") {
  downloadText(toCsv(templateRows(lang)), "oqulens_template.csv");
}

export function downloadTemplateXlsx(lang: Lang = "ru") {
  downloadXlsx(
    [
      {
        name: tr(lang, "Данные", "Деректер"),
        rows: toSheetRows(templateRows(lang), lang),
        widths: [18, 12, 10, 8, 16, 10, 12, 34, 14, 10, 10, 8, 10, 18],
      },
      { name: tr(lang, "Описание", "Сипаттама"), rows: columnsHelpRows(lang), widths: [20, 14, 44] },
    ],
    tr(lang, "oqulens_shablon.xlsx", "oqulens_ulgi.xlsx"),
  );
}

const schoolFromParam = (v: string | null, lang: Lang) =>
  !v ? undefined : /^\d+$/.test(v) ? `${lang === "kk" ? "Мектеп" : "Школа"} ${v.padStart(2, "0")}` : v;

export default function App() {
  const [lang, setLangState] = useState<Lang>("ru");
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [filters, setFilters] = useState<Filters>(ALL);
  const [tab, setTabState] = useState<Tab>("overview");
  const [messages, setMessages] = useState<{ tone: "error" | "warn"; text: string }[]>([]);
  const [school, setSchool] = useState<string | undefined>();
  const [tourOpen, setTourOpen] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [initialAsk, setInitialAsk] = useState<QuestionId | undefined>();
  const fileRef = useRef<HTMLInputElement>(null);
  const t = (ru: string, kk: string) => tr(lang, ru, kk);
  const f = makeFmt(lang);

  const setTab = (tb: Tab) => {
    setTabState(tb);
    window.scrollTo({ top: 0 });
  };
  const openSchool = (s: string) => {
    setSchool(s);
    setTab("schools");
  };

  // Язык из ссылки или из прошлого визита; прямые ссылки на демо: ?demo=1&tab=schools&school=42&lang=kk&tour=1
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    let l: Lang = "ru";
    try {
      const saved = localStorage.getItem("oqulens.lang");
      if (saved === "ru" || saved === "kk") l = saved;
    } catch {
      /* хранилище недоступно */
    }
    const pl = p.get("lang");
    if (pl === "ru" || pl === "kk") l = pl;
    setLangState(l);
    if (p.get("demo") || p.get("tour")) {
      setDataset(generateDemo(DEMO_SEED, l));
      const pt = p.get("tab") as Tab | null;
      if (pt && TABS.includes(pt)) setTabState(pt);
      setSchool(schoolFromParam(p.get("school"), l));
      if (p.get("tour")) setTourOpen(true);
      const ask = p.get("ask");
      if (ask && QUESTIONS.some((q) => q.id === ask)) setInitialAsk(ask as QuestionId);
      if (ask || p.get("assistant")) setAssistantOpen(true);
    }
  }, []);

  const setLang = (l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem("oqulens.lang", l);
    } catch {
      /* хранилище недоступно */
    }
    if (dataset?.synthetic) {
      setDataset(generateDemo(DEMO_SEED, l));
      setFilters(ALL);
      setSchool(undefined);
    }
  };

  const rows = useMemo(() => (dataset ? applyFilters(dataset.rows, filters) : []), [dataset, filters]);
  const analysis = useMemo(() => analyze(rows), [rows]);
  const dynamics = useMemo(() => analyzeDynamics(rows), [rows]);

  const options = useMemo(() => {
    const rs = dataset?.rows ?? [];
    const districts = [...new Set(rs.map((r) => r.district))].sort((a, b) =>
      isRegionCenter(a) ? -1 : isRegionCenter(b) ? 1 : a.localeCompare(b, "ru"),
    );
    return {
      districts,
      localities: [...new Set(rs.map((r) => r.locality))],
      languages: [...new Set(rs.map((r) => r.language))],
    };
  }, [dataset]);

  const openDemo = (withTour = false) => {
    setDataset(generateDemo(DEMO_SEED, lang));
    setFilters(ALL);
    setSchool(undefined);
    setTab("overview");
    setMessages([]);
    setTourOpen(withTour);
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    const lower = file.name.toLowerCase();
    let res: ParseResult;
    if (lower.endsWith(".xls")) {
      res = {
        errors: [
          t(
            "Старый формат .xls не поддерживается. Сохраните файл в Excel как .xlsx или CSV.",
            "Ескі .xls пішіміне қолдау жоқ. Файлды Excel-де .xlsx немесе CSV ретінде сақтаңыз.",
          ),
        ],
        warnings: [],
      };
    } else if (lower.endsWith(".xlsx")) {
      res = await parseXlsx(await file.arrayBuffer(), file.name, lang);
    } else {
      res = parseCsv(await file.text(), file.name, lang);
    }
    if (!res.dataset) {
      setMessages(res.errors.map((text) => ({ tone: "error" as const, text })));
      return;
    }
    setDataset(res.dataset);
    setFilters(ALL);
    setSchool(undefined);
    setTab("overview");
    setTourOpen(false);
    const issues = res.dataset.quality?.checks.filter((c) => c.level === "warn").length ?? 0;
    setMessages(
      issues
        ? [
            {
              tone: "warn" as const,
              text: t(
                `Данные загружены, но есть замечания (${issues}). Подробности — в блоке «Качество данных» на вкладке «Обзор».`,
                `Деректер жүктелді, бірақ ескертулер бар (${issues}). Толығырақ — «Шолу» қойындысындағы «Деректер сапасы» блогында.`,
              ),
            },
          ]
        : [],
    );
  };

  const title = dataset ? (dataset.synthetic ? `${dataset.subject}, ${dataset.grade} — ${dataset.region}` : dataset.name) : "";
  const scope = [
    filters.district === "all" ? t("все районы", "барлық аудандар") : filters.district,
    filters.locality === "all" ? null : filters.locality === "город" ? t("городские школы", "қалалық мектептер") : t("сельские школы", "ауылдық мектептер"),
    filters.language === "all"
      ? null
      : filters.language === "каз"
        ? t("казахский язык обучения", "қазақ тілінде оқыту")
        : t("русский язык обучения", "орыс тілінде оқыту"),
  ]
    .filter(Boolean)
    .join(", ");
  const ctx: ReportContext = {
    title,
    scope,
    synthetic: !!dataset?.synthetic,
    date: new Date().toLocaleDateString(lang === "kk" ? "kk-KZ" : "ru-RU", { day: "numeric", month: "long", year: "numeric" }),
  };

  const fileInput = (
    <input
      ref={fileRef}
      type="file"
      accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      className="hidden"
      onChange={(e) => {
        onFile(e.target.files?.[0]);
        e.target.value = "";
      }}
    />
  );

  const toast = messages.length > 0 && (
    <div className="fixed right-5 bottom-20 z-50 w-[min(380px,calc(100vw-40px))] space-y-2 print:hidden">
      {messages.map((m, i) => (
        <div
          key={i}
          className={`flex items-start gap-2 rounded-xl px-4 py-3 text-[13px] shadow-lg ring-1 ${
            m.tone === "error" ? "bg-red-50 text-red-800 ring-red-200" : "bg-amber-50 text-amber-900 ring-amber-200"
          }`}
        >
          <span className="flex-1">{m.text}</span>
          <button onClick={() => setMessages((ms) => ms.filter((_, j) => j !== i))} aria-label={t("Закрыть", "Жабу")}>
            <X size={15} />
          </button>
        </div>
      ))}
    </div>
  );

  const langSwitch = (dark: boolean) => <Segmented value={lang} onChange={setLang} options={LANGS} dark={dark} />;

  if (!dataset || !analysis) {
    return (
      <LangContext.Provider value={lang}>
        {fileInput}
        <Welcome
          onDemo={() => openDemo(false)}
          onTour={() => openDemo(true)}
          onUpload={() => fileRef.current?.click()}
          onTemplate={() => downloadTemplateXlsx(lang)}
          onTemplateCsv={() => downloadTemplate(lang)}
          langSwitch={langSwitch(true)}
        />
        {toast}
      </LangContext.Provider>
    );
  }

  const select = (key: keyof Filters, label: string, values: string[], render?: (v: string) => string) => (
    <label className="flex min-w-0 items-center gap-2 text-[12.5px] text-muted">
      <span className="hidden xl:inline">{label}</span>
      <select
        value={filters[key]}
        onChange={(e) => setFilters({ ...filters, [key]: e.target.value })}
        aria-label={label}
        className="h-9 w-full min-w-0 rounded-lg border border-line bg-white px-2 text-[13px] font-medium text-slate-800 outline-none focus:border-brand sm:w-auto sm:px-2.5"
      >
        <option value="all">{key === "district" ? t("Все районы", "Барлық аудандар") : t("Все", "Барлығы")}</option>
        {values.map((v) => (
          <option key={v} value={v}>
            {render ? render(v) : v}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <LangContext.Provider value={lang}>
      <div className="flex min-h-screen">
        {fileInput}
        {/* Боковая панель */}
        <aside className="sticky top-0 hidden h-screen w-[248px] shrink-0 flex-col bg-ink text-slate-300 lg:flex print:hidden">
          <div className="px-5 pt-6 pb-4">
            <Logo />
            <p className="mt-1.5 text-[11.5px] tracking-wide text-slate-400 uppercase">Data-Driven Curriculum</p>
            <div className="mt-4">{langSwitch(true)}</div>
          </div>
          <nav className="flex-1 space-y-0.5 overflow-y-auto px-3">
            {NAV.map((n) => (
              <button
                key={n.id}
                onClick={() => setTab(n.id)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[13.5px] font-semibold transition ${
                  tab === n.id ? "bg-white/10 text-white" : "hover:bg-white/5 hover:text-white"
                }`}
              >
                <span className={tab === n.id ? "text-emerald-300" : "text-slate-500"}>{n.icon}</span>
                {t(n.ru, n.kk)}
              </button>
            ))}
            {dataset.synthetic && (
              <button
                onClick={() => setTourOpen(true)}
                className="mt-3 flex w-full items-center gap-3 rounded-lg border border-emerald-400/30 px-3 py-2.5 text-left text-[13px] font-semibold text-emerald-200 transition hover:bg-emerald-400/10"
              >
                <Compass size={17} /> {t("Экскурсия по демо", "Демо бойынша саяхат")}
              </button>
            )}
          </nav>
          <div className="m-3 rounded-xl bg-ink-2 p-3.5 text-[12px]">
            <div className="flex items-center gap-2 font-semibold text-slate-200">
              <Database size={14} /> {t("Данные", "Деректер")}
            </div>
            <p className="mt-1.5 leading-snug text-slate-400">
              {dataset.synthetic ? t("Демо (синтетические данные)", "Демо (синтетикалық деректер)") : dataset.name}
            </p>
            <p className="tabular mt-1 text-slate-400">
              {int(dataset.rows.length)} {t("результатов СОР", "БЖБ нәтижесі")}
            </p>
            <div className="mt-3 grid gap-1.5">
              <SideButton icon={<Upload size={14} />} onClick={() => fileRef.current?.click()}>
                {t("Загрузить CSV / Excel", "CSV / Excel жүктеу")}
              </SideButton>
              {dataset.synthetic && (
                <SideButton
                  icon={<Download size={14} />}
                  onClick={() => downloadXlsx([{ name: t("Данные", "Деректер"), rows: toSheetRows(dataset.rows, lang) }], "oqulens_demo_algebra7.xlsx")}
                >
                  {t("Скачать демо (Excel)", "Демоны жүктеп алу (Excel)")}
                </SideButton>
              )}
              <SideButton icon={<Download size={14} />} onClick={() => downloadTemplateXlsx(lang)}>
                {t("Шаблон Excel", "Excel үлгісі")}
              </SideButton>
              <SideButton
                icon={<RotateCcw size={14} />}
                onClick={() => {
                  setDataset(null);
                  setMessages([]);
                  setTourOpen(false);
                }}
              >
                {t("На главную", "Басты бетке")}
              </SideButton>
            </div>
          </div>
          <div className="flex items-start gap-2 px-5 pb-5 text-[11px] leading-snug text-slate-500">
            <ShieldCheck size={14} className="mt-0.5 shrink-0" />
            {t("Данные учеников обрабатываются в браузере и никуда не отправляются.", "Оқушылар деректері браузерде өңделеді және ешқайда жіберілмейді.")}
          </div>
        </aside>

        {/* Основная часть */}
        <main className="min-w-0 flex-1">
          <header className="z-30 border-b border-line bg-surface/90 backdrop-blur md:sticky md:top-0 print:hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <div className="lg:hidden">
                    <Logo dark />
                  </div>
                  <h1 className="truncate text-[17px] font-extrabold text-slate-900">{title}</h1>
                  {dataset.synthetic && <span className="rounded-md bg-amber-100 px-1.5 py-0.5 text-[11px] font-bold text-amber-800">ДЕМО</span>}
                </div>
                <p className="tabular text-[12.5px] text-muted">
                  {f.nStudents(analysis.meta.nStudents)} · {f.nSchools(analysis.meta.nSchools)} · {f.nClasses(analysis.meta.nClasses)} ·{" "}
                  {f.nSections(analysis.meta.sections.length)}
                </p>
              </div>
              <div className="grid w-full grid-cols-[2fr_1fr_1fr] gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center sm:gap-2.5">
                {select("district", t("Район", "Аудан"), options.districts)}
                {options.localities.length > 1 &&
                  select("locality", t("Местность", "Елді мекен"), options.localities, (v) => (v === "город" ? t("Город", "Қала") : t("Село", "Ауыл")))}
                {options.languages.length > 1 &&
                  select("language", t("Язык", "Тіл"), options.languages, (v) => (v === "каз" ? t("Казахский", "Қазақ") : t("Русский", "Орыс")))}
              </div>
            </div>
            <div className="flex items-center gap-2 px-4 pb-2 lg:hidden">
              <div className="no-scrollbar flex min-w-0 flex-1 gap-1 overflow-x-auto">
                {NAV.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => setTab(n.id)}
                    className={`shrink-0 rounded-lg px-3 py-1.5 text-[12.5px] font-semibold ${tab === n.id ? "bg-ink text-white" : "text-slate-600"}`}
                  >
                    {t(n.ru, n.kk)}
                  </button>
                ))}
              </div>
              <div className="shrink-0">{langSwitch(false)}</div>
            </div>
          </header>
          <div className="mx-auto max-w-[1280px] px-4 py-5 sm:px-6 sm:py-6">
            {tab === "overview" && (
              <OverviewTab a={analysis} go={setTab} truth={isAll(filters) ? dataset.truth : undefined} quality={dataset.quality} dyn={dynamics} />
            )}
            {tab === "sections" && <SectionsTab a={analysis} onSchool={openSchool} />}
            {tab === "schools" && <SchoolsTab a={analysis} school={school} onSelect={setSchool} />}
            {tab === "textbooks" && <TextbooksTab a={analysis} />}
            {tab === "hours" && <HoursTab a={analysis} />}
            {tab === "dynamics" && <DynamicsTab a={analysis} d={dynamics} onSchool={openSchool} />}
            {tab === "report" && <ReportTab a={analysis} ctx={ctx} dyn={dynamics} />}
          </div>
        </main>
        {toast}
        <Assistant
          a={analysis}
          ctx={ctx}
          truth={isAll(filters) ? dataset.truth : undefined}
          dyn={dynamics}
          initialAsk={initialAsk}
          open={assistantOpen}
          onOpenChange={setAssistantOpen}
          onNavigate={(tb, s) => (s ? openSchool(s) : setTab(tb))}
        />
        {tourOpen && (
          <Tour
            a={analysis}
            dyn={dynamics}
            hasTruth={!!dataset.truth && isAll(filters)}
            onTab={setTab}
            onSchool={openSchool}
            onAssistant={() => setAssistantOpen(true)}
            onClose={() => setTourOpen(false)}
          />
        )}
      </div>
    </LangContext.Provider>
  );
}

function SideButton({ icon, children, onClick }: { icon: React.ReactNode; children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[12.5px] font-medium text-slate-300 transition hover:bg-white/10 hover:text-white"
    >
      {icon}
      {children}
    </button>
  );
}

export function Logo({ dark = false }: { dark?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <svg width="26" height="26" viewBox="0 0 32 32" aria-hidden>
        <rect width="32" height="32" rx="9" fill="#0f8a6c" />
        <circle cx="14" cy="14" r="6.5" fill="none" stroke="#fff" strokeWidth="2.6" />
        <path d="M19 19l5.5 5.5" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" />
        <path d="M11 15.5l2 -3 2 2 2 -3.5" fill="none" stroke="#9ef0d2" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className={`text-[19px] font-extrabold tracking-tight ${dark ? "text-slate-900" : "text-white"}`}>
        Oqu<span className={dark ? "text-brand" : "text-emerald-400"}>Lens</span>
      </span>
    </div>
  );
}
