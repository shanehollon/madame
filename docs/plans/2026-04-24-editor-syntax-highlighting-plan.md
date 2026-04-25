# Editor Syntax Highlighting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add lightweight Markdown syntax highlighting to the editor `<textarea>` via an overlay `<pre>` layer, gated by a new `editor.syntax_highlighting` config flag (default `true`).

**Architecture:** The textarea is wrapped in a `.editor-stack` div with a sibling `<pre class="editor-highlight">` rendered behind it. The textarea text is made transparent (caret + selection still visible). On every input, a hand-rolled tokenizer (`src/highlight.ts`) returns an HTML string that's set as the `<pre>`'s `innerHTML`. Both layers share identical font/padding/wrap rules so glyph alignment is exact. Scroll events on the textarea are mirrored to the highlight layer.

**Tech Stack:** TypeScript (frontend), Vite, vitest, Rust + serde (config). No new dependencies.

**Spec:** `docs/plans/2026-04-24-editor-syntax-highlighting-design.md`

**Task ordering note:** Tasks are ordered so every commit leaves the project building cleanly. Tokenizer (1–5) is pure TS, no DOM. Combined DOM+CSS (6) keeps the editor pane visually intact. Config types are added (7, 8) before any code consumes them (9). Verification (10) is last.

---

## File Structure

**New files:**
- `src/highlight.ts` — tokenizer; exports `renderHighlight(source: string): string`.
- `src/tests/highlight.test.ts` — vitest cases for the tokenizer.

**Modified files:**
- `src/index.html` — wrap `#editor` in `.editor-stack`, add `<pre class="editor-highlight">`.
- `src/styles/app.css` — `.editor-stack` layout, `.editor-highlight` overlay rules, transparent-textarea rules, palette CSS variables (light + dark), `.tok-*` classes.
- `src/editor.ts` — accept the highlight `<pre>`; render on `input` (rAF-coalesced); mirror scroll; honor `syntax_highlighting` in `applyConfig`; skip when pane hidden.
- `src/main.ts` — pass the highlight element into `createEditor`.
- `src/types.ts` — add `syntax_highlighting: boolean` to `EditorConfig`.
- `src-tauri/src/config.rs` — add `syntax_highlighting: bool` field with default `true`.

---

## Task 1: Tokenizer scaffold — escape + plain-text passthrough

**Files:**
- Create: `src/highlight.ts`
- Test: `src/tests/highlight.test.ts`

- [ ] **Step 1: Write failing tests for empty input, plain text, HTML escaping, and trailing-newline preservation**

`src/tests/highlight.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { renderHighlight } from "../highlight";

describe("renderHighlight", () => {
  it("returns empty string for empty input", () => {
    expect(renderHighlight("")).toBe("");
  });

  it("passes plain text through unchanged", () => {
    expect(renderHighlight("just words")).toBe("just words");
  });

  it("escapes HTML special characters in plain text", () => {
    expect(renderHighlight("a < b & c > d \"e\"")).toBe(
      "a &lt; b &amp; c &gt; d &quot;e&quot;",
    );
  });

  it("preserves multi-line plain text with newlines", () => {
    expect(renderHighlight("line one\nline two")).toBe("line one\nline two");
  });

  it("appends a trailing space when source ends with newline (so <pre> renders the empty line)", () => {
    expect(renderHighlight("hello\n")).toBe("hello\n ");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd C:/Users/Shane/projects/madame && bun run test -- highlight
```
Expected: tests fail with module-not-found / function-not-defined.

- [ ] **Step 3: Implement minimal tokenizer**

