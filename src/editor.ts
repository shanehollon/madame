export interface Editor {
  getText(): string;
  setText(text: string): void;
  onChange(cb: (text: string) => void): void;
  focus(): void;
  applyConfig(cfg: { tab_size: number; tab_inserts_spaces: boolean; word_wrap: boolean; font_family: string | null; font_size: number }): void;
  getElement(): HTMLTextAreaElement;
  getVisibleTopLine(): number;
  scrollToLine(line: number): void;
  getCursorLine(): number;
  onCursorMove(cb: (line: number) => void): void;
}

export function createEditor(el: HTMLTextAreaElement): Editor {
  let tabSize = 2;
  let tabInsertsSpaces = true;

  const listeners: Array<(t: string) => void> = [];

  el.addEventListener("input", () => {
    const t = el.value;
    for (const cb of listeners) cb(t);
  });

  el.addEventListener("keydown", (e) => {
    if (e.key === "Tab" && !e.ctrlKey && !e.altKey && !e.metaKey) {
      e.preventDefault();
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const insert = tabInsertsSpaces ? " ".repeat(tabSize) : "\t";
      el.value = el.value.slice(0, start) + insert + el.value.slice(end);
      el.selectionStart = el.selectionEnd = start + insert.length;
      el.dispatchEvent(new Event("input"));
    }
  });

  return {
    getText: () => el.value,
    setText: (t) => {
      el.value = t;
      // Fire input so listeners update.
      el.dispatchEvent(new Event("input"));
    },
    onChange: (cb) => { listeners.push(cb); },
    focus: () => el.focus(),
    applyConfig(cfg) {
      tabSize = cfg.tab_size;
      tabInsertsSpaces = cfg.tab_inserts_spaces;
      el.classList.toggle("wrap", cfg.word_wrap);
      el.classList.toggle("nowrap", !cfg.word_wrap);
      if (cfg.font_family) el.style.fontFamily = cfg.font_family;
      el.style.fontSize = `${cfg.font_size}px`;
    },
    getElement: () => el,
    getVisibleTopLine() {
      const lineHeight = parseFloat(getComputedStyle(el).lineHeight) || 20;
      return el.scrollTop / lineHeight;
    },
    scrollToLine(line) {
      const lineHeight = parseFloat(getComputedStyle(el).lineHeight) || 20;
      el.scrollTop = line * lineHeight;
    },
    getCursorLine() {
      const before = el.value.slice(0, el.selectionStart);
      let line = 0;
      for (let i = 0; i < before.length; i++) {
        if (before.charCodeAt(i) === 10) line++;
      }
      return line;
    },
    onCursorMove(cb) {
      const handler = () => {
        if (document.activeElement !== el) return;
        const before = el.value.slice(0, el.selectionStart);
        let line = 0;
        for (let i = 0; i < before.length; i++) {
          if (before.charCodeAt(i) === 10) line++;
        }
        cb(line);
      };
      document.addEventListener("selectionchange", handler);
      el.addEventListener("keyup", handler);
      el.addEventListener("click", handler);
      el.addEventListener("input", handler);
    },
  };
}
