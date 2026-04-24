import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { AppState, Config, OpenFileResult } from "./types";

export const ipc = {
  readConfig: () => invoke<Config>("read_config"),
  readState: () => invoke<AppState>("read_state"),
  writeState: (s: AppState) => invoke<void>("write_state", { newState: s }),
  getRecentFiles: () => invoke<string[]>("get_recent_files"),
  removeRecentFile: (path: string) => invoke<void>("remove_recent_file", { path }),
  openFile: (path: string) => invoke<OpenFileResult>("open_file", { path }),
  saveFile: (path: string, content: string) => invoke<void>("save_file", { path, content }),
  stopWatching: () => invoke<void>("stop_watching"),
};

export const events = {
  onFileChangedExternally: (cb: (path: string) => void): Promise<UnlistenFn> =>
    listen<string>("file-changed-externally", (e) => cb(e.payload)),

  onCliOpenPath: (cb: (path: string) => void): Promise<UnlistenFn> =>
    listen<string>("cli-open-path", (e) => cb(e.payload)),
};
