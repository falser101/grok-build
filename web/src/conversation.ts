import { stripImagePlaceholders, type Json } from "./protocol.ts";
import {
  asToolFamily,
  argChunkFromUpdate,
  elapsedFromUpdate,
  formatToolHtml,
  isBusyToolStatus,
  isDoneToolStatus,
  isGroupableFamily,
  mergeArgStream,
  membersHtml,
  mixedToolSummary,
  pathFromUpdate,
  subagentSnapshot,
  toolFamily,
  toolDisplayTitle,
  toolSummary,
  workflowSnapshot,
  type ToolFamily,
} from "./tool_blocks.ts";

function asRecord(value: Json): { [k: string]: Json } | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as { [k: string]: Json })
    : null;
}

export type TimelineKind =
  | "user"
  | "agent"
  | "think"
  | "tool"
  | "sys"
  | "credit"
  | "btw"
  | "context"
  | "workflow"
  | "subagent"
  | "feedback"
  | "compact";

export type CompactPhase = "running" | "done" | "failed" | "cancelled";

export type TimelineItem = {
  id: string;
  kind: TimelineKind;
  who: string;
  text: string;
  html: string;
  eventId: string | null;
  replay: boolean;
  toolCallId?: string;
  toolKind?: string;
  status?: string;
  title?: string;
  groupCount?: number;
  grouped?: boolean;
  members?: { family: string; title: string }[];
  images?: { src: string; alt: string }[];
  timestamp: number | null;
  raw: string;
  open?: boolean;
  manualFold?: boolean;
  hook?: string;
  href?: string;
  selected?: boolean;
  videos?: { src: string }[];
  source?: { [k: string]: Json };
  detailFull?: boolean;
  path?: string;
  runId?: string;
  childSessionId?: string;
  activity?: string;
  phases?: { title: string; state: string }[];
  subType?: string;
  percentage?: number;
  tokensBefore?: number;
  tokensAfter?: number;
  elapsedMs?: number;
  startedAt?: number;
  argText?: string;
  feedback?: "pending" | "reasons" | "sent";
};

export type ConversationEffect =
  | { type: "redraw" }
  | { type: "title"; rec: { [k: string]: Json }; meta: { [k: string]: Json } | null }
  | { type: "banner"; text: string; reason: string }
  | { type: "commands"; commands: { name: string; description: string | null; argumentHint: string | null }[] }
  | { type: "queue"; params: Json }
  | { type: "prompt-complete" }
  | { type: "follow-ups"; texts: string[] }
  | { type: "ghost"; text: string };

export type ConversationOptions = {
  showThinking: boolean;
  groupTools: boolean;
  showTimestamps: boolean;
  showRail: boolean;
};

/** Durable ACP terminal on `_x.ai/session/update`. Twin of `x.ai/session/prompt_complete`. */
export function isTurnTerminalKind(kind: string): boolean {
  const k = kind.toLowerCase().replace(/-/g, "_");
  return k === "turn_completed";
}

export function noteUnimplementedUpdate(
  kind: string,
  log: (msg: string) => void = (msg) => {
    console.debug(msg);
  },
): void {
  if (!kind) return;
  log(`未实现更新 ${kind}`);
}


let seq = 1;
function nid(prefix: string): string {
  seq += 1;
  return `${prefix}-${seq}`;
}

export class ConversationTimeline {
  items: TimelineItem[] = [];
  lastEventId: string | null = null;
  replayActive = false;
  replayGraceUntil = 0;
  liveAgentId: string | null = null;
  liveThinkId: string | null = null;
  follow = true;
  private seenLive = new Set<string>();
  private toolIndex = new Map<string, string>();
  private optimistic: { id: string; text: string }[] = [];
  private optimisticImageIds = new Set<string>();
  opts: ConversationOptions = {
    showThinking: true,
    groupTools: true,
    showTimestamps: false,
    showRail: false,
  };
  selectedId: string | null = null;
  nextAgentIsBtw = false;
  private dirty = new Set<string>();
  needsFullPaint = false;

  mark(item: TimelineItem) {
    this.dirty.add(item.id);
  }

  takePaint(): { dirty: Set<string>; full: boolean } {
    const dirty = this.dirty;
    const full = this.needsFullPaint;
    this.dirty = new Set();
    this.needsFullPaint = false;
    return { dirty, full };
  }

  private add(item: TimelineItem) {
    this.items[this.items.length] = item;
    this.dirty.add(item.id);
  }

  clear() {
    this.items = [];
    this.liveAgentId = null;
    this.liveThinkId = null;
    this.optimistic = [];
    this.optimisticImageIds.clear();
    this.toolIndex.clear();
    this.seenLive.clear();
    this.selectedId = null;
    this.nextAgentIsBtw = false;
    this.replayActive = false;
    this.replayGraceUntil = 0;
    this.dirty.clear();
    this.needsFullPaint = true;
  }

  beginReplay() {
    this.clear();
    this.lastEventId = null;
    this.seenLive.clear();
    this.replayActive = true;
    this.replayGraceUntil = 0;
    this.follow = true;
  }

  endReplay(graceMs = 1500) {
    this.replayActive = false;
    this.replayGraceUntil = Date.now() + graceMs;
    this.follow = true;
    this.liveAgentId = null;
    this.liveThinkId = null;
    for (const item of this.items) {
      if (item.kind === "compact" && item.status === "running" && item.replay) {
        applyCompactState(item, "done", { error: "" });
      }
    }
    this.needsFullPaint = true;
  }

