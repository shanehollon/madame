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
});
