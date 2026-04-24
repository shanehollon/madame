type Handler = () => void;

export interface Shortcuts {
  on(combo: string, handler: Handler): void;
}

function normalizeCombo(combo: string): string {
  const parts = combo.toLowerCase().split("+").map((s) => s.trim());
  const mods: string[] = [];
  let key = "";
  for (const p of parts) {
    if (p === "ctrl" || p === "shift" || p === "alt" || p === "meta") mods.push(p);
    else key = p;
  }
  mods.sort();
  return `${mods.join("+")}|${key}`;
}

function eventCombo(e: KeyboardEvent): string {
  const mods: string[] = [];
  if (e.ctrlKey) mods.push("ctrl");
  if (e.shiftKey) mods.push("shift");
  if (e.altKey) mods.push("alt");
  if (e.metaKey) mods.push("meta");
  mods.sort();
  return `${mods.join("+")}|${e.key.toLowerCase()}`;
}

export function createShortcuts(target: Window | HTMLElement): Shortcuts {
  const handlers = new Map<string, Handler>();

  target.addEventListener("keydown", ((e: KeyboardEvent) => {
    const key = eventCombo(e);
    const h = handlers.get(key);
    if (h) {
      e.preventDefault();
      h();
    }
  }) as EventListener);

  return {
    on(combo, handler) {
      handlers.set(normalizeCombo(combo), handler);
    },
  };
}