  insertUser(text: string, images: { src: string; alt: string }[] = []): TimelineItem {
    this.replayActive = false;
    this.replayGraceUntil = 0;
    const item: TimelineItem = {
      id: nid("user"),
      kind: "user",
      who: "you",
      text,
      html: escapePre(text),
      eventId: null,
      replay: false,
      images,
      timestamp: Date.now(),
      raw: text,
      selected: false,
    };
    this.add(item);
    this.optimistic.push({ id: item.id, text: text.trim() });
    if (images.length) this.optimisticImageIds.add(item.id);
    this.liveAgentId = null;
    this.liveThinkId = null;
    return item;
  }

  apply(method: string, params: Json): ConversationEffect[] {
    if (method === "x.ai/session/prompt_complete") {
      return this.finishTurn();
    }
    if (method === "x.ai/queue/changed") {
      return [{ type: "queue", params }];
    }
    if (
      method !== "session/update" &&
      method !== "x.ai/session/update" &&
      method !== "x.ai/session_notification"
    ) {
      return [];
    }
    const rec = asRecord(params);
    const update = asRecord((rec?.update as Json) ?? rec) ?? {};
    const meta = mergeMeta(rec, update);
    const eventId =
      (meta && typeof meta.eventId === "string" && meta.eventId) ||
      (meta && typeof meta.event_id === "string" && meta.event_id) ||
      null;
    const flaggedReplay = meta?.isReplay === true || meta?.is_replay === true;
    const inGrace = Date.now() < this.replayGraceUntil;
    const replay = this.replayActive || flaggedReplay || (inGrace && flaggedReplay);
    if (!replay && !flaggedReplay && this.replayGraceUntil) {
      this.replayGraceUntil = 0;
    }
    if (!replay && eventId) {
      if (this.seenLive.has(eventId)) return [];
      this.seenLive.add(eventId);
      this.lastEventId = eventId;
    } else if (eventId) {
      this.lastEventId = eventId;
    }

    const kind =
      (typeof update.sessionUpdate === "string" && update.sessionUpdate) ||
      (typeof rec?.sessionUpdate === "string" && rec.sessionUpdate) ||
      "";

    if (isTurnTerminalKind(kind)) {
      return this.finishTurn();
    }
    if (kind === "session_summary_generated" || rec?.session_summary || rec?.sessionSummary) {
      return [{ type: "title", rec: rec ?? update, meta }];
    }
    if (kind === "available_commands_update") {
      return [{ type: "commands", commands: parseCommands(update.availableCommands ?? rec?.availableCommands) }];
    }
    if (kind === "current_mode_update" || kind === "model_changed" || kind === "model_auto_switched") {
      return [];
    }
    if (kind === "session_recap" || rec?.recap) {
      const text =
        (typeof rec?.recap === "string" && rec.recap) ||
        textFromContent(update.content) ||
        "";
      if (text) this.pushSys(text, eventId, replay, "recap");
      return [{ type: "redraw" }];
    }
    if (kind === "credit_limit" || kind === "credit_limit_block") {
      const text = textFromContent(update.content) || "额度用尽";
      this.add({
        id: nid("credit"),
        kind: "credit",
        who: "system",
        text,
        html: escapePre(text),
        eventId,
        replay,
        timestamp: Date.now(),
        raw: text,
        href: "https://grok.com",
      });
      return [{ type: "redraw" }];
    }
    if (kind === "image_compressed") return [];
    if (kind === "image_dropped") {
      this.pushSys(textFromContent(update.content) || "图片已丢弃", eventId, replay);
      return [{ type: "redraw" }];
    }
    if (compactPhaseFromKind(kind)) {
      this.ingestCompact(kind, update, eventId, replay);
      return [{ type: "redraw" }];
    }
    if (
      kind === "disk_full" ||
      kind === "context_too_large" ||
      kind === "re_auth_required" ||
      kind === "turn_failed" ||
      kind === "request_failed" ||
      kind === "memory_saved" ||
      kind === "memory_flush" ||
      kind === "memory_dream_completed"
    ) {
      const text = textFromContent(update.content) || sessionEventLabel(kind, update);
      if (text) this.pushSys(text, eventId, replay);
      return [{ type: "redraw" }];
    }
    if (
      kind === "retry_state" ||
      kind.endsWith("retry_state") ||
      kind === "auto_recovery_started" ||
      kind === "auto_recovery_exhausted" ||
      kind.includes("auto_recovery")
    ) {
      return [];
    }
    if (kind === "feedback_request") {
      if (replay) return [];
      const text = textFromContent(update.content) || "这条回答有帮助吗？";
      const requestId =
        (typeof update.requestId === "string" && update.requestId) ||
        (typeof update.request_id === "string" && update.request_id) ||
        (typeof rec?.requestId === "string" && rec.requestId) ||
        (typeof rec?.request_id === "string" && rec.request_id) ||
        null;
      this.add({
        id: nid("feedback"),
        kind: "feedback",
        who: "feedback",
        text,
        html: escapePre(text),
        eventId,
        replay,
        timestamp: Date.now(),
        raw: text,
        status: "pending",
        source: requestId ? { requestId } : undefined,
      });
      return [{ type: "redraw" }];
    }
    if (kind === "relay_sync_status" || kind === "relay_sync") {
      const text = textFromContent(update.content) || "Relay 同步中";
      this.pushSys(text, eventId, replay, "relay");
      return [{ type: "redraw" }];
    }
    if (kind === "context_info" || kind === "context") {
      this.insertContext(textFromContent(update.content) || "context");
      return [{ type: "redraw" }];
    }
    if (kind === "btw" || kind === "btw_message") {
      this.insertBtw(textFromContent(update.content), eventId, replay);
      return [{ type: "redraw" }];
    }
    if (kind === "user_message_chunk" || kind === "user_prompt" || kind === "user_message") {
      const raw = textFromContent(update.content);
      const text = displayTextFromContent(update.content, raw);
      const images = imagesFromContent(update.content);
      const hasDisplay = text.trim() !== raw.trim() && text.trim() !== "";
      if (!hasDisplay && hiddenFromScrollback(update.content, meta)) return [];
      if (!text.trim() && !images.length) return [];
      if (this.consumeOptimistic(text) || this.consumeOptimistic(raw)) {
        this.tryMergeUser(text, images);
        return images.length ? [{ type: "redraw" }] : [];
      }
      if (this.tryMergeUser(text, images)) return [{ type: "redraw" }];
      this.liveAgentId = null;
      this.liveThinkId = null;
      this.add({
        id: nid("user"),
        kind: "user",
        who: "you",
        text,
        html: escapePre(text),
        eventId,
        replay,
        images,
        timestamp: Date.now(),
        raw: text,
      });
      return [{ type: "redraw" }];
    }
    if (kind === "agent_message_chunk") {
      const chunk = textFromContent(update.content);
      const images = imagesFromContent(update.content);
      const videos = videosFromContent(update.content);
      if (this.nextAgentIsBtw) this.liveAgentId = null;
      let item = this.liveAgentId ? this.byId(this.liveAgentId) : null;
      if (!item) {
        this.closeLiveThink();
        const asBtw = this.nextAgentIsBtw;
        this.nextAgentIsBtw = false;
        item = {
          id: nid(asBtw ? "btw" : "agent"),
          kind: asBtw ? "btw" : "agent",
          who: asBtw ? "btw" : "grok",
          text: "",
          html: "",
          eventId,
          replay,
          images: [],
          timestamp: Date.now(),
          raw: "",
          open: true,
        };
        this.add(item);
        this.liveAgentId = item.id;
      }
      item.text += chunk;
      item.raw = item.text;
      item.html = item.text;
      if (images.length) item.images = [...(item.images ?? []), ...images];
      if (videos.length) item.videos = [...(item.videos ?? []), ...videos];
      item.eventId = eventId ?? item.eventId;
      this.mark(item);
      return [{ type: "redraw" }];
    }
    if (kind === "agent_thought_chunk") {
      if (!this.opts.showThinking) return [];
      const chunk = textFromContent(update.content);
      let item = this.liveThinkId ? this.byId(this.liveThinkId) : null;
      if (!item) {
        this.liveAgentId = null;
        item = {
          id: nid("think"),
          kind: "think",
          who: "thinking",
          text: "",
          html: "",
          eventId,
          replay,
          timestamp: Date.now(),
          raw: "",
          open: !replay,
        };
        this.add(item);
        this.liveThinkId = item.id;
      }
      item.text += chunk;
      item.raw = item.text;
      item.html = escapePre(item.text);
      item.eventId = eventId ?? item.eventId;
      if (!item.manualFold && !replay) item.open = true;
      this.mark(item);
      return [{ type: "redraw" }];
    }
    if (kind === "tool_call" || kind === "tool_call_update" || kind === "tool_call_delta_chunk") {
      this.ingestTool(update, rec, eventId, replay);
      return [{ type: "redraw" }];
    }
    if (kind === "plan") {
      const text = textFromContent(update.content) || "计划已更新";
      this.pushSys(text, eventId, replay);
      return [{ type: "redraw" }];
    }
    if (kind.startsWith("subagent")) {
      this.ingestSubagent(update, kind, eventId, replay);
      return [{ type: "redraw" }];
    }
    if (kind === "task_backgrounded" || kind === "task_completed") {
      return [];
    }
    if (kind === "workflow_updated" || kind === "workflow") {
      this.ingestWorkflow(update, eventId, replay);
      return [{ type: "redraw" }];
    }
    if (kind === "follow_up" || kind === "submit_follow_up") {
      const texts = parseFollowUps(update);
      if (texts.length) return [{ type: "follow-ups", texts }];
      return [];
    }
    if (kind) {
      noteUnimplementedUpdate(kind);
      return [];
    }
    return [];
  }

