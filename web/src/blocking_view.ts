import { renderMarkdown } from "./markdown.ts";
import type { Json } from "./protocol.ts";
import {
  cancelOptionsFor,
  cancelSubagentsForChoice,
  prefFromCancelChoice,
  allowScopePersists,
  bashGlobIsCatchall,
  bashPatternMatches,
  defaultAllowCount,
  defaultDenyCount,
  defaultPermissionIndex,
  firstAllowOnceId,
  isBashAllowScope,
  isBashDenyScope,
  isMcpAllowScope,
  parsePermissionRequest,
  parsePlanRequest,
  parseQuestionRequest,
  permissionCancelled,
  permissionSelected,
  permissionSelectionMeta,
  planAbandoned,
  planApproved,
  planCancelled,
  questionAccepted,
  questionCancelled,
  questionChat,
  questionSkip,
  rejectOption,
  scopedOptionLabel,
  stepAllowCount,
  stepDenyCount,
  type CancelChoice,
  type PermissionKind,
  type PermissionRequest,
  type PermissionScopeState,
  type PlanRequest,
  type QuestionRequest,
} from "./blocking_cards.ts";

export type BlockHooks = {
  onYolo: () => void;
  onRejectNote: (text: string) => void;
  onFeedback: (text: string) => void;
  onStop: (cancelSubagents: boolean) => void;
  onCancelPref?: (pref: "always_stop" | "always_continue") => void;
};

type Pending = {
  resolve: (value: Json) => void;
  kind: "permission" | "question" | "plan" | "cancel" | "feedback";
  perm?: PermissionRequest;
  question?: QuestionRequest;
  plan?: PlanRequest;
  qIndex: number;
  qSelected: Set<number>[];
  qNotes: string[];
  optionIndex: number;
  cancelSubagentCount?: number;
} & Partial<PermissionScopeState>;

export class BlockHost {
  private queue: Pending[] = [];
  private minimized = false;
  private expanded = false;
  private rejectOpen = false;
  private stickyKind: PermissionKind | null = null;
  private notified = false;
  private qEscLayer = 0;
  private timer: number | null = null;

  constructor(
    private readonly card: HTMLElement,
    private readonly pill: HTMLButtonElement,
    private readonly hooks: BlockHooks,
  ) {
    this.pill.addEventListener("click", () => {
      this.minimized = false;
      this.paint();
      this.card.focus();
    });
  }

  get busy(): boolean {
    return this.queue.length > 0;
  }

  offerPermission(params: Json): Promise<Json> {
    const perm = parsePermissionRequest(params);
    return this.enqueue({
      kind: "permission",
      perm,
      qIndex: 0,
      qSelected: [],
      qNotes: [],
      optionIndex: defaultPermissionIndex(perm.options, this.stickyKind),
      bashAllowCount: defaultAllowCount(perm.bashWords),
      bashDenyCount: defaultDenyCount(perm.bashWords),
      patternOpen: false,
      patternBuffer: perm.bashWords.join(" "),
      patternDirty: false,
      mcpScope: "tool",
    });
  }

  offerQuestion(params: Json): Promise<Json> {
    const question = parseQuestionRequest(params);
    return this.enqueue({
      kind: "question",
      question,
      qIndex: 0,
      qSelected: question.questions.map(() => new Set()),
      qNotes: question.questions.map(() => ""),
      optionIndex: 0,
    });
  }

  offerPlan(params: Json): Promise<Json> {
    return this.enqueue({
      kind: "plan",
      plan: parsePlanRequest(params),
      qIndex: 0,
      qSelected: [],
      qNotes: [],
      optionIndex: 0,
    });
  }

  offerCancel(runningSubagents = 0): Promise<Json> {
    const existing = this.queue.find((p) => p.kind === "cancel");
    if (existing) {
      existing.cancelSubagentCount = runningSubagents;
      this.minimized = false;
      this.paint();
      return new Promise((resolve) => {
        const prev = existing.resolve;
        existing.resolve = (value) => {
          prev(value);
          resolve(value);
        };
      });
    }
    return this.enqueue({
      kind: "cancel",
      qIndex: 0,
      qSelected: [],
      qNotes: [],
      optionIndex: 0,
      cancelSubagentCount: runningSubagents,
    });
  }

