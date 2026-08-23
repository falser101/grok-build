import type { TimelineItem } from "./conversation.ts";
import { renderMarkdown } from "./markdown.ts";
import { relativeTime } from "./highlight.ts";
import { stripImagePlaceholders } from "./protocol.ts";

export type ItemHandlers = {
  onCopy: (item: TimelineItem) => void;
  onToggleRaw: (item: TimelineItem) => void;
  onToggle: (item: TimelineItem) => void;
  onView: (item: TimelineItem) => void;
  onSelect: (item: TimelineItem) => void;
  onDismissBtw?: (item: TimelineItem) => void;
  onOpenImage?: (gallery: { src: string; alt: string }[], index: number) => void;
  onOpenPath?: (path: string) => void;
  onExpandTool?: (item: TimelineItem) => void;
};

export const USER_THUMB_CAP = 4;

export function userThumbSlice(count: number, cap = USER_THUMB_CAP): { shown: number; extra: number } {
  if (count <= cap) return { shown: count, extra: 0 };
  return { shown: cap, extra: count - cap };
}

function bubbleRoot(el: HTMLElement): HTMLElement {
  if (el.classList.contains("turn-user")) {
    return (el.querySelector(".bubble") as HTMLElement) ?? el;
  }
  return el;
}

function userStack(el: HTMLElement): HTMLElement {
  return (el.querySelector(":scope > .user-stack") as HTMLElement) ?? el;
}

function syncUserThumbs(wrap: HTMLElement, item: TimelineItem, handlers: ItemHandlers) {
  const stack = userStack(wrap);
  let thumbs = stack.querySelector<HTMLElement>(":scope > .user-thumbs");
  if (item.images?.length) {
    if (!thumbs) {
      thumbs = document.createElement("div");
      thumbs.className = "user-thumbs";
      stack.prepend(thumbs);
    }
    thumbs.replaceChildren();
    fillUserThumbs(thumbs, item.images, handlers);
  } else {
    thumbs?.remove();
  }
}

export function renderTimelineItem(item: TimelineItem, handlers: ItemHandlers): HTMLElement {
  const el = document.createElement(item.kind === "think" ? "details" : "article");
  el.className = `bubble ${item.kind}`;
  el.dataset.id = item.id;
  el.dataset.kind = item.kind;
  if (item.replay) el.dataset.replay = "true";
  if (item.kind === "user") el.setAttribute("aria-label", "you");
  fill(el, item, handlers);
  if (item.kind !== "user") return el;
  const wrap = document.createElement("div");
  wrap.className = "turn-user";
  wrap.dataset.id = item.id;
  wrap.dataset.kind = "user";
  if (item.replay) wrap.dataset.replay = "true";
  const stack = document.createElement("div");
  stack.className = "user-stack";
  stack.append(el);
  wrap.append(stack);
  syncUserThumbs(wrap, item, handlers);
  return wrap;
}

export function patchTimelineItem(
  el: HTMLElement,
  item: TimelineItem,
  handlers: ItemHandlers,
): void {
  const bubble = bubbleRoot(el);
  bubble.className = `bubble ${item.kind}`;
  if (item.kind === "user") bubble.setAttribute("aria-label", "you");
  if (item.replay) {
    bubble.dataset.replay = "true";
    el.dataset.replay = "true";
  }
  bubble.classList.toggle("selected", Boolean(item.selected));
  if (patchStreamingBody(bubble, item)) {
    if (el.classList.contains("turn-user")) syncUserThumbs(el, item, handlers);
    return;
  }
  fill(bubble, item, handlers);
  if (el.classList.contains("turn-user")) syncUserThumbs(el, item, handlers);
}

function patchStreamingBody(el: HTMLElement, item: TimelineItem): boolean {
  if (item.kind !== "agent" && item.kind !== "think" && item.kind !== "btw") return false;
  if (item.images?.length || item.videos?.length) return false;
  const body = el.querySelector(":scope > .body") as HTMLElement | null;
  if (!body) return false;
  if (item.kind === "think") {
    (el as HTMLDetailsElement).open = item.open !== false;
    body.innerHTML = renderMarkdown(item.text);
    return true;
  }
  if (item.kind === "agent" && el.dataset.raw === "1") {
    const pre = body.querySelector("pre") ?? body;
    pre.textContent = item.raw;
    return true;
  }
  body.innerHTML = renderMarkdown(item.text);
  return true;
}

