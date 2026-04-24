declare module "markdown-it-task-lists" {
  import type MarkdownIt from "markdown-it";
  function taskLists(md: MarkdownIt, opts?: { enabled?: boolean }): void;
  export = taskLists;
}
