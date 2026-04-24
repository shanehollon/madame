export function showRecentModal(files: string[]): Promise<string | null> {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    const modal = document.createElement("div");
    modal.className = "modal";
    const input = document.createElement("input");
    input.placeholder = files.length === 0 ? "No recent files" : "Filter recent files...";
    input.disabled = files.length === 0;
    const list = document.createElement("ul");

    let filtered = files.slice();
    let active = 0;

    function basename(p: string): string {
      const parts = p.split(/[\\/]/);
      return parts[parts.length - 1] || p;
    }

    function render() {
      list.innerHTML = "";
      filtered.forEach((path, i) => {
        const li = document.createElement("li");
        li.textContent = `${basename(path)}   —   ${path}`;
        if (i === active) li.classList.add("active");
        li.addEventListener("click", () => close(path));
        list.appendChild(li);
      });
    }

    function close(value: string | null) {
      overlay.remove();
      resolve(value);
    }

    input.addEventListener("input", () => {
      const q = input.value.toLowerCase();
      filtered = files.filter((p) => p.toLowerCase().includes(q));
      active = 0;
      render();
    });

    input.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown") { e.preventDefault(); active = Math.min(active + 1, filtered.length - 1); render(); }
      else if (e.key === "ArrowUp") { e.preventDefault(); active = Math.max(active - 1, 0); render(); }
      else if (e.key === "Enter") { e.preventDefault(); if (filtered[active]) close(filtered[active]); }
      else if (e.key === "Escape") { e.preventDefault(); close(null); }
    });

    overlay.addEventListener("click", (e) => { if (e.target === overlay) close(null); });

    modal.appendChild(input);
    modal.appendChild(list);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    render();
    input.focus();
  });
}