function fill(el: HTMLElement, item: TimelineItem, handlers: ItemHandlers) {
  el.replaceChildren();
  el.classList.toggle("selected", Boolean(item.selected));
  el.onclick = item.kind === "think" ? null : () => handlers.onSelect(item);
  el.ondblclick = (ev) => {
    ev.stopPropagation();
    handlers.onView(item);
  };
  if (item.kind === "think") {
    const details = el as HTMLDetailsElement;
    const sum = document.createElement("summary");
    sum.textContent = "Thinking";
    const body = document.createElement("div");
    body.className = "body";
    body.innerHTML = renderMarkdown(item.text);
    details.append(sum, body);
    details.open = item.open !== false;
    details.addEventListener("toggle", () => {
      if (details.open === Boolean(item.open !== false)) return;
      handlers.onToggle(item);
    });
    return;
  }
  if (item.kind === "tool") {
    fillTool(el, item, handlers);
    return;
  }
  if (item.kind === "workflow") {
    fillWorkflow(el, item, handlers);
    return;
  }
  if (item.kind === "subagent") {
    fillSubagent(el, item, handlers);
    return;
  }
  if (item.kind === "compact") {
    fillCompact(el, item, handlers);
    return;
  }
  const who = document.createElement("span");
  who.className = "who";
  who.textContent = item.who;
  if (item.status && item.kind !== "sys") {
    const st = document.createElement("span");
    st.className = `row-badge status-${item.status}`;
    st.textContent = item.status;
    who.append(" ", st);
  }
  if (item.timestamp) {
    const time = document.createElement("time");
    time.className = "ts";
    time.dateTime = new Date(item.timestamp).toISOString();
    time.textContent = relativeTime(item.timestamp);
    time.title = new Date(item.timestamp).toLocaleString();
    who.append(" ", time);
  }
  const body = document.createElement("div");
  body.className = "body";
  if (item.kind === "agent" && el.dataset.raw === "1") {
    const pre = document.createElement("pre");
    pre.textContent = item.raw;
    body.append(pre);
  } else if (item.kind === "agent" || item.kind === "btw") {
    body.innerHTML = renderMarkdown(item.text);
  } else if (item.kind === "user") {
    const visible = stripImagePlaceholders(item.text || item.raw);
    body.textContent = visible;
  } else {
    body.innerHTML = item.html;
  }
  if (item.kind !== "user") {
    for (const img of item.images ?? []) {
      const node = document.createElement("img");
      node.src = img.src;
      node.alt = img.alt;
      node.className = "thread-img";
      body.append(node);
    }
  }
  for (const vid of item.videos ?? []) {
    const node = document.createElement("video");
    node.src = vid.src;
    node.controls = true;
    node.className = "thread-img";
    body.append(node);
  }
  if (item.kind === "credit" && item.href) {
    const a = document.createElement("a");
    a.href = item.href;
    a.target = "_blank";
    a.rel = "noreferrer";
    a.textContent = "grok.com";
    body.append(a);
  }
  if (item.hook) {
    const foot = document.createElement("div");
    foot.className = "hook-foot";
    foot.textContent = `hook: ${item.hook}`;
    body.append(foot);
  }
  if (item.kind === "sys") {
    el.append(body);
    return;
  }
  if (item.kind === "user") {
    const visible = (body.textContent ?? "").trim();
    if (visible) el.append(body);
    if (item.timestamp && visible) {
      const time = document.createElement("time");
      time.className = "ts";
      time.dateTime = new Date(item.timestamp).toISOString();
      time.textContent = relativeTime(item.timestamp);
      time.title = new Date(item.timestamp).toLocaleString();
      el.append(time);
    }
    el.hidden = el.childElementCount === 0;
    return;
  }
  el.append(who, body);
  if (item.kind === "btw") {
    const close = document.createElement("button");
    close.type = "button";
    close.className = "btw-dismiss";
    close.textContent = "收进时间线";
    close.addEventListener("click", (ev) => {
      ev.stopPropagation();
      handlers.onDismissBtw?.(item);
    });
    el.append(close);
  }
}

