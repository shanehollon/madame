import { describe, it, expect, vi } from "vitest";
import { createScrollSync } from "../scroll-sync";

function mockEditor() {
  let top = 0;
  const listeners: Array<() => void> = [];
  return {
    getVisibleTopLine: () => Math.floor(top / 20),
    scrollToLine: vi.fn((line: number) => { top = line * 20; }),
    getElement() {
      const el = document.createElement("div") as any;
      el.addEventListener = (_e: string, fn: () => void) => { if (_e === "scroll") listeners.push(fn); };
      return el;
    },
    fireScroll(newTop: number) { top = newTop; listeners.forEach((f) => f()); },
  };
}

function mockPreview() {
  let line = 0;
  const listeners: Array<() => void> = [];
  const scroller = document.createElement("div") as any;
  scroller.addEventListener = (_e: string, fn: () => void) => { if (_e === "scroll") listeners.push(fn); };
  return {
    getFirstVisibleSourceLine: () => line,
    scrollToSourceLine: vi.fn((l: number) => { line = l; }),
    getElement: () => document.createElement("div"),
    getScroller: () => scroller,
    fireScroll(newLine: number) { line = newLine; listeners.forEach((f) => f()); },
  };
}

describe("scroll-sync", () => {
  it("syncs editor scroll to preview", () => {
    const ed = mockEditor();
    const pv = mockPreview();
    createScrollSync(ed as any, pv as any);
    ed.fireScroll(200); // line 10
    expect(pv.scrollToSourceLine).toHaveBeenCalledWith(10);
  });

  it("syncs preview scroll to editor", () => {
    const ed = mockEditor();
    const pv = mockPreview();
    createScrollSync(ed as any, pv as any);
    pv.fireScroll(7);
    expect(ed.scrollToLine).toHaveBeenCalledWith(7);
  });

  it("suppresses feedback loop within 50ms window", async () => {
    const ed = mockEditor();
    const pv = mockPreview();
    createScrollSync(ed as any, pv as any);
    ed.fireScroll(200); // editor → preview (line 10)
    expect(pv.scrollToSourceLine).toHaveBeenCalledTimes(1);
    // Preview scroll event fires as a consequence — must not bounce back.
    pv.fireScroll(10);
    expect(ed.scrollToLine).not.toHaveBeenCalled();
  });

  it("can be disabled", () => {
    const ed = mockEditor();
    const pv = mockPreview();
    const sync = createScrollSync(ed as any, pv as any);
    sync.setEnabled(false);
    ed.fireScroll(200);
    expect(pv.scrollToSourceLine).not.toHaveBeenCalled();
  });
});
