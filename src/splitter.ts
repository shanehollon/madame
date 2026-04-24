export interface Splitter {
  setRatio(r: number): void;
  getRatio(): number;
  onResize(cb: (ratio: number) => void): void;
}

export function createSplitter(params: {
  container: HTMLElement;
  left: HTMLElement;
  right: HTMLElement;
  handle: HTMLElement;
}): Splitter {
  const { container, left, right, handle } = params;
  let ratio = 0.5;
  const listeners: Array<(r: number) => void> = [];

  function apply() {
    // Only set flex basis when both panes are visible.
    const leftVisible = !left.classList.contains("hidden");
    const rightVisible = !right.classList.contains("hidden");
    if (leftVisible && rightVisible) {
      left.style.flex = `${ratio} 1 0`;
      right.style.flex = `${1 - ratio} 1 0`;
    } else {
      left.style.flex = "";
      right.style.flex = "";
    }
  }

  handle.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    handle.classList.add("dragging");
    handle.setPointerCapture(e.pointerId);
    const rect = container.getBoundingClientRect();

    const onMove = (ev: PointerEvent) => {
      const x = ev.clientX - rect.left;
      const r = Math.max(0.1, Math.min(0.9, x / rect.width));
      ratio = r;
      apply();
      for (const cb of listeners) cb(r);
    };
    const onUp = () => {
      handle.releasePointerCapture(e.pointerId);
      handle.classList.remove("dragging");
      handle.removeEventListener("pointermove", onMove);
      handle.removeEventListener("pointerup", onUp);
    };
    handle.addEventListener("pointermove", onMove);
    handle.addEventListener("pointerup", onUp);
  });

  apply();

  return {
    setRatio(r) { ratio = r; apply(); },
    getRatio: () => ratio,
    onResize(cb) { listeners.push(cb); },
  };
}