  setAllOpen(open: boolean) {
    for (const item of this.items) {
      if (item.kind === "think" || item.kind === "tool") {
        item.open = open;
        item.manualFold = true;
        this.mark(item);
      }
    }
  }

  toggle(id: string) {
    const item = this.byId(id);
    if (!item) return;
    item.open = !item.open;
    item.manualFold = true;
    this.mark(item);
  }

  expandDetail(id: string) {
    const item = this.byId(id);
    if (!item || item.kind !== "tool") return;
    item.detailFull = true;
    item.html = formatToolHtml(item.toolKind ?? "", item.raw, item.source ?? {}, { full: true, args: item.argText, streaming: false });
    item.open = true;
    this.mark(item);
  }

  select(id: string | null) {
    const prev = this.selectedId;
    this.selectedId = id;
    for (const it of this.items) it.selected = it.id === id;
    if (prev) this.dirty.add(prev);
    if (id) this.dirty.add(id);
  }

  selectDelta(dir: number): string | null {
    if (!this.items.length) return null;
    const idx = this.items.findIndex((it) => it.id === this.selectedId);
    const next = Math.min(this.items.length - 1, Math.max(0, (idx < 0 ? this.items.length : idx) + dir));
    const item = this.items[next]!;
    this.select(item.id);
    return item.id;
  }

