const ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
};

function escape(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ESCAPES[c]);
}

function renderInline(s: string): string {
  let out = "";
  let textBuf = "";
  let i = 0;
  const flush = () => {
    if (textBuf) {
      out += escape(textBuf);
      textBuf = "";
    }
  };
  while (i < s.length) {
    const ch = s[i];

    // inline code: `...`
    if (ch === "`") {
      const end = s.indexOf("`", i + 1);
      if (end !== -1) {
        flush();
        const inner = s.slice(i + 1, end);
        out += `<span class="tok-code"><span class="tok-markup">\`</span>${escape(inner)}<span class="tok-markup">\`</span></span>`;
        i = end + 1;
        continue;
      }
    }

    // link: [text](url)
    if (ch === "[") {
      const closeBracket = s.indexOf("]", i + 1);
      if (closeBracket !== -1 && s[closeBracket + 1] === "(") {
        const closeParen = s.indexOf(")", closeBracket + 2);
        if (closeParen !== -1) {
          flush();
          const linkText = s.slice(i + 1, closeBracket);
          const linkUrl = s.slice(closeBracket + 2, closeParen);
          out += `<span class="tok-markup">[</span><span class="tok-link-text">${escape(linkText)}</span><span class="tok-markup">](</span><span class="tok-link-url">${escape(linkUrl)}</span><span class="tok-markup">)</span>`;
          i = closeParen + 1;
          continue;
        }
      }
    }

    // strong: **...**  (must be checked before em)
    if (ch === "*" && s[i + 1] === "*") {
      const end = s.indexOf("**", i + 2);
      if (end !== -1 && end > i + 2) {
        flush();
        const inner = s.slice(i + 2, end);
        out += `<span class="tok-strong"><span class="tok-markup">**</span>${escape(inner)}<span class="tok-markup">**</span></span>`;
        i = end + 2;
        continue;
      }
    }

    // em: *...*
    if (ch === "*") {
      const end = s.indexOf("*", i + 1);
      if (end !== -1 && end > i + 1) {
        flush();
        const inner = s.slice(i + 1, end);
        out += `<span class="tok-em"><span class="tok-markup">*</span>${escape(inner)}<span class="tok-markup">*</span></span>`;
        i = end + 1;
        continue;
      }
    }

    textBuf += ch;
    i++;
  }
  flush();
  return out;
}

function renderBlock(line: string): string {
  const heading = /^(#{1,6}) (.*)$/.exec(line);
  if (heading) {
    const hashes = heading[1];
    const rest = heading[2];
    return `<span class="tok-heading"><span class="tok-markup">${hashes} </span>${renderInline(rest)}</span>`;
  }

  const quote = /^(\s*)> (.*)$/.exec(line);
  if (quote) {
    const indent = quote[1];
    const rest = quote[2];
    return `${indent}<span class="tok-quote"><span class="tok-markup">&gt; </span>${renderInline(rest)}</span>`;
  }

  const list = /^(\s*)([-*+]|\d+\.) (.*)$/.exec(line);
  if (list) {
    const indent = list[1];
    const marker = list[2];
    const rest = list[3];
    return `${indent}<span class="tok-list-marker">${escape(marker)}</span> ${renderInline(rest)}`;
  }

  return renderInline(line);
}

export function renderHighlight(source: string): string {
  if (source === "") return "";
  const lines = source.split("\n");
  const out: string[] = [];
  for (const line of lines) {
    out.push(renderBlock(line));
  }
  let html = out.join("\n");
  if (source.endsWith("\n")) html += " ";
  return html;
}