  offerFeedback(): void {
    if (this.queue.some((p) => p.kind === "feedback")) {
      this.minimized = false;
      this.paint();
      return;
    }
    void this.enqueue({
      kind: "feedback",
      qIndex: 0,
      qSelected: [],
      qNotes: [""],
      optionIndex: 0,
    });
  }

  handleKey(ev: KeyboardEvent): boolean {
    const front = this.front();
    if (!front) return false;
    if (this.minimized) {
      if (ev.key === "Tab") {
        ev.preventDefault();
        this.minimized = false;
        this.paint();
        this.card.focus();
        return true;
      }
      return false;
    }
    if (ev.key === "Escape") {
      ev.preventDefault();
      this.onEsc();
      return true;
    }
    const typing = ev.target instanceof HTMLTextAreaElement || ev.target instanceof HTMLInputElement;
    if (typing) {
      if (ev.key === "Enter" && (ev.target as HTMLElement).id === "block-glob") {
        ev.preventDefault();
        this.confirmFront();
        return true;
      }
      return false;
    }
    if (ev.key === "Tab") {
      ev.preventDefault();
      this.cycleTab(ev.shiftKey ? -1 : 1);
      return true;
    }
    if (/^[1-9]$/.test(ev.key)) {
      const n = Number(ev.key) - 1;
      this.pickNumber(n);
      return true;
    }
    if (ev.key === "Enter") {
      ev.preventDefault();
      this.confirmFront();
      return true;
    }
    if (ev.key === "ArrowLeft" || ev.key === "ArrowRight") {
      if (front.kind === "question") {
        ev.preventDefault();
        this.shiftQuestion(ev.key === "ArrowRight" ? 1 : -1);
        return true;
      }
      if (front.kind === "permission") {
        ev.preventDefault();
        this.stepPermissionScope(ev.key === "ArrowRight");
        return true;
      }
    }
    if (ev.key === "ArrowDown" || ev.key === "ArrowUp") {
      ev.preventDefault();
      this.moveOption(ev.key === "ArrowDown" ? 1 : -1);
      return true;
    }
    if (ev.key === "e" && front.kind === "permission" && this.currentBashAllow(front)) {
      ev.preventDefault();
      front.patternOpen = !front.patternOpen;
      if (front.patternOpen && !front.patternBuffer) {
        front.patternBuffer = front.perm?.bashWords.join(" ") ?? "";
        front.patternDirty = false;
      }
      this.paint();
      queueMicrotask(() => this.card.querySelector<HTMLInputElement>("#block-glob")?.focus());
      return true;
    }
    if (ev.key === "o" && ev.ctrlKey && front.kind === "permission") {
      ev.preventDefault();
      this.enableYolo();
      return true;
    }
    if (ev.key === "c" && ev.ctrlKey && front.kind === "permission") {
      ev.preventDefault();
      this.rejectPermission("");
      return true;
    }
    if (ev.key === "f" && ev.ctrlKey && (front.kind === "permission" || front.kind === "plan")) {
      ev.preventDefault();
      this.expanded = !this.expanded;
      this.paint();
      return true;
    }
    if (ev.key === "x" && ev.shiftKey && front.kind === "question") {
      ev.preventDefault();
      this.finish(questionCancelled());
      return true;
    }
    return false;
  }

  drainAllowOnce() {
    const leftover = [...this.queue];
    this.queue = [];
    for (const item of leftover) {
      if (item.kind === "permission" && item.perm) {
        const id = firstAllowOnceId(item.perm.options);
        item.resolve(id ? permissionSelected(id) : permissionCancelled());
      } else {
        this.queue.push(item);
      }
    }
    this.paint();
  }

  private enqueue(partial: Omit<Pending, "resolve">): Promise<Json> {
    return new Promise((resolve) => {
      const item: Pending = {
        bashAllowCount: 0,
        bashDenyCount: 0,
        patternOpen: false,
        patternBuffer: "",
        patternDirty: false,
        mcpScope: "tool",
        ...partial,
        resolve,
      };
      if (item.kind === "cancel") this.queue.unshift(item);
      else this.queue.push(item);
      if (item.kind === "permission") this.maybeNotify();
      this.minimized = false;
      this.qEscLayer = 0;
      this.paint();
      this.card.focus();
    });
  }

  private front(): Pending | null {
    return this.queue[0] ?? null;
  }

