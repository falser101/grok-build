/** Small highlighter for common langs. Shiki-class themes are out of scope. */

const KEYWORDS = new Set(
  "and as async await break case catch class const continue def default elif else except export finally for from function if import in is lambda let match new not or pass return throw try type typeof var void while with yield".split(
    " ",
  ),
);

function replaceOutsideTags(
  src: string,
  pattern: RegExp,
  replacer: (match: string, ...groups: string[]) => string,
): string {
  const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`;
  const re = new RegExp(pattern.source, flags);
  return src.replace(re, (match, ...rest) => {
    const offset = rest[rest.length - 2] as number;
    const before = src.slice(0, offset);
    if (before.lastIndexOf("<") > before.lastIndexOf(">")) return match;
    return replacer(match, ...(rest.slice(0, -2) as string[]));
  });
}

export function highlightCode(src: string, lang = ""): string {
  let escaped = src
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  if (!lang) return escaped;
  escaped = replaceOutsideTags(
    escaped,
    /(\/\/[^\n]*|#(?!!).*$|\/\*[\s\S]*?\*\/)/gm,
    (m) => `<span class="tok-c">${m}</span>`,
  );
  escaped = replaceOutsideTags(escaped, /(["'`])(?:\\.|(?!\1).)*\1/g, (m) => `<span class="tok-s">${m}</span>`);
  escaped = replaceOutsideTags(escaped, /\b(\d+(?:\.\d+)?)\b/g, (m) => `<span class="tok-n">${m}</span>`);
  escaped = replaceOutsideTags(escaped, /\b([A-Za-z_][\w.]*)\b/g, (word) =>
    KEYWORDS.has(word) ? `<span class="tok-k">${word}</span>` : word,
  );
  return escaped;
}

export function ansiToHtml(src: string): string {
  const esc = src
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const colors: Record<string, string> = {
    "31": "ansi-red",
    "32": "ansi-green",
    "33": "ansi-yellow",
    "34": "ansi-blue",
    "35": "ansi-magenta",
    "36": "ansi-cyan",
    "90": "ansi-dim",
  };
  return esc
    .replace(/\x1b\[([0-9;]+)m/g, (_m, codes: string) => {
      const parts = String(codes).split(";");
      if (parts.includes("0") || parts.includes("39")) return "</span>";
      const cls = parts.map((p) => colors[p]).find(Boolean);
      return cls ? `<span class="${cls}">` : "";
    })
    .replace(/\x1b\[[0-9;]*[A-Za-z]/g, "");
}

export function relativeTime(ts: number, now = Date.now()): string {
  const delta = Math.max(0, now - ts);
  if (delta < 45_000) return "刚刚";
  if (delta < 3_600_000) return `${Math.round(delta / 60_000)} 分钟前`;
  if (delta < 86_400_000) return `${Math.round(delta / 3_600_000)} 小时前`;
  return new Date(ts).toLocaleString();
}