`src/highlight.ts`:
```ts
const ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
};

function escape(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ESCAPES[c]);
}

function renderInline(s: string): string {
  return escape(s);
}

function renderBlock(line: string): string {
  return renderInline(line);
}

export function renderHighlight(source: string): string {
  if (source === "") return "";
  const lines = source.split("\n");
  const out: string[] = [];
  for (const line of lines) {
    out.push(renderBlock(line));
  }
  let html = out.join("\n");
  if (source.endsWith("\n")) html += " ";
  return html;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
bun run test -- highlight
```
Expected: 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/highlight.ts src/tests/highlight.test.ts
git commit -m "feat(highlight): tokenizer scaffold with escape + plain text"
```

---

## Task 2: ATX headings

**Files:**
- Modify: `src/highlight.ts`
- Test: `src/tests/highlight.test.ts`

- [ ] **Step 1: Add failing tests for headings**

Append to `src/tests/highlight.test.ts` inside the existing `describe`:
```ts
  it("wraps an h1 with tok-heading and the # in tok-markup", () => {
    const out = renderHighlight("# Title");
    expect(out).toBe(
      '<span class="tok-heading"><span class="tok-markup"># </span>Title</span>',
    );
  });

  it("supports h2 through h6", () => {
    expect(renderHighlight("## Two")).toContain('tok-markup">## </span>Two');
    expect(renderHighlight("###### Six")).toContain(
      'tok-markup">###### </span>Six',
    );
  });

  it("does not treat 7+ hashes as a heading", () => {
    expect(renderHighlight("####### nope")).toBe("####### nope");
  });

  it("does not treat # without trailing space as a heading", () => {
    expect(renderHighlight("#nope")).toBe("#nope");
  });
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
bun run test -- highlight
```
Expected: 4 new tests fail.

- [ ] **Step 3: Update `renderBlock` in `src/highlight.ts`**

Replace the existing `renderBlock` with:
```ts
function renderBlock(line: string): string {
  const heading = /^(#{1,6}) (.*)$/.exec(line);
  if (heading) {
    const hashes = heading[1];
    const rest = heading[2];
    return `<span class="tok-heading"><span class="tok-markup">${hashes} </span>${renderInline(rest)}</span>`;
  }
  return renderInline(line);
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
bun run test -- highlight
```
Expected: all tokenizer tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/highlight.ts src/tests/highlight.test.ts
git commit -m "feat(highlight): ATX headings"
```

---

## Task 3: Inline tokens — code, strong, em, link

**Files:**
- Modify: `src/highlight.ts`
- Test: `src/tests/highlight.test.ts`

- [ ] **Step 1: Add failing tests for inline tokens**

Append to `src/tests/highlight.test.ts`:
```ts
  it("highlights inline code", () => {
    const out = renderHighlight("foo `bar` baz");
    expect(out).toContain('<span class="tok-code">');
    expect(out).toContain('<span class="tok-markup">`</span>bar<span class="tok-markup">`</span>');
  });

  it("escapes HTML inside inline code", () => {
    expect(renderHighlight("`<script>`")).toContain("&lt;script&gt;");
  });

  it("highlights strong with **", () => {
    const out = renderHighlight("**bold**");
    expect(out).toContain('<span class="tok-strong">');
    expect(out).toContain('<span class="tok-markup">**</span>bold<span class="tok-markup">**</span>');
  });

  it("highlights em with single *", () => {
    const out = renderHighlight("*italic*");
    expect(out).toContain('<span class="tok-em">');
    expect(out).toContain('<span class="tok-markup">*</span>italic<span class="tok-markup">*</span>');
  });

  it("prefers strong over em for **", () => {
    const out = renderHighlight("**bold**");
    expect(out).toContain('tok-strong');
    expect(out).not.toContain('tok-em');
  });

  it("highlights links with [text](url)", () => {
    const out = renderHighlight("see [docs](https://example.com) here");
    expect(out).toContain('<span class="tok-link-text">docs</span>');
    expect(out).toContain('<span class="tok-link-url">https://example.com</span>');
    expect(out).toContain('<span class="tok-markup">[</span>');
    expect(out).toContain('<span class="tok-markup">](</span>');
    expect(out).toContain('<span class="tok-markup">)</span>');
  });

  it("leaves unclosed inline code as plain text", () => {
    expect(renderHighlight("`unclosed")).toBe("`unclosed");
  });

  it("combines inline tokens within a heading", () => {
    const out = renderHighlight("# Hello **world**");
    expect(out).toContain('tok-heading');
    expect(out).toContain('tok-strong');
  });
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
bun run test -- highlight
```
Expected: 8 new tests fail.

- [ ] **Step 3: Replace `renderInline` with full inline scanner**

In `src/highlight.ts`, replace `renderInline` with:
```ts
function renderInline(s: string): string {
  let out = "";
  let textBuf = "";
  let i = 0;
  const flush = () => {
    if (textBuf) {
      out += escape(textBuf);
      textBuf = "";
    }
  };
  while (i < s.length) {
    const ch = s[i];

    // inline code: `...`
    if (ch === "`") {
      const end = s.indexOf("`", i + 1);
      if (end !== -1) {
        flush();
        const inner = s.slice(i + 1, end);
        out += `<span class="tok-code"><span class="tok-markup">\`</span>${escape(inner)}<span class="tok-markup">\`</span></span>`;
        i = end + 1;
        continue;
      }
    }

    // link: [text](url)
    if (ch === "[") {
      const closeBracket = s.indexOf("]", i + 1);
      if (closeBracket !== -1 && s[closeBracket + 1] === "(") {
        const closeParen = s.indexOf(")", closeBracket + 2);
        if (closeParen !== -1) {
          flush();
          const linkText = s.slice(i + 1, closeBracket);
          const linkUrl = s.slice(closeBracket + 2, closeParen);
          out += `<span class="tok-markup">[</span><span class="tok-link-text">${escape(linkText)}</span><span class="tok-markup">](</span><span class="tok-link-url">${escape(linkUrl)}</span><span class="tok-markup">)</span>`;
          i = closeParen + 1;
          continue;
        }
      }
    }

    // strong: **...**  (must be checked before em)
    if (ch === "*" && s[i + 1] === "*") {
      const end = s.indexOf("**", i + 2);
      if (end !== -1 && end > i + 2) {
        flush();
        const inner = s.slice(i + 2, end);
        out += `<span class="tok-strong"><span class="tok-markup">**</span>${escape(inner)}<span class="tok-markup">**</span></span>`;
        i = end + 2;
        continue;
      }
    }

    // em: *...*
    if (ch === "*") {
      const end = s.indexOf("*", i + 1);
      if (end !== -1 && end > i + 1) {
        flush();
        const inner = s.slice(i + 1, end);
        out += `<span class="tok-em"><span class="tok-markup">*</span>${escape(inner)}<span class="tok-markup">*</span></span>`;
        i = end + 1;
        continue;
      }
    }

    textBuf += ch;
    i++;
  }
  flush();
  return out;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