  turns(): TimelineItem[] {
    return this.items.filter((it) => it.kind === "user" || it.kind === "agent");
  }

  userTurns(): TimelineItem[] {
    return this.items.filter((it) => it.kind === "user");
  }

  runningSubagentCount(): number {
    return this.items.filter(isLiveSubagent).length;
  }

  nthAgent(n: number): TimelineItem | null {
    const agents = this.items.filter((it) => it.kind === "agent" || it.kind === "btw");
    if (!agents.length) return null;
    if (n <= 0) return agents[agents.length - 1] ?? null;
    return agents[agents.length - n] ?? null;
  }

  insertContext(text: string): TimelineItem {
    this.liveAgentId = null;
    this.liveThinkId = null;
    const item: TimelineItem = {
      id: nid("context"),
      kind: "context",
      who: "context",
      text,
      html: escapePre(text),
      eventId: null,
      replay: false,
      timestamp: Date.now(),
      raw: text,
    };
    this.add(item);
    return item;
  }

  insertBtw(text: string, eventId: string | null = null, replay = false): TimelineItem {
    const item: TimelineItem = {
      id: nid("btw"),
      kind: "btw",
      who: "btw",
      text,
      html: "",
      eventId,
      replay,
      timestamp: Date.now(),
      raw: text,
      open: true,
    };
    this.add(item);
    this.liveAgentId = item.id;
    return item;
  }

  dismissBtw(id: string) {
    const item = this.byId(id);
    if (!item || item.kind !== "btw") return;
    item.kind = "agent";
    item.who = "grok";
    item.open = undefined;
    this.mark(item);
  }

  findHits(query: string): { id: string; index: number }[] {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const hits: { id: string; index: number }[] = [];
    for (const it of this.items) {
      const at = it.text.toLowerCase().indexOf(q);
      if (at >= 0) hits.push({ id: it.id, index: at });
    }
    return hits;
  }

  private finishTurn(): ConversationEffect[] {
    if (!this.replayActive) {
      for (let i = this.items.length - 1; i >= 0; i -= 1) {
        const item = this.items[i]!;
        if (item.kind === "agent" && !item.replay) {
          if (!item.feedback) {
            item.feedback = "pending";
            this.mark(item);
          }
          break;
        }
      }
    }
    this.liveAgentId = null;
    this.liveThinkId = null;
    this.collapseFinishedThinking();
    return [{ type: "prompt-complete" }, { type: "redraw" }];
  }

  noteSkillUsed(name: string) {
    const skill = name.trim();
    if (!skill) return;
    const title = `使用了 skill ${skill}`;
    const last = this.items.at(-1);
    if (last?.kind === "tool" && last.title === title) return;
    this.add({
      id: nid("tool"),
      kind: "tool",
      who: "tool",
      text: title,
      html: `<div class="tool-skill">${escapePre(title)}</div>`,
      eventId: null,
      replay: false,
      toolKind: "skill",
      status: "completed",
      title,
      members: [{ family: "skill", title }],
      timestamp: Date.now(),
      raw: title,
    });
  }

  private collapseFinishedThinking() {
    for (const item of this.items) {
      if (item.kind === "think" && !item.manualFold) {
        item.open = false;
        this.mark(item);
      }
    }
  }

  private consumeOptimistic(text: string): boolean {
    const trimmed = stripImagePlaceholders(text).trim() || text.trim();
    if (!trimmed) return false;
    const idx = this.optimistic.findIndex(
      (o) => o.text === trimmed || stripImagePlaceholders(o.text).trim() === trimmed,
    );
    if (idx < 0) return false;
    this.optimistic.splice(idx, 1);
    return true;
  }

  private lastUser(): TimelineItem | null {
    return this.items.filter((it) => it.kind === "user").at(-1) ?? null;
  }

  private attachUserImages(item: TimelineItem, images: { src: string; alt: string }[]) {
    if (!images.length) return;
    if (!item.images?.length) {
      item.images = images;
      return;
    }
    for (const img of images) {
      if (!item.images.some((have) => have.src === img.src)) item.images.push(img);
    }
  }

  /** Stick image-only (or caption-only) echoes onto the last user turn, even across sys rows. */
  private tryMergeUser(text: string, images: { src: string; alt: string }[]): boolean {
    const last = this.lastUser();
    if (!last) return false;
    const lastText = stripImagePlaceholders(last.text || last.raw).trim();
    const incoming = stripImagePlaceholders(text).trim();
    const imageOnly = images.length > 0 && !incoming;
    const textOntoImage = Boolean(incoming && !lastText && last.images?.length);
    const imageOntoText =
      images.length > 0 && Boolean(lastText) && (!incoming || incoming === lastText);
    if (!imageOnly && !textOntoImage && !imageOntoText) return false;
    if (incoming && !lastText) {
      last.text = text;
      last.raw = text;
      last.html = escapePre(text);
    }
    if (images.length && this.optimisticImageIds.has(last.id)) {
      this.optimisticImageIds.delete(last.id);
      last.images = images;
    } else {
      this.attachUserImages(last, images);
    }
    this.mark(last);
    return true;
  }