  private finish(value: Json) {
    const item = this.queue.shift();
    if (!item) return;
    if (item.kind === "permission" && item.perm) {
      const opt = item.perm.options[item.optionIndex];
      if (opt) this.stickyKind = opt.kind;
    }
    item.resolve(value);
    if (!this.queue.some((q) => q.kind === "permission")) this.notified = false;
    this.rejectOpen = false;
    this.expanded = false;
    this.qEscLayer = 0;
    this.paint();
  }

  private onEsc() {
    const front = this.front();
    if (!front) return;
    if (front.kind === "permission" && front.patternOpen) {
      front.patternOpen = false;
      front.patternDirty = false;
      this.paint();
      this.card.focus();
      return;
    }
    if (front.kind === "cancel") {
      this.finish({ choice: "keep" });
      return;
    }
    if (front.kind === "feedback") {
      this.finish({ outcome: "dismissed" });
      return;
    }
    if (front.kind === "question") {
      const sel = front.qSelected[front.qIndex];
      if (sel && sel.size && this.qEscLayer === 0) {
        sel.clear();
        this.qEscLayer = 1;
        this.paint();
        return;
      }
    }
    this.minimized = true;
    this.paint();
    (document.getElementById("prompt") as HTMLElement | null)?.focus();
  }

  private confirmFront() {
    const front = this.front();
    if (!front) return;
    if (front.kind === "permission" && front.perm) {
      const opt = front.perm.options[front.optionIndex];
      if (!opt) return;
      if (opt.kind === "reject_once") {
        this.rejectOpen = true;
        this.paint();
        this.card.querySelector<HTMLTextAreaElement>("#block-reject-note")?.focus();
        return;
      }
      if (opt.optionId === "enable-always-approve") {
        this.enableYolo();
        return;
      }
      if (
        isBashAllowScope(opt.optionId) &&
        front.patternOpen &&
        front.patternDirty &&
        bashGlobIsCatchall(front.patternBuffer ?? "")
      ) {
        this.paint();
        this.card.querySelector<HTMLInputElement>("#block-glob")?.focus();
        return;
      }
      this.finish(permissionSelected(opt.optionId, permissionSelectionMeta(opt, front.perm, front)));
      return;
    }
    if (front.kind === "question") this.submitQuestion("accepted");
    if (front.kind === "plan") this.finish(planApproved());
    if (front.kind === "cancel") {
      const opts = cancelOptionsFor(front.cancelSubagentCount ?? 0);
      this.chooseCancel(opts[front.optionIndex ?? 0]?.id ?? "stop");
      return;
    }
    if (front.kind === "feedback") this.submitFeedback();
  }

  private pickNumber(n: number) {
    const front = this.front();
    if (!front) return;
    if (front.kind === "permission" && front.perm?.options[n]) {
      front.optionIndex = n;
      this.paint();
      this.confirmFront();
    } else if (front.kind === "question") {
      this.toggleQuestionOption(n);
    } else if (front.kind === "cancel") {
      const opt = cancelOptionsFor(front.cancelSubagentCount ?? 0)[n];
      if (opt) this.chooseCancel(opt.id);
    } else if (front.kind === "plan") {
      if (n === 0) this.finish(planApproved());
      if (n === 1) this.rejectPlan();
      if (n === 2) this.finish(planAbandoned());
    }
  }

  private moveOption(dir: number) {
    const front = this.front();
    if (!front?.perm) return;
    const n = front.perm.options.length;
    if (!n) return;
    front.optionIndex = (front.optionIndex + dir + n) % n;
    this.paint();
  }

  private cycleTab(dir: number) {
    const nodes = [...this.card.querySelectorAll<HTMLElement>("button, textarea, input")].filter(
      (el) => !el.hasAttribute("disabled") && el.offsetParent !== null,
    );
    if (!nodes.length) return;
    const i = nodes.indexOf(document.activeElement as HTMLElement);
    const next = nodes[(i + dir + nodes.length) % nodes.length];
    next?.focus();
  }

  private enableYolo() {
    this.hooks.onYolo();
  }

  private rejectPermission(note: string) {
    const front = this.front();
    if (!front?.perm) return;
    if (note.trim()) this.hooks.onRejectNote(note.trim());
    const rej = rejectOption(front.perm.options);
    this.finish(rej ? permissionSelected(rej.optionId) : permissionCancelled());
  }