bun run test -- highlight
```
Expected: all tokenizer tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/highlight.ts src/tests/highlight.test.ts
git commit -m "feat(highlight): inline tokens (code, strong, em, link)"
```

---

## Task 4: Block-level — list markers and blockquotes

**Files:**
- Modify: `src/highlight.ts`
- Test: `src/tests/highlight.test.ts`

- [ ] **Step 1: Add failing tests**

Append to `src/tests/highlight.test.ts`:
```ts
  it("highlights unordered list markers", () => {
    expect(renderHighlight("- item")).toContain('<span class="tok-list-marker">-</span>');
    expect(renderHighlight("* item")).toContain('<span class="tok-list-marker">*</span>');
    expect(renderHighlight("+ item")).toContain('<span class="tok-list-marker">+</span>');
  });

  it("highlights ordered list markers", () => {
    expect(renderHighlight("1. first")).toContain('<span class="tok-list-marker">1.</span>');
    expect(renderHighlight("42. forty-two")).toContain('<span class="tok-list-marker">42.</span>');
  });

  it("preserves leading whitespace before list markers", () => {
    const out = renderHighlight("  - nested");
    expect(out).toContain('  <span class="tok-list-marker">-</span>');
  });

  it("inline-tokenizes the body of a list item", () => {
    const out = renderHighlight("- **bold** item");
    expect(out).toContain('tok-list-marker');
    expect(out).toContain('tok-strong');
  });

  it("highlights blockquotes", () => {
    const out = renderHighlight("> quoted");
    expect(out).toContain('<span class="tok-quote">');
    expect(out).toContain('<span class="tok-markup">&gt; </span>');
  });

  it("inline-tokenizes the body of a blockquote", () => {
    const out = renderHighlight("> see *this*");
    expect(out).toContain('tok-quote');
    expect(out).toContain('tok-em');
  });
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
bun run test -- highlight
```
Expected: 6 new tests fail.

