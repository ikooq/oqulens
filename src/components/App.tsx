"use client";

import { useMemo, useRef, useState } from "react";
import {
  BookOpen,
  Clock,
  Database,
  Download,
  FileText,
  Layers,
  LayoutDashboard,
  RotateCcw,
  School,
  ShieldCheck,
  Upload,
  X,
} from "lucide-react";
import { analyze, applyFilters } from "@/lib/analytics";
import { columnsHelpRows, downloadText, ParseResult, parseCsv, toCsv, toSheetRows } from "@/lib/csv";
import { parseXlsx } from "@/lib/xlsx";
import { downloadXlsx } from "@/lib/xlsxWriter";
import { generateDemo } from "@/lib/generator";
import { int, nClasses, nSchools, nSections, nStudents } from "@/lib/format";
import { Dataset, Filters } from "@/lib/types";
import { ReportContext } from "@/lib/report";
import Welcome from "./Welcome";
import OverviewTab from "./OverviewTab";
import SectionsTab from "./SectionsTab";
import SchoolsTab from "./SchoolsTab";
import TextbooksTab from "./TextbooksTab";
import HoursTab from "./HoursTab";
import ReportTab from "./ReportTab";

export type Tab = "overview" | "sections" | "schools" | "textbooks" | "hours" | "report";

const NAV: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "overview", label: "Обзор", icon: <LayoutDashboard size={18} /> },
  { id: "sections", label: "Трудные разделы", icon: <Layers size={18} /> },
  { id: "schools", label: "Школы", icon: <School size={18} /> },
  { id: "textbooks", label: "Учебники", icon: <BookOpen size={18} /> },
  { id: "hours", label: "Учебные часы", icon: <Clock size={18} /> },
  { id: "report", label: "Методическая записка", icon: <FileText size={18} /> },
];

const ALL: Filters = { district: "all", locality: "all", language: "all" };
const isAll = (f: Filters) => f.district === "all" && f.locality === "all" && f.language === "all";

const templateRows = () => generateDemo(1).rows.filter((r) => r.studentId <= "U00002");

export function downloadTemplate() {
  downloadText(toCsv(templateRows()), "oqulens_template.csv");
}

export function downloadTemplateXlsx() {
  downloadXlsx(
    [
      { name: "Данные", rows: toSheetRows(templateRows()), widths: [18, 12, 10, 8, 16, 10, 12, 34, 14, 10, 10, 8, 10, 18] },
      { name: "Описание", rows: columnsHelpRows(), widths: [20, 14, 44] },
    ],
    "oqulens_shablon.xlsx",
  );
}