  private chooseCancel(choice: CancelChoice) {
    const pref = prefFromCancelChoice(choice);
    if (pref) this.hooks.onCancelPref?.(pref);
    const cancelSubagents = cancelSubagentsForChoice(choice);
    if (cancelSubagents !== null) this.hooks.onStop(cancelSubagents);
    this.finish({ choice, cancelSubagents });
  }

  private shiftQuestion(dir: number) {
    const front = this.front();
    if (!front?.question) return;
    const n = front.question.questions.length;
    front.qIndex = Math.min(n - 1, Math.max(0, front.qIndex + dir));
    this.qEscLayer = 0;
    this.paint();
  }

  private toggleQuestionOption(index: number) {
    const front = this.front();
    const q = front?.question?.questions[front.qIndex];
    const sel = front?.qSelected[front.qIndex];
    if (!front || !q || !sel || !q.options[index]) return;
    if (q.multi) {
      if (sel.has(index)) sel.delete(index);
      else sel.add(index);
    } else {
      sel.clear();
      sel.add(index);
    }
    this.paint();
  }

  private submitQuestion(path: "accepted" | "chat" | "skip") {
    const front = this.front();
    if (!front?.question) return;
    const answers: { [k: string]: string[] } = {};
    const annotations: { [k: string]: { notes?: string; preview?: string } } = {};
    const partial: { [k: string]: string } = {};
    front.question.questions.forEach((q, i) => {
      const labels = [...(front.qSelected[i] ?? [])]
        .sort((a, b) => a - b)
        .map((idx) => q.options[idx]?.label)
        .filter((x): x is string => Boolean(x));
      const notes = front.qNotes[i]?.trim() ?? "";
      if (notes && !labels.length) labels.push("Other");
      if (labels.length) {
        answers[q.id] = labels;
        partial[q.id] = labels[0] ?? "";
      }
      if (notes || labels.length) {
        const preview = [...(front.qSelected[i] ?? [])]
          .map((idx) => q.options[idx]?.preview)
          .find((p) => p);
        annotations[q.id] = { notes: notes || undefined, preview: preview || undefined };
      }
    });
    if (path === "chat") this.finish(questionChat(partial));
    else if (path === "skip") this.finish(questionSkip(partial));
    else this.finish(questionAccepted(answers, annotations));
  }

  private rejectPlan() {
    const note = this.card.querySelector<HTMLTextAreaElement>("#block-plan-note")?.value ?? "";
    this.finish(planCancelled(note));
  }

  private submitFeedback() {
    const text = this.card.querySelector<HTMLTextAreaElement>("#block-feedback")?.value ?? "";
    if (text.trim()) this.hooks.onFeedback(text.trim());
    this.finish({ outcome: "sent" });
  }

  private maybeNotify() {
    if (this.notified || typeof Notification === "undefined") return;
    this.notified = true;
    if (Notification.permission === "granted") {
      try {
        new Notification("Grok 需要你批准", { body: "有工具在等许可。" });
      } catch {
        /* ignore */
      }
    }
  }

  private paint() {
    const front = this.front();
    if (this.timer !== null) {
      window.clearInterval(this.timer);
      this.timer = null;
    }
    if (!front) {
      this.card.hidden = true;
      this.pill.hidden = true;
      this.card.replaceChildren();
      return;
    }
    this.pill.hidden = !this.minimized;
    this.card.hidden = this.minimized;
    this.pill.textContent = this.pillCopy(front);
    if (this.minimized) return;
    this.card.replaceChildren();
    this.card.tabIndex = -1;
    this.card.className = `block-card kind-${front.kind}`;
    this.card.setAttribute("role", "dialog");
    this.card.append(this.header(front), this.body(front));
  }

  private pillCopy(front: Pending): string {
    const rest = this.queue.length > 1 ? ` · ${this.queue.length}` : "";
    if (front.kind === "permission") return `等待批准${rest}`;
    if (front.kind === "question") return `有问题要回答${rest}`;
    if (front.kind === "plan") return `计划待批准${rest}`;
    if (front.kind === "cancel") return "停止这次？";
    return "反馈";
  }

