/** Minimal Markdown → HTML. Escape first; never pass raw HTML through. */

import { highlightCode } from "./highlight.ts";

const ESC: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
};

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (ch) => ESC[ch] ?? ch);
}

function safeHref(href: string): string | null {
  const trimmed = href.trim();
  if (/^(https?:|mailto:|#|\/)/i.test(trimmed)) return trimmed;
  return null;
}

function inline(src: string): string {
  let out = escapeHtml(src);
  out = out.replace(/`([^`]+)`/g, "<code>$1</code>");
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/__([^_]+)__/g, "<strong>$1</strong>");
  out = out.replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>");
  out = out.replace(/(^|[^_])_([^_]+)_/g, "$1<em>$2</em>");
  out = out.replace(/~~([^~]+)~~/g, "<del>$1</del>");
  out = out.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_m, alt, href) => {
    const url = safeHref(String(href));
    if (!url) return escapeHtml(String(alt ?? ""));
    return `<img alt="${escapeHtml(String(alt ?? ""))}" src="${escapeHtml(url)}" />`;
  });
  out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, label, href) => {
    const url = safeHref(String(href));
    if (!url) return escapeHtml(String(label));
    return `<a href="${escapeHtml(url)}" target="_blank" rel="noreferrer">${label}</a>`;
  });
  out = out.replace(/\bhttps?:\/\/[^\s<]+/g, (url, offset: number, full: string) => {
    const before = full.slice(0, offset);
    if (before.lastIndexOf("<") > before.lastIndexOf(">")) return url;
    const clean = url.replace(/[),.;]+$/, "");
    const tail = url.slice(clean.length);
    if (!safeHref(clean)) return url;
    return `<a href="${escapeHtml(clean)}" target="_blank" rel="noreferrer">${escapeHtml(clean)}</a>${tail}`;
  });
  return out;
}

function isTableSep(line: string): boolean {
  return /^\s*\|?[\s:|-]+\|[\s:|-]+\|?\s*$/.test(line) && /\|/.test(line);
}

type ListKind = "ol" | "ul" | "task";

type ListMarker = {
  kind: ListKind;
  start: number;
  text: string;
  checked?: boolean;
};

function listMarker(line: string): ListMarker | null {
  const task = /^\s*[-*+]\s+\[([ xX])\]\s+(.*)$/.exec(line);
  if (task) return { kind: "task", start: 1, text: task[2] ?? "", checked: task[1] !== " " };
  const ol = /^\s*(\d+)\.\s+(.*)$/.exec(line);
  if (ol) return { kind: "ol", start: Number(ol[1]), text: ol[2] ?? "" };
  const ul = /^\s*[-*+]\s+(.*)$/.exec(line);
  if (ul) return { kind: "ul", start: 1, text: ul[1] ?? "" };
  return null;
}

function isBlockStart(line: string): boolean {
  if (line.startsWith("```")) return true;
  if (/^#{1,6}\s+/.test(line)) return true;
  if (/^>\s?/.test(line)) return true;
  if (/^\s*([-*_])\1{2,}\s*$/.test(line)) return true;
  return false;
}

function peekNonBlank(lines: string[], from: number): number {
  let j = from;
  while (j < lines.length && !(lines[j] ?? "").trim()) j += 1;
  return j;
}

function consumeList(
  lines: string[],
  startAt: number,
  first: ListMarker,
): { html: string; next: number } {
  const items: { text: string[]; checked?: boolean }[] = [
    { text: [first.text], checked: first.checked },
  ];
  let i = startAt + 1;
  while (i < lines.length) {
    const cur = lines[i] ?? "";
    const mark = listMarker(cur);
    if (mark && mark.kind === first.kind) {
      items.push({ text: [mark.text], checked: mark.checked });
      i += 1;
      continue;
    }
    if (mark) break;
    if (!cur.trim()) {
      const j = peekNonBlank(lines, i + 1);
      const peek = listMarker(lines[j] ?? "");
      if (j < lines.length && peek && peek.kind === first.kind) {
        i = j;
        continue;
      }
      const cont = lines[j] ?? "";
      if (j < lines.length && !isBlockStart(cont) && !listMarker(cont)) {
        i += 1;
        continue;
      }
      break;
    }
    if (isBlockStart(cur)) break;
    items.at(-1)?.text.push(cur.replace(/^\s{1,3}/, ""));
    i += 1;
  }
  const lis = items.map((it) => {
    const body = it.text
      .map((t) => t.trim())
      .filter(Boolean)
      .map((t) => inline(t))
      .join("<br>");
    if (first.kind === "task") {
      const checked = it.checked ? "checked" : "";
      return `<li class="task"><input type="checkbox" disabled ${checked} /> ${body}</li>`;
    }
    return `<li>${body}</li>`;
  });
  if (first.kind === "ol") {
    const startAttr = first.start > 1 ? ` start="${first.start}"` : "";
    return { html: `<ol${startAttr}>${lis.join("")}</ol>`, next: i };
  }
  return { html: `<ul>${lis.join("")}</ul>`, next: i };
}

function renderTable(header: string, rows: string[]): string {
  const cells = (line: string) =>
    line
      .replace(/^\s*\|/, "")
      .replace(/\|\s*$/, "")
      .split("|")
      .map((c) => inline(c.trim()));
  const head = cells(header);
  const body = rows.map(
    (r) => `<tr>${cells(r).map((c) => `<td>${c}</td>`).join("")}</tr>`,
  );
  return `<div class="md-table"><table><thead><tr>${head
    .map((c) => `<th>${c}</th>`)
    .join("")}</tr></thead><tbody>${body.join("")}</tbody></table></div>`;
}

export function renderMarkdown(src: string): string {
  const lines = src.replace(/\r\n/g, "\n").split("\n");
  const html: string[] = [];
  let i = 0;
  let para: string[] = [];
  const flushPara = () => {
    if (!para.length) return;
    html.push(`<p>${inline(para.join(" "))}</p>`);
    para = [];
  };

  while (i < lines.length) {
    const line = lines[i] ?? "";
    if (line.startsWith("```")) {
      flushPara();
      const lang = escapeHtml(line.slice(3).trim());
      const buf: string[] = [];
      i += 1;
      while (i < lines.length && !(lines[i] ?? "").startsWith("```")) {
        buf.push(lines[i] ?? "");
        i += 1;
      }
      i += 1;
      const code = buf.join("\n");
      if (lang === "mermaid") {
        html.push(`<pre class="mermaid-block">${escapeHtml(code)}</pre>`);
      } else {
        html.push(
          `<pre><code${lang ? ` class="language-${lang}"` : ""}>${highlightCode(code, lang)}</code></pre>`,
        );
      }
      continue;
    }
    if (
      (/^\s*\|/.test(line) || /\|/.test(line)) &&
      i + 1 < lines.length &&
      isTableSep(lines[i + 1] ?? "")
    ) {
      flushPara();
      const header = line;
      i += 2;
      const rows: string[] = [];
      while (i < lines.length && /\|/.test(lines[i] ?? "") && !isTableSep(lines[i] ?? "")) {
        rows.push(lines[i] ?? "");
        i += 1;
      }
      html.push(renderTable(header, rows));
      continue;
    }
    const heading = /^(#{1,6})\s+(.+)$/.exec(line);
    if (heading) {
      flushPara();
      const n = heading[1]!.length;
      html.push(`<h${n}>${inline(heading[2]!)}</h${n}>`);
      i += 1;
      continue;
    }
    if (/^>\s?/.test(line)) {
      flushPara();
      const quote: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i] ?? "")) {
        quote.push((lines[i] ?? "").replace(/^>\s?/, ""));
        i += 1;
      }
      html.push(`<blockquote>${renderMarkdown(quote.join("\n"))}</blockquote>`);
      continue;
    }
    const hr = /^\s*([-*_])\1{2,}\s*$/.test(line);
    if (hr) {
      flushPara();
      html.push("<hr />");
      i += 1;
      continue;
    }
    const marker = listMarker(line);
    if (marker) {
      flushPara();
      const list = consumeList(lines, i, marker);
      html.push(list.html);
      i = list.next;
      continue;
    }
    if (!line.trim()) {
      flushPara();
      i += 1;
      continue;
    }
    para.push(line);
    i += 1;
  }
  flushPara();
  return html.join("") || `<p>${inline(src)}</p>`;
}
