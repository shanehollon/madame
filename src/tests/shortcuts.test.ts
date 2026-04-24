import { describe, it, expect, vi } from "vitest";
import { createShortcuts } from "../shortcuts";

function keydown(key: string, mods: { ctrl?: boolean; shift?: boolean; alt?: boolean } = {}) {
  return new KeyboardEvent("keydown", {
    key,
    ctrlKey: !!mods.ctrl,
    shiftKey: !!mods.shift,
    altKey: !!mods.alt,
    bubbles: true,
    cancelable: true,
  });
}

describe("shortcuts", () => {
  it("fires registered handler on Ctrl+O", () => {
    const s = createShortcuts(window);
    const handler = vi.fn();
    s.on("ctrl+o", handler);
    window.dispatchEvent(keydown("o", { ctrl: true }));
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("does not fire handler when modifier mismatch", () => {
    const s = createShortcuts(window);
    const handler = vi.fn();
    s.on("ctrl+s", handler);
    window.dispatchEvent(keydown("s", {}));
    expect(handler).not.toHaveBeenCalled();
  });

  it("distinguishes ctrl+s from ctrl+shift+s", () => {
    const s = createShortcuts(window);
    const save = vi.fn();
    const saveAs = vi.fn();
    s.on("ctrl+s", save);
    s.on("ctrl+shift+s", saveAs);
    window.dispatchEvent(keydown("s", { ctrl: true, shift: true }));
    expect(save).not.toHaveBeenCalled();
    expect(saveAs).toHaveBeenCalledTimes(1);
  });

  it("normalizes key case", () => {
    const s = createShortcuts(window);
    const handler = vi.fn();
    s.on("ctrl+R", handler);
    window.dispatchEvent(keydown("r", { ctrl: true }));
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("prevents default when a handler runs", () => {
    const s = createShortcuts(window);
    s.on("ctrl+e", () => {});
    const ev = keydown("e", { ctrl: true });
    window.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(true);
  });
});