  private header(front: Pending): HTMLElement {
    const head = document.createElement("header");
    head.className = "block-head";
    const kind = document.createElement("span");
    kind.className = "block-kind";
    kind.textContent =
      front.kind === "permission"
        ? "许可"
        : front.kind === "question"
          ? "提问"
          : front.kind === "plan"
            ? "计划"
            : front.kind === "cancel"
              ? "停止"
              : "反馈";
    const q = document.createElement("span");
    q.className = "block-queue";
    q.textContent = this.queue.length > 1 ? `还有 ${this.queue.length - 1} 张` : "";
    const min = document.createElement("button");
    min.type = "button";
    min.className = "block-min";
    min.textContent = "收起";
    min.addEventListener("click", () => {
      this.minimized = true;
      this.paint();
    });
    head.append(kind, q, min);
    return head;
  }

  private body(front: Pending): HTMLElement {
    const wrap = document.createElement("div");
    wrap.className = "block-body";
    if (front.kind === "permission" && front.perm) wrap.append(...this.permissionBody(front.perm, front));
    if (front.kind === "question" && front.question) wrap.append(...this.questionBody(front.question, front));
    if (front.kind === "plan" && front.plan) wrap.append(...this.planBody(front.plan));
    if (front.kind === "cancel") wrap.append(...this.cancelBody());
    if (front.kind === "feedback") wrap.append(...this.feedbackBody());
    return wrap;
  }

