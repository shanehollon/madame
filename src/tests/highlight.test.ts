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
});