- [ ] **Step 3: Extend `renderBlock` with list and blockquote rules**

In `src/highlight.ts`, replace `renderBlock` with:
```ts
function renderBlock(line: string): string {
  const heading = /^(#{1,6}) (.*)$/.exec(line);
  if (heading) {
    const hashes = heading[1];
    const rest = heading[2];
    return `<span class="tok-heading"><span class="tok-markup">${hashes} </span>${renderInline(rest)}</span>`;
  }

  const quote = /^(\s*)> (.*)$/.exec(line);
  if (quote) {
    const indent = quote[1];
    const rest = quote[2];
    return `${indent}<span class="tok-quote"><span class="tok-markup">&gt; </span>${renderInline(rest)}</span>`;
  }

  const list = /^(\s*)([-*+]|\d+\.) (.*)$/.exec(line);
  if (list) {
    const indent = list[1];
    const marker = list[2];
    const rest = list[3];
    return `${indent}<span class="tok-list-marker">${escape(marker)}</span> ${renderInline(rest)}`;
  }

  return renderInline(line);
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
bun run test -- highlight
```
Expected: all tokenizer tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/highlight.ts src/tests/highlight.test.ts
git commit -m "feat(highlight): list markers and blockquotes"
```

---

## Task 5: Fenced code blocks (stateful)

**Files:**
- Modify: `src/highlight.ts`
- Test: `src/tests/highlight.test.ts`

- [ ] **Step 1: Add failing tests**

Append to `src/tests/highlight.test.ts`:
```ts
  it("wraps fence delimiter lines in tok-codeblock + tok-markup", () => {
    const out = renderHighlight("```\ncode\n```");
    const lines = out.split("\n");
    expect(lines[0]).toBe('<span class="tok-codeblock"><span class="tok-markup">```</span></span>');
    expect(lines[2]).toBe('<span class="tok-codeblock"><span class="tok-markup">```</span></span>');
  });

  it("treats lines inside a fence as tok-codeblock with no inline parsing", () => {
    const out = renderHighlight("```\n**not bold**\n```");
    const lines = out.split("\n");
    expect(lines[1]).toBe('<span class="tok-codeblock">**not bold**</span>');
  });

  it("supports a language tag on the opening fence", () => {
    const out = renderHighlight("```js\nx\n```");
    const lines = out.split("\n");
    expect(lines[0]).toContain('tok-codeblock');
    expect(lines[0]).toContain('```js');
  });

  it("preserves leading whitespace on a fence line (alignment with textarea)", () => {
    const out = renderHighlight("  ```\n  code\n  ```");
    const lines = out.split("\n");
    expect(lines[0]).toBe('<span class="tok-codeblock"><span class="tok-markup">  ```</span></span>');
  });

  it("escapes HTML inside fenced code", () => {
    const out = renderHighlight("```\n<div>\n```");
    expect(out).toContain('&lt;div&gt;');
  });

  it("returns to normal parsing after the closing fence", () => {
    const out = renderHighlight("```\ncode\n```\n# After");
    expect(out).toContain('tok-heading');
  });
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
bun run test -- highlight
```
Expected: 6 new tests fail.

- [ ] **Step 3: Update `renderHighlight` to track fence state**

In `src/highlight.ts`:

a) Add this constant near the top of the file (just below `ESCAPES`):
```ts
const FENCE_RE = /^\s*```[\w-]*\s*$/;
```