  private ingestTool(
    update: { [k: string]: Json },
    rec: { [k: string]: Json } | null,
    eventId: string | null,
    replay: boolean,
  ) {
    const toolCallId =
      (typeof update.toolCallId === "string" && update.toolCallId) ||
      (typeof update.tool_call_id === "string" && update.tool_call_id) ||
      (typeof rec?.toolCallId === "string" && rec.toolCallId) ||
      nid("tool");
    const existingId = this.toolIndex.get(toolCallId);
    const rawTitle =
      (typeof update.title === "string" && update.title.trim()) || "";
    const metaBag = asRecord((update._meta as Json) ?? (rec?._meta as Json) ?? null);
    const xaiTool = asRecord((metaBag?.["x.ai/tool"] as Json) ?? (metaBag?.tool as Json) ?? null);
    const metaName = typeof xaiTool?.name === "string" ? xaiTool.name : "";
    const metaKind = typeof xaiTool?.kind === "string" ? xaiTool.kind : "";
    const toolName =
      (typeof update.name === "string" && update.name) ||
      metaName ||
      "";
    const toolKind =
      (typeof update.kind === "string" && update.kind) ||
      metaKind ||
      toolName ||
      "";
    const status = typeof update.status === "string" ? update.status : "";
    const body = toolBody(update);
    const family = toolFamily(toolKind, rawTitle, toolName, metaKind);
    const argChunk = argChunkFromUpdate(update);
    const now = Date.now();
    const elapsedHint = elapsedFromUpdate(update);
    if (existingId) {
      const item = this.byId(existingId);
      if (item) {
        item.status = status || item.status;
        item.toolKind = toolKind || item.toolKind;
        if (!item.startedAt) item.startedAt = now;
        item.argText = mergeArgStream(item.argText ?? "", argChunk);
        if (elapsedHint != null) item.elapsedMs = elapsedHint;
        else if (isDoneToolStatus(item.status ?? "") && item.startedAt) {
          item.elapsedMs = now - item.startedAt;
        }
        if (!item.grouped) {
          if (body) {
            item.text = body;
            item.raw = body;
          }
          item.source = { ...(item.source ?? {}), ...update };
          item.path = pathFromUpdate(update) ?? item.path;
          item.html = formatToolHtml(item.toolKind ?? toolKind, item.text, update, {
            full: item.detailFull,
            args: item.argText,
            streaming: isBusyToolStatus(item.status ?? ""),
          });
          if (!item.manualFold && isBusyToolStatus(item.status ?? "") && item.argText) item.open = true;
          if (rawTitle) {
            const nextFamily =
              family !== "other" ? family : toolFamily(item.toolKind ?? "", rawTitle);
            item.title = toolSummary(nextFamily, 1, rawTitle);
            item.members = [{ family: nextFamily, title: rawTitle }];
          }
        }
        item.eventId = eventId ?? item.eventId;
        const hook = hookFrom(update, rec);
        if (hook) item.hook = hook;
        this.mark(item);
      }
      return;
    }
    const displayTitle = toolDisplayTitle(toolKind, toolName, rawTitle);
    if (
      this.opts.groupTools &&
      isGroupableFamily(family) &&
      this.mergeToolGroup(family, displayTitle, toolCallId)
    ) {
      return;
    }
    const item: TimelineItem = {
      id: nid("tool"),
      kind: "tool",
      who: "tool",
      text: body,
      html: formatToolHtml(toolKind, body, update, {
        args: argChunk,
        streaming: isBusyToolStatus(status),
      }),
      eventId,
      replay,
      toolCallId,
      toolKind,
      status,
      title: toolSummary(family, 1, displayTitle),
      members: [{ family, title: displayTitle }],
      timestamp: now,
      startedAt: now,
      argText: argChunk,
      elapsedMs: elapsedHint ?? undefined,
      raw: body,
      open: family === "edit" || (family !== "skill" && isBusyToolStatus(status) && Boolean(argChunk)),
      hook: hookFrom(update, rec),
      source: update,
      path: pathFromUpdate(update) ?? undefined,
    };
    this.liveAgentId = null;
    this.closeLiveThink();
    this.add(item);
    this.toolIndex.set(toolCallId, item.id);
  }

  private closeLiveThink() {
    const think = this.liveThinkId ? this.byId(this.liveThinkId) : null;
    if (think && !think.manualFold) {
      think.open = false;
      this.mark(think);
    }
    this.liveThinkId = null;
  }

  private ingestWorkflow(
    update: { [k: string]: Json },
    eventId: string | null,
    replay: boolean,
  ) {
    const snap = workflowSnapshot(update, textFromContent(update.content));
    const existing = snap.runId
      ? this.items.find((it) => it.kind === "workflow" && it.runId === snap.runId)
      : this.items.filter((it) => it.kind === "workflow").at(-1);
    if (existing) {
      existing.text = snap.objective || existing.text;
      existing.html = snap.html;
      existing.title = snap.title;
      existing.status = snap.status || existing.status;
      existing.phases = snap.phases;
      existing.eventId = eventId ?? existing.eventId;
      this.mark(existing);
      return;
    }
    this.add({
      id: nid("workflow"),
      kind: "workflow",
      who: "workflow",
      text: snap.objective || "workflow",
      html: snap.html,
      eventId,
      replay,
      timestamp: Date.now(),
      raw: snap.objective || snap.name,
      title: snap.title,
      status: snap.status,
      runId: snap.runId || undefined,
      phases: snap.phases,
    });
  }