  private permissionBody(req: PermissionRequest, front: Pending): HTMLElement[] {
    const title = document.createElement("h2");
    title.className = "block-title";
    title.textContent = req.title;
    const meta = document.createElement("p");
    meta.className = "block-meta";
    const bits = [req.kind, req.mcp, req.subagent ? `子 agent · ${req.subagent}` : ""].filter(Boolean);
    meta.textContent = bits.join(" · ");
    const detail = document.createElement("pre");
    detail.className = "block-detail";
    detail.textContent = req.detail;
    if (!this.expanded && req.detail.length > 280) {
      detail.textContent = `${req.detail.slice(0, 280)}…`;
    }
    const expand = document.createElement("button");
    expand.type = "button";
    expand.className = "block-link";
    expand.textContent = this.expanded ? "收起命令" : "显示完整命令";
    expand.hidden = req.detail.length < 120;
    expand.addEventListener("click", () => {
      this.expanded = !this.expanded;
      this.paint();
    });
    const list = document.createElement("div");
    list.className = "block-opts";
    req.options.forEach((opt, i) => {
      list.append(this.optionRow(i, scopedOptionLabel(opt, req, front), opt.kind, i === front.optionIndex, () => {
        front.optionIndex = i;
        front.patternOpen = false;
        this.paint();
      }));
    });
    const scope = this.permissionScopeBody(req, front);
    const actions = document.createElement("div");
    actions.className = "block-actions";
    const go = document.createElement("button");
    go.type = "button";
    go.className = "block-primary";
    go.textContent = "确定";
    go.addEventListener("click", () => this.confirmFront());
    const yolo = document.createElement("button");
    yolo.type = "button";
    yolo.className = "block-danger";
    yolo.textContent = "此后全部允许";
    yolo.addEventListener("click", () => this.enableYolo());
    const reject = document.createElement("button");
    reject.type = "button";
    reject.textContent = "拒绝";
    reject.addEventListener("click", () => {
      this.rejectOpen = true;
      this.paint();
    });
    actions.append(go, yolo, reject);
    const nodes: HTMLElement[] = [title, meta, detail, expand, list, ...scope, actions];
    if (this.rejectOpen) {
      const note = document.createElement("textarea");
      note.id = "block-reject-note";
      note.rows = 2;
      note.placeholder = "拒绝并告诉 Grok 该怎么做";
      note.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter" && (ev.ctrlKey || ev.metaKey || !ev.shiftKey)) {
          ev.preventDefault();
          this.rejectPermission(note.value);
        }
      });
      const send = document.createElement("button");
      send.type = "button";
      send.className = "block-primary";
      send.textContent = "拒绝并发送";
      send.addEventListener("click", () => this.rejectPermission(note.value));
      nodes.push(note, send);
    }
    return nodes;
  }

  private questionBody(req: QuestionRequest, front: Pending): HTMLElement[] {
    const q = req.questions[front.qIndex];
    if (!q) return [];
    const title = document.createElement("h2");
    title.className = "block-title";
    title.textContent = q.question;
    const step = document.createElement("p");
    step.className = "block-meta";
    step.textContent = `${front.qIndex + 1} / ${req.questions.length}${q.multi ? " · 可多选" : ""}`;
    const list = document.createElement("div");
    list.className = "block-opts";
    const sel = front.qSelected[front.qIndex] ?? new Set();
    q.options.forEach((opt, i) => {
      const row = this.optionRow(i, opt.label, "", sel.has(i), () => this.toggleQuestionOption(i));
      if (opt.description) {
        const d = document.createElement("span");
        d.className = "block-opt-desc";
        d.textContent = opt.description;
        row.append(d);
      }
      list.append(row);
    });
    const preview = [...sel].map((i) => q.options[i]?.preview).find(Boolean);
    const prev = document.createElement("pre");
    prev.className = "block-detail";
    prev.hidden = !preview;
    prev.textContent = preview ?? "";
    const notes = document.createElement("textarea");
    notes.rows = 2;
    notes.placeholder = "其他想法（可选）";
    notes.value = front.qNotes[front.qIndex] ?? "";
    notes.addEventListener("input", () => {
      front.qNotes[front.qIndex] = notes.value;
    });
    const actions = document.createElement("div");
    actions.className = "block-actions";
    if (front.qIndex > 0) {
      const prevBtn = document.createElement("button");
      prevBtn.type = "button";
      prevBtn.textContent = "上一题";
      prevBtn.addEventListener("click", () => this.shiftQuestion(-1));
      actions.append(prevBtn);
    }
    const next = document.createElement("button");
    next.type = "button";
    next.className = "block-primary";
    next.textContent = front.qIndex < req.questions.length - 1 ? "下一题" : "提交";
    next.addEventListener("click", () => {
      if (front.qIndex < req.questions.length - 1) this.shiftQuestion(1);
      else this.submitQuestion("accepted");
    });
    actions.append(next);
    if (req.mode === "plan") {
      const chat = document.createElement("button");
      chat.type = "button";
      chat.textContent = "再聊聊";
      chat.addEventListener("click", () => this.submitQuestion("chat"));
      const skip = document.createElement("button");
      skip.type = "button";
      skip.textContent = "跳过访谈";
      skip.addEventListener("click", () => this.submitQuestion("skip"));
      actions.append(chat, skip);
    }
    const dismiss = document.createElement("button");
    dismiss.type = "button";
    dismiss.textContent = "跳过";
    dismiss.addEventListener("click", () => this.finish(questionCancelled()));
    actions.append(dismiss);
    const nodes: HTMLElement[] = [title, step, list, prev, notes, actions];
    if (req.timeoutMs && req.timeoutMs > 0) {
      const clock = document.createElement("p");
      clock.className = "block-meta";
      const start = Date.now();
      const tick = () => {
        const left = Math.max(0, req.timeoutMs! - (Date.now() - start));
        clock.textContent = `剩余 ${Math.ceil(left / 1000)} 秒`;
        if (left <= 0) this.finish(questionCancelled());
      };
      tick();
      this.timer = window.setInterval(tick, 1000);
      nodes.push(clock);
    }
    return nodes;
  }

  private planBody(req: PlanRequest): HTMLElement[] {
    const title = document.createElement("h2");
    title.className = "block-title";
    title.textContent = req.planContent.trim() ? "批准这份计划？" : "还没有写计划";
    const md = document.createElement("div");
    md.className = "block-plan";
    md.innerHTML = renderMarkdown(req.planContent.trim() || "Agent 退出了 plan mode，但没有写出计划。");
    const note = document.createElement("textarea");
    note.id = "block-plan-note";
    note.rows = 2;
    note.placeholder = "改意见（可选）";
    const actions = document.createElement("div");
    actions.className = "block-actions";
    const ok = document.createElement("button");
    ok.type = "button";
    ok.className = "block-primary";
    ok.textContent = "批准";
    ok.addEventListener("click", () => this.finish(planApproved()));
    const changes = document.createElement("button");
    changes.type = "button";
    changes.textContent = "改意见";
    changes.addEventListener("click", () => this.rejectPlan());
    const quit = document.createElement("button");
    quit.type = "button";
    quit.textContent = "退出 plan";
    quit.addEventListener("click", () => this.finish(planAbandoned()));
    actions.append(ok, changes, quit);
    return [title, md, note, actions];
  }

  private cancelBody(): HTMLElement[] {
    const front = this.front();
    const count = front?.cancelSubagentCount ?? 0;
    const options = cancelOptionsFor(count);
    const title = document.createElement("h2");
    title.className = "block-title";
    title.textContent =
      count > 0
        ? count === 1
          ? "还有 1 个子 agent 在跑。要停它们吗？"
          : `还有 ${count} 个子 agent 在跑。要停它们吗？`
        : "要停下来吗？";
    const list = document.createElement("div");
    list.className = "block-opts";
    options.forEach((opt, i) => {
      const selected = i === (front?.optionIndex ?? 0);
      const row = this.optionRow(i, opt.label, "", selected, () => this.chooseCancel(opt.id));
      const hint = document.createElement("span");
      hint.className = "block-opt-desc";
      hint.textContent = opt.hint;
      row.append(hint);
      list.append(row);
    });
    const esc = document.createElement("p");
    esc.className = "block-meta";
    esc.textContent = "Esc 继续跑，什么都不停";
    return [title, list, esc];
  }

  private feedbackBody(): HTMLElement[] {
    const title = document.createElement("h2");
    title.className = "block-title";
    title.textContent = "反馈";
    const note = document.createElement("textarea");
    note.id = "block-feedback";
    note.rows = 4;
    note.placeholder = "想说的都可以写";
    note.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter" && !ev.shiftKey) {
        ev.preventDefault();
        this.submitFeedback();
      }
    });
    const actions = document.createElement("div");
    actions.className = "block-actions";
    const send = document.createElement("button");
    send.type = "button";
    send.className = "block-primary";
    send.textContent = "发送";
    send.addEventListener("click", () => this.submitFeedback());
    actions.append(send);
    return [title, note, actions];
  }

  private currentOpt(front: Pending) {
    return front.perm?.options[front.optionIndex] ?? null;
  }

  private currentBashAllow(front: Pending): boolean {
    const opt = this.currentOpt(front);
    return Boolean(opt && front.perm && isBashAllowScope(opt.optionId) && front.perm.bashWords.length);
  }

  private stepPermissionScope(right: boolean) {
    const front = this.front();
    if (!front?.perm) return;
    const opt = this.currentOpt(front);
    const words = front.perm.bashWords;
    if (opt && isBashAllowScope(opt.optionId) && words.length) {
      front.bashAllowCount = stepAllowCount(words, front.bashAllowCount || defaultAllowCount(words), right);
      front.patternOpen = false;
      this.paint();
      return;
    }
    if (opt && isBashDenyScope(opt.optionId) && words.length) {
      front.bashDenyCount = stepDenyCount(words, front.bashDenyCount || defaultDenyCount(words), right);
      this.paint();
      return;
    }
    if (opt && isMcpAllowScope(opt.optionId) && front.perm.mcpServer) {
      front.mcpScope = right ? "server" : "tool";
      this.paint();
      return;
    }
    const jump = front.perm.options.findIndex(
      (o) =>
        (isBashAllowScope(o.optionId) && words.length) ||
        (isMcpAllowScope(o.optionId) && front.perm?.mcpServer),
    );
    if (jump >= 0) {
      front.optionIndex = jump;
      this.paint();
    }
  }

  private permissionScopeBody(req: PermissionRequest, front: Pending): HTMLElement[] {
    const opt = this.currentOpt(front);
    if (!opt) return [];
    const nodes: HTMLElement[] = [];
    const bashAllow = isBashAllowScope(opt.optionId) && req.bashWords.length > 0;
    const bashDeny = isBashDenyScope(opt.optionId) && req.bashWords.length > 0;
    const mcpAllow = isMcpAllowScope(opt.optionId) && Boolean(req.mcpTool || req.mcpServer) && !req.bashWords.length;
    if (bashAllow && front.patternOpen) {
      const wrap = document.createElement("div");
      wrap.className = "block-scope";
      const input = document.createElement("input");
      input.id = "block-glob";
      input.type = "text";
      input.value = front.patternBuffer ?? "";
      input.placeholder = "命令模式，例如 gh api repos/*";
      input.addEventListener("input", () => {
        front.patternBuffer = input.value;
        front.patternDirty = true;
        const preview = wrap.querySelector(".block-scope-hint");
        if (preview) preview.textContent = this.globHint(front, req);
      });
      const hint = document.createElement("p");
      hint.className = "block-scope-hint";
      hint.textContent = this.globHint(front, req);
      wrap.append(input, hint);
      nodes.push(wrap);
      return nodes;
    }
    if (bashAllow || bashDeny) {
      const wrap = document.createElement("div");
      wrap.className = "block-scope";
      const chips = document.createElement("div");
      chips.className = "block-chips";
      const count = (bashDeny ? front.bashDenyCount : front.bashAllowCount) ?? req.bashWords.length;
      req.bashWords.forEach((word, i) => {
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = "block-chip";
        chip.textContent = word;
        chip.setAttribute("aria-pressed", i < count ? "true" : "false");
        chip.addEventListener("click", (ev) => {
          ev.stopPropagation();
          const n = i + 1;
          if (bashDeny) front.bashDenyCount = n;
          else front.bashAllowCount = allowScopePersists(req.bashWords, n) ? n : req.bashWords.length;
          this.paint();
        });
        chips.append(chip);
      });
      wrap.append(chips);
      const hint = document.createElement("p");
      hint.className = "block-scope-hint";
      if (bashAllow) {
        hint.textContent =
          opt.optionId === "allow-always-command"
            ? "← → 调整范围，或自定义模式"
            : "← → 预览范围（当前 Agent 会记住整条命令）";
        const edit = document.createElement("button");
        edit.type = "button";
        edit.className = "block-link";
        edit.textContent = "自定义模式";
        edit.addEventListener("click", () => {
          front.patternOpen = true;
          if (!front.patternBuffer) front.patternBuffer = req.bashWords.join(" ");
          this.paint();
          queueMicrotask(() => this.card.querySelector<HTMLInputElement>("#block-glob")?.focus());
        });
        wrap.append(hint, edit);
      } else {
        hint.textContent = "← → 调整永远拒绝的范围";
        wrap.append(hint);
      }
      nodes.push(wrap);
    }
    if (mcpAllow && req.mcpServer) {
      const wrap = document.createElement("div");
      wrap.className = "block-scope";
      const chips = document.createElement("div");
      chips.className = "block-chips";
      const tool = document.createElement("button");
      tool.type = "button";
      tool.className = "block-chip";
      tool.textContent = req.mcpTool || "这个工具";
      tool.setAttribute("aria-pressed", front.mcpScope === "tool" ? "true" : "false");
      tool.addEventListener("click", () => {
        front.mcpScope = "tool";
        this.paint();
      });
      const server = document.createElement("button");
      server.type = "button";
      server.className = "block-chip";
      server.textContent = `${req.mcpServer} 全部`;
      server.setAttribute("aria-pressed", front.mcpScope === "server" ? "true" : "false");
      server.addEventListener("click", () => {
        front.mcpScope = "server";
        this.paint();
      });
      chips.append(tool, server);
      const hint = document.createElement("p");
      hint.className = "block-scope-hint";
      hint.textContent =
        opt.optionId === "allow-always-mcp"
          ? "← 这个工具  → 整个服务器"
          : "← → 切换范围（当前 Agent 只会记住这个工具）";
      wrap.append(chips, hint);
      nodes.push(wrap);
    }
    return nodes;
  }

  private globHint(front: Pending, req: PermissionRequest): string {
    const pattern = (front.patternBuffer ?? "").trim();
    if (!pattern) return "输入要始终允许的命令模式";
    if (bashGlobIsCatchall(pattern)) return "匹配范围太大，不会保存";
    if (bashPatternMatches(pattern, req.command || req.bashWords.join(" "))) return "会匹配这条命令";
    return "不会匹配这条命令";
  }

  private optionRow(
    index: number,
    label: string,
    kind: string,
    selected: boolean,
    onClick: () => void,
  ): HTMLButtonElement {
    const row = document.createElement("button");
    row.type = "button";
    row.className = "block-opt";
    if (kind) row.dataset.kind = kind;
    row.setAttribute("aria-selected", selected ? "true" : "false");
    const num = document.createElement("span");
    num.className = "block-num";
    num.textContent = String(index + 1);
    const text = document.createElement("span");
    text.textContent = label;
    row.append(num, text);
    row.addEventListener("click", onClick);
    return row;
  }
}
