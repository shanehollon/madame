export interface ConfirmButton {
  label: string;
  value: string;
  kind?: "primary" | "danger" | "default";
}

export function confirm(message: string, buttons: ConfirmButton[]): Promise<string | null> {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    const modal = document.createElement("div");
    modal.className = "modal confirm-modal";
    const p = document.createElement("p");
    p.textContent = message;
    const btnRow = document.createElement("div");
    btnRow.className = "buttons";

    function esc(e: KeyboardEvent) {
      if (e.key === "Escape") close(null);
    }

    function close(value: string | null) {
      document.removeEventListener("keydown", esc);
      overlay.remove();
      resolve(value);
    }

    for (const b of buttons) {
      const btn = document.createElement("button");
      btn.textContent = b.label;
      if (b.kind === "primary") btn.classList.add("primary");
      if (b.kind === "danger") btn.classList.add("danger");
      btn.addEventListener("click", () => close(b.value));
      btnRow.appendChild(btn);
    }

    overlay.addEventListener("click", (e) => { if (e.target === overlay) close(null); });
    document.addEventListener("keydown", esc);

    modal.appendChild(p);
    modal.appendChild(btnRow);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
  });
}