b) Replace the existing `renderHighlight` function body:
```ts
export function renderHighlight(source: string): string {
  if (source === "") return "";
  const lines = source.split("\n");
  const out: string[] = [];
  let inFence = false;
  for (const line of lines) {
    if (FENCE_RE.test(line)) {
      out.push(`<span class="tok-codeblock"><span class="tok-markup">${escape(line)}</span></span>`);
      inFence = !inFence;
      continue;
    }
    if (inFence) {
      out.push(`<span class="tok-codeblock">${escape(line)}</span>`);
      continue;
    }
    out.push(renderBlock(line));
  }
  let html = out.join("\n");
  if (source.endsWith("\n")) html += " ";
  return html;
}
```

(The whole-line `escape(line)` — including any leading whitespace — is intentional, so the rendered overlay aligns column-for-column with the textarea.)

- [ ] **Step 4: Run tests to verify they pass**

```bash
bun run test -- highlight
```
Expected: all tokenizer tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/highlight.ts src/tests/highlight.test.ts
git commit -m "feat(highlight): fenced code blocks"
```

---

## Task 6: DOM wrap + overlay CSS + palette

This task changes both `index.html` and `app.css` in a single commit. Splitting them would leave the editor pane visually broken between commits, since wrapping the textarea in `.editor-stack` requires the new flex CSS to keep the textarea filling its pane.

**Files:**
- Modify: `src/index.html`
- Modify: `src/styles/app.css`

- [ ] **Step 1: Update `src/index.html`**

Replace this block:
```html
        <div class="pane editor-pane" id="editor-pane">
          <textarea id="editor" spellcheck="false" class="wrap"></textarea>
        </div>
```
with:
```html
        <div class="pane editor-pane" id="editor-pane">
          <div class="editor-stack">
            <pre class="editor-highlight wrap" id="editor-highlight" aria-hidden="true"></pre>
            <textarea id="editor" spellcheck="false" class="wrap"></textarea>
          </div>
        </div>
```

- [ ] **Step 2: Add palette variables to `:root` in `src/styles/app.css`**

Find the existing `:root { … }` block (the very top of the file) and append these properties before its closing `}`:
```css
  --syn-markup: #a0a4ab;
  --syn-heading: #1f6feb;
  --syn-code: #7d4cdb;
  --syn-code-bg: rgba(125, 76, 219, 0.08);
  --syn-codeblock-bg: rgba(125, 76, 219, 0.06);
  --syn-link: #0a7d4f;
  --syn-link-url: #a0a4ab;
  --syn-quote: #737880;
  --syn-marker: #c2410c;
```

- [ ] **Step 3: Add dark overrides in `src/styles/app.css`**

Find the existing `@media (prefers-color-scheme: dark) { :root { … } }` block and append these properties before its inner `}`:
```css
    --syn-markup: #6e7681;
    --syn-heading: #79c0ff;
    --syn-code: #c8a2ff;
    --syn-code-bg: rgba(200, 162, 255, 0.10);
    --syn-codeblock-bg: rgba(200, 162, 255, 0.07);
    --syn-link: #7ee2b8;
    --syn-link-url: #6e7681;
    --syn-quote: #9aa0a6;
    --syn-marker: #ffa657;
```

- [ ] **Step 4: Replace the editor-pane rules in `src/styles/app.css`**

Find these existing rules:
```css
.pane.editor-pane {
  display: flex;
}
.pane.editor-pane textarea {
  flex: 1;
  border: none;
  outline: none;
  resize: none;
  padding: 12px;
  font-family: "Consolas", "Menlo", "Monaco", monospace;
  font-size: 14px;
  line-height: 1.5;
  color: var(--editor-fg);
  background: var(--editor-bg);
}
.pane.editor-pane textarea.wrap { white-space: pre-wrap; word-break: break-word; }
.pane.editor-pane textarea.nowrap { white-space: pre; overflow-x: auto; }
```
Replace them with:
```css
.pane.editor-pane {
  display: flex;
}
.pane.editor-pane .editor-stack {
  position: relative;
  flex: 1;
  display: flex;
  min-width: 0;
}
.pane.editor-pane textarea {
  flex: 1;
  border: none;
  outline: none;
  resize: none;
  padding: 12px;
  font-family: "Consolas", "Menlo", "Monaco", monospace;
  font-size: 14px;
  line-height: 1.5;
  color: transparent;
  background: transparent;
  caret-color: var(--editor-fg);
  position: relative;
  z-index: 1;
}
.pane.editor-pane .editor-highlight {
  position: absolute;
  inset: 0;
  margin: 0;
  padding: 12px;
  font-family: "Consolas", "Menlo", "Monaco", monospace;
  font-size: 14px;
  line-height: 1.5;
  color: var(--editor-fg);
  background: var(--editor-bg);
  pointer-events: none;
  overflow: hidden;
  z-index: 0;
  tab-size: 2;
}
.pane.editor-pane textarea.wrap,
.pane.editor-pane .editor-highlight.wrap {
  white-space: pre-wrap;
  word-break: break-word;
}
.pane.editor-pane textarea.nowrap,
.pane.editor-pane .editor-highlight.nowrap {
  white-space: pre;
  overflow-x: auto;
}