function fillUserThumbs(
  root: HTMLElement,
  images: { src: string; alt: string }[],
  handlers: ItemHandlers,
) {
  const { shown, extra } = userThumbSlice(images.length);
  for (let i = 0; i < shown; i += 1) {
    const img = images[i]!;
    const overflow = extra > 0 && i === shown - 1;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = overflow ? "user-thumb user-thumb-overflow" : "user-thumb";
    const node = document.createElement("img");
    node.src = img.src;
    node.alt = img.alt || "图片";
    btn.append(node);
    if (overflow) {
      const badge = document.createElement("span");
      badge.className = "user-thumb-more";
      badge.textContent = `+${extra}`;
      btn.append(badge);
    }
    btn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      handlers.onOpenImage?.(images, overflow ? shown - 1 : i);
    });
    root.append(btn);
  }
}

function fillTool(el: HTMLElement, item: TimelineItem, handlers: ItemHandlers) {
  el.dataset.open = item.open ? "1" : "0";
  const family = item.members?.[0]?.family ?? "";
  if (family) el.dataset.family = family;
  if (item.status) el.dataset.status = item.status;
  const busy =
    item.status === "pending" ||
    item.status === "in_progress" ||
    item.status === "running";
  const blocked = item.status === "pending_user" || item.status === "waiting";
  const line = document.createElement("button");
  line.type = "button";
  line.className = "tool-line";
  if (family === "mcp") {
    const badge = document.createElement("span");
    badge.className = "tool-badge";
    badge.textContent = "MCP";
    line.append(badge, document.createTextNode(item.title || "工具"));
  } else {
    line.textContent = item.title || "工具";
  }
  if (busy) line.dataset.busy = "1";
  if (blocked) line.dataset.blocked = "1";
  line.addEventListener("click", (ev) => {
    ev.stopPropagation();
    handlers.onToggle(item);
  });
  const body = document.createElement("div");
  body.className = "body";
  body.innerHTML = item.html;
  body.hidden = !item.open;
  bindToolBody(body, item, handlers);
  if (item.hook) {
    const foot = document.createElement("div");
    foot.className = "hook-foot";
    foot.textContent = `hook: ${item.hook}`;
    body.append(foot);
  }
  el.append(line, body);
}

function bindToolBody(body: HTMLElement, item: TimelineItem, handlers: ItemHandlers) {
  for (const a of body.querySelectorAll<HTMLAnchorElement>("a.tool-path")) {
    a.addEventListener("click", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      const path = a.dataset.path || a.textContent || "";
      if (path) handlers.onOpenPath?.(path);
    });
  }
  const more = body.querySelector<HTMLButtonElement>(".tool-more");
  more?.addEventListener("click", (ev) => {
    ev.stopPropagation();
    handlers.onExpandTool?.(item);
  });
}

function fillWorkflow(el: HTMLElement, item: TimelineItem, handlers: ItemHandlers) {
  el.onclick = () => handlers.onSelect(item);
  if (item.status) el.dataset.status = item.status;
  const who = document.createElement("span");
  who.className = "who";
  who.textContent = item.title || "Workflow";
  if (item.status) {
    const st = document.createElement("span");
    st.className = `row-badge status-${item.status}`;
    st.textContent = item.status;
    who.append(" ", st);
  }
  const body = document.createElement("div");
  body.className = "body";
  if (item.text) {
    const obj = document.createElement("p");
    obj.className = "workflow-objective";
    obj.textContent = item.text;
    body.append(obj);
  }
  if (item.html) {
    const trail = document.createElement("div");
    trail.innerHTML = item.html;
    body.append(trail);
  }
  el.append(who, body);
}

function fillSubagent(el: HTMLElement, item: TimelineItem, handlers: ItemHandlers) {
  el.onclick = () => handlers.onSelect(item);
  if (item.status) el.dataset.status = item.status;
  const who = document.createElement("span");
  who.className = "who";
  if (item.subType) {
    const badge = document.createElement("span");
    badge.className = "tool-badge";
    badge.textContent = item.subType;
    who.append(badge, document.createTextNode(" "));
  }
  who.append(item.title || "子 agent");
  if (item.status) {
    const st = document.createElement("span");
    st.className = `row-badge status-${item.status}`;
    st.textContent = item.status;
    who.append(" ", st);
  }
  const body = document.createElement("div");
  body.className = "body";
  if (item.activity) {
    const act = document.createElement("div");
    act.className = "subagent-activity";
    act.textContent = item.activity;
    body.append(act);
  } else if (item.text && item.text !== item.title) {
    const p = document.createElement("div");
    p.textContent = item.text;
    body.append(p);
  }
  el.append(who, body);
}

