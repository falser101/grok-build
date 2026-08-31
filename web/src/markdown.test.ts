import assert from "node:assert/strict";
import test from "node:test";
import { renderMarkdown, renderMarkdownStream, streamMarkdownHtml } from "./markdown.ts";

test("escapes raw HTML", () => {
  const html = renderMarkdown("<script>alert(1)</script>");
  assert.equal(html.includes("<script>"), false);
  assert.equal(html.includes("&lt;script&gt;"), true);
});

test("renders headings code tables tasks and links", () => {
  const src = [
    "# Title",
    "",
    "hello **bold** and `code`",
    "",
    "```js",
    "const x = 1;",
    "```",
    "",
    "| a | b |",
    "| --- | --- |",
    "| 1 | 2 |",
    "",
    "- [x] done",
    "- [ ] todo",
    "",
    "> quoted",
    "",
    "[site](https://example.com)",
  ].join("\n");
  const html = renderMarkdown(src);
  assert.match(html, /<h1>Title<\/h1>/);
  assert.match(html, /<strong>bold<\/strong>/);
  assert.match(html, /class="language-js"/);
  assert.equal(html.includes("class=class"), false);
  assert.match(html, /<table>/);
  assert.match(html, /type="checkbox"/);
  assert.match(html, /<blockquote>/);
  assert.match(html, /href="https:\/\/example.com"/);
});

test("mermaid fence stays a mermaid-block", () => {
  const html = renderMarkdown("```mermaid\ngraph TD; A-->B\n```");
  assert.match(html, /mermaid-block/);
  assert.equal(html.includes("md-code-copy"), false);
});

test("code fence has lang id and 复制, not Copy code", () => {
  const html = renderMarkdown("```python\nprint(1)\n```");
  assert.match(html, /class="md-code"/);
  assert.match(html, /class="md-code-lang">python<\/span>/);
  assert.match(html, /class="md-code-copy">复制<\/button>/);
  assert.match(html, /class="language-python"/);
  assert.equal(html.includes("Copy code"), false);
});

test("rejects javascript: links", () => {
  const html = renderMarkdown("[x](javascript:alert(1))");
  assert.equal(html.includes("javascript:"), false);
});

test("underscore emphasis and autolinks", () => {
  const html = renderMarkdown("see __bold__ and https://example.com/a.");
  assert.match(html, /<strong>bold<\/strong>/);
  assert.match(html, /href="https:\/\/example.com\/a"/);
});

test("markdown links are not double-wrapped by autolink", () => {
  const html = renderMarkdown("[site](https://example.com)");
  assert.equal((html.match(/<a /g) ?? []).length, 1);
});

test("ordered lists stay one ol so numbers increment", () => {
  const tight = renderMarkdown("1. one\n2. two\n3. three");
  assert.equal((tight.match(/<ol/g) ?? []).length, 1);
  assert.equal((tight.match(/<li>/g) ?? []).length, 3);
  assert.equal(tight.includes("start="), false);

  const lazy = renderMarkdown("1. one\n1. two\n1. three");
  assert.equal((lazy.match(/<ol>/g) ?? []).length, 1);
  assert.equal((lazy.match(/<li>/g) ?? []).length, 3);

  const loose = renderMarkdown("1. one\n\n2. two\n\n3. three");
  assert.equal((loose.match(/<ol>/g) ?? []).length, 1);
  assert.equal((loose.match(/<li>/g) ?? []).length, 3);

  const wrapped = renderMarkdown("1. title\ncontinuation line\n2. next");
  assert.equal((wrapped.match(/<ol>/g) ?? []).length, 1);
  assert.match(wrapped, /title<br>continuation line/);
  assert.match(wrapped, /<li>next<\/li>/);

  const fromThree = renderMarkdown("3. third\n4. fourth");
  assert.match(fromThree, /<ol start="3">/);
});