  private ingestSubagent(
    update: { [k: string]: Json },
    kind: string,
    eventId: string | null,
    replay: boolean,
  ) {
    const snap = subagentSnapshot(update, kind, textFromContent(update.content));
    const existing = snap.childSessionId
      ? this.items.find((it) => it.kind === "subagent" && it.childSessionId === snap.childSessionId)
      : null;
    if (existing && !kind.includes("spawn") && kind !== "task_backgrounded") {
      existing.text = snap.description || existing.text;
      existing.title = snap.title || existing.title;
      existing.status = snap.status || existing.status;
      existing.activity = snap.activity || existing.activity;
      existing.subType = snap.subType || existing.subType;
      if (snap.output) existing.raw = snap.output;
      if (snap.workflowRunId) existing.runId = snap.workflowRunId;
      existing.eventId = eventId ?? existing.eventId;
      this.mark(existing);
      return;
    }
    this.liveAgentId = null;
    this.closeLiveThink();
    this.add({
      id: nid("subagent"),
      kind: "subagent",
      who: "subagent",
      text: snap.description,
      html: "",
      eventId,
      replay,
      timestamp: Date.now(),
      raw: snap.output,
      title: snap.title,
      status: snap.status,
      childSessionId: snap.childSessionId || undefined,
      activity: snap.activity || undefined,
      subType: snap.subType || undefined,
      runId: snap.workflowRunId || undefined,
      open: false,
    });
  }

  private mergeToolGroup(
    family: ToolFamily,
    title: string,
    toolCallId: string,
  ): boolean {
    const prev = this.items.at(-1);
    if (!prev || prev.kind !== "tool") return false;
    const prevFamily = asToolFamily(prev.members?.[0]?.family ?? toolFamily(prev.toolKind ?? "", ""));
    if (!isGroupableFamily(prevFamily) || !isGroupableFamily(family)) return false;
    const members = prev.members?.length
      ? [...prev.members]
      : [{ family: toolFamily(prev.toolKind ?? "", prev.title ?? ""), title: prev.title ?? "tool" }];
    members.push({ family, title });
    prev.members = members;
    prev.grouped = true;
    prev.groupCount = members.length;
    prev.title = mixedToolSummary(members);
    prev.text = members.map((m) => m.title).join("\n");
    prev.raw = prev.text;
    prev.html = membersHtml(members);
    this.toolIndex.set(toolCallId, prev.id);
    this.mark(prev);
    return true;
  }

  note(text: string, who = "system") {
    this.pushSys(text, null, false, who);
  }

  private ingestCompact(
    kind: string,
    update: { [k: string]: Json },
    eventId: string | null,
    replay: boolean,
  ) {
    const phase = compactPhaseFromKind(kind);
    if (!phase) return;
    const stats = compactStats(update);
    const last = this.items.filter((it) => it.kind === "compact").at(-1);
    if (last && last.status === "running") {
      last.eventId = eventId ?? last.eventId;
      applyCompactState(last, phase, stats);
      this.mark(last);
      return;
    }
    const item: TimelineItem = {
      id: nid("compact"),
      kind: "compact",
      who: "system",
      text: "",
      html: "",
      eventId,
      replay,
      timestamp: Date.now(),
      raw: kind,
      status: phase,
    };
    applyCompactState(item, phase, stats);
    this.add(item);
  }

  private pushSys(text: string, eventId: string | null, replay: boolean, who = "system") {
    this.add({
      id: nid("sys"),
      kind: "sys",
      who,
      text,
      html: escapePre(text),
      eventId,
      replay,
      timestamp: Date.now(),
      raw: text,
    });
  }

  private byId(id: string): TimelineItem | null {
    return this.items.find((it) => it.id === id) ?? null;
  }
}

export function listSubagentTasks(items: TimelineItem[]): {
  type: string;
  status: string;
  description: string;
}[] {
  return items
    .filter((it) => it.kind === "subagent")
    .map((it) => ({
      type: it.subType || "",
      status: it.status || "",
      description: it.title || it.text || "",
    }));
}

export function isLiveSubagent(item: TimelineItem): boolean {
  if (item.kind !== "subagent") return false;
  if (item.runId) return false;
  const status = (item.status ?? "").toLowerCase();
  return !status || status === "running" || status === "in_progress" || status === "pending";
}

function compactPhaseFromKind(kind: string): CompactPhase | null {
  const k = kind.toLowerCase();
  if (!k.includes("compact") || k.includes("image")) return null;
  if (k.includes("fail")) return "failed";
  if (k.includes("cancel")) return "cancelled";
  if (k.includes("complete") || k.includes("done")) return "done";
  return "running";
}

