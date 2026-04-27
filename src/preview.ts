import MarkdownIt from "markdown-it";
import type Token from "markdown-it/lib/token.mjs";
import type { Options } from "markdown-it/lib/index.mjs";
import taskLists from "markdown-it-task-lists";
import anchor from "markdown-it-anchor";
import hljs from "highlight.js";
import { convertFileSrc } from "@tauri-apps/api/core";

export interface Preview {
  render(md: string, baseDir?: string): void;
  getElement(): HTMLElement;
  getScroller(): HTMLElement;
  getFirstVisibleSourceLine(): number;
  scrollToSourceLine(line: number): void;
  isSourceLineVisible(line: number): boolean;
}

function createMdInstance(): MarkdownIt {
  const md: MarkdownIt = new MarkdownIt({
    html: true,
    linkify: true,
    typographer: false,
    breaks: false,
    highlight(str: string, lang: string): string {
      if (lang && hljs.getLanguage(lang)) {
        try {
          return `<pre><code class="hljs language-${lang}">${hljs.highlight(str, { language: lang, ignoreIllegals: true }).value}</code></pre>`;
        } catch {
          // fall through to default
        }
      }
      return `<pre><code class="hljs">${md.utils.escapeHtml(str)}</code></pre>`;
    },
  });
  md.use(taskLists, { enabled: true });
  md.use(anchor, {});

  // Attach data-source-line to top-level block tokens for scroll sync.
  const originalRender = md.renderer.renderToken.bind(md.renderer);
  md.renderer.renderToken = function (tokens: Token[], idx: number, options: Options): string {
    const token = tokens[idx];
    if (token.map && token.level === 0 && token.nesting !== -1) {
      token.attrSet("data-source-line", String(token.map[0]));
    }
    return originalRender(tokens, idx, options);
  };
  return md;
}

export function createPreview(el: HTMLElement): Preview {
  const md = createMdInstance();
  let baseDirCache: string | undefined;

  function resolveImagePaths(): void {
    const imgs = el.querySelectorAll("img");
    imgs.forEach((img) => {
      const src = img.getAttribute("src") ?? "";
      if (!src) return;
      // Skip URLs the webview already understands.
      if (/^(https?:|data:|blob:|asset:|tauri:)/.test(src)) return;

      let absolute: string | null = null;
      if (/^\/|^[a-zA-Z]:[\\/]/.test(src)) {
        absolute = src;
      } else if (baseDirCache) {
        const sep = baseDirCache.endsWith("/") || baseDirCache.endsWith("\\") ? "" : "/";
        absolute = `${baseDirCache}${sep}${src}`;
      }
      if (absolute) {
        img.setAttribute("src", convertFileSrc(absolute));
      }
    });
  }

  return {
    render(text: string, baseDir?: string): void {
      baseDirCache = baseDir;
      try {
        el.innerHTML = md.render(text);
        resolveImagePaths();
      } catch (err) {
        el.innerHTML = "";
        const errPre = document.createElement("pre");
        errPre.className = "render-error";
        errPre.textContent = String(err);
        const rawPre = document.createElement("pre");
        rawPre.textContent = text;
        el.append(errPre, rawPre);
      }
    },
    getElement: () => el,
    getScroller: () => el.parentElement ?? el,
    getFirstVisibleSourceLine(): number {
      const scroller = el.parentElement ?? el;
      const top = scroller.scrollTop;
      const nodes = el.querySelectorAll<HTMLElement>("[data-source-line]");
      let prev: HTMLElement | null = null;
      for (const n of Array.from(nodes)) {
        if (n.offsetTop > top) {
          const nextLine = Number(n.getAttribute("data-source-line") ?? "0");
          if (!prev) return nextLine;
          const prevLine = Number(prev.getAttribute("data-source-line") ?? "0");
          const span = n.offsetTop - prev.offsetTop;
          if (span <= 0) return prevLine;
          const frac = (top - prev.offsetTop) / span;
          return prevLine + frac * (nextLine - prevLine);
        }
        prev = n;
      }
      return prev ? Number(prev.getAttribute("data-source-line") ?? "0") : 0;
    },
    scrollToSourceLine(line: number): void {
      const scroller = el.parentElement ?? el;
      const nodes = el.querySelectorAll<HTMLElement>("[data-source-line]");
      let prev: HTMLElement | null = null;
      for (const n of Array.from(nodes)) {
        const l = Number(n.getAttribute("data-source-line") ?? "0");
        if (l > line) {
          if (!prev) { scroller.scrollTop = n.offsetTop; return; }
          const prevLine = Number(prev.getAttribute("data-source-line") ?? "0");
          const lineSpan = l - prevLine;
          if (lineSpan <= 0) { scroller.scrollTop = prev.offsetTop; return; }
          const frac = (line - prevLine) / lineSpan;
          scroller.scrollTop = prev.offsetTop + frac * (n.offsetTop - prev.offsetTop);
          return;
        }
        prev = n;
      }
      if (prev) scroller.scrollTop = prev.offsetTop;
    },
    isSourceLineVisible(line: number): boolean {
      const scroller = el.parentElement ?? el;
      const top = scroller.scrollTop;
      const bottom = top + scroller.clientHeight;
      const nodes = Array.from(el.querySelectorAll<HTMLElement>("[data-source-line]"));
      let prev: HTMLElement | null = null;
      let next: HTMLElement | null = null;
      for (const n of nodes) {
        const l = Number(n.getAttribute("data-source-line") ?? "0");
        if (l <= line) prev = n;
        else { next = n; break; }
      }
      if (!prev) return false;
      const blockTop = prev.offsetTop;
      const blockBottom = next ? next.offsetTop : prev.offsetTop + prev.offsetHeight;
      return blockBottom > top && blockTop < bottom;
    },
  };
}
