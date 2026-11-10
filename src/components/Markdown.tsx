import { ReactNode } from "react";

// Минимальный Markdown-рендерер: заголовки, списки, жирный/курсив.

function inline(s: string): ReactNode[] {
  return s.split(/(\*\*[^*]+\*\*|\*[^*\s][^*]*\*)/g).map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (part.length > 2 && part.startsWith("*") && part.endsWith("*")) return <em key={i}>{part.slice(1, -1)}</em>;
    return part;
  });
}

export default function Markdown({ text, compact = false }: { text: string; compact?: boolean }) {
  const body = compact ? "text-[13px] leading-relaxed" : "text-[14px] leading-relaxed";
  const gap = compact ? "my-1.5" : "my-3";
  const out: ReactNode[] = [];
  let para: string[] = [];
  let list: { type: "ul" | "ol"; items: string[] } | null = null;
  const flush = () => {
    if (para.length) {
      out.push(
        <p key={out.length} className={`${gap} ${body} text-slate-700`}>
          {inline(para.join(" "))}
        </p>,
      );
      para = [];
    }
    if (list) {
      const items = list.items.map((it, i) => (
        <li key={i} className="pl-1">
          {inline(it)}
        </li>
      ));
      out.push(
        list.type === "ul" ? (
          <ul key={out.length} className={`${gap} list-disc space-y-1 pl-5 ${body} text-slate-700 marker:text-brand`}>
            {items}
          </ul>
        ) : (
          <ol key={out.length} className={`${gap} list-decimal space-y-1 pl-5 ${body} text-slate-700 marker:font-bold marker:text-brand`}>
            {items}
          </ol>
        ),
      );
      list = null;
    }
  };
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) {
      flush();
      continue;
    }
    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) {
      flush();
      const level = h[1].length;
      const cls =
        level === 1
          ? "mb-2 text-[26px] font-extrabold tracking-tight text-slate-900"
          : level === 2
            ? "mt-7 mb-2 border-b border-line pb-1.5 text-[17px] font-bold text-slate-900"
            : "mt-5 mb-1 text-[15px] font-bold text-slate-800";
      out.push(
        level === 1 ? (
          <h1 key={out.length} className={cls}>
            {inline(h[2])}
          </h1>
        ) : level === 2 ? (
          <h2 key={out.length} className={cls}>
            {inline(h[2])}
          </h2>
        ) : (
          <h3 key={out.length} className={cls}>
            {inline(h[2])}
          </h3>
        ),
      );
      continue;
    }
    const ul = line.match(/^[-*•]\s+(.*)$/);
    const ol = line.match(/^\d+[.)]\s+(.*)$/);
    if (ul || ol) {
      const type = ul ? "ul" : "ol";
      if (para.length || (list && list.type !== type)) flush();
      if (!list) list = { type, items: [] };
      list.items.push((ul ?? ol)![1]);
      continue;
    }
    if (/^-{3,}$/.test(line)) {
      flush();
      continue;
    }
    if (list) flush();
    para.push(line);
  }
  flush();
  return <div>{out}</div>;
}
