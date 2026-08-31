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

function fenceHtml(lang: string, code: string): string {
  if (lang === "mermaid") {
    return `<pre class="mermaid-block">${escapeHtml(code)}</pre>`;
  }
  const langLabel = lang ? escapeHtml(lang) : "";
  return `<div class="md-code"><div class="md-code-bar"><span class="md-code-lang">${langLabel}</span><button type="button" class="md-code-copy">复制</button></div><pre><code${lang ? ` class="language-${lang}"` : ""}>${highlightCode(code, lang)}</code></pre></div>`;
}

type ParsedFence = { lang: string; code: string; closed: boolean };

type ParsedBlock = {
  html: string;
  end: number;
  fence?: ParsedFence;
};

function lineStarts(lines: string[]): number[] {
  const offs: number[] = [];
  let o = 0;
  for (let i = 0; i < lines.length; i += 1) {
    offs.push(o);
    o += (lines[i] ?? "").length;
    if (i < lines.length - 1) o += 1;
  }
  return offs;
}

function parseMarkdown(src: string): ParsedBlock[] {
  const lines = src.split("\n");
  const offs = lineStarts(lines);
  const at = (lineIndex: number) => (lineIndex >= offs.length ? src.length : offs[lineIndex]!);
  const blocks: ParsedBlock[] = [];
  let i = 0;
  let para: string[] = [];

  const push = (html: string, end: number, fence?: ParsedFence) => {
    if (!html && !fence) return;
    blocks.push({ html, end, fence });
  };

  const flushPara = () => {
    if (!para.length) return;
    const html = `<p>${inline(para.join(" "))}</p>`;
    para = [];
    push(html, at(i));
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
      const closed = i < lines.length && (lines[i] ?? "").startsWith("```");
      if (closed) i += 1;
      const code = buf.join("\n");
      push(fenceHtml(lang, code), at(i), { lang, code, closed });
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
      push(renderTable(header, rows), at(i));
      continue;
    }
    const heading = /^(#{1,6})\s+(.+)$/.exec(line);
    if (heading) {
      flushPara();
      const n = heading[1]!.length;
      i += 1;
      push(`<h${n}>${inline(heading[2]!)}</h${n}>`, at(i));
      continue;
    }
    if (/^>\s?/.test(line)) {
      flushPara();
      const quote: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i] ?? "")) {
        quote.push((lines[i] ?? "").replace(/^>\s?/, ""));
        i += 1;
      }
      push(`<blockquote>${renderMarkdown(quote.join("\n"))}</blockquote>`, at(i));
      continue;
    }
    const hr = /^\s*([-*_])\1{2,}\s*$/.test(line);
    if (hr) {
      flushPara();
      i += 1;
      push("<hr />", at(i));
      continue;
    }
    const marker = listMarker(line);
    if (marker) {
      flushPara();
      const list = consumeList(lines, i, marker);
      i = list.next;
      push(list.html, at(i));
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
  return blocks;
}

export type MdClosedBlock = {
  html: string;
  end: number;
};

export type MdStreamLive =
  | { kind: "html"; html: string }
  | { kind: "fence"; lang: string; code: string };

export type MdStreamSlice = {
  closed: MdClosedBlock[];
  live: MdStreamLive | null;
  frozenEnd: number;
};

function fallbackParagraph(src: string): string {
  return `<p>${inline(src)}</p>`;
}

function joinBlocks(blocks: ParsedBlock[]): string {
  return blocks.map((b) => b.html).join("");
}

/** Full-document render. HTML of a complete source is unchanged vs the previous parser. */
export function renderMarkdown(src: string): string {
  const normalized = src.replace(/\r\n/g, "\n");
  const html = joinBlocks(parseMarkdown(normalized));
  return html || fallbackParagraph(src);
}

/**
 * Split into frozen prefix blocks + live tail.
 * The last block stays live (it may still grow). An unclosed fence is live text, not highlighted.
 */
export function renderMarkdownStream(src: string): MdStreamSlice {
  const normalized = src.replace(/\r\n/g, "\n");
  const blocks = parseMarkdown(normalized);
  if (!blocks.length) {
    if (!normalized) return { closed: [], live: null, frozenEnd: 0 };
    return { closed: [], live: { kind: "html", html: fallbackParagraph(normalized) }, frozenEnd: 0 };
  }
  const last = blocks[blocks.length - 1]!;
  if (last.end < normalized.length && !normalized.slice(last.end).trim()) {
    return {
      closed: blocks.map((b) => ({ html: b.html, end: b.end })),
      live: null,
      frozenEnd: last.end,
    };
  }
  const closed = blocks.slice(0, -1).map((b) => ({ html: b.html, end: b.end }));
  const frozenEnd = closed.length ? closed[closed.length - 1]!.end : 0;
  if (last.fence && !last.fence.closed) {
    return { closed, live: { kind: "fence", lang: last.fence.lang, code: last.fence.code }, frozenEnd };
  }
  return { closed, live: { kind: "html", html: last.html }, frozenEnd };
}