/* Disable highlighting (config flag): hide the layer and restore textarea colors. */
.pane.editor-pane .editor-stack.no-highlight .editor-highlight { display: none; }
.pane.editor-pane .editor-stack.no-highlight textarea {
  color: var(--editor-fg);
  background: var(--editor-bg);
}

/* Token palette */
.tok-markup { color: var(--syn-markup); }
.tok-heading { color: var(--syn-heading); font-weight: bold; }
.tok-strong { font-weight: bold; }
.tok-em { font-style: italic; }
.tok-code { color: var(--syn-code); background: var(--syn-code-bg); border-radius: 3px; }
.tok-codeblock { background: var(--syn-codeblock-bg); }
.tok-link-text { color: var(--syn-link); }
.tok-link-url { color: var(--syn-link-url); }
.tok-quote { color: var(--syn-quote); font-style: italic; }
.tok-list-marker { color: var(--syn-marker); }
```

- [ ] **Step 5: Verify tests still pass**

```bash
bun run test
```
Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/index.html src/styles/app.css
git commit -m "feat(editor): overlay markup + syntax-highlight palette"
```

> At this commit point, the editor textarea is transparent but the highlight `<pre>` is empty (nothing wires it up yet). That means the editor pane shows the caret but no text. This is intentional and short-lived — Task 9 wires up rendering and the visible text returns. Tasks 7 and 8 in between are pure type/config plumbing with no runtime impact.

---

## Task 7: Backend config flag

**Files:**
- Modify: `src-tauri/src/config.rs`

- [ ] **Step 1: Add a failing Rust test**

In `src-tauri/src/config.rs`, append two tests inside the existing `mod tests` block (just before its closing `}`):
```rust
    #[test]
    fn syntax_highlighting_defaults_to_true() {
        let cfg = EditorConfig::default();
        assert!(cfg.syntax_highlighting);
    }

    #[test]
    fn syntax_highlighting_loads_from_yaml() {
        let tmp = NamedTempFile::new().unwrap();
        std::fs::write(
            tmp.path(),
            "editor:\n  syntax_highlighting: false\n",
        )
        .unwrap();
        let cfg = load_or_default(tmp.path()).unwrap();
        assert!(!cfg.editor.syntax_highlighting);
    }
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd C:/Users/Shane/projects/madame/src-tauri && cargo test --lib config::tests
```
Expected: compile error (field `syntax_highlighting` does not exist on `EditorConfig`).

- [ ] **Step 3: Add the field to `EditorConfig`**

In `src-tauri/src/config.rs`, change `EditorConfig` and its `Default` impl:
```rust
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(default)]
pub struct EditorConfig {
    pub tab_size: u32,
    pub tab_inserts_spaces: bool,
    pub word_wrap: bool,
    pub font_family: Option<String>,
    pub font_size: u32,
    pub syntax_highlighting: bool,
}

impl Default for EditorConfig {
    fn default() -> Self {
        Self {
            tab_size: 2,
            tab_inserts_spaces: true,
            word_wrap: true,
            font_family: None,
            font_size: 14,
            syntax_highlighting: true,
        }
    }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd C:/Users/Shane/projects/madame/src-tauri && cargo test --lib config::tests
```
Expected: all `config::tests` pass, including the two new ones.

