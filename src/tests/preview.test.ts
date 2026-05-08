import { describe, it, expect, beforeEach } from "vitest";
import { createPreview } from "../preview";

describe("preview", () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  it("renders headings", () => {
    const p = createPreview(container);
    p.render("# Hello");
    expect(container.querySelector("h1")?.textContent).toContain("Hello");
  });

  it("renders GFM task lists as checkboxes", () => {
    const p = createPreview(container);
    p.render("- [x] done\n- [ ] pending");
    const checkboxes = container.querySelectorAll('input[type="checkbox"]');
    expect(checkboxes.length).toBe(2);
    expect((checkboxes[0] as HTMLInputElement).checked).toBe(true);
    expect((checkboxes[1] as HTMLInputElement).checked).toBe(false);
  });

  it("renders tables", () => {
    const p = createPreview(container);
    p.render("| A | B |\n|---|---|\n| 1 | 2 |");
    expect(container.querySelector("table")).toBeTruthy();
    expect(container.querySelectorAll("td").length).toBe(2);
  });

  it("renders strikethrough", () => {
    const p = createPreview(container);
    p.render("~~gone~~");
    expect(container.querySelector("s, del")).toBeTruthy();
  });

  it("applies highlight.js class to code blocks with language", () => {
    const p = createPreview(container);
    p.render("```js\nconst x = 1;\n```");
    const code = container.querySelector("pre code");
    expect(code?.className).toMatch(/hljs|language-js/);
  });

  it("annotates block elements with data-source-line", () => {
    const p = createPreview(container);
    p.render("# Line 1\n\nPara line 3\n");
    const withLines = container.querySelectorAll("[data-source-line]");
    expect(withLines.length).toBeGreaterThan(0);
  });

  describe("frontmatter", () => {
    it("renders YAML frontmatter as a key/value table", () => {
      const p = createPreview(container);
      p.render("---\nname: thing\ndescription: thing\nother: thing\n---\n");

      const table = container.querySelector("table.frontmatter");
      expect(table).toBeTruthy();

      const rows = container.querySelectorAll("table.frontmatter tbody tr");
      expect(rows.length).toBe(3);

      const firstKey = rows[0].querySelector("th")?.textContent;
      const firstValue = rows[0].querySelector("td")?.textContent;
      expect(firstKey).toBe("name");
      expect(firstValue).toBe("thing");
    });

    it("does not render frontmatter delimiters as HRs", () => {
      const p = createPreview(container);
      p.render("---\nname: thing\n---\n");
      expect(container.querySelector("hr")).toBeNull();
    });

    it("does not turn frontmatter content into a Setext heading", () => {
      const p = createPreview(container);
      p.render("---\nname: thing\n---\n");
      expect(container.querySelector("h2")).toBeNull();
    });

    it("renders mid-document --- as HR (not frontmatter)", () => {
      const p = createPreview(container);
      p.render("# Title\n\nbody\n\n---\n\nmore\n");
      expect(container.querySelector("hr")).toBeTruthy();
      expect(container.querySelector("table.frontmatter")).toBeNull();
    });

    it("preserves Setext H2 (Title\\n---) at top of file", () => {
      const p = createPreview(container);
      p.render("Heading\n---\n\nbody\n");
      expect(container.querySelector("h2")?.textContent).toContain("Heading");
      expect(container.querySelector("table.frontmatter")).toBeNull();
    });

    it("renders content after frontmatter normally", () => {
      const p = createPreview(container);
      p.render("---\nname: thing\n---\n\n# Heading\n\nbody\n");
      expect(container.querySelector("table.frontmatter")).toBeTruthy();
      expect(container.querySelector("h1")?.textContent).toContain("Heading");
    });

    it("falls through if frontmatter has no closing ---", () => {
      const p = createPreview(container);
      p.render("---\nname: thing\nother: thing\n");
      expect(container.querySelector("table.frontmatter")).toBeNull();
    });

    it("strips surrounding double quotes from values", () => {
      const p = createPreview(container);
      p.render('---\ntitle: "My Doc"\n---\n');
      const value = container.querySelector("table.frontmatter td")?.textContent;
      expect(value).toBe("My Doc");
    });

    it("renders values literally (no markdown parsing)", () => {
      const p = createPreview(container);
      p.render("---\nname: *not italic*\n---\n");
      const value = container.querySelector("table.frontmatter td");
      expect(value?.querySelector("em")).toBeNull();
      expect(value?.textContent).toBe("*not italic*");
    });
  });

  describe("scroll math", () => {
    function rect(top: number, height = 30): DOMRect {
      return {
        top, bottom: top + height, left: 0, right: 800,
        width: 800, height, x: 0, y: top,
        toJSON() { return this; },
      } as DOMRect;
    }

    function setupScroller(scrollerTop: number, scrollTop: number) {
      const scroller = document.createElement("div");
      const content = document.createElement("div");
      scroller.appendChild(content);
      document.body.appendChild(scroller);
      Object.defineProperty(scroller, "getBoundingClientRect", {
        configurable: true,
        value: () => rect(scrollerTop, 550),
      });
      Object.defineProperty(scroller, "scrollTop", {
        configurable: true, writable: true, value: scrollTop,
      });
      Object.defineProperty(scroller, "clientHeight", {
        configurable: true, value: 550,
      });
      return { scroller, content };
    }

    it("scrollToSourceLine uses scroller-relative positions, not body-relative", () => {
      // Scroller starts at body Y=50 (e.g., titlebar 30 + pane padding 20).
      const { scroller, content } = setupScroller(50, 0);
      const p = createPreview(content);
      p.render("# H1\n\n## H2");

      const nodes = content.querySelectorAll<HTMLElement>("[data-source-line]");
      // H1 at body Y=70, H2 at body Y=200 (scroller-relative: 20 and 150).
      Object.defineProperty(nodes[0], "getBoundingClientRect", {
        configurable: true, value: () => rect(70),
      });
      Object.defineProperty(nodes[1], "getBoundingClientRect", {
        configurable: true, value: () => rect(200),
      });

      const h2Line = Number(nodes[1].getAttribute("data-source-line"));
      p.scrollToSourceLine(h2Line);

      // H2 should land at top of scroller viewport: scrollTop = 200 - 50 = 150.
      // (NOT 200, which would be body-relative offsetTop.)
      expect(scroller.scrollTop).toBe(150);
    });

    it("scrollToSourceLine(0) anchors preview to scrollTop 0 (top of file)", () => {
      const { scroller, content } = setupScroller(50, 100);
      const p = createPreview(content);
      p.render("# H1\n\n## H2");

      const nodes = content.querySelectorAll<HTMLElement>("[data-source-line]");
      // First node has padding above it (scroller-relative pos = 20).
      Object.defineProperty(nodes[0], "getBoundingClientRect", {
        configurable: true, value: () => rect(70),
      });
      Object.defineProperty(nodes[0], "offsetTop", { configurable: true, value: 70 });
      Object.defineProperty(nodes[1], "getBoundingClientRect", {
        configurable: true, value: () => rect(200),
      });
      Object.defineProperty(nodes[1], "offsetTop", { configurable: true, value: 200 });

      p.scrollToSourceLine(0);

      // Line 0 should anchor to scrollTop=0 even when first block is below padding.
      expect(scroller.scrollTop).toBe(0);
    });

    it("getFirstVisibleSourceLine uses scroller-relative positions", () => {
      // Scrolled so H2 is exactly at top of viewport.
      const { scroller: _scroller, content } = setupScroller(50, 150);
      const p = createPreview(content);
      p.render("# H1\n\n## H2");

      const nodes = content.querySelectorAll<HTMLElement>("[data-source-line]");
      // H1 was at body Y=70, now scrolled off (scroller-relative pos still 20).
      Object.defineProperty(nodes[0], "getBoundingClientRect", {
        configurable: true, value: () => rect(70 - 150),
      });
      Object.defineProperty(nodes[0], "offsetTop", { configurable: true, value: 70 });
      // H2 was at body Y=200, now at viewport top of scroller (rect.top = 50).
      Object.defineProperty(nodes[1], "getBoundingClientRect", {
        configurable: true, value: () => rect(50),
      });
      Object.defineProperty(nodes[1], "offsetTop", { configurable: true, value: 200 });

      const h2Line = Number(nodes[1].getAttribute("data-source-line"));
      expect(p.getFirstVisibleSourceLine()).toBe(h2Line);
    });

    it("scrollToSourceLine with offsetFromTop places the line at that Y in viewport", () => {
      const { scroller, content } = setupScroller(50, 0);
      const p = createPreview(content);
      p.render("# H1\n\n## H2");

      const nodes = content.querySelectorAll<HTMLElement>("[data-source-line]");
      // H1 at body Y=70 (scroller-rel pos 20)
      Object.defineProperty(nodes[0], "getBoundingClientRect", {
        configurable: true, value: () => rect(70),
      });
      // H2 at body Y=200 (scroller-rel pos 150)
      Object.defineProperty(nodes[1], "getBoundingClientRect", {
        configurable: true, value: () => rect(200),
      });

      const h2Line = Number(nodes[1].getAttribute("data-source-line"));
      // Place H2 at Y=100 in preview viewport.
      p.scrollToSourceLine(h2Line, 100);

      // H2 pos = 150, want it at Y=100 → scrollTop = 150 - 100 = 50.
      expect(scroller.scrollTop).toBe(50);
    });

    it("getFirstVisibleSourceLine returns 0 when scroller is at top", () => {
      const { scroller: _scroller, content } = setupScroller(50, 0);
      const p = createPreview(content);
      p.render("# H1\n\n## H2");

      const nodes = content.querySelectorAll<HTMLElement>("[data-source-line]");
      Object.defineProperty(nodes[0], "getBoundingClientRect", {
        configurable: true, value: () => rect(70),
      });
      Object.defineProperty(nodes[1], "getBoundingClientRect", {
        configurable: true, value: () => rect(200),
      });

      expect(p.getFirstVisibleSourceLine()).toBe(0);
    });
  });
});