function compactStats(update: { [k: string]: Json }): CompactStats {
  const elapsedMsRaw = asNumber(update.elapsed_ms ?? update.elapsedMs);
  let elapsedMs = elapsedMsRaw;
  if (elapsedMs == null) {
    const elapsed = asNumber(update.elapsed);
    if (elapsed != null) elapsedMs = elapsed < 10_000 ? elapsed * 1000 : elapsed;
  }
  return {
    percentage: asNumber(update.percentage),
    tokensBefore: asNumber(update.tokens_before ?? update.tokensBefore ?? update.tokens_used ?? update.tokensUsed),
    tokensAfter: asNumber(update.tokens_after ?? update.tokensAfter),
    elapsedMs,
    error:
      (typeof update.error === "string" && update.error.trim()) ||
      textFromContent(update.content) ||
      "",
  };
}

function applyCompactState(item: TimelineItem, phase: CompactPhase, stats: CompactStats) {
  item.status = phase;
  if (stats.percentage != null) item.percentage = stats.percentage;
  if (stats.tokensBefore != null) item.tokensBefore = stats.tokensBefore;
  if (stats.tokensAfter != null) item.tokensAfter = stats.tokensAfter;
  if (stats.elapsedMs != null) item.elapsedMs = stats.elapsedMs;
  const copy = compactCopy(item, stats.error);
  item.text = copy.title;
  item.html = copy.meta;
  item.raw = copy.meta ? `${copy.title} · ${copy.meta}` : copy.title;
}

export function compactCopy(item: TimelineItem, error = ""): { title: string; meta: string } {
  const phase = (item.status as CompactPhase | undefined) ?? "running";
  if (phase === "running") {
    return {
      title: "正在压缩上下文",
      meta: item.percentage != null ? `上下文已用 ${item.percentage}%` : "正在精简较早的对话",
    };
  }
  if (phase === "failed") {
    return { title: "压缩失败", meta: error.trim() };
  }
  if (phase === "cancelled") {
    return { title: "压缩已取消", meta: "" };
  }
  const bits: string[] = [];
  if (item.tokensBefore != null && item.tokensBefore > 0 && item.tokensAfter != null) {
    bits.push(`${formatCompactTokens(item.tokensBefore)} → ${formatCompactTokens(item.tokensAfter)}`);
  } else if (item.tokensAfter != null) {
    bits.push(`剩余 ${formatCompactTokens(item.tokensAfter)}`);
  }
  if (item.elapsedMs != null) bits.push(formatCompactElapsed(item.elapsedMs));
  return { title: "上下文已压缩", meta: bits.join(" · ") };
}

