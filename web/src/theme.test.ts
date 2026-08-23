import assert from "node:assert/strict";
import test from "node:test";
import { applyTheme, loadThemePref, persistThemePref, resolveTheme } from "./theme.ts";

test("theme pref defaults to auto and round-trips", () => {
  const map = new Map<string, string>();
  const store = {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => {
      map.set(k, v);
    },
  } as Storage;
  assert.equal(loadThemePref(store), "auto");
  persistThemePref("light", store);
  assert.equal(loadThemePref(store), "light");
});

test("auto follows the system; dark and light pin", () => {
  assert.equal(resolveTheme("auto", true), "light");
  assert.equal(resolveTheme("auto", false), "dark");
  assert.equal(resolveTheme("dark", true), "dark");
  assert.equal(resolveTheme("light", false), "light");
});

test("applyTheme writes data-theme and color-scheme", () => {
  const root = { dataset: {} as DOMStringMap, style: { colorScheme: "" } };
  assert.equal(applyTheme("auto", root, true), "light");
  assert.equal(root.dataset.theme, "light");
  assert.equal(root.style.colorScheme, "light");
});
