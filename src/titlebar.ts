import { getCurrentWindow } from "@tauri-apps/api/window";

export interface Titlebar {
  setFilename(name: string): void;
  setDirty(dirty: boolean): void;
}

export function createTitlebar(el: HTMLElement): Titlebar {
  const filenameEl = el.querySelector<HTMLElement>(".filename")!;
  const minBtn = el.querySelector<HTMLButtonElement>("#btn-min")!;
  const maxBtn = el.querySelector<HTMLButtonElement>("#btn-max")!;
  const closeBtn = el.querySelector<HTMLButtonElement>("#btn-close")!;
  const win = getCurrentWindow();

  minBtn.addEventListener("click", () => win.minimize());
  maxBtn.addEventListener("click", () => win.toggleMaximize());
  closeBtn.addEventListener("click", () => win.close());

  function basename(p: string): string {
    const parts = p.split(/[\\/]/);
    return parts[parts.length - 1] || p;
  }

  return {
    setFilename(name) {
      filenameEl.textContent = name === "" ? "Untitled" : basename(name);
      filenameEl.title = name;
    },
    setDirty(dirty) {
      el.classList.toggle("dirty", dirty);
    },
  };
}