function fillCompact(el: HTMLElement, item: TimelineItem, handlers: ItemHandlers) {
  el.onclick = () => handlers.onSelect(item);
  const phase = item.status || "running";
  el.dataset.status = phase;
  el.setAttribute("role", "status");
  el.setAttribute("aria-live", "polite");
  el.setAttribute("aria-busy", phase === "running" ? "true" : "false");
  const mark = document.createElement("span");
  mark.className = "compact-mark";
  mark.setAttribute("aria-hidden", "true");
  if (phase === "running") {
    const spin = document.createElement("span");
    spin.className = "compact-spinner";
    mark.append(spin);
  } else if (phase === "done") {
    mark.innerHTML =
      '<svg viewBox="0 0 16 16" width="16" height="16"><path fill="currentColor" d="M6.3 11.2 2.9 7.8l1.1-1.1 2.3 2.3 5.7-5.7 1.1 1.1z"/></svg>';
  } else if (phase === "failed") {
    mark.innerHTML =
      '<svg viewBox="0 0 16 16" width="16" height="16"><path fill="currentColor" d="M4.2 3.1 8 6.9l3.8-3.8 1.1 1.1L9.1 8l3.8 3.8-1.1 1.1L8 9.1l-3.8 3.8-1.1-1.1L6.9 8 3.1 4.2z"/></svg>';
  } else {
    mark.innerHTML =
      '<svg viewBox="0 0 16 16" width="16" height="16"><path fill="currentColor" d="M3 7.25h10v1.5H3z"/></svg>';
  }
  const copy = document.createElement("div");
  copy.className = "compact-copy";
  const title = document.createElement("div");
  title.className = "compact-title";
  title.textContent = item.text || "正在压缩上下文";
  copy.append(title);
  if (item.html) {
    const meta = document.createElement("div");
    meta.className = "compact-meta";
    meta.textContent = item.html;
    copy.append(meta);
  }
  if (phase === "running") {
    const track = document.createElement("div");
    track.className = "compact-track";
    const shimmer = document.createElement("div");
    shimmer.className = "compact-fill";
    track.append(shimmer);
    copy.append(track);
  }
  el.append(mark, copy);
}

export async function enhanceMermaid(root: HTMLElement): Promise<void> {
  const blocks = [...root.querySelectorAll<HTMLElement>("pre.mermaid-block")];
  if (!blocks.length) return;
  const mermaid = await loadMermaid();
  if (!mermaid) return;
  mermaid.initialize({
    startOnLoad: false,
    theme: document.documentElement.dataset.theme === "light" ? "default" : "dark",
  });
  for (const block of blocks) {
    if (block.dataset.done === "1") continue;
    const src = block.textContent ?? "";
    try {
      const id = `mmd-${Math.random().toString(36).slice(2)}`;
      const { svg } = await mermaid.render(id, src);
      const wrap = document.createElement("div");
      wrap.className = "mermaid-out";
      wrap.innerHTML = svg;
      block.replaceWith(wrap);
    } catch {
      block.dataset.done = "1";
    }
  }
}

type MermaidApi = {
  initialize: (opts: { startOnLoad: boolean; theme: string }) => void;
  render: (id: string, src: string) => Promise<{ svg: string }>;
};

let mermaidPromise: Promise<MermaidApi | null> | null = null;

function loadMermaid(): Promise<MermaidApi | null> {
  if (mermaidPromise) return mermaidPromise;
  mermaidPromise = new Promise((resolve) => {
    const w = window as unknown as { mermaid?: MermaidApi };
    if (w.mermaid) {
      resolve(w.mermaid);
      return;
    }
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js";
    s.onload = () => resolve(w.mermaid ?? null);
    s.onerror = () => resolve(null);
    document.head.append(s);
  });
  return mermaidPromise;
}
