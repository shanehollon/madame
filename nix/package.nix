{ pkgs }:
let
  version = "0.1.0";
  src = pkgs.fetchurl {
    url = "https://github.com/shanehollon/madame/releases/download/v${version}/madame-${version}-x86_64-linux.tar.gz";
    hash = "sha256-t3iKhe3ZO6iL382Rpt9p3eg/2q1yRjVyO9TaKaIvQIM=";
  };
in
pkgs.stdenv.mkDerivation {
  pname = "madame";
  inherit version src;

  nativeBuildInputs = with pkgs; [
    autoPatchelfHook
    makeWrapper
    wrapGAppsHook3
    copyDesktopItems
  ];

  buildInputs = with pkgs; [
    webkitgtk_4_1
    gtk3
    libsoup_3
    glib-networking
    openssl
  ];

  dontConfigure = true;
  dontBuild = true;

  installPhase = ''
    runHook preInstall
    install -Dm755 madame                $out/bin/madame
    install -Dm644 icons/32x32.png       $out/share/icons/hicolor/32x32/apps/madame.png
    install -Dm644 icons/64x64.png       $out/share/icons/hicolor/64x64/apps/madame.png
    install -Dm644 icons/128x128.png     $out/share/icons/hicolor/128x128/apps/madame.png
    install -Dm644 icons/128x128@2x.png  $out/share/icons/hicolor/256x256/apps/madame.png
    install -Dm644 icons/icon.png        $out/share/icons/hicolor/512x512/apps/madame.png
    runHook postInstall
  '';

  desktopItems = [
    (pkgs.makeDesktopItem {
      name = "madame";
      desktopName = "Madame";
      exec = "madame %F";
      icon = "madame";
      mimeTypes = [ "text/markdown" ];
      categories = [ "Utility" "TextEditor" ];
    })
  ];

  meta = with pkgs.lib; {
    description = "Minimal two-pane Markdown editor/viewer";
    homepage = "https://github.com/shanehollon/madame";
    license = licenses.mit;
    platforms = [ "x86_64-linux" ];
    mainProgram = "madame";
  };
}