export default function App() {
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [filters, setFilters] = useState<Filters>(ALL);
  const [tab, setTabState] = useState<Tab>("overview");
  const setTab = (t: Tab) => {
    setTabState(t);
    window.scrollTo({ top: 0 });
  };
  const [messages, setMessages] = useState<{ tone: "error" | "warn"; text: string }[]>([]);
  const [school, setSchool] = useState<string | undefined>();
  const openSchool = (s: string) => {
    setSchool(s);
    setTab("schools");
  };
  const fileRef = useRef<HTMLInputElement>(null);

  const rows = useMemo(() => (dataset ? applyFilters(dataset.rows, filters) : []), [dataset, filters]);
  const analysis = useMemo(() => analyze(rows), [rows]);

  const options = useMemo(() => {
    const rs = dataset?.rows ?? [];
    const districts = [...new Set(rs.map((r) => r.district))].sort((a, b) =>
      a === "г. Тараз" ? -1 : b === "г. Тараз" ? 1 : a.localeCompare(b, "ru"),
    );
    return {
      districts,
      localities: [...new Set(rs.map((r) => r.locality))],
      languages: [...new Set(rs.map((r) => r.language))],
    };
  }, [dataset]);

  const openDemo = () => {
    setDataset(generateDemo(2026));
    setFilters(ALL);
    setSchool(undefined);
    setTab("overview");
    setMessages([]);
  };

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    const lower = f.name.toLowerCase();
    let res: ParseResult;
    if (lower.endsWith(".xls")) {
      res = { errors: ["Старый формат .xls не поддерживается. Сохраните файл в Excel как .xlsx или CSV."], warnings: [] };
    } else if (lower.endsWith(".xlsx")) {
      res = await parseXlsx(await f.arrayBuffer(), f.name);
    } else {
      res = parseCsv(await f.text(), f.name);
    }
    if (!res.dataset) {
      setMessages(res.errors.map((t) => ({ tone: "error" as const, text: t })));
      return;
    }
    setDataset(res.dataset);
    setFilters(ALL);
    setSchool(undefined);
    setTab("overview");
    const issues = res.dataset.quality?.checks.filter((c) => c.level === "warn").length ?? 0;
    setMessages(
      issues
        ? [{ tone: "warn" as const, text: `Данные загружены, но есть замечания (${issues}). Подробности — в блоке «Качество данных» на вкладке «Обзор».` }]
        : [],
    );
  };

  const title = dataset
    ? dataset.synthetic
      ? `${dataset.subject}, ${dataset.grade} — ${dataset.region}`
      : dataset.name
    : "";
  const scope = [
    filters.district === "all" ? "все районы" : filters.district,
    filters.locality === "all" ? null : filters.locality === "город" ? "городские школы" : "сельские школы",
    filters.language === "all" ? null : filters.language === "каз" ? "казахский язык обучения" : "русский язык обучения",
  ]
    .filter(Boolean)
    .join(", ");
  const ctx: ReportContext = {
    title,
    scope,
    synthetic: !!dataset?.synthetic,
    date: new Date().toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" }),
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
    <div className="fixed right-5 bottom-5 z-50 w-[380px] space-y-2 print:hidden">
      {messages.map((m, i) => (
        <div
          key={i}
          className={`flex items-start gap-2 rounded-xl px-4 py-3 text-[13px] shadow-lg ring-1 ${
            m.tone === "error" ? "bg-red-50 text-red-800 ring-red-200" : "bg-amber-50 text-amber-900 ring-amber-200"
          }`}
        >
          <span className="flex-1">{m.text}</span>
          <button onClick={() => setMessages((ms) => ms.filter((_, j) => j !== i))} aria-label="Закрыть">
            <X size={15} />
          </button>
        </div>
      ))}
    </div>
  );

  if (!dataset || !analysis) {
    return (
      <>
        {fileInput}
        <Welcome
          onDemo={openDemo}
          onUpload={() => fileRef.current?.click()}
          onTemplate={downloadTemplateXlsx}
          onTemplateCsv={downloadTemplate}
        />
        {toast}
      </>
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
        <option value="all">{key === "district" ? "Все районы" : "Все"}</option>
        {values.map((v) => (
          <option key={v} value={v}>
            {render ? render(v) : v}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <div className="flex min-h-screen">
      {fileInput}
      {/* Боковая панель */}
      <aside className="sticky top-0 hidden h-screen w-[248px] shrink-0 flex-col bg-ink text-slate-300 lg:flex print:hidden">
        <div className="px-5 pt-6 pb-5">
          <Logo />
          <p className="mt-1.5 text-[11.5px] tracking-wide text-slate-400 uppercase">Data-Driven Curriculum</p>
        </div>
        <nav className="flex-1 space-y-0.5 px-3">
          {NAV.map((n) => (
            <button
              key={n.id}
              onClick={() => setTab(n.id)}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[13.5px] font-semibold transition ${
                tab === n.id ? "bg-white/10 text-white" : "hover:bg-white/5 hover:text-white"
              }`}
            >
              <span className={tab === n.id ? "text-emerald-300" : "text-slate-500"}>{n.icon}</span>
              {n.label}
            </button>
          ))}
        </nav>
        <div className="m-3 rounded-xl bg-ink-2 p-3.5 text-[12px]">
          <div className="flex items-center gap-2 font-semibold text-slate-200">
            <Database size={14} /> Данные
          </div>
          <p className="mt-1.5 leading-snug text-slate-400">{dataset.synthetic ? "Демо (синтетические данные)" : dataset.name}</p>
          <p className="tabular mt-1 text-slate-400">{int(dataset.rows.length)} результатов СОР</p>
          <div className="mt-3 grid gap-1.5">
            <SideButton icon={<Upload size={14} />} onClick={() => fileRef.current?.click()}>
              Загрузить CSV / Excel
            </SideButton>
            {dataset.synthetic && (
              <SideButton
                icon={<Download size={14} />}
                onClick={() => downloadXlsx([{ name: "Данные", rows: toSheetRows(dataset.rows) }], "oqulens_demo_algebra7.xlsx")}
              >
                Скачать демо (Excel)
              </SideButton>
            )}
            <SideButton icon={<Download size={14} />} onClick={downloadTemplateXlsx}>
              Шаблон Excel
            </SideButton>
            <SideButton
              icon={<RotateCcw size={14} />}
              onClick={() => {
                setDataset(null);
                setMessages([]);
              }}
            >
              На главную
            </SideButton>
          </div>
        </div>
        <div className="flex items-start gap-2 px-5 pb-5 text-[11px] leading-snug text-slate-500">
          <ShieldCheck size={14} className="mt-0.5 shrink-0" />
          Данные учеников обрабатываются в браузере и никуда не отправляются.
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
                {nStudents(analysis.meta.nStudents)} · {nSchools(analysis.meta.nSchools)} · {nClasses(analysis.meta.nClasses)} ·{" "}
                {nSections(analysis.meta.sections.length)}
              </p>
            </div>
            <div className="grid w-full grid-cols-[2fr_1fr_1fr] gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center sm:gap-2.5">
              {select("district", "Район", options.districts)}
              {options.localities.length > 1 && select("locality", "Местность", options.localities, (v) => (v === "город" ? "Город" : "Село"))}
              {options.languages.length > 1 &&
                select("language", "Язык", options.languages, (v) => (v === "каз" ? "Казахский" : "Русский"))}
            </div>
          </div>
          <div className="no-scrollbar flex gap-1 overflow-x-auto px-4 pb-2 lg:hidden">
            {NAV.map((n) => (
              <button
                key={n.id}
                onClick={() => setTab(n.id)}
                className={`shrink-0 rounded-lg px-3 py-1.5 text-[12.5px] font-semibold ${tab === n.id ? "bg-ink text-white" : "text-slate-600"}`}
              >
                {n.label}
              </button>
            ))}
          </div>
        </header>
        <div className="mx-auto max-w-[1280px] px-4 py-5 sm:px-6 sm:py-6">
          {tab === "overview" && (
            <OverviewTab a={analysis} go={setTab} truth={isAll(filters) ? dataset.truth : undefined} quality={dataset.quality} />
          )}
          {tab === "sections" && <SectionsTab a={analysis} onSchool={openSchool} />}
          {tab === "schools" && <SchoolsTab a={analysis} school={school} onSelect={setSchool} />}
          {tab === "textbooks" && <TextbooksTab a={analysis} />}
          {tab === "hours" && <HoursTab a={analysis} />}
          {tab === "report" && <ReportTab a={analysis} ctx={ctx} />}
        </div>
      </main>
      {toast}
    </div>
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
