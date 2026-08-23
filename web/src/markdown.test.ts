import assert from "node:assert/strict";
import test from "node:test";
import { renderMarkdown } from "./markdown.ts";

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
