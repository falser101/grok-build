import assert from "node:assert/strict";
import test from "node:test";
import { ansiToHtml, highlightCode, relativeTime } from "./highlight.ts";

test("highlights keywords strings and comments", () => {
  const html = highlightCode('const x = "hi"; // c', "ts");
  assert.match(html, /tok-k/);
  assert.match(html, /tok-s/);
  assert.match(html, /tok-c/);
});

test("highlighter does not re-color its own class attributes", () => {
  const html = highlightCode('# comment\nclass Foo { x = "a"; }', "ts");
  assert.equal(html.includes("class=class"), false);
  assert.equal(html.includes('class=<span'), false);
  assert.match(html, /tok-k/);
  assert.match(html, /tok-s/);
  assert.match(html, /tok-c/);
});

test("ansiToHtml maps colors and strips other CSI", () => {
  const html = ansiToHtml("\x1b[31merr\x1b[0m ok");
  assert.match(html, /ansi-red/);
  assert.equal(html.includes("\x1b"), false);
});

test("relativeTime buckets", () => {
  const now = 1_000_000;
  assert.equal(relativeTime(now - 1000, now), "刚刚");
  assert.equal(relativeTime(now - 120_000, now), "2 分钟前");
});
