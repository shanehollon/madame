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
});
