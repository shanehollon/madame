export interface EditorConfig {
  tab_size: number;
  tab_inserts_spaces: boolean;
  word_wrap: boolean;
  font_family: string | null;
  font_size: number;
}

export interface PreviewConfig {
  debounce_ms: number;
  code_theme: string;
  scroll_sync: boolean;
}

export interface UiConfig {
  theme: "system" | "light" | "dark";
  remember_window: boolean;
  editor_position: "left" | "right";
}

export interface FilesConfig {
  recent_limit: number;
  watch_external_changes: boolean;
}

export interface KeybindingsConfig {
  open_file: string;
  save: string;
  save_as: string;
  recent_files: string;
  toggle_editor_only: string;
  toggle_preview_only: string;
}

export interface Config {
  editor: EditorConfig;
  preview: PreviewConfig;
  ui: UiConfig;
  files: FilesConfig;
  keybindings: KeybindingsConfig;
}

export interface WindowBounds {
  width: number;
  height: number;
  x: number | null;
  y: number | null;
  maximized: boolean;
}

export type ViewMode = "both" | "editor" | "preview";

export interface AppState {
  window: WindowBounds;
  splitter_ratio: number;
  view_mode: ViewMode;
  recent_files: string[];
  last_open_path: string | null;
}

export interface OpenFileResult {
  path: string;
  content: string;
}