export function formatCompactTokens(tokens: number): string {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}k`;
  return String(Math.round(tokens));
}

export function formatCompactElapsed(ms: number): string {
  if (ms < 1000) return `${Math.max(ms / 1000, 0.1).toFixed(1)} 秒`;
  const secs = ms / 1000;
  if (secs < 60) {
    const rounded = Math.round(secs * 10) / 10;
    return Number.isInteger(rounded) ? `${rounded} 秒` : `${rounded.toFixed(1)} 秒`;
  }
  const minutes = Math.floor(secs / 60);
  const rest = Math.round(secs % 60);
  return rest ? `${minutes} 分 ${rest} 秒` : `${minutes} 分`;
}

function asNumber(value: Json | undefined): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

type CompactStats = {
  percentage?: number;
  tokensBefore?: number;
  tokensAfter?: number;
  elapsedMs?: number;
  error: string;
};

function sessionEventLabel(kind: string, update: { [k: string]: Json }): string {
  if (kind === "disk_full") return "磁盘已满";
  if (kind === "context_too_large") return "上下文过长";
  if (kind === "re_auth_required") return "需要重新登录";
  if (kind === "turn_failed") return textFromContent(update.content) || "回合失败";
  if (kind === "request_failed") return textFromContent(update.content) || "请求失败";
  if (kind.startsWith("memory")) return "记忆已写入";
  return kind.replace(/_/g, " ");
}

function escapePre(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function mergeMeta(
  rec: { [k: string]: Json } | null,
  update: { [k: string]: Json },
): { [k: string]: Json } | null {
  const nested = asRecord((update._meta as Json) ?? (update.meta as Json) ?? null);
  const outer = asRecord((rec?._meta as Json) ?? (rec?.meta as Json) ?? null);
  if (!nested && !outer) return null;
  return { ...(nested ?? {}), ...(outer ?? {}) };
}

function metaOf(node: Json | undefined): { [k: string]: Json } | null {
  const rec = asRecord(node ?? null);
  if (!rec) return null;
  return asRecord((rec._meta as Json) ?? (rec.meta as Json) ?? null);
}

export function displayTextFromContent(content: Json | undefined, fallback: string): string {
  const meta = metaOf(content);
  if (meta && typeof meta.displayText === "string" && meta.displayText.trim()) {
    return meta.displayText;
  }
  return fallback;
}

function hiddenFromScrollback(
  content: Json | undefined,
  notifMeta: { [k: string]: Json } | null,
): boolean {
  const contentMeta = metaOf(content);
  if (contentMeta?.hideFromScrollback === true) return true;
  if (notifMeta?.hideFromScrollback === true) return true;
  const raw = textFromContent(content).trimStart();
  return raw.startsWith("<system-reminder>") || raw.startsWith("<monitor-event");
}

export function textFromContent(content: Json | undefined): string {
  if (typeof content === "string") return content;
  if (!content) return "";
  if (Array.isArray(content)) return content.map(textFromContent).join("");
  const rec = asRecord(content);
  if (!rec) return "";
  if (typeof rec.text === "string") return rec.text;
  if (rec.content !== undefined) return textFromContent(rec.content);
  return "";
}

function imagesFromContent(content: Json | undefined): { src: string; alt: string }[] {
  const out: { src: string; alt: string }[] = [];
  const walk = (node: Json | undefined) => {
    if (!node) return;
    if (Array.isArray(node)) {
      for (const n of node) walk(n);
      return;
    }
    const rec = asRecord(node);
    if (!rec) return;
    if (rec.type === "image") {
      const mime = typeof rec.mimeType === "string" ? rec.mimeType : "image/png";
      const data = typeof rec.data === "string" ? rec.data : "";
      const uri = typeof rec.uri === "string" ? rec.uri : "";
      if (data) out.push({ src: `data:${mime};base64,${data}`, alt: "image" });
      else if (uri) out.push({ src: uri, alt: "image" });
    }
    if (rec.content !== undefined) walk(rec.content);
  };
  walk(content);
  return out;
}

function videosFromContent(content: Json | undefined): { src: string }[] {
  const out: { src: string }[] = [];
  const walk = (node: Json | undefined) => {
    if (!node) return;
    if (Array.isArray(node)) {
      for (const n of node) walk(n);
      return;
    }
    const rec = asRecord(node);
    if (!rec) return;
    const mime = typeof rec.mimeType === "string" ? rec.mimeType : "";
    if (rec.type === "video" || mime.startsWith("video/")) {
      const data = typeof rec.data === "string" ? rec.data : "";
      const uri = typeof rec.uri === "string" ? rec.uri : "";
      if (data) out.push({ src: `data:${mime || "video/mp4"};base64,${data}` });
      else if (uri) out.push({ src: uri });
    }
    if (rec.content !== undefined) walk(rec.content);
  };
  walk(content);
  return out;
}

function toolBody(update: { [k: string]: Json }): string {
  const content = textFromContent(update.content);
  if (content) return content;
  if (typeof update.rawOutput === "string") return update.rawOutput;
  const rawInput = asRecord(update.rawInput ?? null);
  if (rawInput && typeof rawInput.path === "string") return rawInput.path;
  if (typeof update.title === "string") return update.title;
  return "";
}

function hookFrom(update: { [k: string]: Json }, rec: { [k: string]: Json } | null): string | undefined {
  const meta = asRecord((update._meta as Json) ?? (rec?._meta as Json) ?? null);
  const hook =
    (meta && typeof meta.hook === "string" && meta.hook) ||
    (typeof update.hook === "string" && update.hook) ||
    (typeof rec?.hook === "string" && rec.hook) ||
    "";
  return hook || undefined;
}

function parseCommands(raw: Json | undefined): {
  name: string;
  description: string | null;
  argumentHint: string | null;
}[] {
  if (!Array.isArray(raw)) return [];
  const out: { name: string; description: string | null; argumentHint: string | null }[] = [];
  for (const c of raw) {
    const rec = asRecord(c);
    if (rec && typeof rec.name === "string") {
      out.push({
        name: rec.name,
        description: typeof rec.description === "string" ? rec.description : null,
        argumentHint:
          (typeof rec.argumentHint === "string" && rec.argumentHint) ||
          (typeof rec.argument_hint === "string" && rec.argument_hint) ||
          null,
      });
    }
  }
  return out;
}

function parseFollowUps(update: { [k: string]: Json }): string[] {
  const raw = update.suggestions ?? update.followUps ?? update.texts;
  if (!Array.isArray(raw)) return [];
  return raw.filter((t): t is string => typeof t === "string" && t.trim() !== "");
}

export function railPreview(text: string, max = 140): string {
  const one = text.replace(/\s+/g, " ").trim();
  if (!one) return "(空消息)";
  return one.length > max ? `${one.slice(0, max)}…` : one;
}

export function isReplayMeta(params: Json): boolean {
  const rec = asRecord(params);
  const meta = asRecord((rec?._meta as Json) ?? (rec?.meta as Json) ?? null);
  return meta?.isReplay === true || meta?.is_replay === true;
}


/** 0-based count of user messages before `itemId` (for x.ai/feedback turn_number). */
export function replyFeedbackTurnNumber(items: TimelineItem[], itemId: string): number {
  let n = 0;
  for (const it of items) {
    if (it.id === itemId) return n;
    if (it.kind === "user") n += 1;
  }
  return n;
}

/**
 * Params the existing `x.ai/feedback` handler already accepts.
 * Fallback `FeedbackRequest` is snake_case (`session_id` + `feedback_text`).
 * Do not invent a solicited `request_id` (that marks FeedbackRequest cards).
 */
export function replyFeedbackParams(
  sessionId: string,
  text: string,
  item: Pick<TimelineItem, "id" | "eventId" | "source">,
  items: TimelineItem[] = [],
): { [k: string]: Json } {
  const params: { [k: string]: Json } = {
    sessionId,
    session_id: sessionId,
    feedbackText: text,
    feedback_text: text,
    messageId: item.id,
    itemId: item.id,
    turn_number: replyFeedbackTurnNumber(items, item.id),
  };
  if (item.eventId) {
    params.eventId = item.eventId;
    params.event_id = item.eventId;
  }
  const requestId = item.source?.requestId;
  if (typeof requestId === "string" && requestId) {
    params.requestId = requestId;
    params.request_id = requestId;
  }
  return params;
}