- [ ] **Step 5: Commit**

```bash
cd C:/Users/Shane/projects/madame
git add src-tauri/src/config.rs
git commit -m "feat(config): add editor.syntax_highlighting flag (default true)"
```

---

## Task 8: Frontend config type

**Files:**
- Modify: `src/types.ts`

- [ ] **Step 1: Add the field to `EditorConfig`**

In `src/types.ts`, change:
```ts
export interface EditorConfig {
  tab_size: number;
  tab_inserts_spaces: boolean;
  word_wrap: boolean;
  font_family: string | null;
  font_size: number;
}
```
to:
```ts
export interface EditorConfig {
  tab_size: number;
  tab_inserts_spaces: boolean;
  word_wrap: boolean;
  font_family: string | null;
  font_size: number;
  syntax_highlighting: boolean;
}
```

- [ ] **Step 2: Type-check the project**

```bash
cd C:/Users/Shane/projects/madame && bunx tsc --noEmit
```
Expected: no type errors. (The existing `editor.applyConfig` accepts a stricter type that omits the new field; passing a wider object satisfies structural subtyping. TypeScript accepts this.)

- [ ] **Step 3: Run tests**

```bash
bun run test
```
Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/types.ts
git commit -m "feat(types): syntax_highlighting on EditorConfig"
```

---

## Task 9: Wire highlight rendering into the editor module

**Files:**
- Modify: `src/editor.ts`
- Modify: `src/main.ts`

- [ ] **Step 1: Replace `src/editor.ts`**

Replace the entire contents of `src/editor.ts` with:
```ts
import { renderHighlight } from "./highlight";

export interface Editor {
  getText(): string;
  setText(text: string): void;
  onChange(cb: (text: string) => void): void;
  focus(): void;
  applyConfig(cfg: { tab_size: number; tab_inserts_spaces: boolean; word_wrap: boolean; font_family: string | null; font_size: number; syntax_highlighting: boolean }): void;
  getElement(): HTMLTextAreaElement;
  getVisibleTopLine(): number;
  scrollToLine(line: number): void;
  getCursorLine(): number;
  onCursorMove(cb: (line: number) => void): void;
}