function replayStream(chunks: string[]) {
  let acc = "";
  let from = 0;
  let frozen = "";
  let last: ReturnType<typeof renderMarkdownStream> | null = null;
  for (const chunk of chunks) {
    acc += chunk;
    const slice = renderMarkdownStream(acc.slice(from));
    frozen += slice.closed.map((b) => b.html).join("");
    from += slice.frozenEnd;
    last = slice;
    const full = renderMarkdownStream(acc);
    assert.equal(frozen, full.closed.map((b) => b.html).join(""));
    assert.deepEqual(slice.live, full.live);
    if (full.live?.kind !== "fence") {
      assert.equal(frozen + (full.live?.html ?? ""), renderMarkdown(acc));
    }
    assert.equal(streamMarkdownHtml(acc), renderMarkdown(acc));
  }
  return { acc, from, frozen, last };
}

test("stream html matches full render for complete docs", () => {
  const src = [
    "# Title",
    "",
    "hello **bold** and `code`",
    "",
    "```js",
    "const x = 1;",
    "```",
    "",
    "| a | b |",
    "| --- | --- |",
    "| 1 | 2 |",
    "",
    "- [x] done",
    "- [ ] todo",
    "",
    "> quoted",
    "",
    "[site](https://example.com)",
  ].join("\n");
  assert.equal(streamMarkdownHtml(src), renderMarkdown(src));
});

test("last block stays live; previous blocks freeze", () => {
  const slice = renderMarkdownStream("# Title\n\nHello");
  assert.equal(slice.closed.length, 1);
  assert.match(slice.closed[0]!.html, /<h1>Title<\/h1>/);
  assert.equal(slice.live?.kind, "html");
  if (slice.live?.kind === "html") assert.match(slice.live.html, /Hello/);
  assert.ok(slice.frozenEnd > 0);
  assert.equal(slice.closed[0]!.end, slice.frozenEnd);
});

test("unclosed fence is live text, not a frozen highlighted block", () => {
  const slice = renderMarkdownStream("```js\nconst x = 1");
  assert.equal(slice.closed.length, 0);
  assert.equal(slice.frozenEnd, 0);
  assert.deepEqual(slice.live, { kind: "fence", lang: "js", code: "const x = 1" });
});

test("closed fence freezes once a later block starts", () => {
  const slice = renderMarkdownStream("```js\nconst x = 1;\n```\n\nHi");
  assert.ok(slice.closed.some((b) => b.html.includes("language-js") && b.html.includes("tok-k")));
  assert.equal(slice.live?.kind, "html");
  if (slice.live?.kind === "html") assert.match(slice.live.html, /Hi/);
});

test("chunked replay freezes prefix and matches full render", () => {
  const { acc, from, last } = replayStream([
    "# Title\n\n",
    "Hello **w",
    "orld**.\n\n",
    "```js\ncon",
    "st x = 1;\n",
    "```\n\n",
    "Done.",
  ]);
  assert.equal(renderMarkdownStream(acc).closed.length, 3);
  assert.ok(from > 0);
  assert.equal(last?.live?.kind, "html");
  assert.equal(streamMarkdownHtml(acc), renderMarkdown(acc));
});

test("growing first paragraph stays live until a later block arrives", () => {
  const a = renderMarkdownStream("Hello");
  assert.equal(a.closed.length, 0);
  assert.equal(a.frozenEnd, 0);
  const b = renderMarkdownStream("Hello world");
  assert.equal(b.closed.length, 0);
  const c = renderMarkdownStream("Hello world\n\n# Next");
  assert.equal(c.closed.length, 1);
  assert.match(c.closed[0]!.html, /Hello world/);
  assert.equal(c.live?.kind, "html");
  if (c.live?.kind === "html") assert.match(c.live.html, /Next/);
});

test("blank line after a paragraph freezes it", () => {
  const slice = renderMarkdownStream("Hello\n\n");
  assert.equal(slice.closed.length, 1);
  assert.equal(slice.live, null);
  assert.equal(streamMarkdownHtml("Hello\n\n"), renderMarkdown("Hello\n\n"));
});