/** Frozen + live HTML. Same string as renderMarkdown for any source. */
export function streamMarkdownHtml(src: string): string {
  const slice = renderMarkdownStream(src);
  const live =
    slice.live == null
      ? ""
      : slice.live.kind === "html"
        ? slice.live.html
        : fenceHtml(slice.live.lang, slice.live.code);
  return slice.closed.map((b) => b.html).join("") + live;
}

type MdDomState = {
  frozenEnd: number;
  stamp: string;
  liveKey: string;
};

const mdDom = new WeakMap<HTMLElement, MdDomState>();

function stampAt(src: string, end: number): string {
  return `${end}:${src.slice(Math.max(0, end - 64), end)}`;
}

function appendText(el: HTMLElement, next: string) {
  const prev = el.textContent ?? "";
  if (next === prev) return;
  if (next.startsWith(prev)) {
    const add = next.slice(prev.length);
    if (add) el.append(document.createTextNode(add));
    return;
  }
  el.textContent = next;
}

function setLiveFence(live: HTMLElement, fence: { lang: string; code: string }) {
  const mermaid = fence.lang === "mermaid";
  const mark = mermaid ? "mermaid" : "code";
  let pre = live.querySelector<HTMLElement>(":scope > pre");
  if (live.dataset.fence !== mark || !pre) {
    live.replaceChildren();
    live.dataset.fence = mark;
    pre = document.createElement("pre");
    if (mermaid) {
      pre.className = "mermaid-block";
    } else {
      const code = document.createElement("code");
      if (fence.lang) code.className = `language-${fence.lang}`;
      pre.append(code);
    }
    live.append(pre);
  }
  const inner = pre.querySelector<HTMLElement>(":scope > code");
  appendText(mermaid ? pre : (inner ?? pre), fence.code);
}

function setLive(live: HTMLElement, next: MdStreamLive | null) {
  if (next?.kind === "fence") {
    setLiveFence(live, next);
    live.hidden = false;
    return;
  }
  if (live.dataset.fence) {
    live.replaceChildren();
    delete live.dataset.fence;
  }
  const html = next?.html ?? "";
  live.innerHTML = html;
  live.hidden = !html;
}

function ensureLive(body: HTMLElement): HTMLElement {
  let live = body.querySelector(":scope > .md-live") as HTMLElement | null;
  if (!live) {
    live = document.createElement("div");
    live.className = "md-live";
    body.append(live);
  }
  return live;
}

function insertClosed(body: HTMLElement, html: string, live: HTMLElement) {
  if (!html) return;
  const tpl = document.createElement("template");
  tpl.innerHTML = html;
  body.insertBefore(tpl.content, live);
}

/** Patch a bubble `.body` in place: append newly closed blocks, rewrite only `.md-live`. */
export function applyMarkdownStream(body: HTMLElement, src: string): void {
  const normalized = src.replace(/\r\n/g, "\n");
  let state = mdDom.get(body);
  if (
    !state ||
    state.frozenEnd > normalized.length ||
    state.stamp !== stampAt(normalized, state.frozenEnd)
  ) {
    body.replaceChildren();
    state = { frozenEnd: 0, stamp: stampAt(normalized, 0), liveKey: "" };
    mdDom.set(body, state);
  }

  const live = ensureLive(body);
  const tail = normalized.slice(state.frozenEnd);
  const slice = renderMarkdownStream(tail);

  if (state.frozenEnd === 0 && slice.closed.length) {
    insertClosed(body, slice.closed.map((b) => b.html).join(""), live);
  } else {
    for (const block of slice.closed) insertClosed(body, block.html, live);
  }

  const nextEnd = state.frozenEnd + slice.frozenEnd;
  state.frozenEnd = nextEnd;
  state.stamp = stampAt(normalized, nextEnd);

  const liveKey =
    slice.live == null
      ? ""
      : slice.live.kind === "fence"
        ? `fence:${slice.live.lang}:${slice.live.code.length}:${slice.live.code.slice(-32)}`
        : `html:${slice.live.html}`;
  if (slice.live?.kind === "fence") {
    setLive(live, slice.live);
    state.liveKey = liveKey;
  } else if (liveKey !== state.liveKey) {
    setLive(live, slice.live);
    state.liveKey = liveKey;
  }
}