export function createEditor(el: HTMLTextAreaElement, highlight: HTMLElement): Editor {
  let tabSize = 2;
  let tabInsertsSpaces = true;
  let highlightingEnabled = true;
  let rafId: number | null = null;

  const stack = el.parentElement; // .editor-stack

  const scheduleHighlight = () => {
    if (!highlightingEnabled) return;
    if (rafId !== null) return;
    rafId = requestAnimationFrame(() => {
      rafId = null;
      if (!highlightingEnabled) return;
      highlight.innerHTML = renderHighlight(el.value);
    });
  };

  const listeners: Array<(t: string) => void> = [];

  el.addEventListener("input", () => {
    const t = el.value;
    for (const cb of listeners) cb(t);
    scheduleHighlight();
  });

  el.addEventListener("scroll", () => {
    highlight.scrollTop = el.scrollTop;
    highlight.scrollLeft = el.scrollLeft;
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
      el.dispatchEvent(new Event("input"));
    },
    onChange: (cb) => { listeners.push(cb); },
    focus: () => el.focus(),
    applyConfig(cfg) {
      tabSize = cfg.tab_size;
      tabInsertsSpaces = cfg.tab_inserts_spaces;
      el.classList.toggle("wrap", cfg.word_wrap);
      el.classList.toggle("nowrap", !cfg.word_wrap);
      highlight.classList.toggle("wrap", cfg.word_wrap);
      highlight.classList.toggle("nowrap", !cfg.word_wrap);
      if (cfg.font_family) {
        el.style.fontFamily = cfg.font_family;
        highlight.style.fontFamily = cfg.font_family;
      }
      el.style.fontSize = `${cfg.font_size}px`;
      highlight.style.fontSize = `${cfg.font_size}px`;
      const tabPx = `${cfg.tab_size}`;
      el.style.tabSize = tabPx;
      highlight.style.tabSize = tabPx;

      highlightingEnabled = cfg.syntax_highlighting;
      if (stack) stack.classList.toggle("no-highlight", !highlightingEnabled);
      if (highlightingEnabled) {
        scheduleHighlight();
      } else {
        highlight.innerHTML = "";
      }
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
```

- [ ] **Step 2: Update `src/main.ts` to pass the highlight element**

In `src/main.ts`, replace this line:
```ts
const editor = createEditor(document.getElementById("editor") as HTMLTextAreaElement);
```
with:
```ts
const editor = createEditor(
  document.getElementById("editor") as HTMLTextAreaElement,
  document.getElementById("editor-highlight") as HTMLElement,
);
```

- [ ] **Step 3: Type-check**

```bash
cd C:/Users/Shane/projects/madame && bunx tsc --noEmit
```
Expected: no type errors.

- [ ] **Step 4: Run tests**

```bash
bun run test
```
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/editor.ts src/main.ts
git commit -m "feat(editor): render highlight overlay on input + scroll"
```

---

## Task 10: Manual verification

**Files:** none (verification only)

- [ ] **Step 1: Run the app in dev mode**

```bash
cd C:/Users/Shane/projects/madame && bun run tauri dev
```

- [ ] **Step 2: Verify highlighting basics**

In the editor pane, paste this test document:

```
# Heading 1
## Heading 2

Some **bold** and *italic* and `inline code` and a [link](https://example.com).

> A quoted line with *emphasis*.

- bullet one
- bullet **two**
1. numbered

```js
function x() { return 42; }
```

Plain trailing text.
```

Verify each of these is visible:
- `#` markers and heading text colored (markup dim, heading colored).
- `**bold**` shows the asterisks dimmed and the inner text bold.
- `*italic*` similar with italic style.
- `` `inline code` `` is purple-ish on a tinted background.
- `[link](url)` shows green link text and dimmed URL with bracket markup.
- Blockquote `>` line uses muted italic.
- List markers (`-`, `1.`) are colored differently from body text.
- Fenced code-block lines have a tinted background; opening/closing ` ``` ` are dimmed.
- Caret remains visible while typing; no double-glyphs (no drift between layers).

- [ ] **Step 3: Verify scroll alignment**

Type or paste enough lines to require scrolling. Scroll the editor pane. The colored layer must scroll perfectly in sync — no glyph drift between textarea and overlay at any scroll position.

- [ ] **Step 4: Verify wrap mode**

Toggle `editor.word_wrap` between `true` and `false` in `madame_config.yaml` (next to the binary or in the dev working dir), restart the app. Ensure both modes still align. With wrap on, paste a very long line and confirm it wraps the same way in both layers.

- [ ] **Step 5: Verify the disable flag**

In `madame_config.yaml`, set:
```yaml
editor:
  syntax_highlighting: false
```
Restart the app. The editor renders as plain dark/light text — no overlay visible, no colors, normal text color restored. Set back to `true` and restart; colors return.

- [ ] **Step 6: Verify dark/light**

Toggle the OS color scheme. Both palettes should look reasonable (light: blue/green/purple/terracotta on white; dark: similar muted hues on dark).

- [ ] **Step 7: Verify preview-only mode**

Press `Ctrl+Shift+E` to switch to preview-only. Press it again to return to both panes — the overlay should be back and aligned with whatever the textarea currently shows.

- [ ] **Step 8: Build a release bundle**

```bash
bun run tauri build
```
Expected: build succeeds with no warnings about the new code.

- [ ] **Step 9: Commit any verification fallout**

If verification surfaced bugs requiring code changes, fix and commit them with descriptive messages. Otherwise this task ends with no commit.

---

## Summary

After completing all tasks: typing in the editor produces a colored, structured view of Markdown source via an overlay layer. Toggling `editor.syntax_highlighting: false` falls back to plain text. No new dependencies. Tokenizer is fully unit-tested.
