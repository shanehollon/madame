{ pkgs }:
pkgs.mkShell {
  nativeBuildInputs = with pkgs; [
    rustc
    cargo
    rustfmt
    clippy
    bun
    pkg-config
  ];
  buildInputs = with pkgs; [
    webkitgtk_4_1
    gtk3
    libsoup_3
    glib-networking
    openssl
  ];
  shellHook = ''
    echo "Madame dev shell — run 'cargo tauri build' from src-tauri/"
  '';
}
